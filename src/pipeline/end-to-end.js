#!/usr/bin/env node

import ProductionExtractor from '../extractors/production-extractor.js';
import MockDiffMem from '../diffmem/mock-diffmem.js';
import ContextRetriever from '../diffmem/context-retriever.js';
import chalk from 'chalk';
import ora from 'ora';
import { v4 as uuidv4 } from 'uuid';

/**
 * End-to-End Entity Extraction Pipeline
 * 
 * Complete pipeline: Message → Entity Extraction → DiffMem Storage → Context Retrieval
 * This demonstrates the full workflow from raw construction communications
 * to intelligent context generation for responses.
 */
export class EndToEndPipeline {
    constructor(options = {}) {
        this.extractor = new ProductionExtractor(options);
        this.diffmem = new MockDiffMem(options);
        this.contextRetriever = new ContextRetriever(options);
        
        this.performanceMetrics = {
            totalMessages: 0,
            successfulExtractions: 0,
            totalExtractionTime: 0,
            totalStorageTime: 0,
            totalRetrievalTime: 0,
            totalCost: 0
        };
    }

    /**
     * Process a single message through the complete pipeline
     */
    async processMessage(message, options = {}) {
        const {
            conversationId = uuidv4(),
            storeInDiffMem = true,
            generateContext = false,
            contextQuery = null
        } = options;

        console.log(chalk.blue(`🔄 Processing message through end-to-end pipeline...`));
        
        const pipelineResult = {
            messageId: message.id || uuidv4(),
            conversationId,
            success: false,
            steps: {}
        };

        const startTime = Date.now();

        try {
            // Step 1: Entity Extraction
            console.log(chalk.cyan('📝 Step 1: Entity Extraction'));
            const extractionStart = Date.now();
            
            const extractionResult = await this.extractor.extractEntities(message.text, {
                communicationType: message.type || 'sms',
                context: message.context || '',
                forceHighAccuracy: options.forceHighAccuracy
            });
            
            const extractionTime = Date.now() - extractionStart;
            pipelineResult.steps.extraction = {
                success: true,
                duration: extractionTime,
                entityCount: this.countEntities(extractionResult.entities),
                confidence: extractionResult.metadata.confidence,
                cost: extractionResult.metadata.cost || 0,
                strategy: extractionResult.metadata.strategy
            };

            // Step 2: DiffMem Storage
            let entityId = null;
            if (storeInDiffMem) {
                console.log(chalk.cyan('💾 Step 2: DiffMem Storage'));
                const storageStart = Date.now();
                
                entityId = await this.diffmem.storeEntities(
                    conversationId,
                    extractionResult.entities,
                    {
                        ...extractionResult.metadata,
                        originalMessage: message.text,
                        messageId: pipelineResult.messageId
                    }
                );
                
                const storageTime = Date.now() - storageStart;
                pipelineResult.steps.storage = {
                    success: true,
                    duration: storageTime,
                    entityId
                };
            }

            // Step 3: Context Generation (optional)
            let contextResult = null;
            if (generateContext && contextQuery) {
                console.log(chalk.cyan('🧠 Step 3: Context Retrieval'));
                const contextStart = Date.now();
                
                contextResult = await this.contextRetriever.retrieveContext(contextQuery, {
                    conversationId,
                    includeHistory: true
                });
                
                const contextTime = Date.now() - contextStart;
                pipelineResult.steps.context = {
                    success: true,
                    duration: contextTime,
                    entityCount: contextResult.entities.length,
                    confidence: contextResult.metadata.confidence,
                    contextLength: contextResult.summary.length
                };
            }

            // Final result
            const totalTime = Date.now() - startTime;
            pipelineResult.success = true;
            pipelineResult.totalDuration = totalTime;
            pipelineResult.extraction = extractionResult;
            pipelineResult.entityId = entityId;
            pipelineResult.context = contextResult;

            // Update metrics
            this.updateMetrics(pipelineResult);

            console.log(chalk.green(`✅ Pipeline completed in ${totalTime}ms`));
            
            return pipelineResult;

        } catch (error) {
            const totalTime = Date.now() - startTime;
            pipelineResult.success = false;
            pipelineResult.error = error.message;
            pipelineResult.totalDuration = totalTime;

            console.error(chalk.red(`❌ Pipeline failed: ${error.message}`));
            throw error;
        }
    }

