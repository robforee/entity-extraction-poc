#!/usr/bin/env node

/**
 * Debug Enhanced Extraction
 * Simple test to debug the extraction issues
 */

import { EnhancedRelationshipExtractor } from '../src/extractors/enhanced-relationship-extractor.js';
import chalk from 'chalk';

async function main() {
  console.log(chalk.blue('🔍 Debug Enhanced Extraction'));
  console.log(chalk.blue('============================='));
  
  const extractor = new EnhancedRelationshipExtractor({
    provider: 'openai',
    model: 'gpt-4o-mini',
    domain: 'construction'
  });

  const simpleText = `Mike: I'll start the foundation work on Monday.
Rob: Great! Make sure to coordinate with the concrete supplier.`;

  console.log(chalk.yellow('Testing simple text:'));
  console.log(simpleText);
  console.log('');

  try {
    const result = await extractor.extractEntitiesAndRelationships(simpleText, {
      communicationType: 'sms',
      context: 'Simple construction conversation'
    });

    console.log(chalk.green('✅ Extraction completed'));
    console.log('Full result:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error(chalk.red(`❌ Test failed: ${error.message}`));
    console.error(error.stack);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Debug failed:', error);
    process.exit(1);
  });
}
