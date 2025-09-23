#!/usr/bin/env node

import CloudLLMExtractor from '../src/extractors/cloud-llm-extractor.js';
import fs from 'fs-extra';
import chalk from 'chalk';
import ora from 'ora';

/**
 * Performance evaluation framework for entity extraction
 * 
 * Tests processing speed, cost, and throughput metrics.
 */
class PerformanceEvaluator {
    constructor() {
        this.cloudExtractor = new CloudLLMExtractor({ provider: 'openai' });
        this.testMessages = [];
    }

    async loadTestMessages() {
        // Create test messages of varying lengths
        this.testMessages = [
            {
                id: 'short_1',
                text: 'Hey Mike, permits approved. Start Monday?',
                type: 'sms'
            },
            {
                id: 'medium_1', 
                text: 'The foundation work is scheduled to start next Monday. Mike will coordinate with the concrete supplier. We need to ensure the site is properly prepared and all materials are delivered on time.',
                type: 'sms'
            },
            {
                id: 'long_1',
                text: `Subject: Weekly Project Update - Kitchen Renovation

Hi team,

Here's the status update for this week:

COMPLETED:
- Electrical rough-in inspection passed
- Plumbing lines installed and tested
- Drywall delivery scheduled for Friday

IN PROGRESS:
- Cabinet installation (60% complete)
- Tile work in bathroom (started Tuesday)
- HVAC ductwork modifications

UPCOMING:
- Final electrical connections (Monday)
- Appliance delivery and installation (Wednesday)
- Countertop template (Friday)

ISSUES:
- Window delivery delayed by 1 week due to supplier issue
- Need approval for change order #3 ($450 for additional outlet)
- Weather may impact exterior work next week

BUDGET STATUS:
- Current spend: $47,500 of $55,000 budget
- Projected final cost: $52,800 (under budget)
- Change orders pending: $1,200

Next meeting: Friday 2pm on-site.

Best regards,
Mike Johnson
Johnson Construction`,
                type: 'email'
            }
        ];

        console.log(chalk.blue(`📝 Loaded ${this.testMessages.length} test messages`));
        return this.testMessages;
    }

