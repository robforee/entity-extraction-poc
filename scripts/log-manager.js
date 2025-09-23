#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

/**
 * Log Management Tool
 * 
 * Manages log files, monitors sizes, and provides cleanup functionality
 */
class LogManager {
    constructor() {
        this.logDir = path.join(process.cwd(), 'logs');
        this.maxFileSize = 10 * 1024 * 1024; // 10MB default
        this.maxTotalSize = 100 * 1024 * 1024; // 100MB default
        this.retentionDays = 30; // Keep logs for 30 days
    }

    async checkLogSizes() {
        try {
            if (!await fs.pathExists(this.logDir)) {
                console.log(chalk.yellow('📂 No logs directory found'));
                return;
            }

            const files = await fs.readdir(this.logDir);
            let totalSize = 0;
            const fileStats = [];

            console.log(chalk.blue.bold('📊 Log File Analysis'));
            console.log('═'.repeat(80));

            for (const file of files) {
                const filePath = path.join(this.logDir, file);
                const stats = await fs.stat(filePath);
                const sizeKB = Math.round(stats.size / 1024);
                const sizeMB = Math.round(stats.size / (1024 * 1024) * 100) / 100;
                const age = Math.round((Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24));

                totalSize += stats.size;
                fileStats.push({
                    name: file,
                    size: stats.size,
                    sizeKB,
                    sizeMB,
                    age,
                    mtime: stats.mtime
                });

                const sizeColor = stats.size > this.maxFileSize ? chalk.red : 
                                 stats.size > this.maxFileSize / 2 ? chalk.yellow : chalk.green;
                const ageColor = age > this.retentionDays ? chalk.red : 
                                age > this.retentionDays / 2 ? chalk.yellow : chalk.green;

                console.log(`${sizeColor(file.padEnd(40))} ${sizeColor(sizeKB.toString().padStart(8) + ' KB')} ${ageColor(age.toString().padStart(3) + ' days')}`);
            }

            console.log('═'.repeat(80));
            const totalMB = Math.round(totalSize / (1024 * 1024) * 100) / 100;
            const totalColor = totalSize > this.maxTotalSize ? chalk.red : 
                              totalSize > this.maxTotalSize / 2 ? chalk.yellow : chalk.green;
            
            console.log(totalColor(`Total: ${fileStats.length} files, ${totalMB} MB`));

            // Warnings
            if (totalSize > this.maxTotalSize) {
                console.log(chalk.red.bold('\n⚠️  WARNING: Total log size exceeds limit!'));
                console.log(chalk.yellow('Consider running: npm run logs:clean'));
            } else if (totalSize > this.maxTotalSize / 2) {
                console.log(chalk.yellow.bold('\n💡 INFO: Log size is growing large'));
                console.log(chalk.gray('Monitor usage or clean old files'));
            }

            const oldFiles = fileStats.filter(f => f.age > this.retentionDays);
            if (oldFiles.length > 0) {
                console.log(chalk.yellow.bold(`\n📅 Found ${oldFiles.length} files older than ${this.retentionDays} days`));
            }

            return { fileStats, totalSize, totalMB };

        } catch (error) {
            console.error(chalk.red('❌ Error checking log sizes:'), error.message);
        }
    }

