import { LLMClient } from '../utils/llm-client.js';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { validateEntity } from '../../config/entity-schemas.js';
import { EntitySchema } from '../relationships/entity-schema.js';
import { RelationshipValidator, ALL_RELATIONSHIPS } from '../relationships/relationship-types.js';

/**
 * Enhanced Relationship Extractor
 * 
 * Advanced entity extractor that identifies both entities and their semantic relationships
 * using the comprehensive relationship type registry and validation system.
 */
export class EnhancedRelationshipExtractor {
    constructor(options = {}) {
        this.client = new LLMClient();
        this.provider = options.provider || 'openai';
        this.model = options.model || this.getDefaultModel();
        this.maxRetries = options.maxRetries || 2;
        this.costLimit = options.costLimit || parseFloat(process.env.DAILY_COST_LIMIT || 10);
        this.domain = options.domain || 'construction';
        
        // Load enhanced prompts
        this.loadEnhancedPrompts();
        
        // Initialize relationship validator
        this.relationshipValidator = RelationshipValidator;
    }

    getDefaultModel() {
        switch (this.provider) {
            case 'openai':
                return 'gpt-4o-mini'; // Use GPT-4 for better relationship extraction
            case 'openrouter':
                return process.env.ENTITY_EXTRACTION_MODEL_CLOUD || 'anthropic/claude-3.5-sonnet';
            case 'anthropic':
                return 'claude-3-5-sonnet-20241022';
            default:
                return 'gpt-4o-mini';
        }
    }

    async loadEnhancedPrompts() {
        try {
            const promptPath = path.join(process.cwd(), 'prompts/entity-extraction/enhanced-construction-entities.md');
            this.promptTemplate = await fs.readFile(promptPath, 'utf8');
        } catch (error) {
            console.warn(chalk.yellow('⚠️  Could not load enhanced prompt template, using default'));
            this.promptTemplate = this.getDefaultEnhancedPrompt();
        }
    }

    getDefaultEnhancedPrompt() {
        return `You are an expert entity and relationship extraction system for construction project communications.

Extract entities AND their semantic relationships from the following text and return them in JSON format.

Entity types to extract:
- PERSON: People involved (name, role, company)
- PROJECT: Construction work (name, type, phase)  
- DECISION: Decisions made (type, description, date)
- TIMELINE: Schedule items (event, status, date, duration)
- LOCATION: Places (name, type, address)
- MATERIAL: Construction materials (name, category, quantity)
- COST: Budget items (amount, type, category)
- ISSUE: Problems (description, severity, status)
- TASK: Action items (description, assigned_to, due_date)
- DOCUMENT: References to documents (name, type, status)

Relationship types to extract:
- manages: [Person] manages [Project/System/Resource]
- assigned_to: [Task/Project] assigned_to [Person]
- requires: [Task/Component] requires [Material/Tool]
- precedes: [Task A] precedes [Task B]
- supplies: [Vendor] supplies [Material/Service]
- located_at: [Entity] located_at [Location]
- responsible_for: [Person] responsible_for [Task/Outcome/Area]

Return JSON in this EXACT format with these EXACT field names:
{
  "entities": {
    "people": [{"name": "string", "role": "string", "confidence": 0.95}],
    "projects": [{"name": "string", "type": "string", "phase": "string", "confidence": 0.90}],
    "decisions": [],
    "timeline": [],
    "locations": [],
    "materials": [],
    "costs": [],
    "issues": [],
    "tasks": [],
    "documents": []
  },
  "relationships": [
    {
      "type": "manages",
      "source": "Person Name",
      "target": "Project Name",
      "confidence": 0.90,
      "source_type": "person",
      "target_type": "project",
      "metadata": {
        "context": "Brief explanation of the relationship"
      }
    }
  ],
  "summary": "Brief summary of the communication"
}

IMPORTANT: Use "type" not "relationship_type". Use "source" and "target" not other field names.

CRITICAL REQUIREMENTS:
- Use "type" field for relationship type (NOT "relationship_type")
- Use "source" and "target" fields for relationship endpoints
- Include confidence scores (0.0-1.0) for each entity and relationship
- Only extract entities and relationships you are confident about (>0.7)
- Return ONLY the JSON object, no additional text or markdown formatting
- Ensure all JSON is valid and properly formatted

Return ONLY the JSON object, no additional text.`;
    }

