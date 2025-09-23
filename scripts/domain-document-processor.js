#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { MultiDomainDiffMem } from '../src/diffmem/multi-domain-diffmem.js';
import { LLMClient } from '../src/utils/llm-client.js';
import { CloudLLMExtractor } from '../src/extractors/cloud-llm-extractor.js';
import { CybersecLLMExtractor } from '../src/extractors/cybersec-llm-extractor.js';

/**
 * Domain Document Processor
 * 
 * Process documents with LLM entity extraction for specific domains
 * with cost tracking and throttling controls.
 */
class DomainDocumentProcessor {
    constructor(options = {}) {
        this.domain = options.domain || 'default';
        this.limit = options.limit || 3;
        this.dryRun = options.dryRun || false;
        this.model = options.model || 'gpt-3.5-turbo'; // Cost-effective default
        
        this.diffmem = new MultiDomainDiffMem({ domain: this.domain });
        
        // Choose extractor based on domain
        if (this.domain === 'cybersec') {
            this.extractor = new CybersecLLMExtractor({ 
                model: this.model,
                provider: 'openai'
            });
        } else {
            this.extractor = new CloudLLMExtractor({ 
                model: this.model,
                provider: 'openai'
            });
        }
        
        this.stats = {
            documentsProcessed: 0,
            documentsSkipped: 0,
            entitiesExtracted: 0,
            totalCost: 0,
            processingTime: 0,
            errors: 0,
            modelUsed: this.model
        };
    }

