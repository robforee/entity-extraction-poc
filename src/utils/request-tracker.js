import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

/**
 * Request Tracker - Monitor LLM API calls across providers
 * 
 * Tracks where Claude calls are being made from and maintains
 * accurate request counts for billing reconciliation.
 */
export class RequestTracker {
    constructor() {
        this.logFile = path.join(process.cwd(), 'logs', 'api-requests.json');
        this.requests = [];
        this.loadExistingRequests();
    }

    async loadExistingRequests() {
        try {
            if (await fs.pathExists(this.logFile)) {
                this.requests = await fs.readJson(this.logFile);
            }
        } catch (error) {
            console.warn(chalk.yellow('⚠️  Could not load existing request log'));
            this.requests = [];
        }
    }

    async trackRequest(provider, model, usage, metadata = {}) {
        // Capture call stack to understand WHY this call was made
        const stack = new Error().stack;
        const callerInfo = this.parseCallStack(stack);
        
        const request = {
            id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            provider,
            model,
            usage: {
                prompt_tokens: usage.prompt_tokens || 0,
                completion_tokens: usage.completion_tokens || 0,
                total_tokens: usage.total_tokens || 0
            },
            // Store actual messages if provided
            prompt: metadata.prompt ? this.truncateText(metadata.prompt, 500) : null,
            response: metadata.response ? this.truncateText(metadata.response, 500) : null,
            completion_id: metadata.completion_id || null,
            metadata: {
                source: metadata.source || 'unknown',
                operation: metadata.operation || 'completion',
                duration: metadata.duration || 0,
                cost_estimate: metadata.cost_estimate || 0,
                caller_file: callerInfo.file,
                caller_function: callerInfo.function,
                caller_line: callerInfo.line,
                reasoning: metadata.reasoning || 'not specified',
                could_use_local: metadata.could_use_local || false,
                local_savings: metadata.local_savings || 0,
                ...metadata
            }
        };

        this.requests.push(request);
        await this.saveRequests();
        
        // Log to console for immediate visibility
        console.log(chalk.blue(`📊 API Call: ${provider}/${model} - ${usage.total_tokens} tokens - $${(metadata.cost_estimate || 0).toFixed(4)}`));
        
        return request;
    }

