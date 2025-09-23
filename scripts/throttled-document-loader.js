#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { MultiDomainDiffMem } from '../src/diffmem/multi-domain-diffmem.js';

/**
 * Throttled Document Loader
 * 
 * Process N documents at a time with cost tracking and domain separation.
 * NO LLM CALLS - this is just for organizing existing data.
 */
class ThrottledDocumentLoader {
    constructor(options = {}) {
        this.domain = options.domain || 'default';
        this.limit = options.limit || 5;
        this.dryRun = options.dryRun || false;
        this.diffmem = new MultiDomainDiffMem({ domain: this.domain });
        
        this.stats = {
            documentsProcessed: 0,
            entitiesExtracted: 0,
            totalCost: 0,
            processingTime: 0,
            errors: 0
        };
    }

    async run(inputPath) {
        console.log(chalk.blue.bold('🚀 Throttled Document Loader'));
        console.log(chalk.white(`Domain: ${this.domain}`));
        console.log(chalk.white(`Limit: ${this.limit} documents`));
        console.log(chalk.white(`Input: ${inputPath}`));
        console.log(chalk.white(`Dry Run: ${this.dryRun ? 'Yes' : 'No'}\n`));

        if (this.dryRun) {
            console.log(chalk.yellow('🔍 DRY RUN MODE - No actual processing will occur\n'));
        }

        const startTime = Date.now();

        try {
            // Get list of documents to process
            const documents = await this.findDocuments(inputPath);
            
            if (documents.length === 0) {
                console.log(chalk.yellow('⚠️  No documents found to process'));
                return;
            }

            console.log(chalk.green(`📄 Found ${documents.length} documents`));
            
            // Apply limit
            const documentsToProcess = documents.slice(0, this.limit);
            const remaining = documents.length - documentsToProcess.length;
            
            if (remaining > 0) {
                console.log(chalk.yellow(`⚡ Processing ${documentsToProcess.length} documents (${remaining} remaining for next batch)`));
            }

            console.log('');

            // Process documents (NO LLM CALLS)
            for (let i = 0; i < documentsToProcess.length; i++) {
                const doc = documentsToProcess[i];
                console.log(chalk.blue(`📖 Processing ${i + 1}/${documentsToProcess.length}: ${path.basename(doc.path)}`));
                
                if (!this.dryRun) {
                    await this.processDocument(doc);
                } else {
                    console.log(chalk.gray(`   Would process: ${doc.path}`));
                }
                
                console.log('');
            }

            this.stats.processingTime = Date.now() - startTime;
            this.printSummary();
            
            if (remaining > 0) {
                console.log(chalk.yellow.bold('\n⚡ THROTTLE REACHED'));
                console.log(chalk.white(`${remaining} documents remaining for next batch`));
                console.log(chalk.gray('Run again with same parameters to continue processing'));
            }

        } catch (error) {
            console.error(chalk.red('❌ Error during processing:'), error.message);
            this.stats.errors++;
        }
    }

    async findDocuments(inputPath) {
        const documents = [];
        
        try {
            const stat = await fs.stat(inputPath);
            
            if (stat.isFile()) {
                documents.push({
                    path: inputPath,
                    name: path.basename(inputPath),
                    size: stat.size
                });
            } else if (stat.isDirectory()) {
                const files = await this.findFilesRecursively(inputPath);
                documents.push(...files);
            }
        } catch (error) {
            console.error(chalk.red(`❌ Error reading input path: ${error.message}`));
        }
        
        return documents;
    }

    async findFilesRecursively(dirPath) {
        const documents = [];
        const supportedExtensions = ['.md', '.txt', '.json'];
        
        try {
            const items = await fs.readdir(dirPath);
            
            for (const item of items) {
                const itemPath = path.join(dirPath, item);
                const stat = await fs.stat(itemPath);
                
                if (stat.isDirectory()) {
                    const subDocs = await this.findFilesRecursively(itemPath);
                    documents.push(...subDocs);
                } else if (stat.isFile()) {
                    const ext = path.extname(item).toLowerCase();
                    if (supportedExtensions.includes(ext)) {
                        documents.push({
                            path: itemPath,
                            name: item,
                            size: stat.size
                        });
                    }
                }
            }
        } catch (error) {
            console.warn(chalk.yellow(`⚠️  Could not read directory: ${dirPath}`));
        }
        
        return documents;
    }

