#!/usr/bin/env node

import { LLMClient } from '../src/utils/llm-client.js';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';

/**
 * API Usage Analyzer
 * 
 * Analyzes current configuration and request patterns to determine
 * where Claude calls are being made from and reconcile billing.
 */
class APIUsageAnalyzer {
    constructor() {
        this.client = new LLMClient();
    }

    async analyzeConfiguration() {
        console.log(chalk.blue.bold('🔍 API Configuration Analysis\n'));
        
        // Check environment variables
        console.log(chalk.cyan('📋 Environment Configuration:'));
        console.log(chalk.white(`  OPENAI_API_KEY: ${this.maskKey(process.env.OPENAI_API_KEY)}`));
        console.log(chalk.white(`  OPENROUTER_API_KEY: ${this.maskKey(process.env.OPENROUTER_API_KEY)}`));
        console.log(chalk.white(`  ANTHROPIC_API_KEY: ${this.maskKey(process.env.ANTHROPIC_API_KEY)}`));
        
        // Check model configurations
        console.log(chalk.cyan('\n🤖 Model Configuration:'));
        console.log(chalk.white(`  ENTITY_EXTRACTION_MODEL_CLOUD: ${process.env.ENTITY_EXTRACTION_MODEL_CLOUD || 'not set'}`));
        console.log(chalk.white(`  CONTEXT_GENERATION_MODEL: ${process.env.CONTEXT_GENERATION_MODEL || 'not set'}`));
        console.log(chalk.white(`  EVALUATION_MODEL: ${process.env.EVALUATION_MODEL || 'not set'}`));
        
        // Test connectivity
        console.log(chalk.cyan('\n🔌 Provider Connectivity:'));
        await this.client.testConnectivity();
    }

    async analyzeModelRouting() {
        console.log(chalk.blue.bold('\n🎯 Model Routing Analysis\n'));
        
        // Check how Claude models are routed
        const claudeModels = [
            'claude-3-5-sonnet-20241022',
            'anthropic/claude-3.5-sonnet',
            'claude-3.5-sonnet'
        ];
        
        for (const model of claudeModels) {
            console.log(chalk.cyan(`Testing routing for: ${model}`));
            
            // Determine which provider would be used
            if (model.startsWith('anthropic/')) {
                console.log(chalk.white(`  → Would route to: OpenRouter`));
                console.log(chalk.white(`  → Billing: OpenRouter (not Anthropic direct)`));
            } else if (model.includes('claude')) {
                console.log(chalk.white(`  → Would route to: Anthropic Direct`));
                console.log(chalk.white(`  → Billing: Anthropic Console`));
            }
        }
    }

    async analyzeRequestHistory() {
        console.log(chalk.blue.bold('\n📊 Request History Analysis\n'));
        
        // Check if request log exists
        const logPath = path.join(process.cwd(), 'logs', 'api-requests.json');
        
        if (await fs.pathExists(logPath)) {
            const requests = await fs.readJson(logPath);
            console.log(chalk.green(`✅ Found ${requests.length} logged requests`));
            
            // Analyze Claude requests
            const claudeRequests = requests.filter(req => 
                req.model.includes('claude') || req.model.includes('anthropic')
            );
            
            if (claudeRequests.length > 0) {
                console.log(chalk.cyan(`\n🤖 Claude Request Breakdown:`));
                console.log(chalk.white(`  Total Claude requests: ${claudeRequests.length}`));
                
                const byProvider = claudeRequests.reduce((acc, req) => {
                    acc[req.provider] = (acc[req.provider] || 0) + 1;
                    return acc;
                }, {});
                
                Object.entries(byProvider).forEach(([provider, count]) => {
                    console.log(chalk.white(`  ${provider}: ${count} requests`));
                });
                
                // Show recent requests
                console.log(chalk.blue.bold('📋 Detailed Request Log (Last 20 requests)'));
                console.log('═'.repeat(120));
                console.log(chalk.gray('DateTime        | Provider/Model                    | Tokens  | Cost    | Location'));
                console.log('─'.repeat(120));

                // Show last 20 requests in compact format
                const recentRequests = requests.slice(-20);
                recentRequests.forEach(req => {
                    const date = new Date(req.timestamp);
                    const dateStr = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
                    const modelInfo = `${req.provider}/${req.model}`.padEnd(32);
                    const tokens = (req.usage?.totalTokens || 0).toString().padStart(6);
                    const cost = `$${(req.cost || 0).toFixed(4)}`.padStart(7);
                    const location = req.location ? `${req.location.file}:${req.location.function}` : 'unknown';
                    
                    console.log(`${dateStr} | ${modelInfo} | ${tokens} | ${cost} | ${location}`);
                });
                
                console.log('═'.repeat(120));
            } else {
                console.log(chalk.yellow('⚠️  No Claude requests found in log'));
            }
        } else {
            console.log(chalk.yellow('⚠️  No request log found - requests not being tracked yet'));
        }
    }