    async run(inputPaths) {
        console.log(chalk.blue.bold('🚀 Domain Document Processor'));
        console.log(chalk.white(`Domain: ${this.domain}`));
        console.log(chalk.white(`Model: ${this.model}`));
        console.log(chalk.white(`Limit: ${this.limit} documents`));
        console.log(chalk.white(`Dry Run: ${this.dryRun ? 'Yes' : 'No'}\n`));

        if (this.dryRun) {
            console.log(chalk.yellow('🔍 DRY RUN MODE - No LLM calls will be made\n'));
        }

        const startTime = Date.now();

        try {
            // Process each input path
            const allDocuments = [];
            for (const inputPath of inputPaths) {
                const docs = await this.findDocuments(inputPath);
                allDocuments.push(...docs);
            }
            
            if (allDocuments.length === 0) {
                console.log(chalk.yellow('⚠️  No documents found to process'));
                return;
            }

            console.log(chalk.green(`📄 Found ${allDocuments.length} documents`));
            
            // ✨ MAGIC: If limit is 1, try to find an unprocessed document
            let documentsToProcess;
            if (this.limit === 1 && allDocuments.length > 1) {
                console.log(chalk.magenta('✨ MAGIC: Looking for unprocessed document...'));
                
                // Check which documents are already processed
                const existingEntities = await this.diffmem.getAllEntities();
                const processedPaths = new Set(existingEntities.map(e => e.metadata?.source).filter(Boolean));
                
                // Find first unprocessed document
                const unprocessedDoc = allDocuments.find(doc => !processedPaths.has(doc.path));
                
                if (unprocessedDoc) {
                    console.log(chalk.green(`🎯 Found unprocessed document: ${path.basename(unprocessedDoc.path)}`));
                    documentsToProcess = [unprocessedDoc];
                } else {
                    console.log(chalk.yellow('⚠️  All documents already processed'));
                    documentsToProcess = allDocuments.slice(0, 1); // Take first one anyway
                }
            } else {
                // Normal behavior: take first N documents
                documentsToProcess = allDocuments.slice(0, this.limit);
            }
            
            const remaining = Math.max(0, allDocuments.length - documentsToProcess.length);
            
            if (remaining > 0) {
                console.log(chalk.yellow(`⚡ Processing ${documentsToProcess.length} documents (${remaining} remaining for next batch)`));
            }

            console.log('');

            // Process documents with LLM extraction
            for (let i = 0; i < documentsToProcess.length; i++) {
                const doc = documentsToProcess[i];
                console.log(chalk.blue(`📖 Processing ${i + 1}/${documentsToProcess.length}: ${path.basename(doc.path)}`));
                
                if (!this.dryRun) {
                    const result = await this.processDocumentWithExtraction(doc);
                    if (result?.skipped) {
                        this.stats.documentsSkipped++;
                    }
                } else {
                    console.log(chalk.gray(`   Would extract entities from: ${doc.path}`));
                    console.log(chalk.gray(`   Estimated cost: $0.01-0.04`));
                }
                
                console.log('');
            }

            this.stats.processingTime = Date.now() - startTime;
            this.printSummary();
            
            // ✨ MAGIC: If limit is 1, show the request/response details
            if (this.limit === 1 && !this.dryRun) {
                if (this.stats.documentsProcessed === 1) {
                    // Show details of the document we just processed
                    await this.showLastRequestDetails();
                } else if (this.stats.documentsSkipped > 0) {
                    // Show details of the most recent entity extraction (even if from previous run)
                    await this.showLastEntityExtractionRequest();
                }
            }
            
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
        const supportedExtensions = ['.md', '.txt'];
        
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

    async processDocumentWithExtraction(document) {
        try {
            // Check if document already processed
            const existingEntities = await this.diffmem.getAllEntities();
            const alreadyProcessed = existingEntities.some(entitySet => 
                entitySet.metadata?.source === document.path
            );
            
            if (alreadyProcessed) {
                console.log(chalk.yellow(`   ⚠️  Document already processed: ${path.basename(document.path)}`));
                console.log(chalk.gray(`   Skipping to avoid duplicates`));
                return { skipped: true, reason: 'already_processed' };
            }
            
            // Read document content
            const content = await fs.readFile(document.path, 'utf-8');
            
            console.log(chalk.gray(`   Size: ${(document.size / 1024).toFixed(1)}KB`));
            console.log(chalk.gray(`   Content length: ${content.length} characters`));
            
            // Extract entities using LLM
            console.log(chalk.blue('   🤖 Extracting entities...'));
            const startTime = Date.now();
            
            const extractionResult = await this.extractor.extractEntities(content, {
                communicationType: 'document',
                context: `Cybersecurity document: ${path.basename(document.path)}`,
                source: document.path
            });
            
            const processingTime = Date.now() - startTime;
            
            if (extractionResult && extractionResult.entities) {
                const entities = extractionResult.entities;
                const cost = extractionResult.metadata?.cost || 0;
                
                // Count entities
                let entityCount = 0;
                for (const entityList of Object.values(entities)) {
                    if (Array.isArray(entityList)) {
                        entityCount += entityList.length;
                    }
                }
                
                console.log(chalk.green(`   ✅ Extracted ${entityCount} entities`));
                console.log(chalk.gray(`   Cost: $${cost.toFixed(4)}`));
                console.log(chalk.gray(`   Time: ${(processingTime / 1000).toFixed(1)}s`));
                
                // Store in domain-specific datastore
                const conversationId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                
                await this.diffmem.storeEntities(conversationId, entities, {
                    source: document.path,
                    messageId: path.basename(document.path),
                    documentType: path.extname(document.path),
                    contentLength: content.length,
                    cost: cost,
                    processingTime: processingTime,
                    model: this.model,
                    provider: extractionResult.metadata?.provider || 'unknown',
                    confidence: extractionResult.metadata?.confidence || 0
                });
                
                // Store the document path and full prompt for magic display
                this.lastProcessedDocument = document.path;
                this.lastFullPrompt = extractionResult.metadata?.fullPrompt || null;
                this.lastFullResponse = extractionResult.content || null;
                
                // Update stats
                this.stats.documentsProcessed++;
                this.stats.entitiesExtracted += entityCount;
                this.stats.totalCost += cost;
                
                console.log(chalk.green('   💾 Stored in domain datastore'));
                
            } else {
                console.error(chalk.red(`   ❌ Extraction failed: No entities returned`));
                console.log('   Debug - extractionResult:', extractionResult);
                this.stats.errors++;
            }
            
        } catch (error) {
            console.error(chalk.red(`   ❌ Error processing document: ${error.message}`));
            this.stats.errors++;
        }
    }

    printSummary() {
        console.log(chalk.blue.bold('\n📊 PROCESSING SUMMARY'));
        console.log(chalk.white(`Domain: ${this.domain}`));
        console.log(chalk.white(`Model: ${this.stats.modelUsed}`));
        console.log(chalk.white(`Documents processed: ${this.stats.documentsProcessed}`));
        console.log(chalk.white(`Documents skipped: ${this.stats.documentsSkipped}`));
        console.log(chalk.white(`Entities extracted: ${this.stats.entitiesExtracted}`));
        console.log(chalk.white(`Total cost: $${this.stats.totalCost.toFixed(4)}`));
        console.log(chalk.white(`Processing time: ${(this.stats.processingTime / 1000).toFixed(1)}s`));
        console.log(chalk.white(`Errors: ${this.stats.errors}`));
        
        if (this.stats.documentsProcessed > 0) {
            const avgTime = this.stats.processingTime / this.stats.documentsProcessed;
            const avgCost = this.stats.totalCost / this.stats.documentsProcessed;
            const avgEntities = this.stats.entitiesExtracted / this.stats.documentsProcessed;
            
            console.log(chalk.gray(`\nAverages per document:`));
            console.log(chalk.gray(`  Time: ${(avgTime / 1000).toFixed(1)}s`));
            console.log(chalk.gray(`  Cost: $${avgCost.toFixed(4)}`));
            console.log(chalk.gray(`  Entities: ${avgEntities.toFixed(1)}`));
        }
        
        if (this.stats.totalCost > 0) {
            console.log(chalk.yellow.bold(`\n💰 Total API Cost: $${this.stats.totalCost.toFixed(4)}`));
        }
    }

    async showLastRequestDetails() {
        try {
            console.log(chalk.magenta.bold('\n✨ MAGIC: Showing Request/Response Details (--limit 1)'));
            console.log(chalk.gray('═'.repeat(80)));
            
            // Show document path if available
            if (this.lastProcessedDocument) {
                console.log(chalk.cyan(`📄 Document: ${this.lastProcessedDocument}`));
                console.log(chalk.gray('─'.repeat(80)));
            }
            
            // Import RequestTracker to get the latest request
            const { RequestTracker } = await import('../src/utils/request-tracker.js');
            const tracker = new RequestTracker();
            await tracker.loadExistingRequests();
            
            if (tracker.requests.length === 0) {
                console.log(chalk.yellow('⚠️  No requests found in tracker'));
                return;
            }
            
            // Get the most recent request
            const lastRequest = tracker.requests[tracker.requests.length - 1];
            
            // Check if it's from entity extraction (not just connectivity test)
            if (lastRequest.usage.total_tokens > 100) { // Entity extraction requests are much larger
                tracker.printRequestDetails(lastRequest);
                await this.saveFullRequestResponse(lastRequest);
            } else {
                console.log(chalk.yellow('⚠️  Last request was too small to be entity extraction'));
                console.log(chalk.gray('Looking for the most recent entity extraction request...'));
                
                // Find the most recent large request (entity extraction)
                const entityRequest = tracker.requests
                    .slice()
                    .reverse()
                    .find(req => req.usage.total_tokens > 100);
                
                if (entityRequest) {
                    tracker.printRequestDetails(entityRequest);
                    await this.saveFullRequestResponse(entityRequest);
                } else {
                    console.log(chalk.red('❌ No entity extraction requests found'));
                }
            }
            
        } catch (error) {
            console.error(chalk.red('❌ Error showing request details:'), error.message);
        }
    }

    async showLastEntityExtractionRequest() {
        try {
            console.log(chalk.magenta.bold('\n✨ MAGIC: Document Already Processed - Showing Last Entity Extraction'));
            console.log(chalk.gray('═'.repeat(80)));
            
            // Import RequestTracker to get the latest request
            const { RequestTracker } = await import('../src/utils/request-tracker.js');
            const tracker = new RequestTracker();
            await tracker.loadExistingRequests();
            
            if (tracker.requests.length === 0) {
                console.log(chalk.yellow('⚠️  No requests found in tracker'));
                return;
            }
            
            // Find the most recent entity extraction request (large token count)
            const entityRequest = tracker.requests
                .slice()
                .reverse()
                .find(req => req.usage.total_tokens > 1000 && 
                            req.metadata?.caller_file?.includes('extractor'));
            
            if (entityRequest) {
                console.log(chalk.cyan('📋 Most recent entity extraction request:'));
                tracker.printRequestDetails(entityRequest);
            } else {
                console.log(chalk.yellow('⚠️  No entity extraction requests found'));
                console.log(chalk.gray('Try processing a new document to see request/response details'));
            }
            
        } catch (error) {
            console.error(chalk.red('❌ Error showing entity extraction details:'), error.message);
        }
    }

    async saveFullRequestResponse(request) {
        try {
            const fs = await import('fs-extra');
            const timestamp = new Date(request.timestamp).toISOString().replace(/[:.]/g, '-');
            const requestId = request.id.split('_')[1]; // Get middle part of ID
            
            // Create logs directory if it doesn't exist
            await fs.default.ensureDir('logs');
            
            // Save full prompt (prefer from extractor, fallback to tracker)
            const promptFile = `logs/request-${requestId}-prompt.txt`;
            const fullPrompt = this.lastFullPrompt || request.prompt;
            if (fullPrompt) {
                await fs.default.writeFile(promptFile, fullPrompt, 'utf-8');
                console.log(chalk.green(`📝 Full prompt saved: ${promptFile}`));
            }
            
            // Save full response (prefer from extractor, fallback to tracker)
            const responseFile = `logs/request-${requestId}-response.json`;
            const fullResponse = this.lastFullResponse || request.response;
            if (fullResponse) {
                // Try to format as JSON if it's valid JSON
                let formattedResponse = fullResponse;
                try {
                    const parsed = JSON.parse(fullResponse);
                    formattedResponse = JSON.stringify(parsed, null, 2);
                } catch (e) {
                    // Keep as-is if not valid JSON
                }
                await fs.default.writeFile(responseFile, formattedResponse, 'utf-8');
                console.log(chalk.green(`💬 Full response saved: ${responseFile}`));
            }
            
            // Save metadata
            const metadataFile = `logs/request-${requestId}-metadata.json`;
            const metadata = {
                request_id: request.id,
                timestamp: request.timestamp,
                provider: request.provider,
                model: request.model,
                document_path: this.lastProcessedDocument || 'unknown',
                tokens: request.usage,
                cost: request.metadata?.cost_estimate || 0,
                duration: request.metadata?.duration || 0,
                location: `${request.metadata?.caller_file}:${request.metadata?.caller_function}`,
                reasoning: request.metadata?.reasoning
            };
            await fs.default.writeFile(metadataFile, JSON.stringify(metadata, null, 2), 'utf-8');
            console.log(chalk.green(`📊 Metadata saved: ${metadataFile}`));
            
            console.log(chalk.magenta(`\n📂 All files saved with prefix: request-${requestId}-*`));
            
        } catch (error) {
            console.error(chalk.red('❌ Error saving request/response files:'), error.message);
        }
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log(chalk.blue.bold('Domain Document Processor'));
        console.log(chalk.white('\nUsage: node domain-document-processor.js [options] <input-paths...>'));
        console.log(chalk.white('\nOptions:'));
        console.log(chalk.white('  --domain <name>      Domain for datastore (default: "default")'));
        console.log(chalk.white('  --limit <number>     Max documents to process (default: 3)'));
        console.log(chalk.white('  --model <name>       LLM model to use (default: "gpt-3.5-turbo")'));
        console.log(chalk.white('  --dry-run            Show what would be processed without LLM calls'));
        console.log(chalk.white('  --help, -h           Show this help'));
        console.log(chalk.white('\nExamples:'));
        console.log(chalk.gray('  node domain-document-processor.js --domain cybersec --limit 3 /path/to/doc1.md /path/to/doc2.md'));
        console.log(chalk.gray('  node domain-document-processor.js --domain cybersec --dry-run /path/to/docs/'));
        return;
    }
    
    const options = {};
    const inputPaths = [];
    
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--domain':
                options.domain = args[++i];
                break;
            case '--limit':
                options.limit = parseInt(args[++i]);
                break;
            case '--model':
                options.model = args[++i];
                break;
            case '--dry-run':
                options.dryRun = true;
                break;
            default:
                if (!args[i].startsWith('--')) {
                    inputPaths.push(args[i]);
                }
        }
    }
    
    if (inputPaths.length === 0) {
        console.error(chalk.red('❌ Error: At least one input path is required'));
        console.log(chalk.gray('Use --help for usage information'));
        process.exit(1);
    }
    
    const processor = new DomainDocumentProcessor(options);
    await processor.run(inputPaths);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default DomainDocumentProcessor;
