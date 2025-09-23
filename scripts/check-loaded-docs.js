#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

/**
 * Check what documents have been loaded into the system
 */
async function checkLoadedDocuments() {
    const entitiesDir = path.join(process.cwd(), 'data/mock-diffmem/entities');
    
    try {
        const files = await fs.readdir(entitiesDir);
        const documents = [];
        
        console.log(chalk.blue.bold('📚 Checking loaded documents...\n'));
        
        for (const file of files) {
            if (file.endsWith('.json')) {
                try {
                    const filePath = path.join(entitiesDir, file);
                    const data = await fs.readJson(filePath);
                    
                    // Extract document info from different possible locations
                    let docInfo = null;
                    
                    if (data.entities && data.entities.source) {
                        docInfo = {
                            source: data.entities.source,
                            messageId: data.entities.messageId,
                            timestamp: data.timestamp,
                            entityFile: file
                        };
                    } else if (data.metadata && data.metadata.source) {
                        docInfo = {
                            source: data.metadata.source,
                            messageId: data.metadata.messageId,
                            timestamp: data.timestamp,
                            entityFile: file
                        };
                    }
                    
                    if (docInfo) {
                        documents.push(docInfo);
                    }
                } catch (error) {
                    console.warn(chalk.yellow(`⚠️  Could not read: ${file}`));
                }
            }
        }
        
        // Sort by timestamp (most recent first)
        documents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        console.log(chalk.green(`Found ${documents.length} loaded documents:\n`));
        
        documents.forEach((doc, index) => {
            const fileName = path.basename(doc.source);
            const timestamp = new Date(doc.timestamp).toLocaleString();
            const isCybersec = doc.source.includes('cybersec-dogfood');
            
            console.log(chalk.white(`${index + 1}. ${fileName}`));
            console.log(chalk.gray(`   Source: ${doc.source}`));
            console.log(chalk.gray(`   Loaded: ${timestamp}`));
            console.log(chalk.gray(`   Entity File: ${doc.entityFile}`));
            if (isCybersec) {
                console.log(chalk.green('   🔒 CYBERSECURITY DOCUMENT'));
            }
            console.log('');
        });
        
        // Show summary
        const cybersecDocs = documents.filter(doc => doc.source.includes('cybersec-dogfood'));
        console.log(chalk.blue.bold('📊 Summary:'));
        console.log(chalk.white(`Total documents: ${documents.length}`));
        console.log(chalk.green(`Cybersecurity documents: ${cybersecDocs.length}`));
        console.log(chalk.gray(`Other documents: ${documents.length - cybersecDocs.length}`));
        
        if (cybersecDocs.length > 0) {
            console.log(chalk.green.bold('\n✅ Your cybersecurity documents are loaded!'));
            console.log(chalk.white('Recent cybersecurity documents:'));
            cybersecDocs.slice(0, 5).forEach(doc => {
                console.log(chalk.green(`  • ${path.basename(doc.source)}`));
            });
        }
        
    } catch (error) {
        console.error(chalk.red('❌ Error checking documents:'), error.message);
    }
}

checkLoadedDocuments();
