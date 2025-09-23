import { LLMClient } from '../utils/llm-client.js';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { validateEntity } from '../../config/entity-schemas.js';

/**
 * Cloud LLM Entity Extractor using OpenAI, OpenRouter, or Anthropic
 * 
 * This extractor uses cloud-based LLMs to extract entities from 
 * construction project communications with higher accuracy than local models.
 */
export class CloudLLMExtractor {
    constructor(options = {}) {
        this.client = new LLMClient();
        this.provider = options.provider || 'openai';
        this.model = options.model || this.getDefaultModel();
        this.maxRetries = options.maxRetries || 2;
        this.costLimit = options.costLimit || parseFloat(process.env.DAILY_COST_LIMIT || 10);
        
        // Load prompts
        this.loadPrompts();
    }

    getDefaultModel() {
        switch (this.provider) {
            case 'openai':
                return 'gpt-3.5-turbo'; // Use a working OpenAI model
            case 'openrouter':
                return process.env.ENTITY_EXTRACTION_MODEL_CLOUD || 'anthropic/claude-3.5-sonnet';
            case 'anthropic':
                return 'claude-3-5-sonnet-20241022';
            default:
                return 'gpt-3.5-turbo';
        }
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

Return JSON in this exact format:
{
  "entities": {
    "people": [{"name": "string", "role": "string", "confidence": 0.95}],
    "projects": [{"name": "string", "type": "string", "phase": "string", "confidence": 0.90}],
    "decisions": [{"type": "string", "description": "string", "date": "string", "confidence": 0.85}],
    "timeline": [{"event": "string", "status": "string", "date": "string", "confidence": 0.80}],
    "locations": [],
    "materials": [],
    "costs": [],
    "issues": [],
    "tasks": [],
    "documents": []
  },
  "summary": "Brief summary of the communication"
}

Include confidence scores (0.0-1.0) for each entity. Only extract entities you are confident about (>0.7).
Return ONLY the JSON object, no additional text.`;
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

        // Check cost limits
        const costSummary = this.client.getCostSummary();
        if (costSummary.dailyCost > this.costLimit) {
            throw new Error(`Daily cost limit exceeded: $${costSummary.dailyCost.toFixed(2)} > $${this.costLimit}`);
        }

        console.log(chalk.blue(`🔍 Extracting entities using cloud LLM (${this.provider}:${this.model})...`));
        
        const startTime = Date.now();
        let attempt = 0;
        
        while (attempt < this.maxRetries) {
            try {
                const prompt = this.buildPrompt(text, communicationType, context);
                
                const result = await this.client.generateCompletion(prompt, {
                    provider: this.provider,
                    model: this.model,
                    maxTokens: 2000,
                    temperature: 0.1,
                    systemPrompt: this.getSystemPrompt()
                });

                const entities = this.parseResponse(result.content);
                const validatedEntities = this.validateExtractedEntities(entities);
                
                const duration = Date.now() - startTime;
                
                console.log(chalk.green(`✅ Cloud extraction completed in ${duration}ms`));
                
                return {
                    entities: validatedEntities.entities,
                    relationships: validatedEntities.relationships || [],
                    summary: validatedEntities.summary || '',
                    content: result.content, // Store the full response
                    metadata: {
                        model: this.model,
                        provider: this.provider,
                        duration,
                        attempt: attempt + 1,
                        confidence: this.calculateOverallConfidence(validatedEntities.entities),
                        cost: result.usage ? this.estimateCost(result.usage) : 0,
                        fullPrompt: prompt, // Store the full prompt
                        fullResponse: result.content // Store the full response
                    }
                };
                
            } catch (error) {
                attempt++;
                console.warn(chalk.yellow(`⚠️  Attempt ${attempt} failed: ${error.message}`));
                
                if (attempt >= this.maxRetries) {
                    console.error(chalk.red(`❌ Cloud extraction failed after ${this.maxRetries} attempts`));
                    throw new Error(`Cloud LLM extraction failed: ${error.message}`);
                }
                
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
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

Always return valid JSON that matches the specified schema. Do not include any explanatory text, only the JSON response.`;
    }