    async cleanOldLogs(dryRun = false) {
        try {
            if (!await fs.pathExists(this.logDir)) {
                console.log(chalk.yellow('📂 No logs directory found'));
                return;
            }

            const files = await fs.readdir(this.logDir);
            const cutoffDate = new Date(Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000));
            let deletedCount = 0;
            let freedSpace = 0;

            console.log(chalk.blue.bold(`🧹 Cleaning logs older than ${this.retentionDays} days`));
            console.log(chalk.gray(`Cutoff date: ${cutoffDate.toISOString().split('T')[0]}`));
            console.log('═'.repeat(60));

            for (const file of files) {
                const filePath = path.join(this.logDir, file);
                const stats = await fs.stat(filePath);

                if (stats.mtime < cutoffDate) {
                    const sizeKB = Math.round(stats.size / 1024);
                    
                    if (dryRun) {
                        console.log(chalk.yellow(`Would delete: ${file} (${sizeKB} KB)`));
                    } else {
                        await fs.remove(filePath);
                        console.log(chalk.green(`Deleted: ${file} (${sizeKB} KB)`));
                    }
                    
                    deletedCount++;
                    freedSpace += stats.size;
                }
            }

            const freedMB = Math.round(freedSpace / (1024 * 1024) * 100) / 100;
            console.log('═'.repeat(60));
            
            if (dryRun) {
                console.log(chalk.cyan(`Would delete ${deletedCount} files, freeing ${freedMB} MB`));
                console.log(chalk.gray('Run without --dry-run to actually delete files'));
            } else {
                console.log(chalk.green(`✅ Deleted ${deletedCount} files, freed ${freedMB} MB`));
            }

        } catch (error) {
            console.error(chalk.red('❌ Error cleaning logs:'), error.message);
        }
    }

    async trimLargeFiles(dryRun = false) {
        try {
            if (!await fs.pathExists(this.logDir)) {
                console.log(chalk.yellow('📂 No logs directory found'));
                return;
            }

            const files = await fs.readdir(this.logDir);
            let trimmedCount = 0;

            console.log(chalk.blue.bold('✂️  Trimming large log files'));
            console.log('═'.repeat(60));

            for (const file of files) {
                const filePath = path.join(this.logDir, file);
                const stats = await fs.stat(filePath);

                if (stats.size > this.maxFileSize) {
                    const sizeMB = Math.round(stats.size / (1024 * 1024) * 100) / 100;
                    
                    if (file.endsWith('.json')) {
                        // For JSON files, try to keep the structure
                        await this.trimJsonFile(filePath, dryRun);
                    } else {
                        // For text files, keep the last portion
                        await this.trimTextFile(filePath, dryRun);
                    }
                    
                    console.log(chalk.green(`${dryRun ? 'Would trim' : 'Trimmed'}: ${file} (was ${sizeMB} MB)`));
                    trimmedCount++;
                }
            }

            console.log('═'.repeat(60));
            console.log(chalk.green(`${dryRun ? 'Would trim' : 'Trimmed'} ${trimmedCount} files`));

        } catch (error) {
            console.error(chalk.red('❌ Error trimming files:'), error.message);
        }
    }

    async trimJsonFile(filePath, dryRun) {
        if (dryRun) return;

        try {
            const data = await fs.readJson(filePath);
            if (Array.isArray(data)) {
                // Keep the last 50% of array items
                const keepCount = Math.floor(data.length / 2);
                const trimmed = data.slice(-keepCount);
                await fs.writeJson(filePath, trimmed, { spaces: 2 });
            }
        } catch (error) {
            // If JSON parsing fails, treat as text file
            await this.trimTextFile(filePath, dryRun);
        }
    }

    async trimTextFile(filePath, dryRun) {
        if (dryRun) return;

        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const lines = content.split('\n');
            // Keep the last 50% of lines
            const keepCount = Math.floor(lines.length / 2);
            const trimmed = lines.slice(-keepCount).join('\n');
            await fs.writeFile(filePath, trimmed, 'utf-8');
        } catch (error) {
            console.warn(chalk.yellow(`⚠️  Could not trim ${path.basename(filePath)}: ${error.message}`));
        }
    }

    async archiveLogs() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const archiveDir = path.join(this.logDir, 'archive', timestamp);
            
            await fs.ensureDir(archiveDir);
            
            const files = await fs.readdir(this.logDir);
            let archivedCount = 0;

            console.log(chalk.blue.bold('📦 Archiving current logs'));
            console.log('═'.repeat(60));

            for (const file of files) {
                if (file === 'archive') continue; // Skip archive directory
                
                const srcPath = path.join(this.logDir, file);
                const destPath = path.join(archiveDir, file);
                
                const stats = await fs.stat(srcPath);
                if (stats.isFile()) {
                    await fs.move(srcPath, destPath);
                    console.log(chalk.green(`Archived: ${file}`));
                    archivedCount++;
                }
            }

            console.log('═'.repeat(60));
            console.log(chalk.green(`✅ Archived ${archivedCount} files to: archive/${timestamp}`));

        } catch (error) {
            console.error(chalk.red('❌ Error archiving logs:'), error.message);
        }
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    const logManager = new LogManager();

    if (args.includes('--help') || args.includes('-h')) {
        console.log(chalk.blue.bold('Log Management Tool'));
        console.log(chalk.white('\nUsage: node log-manager.js [command] [options]'));
        console.log(chalk.white('\nCommands:'));
        console.log(chalk.white('  status              Show log file sizes and status'));
        console.log(chalk.white('  clean [--dry-run]   Clean old log files'));
        console.log(chalk.white('  trim [--dry-run]    Trim large log files'));
        console.log(chalk.white('  archive             Archive current logs'));
        console.log(chalk.white('  --help, -h          Show this help'));
        console.log(chalk.white('\nExamples:'));
        console.log(chalk.gray('  node log-manager.js status'));
        console.log(chalk.gray('  node log-manager.js clean --dry-run'));
        console.log(chalk.gray('  node log-manager.js trim'));
        return;
    }

    const command = args[0] || 'status';
    const dryRun = args.includes('--dry-run');

    switch (command) {
        case 'status':
            await logManager.checkLogSizes();
            break;
        case 'clean':
            await logManager.cleanOldLogs(dryRun);
            break;
        case 'trim':
            await logManager.trimLargeFiles(dryRun);
            break;
        case 'archive':
            await logManager.archiveLogs();
            break;
        default:
            console.error(chalk.red(`❌ Unknown command: ${command}`));
            console.log(chalk.gray('Run with --help for usage information'));
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default LogManager;
