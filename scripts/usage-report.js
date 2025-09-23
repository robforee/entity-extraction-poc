#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Usage Report Generator for Universal Knowledge System
 * 
 * Generates comprehensive reports on:
 * - Documents loaded and processed
 * - Entities extracted by category
 * - LLM API calls by provider/model
 * - Cost analysis and usage patterns
 * - All-time vs last 24 hours metrics
 */
class UsageReporter {
    constructor() {
        this.dataDir = path.join(__dirname, '../data');
        this.logsDir = path.join(__dirname, '../logs');
        this.diffmemDir = path.join(this.dataDir, 'mock-diffmem');
        
        // Ensure directories exist
        this.ensureDirectories();
        
        this.report = {
            timestamp: new Date().toISOString(),
            allTime: {
                documents: 0,
                entities: { total: 0, byCategory: {} },
                apiCalls: { total: 0, byProvider: {}, byModel: {} },
                costs: { total: 0, byProvider: {} }
            },
            last24Hours: {
                documents: 0,
                entities: { total: 0, byCategory: {} },
                apiCalls: { total: 0, byProvider: {}, byModel: {} },
                costs: { total: 0, byProvider: {} }
            }
        };
    }

    ensureDirectories() {
        const dirs = [
            this.dataDir,
            this.logsDir,
            this.diffmemDir,
            path.join(this.diffmemDir, 'conversations'),
            path.join(this.diffmemDir, 'entities'),
            path.join(this.diffmemDir, 'metadata')
        ];
        
        for (const dir of dirs) {
            fs.ensureDirSync(dir);
        }
    }

    async generateReport() {
        console.log(chalk.blue.bold('📊 Universal Knowledge System - Usage Report\n'));
        
        try {
            // Analyze stored documents and entities
            await this.analyzeStoredData();
            
            // Analyze API call logs
            await this.analyzeApiLogs();
            
            // Generate and display report
            this.displayReport();
            
            // Save report to file
            await this.saveReport();
            
        } catch (error) {
            console.error(chalk.red('❌ Report generation failed:'), error.message);
            throw error;
        }
    }

    async analyzeStoredData() {
        console.log(chalk.cyan('🔍 Analyzing stored documents and entities...'));
        
        const conversationsDir = path.join(this.diffmemDir, 'conversations');
        const entitiesDir = path.join(this.diffmemDir, 'entities');
        
        // Check if directories exist and have content
        if (!await fs.pathExists(conversationsDir) || !await fs.pathExists(entitiesDir)) {
            console.log(chalk.yellow('⚠️  No stored data found in DiffMem directories'));
            return;
        }
        
        // Analyze conversations (documents)
        const conversationFiles = await this.getFilesInDirectory(conversationsDir);
        const entityFiles = await this.getFilesInDirectory(entitiesDir);
        
        const now = Date.now();
        const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
        
        // Process conversation files
        for (const file of conversationFiles) {
            try {
                const filePath = path.join(conversationsDir, file);
                const stats = await fs.stat(filePath);
                const data = await fs.readJson(filePath);
                
                this.report.allTime.documents++;
                
                if (stats.mtime.getTime() > twentyFourHoursAgo) {
                    this.report.last24Hours.documents++;
                }
                
                // Extract document metadata if available
                if (data.metadata && data.metadata.documentType) {
                    console.log(chalk.gray(`  📄 Found document: ${data.metadata.source || file}`));
                }
                
            } catch (error) {
                console.warn(chalk.yellow(`⚠️  Could not process conversation file: ${file}`));
            }
        }
        
        // Process entity files
        for (const file of entityFiles) {
            try {
                const filePath = path.join(entitiesDir, file);
                const stats = await fs.stat(filePath);
                const data = await fs.readJson(filePath);
                
                const isRecent = stats.mtime.getTime() > twentyFourHoursAgo;
                
                // Count entities by category
                if (data.entities) {
                    for (const [category, entityList] of Object.entries(data.entities)) {
                        if (Array.isArray(entityList)) {
                            const count = entityList.length;
                            
                            // All time
                            this.report.allTime.entities.total += count;
                            this.report.allTime.entities.byCategory[category] = 
                                (this.report.allTime.entities.byCategory[category] || 0) + count;
                            
                            // Last 24 hours
                            if (isRecent) {
                                this.report.last24Hours.entities.total += count;
                                this.report.last24Hours.entities.byCategory[category] = 
                                    (this.report.last24Hours.entities.byCategory[category] || 0) + count;
                            }
                        }
                    }
                }
                
            } catch (error) {
                console.warn(chalk.yellow(`⚠️  Could not process entity file: ${file}`));
            }
        }
        
        console.log(chalk.green(`✅ Analyzed ${conversationFiles.length} documents and ${entityFiles.length} entity sets`));
    }

