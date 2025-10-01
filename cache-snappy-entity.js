#!/usr/bin/env node

/**
 * Cache Snappy System Entity
 * 
 * This script caches Snappy's self-documenting metadata as an entity
 * in the Context DB, making it queryable via natural language.
 * 
 * Usage:
 *   node cache-snappy-entity.js
 */

import { DataSourceRouter } from './src/routing/data-source-router.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('🚀 Caching Snappy System Entity...\n');
  
  const router = new DataSourceRouter({
    dataPath: path.join(__dirname, 'data'),
    snappyPath: path.resolve(__dirname, '..', 'snappy')
  });
  
  try {
    const snappyEntity = await router.cacheSnappySystemEntity();
    
    console.log('\n✅ Success! Snappy is now queryable in the Context DB.');
    console.log('\nTry these queries:');
    console.log('  • node context.js query "what are the available snappy commands?"');
    console.log('  • node context.js query "what can snappy do?"');
    console.log('  • node context.js query "show me snappy capabilities"');
    
  } catch (error) {
    console.error('\n❌ Failed to cache Snappy entity:', error.message);
    process.exit(1);
  }
}

main();
