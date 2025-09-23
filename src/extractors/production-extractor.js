import CloudLLMExtractor from './cloud-llm-extractor.js';
import chalk from 'chalk';

/**
 * Production-optimized entity extractor
 * 
 * Uses the best performing model (GPT-4) with optimized prompts
 * and intelligent fallback strategies.
 */
export class ProductionExtractor {
    constructor(options = {}) {
        // Primary extractor - best accuracy
        this.primaryExtractor = new CloudLLMExtractor({
            provider: 'openai',
            model: 'gpt-4',
            ...options
        });
        
        // Fallback extractor - faster and cheaper
        this.fallbackExtractor = new CloudLLMExtractor({
            provider: 'openrouter',
            model: 'anthropic/claude-3.5-sonnet',
            ...options
        });
        
        // Fast extractor - for simple messages
        this.fastExtractor = new CloudLLMExtractor({
            provider: 'openai',
            model: 'gpt-3.5-turbo',
            ...options
        });
        
        this.costLimit = options.costLimit || 0.10; // $0.10 per message limit
        this.timeLimit = options.timeLimit || 15000; // 15 second limit
    }

    /**
     * Intelligent extraction with model selection based on message complexity
     */
    async extractEntities(text, options = {}) {
        const complexity = this.analyzeComplexity(text);
        const strategy = this.selectStrategy(complexity, options);
        
        console.log(chalk.blue(`🎯 Using ${strategy.name} strategy for extraction...`));
        
        try {
            return await this.executeStrategy(strategy, text, options);
        } catch (error) {
            console.warn(chalk.yellow(`⚠️  Primary strategy failed, trying fallback...`));
            return await this.executeFallback(text, options);
        }
    }

    analyzeComplexity(text) {
        const wordCount = text.split(/\s+/).length;
        const hasNumbers = /\$[\d,]+|\d+\s*(weeks?|days?|months?)|\d+%/.test(text);
        const hasNames = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/.test(text);
        const hasDecisions = /\b(approved?|rejected?|decided?|agreed?|confirmed?)\b/i.test(text);
        const hasTimeline = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|yesterday|next\s+week|deadline|schedule)\b/i.test(text);
        
        let complexityScore = 0;
        
        if (wordCount > 100) complexityScore += 2;
        else if (wordCount > 50) complexityScore += 1;
        
        if (hasNumbers) complexityScore += 1;
        if (hasNames) complexityScore += 1;
        if (hasDecisions) complexityScore += 1;
        if (hasTimeline) complexityScore += 1;
        