    async analyzeApiLogs() {
        console.log(chalk.cyan('🔍 Analyzing API call logs...'));
        
        // Check for the main API requests log file
        const apiRequestsPath = path.join(this.logsDir, 'api-requests.json');
        
        if (await fs.pathExists(apiRequestsPath)) {
            await this.processApiRequestsFile(apiRequestsPath);
        }
        
        // Also look for other request tracking logs
        const logFiles = await this.getFilesInDirectory(this.logsDir);
        const requestLogFiles = logFiles.filter(file => 
            file.includes('request') || file.includes('api') || file.includes('usage')
        ).filter(file => file !== 'api-requests.json'); // Avoid double processing
        
        const now = Date.now();
        const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
        
        for (const logFile of requestLogFiles) {
            try {
                const logPath = path.join(this.logsDir, logFile);
                const content = await fs.readFile(logPath, 'utf8');
                const lines = content.split('\n').filter(line => line.trim());
                
                for (const line of lines) {
                    try {
                        // Try to parse as JSON log entry
                        const logEntry = JSON.parse(line);
                        
                        if (logEntry.provider && logEntry.model) {
                            const timestamp = new Date(logEntry.timestamp || logEntry.time).getTime();
                            const isRecent = timestamp > twentyFourHoursAgo;
                            const cost = logEntry.cost || logEntry.estimated_cost || logEntry.metadata?.cost_estimate || 0;
                            
                            this.processApiLogEntry(logEntry, isRecent, cost);
                        }
                        
                    } catch (parseError) {
                        // Skip non-JSON lines
                        continue;
                    }
                }
                
            } catch (error) {
                console.warn(chalk.yellow(`⚠️  Could not process log file: ${logFile}`));
            }
        }
        
        const totalFiles = (await fs.pathExists(apiRequestsPath) ? 1 : 0) + requestLogFiles.length;
        console.log(chalk.green(`✅ Analyzed ${totalFiles} API log files`));
    }

    async processApiRequestsFile(filePath) {
        try {
            const data = await fs.readJson(filePath);
            const now = Date.now();
            const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
            
            if (Array.isArray(data)) {
                for (const request of data) {
                    if (request.provider && request.model) {
                        const timestamp = new Date(request.timestamp).getTime();
                        const isRecent = timestamp > twentyFourHoursAgo;
                        const cost = request.metadata?.cost_estimate || 0;
                        
                        this.processApiLogEntry(request, isRecent, cost);
                    }
                }
                
                console.log(chalk.gray(`  📊 Processed ${data.length} API requests from main log`));
            }
            
        } catch (error) {
            console.warn(chalk.yellow(`⚠️  Could not process API requests file: ${error.message}`));
        }
    }

    processApiLogEntry(logEntry, isRecent, cost) {
        // All time tracking
        this.report.allTime.apiCalls.total++;
        this.report.allTime.apiCalls.byProvider[logEntry.provider] = 
            (this.report.allTime.apiCalls.byProvider[logEntry.provider] || 0) + 1;
        this.report.allTime.apiCalls.byModel[`${logEntry.provider}:${logEntry.model}`] = 
            (this.report.allTime.apiCalls.byModel[`${logEntry.provider}:${logEntry.model}`] || 0) + 1;
        this.report.allTime.costs.total += cost;
        this.report.allTime.costs.byProvider[logEntry.provider] = 
            (this.report.allTime.costs.byProvider[logEntry.provider] || 0) + cost;
        
        // Last 24 hours tracking
        if (isRecent) {
            this.report.last24Hours.apiCalls.total++;
            this.report.last24Hours.apiCalls.byProvider[logEntry.provider] = 
                (this.report.last24Hours.apiCalls.byProvider[logEntry.provider] || 0) + 1;
            this.report.last24Hours.apiCalls.byModel[`${logEntry.provider}:${logEntry.model}`] = 
                (this.report.last24Hours.apiCalls.byModel[`${logEntry.provider}:${logEntry.model}`] || 0) + 1;
            this.report.last24Hours.costs.total += cost;
            this.report.last24Hours.costs.byProvider[logEntry.provider] = 
                (this.report.last24Hours.costs.byProvider[logEntry.provider] || 0) + cost;
        }
    }