    truncateText(text, maxLength = 500) {
        if (!text) return null;
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    parseCallStack(stack) {
        const lines = stack.split('\n');
        // Skip the first few lines (Error, trackRequest, generateCompletion)
        for (let i = 3; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('file://')) {
                const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):\d+\)/);
                if (match) {
                    return {
                        function: match[1] || 'anonymous',
                        file: match[2].split('/').pop() || 'unknown',
                        line: match[3] || 'unknown'
                    };
                }
            }
        }
        return { function: 'unknown', file: 'unknown', line: 'unknown' };
    }

    async saveRequests() {
        try {
            await fs.ensureDir(path.dirname(this.logFile));
            await fs.writeJson(this.logFile, this.requests, { spaces: 2 });
        } catch (error) {
            console.error(chalk.red('❌ Failed to save request log:'), error.message);
        }
    }

    getRequestSummary(timeframe = '24h') {
        const now = new Date();
        const cutoff = new Date();
        
        switch (timeframe) {
            case '1h':
                cutoff.setHours(now.getHours() - 1);
                break;
            case '24h':
                cutoff.setDate(now.getDate() - 1);
                break;
            case '7d':
                cutoff.setDate(now.getDate() - 7);
                break;
            case '30d':
                cutoff.setDate(now.getDate() - 30);
                break;
            default:
                cutoff.setDate(now.getDate() - 1);
        }

        const recentRequests = this.requests.filter(req => 
            new Date(req.timestamp) >= cutoff
        );

        const summary = {
            timeframe,
            total_requests: recentRequests.length,
            by_provider: {},
            by_model: {},
            total_tokens: 0,
            total_cost: 0
        };

        recentRequests.forEach(req => {
            // By provider
            if (!summary.by_provider[req.provider]) {
                summary.by_provider[req.provider] = {
                    requests: 0,
                    tokens: 0,
                    cost: 0
                };
            }
            summary.by_provider[req.provider].requests++;
            summary.by_provider[req.provider].tokens += req.usage.total_tokens;
            summary.by_provider[req.provider].cost += req.metadata.cost_estimate || 0;

            // By model
            if (!summary.by_model[req.model]) {
                summary.by_model[req.model] = {
                    requests: 0,
                    tokens: 0,
                    cost: 0
                };
            }
            summary.by_model[req.model].requests++;
            summary.by_model[req.model].tokens += req.usage.total_tokens;
            summary.by_model[req.model].cost += req.metadata.cost_estimate || 0;

            // Totals
            summary.total_tokens += req.usage.total_tokens;
            summary.total_cost += req.metadata.cost_estimate || 0;
        });

        return summary;
    }

    printSummary(timeframe = '24h') {
        const summary = this.getRequestSummary(timeframe);
        
        console.log(chalk.blue.bold(`\n📊 API Request Summary (${timeframe})`));
        console.log(chalk.blue('═'.repeat(50)));
        
        console.log(chalk.cyan(`Total Requests: ${summary.total_requests}`));
        console.log(chalk.cyan(`Total Tokens: ${summary.total_tokens.toLocaleString()}`));
        console.log(chalk.cyan(`Total Cost: $${summary.total_cost.toFixed(4)}`));
        
        console.log(chalk.blue('\n📡 By Provider:'));
        Object.entries(summary.by_provider).forEach(([provider, stats]) => {
            console.log(chalk.white(`  ${provider}: ${stats.requests} requests, ${stats.tokens.toLocaleString()} tokens, $${stats.cost.toFixed(4)}`));
        });
        
        console.log(chalk.blue('\n🤖 By Model:'));
        Object.entries(summary.by_model).forEach(([model, stats]) => {
            console.log(chalk.white(`  ${model}: ${stats.requests} requests, ${stats.tokens.toLocaleString()} tokens, $${stats.cost.toFixed(4)}`));
        });
        
        console.log(chalk.blue('═'.repeat(50)));
    }

    getClaudeRequestBreakdown() {
        const claudeRequests = this.requests.filter(req => 
            req.model.includes('claude') || req.model.includes('anthropic')
        );

        const breakdown = {
            total_claude_requests: claudeRequests.length,
            openrouter_claude: claudeRequests.filter(req => req.provider === 'openrouter').length,
            anthropic_direct: claudeRequests.filter(req => req.provider === 'anthropic').length,
            requests_by_source: {}
        };

        claudeRequests.forEach(req => {
            const source = req.metadata.source || 'unknown';
            if (!breakdown.requests_by_source[source]) {
                breakdown.requests_by_source[source] = {
                    openrouter: 0,
                    anthropic: 0
                };
            }
            breakdown.requests_by_source[source][req.provider]++;
        });

        return breakdown;
    }

    printClaudeBreakdown() {
        const breakdown = this.getClaudeRequestBreakdown();
        
        console.log(chalk.magenta.bold('\n🤖 Claude Request Breakdown'));
        console.log(chalk.magenta('═'.repeat(40)));
        
        console.log(chalk.cyan(`Total Claude Requests: ${breakdown.total_claude_requests}`));
        console.log(chalk.cyan(`  - Via OpenRouter: ${breakdown.openrouter_claude}`));
        console.log(chalk.cyan(`  - Direct Anthropic: ${breakdown.anthropic_direct}`));
        
        console.log(chalk.magenta('\n📍 By Source:'));
        Object.entries(breakdown.requests_by_source).forEach(([source, counts]) => {
            console.log(chalk.white(`  ${source}:`));
            console.log(chalk.white(`    OpenRouter: ${counts.openrouter}`));
            console.log(chalk.white(`    Anthropic: ${counts.anthropic}`));
        });
        
        console.log(chalk.magenta('═'.repeat(40)));
    }

    getLocalSavingsAnalysis() {
        const cloudRequests = this.requests.filter(req => 
            req.provider !== 'ollama' && req.metadata.cost_estimate > 0
        );

        const analysis = {
            total_cloud_requests: cloudRequests.length,
            total_cloud_cost: cloudRequests.reduce((sum, req) => sum + (req.metadata.cost_estimate || 0), 0),
            could_use_local_count: cloudRequests.filter(req => req.metadata.could_use_local).length,
            potential_local_savings: cloudRequests
                .filter(req => req.metadata.could_use_local)
                .reduce((sum, req) => sum + (req.metadata.cost_estimate || 0), 0),
            by_caller: {}
        };

        // Group by caller to see which parts of code are expensive
        cloudRequests.forEach(req => {
            const caller = `${req.metadata.caller_file}:${req.metadata.caller_function}`;
            if (!analysis.by_caller[caller]) {
                analysis.by_caller[caller] = {
                    requests: 0,
                    cost: 0,
                    could_use_local: 0,
                    local_savings: 0
                };
            }
            analysis.by_caller[caller].requests++;
            analysis.by_caller[caller].cost += req.metadata.cost_estimate || 0;
            if (req.metadata.could_use_local) {
                analysis.by_caller[caller].could_use_local++;
                analysis.by_caller[caller].local_savings += req.metadata.cost_estimate || 0;
            }
        });

        return analysis;
    }

    printLocalSavingsAnalysis() {
        const analysis = this.getLocalSavingsAnalysis();
        
        console.log(chalk.green.bold('\n💰 Local Model Savings Analysis'));
        console.log(chalk.green('═'.repeat(50)));
        
        console.log(chalk.cyan(`Total Cloud Requests: ${analysis.total_cloud_requests}`));
        console.log(chalk.cyan(`Total Cloud Cost: $${analysis.total_cloud_cost.toFixed(4)}`));
        console.log(chalk.cyan(`Could Use Local: ${analysis.could_use_local_count} requests`));
        console.log(chalk.cyan(`Potential Savings: $${analysis.potential_local_savings.toFixed(4)}`));
        
        if (analysis.potential_local_savings > 0) {
            const savingsPercent = (analysis.potential_local_savings / analysis.total_cloud_cost * 100).toFixed(1);
            console.log(chalk.yellow(`💡 Potential ${savingsPercent}% cost reduction with local models!`));
        }
        
        console.log(chalk.green('\n📍 Cost by Code Location:'));
        Object.entries(analysis.by_caller)
            .sort(([,a], [,b]) => b.cost - a.cost)
            .forEach(([caller, stats]) => {
                console.log(chalk.white(`  ${caller}:`));
                console.log(chalk.white(`    ${stats.requests} requests, $${stats.cost.toFixed(4)} cost`));
                if (stats.could_use_local > 0) {
                    console.log(chalk.yellow(`    💡 ${stats.could_use_local} could use local (save $${stats.local_savings.toFixed(4)})`));
                }
            });
        
        console.log(chalk.green('═'.repeat(50)));
    }

    printDetailedRequestLog(limit = 20) {
        console.log(chalk.blue.bold('\n📋 Detailed Request Log (Last 20 requests)'));
        console.log('═'.repeat(140));
        console.log(chalk.gray('DateTime        | Request ID      | Provider/Model                    | Tokens  | Cost    | Location'));
        console.log('─'.repeat(140));
        
        const recent = this.requests.slice(-limit);
        recent.forEach(req => {
            const date = new Date(req.timestamp);
            const dateStr = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
            const requestId = req.id.substring(4, 16).padEnd(15); // Show middle part of ID
            const modelInfo = `${req.provider}/${req.model}`.padEnd(32);
            const tokens = (req.usage?.total_tokens || 0).toString().padStart(6);
            const cost = `$${(req.metadata?.cost_estimate || 0).toFixed(4)}`.padStart(7);
            const location = `${req.metadata?.caller_file || 'unknown'}:${req.metadata?.caller_function || 'unknown'}`;
            
            console.log(`${dateStr} | ${requestId} | ${modelInfo} | ${tokens} | ${cost} | ${location}`);
        });
        
        console.log('═'.repeat(140));
    }

    findRequestByTime(timeStr) {
        // Find request by time string like "09/21 21:04:16"
        const today = new Date();
        const [monthDay, time] = timeStr.split(' ');
        const [month, day] = monthDay.split('/');
        const [hour, minute, second] = time.split(':');
        
        const targetTime = new Date(today.getFullYear(), month - 1, day, hour, minute, second);
        
        // Find request within 1 second of target time
        return this.requests.find(req => {
            const reqTime = new Date(req.timestamp);
            return Math.abs(reqTime - targetTime) < 1000;
        });
    }

    printRequestDetails(request) {
        if (!request) {
            console.log(chalk.red('❌ Request not found'));
            return;
        }

        console.log(chalk.blue.bold('\n🔍 Request Details'));
        console.log('═'.repeat(80));
        console.log(chalk.cyan(`Request ID: ${request.id}`));
        console.log(chalk.white(`Timestamp: ${new Date(request.timestamp).toLocaleString()}`));
        console.log(chalk.white(`Provider: ${request.provider}`));
        console.log(chalk.white(`Model: ${request.model}`));
        console.log(chalk.white(`Completion ID: ${request.completion_id || 'Not available'}`));
        console.log(chalk.white(`Tokens: ${request.usage.total_tokens} (${request.usage.prompt_tokens} prompt + ${request.usage.completion_tokens} completion)`));
        console.log(chalk.white(`Cost: $${(request.metadata.cost_estimate || 0).toFixed(4)}`));
        console.log(chalk.white(`Duration: ${request.metadata.duration}ms`));
        console.log(chalk.white(`Location: ${request.metadata.caller_file}:${request.metadata.caller_function}:${request.metadata.caller_line}`));
        console.log(chalk.white(`Reasoning: ${request.metadata.reasoning}`));
        
        if (request.prompt) {
            console.log(chalk.yellow('\n📝 Prompt:'));
            console.log(chalk.gray(request.prompt));
        }
        
        if (request.response) {
            console.log(chalk.green('\n💬 Response:'));
            console.log(chalk.gray(request.response));
        }
        
        console.log('═'.repeat(80));
    }

    async clearRequests() {
        this.requests = [];
        await this.saveRequests();
        console.log(chalk.green('✅ Request log cleared'));
    }

    async exportRequests(format = 'json') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `api-requests-export-${timestamp}.${format}`;
        const filepath = path.join(process.cwd(), 'logs', filename);

        if (format === 'json') {
            await fs.writeJson(filepath, this.requests, { spaces: 2 });
        } else if (format === 'csv') {
            const csv = this.requestsToCSV();
            await fs.writeFile(filepath, csv);
        }

        console.log(chalk.green(`✅ Requests exported to: ${filepath}`));
        return filepath;
    }

    requestsToCSV() {
        const headers = [
            'timestamp', 'provider', 'model', 'prompt_tokens', 
            'completion_tokens', 'total_tokens', 'cost_estimate', 
            'source', 'operation', 'duration'
        ];
        
        const rows = this.requests.map(req => [
            req.timestamp,
            req.provider,
            req.model,
            req.usage.prompt_tokens,
            req.usage.completion_tokens,
            req.usage.total_tokens,
            req.metadata.cost_estimate || 0,
            req.metadata.source || 'unknown',
            req.metadata.operation || 'completion',
            req.metadata.duration || 0
        ]);

        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
}

export default RequestTracker;