    async runPerformanceTests() {
        console.log(chalk.blue.bold('\n⚡ Running Entity Extraction Performance Tests\n'));
        
        await this.loadTestMessages();
        
        const results = {
            totalTests: 0,
            successfulTests: 0,
            totalDuration: 0,
            totalCost: 0,
            averageConfidence: 0,
            messageResults: []
        };

        for (const message of this.testMessages) {
            const spinner = ora(`Testing ${message.id}...`).start();
            
            try {
                const startTime = Date.now();
                
                const result = await this.cloudExtractor.extractEntities(message.text, {
                    communicationType: message.type
                });
                
                const duration = Date.now() - startTime;
                const cost = result.metadata.cost || 0;
                
                results.totalTests++;
                results.successfulTests++;
                results.totalDuration += duration;
                results.totalCost += cost;
                results.averageConfidence += result.metadata.confidence;
                
                const messageResult = {
                    id: message.id,
                    textLength: message.text.length,
                    duration,
                    cost,
                    confidence: result.metadata.confidence,
                    entityCount: this.countEntities(result.entities),
                    success: true
                };
                
                results.messageResults.push(messageResult);
                
                spinner.succeed(`${message.id}: ${duration}ms, $${cost.toFixed(4)}, ${messageResult.entityCount} entities`);
                
            } catch (error) {
                results.totalTests++;
                
                const messageResult = {
                    id: message.id,
                    textLength: message.text.length,
                    success: false,
                    error: error.message
                };
                
                results.messageResults.push(messageResult);
                
                spinner.fail(`${message.id}: ${error.message}`);
            }
        }

        // Calculate averages
        if (results.successfulTests > 0) {
            results.averageDuration = results.totalDuration / results.successfulTests;
            results.averageCost = results.totalCost / results.successfulTests;
            results.averageConfidence = results.averageConfidence / results.successfulTests;
        }

        this.generatePerformanceReport(results);
        return results;
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

    generatePerformanceReport(results) {
        console.log('\n' + chalk.blue.bold('⚡ Performance Test Results'));
        console.log('='.repeat(60));

        // Overall metrics
        console.log(chalk.blue('\n📊 OVERALL METRICS:'));
        console.log(`  Success Rate: ${results.successfulTests}/${results.totalTests} (${((results.successfulTests/results.totalTests)*100).toFixed(1)}%)`);
        
        if (results.successfulTests > 0) {
            console.log(`  Average Duration: ${results.averageDuration.toFixed(0)}ms`);
            console.log(`  Average Cost: $${results.averageCost.toFixed(4)}`);
            console.log(`  Average Confidence: ${(results.averageConfidence * 100).toFixed(1)}%`);
            console.log(`  Total Cost: $${results.totalCost.toFixed(4)}`);
        }

        // Per-message breakdown
        console.log(chalk.blue('\n📝 PER-MESSAGE BREAKDOWN:'));
        for (const result of results.messageResults) {
            if (result.success) {
                const throughput = (result.textLength / result.duration * 1000).toFixed(0); // chars per second
                console.log(`  ${result.id}: ${result.duration}ms, ${throughput} chars/sec, ${result.entityCount} entities`);
            } else {
                console.log(chalk.red(`  ${result.id}: FAILED - ${result.error}`));
            }
        }

        // Performance evaluation
        console.log(chalk.blue('\n🎯 PERFORMANCE EVALUATION:'));
        
        const avgDuration = results.averageDuration || 0;
        
        if (avgDuration < 5000) {
            console.log(chalk.green('✅ EXCELLENT: Processing time <5 seconds (target met)'));
        } else if (avgDuration < 10000) {
            console.log(chalk.yellow('⚠️  GOOD: Processing time <10 seconds (acceptable)'));
        } else if (avgDuration < 15000) {
            console.log(chalk.yellow('⚠️  FAIR: Processing time <15 seconds (needs optimization)'));
        } else {
            console.log(chalk.red('❌ POOR: Processing time >15 seconds (unacceptable)'));
        }

        const avgCost = results.averageCost || 0;
        
        if (avgCost < 0.05) {
            console.log(chalk.green('✅ EXCELLENT: Cost <$0.05 per message (target met)'));
        } else if (avgCost < 0.10) {
            console.log(chalk.yellow('⚠️  ACCEPTABLE: Cost <$0.10 per message'));
        } else {
            console.log(chalk.red('❌ EXPENSIVE: Cost >$0.10 per message (needs optimization)'));
        }

        // Recommendations
        console.log(chalk.blue('\n💡 RECOMMENDATIONS:'));
        
        if (avgDuration > 5000) {
            console.log(chalk.cyan('  • Consider using faster models (gpt-3.5-turbo vs gpt-4)'));
            console.log(chalk.cyan('  • Implement caching for repeated extractions'));
            console.log(chalk.cyan('  • Use batch processing for multiple messages'));
        }
        
        if (avgCost > 0.05) {
            console.log(chalk.cyan('  • Optimize prompts to reduce token usage'));
            console.log(chalk.cyan('  • Consider hybrid local/cloud approach'));
            console.log(chalk.cyan('  • Implement intelligent model selection based on complexity'));
        }

        if (results.averageConfidence < 0.8) {
            console.log(chalk.cyan('  • Improve prompt engineering for higher confidence'));
            console.log(chalk.cyan('  • Consider using more powerful models'));
        }

        // Next steps
        console.log(chalk.blue('\n📋 NEXT STEPS:'));
        console.log(chalk.cyan('  1. Run full evaluation: npm run evaluate'));
        console.log(chalk.cyan('  2. Optimize prompts based on accuracy results'));
        console.log(chalk.cyan('  3. Test with real conversation data'));
        console.log(chalk.cyan('  4. Implement DiffMem integration (Week 2)'));
    }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const evaluator = new PerformanceEvaluator();
    evaluator.runPerformanceTests().catch(error => {
        console.error(chalk.red('💥 Performance evaluation failed:'), error.message);
        process.exit(1);
    });
}

export default PerformanceEvaluator;
