import { LLMClient } from '../utils/llm-client.js';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { validateEntity } from '../../config/entity-schemas.js';

/**
 * Local LLM Entity Extractor using Ollama
 * 
 * This extractor uses a locally running LLM (via Ollama) to extract
 * entities from construction project communications.
 */
export class LocalLLMExtractor {
    constructor(options = {}) {
        this.client = new LLMClient();
        this.model = options.model || process.env.ENTITY_EXTRACTION_MODEL_LOCAL || 'llama3.1:8b';
        this.maxRetries = options.maxRetries || 3;
        this.timeout = options.timeout || 60000; // 60 seconds
        
        // Load prompts
        this.loadPrompts();
    }

    async loadPrompts() {
        try {
            const promptPath = path.join(process.cwd(), 'prompts/entity-extraction/construction-entities.md');
            this.promptTemplate = await fs.readFile(promptPath, 'utf8');
        } catch (error) {
            console.warn(chalk.yellow('⚠️  Could not load prompt template, using default'));
            this.promptTemplate = this.getDefaultPrompt();
        }
    }

    getDefaultPrompt() {
        return `You are an expert entity extraction system for construction project communications.

Extract entities from the following text and return them in JSON format.

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

Return JSON in this format:
{
  "entities": {
    "people": [...],
    "projects": [...],
    "decisions": [...],
    "timeline": [...],
    "locations": [...],
    "materials": [...],
    "costs": [...],
    "issues": [...],
    "tasks": [...],
    "documents": [...]
  },
  "summary": "Brief summary of the communication"
}

Include confidence scores (0.0-1.0) for each entity. Only extract entities you are confident about (>0.7).`;
    }

