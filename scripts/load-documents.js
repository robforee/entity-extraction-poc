#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { glob } from 'glob';
import { ProductionExtractor } from '../src/extractors/production-extractor.js';
import { MockDiffMem } from '../src/diffmem/mock-diffmem.js';

/**
 * Document Loader for Universal Knowledge System
 * 
 * Supports multiple input types:
 * - Single text files (.txt, .md, .json)
 * - Multiple files in directories
 * - Email exports (.mbox, .eml, .txt)
 * - Research papers (.pdf - text extraction)
 * - Structured data (.json, .csv)
 * - Web content (.html)
 * 
 * Usage:
 * npm run test:load-docs ./path/to/file.txt
 * npm run test:load-docs ./path/to/directory
 * npm run test:load-docs ./emails/*.txt
 */
class DocumentLoader {
    constructor() {
        this.extractor = new ProductionExtractor();
        this.diffmem = new MockDiffMem();
        this.supportedExtensions = ['.txt', '.md', '.json', '.html', '.csv', '.eml', '.mbox'];
        this.stats = {
            filesProcessed: 0,
            entitiesExtracted: 0,
            errors: 0,
            totalCost: 0
        };
    }

    async loadDocuments(inputPath) {
        console.log(chalk.blue.bold('📚 Universal Knowledge System - Document Loader\n'));
        
        if (!inputPath) {
            console.log(chalk.red('❌ Please provide an input path'));
            console.log(chalk.white('Usage: npm run test:load-docs ./your-documents'));
            console.log(chalk.white('       npm run test:load-docs ./single-file.txt'));
            console.log(chalk.white('       npm run test:load-docs ./emails/*.txt'));
            return;
        }

        try {
            const files = await this.discoverFiles(inputPath);
            
            if (files.length === 0) {
                console.log(chalk.yellow('⚠️  No supported files found'));
                this.printSupportedFormats();
                return;
            }

            console.log(chalk.cyan(`📁 Found ${files.length} files to process\n`));
            
            for (const file of files) {
                await this.processFile(file);
            }
            
            this.printSummary();
            
        } catch (error) {
            console.error(chalk.red('❌ Document loading failed:'), error.message);
            throw error;
        }
    }

    async discoverFiles(inputPath) {
        const files = [];
        
        try {
            console.log(chalk.gray(`🔍 Checking path: ${inputPath}`));
            const stat = await fs.stat(inputPath);
            
            if (stat.isFile()) {
                // Single file
                console.log(chalk.gray(`📄 Found single file`));
                if (this.isSupportedFile(inputPath)) {
                    files.push(inputPath);
                } else {
                    console.log(chalk.yellow(`⚠️  Unsupported file type: ${path.extname(inputPath)}`));
                }
            } else if (stat.isDirectory()) {
                // Directory - find all supported files
                console.log(chalk.gray(`📁 Scanning directory for files...`));
                const pattern = path.join(inputPath, '**/*');
                console.log(chalk.gray(`🔍 Using pattern: ${pattern}`));
                
                try {
                    const globFiles = await glob(pattern, { nodir: true });
                    console.log(chalk.gray(`📋 Found ${globFiles.length} files via glob`));
                    
                    for (const file of globFiles) {
                        if (this.isSupportedFile(file)) {
                            files.push(file);
                            console.log(chalk.gray(`  ✓ ${path.basename(file)}`));
                        } else {
                            console.log(chalk.gray(`  ⚠ Skipping ${path.basename(file)} (unsupported)`));
                        }
                    }
                } catch (globError) {
                    console.log(chalk.red(`❌ Glob error: ${globError.message}`));
                    throw globError;
                }
            }
        } catch (error) {
            console.log(chalk.red(`❌ fs.stat error: ${error.message}`));
            console.log(chalk.gray(`🔄 Trying as glob pattern...`));
            
            // Try as glob pattern
            try {
                const globFiles = await glob(inputPath, { nodir: true });
                console.log(chalk.gray(`📋 Found ${globFiles.length} files via direct glob`));
                
                for (const file of globFiles) {
                    if (this.isSupportedFile(file)) {
                        files.push(file);
                    }
                }
            } catch (globError) {
                console.log(chalk.red(`❌ Glob fallback error: ${globError.message}`));
                throw new Error(`Cannot access path: ${inputPath} (stat: ${error.message}, glob: ${globError.message})`);
            }
        }
        
        return files;
    }

    isSupportedFile(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        return this.supportedExtensions.includes(ext);
    }