    async reconcileBilling() {
        console.log(chalk.blue.bold('\n💰 Billing Reconciliation\n'));
        
        const breakdown = this.client.getClaudeRequestBreakdown();
        
        console.log(chalk.cyan('Expected billing locations:'));
        console.log(chalk.white(`  OpenRouter Dashboard: ${breakdown.openrouter_claude} Claude requests`));
        console.log(chalk.white(`  Anthropic Console: ${breakdown.anthropic_direct} Claude requests`));
        
        if (breakdown.openrouter_claude > 0) {
            console.log(chalk.yellow('\n⚠️  OpenRouter Claude requests will be billed by OpenRouter, not Anthropic'));
            console.log(chalk.white('   These appear in OpenRouter activity, charges go to OpenRouter billing'));
        }
        
        if (breakdown.anthropic_direct > 0) {
            console.log(chalk.green('\n✅ Direct Anthropic requests will be billed by Anthropic'));
            console.log(chalk.white('   These appear in Anthropic Console, charges go to Anthropic billing'));
        }
        
        // Recommendations
        console.log(chalk.blue.bold('\n💡 Recommendations:'));
        
        if (breakdown.openrouter_claude > breakdown.anthropic_direct) {
            console.log(chalk.white('• Most Claude requests are going through OpenRouter'));
            console.log(chalk.white('• To use your Anthropic key directly, update model configurations'));
            console.log(chalk.white('• Change "anthropic/claude-3.5-sonnet" to "claude-3-5-sonnet-20241022"'));
        } else if (breakdown.anthropic_direct > breakdown.openrouter_claude) {
            console.log(chalk.white('• Most Claude requests are going direct to Anthropic ✅'));
            console.log(chalk.white('• Your Anthropic API key is being used correctly'));
        } else {
            console.log(chalk.white('• Requests are split between providers'));
            console.log(chalk.white('• Check model configurations for consistency'));
        }
    }

    maskKey(key) {
        if (!key || key.includes('your_')) {
            return chalk.red('Not configured');
        }
        return chalk.green(`${key.substring(0, 8)}...${key.substring(key.length - 4)}`);
    }

    async runFullAnalysis() {
        try {
            await this.analyzeConfiguration();
            await this.analyzeModelRouting();
            await this.analyzeRequestHistory();
            await this.reconcileBilling();
            
            // Show current request summary
            console.log(chalk.blue.bold('\n📈 Current Session Summary:'));
            this.client.printRequestSummary('24h');
            this.client.printClaudeBreakdown();
            
            // Show local savings analysis
            this.client.printLocalSavingsAnalysis();
            
            // Show detailed request log
            this.client.printDetailedRequestLog(20);
            
        } catch (error) {
            console.error(chalk.red('❌ Analysis failed:'), error.message);
            throw error;
        }
    }
}

// Run analysis if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const analyzer = new APIUsageAnalyzer();
    analyzer.runFullAnalysis().catch(console.error);
}

export default APIUsageAnalyzer;