    /**
     * Extract entities from a single message or conversation
     */
    async extractEntities(text, options = {}) {
        const {
            communicationType = 'sms',
            context = '',
            includeRelationships = true
        } = options;

        console.log(chalk.blue(`🔍 Extracting entities using local LLM (${this.model})...`));
        
        const startTime = Date.now();
        let attempt = 0;
        
        while (attempt < this.maxRetries) {
            try {
                const prompt = this.buildPrompt(text, communicationType, context);
                
                const result = await this.client.generateCompletion(prompt, {
                    provider: 'ollama',
                    model: this.model,
                    maxTokens: 2000,
                    temperature: 0.1,
                    systemPrompt: this.getSystemPrompt()
                });

                const entities = this.parseResponse(result.content);
                const validatedEntities = this.validateExtractedEntities(entities);
                
                const duration = Date.now() - startTime;
                
                console.log(chalk.green(`✅ Local extraction completed in ${duration}ms`));
                
                return {
                    entities: validatedEntities.entities,
                    relationships: validatedEntities.relationships || [],
                    summary: validatedEntities.summary || '',
                    metadata: {
                        model: this.model,
                        provider: 'ollama',
                        duration,
                        attempt: attempt + 1,
                        confidence: this.calculateOverallConfidence(validatedEntities.entities)
                    }
                };
                
            } catch (error) {
                attempt++;
                console.warn(chalk.yellow(`⚠️  Attempt ${attempt} failed: ${error.message}`));
                
                if (attempt >= this.maxRetries) {
                    console.error(chalk.red(`❌ Local extraction failed after ${this.maxRetries} attempts`));
                    throw new Error(`Local LLM extraction failed: ${error.message}`);
                }
                
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }

    buildPrompt(text, communicationType, context) {
        let prompt = this.getDefaultPrompt();
        
        // Add communication type specific instructions
        if (communicationType === 'email') {
            prompt += `\n\nThis is an email communication. Pay attention to formal language, document references, and detailed specifications.`;
        } else if (communicationType === 'sms') {
            prompt += `\n\nThis is an SMS/text conversation. Expect informal language, abbreviations, and quick exchanges.`;
        } else if (communicationType === 'meeting_notes') {
            prompt += `\n\nThese are meeting notes. Focus on decisions made, action items assigned, and progress updates.`;
        }

        // Add context if provided
        if (context) {
            prompt += `\n\nCONTEXT: ${context}`;
        }

        prompt += `\n\nTEXT TO ANALYZE:\n${text}`;
        
        return prompt;
    }

    getSystemPrompt() {
        return `You are an expert entity extraction system specialized in construction project communications. 
        
Your task is to analyze text and extract structured entities in JSON format. Be conservative and only extract entities you are confident about. Use consistent naming and include confidence scores for each entity.

Always return valid JSON that matches the specified schema.`;
    }

    parseResponse(response) {
        try {
            // Try to find JSON in the response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            // If no JSON found, try to parse the entire response
            return JSON.parse(response);
            
        } catch (error) {
            console.warn(chalk.yellow('⚠️  Failed to parse JSON response, attempting to extract entities manually'));
            
            // Fallback: try to extract basic information
            return this.fallbackExtraction(response);
        }
    }

    fallbackExtraction(text) {
        // Basic fallback extraction when JSON parsing fails
        const entities = {
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
        };

        // Simple pattern matching for common entities
        const namePattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
        const costPattern = /\$[\d,]+(?:\.\d{2})?/g;
        const datePattern = /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|today|tomorrow|yesterday|next\s+week)\b/gi;

        // Extract potential names
        const names = text.match(namePattern) || [];
        for (const name of names.slice(0, 5)) { // Limit to 5 names
            if (name.length > 2 && !['The', 'And', 'But', 'For'].includes(name)) {
                entities.people.push({
                    name,
                    confidence: 0.5
                });
            }
        }

        // Extract costs
        const costs = text.match(costPattern) || [];
        for (const cost of costs) {
            const amount = parseFloat(cost.replace(/[$,]/g, ''));
            entities.costs.push({
                amount,
                currency: 'USD',
                type: 'estimate',
                confidence: 0.6
            });
        }

        // Extract timeline references
        const dates = text.match(datePattern) || [];
        for (const date of dates) {
            entities.timeline.push({
                event: 'scheduled event',
                date: date.toLowerCase(),
                status: 'planned',
                confidence: 0.4
            });
        }

        return {
            entities,
            summary: 'Fallback extraction due to parsing error'
        };
    }

    validateExtractedEntities(extractedData) {
        if (!extractedData || !extractedData.entities) {
            throw new Error('Invalid extraction result: missing entities');
        }

        const validatedEntities = {};
        const validationErrors = [];

        // Validate each entity type
        for (const [entityType, entityList] of Object.entries(extractedData.entities)) {
            if (!Array.isArray(entityList)) {
                validationErrors.push(`${entityType} should be an array`);
                continue;
            }

            validatedEntities[entityType] = [];

            for (const entity of entityList) {
                // Add basic validation
                if (typeof entity !== 'object') {
                    validationErrors.push(`Invalid entity in ${entityType}: not an object`);
                    continue;
                }

                // Ensure confidence score exists and is valid
                if (!entity.confidence || typeof entity.confidence !== 'number') {
                    entity.confidence = 0.5; // Default confidence
                }

                // Clamp confidence to valid range
                entity.confidence = Math.max(0, Math.min(1, entity.confidence));

                // Only include entities with reasonable confidence
                if (entity.confidence >= 0.4) {
                    validatedEntities[entityType].push(entity);
                }
            }
        }

        if (validationErrors.length > 0) {
            console.warn(chalk.yellow(`⚠️  Validation warnings: ${validationErrors.join(', ')}`));
        }

        return {
            entities: validatedEntities,
            relationships: extractedData.relationships || [],
            summary: extractedData.summary || ''
        };
    }

    calculateOverallConfidence(entities) {
        let totalConfidence = 0;
        let entityCount = 0;

        for (const entityList of Object.values(entities)) {
            for (const entity of entityList) {
                totalConfidence += entity.confidence || 0;
                entityCount++;
            }
        }

        return entityCount > 0 ? totalConfidence / entityCount : 0;
    }

    /**
     * Extract entities from multiple messages in batch
     */
    async extractBatch(messages, options = {}) {
        console.log(chalk.blue(`🔄 Processing batch of ${messages.length} messages...`));
        
        const results = [];
        const batchSize = options.batchSize || 5;
        
        for (let i = 0; i < messages.length; i += batchSize) {
            const batch = messages.slice(i, i + batchSize);
            const batchPromises = batch.map(async (message, index) => {
                try {
                    const result = await this.extractEntities(message.text, {
                        ...options,
                        context: message.context || ''
                    });
                    
                    return {
                        id: message.id || `msg_${i + index}`,
                        success: true,
                        ...result
                    };
                } catch (error) {
                    console.error(chalk.red(`❌ Failed to process message ${message.id || i + index}: ${error.message}`));
                    return {
                        id: message.id || `msg_${i + index}`,
                        success: false,
                        error: error.message
                    };
                }
            });

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            
            // Small delay between batches to avoid overwhelming the local LLM
            if (i + batchSize < messages.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        const successCount = results.filter(r => r.success).length;
        console.log(chalk.green(`✅ Batch processing complete: ${successCount}/${messages.length} successful`));
        
        return results;
    }

    /**
     * Test the extractor with a simple message
     */
    async test() {
        console.log(chalk.blue('🧪 Testing local LLM extractor...'));
        
        const testMessage = "Hey Mike, when can we start the foundation work? The permits came through yesterday.";
        
        try {
            const result = await this.extractEntities(testMessage, {
                communicationType: 'sms'
            });
            
            console.log(chalk.green('✅ Test successful!'));
            console.log('Extracted entities:', JSON.stringify(result.entities, null, 2));
            
            return result;
        } catch (error) {
            console.error(chalk.red('❌ Test failed:'), error.message);
            throw error;
        }
    }
}

// CLI interface for testing
if (import.meta.url === `file://${process.argv[1]}`) {
    const extractor = new LocalLLMExtractor();
    
    if (process.argv.includes('--test')) {
        extractor.test().catch(console.error);
    } else {
        console.log(chalk.blue('Local LLM Extractor'));
        console.log(chalk.cyan('Usage: node local-llm-extractor.js --test'));
    }
}

export default LocalLLMExtractor;