    async processFile(filePath) {
        const fileName = path.basename(filePath);
        const fileExt = path.extname(filePath).toLowerCase();
        
        console.log(chalk.cyan(`📄 Processing: ${fileName}`));
        
        try {
            const content = await this.extractContent(filePath, fileExt);
            
            if (!content || content.trim().length === 0) {
                console.log(chalk.yellow(`  ⚠️  Empty or unreadable content`));
                return;
            }

            // Extract entities from content
            const result = await this.extractor.extractEntities(content, {
                source: `document-loader:${fileName}`,
                operation: 'bulk_document_processing',
                reasoning: `Processing ${fileExt} document for universal knowledge extraction`,
                could_use_local: content.length < 1000 // Simple heuristic
            });

            // Handle the result structure - entities is an object with categories
            const entitiesObj = result.entities || {};
            const costEstimate = result.metadata?.cost || 0;
            const duration = result.metadata?.duration || 0;
            
            // Count total entities across all categories
            let totalEntities = 0;
            for (const category in entitiesObj) {
                if (Array.isArray(entitiesObj[category])) {
                    totalEntities += entitiesObj[category].length;
                }
            }
            
            console.log(chalk.gray(`🔍 Found ${totalEntities} entities across ${Object.keys(entitiesObj).length} categories`));

            // Store in DiffMem
            const conversationId = `doc_${Date.now()}`;
            await this.diffmem.storeEntities(conversationId, entitiesObj, {
                messageId: fileName,
                source: filePath,
                timestamp: new Date().toISOString(),
                documentType: fileExt,
                contentLength: content.length
            });

            this.stats.filesProcessed++;
            this.stats.entitiesExtracted += totalEntities;
            this.stats.totalCost += costEstimate;

            console.log(chalk.green(`  ✅ Extracted ${totalEntities} entities`));
            console.log(chalk.white(`     Cost: $${costEstimate.toFixed(4)}, Duration: ${duration}ms`));
            
        } catch (error) {
            this.stats.errors++;
            console.log(chalk.red(`  ❌ Error: ${error.message}`));
        }
    }

    async extractContent(filePath, fileExt) {
        switch (fileExt) {
            case '.txt':
            case '.md':
                return await fs.readFile(filePath, 'utf8');
                
            case '.json':
                const jsonData = await fs.readJson(filePath);
                // Extract text content from JSON
                return this.extractTextFromJson(jsonData);
                
            case '.html':
                const htmlContent = await fs.readFile(filePath, 'utf8');
                // Basic HTML tag removal
                return htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                
            case '.csv':
                const csvContent = await fs.readFile(filePath, 'utf8');
                // Convert CSV to readable text
                return csvContent.replace(/,/g, ' | ').replace(/\n/g, '\n');
                
            case '.eml':
            case '.mbox':
                // Basic email content extraction
                const emailContent = await fs.readFile(filePath, 'utf8');
                return this.extractEmailContent(emailContent);
                
            default:
                throw new Error(`Unsupported file type: ${fileExt}`);
        }
    }

    extractTextFromJson(obj, depth = 0) {
        if (depth > 3) return ''; // Prevent deep recursion
        
        let text = '';
        
        if (typeof obj === 'string') {
            text += obj + ' ';
        } else if (typeof obj === 'object' && obj !== null) {
            if (Array.isArray(obj)) {
                for (const item of obj) {
                    text += this.extractTextFromJson(item, depth + 1);
                }
            } else {
                for (const [key, value] of Object.entries(obj)) {
                    // Skip technical fields
                    if (!['id', 'timestamp', 'metadata', '_id', 'created_at'].includes(key)) {
                        text += this.extractTextFromJson(value, depth + 1);
                    }
                }
            }
        }
        
        return text;
    }

    extractEmailContent(emailText) {
        // Extract subject and body from email
        const lines = emailText.split('\n');
        let inBody = false;
        let content = '';
        
        for (const line of lines) {
            if (line.startsWith('Subject:')) {
                content += line.replace('Subject:', '').trim() + '\n';
            } else if (inBody || line.trim() === '') {
                inBody = true;
                if (!line.startsWith('>') && !line.startsWith('From:') && !line.startsWith('Date:')) {
                    content += line + '\n';
                }
            }
        }
        
        return content.trim();
    }

    printSupportedFormats() {
        console.log(chalk.blue('\n📋 Supported File Formats:'));
        console.log(chalk.white('  📝 Text: .txt, .md'));
        console.log(chalk.white('  📊 Data: .json, .csv'));
        console.log(chalk.white('  🌐 Web: .html'));
        console.log(chalk.white('  📧 Email: .eml, .mbox'));
        console.log(chalk.yellow('\n💡 Coming Soon: .pdf, .docx, .xlsx'));
    }

    printSummary() {
        console.log(chalk.blue.bold('\n📊 Document Loading Summary'));
        console.log(chalk.blue('═'.repeat(40)));
        console.log(chalk.cyan(`Files Processed: ${this.stats.filesProcessed}`));
        console.log(chalk.cyan(`Entities Extracted: ${this.stats.entitiesExtracted}`));
        console.log(chalk.cyan(`Total Cost: $${this.stats.totalCost.toFixed(4)}`));
        
        if (this.stats.errors > 0) {
            console.log(chalk.red(`Errors: ${this.stats.errors}`));
        }
        
        if (this.stats.filesProcessed > 0) {
            const avgEntities = (this.stats.entitiesExtracted / this.stats.filesProcessed).toFixed(1);
            const avgCost = (this.stats.totalCost / this.stats.filesProcessed).toFixed(4);
            console.log(chalk.white(`Average per file: ${avgEntities} entities, $${avgCost}`));
        }
        
        console.log(chalk.blue('═'.repeat(40)));
        
        if (this.stats.filesProcessed > 0) {
            console.log(chalk.green('\n✅ Documents loaded successfully!'));
            console.log(chalk.white('Next steps:'));
            console.log(chalk.white('  • npm run viz:start - Launch visualization'));
            console.log(chalk.white('  • npm run analyze:api-usage - Check API costs'));
        }
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const inputPath = process.argv[2];
    const loader = new DocumentLoader();
    loader.loadDocuments(inputPath).catch(console.error);
}

export default DocumentLoader;