    /**
     * Extract entities and relationships from text
     */
    async extractEntitiesAndRelationships(text, options = {}) {
        const {
            communicationType = 'sms',
            context = '',
            domain = this.domain
        } = options;

        // Check cost limits
        const costSummary = this.client.getCostSummary();
        if (costSummary.dailyCost > this.costLimit) {
            throw new Error(`Daily cost limit exceeded: $${costSummary.dailyCost.toFixed(2)} > $${this.costLimit}`);
        }

        console.log(chalk.blue(`🔍 Extracting entities and relationships using enhanced LLM (${this.provider}:${this.model})...`));
        
        const startTime = Date.now();
        let attempt = 0;
        
        while (attempt < this.maxRetries) {
            try {
                const prompt = this.buildEnhancedPrompt(text, communicationType, context, domain);
                
                const result = await this.client.generateCompletion(prompt, {
                    provider: this.provider,
                    model: this.model,
                    maxTokens: 3000, // Increased for relationship extraction
                    temperature: 0.1,
                    systemPrompt: this.getEnhancedSystemPrompt(domain)
                });

                const extractedData = this.parseEnhancedResponse(result.content);
                const validatedData = await this.validateExtractedData(extractedData, domain);
                
                const duration = Date.now() - startTime;
                
                console.log(chalk.green(`✅ Enhanced extraction completed in ${duration}ms`));
                console.log(chalk.cyan(`   - Entities: ${this.countEntities(validatedData.entities)}`));
                console.log(chalk.cyan(`   - Relationships: ${validatedData.relationships.length}`));
                
                return {
                    entities: validatedData.entities,
                    relationships: validatedData.relationships,
                    summary: validatedData.summary || '',
                    metadata: {
                        model: this.model,
                        provider: this.provider,
                        domain: domain,
                        duration,
                        attempt: attempt + 1,
                        confidence: this.calculateOverallConfidence(validatedData),
                        cost: result.usage ? this.estimateCost(result.usage) : 0,
                        entityCount: this.countEntities(validatedData.entities),
                        relationshipCount: validatedData.relationships.length,
                        extractionType: 'enhanced_relationship'
                    }
                };
                
            } catch (error) {
                attempt++;
                console.warn(chalk.yellow(`⚠️  Attempt ${attempt} failed: ${error.message}`));
                
                if (attempt >= this.maxRetries) {
                    throw new Error(`Enhanced extraction failed after ${this.maxRetries} attempts: ${error.message}`);
                }
                
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }

    buildEnhancedPrompt(text, communicationType, context, domain) {
        // Get domain-specific relationship types
        const domainRelationships = this.relationshipValidator.getRelationshipsByDomain(domain);
        const relationshipTypes = Object.keys(domainRelationships).slice(0, 10); // Limit to avoid token overflow
        
        const relationshipList = relationshipTypes.map(type => {
            const def = domainRelationships[type];
            return `- ${type}: ${def.description}`;
        }).join('\n');

        return `Extract entities and their semantic relationships from this ${communicationType} communication:

COMMUNICATION:
${text}

CONTEXT:
${context || `This is ${domain} domain communication focusing on project management and coordination.`}

DOMAIN: ${domain}

AVAILABLE RELATIONSHIP TYPES:
${relationshipList}

Focus on extracting:
1. All relevant entities with confidence scores
2. Semantic relationships between entities
3. Temporal context where available
4. Dependencies and sequences

Return the structured JSON as specified in the format above.

TEXT TO ANALYZE:
${text}`;
    }

    getEnhancedSystemPrompt(domain) {
        return `You are an expert entity and relationship extraction system specialized in ${domain} communications. 

Your task is to:
1. Extract structured entities from the text
2. Identify semantic relationships between entities
3. Assign confidence scores to all extractions
4. Include relevant metadata and temporal context

Focus on actionable information that can be used for project management, decision-making, and context retrieval.

Always return valid JSON with the specified structure.`;
    }

    parseEnhancedResponse(content) {
        try {
            // Clean the response - remove any markdown formatting or extra text
            let cleanContent = content.trim();
            
            // Remove markdown code blocks if present
            cleanContent = cleanContent.replace(/```json\s*/g, '').replace(/```\s*/g, '');
            
            // Find JSON object boundaries
            const jsonStart = cleanContent.indexOf('{');
            const jsonEnd = cleanContent.lastIndexOf('}') + 1;
            
            if (jsonStart === -1 || jsonEnd === 0) {
                throw new Error('No JSON object found in response');
            }
            
            cleanContent = cleanContent.substring(jsonStart, jsonEnd);
            
            const parsed = JSON.parse(cleanContent);
            
            // Log the parsed response for debugging
            console.log(chalk.gray('Parsed response structure:'), {
                entities: Object.keys(parsed.entities || {}),
                relationshipCount: (parsed.relationships || []).length,
                summary: parsed.summary ? 'present' : 'missing'
            });
            
            // Ensure required structure
            if (!parsed.entities) {
                parsed.entities = {};
            }
            if (!parsed.relationships) {
                parsed.relationships = [];
            }
            
            return parsed;
            
        } catch (error) {
            console.error(chalk.red('Failed to parse LLM response:'), error.message);
            console.error(chalk.gray('Raw content (first 500 chars):'), content.substring(0, 500));
            
            // Return empty structure on parse failure
            return {
                entities: {
                    people: [],
                    projects: [],
                    decisions: [],
                    timeline: [],
                    locations: [],
                    materials: [],
                    costs: [],
                    issues: [],
                    tasks: [],
                    documents: []
                },
                relationships: [],
                summary: 'Failed to parse extraction results'
            };
        }
    }

    async validateExtractedData(data, domain) {
        const validatedData = {
            entities: data.entities || {},
            relationships: [],
            summary: data.summary || ''
        };

        // Validate and clean relationships
        if (data.relationships && Array.isArray(data.relationships)) {
            for (const rel of data.relationships) {
                try {
                    // Normalize relationship field names
                    if (rel.relationship_type && !rel.type) {
                        rel.type = rel.relationship_type;
                    }
                    
                    // Validate relationship structure
                    if (!rel.type || !rel.source || !rel.target) {
                        console.warn(chalk.yellow(`⚠️  Skipping incomplete relationship: ${JSON.stringify(rel)}`));
                        continue;
                    }

                    // Validate relationship type
                    if (!this.relationshipValidator.validateRelationshipType(rel.type)) {
                        console.warn(chalk.yellow(`⚠️  Unknown relationship type: ${rel.type}, skipping`));
                        continue;
                    }

                    // Ensure confidence is valid
                    if (!rel.confidence || rel.confidence < 0.7) {
                        console.warn(chalk.yellow(`⚠️  Low confidence relationship skipped: ${rel.type} (${rel.confidence || 'undefined'})`));
                        continue;
                    }

                    // Add default metadata if missing
                    if (!rel.metadata) {
                        rel.metadata = {};
                    }

                    // Add source and target types if missing
                    if (!rel.source_type) {
                        rel.source_type = this.inferEntityType(rel.source, validatedData.entities);
                    }
                    if (!rel.target_type) {
                        rel.target_type = this.inferEntityType(rel.target, validatedData.entities);
                    }

                    // Add extraction timestamp
                    rel.createdAt = new Date().toISOString();
                    rel.source = 'llm_extraction';

                    validatedData.relationships.push(rel);

                } catch (error) {
                    console.warn(chalk.yellow(`⚠️  Relationship validation failed: ${error.message}`));
                }
            }
        }

        console.log(chalk.cyan(`✅ Validated ${validatedData.relationships.length} relationships`));
        
        return validatedData;
    }

    inferEntityType(entityName, entities) {
        // Try to find the entity in the extracted entities to determine its type
        for (const [type, entityList] of Object.entries(entities)) {
            if (Array.isArray(entityList)) {
                for (const entity of entityList) {
                    if (entity.name === entityName) {
                        return type.slice(0, -1); // Remove 's' from plural (people -> person)
                    }
                }
            }
        }
        return 'unknown';
    }

    countEntities(entities) {
        let count = 0;
        for (const entityList of Object.values(entities)) {
            if (Array.isArray(entityList)) {
                count += entityList.length;
            }
        }
        return count;
    }

    calculateOverallConfidence(data) {
        let totalConfidence = 0;
        let count = 0;

        // Calculate entity confidence
        for (const entityList of Object.values(data.entities)) {
            if (Array.isArray(entityList)) {
                for (const entity of entityList) {
                    if (entity.confidence) {
                        totalConfidence += entity.confidence;
                        count++;
                    }
                }
            }
        }

        // Calculate relationship confidence
        for (const rel of data.relationships) {
            if (rel.confidence) {
                totalConfidence += rel.confidence;
                count++;
            }
        }

        return count > 0 ? totalConfidence / count : 0;
    }

    estimateCost(usage) {
        // Rough cost estimation based on token usage
        const inputCost = (usage.prompt_tokens || 0) * 0.0001 / 1000;
        const outputCost = (usage.completion_tokens || 0) * 0.0002 / 1000;
        return inputCost + outputCost;
    }

    /**
     * Create enhanced entity with relationships
     */
    async createEnhancedEntity(extractedData, conversationId, userId, domain) {
        // Create base entity structure
        const entity = {
            id: `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            conversationId,
            userId,
            timestamp: new Date().toISOString(),
            domain,
            entities: extractedData.entities,
            metadata: extractedData.metadata
        };

        // Use EntitySchema to create enhanced entity with relationships
        const enhancedEntity = EntitySchema.createEntity(entity);

        // Add extracted relationships
        if (extractedData.relationships && extractedData.relationships.length > 0) {
            for (const rel of extractedData.relationships) {
                try {
                    EntitySchema.addRelationship(enhancedEntity, {
                        type: rel.type,
                        target: rel.target,
                        confidence: rel.confidence,
                        source: 'llm_extraction',
                        establishedOn: rel.established_on,
                        metadata: {
                            ...rel.metadata,
                            sourceType: rel.source_type,
                            targetType: rel.target_type,
                            extractionContext: rel.context
                        }
                    });
                } catch (error) {
                    console.warn(chalk.yellow(`⚠️  Failed to add relationship: ${error.message}`));
                }
            }
        }

        return enhancedEntity;
    }
}

export default EnhancedRelationshipExtractor;
