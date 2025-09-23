#!/usr/bin/env node

import CloudLLMExtractor from '../src/extractors/cloud-llm-extractor.js';
import fs from 'fs-extra';
import chalk from 'chalk';
import ora from 'ora';

/**
 * Compare different LLM models for entity extraction accuracy
 */
class ModelComparison {
    constructor() {
        this.models = [
            { provider: 'openai', model: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
            { provider: 'openai', model: 'gpt-4', name: 'GPT-4' },
            { provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 (OpenRouter)' },
            { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 (Direct)' }
        ];
        
        this.testMessage = `Hey Mike, when can we start the foundation work? The permits came through yesterday. 
        
Also, we're about $8,000 over budget on the kitchen cabinets. Sarah wants to review the electrical plans before we proceed. Can we meet Friday at 2pm on site?
        
The concrete supplier said they can deliver Monday if the weather holds. Let me know if that timeline works for you.`;
    }

    async compareModels() {
        console.log(chalk.blue.bold('\n🔬 Model Comparison for Entity Extraction\n'));
        
        const results = [];
        
        for (const modelConfig of this.models) {
            const spinner = ora(`Testing ${modelConfig.name}...`).start();
            
            try {
                const extractor = new CloudLLMExtractor({
                    provider: modelConfig.provider,
                    model: modelConfig.model
                });
                
                const startTime = Date.now();
                const result = await extractor.extractEntities(this.testMessage, {
                    communicationType: 'sms'
                });
                const duration = Date.now() - startTime;
                
                const modelResult = {
                    name: modelConfig.name,
                    provider: modelConfig.provider,
                    model: modelConfig.model,
                    success: true,
                    duration,
                    cost: result.metadata.cost || 0,
                    confidence: result.metadata.confidence,
                    entityCount: this.countEntities(result.entities),
                    entities: result.entities,
                    summary: result.summary
                };
                
                results.push(modelResult);
                
                spinner.succeed(`${modelConfig.name}: ${duration}ms, ${modelResult.entityCount} entities, ${(modelResult.confidence * 100).toFixed(1)}% confidence`);
                
            } catch (error) {
                results.push({
                    name: modelConfig.name,
                    provider: modelConfig.provider,
                    model: modelConfig.model,
                    success: false,
                    error: error.message
                });
                
                spinner.fail(`${modelConfig.name}: ${error.message}`);
            }
        }
        
        this.generateComparisonReport(results);
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

    generateComparisonReport(results) {
        console.log('\n' + chalk.blue.bold('📊 Model Comparison Results'));
        console.log('='.repeat(80));

        // Summary table
        console.log(chalk.blue('\n📋 SUMMARY TABLE:'));
        console.log('Model'.padEnd(25) + 'Duration'.padEnd(12) + 'Cost'.padEnd(10) + 'Entities'.padEnd(10) + 'Confidence');
        console.log('-'.repeat(80));
        
        const successfulResults = results.filter(r => r.success);
        
        for (const result of results) {
            if (result.success) {
                const duration = `${result.duration}ms`.padEnd(12);
                const cost = `$${result.cost.toFixed(4)}`.padEnd(10);
                const entities = `${result.entityCount}`.padEnd(10);
                const confidence = `${(result.confidence * 100).toFixed(1)}%`;
                
                console.log(`${result.name.padEnd(25)}${duration}${cost}${entities}${confidence}`);
            } else {
                console.log(chalk.red(`${result.name.padEnd(25)}FAILED: ${result.error}`));
            }
        }

        // Detailed entity breakdown
        console.log(chalk.blue('\n🔍 DETAILED ENTITY BREAKDOWN:'));
        
        for (const result of successfulResults) {
            console.log(chalk.cyan(`\n${result.name}:`));
            
            for (const [entityType, entityList] of Object.entries(result.entities)) {
                if (entityList.length > 0) {
                    console.log(`  ${entityType}: ${entityList.length} entities`);
                    for (const entity of entityList.slice(0, 3)) { // Show first 3
                        const name = entity.name || entity.description || entity.event || 'unnamed';
                        const confidence = entity.confidence ? ` (${(entity.confidence * 100).toFixed(0)}%)` : '';
                        console.log(`    - ${name}${confidence}`);
                    }
                    if (entityList.length > 3) {
                        console.log(`    ... and ${entityList.length - 3} more`);
                    }
                }
            }
        }

        // Recommendations
        console.log(chalk.blue('\n💡 RECOMMENDATIONS:'));
        
        if (successfulResults.length === 0) {
            console.log(chalk.red('❌ No models worked successfully'));
            return;
        }

        // Find best performing models
        const bestAccuracy = successfulResults.reduce((best, current) => 
            current.confidence > best.confidence ? current : best
        );
        
        const bestSpeed = successfulResults.reduce((best, current) => 
            current.duration < best.duration ? current : best
        );
        
        const bestCost = successfulResults.reduce((best, current) => 
            current.cost < best.cost ? current : best
        );

        console.log(chalk.green(`✅ Best Accuracy: ${bestAccuracy.name} (${(bestAccuracy.confidence * 100).toFixed(1)}%)`));
        console.log(chalk.green(`⚡ Fastest: ${bestSpeed.name} (${bestSpeed.duration}ms)`));
        console.log(chalk.green(`💰 Most Cost-Effective: ${bestCost.name} ($${bestCost.cost.toFixed(4)})`));

        // Overall recommendation
        const avgConfidence = successfulResults.reduce((sum, r) => sum + r.confidence, 0) / successfulResults.length;
        
        if (avgConfidence > 0.85) {
            console.log(chalk.green('\n🎉 EXCELLENT: Models are meeting accuracy targets'));
        } else if (avgConfidence > 0.75) {
            console.log(chalk.yellow('\n⚠️  GOOD: Models are close to accuracy targets'));
        } else {
            console.log(chalk.red('\n❌ NEEDS IMPROVEMENT: Consider prompt optimization'));
        }

        // Next steps
        console.log(chalk.blue('\n📋 NEXT STEPS:'));
        console.log(chalk.cyan(`  1. Use ${bestAccuracy.name} for production extraction`));
        console.log(chalk.cyan('  2. Run full accuracy tests: npm run test:accuracy'));
        console.log(chalk.cyan('  3. Test with real conversation data'));
        console.log(chalk.cyan('  4. Implement prompt optimization based on results'));
    }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const comparison = new ModelComparison();
    comparison.compareModels().catch(error => {
        console.error(chalk.red('💥 Model comparison failed:'), error.message);
        process.exit(1);
    });
}

export default ModelComparison;
