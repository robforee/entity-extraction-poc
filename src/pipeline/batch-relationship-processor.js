/**
 * Batch Relationship Processing Pipeline
 * 
 * Processes existing documents and conversations to extract relationships
 * using the enhanced relationship extractor, then applies them to existing entities.
 */

import fs from 'fs';
import path from 'path';
import { EnhancedRelationshipExtractor } from '../extractors/enhanced-relationship-extractor.js';
import { EntitySchema } from '../relationships/entity-schema.js';
import chalk from 'chalk';

const fsPromises = fs.promises;

class BatchRelationshipProcessor {
  constructor(options = {}) {
    this.dataPath = options.dataPath || path.join(process.cwd(), 'data');
    this.extractor = new EnhancedRelationshipExtractor({
      provider: options.provider || 'openai',
      model: options.model || 'gpt-4o-mini',
      domain: options.domain || 'construction'
    });
    this.batchSize = options.batchSize || 5;
    this.delayBetweenBatches = options.delayBetweenBatches || 2000; // 2 seconds
    this.maxCostPerBatch = options.maxCostPerBatch || 1.0; // $1 per batch
  }

  /**
   * Process all documents in a domain
   */
  async processDomain(domain, options = {}) {
    const {
      dryRun = false,
      skipExisting = true,
      reprocessAll = false
    } = options;

    console.log(chalk.blue(`🔄 Batch Processing Domain: ${domain}`));
    console.log(chalk.blue('====================================='));
    
    const domainPath = path.join(this.dataPath, domain);
    const results = {
      totalDocuments: 0,
      processedDocuments: 0,
      enhancedEntities: 0,
      relationshipsAdded: 0,
      errors: [],
      totalCost: 0
    };

    try {
      // Find conversation documents
      const conversationsPath = path.join(domainPath, 'conversations');
      const documents = await this.findDocuments(conversationsPath);
      results.totalDocuments = documents.length;

      console.log(`📄 Found ${documents.length} documents to process`);

      // Process in batches
      const batches = this.createBatches(documents, this.batchSize);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(chalk.yellow(`\n📦 Processing Batch ${i + 1}/${batches.length} (${batch.length} documents)`));
        
        const batchResults = await this.processBatch(batch, domain, { dryRun, skipExisting, reprocessAll });
        
        // Aggregate results
        results.processedDocuments += batchResults.processedDocuments;
        results.enhancedEntities += batchResults.enhancedEntities;
        results.relationshipsAdded += batchResults.relationshipsAdded;
        results.totalCost += batchResults.totalCost;
        results.errors.push(...batchResults.errors);

        // Check cost limits
        if (results.totalCost > this.maxCostPerBatch * (i + 1)) {
          console.warn(chalk.yellow(`⚠️  Cost limit reached for batch ${i + 1}: $${results.totalCost.toFixed(4)}`));
          break;
        }

        // Delay between batches to avoid rate limits
        if (i < batches.length - 1) {
          console.log(chalk.gray(`⏳ Waiting ${this.delayBetweenBatches}ms before next batch...`));
          await new Promise(resolve => setTimeout(resolve, this.delayBetweenBatches));
        }
      }

      // Summary
      console.log(chalk.green(`\n✅ Batch Processing Complete`));
      console.log(`📊 Results:`);
      console.log(`   - Documents processed: ${results.processedDocuments}/${results.totalDocuments}`);
      console.log(`   - Entities enhanced: ${results.enhancedEntities}`);
      console.log(`   - Relationships added: ${results.relationshipsAdded}`);
      console.log(`   - Total cost: $${results.totalCost.toFixed(4)}`);
      console.log(`   - Errors: ${results.errors.length}`);

      if (results.errors.length > 0) {
        console.log(chalk.red(`\n❌ Errors encountered:`));
        results.errors.slice(0, 5).forEach((error, index) => {
          console.log(`   ${index + 1}. ${error}`);
        });
        if (results.errors.length > 5) {
          console.log(`   ... and ${results.errors.length - 5} more errors`);
        }
      }

    } catch (error) {
      console.error(chalk.red(`❌ Batch processing failed: ${error.message}`));
      results.errors.push(error.message);
    }

