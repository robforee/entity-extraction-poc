#!/usr/bin/env node

/**
 * Batch Relationship Processing Script
 * 
 * Command-line interface for processing existing documents to extract relationships
 * using the enhanced relationship extractor.
 */

import { BatchRelationshipProcessor } from '../src/pipeline/batch-relationship-processor.js';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function printUsage() {
  console.log(chalk.blue('📚 Batch Relationship Processing'));
  console.log(chalk.blue('================================'));
  console.log('');
  console.log('Usage: node batch-process-relationships.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --domain <domain>     Domain to process (cybersec, construction, default)');
  console.log('  --provider <provider> LLM provider (openai, anthropic, openrouter)');
  console.log('  --model <model>       LLM model to use');
  console.log('  --batch-size <size>   Number of documents per batch (default: 5)');
  console.log('  --dry-run             Show what would be processed without making changes');
  console.log('  --reprocess-all       Reprocess documents even if they have relationships');
  console.log('  --stats               Show processing statistics only');
  console.log('  --max-cost <amount>   Maximum cost per batch in USD (default: 1.0)');
  console.log('  --help                Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  node batch-process-relationships.js --domain cybersec --dry-run');
  console.log('  node batch-process-relationships.js --domain construction --batch-size 3');
  console.log('  node batch-process-relationships.js --stats --domain cybersec');
}

async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  const options = {
    domain: 'cybersec',
    provider: 'openai',
    model: 'gpt-4o-mini',
    batchSize: 5,
    dryRun: false,
    reprocessAll: false,
    statsOnly: false,
    maxCostPerBatch: 1.0
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--domain':
        options.domain = args[++i];
        break;
      case '--provider':
        options.provider = args[++i];
        break;
      case '--model':
        options.model = args[++i];
        break;
      case '--batch-size':
        options.batchSize = parseInt(args[++i]);
        break;
      case '--max-cost':
        options.maxCostPerBatch = parseFloat(args[++i]);
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--reprocess-all':
        options.reprocessAll = true;
        break;
      case '--stats':
        options.statsOnly = true;
        break;
      case '--help':
        printUsage();
        return;
      default:
        console.error(chalk.red(`Unknown option: ${args[i]}`));
        printUsage();
        process.exit(1);
    }
  }

  console.log(chalk.blue.bold('🔄 Batch Relationship Processing'));
  console.log(chalk.blue.bold('================================='));
  console.log(`Domain: ${options.domain}`);
  console.log(`Provider: ${options.provider}:${options.model}`);
  console.log(`Batch Size: ${options.batchSize}`);
  console.log(`Max Cost: $${options.maxCostPerBatch}`);
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE PROCESSING'}`);
  console.log('');

  try {
    const dataPath = path.join(__dirname, '..', 'data');
    const processor = new BatchRelationshipProcessor({
      dataPath,
      provider: options.provider,
      model: options.model,
      domain: options.domain,
      batchSize: options.batchSize,
      maxCostPerBatch: options.maxCostPerBatch
    });

    if (options.statsOnly) {
      // Show statistics only
      console.log(chalk.yellow('📊 Processing Statistics'));
      console.log(chalk.yellow('========================'));
      
      const stats = await processor.getProcessingStats(options.domain);
      
      console.log(`Total Documents: ${stats.totalDocuments}`);
      console.log(`Processed Documents: ${stats.processedDocuments}`);
      console.log(`Unprocessed Documents: ${stats.unprocessedDocuments}`);
      console.log(`Total Relationships: ${stats.totalRelationships}`);
      console.log(`Processing Rate: ${stats.processingRate.toFixed(1)}%`);
      
      if (stats.error) {
        console.error(chalk.red(`Error: ${stats.error}`));
      }
      
      if (stats.unprocessedDocuments > 0) {
        console.log(chalk.blue(`\n💡 Run without --stats to process ${stats.unprocessedDocuments} remaining documents`));
      } else {
        console.log(chalk.green(`\n✅ All documents in ${options.domain} domain have been processed`));
      }
      
      return;
    }

    // Run batch processing
    const results = await processor.processDomain(options.domain, {
      dryRun: options.dryRun,
      skipExisting: !options.reprocessAll,
      reprocessAll: options.reprocessAll
    });

    // Final summary
    console.log(chalk.green.bold('\n🎉 Batch Processing Summary'));
    console.log(chalk.green.bold('============================'));
    console.log(`✅ Success Rate: ${results.processedDocuments}/${results.totalDocuments} documents`);
    console.log(`🔗 Relationships Added: ${results.relationshipsAdded}`);
    console.log(`🏷️  Entities Enhanced: ${results.enhancedEntities}`);
    console.log(`💰 Total Cost: $${results.totalCost.toFixed(4)}`);
    
    if (results.errors.length > 0) {
      console.log(`❌ Errors: ${results.errors.length}`);
    }

    if (options.dryRun) {
      console.log(chalk.blue('\n💡 This was a dry run. Run without --dry-run to apply changes.'));
    } else {
      console.log(chalk.green('\n✨ Processing complete! Relationships have been added to entities.'));
    }

  } catch (error) {
    console.error(chalk.red(`❌ Batch processing failed: ${error.message}`));
    
    if (error.message.includes('cost limit')) {
      console.log(chalk.yellow('💡 Tip: Adjust --max-cost or check your API usage'));
    } else if (error.message.includes('API key')) {
      console.log(chalk.yellow('💡 Tip: Check your API keys in .env file'));
    }
    
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

export { main };
