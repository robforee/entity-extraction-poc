#!/usr/bin/env node

import { LLMClient } from '../src/utils/llm-client.js';
import chalk from 'chalk';

/**
 * Demo Enhanced Tracking
 * 
 * Demonstrates the new tracking capabilities that show:
 * 1. WHY each call was made (reasoning)
 * 2. WHERE in the code it came from (call stack)
 * 3. WHETHER it could have used local model (cost savings)
 */
async function demoEnhancedTracking() {
    console.log(chalk.blue.bold('🔍 Enhanced API Tracking Demo\n'));
    
    const client = new LLMClient();
    
    // Simulate different types of calls with reasoning
    const scenarios = [
        {
            name: 'High Accuracy Entity Extraction',
            provider: 'openrouter',
            model: 'anthropic/claude-3.5-sonnet',
            prompt: 'Extract entities from: "Meet with John at 3pm about the construction project budget."',
            options: {
                source: 'entity-extractor',
                operation: 'entity_extraction',
                reasoning: 'High accuracy required for entity extraction',
                could_use_local: false, // Complex entity extraction needs cloud model
                maxTokens: 200
            }
        },
        {
            name: 'Simple Text Classification',
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
            prompt: 'Classify this message as urgent/normal/low: "Can you send me the report?"',
            options: {
                source: 'message-classifier',
                operation: 'classification',
                reasoning: 'Simple classification - could use local model',
                could_use_local: true, // Simple task, local model would work
                maxTokens: 50
            }
        },
        {
            name: 'Context Generation',
            provider: 'openrouter',
            model: 'anthropic/claude-3.5-sonnet',
            prompt: 'Generate context summary for conversation about project timeline.',
            options: {
                source: 'context-generator',
                operation: 'context_generation',
                reasoning: 'Context generation requires nuanced understanding',
                could_use_local: false, // Complex reasoning needed
                maxTokens: 300
            }
        }
    ];
    
    for (const scenario of scenarios) {
        console.log(chalk.cyan(`\n🎯 Testing: ${scenario.name}`));
        console.log(chalk.white(`   Provider: ${scenario.provider}`));
        console.log(chalk.white(`   Model: ${scenario.model}`));
        console.log(chalk.white(`   Reasoning: ${scenario.options.reasoning}`));
        console.log(chalk.white(`   Could use local: ${scenario.options.could_use_local ? 'Yes' : 'No'}`));
        
        try {
            const result = await client.generateCompletion(scenario.prompt, scenario.options);
            console.log(chalk.green(`   ✅ Success - $${result.cost_estimate.toFixed(4)}`));
            
            if (scenario.options.could_use_local) {
                console.log(chalk.yellow(`   💡 Could save $${result.cost_estimate.toFixed(4)} with local model`));
            }
            
        } catch (error) {
            console.log(chalk.red(`   ❌ Failed: ${error.message}`));
        }
    }
    
    // Show the enhanced analysis
    console.log(chalk.blue.bold('\n📊 Enhanced Tracking Results:'));
    
    // Show local savings analysis
    client.printLocalSavingsAnalysis();
    
    // Show detailed request log with call stack info
    client.printDetailedRequestLog();
    
    console.log(chalk.green.bold('\n✨ Now you can see:'));
    console.log(chalk.white('• WHY each API call was made (reasoning)'));
    console.log(chalk.white('• WHERE in your code it came from (file:function:line)'));
    console.log(chalk.white('• WHICH calls could use local models (cost savings)'));
    console.log(chalk.white('• HOW much you could save by using local models'));
}

// Run demo if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    demoEnhancedTracking().catch(console.error);
}

export default demoEnhancedTracking;