    return results;
  }

  /**
   * Find conversation documents to process
   */
  async findDocuments(conversationsPath) {
    const documents = [];
    
    try {
      const files = await fsPromises.readdir(conversationsPath);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(conversationsPath, file);
          const stats = await fsPromises.stat(filePath);
          
          documents.push({
            path: filePath,
            name: file,
            size: stats.size,
            modified: stats.mtime
          });
        }
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Could not read conversations directory: ${error.message}`));
    }

    return documents.sort((a, b) => b.modified - a.modified); // Process newest first
  }

  /**
   * Create batches from documents
   */
  createBatches(documents, batchSize) {
    const batches = [];
    for (let i = 0; i < documents.length; i += batchSize) {
      batches.push(documents.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Process a batch of documents
   */
  async processBatch(batch, domain, options) {
    const results = {
      processedDocuments: 0,
      enhancedEntities: 0,
      relationshipsAdded: 0,
      totalCost: 0,
      errors: []
    };

    for (const doc of batch) {
      try {
        console.log(chalk.gray(`  📄 Processing: ${doc.name}`));
        
        const docResults = await this.processDocument(doc, domain, options);
        
        results.processedDocuments++;
        results.enhancedEntities += docResults.enhancedEntities;
        results.relationshipsAdded += docResults.relationshipsAdded;
        results.totalCost += docResults.cost;

        console.log(chalk.green(`    ✅ ${docResults.relationshipsAdded} relationships added`));

      } catch (error) {
        console.error(chalk.red(`    ❌ Failed: ${error.message}`));
        results.errors.push(`${doc.name}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Process a single document
   */
  async processDocument(doc, domain, options) {
    const { dryRun, skipExisting, reprocessAll } = options;
    
    // Load conversation document
    const content = await fsPromises.readFile(doc.path, 'utf8');
    const conversation = JSON.parse(content);

    // Check if already processed (has relationships)
    if (skipExisting && !reprocessAll && this.hasRelationships(conversation)) {
      return {
        enhancedEntities: 0,
        relationshipsAdded: 0,
        cost: 0
      };
    }

    // Extract text content for processing
    const textContent = this.extractTextContent(conversation);
    if (!textContent || textContent.length < 50) {
      throw new Error('Insufficient text content for processing');
    }

    // Extract relationships using enhanced extractor
    const extractionResult = await this.extractor.extractEntitiesAndRelationships(textContent, {
      communicationType: this.inferCommunicationType(conversation),
      context: `${domain} domain conversation processing`,
      domain: domain
    });

    if (!dryRun) {
      // Apply relationships to existing entities
      const enhancedResults = await this.applyRelationshipsToEntities(
        extractionResult, 
        conversation, 
        domain
      );

      // Save updated conversation
      await this.saveUpdatedConversation(doc.path, conversation, extractionResult);

      return {
        enhancedEntities: enhancedResults.enhancedEntities,
        relationshipsAdded: enhancedResults.relationshipsAdded,
        cost: extractionResult.metadata.cost || 0
      };
    }

    return {
      enhancedEntities: 1,
      relationshipsAdded: extractionResult.relationships.length,
      cost: extractionResult.metadata.cost || 0
    };
  }

  /**
   * Check if conversation already has relationships
   */
  hasRelationships(conversation) {
    if (conversation.relationships && conversation.relationships.length > 0) {
      return true;
    }
    
    if (conversation.entities && Array.isArray(conversation.entities)) {
      return conversation.entities.some(entity => 
        entity.relationships && entity.relationships.length > 0
      );
    }

    return false;
  }

  /**
   * Extract text content from conversation
   */
  extractTextContent(conversation) {
    let text = '';

    // Try different conversation formats
    if (conversation.messages && Array.isArray(conversation.messages)) {
      text = conversation.messages
        .map(msg => `${msg.sender || 'User'}: ${msg.content || msg.text || ''}`)
        .join('\n');
    } else if (conversation.content) {
      text = conversation.content;
    } else if (conversation.text) {
      text = conversation.text;
    } else if (typeof conversation === 'string') {
      text = conversation;
    }

    return text.trim();
  }

  /**
   * Infer communication type from conversation structure
   */
  inferCommunicationType(conversation) {
    if (conversation.type) {
      return conversation.type;
    }
    
    if (conversation.messages && conversation.messages.length > 0) {
      const firstMessage = conversation.messages[0];
      if (firstMessage.sender && firstMessage.content) {
        return 'sms';
      }
    }

    if (conversation.subject) {
      return 'email';
    }

    return 'text';
  }

  /**
   * Apply extracted relationships to existing entities
   */
  async applyRelationshipsToEntities(extractionResult, conversation, domain) {
    let enhancedEntities = 0;
    let relationshipsAdded = 0;

    // Find or create entities in the conversation
    if (!conversation.entities) {
      conversation.entities = [];
    }

    // Create enhanced entity if needed
    if (conversation.entities.length === 0) {
      const enhancedEntity = await this.extractor.createEnhancedEntity(
        extractionResult,
        conversation.id || `conv_${Date.now()}`,
        conversation.userId || 'batch_processor',
        domain
      );
      
      conversation.entities.push(enhancedEntity);
      enhancedEntities++;
      relationshipsAdded += enhancedEntity.relationships?.length || 0;
    } else {
      // Add relationships to existing entities
      for (const entity of conversation.entities) {
        for (const rel of extractionResult.relationships) {
          try {
            EntitySchema.addRelationship(entity, {
              type: rel.type,
              target: rel.target,
              confidence: rel.confidence,
              source: 'batch_processing',
              metadata: rel.metadata
            });
            relationshipsAdded++;
          } catch (error) {
            // Skip duplicate or invalid relationships
          }
        }
        
        if (entity.relationships && entity.relationships.length > 0) {
          enhancedEntities++;
        }
      }
    }

    return { enhancedEntities, relationshipsAdded };
  }

  /**
   * Save updated conversation with relationships
   */
  async saveUpdatedConversation(filePath, conversation, extractionResult) {
    // Add processing metadata
    if (!conversation.metadata) {
      conversation.metadata = {};
    }
    
    conversation.metadata.relationshipProcessing = {
      processedAt: new Date().toISOString(),
      relationshipsExtracted: extractionResult.relationships.length,
      extractionModel: extractionResult.metadata.model,
      extractionProvider: extractionResult.metadata.provider
    };

    // Save updated conversation
    await fsPromises.writeFile(filePath, JSON.stringify(conversation, null, 2));
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(domain) {
    const domainPath = path.join(this.dataPath, domain);
    const conversationsPath = path.join(domainPath, 'conversations');
    
    try {
      const documents = await this.findDocuments(conversationsPath);
      let processedCount = 0;
      let totalRelationships = 0;

      for (const doc of documents) {
        try {
          const content = await fsPromises.readFile(doc.path, 'utf8');
          const conversation = JSON.parse(content);
          
          if (this.hasRelationships(conversation)) {
            processedCount++;
            
            // Count relationships
            if (conversation.entities) {
              for (const entity of conversation.entities) {
                if (entity.relationships) {
                  totalRelationships += entity.relationships.length;
                }
              }
            }
          }
        } catch (error) {
          // Skip invalid files
        }
      }

      return {
        totalDocuments: documents.length,
        processedDocuments: processedCount,
        unprocessedDocuments: documents.length - processedCount,
        totalRelationships,
        processingRate: documents.length > 0 ? (processedCount / documents.length) * 100 : 0
      };

    } catch (error) {
      return {
        totalDocuments: 0,
        processedDocuments: 0,
        unprocessedDocuments: 0,
        totalRelationships: 0,
        processingRate: 0,
        error: error.message
      };
    }
  }
}

export { BatchRelationshipProcessor };
