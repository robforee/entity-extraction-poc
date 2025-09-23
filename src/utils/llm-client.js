import OpenAI from 'openai';
import axios from 'axios';
import dotenv from 'dotenv';
import chalk from 'chalk';
import { RequestTracker } from './request-tracker.js';

dotenv.config();

/**
 * Unified LLM client that supports multiple providers:
 * - OpenAI API
 * - OpenRouter API (for various models)
 * - Anthropic Claude API
 * - Ollama (local LLM)
 */
export class LLMClient {
    constructor() {
        this.providers = {
            openai: this.initOpenAI(),
            openrouter: this.initOpenRouter(),
            anthropic: this.initAnthropic(),
            ollama: this.initOllama()
        };
        
        this.costTracking = {
            totalCost: 0,
            requestCount: 0,
            dailyCost: 0,
            lastResetDate: new Date().toDateString()
        };

        this.requestTracker = new RequestTracker();
    }

    initOpenAI() {
        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('your_')) {
            console.log(chalk.yellow('⚠️  OpenAI API key not configured'));
            return null;
        }
        
        return new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
        });
    }

    initOpenRouter() {
        if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY.includes('your_')) {
            console.log(chalk.yellow('⚠️  OpenRouter API key not configured'));
            return null;
        }
        
        return new OpenAI({
            apiKey: process.env.OPENROUTER_API_KEY,
            baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'
        });
    }

    initAnthropic() {
        if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('your_')) {
            console.log(chalk.yellow('⚠️  Anthropic API key not configured'));
            return null;
        }
        
        // Anthropic uses a different client, we'll use axios for now
        return {
            apiKey: process.env.ANTHROPIC_API_KEY,
            baseURL: 'https://api.anthropic.com/v1'
        };
    }

    initOllama() {
        return {
            baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
            model: process.env.OLLAMA_MODEL || 'llama3.1:8b'
        };
    }

    /**
     * Generate completion using specified provider and model
     */
    async generateCompletion(prompt, options = {}) {
        const {
            provider = 'openai',
            model = 'gpt-4',
            maxTokens = 2000,
            temperature = 0.1,
            systemPrompt = null
        } = options;

        const startTime = Date.now();
        
        try {
            let result;
            
            switch (provider) {
                case 'openai':
                    result = await this.callOpenAI(prompt, { model, maxTokens, temperature, systemPrompt });
                    break;
                case 'openrouter':
                    result = await this.callOpenRouter(prompt, { model, maxTokens, temperature, systemPrompt });
                    break;
                case 'anthropic':
                    result = await this.callAnthropic(prompt, { model, maxTokens, temperature, systemPrompt });
                    break;
                case 'ollama':
                    result = await this.callOllama(prompt, { model, maxTokens, temperature, systemPrompt });
                    break;
                default:
                    throw new Error(`Unknown provider: ${provider}`);
            }

            const duration = Date.now() - startTime;
            const costEstimate = this.estimateCost(provider, model, result.usage);
            
            // Track usage in both systems
            this.trackUsage(provider, model, result.usage, duration);
            await this.requestTracker.trackRequest(provider, model, result.usage, {
                source: options.source || 'llm-client',
                operation: options.operation || 'completion',
                duration,
                cost_estimate: costEstimate,
                reasoning: options.reasoning || `${provider} selected for ${model}`,
                could_use_local: options.could_use_local || false,
                local_savings: options.could_use_local ? costEstimate : 0,
                prompt: prompt,
                response: result.content,
                completion_id: result.id || result.completion_id || null
            });
            
            return {
                content: result.content,
                usage: result.usage,
                duration,
                provider,
                model,
                cost_estimate: costEstimate
            };
            
        } catch (error) {
            console.error(chalk.red(`❌ Error with ${provider}:${model} - ${error.message}`));
            throw error;
        }
    }

    async callOpenAI(prompt, options) {
        if (!this.providers.openai) {
            throw new Error('OpenAI client not initialized - check API key');
        }

        const messages = [];
        if (options.systemPrompt) {
            messages.push({ role: 'system', content: options.systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        const response = await this.providers.openai.chat.completions.create({
            model: options.model,
            messages,
            max_tokens: options.maxTokens,
            temperature: options.temperature
        });

        return {
            content: response.choices[0].message.content,
            usage: response.usage
        };
    }

    async callOpenRouter(prompt, options) {
        if (!this.providers.openrouter) {
            throw new Error('OpenRouter client not initialized - check API key');
        }

        const messages = [];
        if (options.systemPrompt) {
            messages.push({ role: 'system', content: options.systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        const response = await this.providers.openrouter.chat.completions.create({
            model: options.model,
            messages,
            max_tokens: options.maxTokens,
            temperature: options.temperature
        });

        return {
            content: response.choices[0].message.content,
            usage: response.usage
        };
    }

    async callAnthropic(prompt, options) {
        if (!this.providers.anthropic) {
            throw new Error('Anthropic client not initialized - check API key');
        }

        const messages = [{ role: 'user', content: prompt }];
        
        const requestData = {
            model: options.model || 'claude-3-5-sonnet-20241022',
            max_tokens: options.maxTokens,
            temperature: options.temperature,
            messages
        };

        if (options.systemPrompt) {
            requestData.system = options.systemPrompt;
        }

        const response = await axios.post(
            `${this.providers.anthropic.baseURL}/messages`,
            requestData,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.providers.anthropic.apiKey,
                    'anthropic-version': '2023-06-01'
                }
            }
        );

        return {
            content: response.data.content[0].text,
            usage: {
                prompt_tokens: response.data.usage.input_tokens,
                completion_tokens: response.data.usage.output_tokens,
                total_tokens: response.data.usage.input_tokens + response.data.usage.output_tokens
            }
        };
    }

    async callOllama(prompt, options) {
        const ollamaConfig = this.providers.ollama;
        
        const requestData = {
            model: options.model || ollamaConfig.model,
            prompt: options.systemPrompt ? `${options.systemPrompt}\n\n${prompt}` : prompt,
            stream: false,
            options: {
                temperature: options.temperature,
                num_predict: options.maxTokens
            }
        };

        try {
            const response = await axios.post(
                `${ollamaConfig.baseURL}/api/generate`,
                requestData,
                { timeout: 60000 } // 60 second timeout for local LLM
            );

            return {
                content: response.data.response,
                usage: {
                    prompt_tokens: 0, // Ollama doesn't provide token counts
                    completion_tokens: 0,
                    total_tokens: 0
                }
            };
        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                throw new Error('Ollama server not running. Start with: docker run -d -p 11434:11434 ollama/ollama');
            }
            throw error;
        }
    }

    estimateCost(provider, model, usage) {
        let estimatedCost = 0;
        
        if (provider === 'openai' && usage.total_tokens) {
            if (model.includes('gpt-4')) {
                estimatedCost = (usage.prompt_tokens * 0.03 + usage.completion_tokens * 0.06) / 1000;
            } else if (model.includes('gpt-3.5')) {
                estimatedCost = (usage.prompt_tokens * 0.001 + usage.completion_tokens * 0.002) / 1000;
            }
        } else if ((provider === 'anthropic' || provider === 'openrouter') && usage.total_tokens) {
            // Claude pricing (both direct and via OpenRouter)
            if (model.includes('claude-3.5') || model.includes('claude-3-5')) {
                estimatedCost = (usage.prompt_tokens * 0.003 + usage.completion_tokens * 0.015) / 1000;
            } else if (model.includes('claude')) {
                estimatedCost = (usage.prompt_tokens * 0.008 + usage.completion_tokens * 0.024) / 1000;
            }
        }
        // Ollama is free (local)
        
        return estimatedCost;
    }

    trackUsage(provider, model, usage, duration) {
        this.costTracking.requestCount++;
        
        // Reset daily cost if new day
        const today = new Date().toDateString();
        if (today !== this.costTracking.lastResetDate) {
            this.costTracking.dailyCost = 0;
            this.costTracking.lastResetDate = today;
        }

        const estimatedCost = this.estimateCost(provider, model, usage);
        this.costTracking.totalCost += estimatedCost;
        this.costTracking.dailyCost += estimatedCost;

        if (process.env.PERFORMANCE_LOGGING_ENABLED === 'true') {
            console.log(chalk.blue(`📊 ${provider}:${model} - ${duration}ms, $${estimatedCost.toFixed(4)}`));
        }

        // Check cost limits
        if (this.costTracking.dailyCost > parseFloat(process.env.DAILY_COST_LIMIT || 10)) {
            console.warn(chalk.red('⚠️  Daily cost limit exceeded!'));
        }
    }

    /**
     * Test connectivity to all configured providers
     */
    async testConnectivity() {
        console.log(chalk.blue('🔍 Testing LLM provider connectivity...\n'));
        
        const testPrompt = "Say 'Hello from' followed by your model name.";
        const results = {};

        // Test OpenAI
        if (this.providers.openai) {
            try {
                const result = await this.generateCompletion(testPrompt, {
                    provider: 'openai',
                    model: 'gpt-3.5-turbo',
                    maxTokens: 50
                });
                results.openai = { success: true, response: result.content.trim() };
                console.log(chalk.green('✅ OpenAI: Connected'));
            } catch (error) {
                results.openai = { success: false, error: error.message };
                console.log(chalk.red('❌ OpenAI: Failed -'), error.message);
            }
        } else {
            results.openai = { success: false, error: 'API key not configured' };
            console.log(chalk.yellow('⚠️  OpenAI: Not configured'));
        }

        // Test OpenRouter
        if (this.providers.openrouter) {
            try {
                const result = await this.generateCompletion(testPrompt, {
                    provider: 'openrouter',
                    model: 'anthropic/claude-3.5-sonnet',
                    maxTokens: 50
                });
                results.openrouter = { success: true, response: result.content.trim() };
                console.log(chalk.green('✅ OpenRouter: Connected'));
            } catch (error) {
                results.openrouter = { success: false, error: error.message };
                console.log(chalk.red('❌ OpenRouter: Failed -'), error.message);
            }
        } else {
            results.openrouter = { success: false, error: 'API key not configured' };
            console.log(chalk.yellow('⚠️  OpenRouter: Not configured'));
        }

        // Test Anthropic
        if (this.providers.anthropic) {
            try {
                const result = await this.generateCompletion(testPrompt, {
                    provider: 'anthropic',
                    model: 'claude-3-5-sonnet-20241022',
                    maxTokens: 50
                });
                results.anthropic = { success: true, response: result.content.trim() };
                console.log(chalk.green('✅ Anthropic: Connected'));
            } catch (error) {
                results.anthropic = { success: false, error: error.message };
                console.log(chalk.red('❌ Anthropic: Failed -'), error.message);
            }
        } else {
            results.anthropic = { success: false, error: 'API key not configured' };
            console.log(chalk.yellow('⚠️  Anthropic: Not configured'));
        }

        // Test Ollama
        try {
            const result = await this.generateCompletion(testPrompt, {
                provider: 'ollama',
                model: this.providers.ollama.model,
                maxTokens: 50
            });
            results.ollama = { success: true, response: result.content.trim() };
            console.log(chalk.green('✅ Ollama: Connected'));
        } catch (error) {
            results.ollama = { success: false, error: error.message };
            console.log(chalk.red('❌ Ollama: Failed -'), error.message);
        }

        console.log('\n' + chalk.blue('📊 Connectivity Test Summary:'));
        const successCount = Object.values(results).filter(r => r.success).length;
        console.log(chalk.blue(`${successCount}/4 providers available`));
        
        return results;
    }

    getCostSummary() {
        return {
            totalCost: this.costTracking.totalCost,
            dailyCost: this.costTracking.dailyCost,
            requestCount: this.costTracking.requestCount,
            averageCostPerRequest: this.costTracking.totalCost / Math.max(this.costTracking.requestCount, 1)
        };
    }

    // Request tracking methods
    getRequestSummary(timeframe = '24h') {
        return this.requestTracker.getRequestSummary(timeframe);
    }

    printRequestSummary(timeframe = '24h') {
        this.requestTracker.printSummary(timeframe);
    }

    getClaudeRequestBreakdown() {
        return this.requestTracker.getClaudeRequestBreakdown();
    }

    printClaudeBreakdown() {
        this.requestTracker.printClaudeBreakdown();
    }

    async exportRequests(format = 'json') {
        return await this.requestTracker.exportRequests(format);
    }

    async clearRequestLog() {
        await this.requestTracker.clearRequests();
    }

    printLocalSavingsAnalysis() {
        this.requestTracker.printLocalSavingsAnalysis();
    }

    printDetailedRequestLog(limit = 10) {
        this.requestTracker.printDetailedRequestLog(limit);
    }
}

export default LLMClient;