    /**
     * Process multiple messages in a conversation
     */
    async processConversation(messages, options = {}) {
        const conversationId = options.conversationId || uuidv4();
        console.log(chalk.blue(`🗣️  Processing conversation with ${messages.length} messages...`));

        const results = [];
        const conversationStart = Date.now();

        for (let i = 0; i < messages.length; i++) {
            const message = messages[i];
            console.log(chalk.blue(`\n📨 Processing message ${i + 1}/${messages.length}`));

            try {
                const result = await this.processMessage(message, {
                    ...options,
                    conversationId,
                    // Generate context for the last message to demonstrate retrieval
                    generateContext: i === messages.length - 1,
                    contextQuery: options.contextQuery || message.text
                });

                results.push(result);

            } catch (error) {
                console.error(chalk.red(`❌ Failed to process message ${i + 1}: ${error.message}`));
                results.push({
                    messageId: message.id || `msg_${i}`,
                    success: false,
                    error: error.message
                });
            }

            // Small delay between messages
            if (i < messages.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        const conversationTime = Date.now() - conversationStart;
        const successCount = results.filter(r => r.success).length;

        console.log(chalk.green(`\n✅ Conversation processing complete:`));
        console.log(chalk.blue(`   Success rate: ${successCount}/${messages.length}`));
        console.log(chalk.blue(`   Total time: ${conversationTime}ms`));

        return {
            conversationId,
            messageCount: messages.length,
            successCount,
            totalDuration: conversationTime,
            results
        };
    }

    /**
     * Demonstrate query-based context retrieval
     */
    async demonstrateContextRetrieval(query, conversationId = null) {
        console.log(chalk.blue(`🔍 Demonstrating context retrieval for: "${query}"`));

        try {
            const context = await this.contextRetriever.retrieveContext(query, {
                conversationId,
                includeHistory: true,
                maxAge: 30,
                minConfidence: 0.5
            });

            console.log(chalk.green('✅ Context retrieval demonstration:'));
            console.log(chalk.cyan(`   Entities found: ${context.entities.length}`));
            console.log(chalk.cyan(`   Context length: ${context.summary.length} characters`));
            console.log(chalk.cyan(`   Overall confidence: ${(context.metadata.confidence * 100).toFixed(1)}%`));

            if (context.entities.length > 0) {
                console.log(chalk.blue('\n📋 Context Summary:'));
                console.log(context.summary);
            }

            return context;

        } catch (error) {
            console.error(chalk.red(`❌ Context retrieval failed: ${error.message}`));
            throw error;
        }
    }

    /**
     * Run comprehensive end-to-end test
     */
    async runComprehensiveTest() {
        console.log(chalk.blue.bold('\n🧪 Running Comprehensive End-to-End Test\n'));

        // Test messages simulating a construction project conversation
        const testMessages = [
            {
                id: 'msg_1',
                text: 'Hey Mike, the permits came through! We can start the foundation work Monday. Weather forecast looks good.',
                type: 'sms'
            },
            {
                id: 'msg_2', 
                text: 'Great news! I\'ll coordinate with the concrete supplier. We\'re looking at about 3 weeks for the foundation if everything goes smooth. Cost estimate is $25,000.',
                type: 'sms'
            },
            {
                id: 'msg_3',
                text: 'Sarah wants to review the electrical plans before we proceed with the next phase. Can we schedule a meeting Friday at 2pm on site?',
                type: 'sms'
            },
            {
                id: 'msg_4',
                text: 'Kitchen renovation update: We\'re $8,000 over budget on the custom cabinets. The supplier had some quality issues with the first batch. Need to decide on alternatives.',
                type: 'sms'
            }
        ];

        try {
            // Process the entire conversation
            const conversationResult = await this.processConversation(testMessages, {
                contextQuery: 'What is the current status of the foundation work and kitchen renovation?'
            });

            // Demonstrate additional context queries
            console.log(chalk.blue('\n🔍 Testing Additional Context Queries:'));
            
            const queries = [
                'Who are the key people involved in this project?',
                'What are the current budget issues?',
                'What meetings are scheduled?',
                'What permits and approvals do we have?'
            ];

            for (const query of queries) {
                console.log(chalk.cyan(`\nQuery: "${query}"`));
                try {
                    const context = await this.demonstrateContextRetrieval(query, conversationResult.conversationId);
                    console.log(chalk.green(`✅ Found ${context.entities.length} relevant entities`));
                } catch (error) {
                    console.log(chalk.red(`❌ Query failed: ${error.message}`));
                }
            }

            // Generate final report
            this.generateTestReport(conversationResult);

            return conversationResult;

        } catch (error) {
            console.error(chalk.red('💥 Comprehensive test failed:'), error.message);
            throw error;
        }
    }

    /**
     * Helper methods
     */

    countEntities(entities) {
        let count = 0;
        for (const entityList of Object.values(entities)) {
            if (Array.isArray(entityList)) {
                count += entityList.length;
            }
        }
        return count;
    }

    updateMetrics(result) {
        this.performanceMetrics.totalMessages++;
        
        if (result.success) {
            this.performanceMetrics.successfulExtractions++;
            
            if (result.steps.extraction) {
                this.performanceMetrics.totalExtractionTime += result.steps.extraction.duration;
                this.performanceMetrics.totalCost += result.steps.extraction.cost || 0;
            }
            
            if (result.steps.storage) {
                this.performanceMetrics.totalStorageTime += result.steps.storage.duration;
            }
            
            if (result.steps.context) {
                this.performanceMetrics.totalRetrievalTime += result.steps.context.duration;
            }
        }
    }

    generateTestReport(conversationResult) {
        console.log('\n' + chalk.blue.bold('📊 End-to-End Test Report'));
        console.log('='.repeat(60));

        // Conversation metrics
        console.log(chalk.blue('\n🗣️  CONVERSATION METRICS:'));
        console.log(`  Messages processed: ${conversationResult.messageCount}`);
        console.log(`  Success rate: ${conversationResult.successCount}/${conversationResult.messageCount} (${((conversationResult.successCount/conversationResult.messageCount)*100).toFixed(1)}%)`);
        console.log(`  Total time: ${conversationResult.totalDuration}ms`);
        console.log(`  Average time per message: ${Math.round(conversationResult.totalDuration/conversationResult.messageCount)}ms`);

        // Pipeline metrics
        console.log(chalk.blue('\n⚡ PIPELINE PERFORMANCE:'));
        const avgExtraction = this.performanceMetrics.totalExtractionTime / this.performanceMetrics.successfulExtractions;
        const avgStorage = this.performanceMetrics.totalStorageTime / this.performanceMetrics.successfulExtractions;
        
        console.log(`  Average extraction time: ${Math.round(avgExtraction)}ms`);
        console.log(`  Average storage time: ${Math.round(avgStorage)}ms`);
        console.log(`  Total cost: $${this.performanceMetrics.totalCost.toFixed(4)}`);
        console.log(`  Average cost per message: $${(this.performanceMetrics.totalCost/this.performanceMetrics.totalMessages).toFixed(4)}`);

        // Success criteria evaluation
        console.log(chalk.blue('\n🎯 SUCCESS CRITERIA EVALUATION:'));
        
        const avgTotalTime = conversationResult.totalDuration / conversationResult.messageCount;
        if (avgTotalTime < 10000) {
            console.log(chalk.green('✅ Processing time <10s per message (target met)'));
        } else {
            console.log(chalk.red('❌ Processing time >10s per message (needs optimization)'));
        }

        const avgCost = this.performanceMetrics.totalCost / this.performanceMetrics.totalMessages;
        if (avgCost < 0.08) {
            console.log(chalk.green('✅ Cost <$0.08 per message (target met)'));
        } else {
            console.log(chalk.red('❌ Cost >$0.08 per message (needs optimization)'));
        }

        const successRate = (conversationResult.successCount / conversationResult.messageCount) * 100;
        if (successRate >= 80) {
            console.log(chalk.green('✅ End-to-end success rate >80% (target met)'));
        } else {
            console.log(chalk.red('❌ End-to-end success rate <80% (needs improvement)'));
        }

        // Recommendations
        console.log(chalk.blue('\n💡 RECOMMENDATIONS:'));
        if (avgTotalTime > 10000) {
            console.log(chalk.cyan('  • Optimize extraction model selection for faster processing'));
        }
        if (avgCost > 0.08) {
            console.log(chalk.cyan('  • Implement more aggressive cost optimization strategies'));
        }
        if (successRate < 80) {
            console.log(chalk.cyan('  • Improve error handling and retry mechanisms'));
        }

        console.log(chalk.green('\n🎉 End-to-end pipeline is functional and ready for Week 3 optimization!'));
    }

    /**
     * Get current performance metrics
     */
    getMetrics() {
        return {
            ...this.performanceMetrics,
            averageExtractionTime: this.performanceMetrics.successfulExtractions > 0 ? 
                this.performanceMetrics.totalExtractionTime / this.performanceMetrics.successfulExtractions : 0,
            averageStorageTime: this.performanceMetrics.successfulExtractions > 0 ? 
                this.performanceMetrics.totalStorageTime / this.performanceMetrics.successfulExtractions : 0,
            averageCostPerMessage: this.performanceMetrics.totalMessages > 0 ? 
                this.performanceMetrics.totalCost / this.performanceMetrics.totalMessages : 0,
            successRate: this.performanceMetrics.totalMessages > 0 ? 
                (this.performanceMetrics.successfulExtractions / this.performanceMetrics.totalMessages) * 100 : 0
        };
    }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
    const pipeline = new EndToEndPipeline();
    
    if (process.argv.includes('--test')) {
        pipeline.runComprehensiveTest().catch(error => {
            console.error(chalk.red('💥 Test failed:'), error.message);
            process.exit(1);
        });
    } else {
        console.log(chalk.blue('End-to-End Entity Extraction Pipeline'));
        console.log(chalk.cyan('Usage: node end-to-end.js --test'));
    }
}

export default EndToEndPipeline;