        return {
            score: complexityScore,
            wordCount,
            hasNumbers,
            hasNames,
            hasDecisions,
            hasTimeline,
            level: complexityScore >= 4 ? 'high' : complexityScore >= 2 ? 'medium' : 'low'
        };
    }

    selectStrategy(complexity, options) {
        const forceHighAccuracy = options.forceHighAccuracy || false;
        const urgentRequest = options.urgent || false;
        
        if (forceHighAccuracy || complexity.level === 'high') {
            return {
                name: 'High Accuracy (GPT-4)',
                extractor: this.primaryExtractor,
                maxCost: 0.10,
                maxTime: 30000
            };
        } else if (complexity.level === 'medium') {
            return {
                name: 'Balanced (Claude 3.5)',
                extractor: this.fallbackExtractor,
                maxCost: 0.05,
                maxTime: 15000
            };
        } else {
            return {
                name: 'Fast (GPT-3.5)',
                extractor: this.fastExtractor,
                maxCost: 0.02,
                maxTime: 10000
            };
        }
    }

    async executeStrategy(strategy, text, options) {
        const startTime = Date.now();
        
        // Set timeout
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Extraction timeout')), strategy.maxTime);
        });
        
        const extractionPromise = strategy.extractor.extractEntities(text, options);
        
        try {
            const result = await Promise.race([extractionPromise, timeoutPromise]);
            const duration = Date.now() - startTime;
            
            // Check cost limits
            if (result.metadata.cost > strategy.maxCost) {
                console.warn(chalk.yellow(`⚠️  Cost exceeded limit: $${result.metadata.cost.toFixed(4)} > $${strategy.maxCost}`));
            }
            
            // Add strategy info to metadata
            result.metadata.strategy = strategy.name;
            result.metadata.complexity = this.analyzeComplexity(text);
            
            return result;
            
        } catch (error) {
            if (error.message === 'Extraction timeout') {
                throw new Error(`${strategy.name} timed out after ${strategy.maxTime}ms`);
            }
            throw error;
        }
    }

    async executeFallback(text, options) {
        console.log(chalk.yellow('🔄 Executing fallback strategy...'));
        
        try {
            // Try fast extractor first
            const result = await this.fastExtractor.extractEntities(text, options);
            result.metadata.strategy = 'Fallback (GPT-3.5)';
            result.metadata.isFallback = true;
            return result;
        } catch (error) {
            // Last resort - return basic extraction
            console.error(chalk.red('❌ All extraction strategies failed'));
            return this.createBasicExtraction(text);
        }
    }

    createBasicExtraction(text) {
        // Very basic rule-based extraction as last resort
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

        // Extract names
        const nameMatches = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
        for (const name of [...new Set(nameMatches)].slice(0, 3)) {
            if (name.length > 2 && !['The', 'And', 'But', 'For', 'This', 'That'].includes(name)) {
                entities.people.push({ name, confidence: 0.5 });
            }
        }

        // Extract costs
        const costMatches = text.match(/\$[\d,]+(?:\.\d{2})?/g) || [];
        for (const cost of costMatches) {
            const amount = parseFloat(cost.replace(/[$,]/g, ''));
            entities.costs.push({ amount, currency: 'USD', type: 'estimate', confidence: 0.6 });
        }

        return {
            entities,
            relationships: [],
            summary: 'Basic rule-based extraction (fallback)',
            metadata: {
                strategy: 'Rule-based Fallback',
                confidence: 0.3,
                isFallback: true,
                isBasic: true
            }
        };
    }

    /**
     * Batch processing with intelligent load balancing
     */
    async extractBatch(messages, options = {}) {
        console.log(chalk.blue(`🔄 Processing batch of ${messages.length} messages with intelligent routing...`));
        
        const results = [];
        const batchSize = options.batchSize || 3;
        let totalCost = 0;
        
        for (let i = 0; i < messages.length; i += batchSize) {
            const batch = messages.slice(i, i + batchSize);
            
            const batchPromises = batch.map(async (message, index) => {
                try {
                    // Check if we're approaching cost limits
                    const remainingBudget = this.costLimit - totalCost;
                    const messageOptions = {
                        ...options,
                        forceHighAccuracy: remainingBudget > 0.05 && options.forceHighAccuracy
                    };
                    
                    const result = await this.extractEntities(message.text, messageOptions);
                    
                    totalCost += result.metadata.cost || 0;
                    
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
            
            // Adaptive delay based on cost and performance
            if (i + batchSize < messages.length) {
                const delay = totalCost > 0.50 ? 3000 : 1000; // Longer delay if costs are high
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        const successCount = results.filter(r => r.success).length;
        console.log(chalk.green(`✅ Batch processing complete: ${successCount}/${messages.length} successful`));
        console.log(chalk.blue(`💰 Total cost: $${totalCost.toFixed(4)}`));
        
        return results;
    }

    /**
     * Test with real SMS data from twilio-listener
     */
    async testWithRealData() {
        console.log(chalk.blue('🧪 Testing with real SMS conversation data...'));
        
        try {
            // Try to load real conversation data
            const conversationPath = '../twilio-listener/conversations';
            const fs = await import('fs-extra');
            
            const files = await fs.readdir(conversationPath).catch(() => []);
            
            if (files.length === 0) {
                console.log(chalk.yellow('⚠️  No real conversation data found, using test data'));
                return await this.testWithSampleData();
            }
            
            // Load a recent conversation
            const recentFile = files.sort().reverse()[0];
            const conversationData = await fs.readJson(`${conversationPath}/${recentFile}`);
            
            console.log(chalk.blue(`📱 Testing with conversation: ${recentFile}`));
            
            // Extract messages from conversation
            const messages = conversationData.messages?.slice(0, 3) || []; // Test with first 3 messages
            
            if (messages.length === 0) {
                console.log(chalk.yellow('⚠️  No messages in conversation file'));
                return await this.testWithSampleData();
            }
            
            const testMessages = messages.map((msg, i) => ({
                id: `real_${i}`,
                text: msg.body || msg.text || '',
                type: 'sms'
            })).filter(m => m.text.length > 10);
            
            if (testMessages.length === 0) {
                return await this.testWithSampleData();
            }
            
            const results = await this.extractBatch(testMessages);
            
            console.log(chalk.green(`✅ Real data test complete: ${results.filter(r => r.success).length}/${results.length} successful`));
            
            return results;
            
        } catch (error) {
            console.warn(chalk.yellow(`⚠️  Could not load real data: ${error.message}`));
            return await this.testWithSampleData();
        }
    }

    async testWithSampleData() {
        console.log(chalk.blue('🧪 Testing with sample construction communications...'));
        
        const testMessages = [
            {
                id: 'sample_1',
                text: 'Hey Mike, permits came through! Can we start foundation Monday? Weather looks good.',
                type: 'sms'
            },
            {
                id: 'sample_2', 
                text: 'Kitchen renovation update: $8K over budget on cabinets. Sarah needs to review electrical before we proceed. Meeting Friday 2pm?',
                type: 'sms'
            }
        ];
        
        const results = await this.extractBatch(testMessages, { forceHighAccuracy: true });
        
        console.log(chalk.green(`✅ Sample data test complete: ${results.filter(r => r.success).length}/${results.length} successful`));
        
        return results;
    }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
    const extractor = new ProductionExtractor();
    
    if (process.argv.includes('--test-real')) {
        extractor.testWithRealData().catch(console.error);
    } else if (process.argv.includes('--test')) {
        extractor.testWithSampleData().catch(console.error);
    } else {
        console.log(chalk.blue('Production Entity Extractor'));
        console.log(chalk.cyan('Usage: node production-extractor.js --test [--test-real]'));
    }
}

export default ProductionExtractor;