    async getFilesInDirectory(dirPath) {
        try {
            if (!await fs.pathExists(dirPath)) {
                return [];
            }
            const items = await fs.readdir(dirPath);
            const files = [];
            
            for (const item of items) {
                const itemPath = path.join(dirPath, item);
                const stats = await fs.stat(itemPath);
                if (stats.isFile()) {
                    files.push(item);
                }
            }
            
            return files;
        } catch (error) {
            return [];
        }
    }

    displayReport() {
        console.log(chalk.blue.bold('\n📊 UNIVERSAL KNOWLEDGE SYSTEM - USAGE REPORT'));
        console.log(chalk.blue('═'.repeat(60)));
        console.log(chalk.white(`Generated: ${new Date(this.report.timestamp).toLocaleString()}`));
        
        // All Time Statistics
        console.log(chalk.green.bold('\n🌍 ALL TIME STATISTICS'));
        console.log(chalk.green('─'.repeat(30)));
        
        console.log(chalk.cyan(`📚 Documents Processed: ${this.report.allTime.documents}`));
        console.log(chalk.cyan(`🎯 Total Entities Extracted: ${this.report.allTime.entities.total}`));
        console.log(chalk.cyan(`🔧 Total API Calls: ${this.report.allTime.apiCalls.total}`));
        console.log(chalk.cyan(`💰 Total Cost: $${this.report.allTime.costs.total.toFixed(4)}`));
        
        // Entity breakdown
        if (Object.keys(this.report.allTime.entities.byCategory).length > 0) {
            console.log(chalk.white('\n📊 Entities by Category:'));
            for (const [category, count] of Object.entries(this.report.allTime.entities.byCategory)) {
                console.log(chalk.white(`  ${category}: ${count}`));
            }
        }
        
        // API calls by provider
        if (Object.keys(this.report.allTime.apiCalls.byProvider).length > 0) {
            console.log(chalk.white('\n🔧 API Calls by Provider:'));
            for (const [provider, count] of Object.entries(this.report.allTime.apiCalls.byProvider)) {
                const cost = this.report.allTime.costs.byProvider[provider] || 0;
                console.log(chalk.white(`  ${provider}: ${count} calls ($${cost.toFixed(4)})`));
            }
        }
        
        // API calls by model
        if (Object.keys(this.report.allTime.apiCalls.byModel).length > 0) {
            console.log(chalk.white('\n🤖 API Calls by Model:'));
            const sortedModels = Object.entries(this.report.allTime.apiCalls.byModel)
                .sort(([,a], [,b]) => b - a);
            for (const [model, count] of sortedModels) {
                console.log(chalk.white(`  ${model}: ${count} calls`));
            }
        }
        
        // Last 24 Hours Statistics
        console.log(chalk.yellow.bold('\n⏰ LAST 24 HOURS STATISTICS'));
        console.log(chalk.yellow('─'.repeat(30)));
        
        console.log(chalk.cyan(`📚 Documents Processed: ${this.report.last24Hours.documents}`));
        console.log(chalk.cyan(`🎯 Entities Extracted: ${this.report.last24Hours.entities.total}`));
        console.log(chalk.cyan(`🔧 API Calls: ${this.report.last24Hours.apiCalls.total}`));
        console.log(chalk.cyan(`💰 Cost: $${this.report.last24Hours.costs.total.toFixed(4)}`));
        
        // Recent entity breakdown
        if (Object.keys(this.report.last24Hours.entities.byCategory).length > 0) {
            console.log(chalk.white('\n📊 Recent Entities by Category:'));
            for (const [category, count] of Object.entries(this.report.last24Hours.entities.byCategory)) {
                console.log(chalk.white(`  ${category}: ${count}`));
            }
        }
        
        // Recent API calls by provider
        if (Object.keys(this.report.last24Hours.apiCalls.byProvider).length > 0) {
            console.log(chalk.white('\n🔧 Recent API Calls by Provider:'));
            for (const [provider, count] of Object.entries(this.report.last24Hours.apiCalls.byProvider)) {
                const cost = this.report.last24Hours.costs.byProvider[provider] || 0;
                console.log(chalk.white(`  ${provider}: ${count} calls ($${cost.toFixed(4)})`));
            }
        }
        
        // Performance metrics
        console.log(chalk.magenta.bold('\n📈 PERFORMANCE METRICS'));
        console.log(chalk.magenta('─'.repeat(25)));
        
        if (this.report.allTime.documents > 0) {
            const avgEntitiesPerDoc = (this.report.allTime.entities.total / this.report.allTime.documents).toFixed(1);
            const avgCostPerDoc = (this.report.allTime.costs.total / this.report.allTime.documents).toFixed(4);
            const avgCallsPerDoc = (this.report.allTime.apiCalls.total / this.report.allTime.documents).toFixed(1);
            
            console.log(chalk.white(`Average entities per document: ${avgEntitiesPerDoc}`));
            console.log(chalk.white(`Average cost per document: $${avgCostPerDoc}`));
            console.log(chalk.white(`Average API calls per document: ${avgCallsPerDoc}`));
        }
        
        if (this.report.allTime.apiCalls.total > 0) {
            const avgCostPerCall = (this.report.allTime.costs.total / this.report.allTime.apiCalls.total).toFixed(4);
            console.log(chalk.white(`Average cost per API call: $${avgCostPerCall}`));
        }
        
        console.log(chalk.blue('═'.repeat(60)));
    }