    async processDocument(document) {
        try {
            // Read document content
            const content = await fs.readFile(document.path, 'utf-8');
            
            console.log(chalk.gray(`   Size: ${(document.size / 1024).toFixed(1)}KB`));
            console.log(chalk.gray(`   Content length: ${content.length} characters`));
            
            // For now, we're just organizing existing data - NO LLM EXTRACTION
            // This would be where we'd call the entity extractor if enabled
            
            console.log(chalk.yellow('   📋 Document catalogued (no extraction performed)'));
            
            // Create a placeholder record for tracking
            const conversationId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const mockEntities = {
                // This would contain extracted entities if LLM processing was enabled
                placeholder: [{
                    name: path.basename(document.path),
                    type: 'document',
                    confidence: 1.0,
                    source: document.path
                }]
            };
            
            // Store in domain-specific datastore (no cost since no LLM calls)
            await this.diffmem.storeEntities(conversationId, mockEntities, {
                source: document.path,
                documentType: path.extname(document.path),
                contentLength: content.length,
                cost: 0, // No LLM calls = no cost
                processingMode: 'catalogued_only'
            });
            
            this.stats.documentsProcessed++;
            console.log(chalk.green('   ✅ Stored in datastore'));
            
        } catch (error) {
            console.error(chalk.red(`   ❌ Error processing document: ${error.message}`));
            this.stats.errors++;
        }
    }

    printSummary() {
        console.log(chalk.blue.bold('\n📊 PROCESSING SUMMARY'));
        console.log(chalk.white(`Domain: ${this.domain}`));
        console.log(chalk.white(`Documents processed: ${this.stats.documentsProcessed}`));
        console.log(chalk.white(`Entities extracted: ${this.stats.entitiesExtracted}`));
        console.log(chalk.white(`Total cost: $${this.stats.totalCost.toFixed(4)}`));
        console.log(chalk.white(`Processing time: ${(this.stats.processingTime / 1000).toFixed(1)}s`));
        console.log(chalk.white(`Errors: ${this.stats.errors}`));
        
        if (this.stats.documentsProcessed > 0) {
            const avgTime = this.stats.processingTime / this.stats.documentsProcessed;
            console.log(chalk.gray(`Average time per document: ${(avgTime / 1000).toFixed(1)}s`));
        }
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log(chalk.blue.bold('Throttled Document Loader'));
        console.log(chalk.white('\nUsage: node throttled-document-loader.js [options] <input-path>'));
        console.log(chalk.white('\nOptions:'));
        console.log(chalk.white('  --domain <name>    Domain for datastore (default: "default")'));
        console.log(chalk.white('  --limit <number>   Max documents to process (default: 5)'));
        console.log(chalk.white('  --dry-run          Show what would be processed without doing it'));
        console.log(chalk.white('  --help, -h         Show this help'));
        console.log(chalk.white('\nExamples:'));
        console.log(chalk.gray('  node throttled-document-loader.js --domain cybersec --limit 3 /path/to/docs'));
        console.log(chalk.gray('  node throttled-document-loader.js --domain construction --dry-run /path/to/docs'));
        return;
    }
    
    const options = {};
    let inputPath = null;
    
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--domain':
                options.domain = args[++i];
                break;
            case '--limit':
                options.limit = parseInt(args[++i]);
                break;
            case '--dry-run':
                options.dryRun = true;
                break;
            default:
                if (!inputPath && !args[i].startsWith('--')) {
                    inputPath = args[i];
                }
        }
    }
    
    if (!inputPath) {
        console.error(chalk.red('❌ Error: Input path is required'));
        console.log(chalk.gray('Use --help for usage information'));
        process.exit(1);
    }
    
    const loader = new ThrottledDocumentLoader(options);
    await loader.run(inputPath);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default ThrottledDocumentLoader;
