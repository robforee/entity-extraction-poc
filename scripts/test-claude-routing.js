#!/usr/bin/env node

import { LLMClient } from '../src/utils/llm-client.js';
import chalk from 'chalk';

/**
 * Test Claude Routing
 * 
 * Makes test calls to different Claude configurations to see
 * which provider is actually used and where billing occurs.
 */
async function testClaudeRouting() {
    console.log(chalk.blue.bold('🧪 Testing Claude Routing\n'));
    
    const client = new LLMClient();
    const testPrompt = "Say 'Hello from Claude' and identify which provider you're running on.";
    
    const testConfigs = [
        {
            name: 'OpenRouter Claude',
            provider: 'openrouter',
            model: 'anthropic/claude-3.5-sonnet'
        },
        {
            name: 'Direct Anthropic Claude',
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022'
        }
    ];
    
    for (const config of testConfigs) {
        console.log(chalk.cyan(`Testing: ${config.name}`));
        console.log(chalk.white(`  Provider: ${config.provider}`));
        console.log(chalk.white(`  Model: ${config.model}`));
        
        try {
            const result = await client.generateCompletion(testPrompt, {
                provider: config.provider,
                model: config.model,
                maxTokens: 100,
                source: 'claude-routing-test',
                operation: 'routing-test'
            });
            
            console.log(chalk.green(`  ✅ Success`));
            console.log(chalk.white(`  Response: ${result.content.substring(0, 100)}...`));
            console.log(chalk.white(`  Tokens: ${result.usage.total_tokens}`));
            console.log(chalk.white(`  Cost: $${result.cost_estimate.toFixed(4)}`));
            console.log(chalk.white(`  Duration: ${result.duration}ms`));
            
        } catch (error) {
            console.log(chalk.red(`  ❌ Failed: ${error.message}`));
        }
        
        console.log(''); // Empty line
    }
    
    // Show breakdown
    console.log(chalk.blue.bold('📊 Request Summary:'));
    client.printClaudeBreakdown();
    
    console.log(chalk.blue.bold('\n💡 Billing Analysis:'));
    console.log(chalk.white('• OpenRouter requests appear in OpenRouter dashboard and are billed by OpenRouter'));
    console.log(chalk.white('• Anthropic direct requests appear in Anthropic Console and are billed by Anthropic'));
    console.log(chalk.white('• Check your actual dashboards to confirm where the 7 + 3 requests are showing up'));
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    testClaudeRouting().catch(console.error);
}

export default testClaudeRouting;