    parseResponse(response) {
        try {
            // Clean the response - remove any markdown formatting or extra text
            let cleanResponse = response.trim();
            
            // Remove markdown code blocks if present
            cleanResponse = cleanResponse.replace(/```json\s*/, '').replace(/```\s*$/, '');
            
            // Find JSON object in the response
            const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            // If no JSON found, try to parse the entire response
            return JSON.parse(cleanResponse);
            
        } catch (error) {
            console.warn(chalk.yellow('⚠️  Failed to parse JSON response, attempting to extract entities manually'));
            console.log('Raw response:', response);
            
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
        for (const name of names.slice(0, 3)) { // Limit to 3 names
            if (name.length > 2 && !['The', 'And', 'But', 'For', 'JSON'].includes(name)) {
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
                    entity.confidence = 0.7; // Default confidence for cloud LLM
                }

                // Clamp confidence to valid range
                entity.confidence = Math.max(0, Math.min(1, entity.confidence));

                // Only include entities with reasonable confidence
                if (entity.confidence >= 0.5) {
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

    estimateCost(usage) {
        if (!usage || !usage.total_tokens) return 0;

        // Rough cost estimates (per 1000 tokens)
        let inputCost = 0, outputCost = 0;
        
        if (this.provider === 'openai') {
            if (this.model.includes('gpt-4')) {
                inputCost = 0.03;
                outputCost = 0.06;
            } else if (this.model.includes('gpt-3.5')) {
                inputCost = 0.001;
                outputCost = 0.002;
            }
        } else if (this.provider === 'anthropic') {
            inputCost = 0.003;
            outputCost = 0.015;
        }

        const cost = (usage.prompt_tokens * inputCost + usage.completion_tokens * outputCost) / 1000;
        return cost;
    }

    /**
     * Extract entities from multiple messages in batch
     */
    async extractBatch(messages, options = {}) {
        console.log(chalk.blue(`🔄 Processing batch of ${messages.length} messages with cloud LLM...`));
        
        const results = [];
        const batchSize = options.batchSize || 3; // Smaller batches for cloud to manage costs
        
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
            
            // Delay between batches to respect rate limits
            if (i + batchSize < messages.length) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        const successCount = results.filter(r => r.success).length;
        const totalCost = results
            .filter(r => r.success && r.metadata.cost)
            .reduce((sum, r) => sum + r.metadata.cost, 0);
            
        console.log(chalk.green(`✅ Batch processing complete: ${successCount}/${messages.length} successful`));
        console.log(chalk.blue(`💰 Total cost: $${totalCost.toFixed(4)}`));
        
        return results;
    }

    /**
     * Test the extractor with a simple message
     */
    async test() {
        console.log(chalk.blue(`🧪 Testing cloud LLM extractor (${this.provider}:${this.model})...`));
        
        const testMessage = "Hey Mike, when can we start the foundation work? The permits came through yesterday.";
        
        try {
            const result = await this.extractEntities(testMessage, {
                communicationType: 'sms'
            });
            
            console.log(chalk.green('✅ Test successful!'));
            console.log('Extracted entities:', JSON.stringify(result.entities, null, 2));
            console.log('Summary:', result.summary);
            console.log('Metadata:', result.metadata);
            
            return result;
        } catch (error) {
            console.error(chalk.red('❌ Test failed:'), error.message);
            throw error;
        }
    }
}

// CLI interface for testing
if (import.meta.url === `file://${process.argv[1]}`) {
    const provider = process.argv.includes('--anthropic') ? 'anthropic' : 
                    process.argv.includes('--openrouter') ? 'openrouter' : 'openai';
    
    const extractor = new CloudLLMExtractor({ provider });
    
    if (process.argv.includes('--test')) {
        extractor.test().catch(console.error);
    } else {
        console.log(chalk.blue('Cloud LLM Extractor'));
        console.log(chalk.cyan('Usage: node cloud-llm-extractor.js --test [--anthropic|--openrouter]'));
    }
}

export default CloudLLMExtractor;