    async saveReport() {
        const reportPath = path.join(this.logsDir, `usage-report-${Date.now()}.json`);
        await fs.writeJson(reportPath, this.report, { spaces: 2 });
        console.log(chalk.green(`\n💾 Report saved to: ${reportPath}`));
        
        // Also save a human-readable version
        const readablePath = path.join(this.logsDir, `usage-report-${Date.now()}.txt`);
        const readableContent = this.generateReadableReport();
        await fs.writeFile(readablePath, readableContent);
        console.log(chalk.green(`📄 Readable report saved to: ${readablePath}`));
    }

    generateReadableReport() {
        const lines = [];
        lines.push('UNIVERSAL KNOWLEDGE SYSTEM - USAGE REPORT');
        lines.push('═'.repeat(60));
        lines.push(`Generated: ${new Date(this.report.timestamp).toLocaleString()}`);
        lines.push('');
        
        lines.push('ALL TIME STATISTICS');
        lines.push('─'.repeat(30));
        lines.push(`Documents Processed: ${this.report.allTime.documents}`);
        lines.push(`Total Entities Extracted: ${this.report.allTime.entities.total}`);
        lines.push(`Total API Calls: ${this.report.allTime.apiCalls.total}`);
        lines.push(`Total Cost: $${this.report.allTime.costs.total.toFixed(4)}`);
        lines.push('');
        
        if (Object.keys(this.report.allTime.entities.byCategory).length > 0) {
            lines.push('Entities by Category:');
            for (const [category, count] of Object.entries(this.report.allTime.entities.byCategory)) {
                lines.push(`  ${category}: ${count}`);
            }
            lines.push('');
        }
        
        if (Object.keys(this.report.allTime.apiCalls.byProvider).length > 0) {
            lines.push('API Calls by Provider:');
            for (const [provider, count] of Object.entries(this.report.allTime.apiCalls.byProvider)) {
                const cost = this.report.allTime.costs.byProvider[provider] || 0;
                lines.push(`  ${provider}: ${count} calls ($${cost.toFixed(4)})`);
            }
            lines.push('');
        }
        
        lines.push('LAST 24 HOURS STATISTICS');
        lines.push('─'.repeat(30));
        lines.push(`Documents Processed: ${this.report.last24Hours.documents}`);
        lines.push(`Entities Extracted: ${this.report.last24Hours.entities.total}`);
        lines.push(`API Calls: ${this.report.last24Hours.apiCalls.total}`);
        lines.push(`Cost: $${this.report.last24Hours.costs.total.toFixed(4)}`);
        
        return lines.join('\n');
    }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
    const reporter = new UsageReporter();
    reporter.generateReport().catch(console.error);
}

export default UsageReporter;
