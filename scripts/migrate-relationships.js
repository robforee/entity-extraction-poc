#!/usr/bin/env node

/**
 * Relationship Migration Script
 * 
 * Converts existing merge pairs to semantic relationships
 * Usage: node scripts/migrate-relationships.js [options]
 */

import path from 'path';
import { MigrationUtility } from '../src/relationships/migration-utility.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  let domain = null;
  let dryRun = false;
  let backup = true;
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--domain':
        domain = args[i + 1];
        i++;
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--no-backup':
        backup = false;
        break;
      case '--help':
        showHelp();
        return;
      default:
        if (arg.startsWith('--')) {
          console.error(`Unknown option: ${arg}`);
          showHelp();
          process.exit(1);
        }
    }
  }
  
  // Validate domain
  if (domain && !['construction', 'cybersec', 'default'].includes(domain)) {
    console.error(`Invalid domain: ${domain}. Must be one of: construction, cybersec, default`);
    process.exit(1);
  }
  
  const dataPath = path.join(__dirname, '..', 'data');
  const migrationUtility = new MigrationUtility(dataPath);
  
  console.log('🔄 Entity Relationship Migration');
  console.log('================================');
  console.log(`Data path: ${dataPath}`);
  console.log(`Domain: ${domain || 'all'}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Backup: ${backup ? 'enabled' : 'disabled'}`);
  console.log('');
  
  try {
    // Create backup if not dry run and backup enabled
    if (!dryRun && backup) {
      console.log('Creating backup...');
      const domains = domain ? [domain] : ['construction', 'cybersec', 'default'];
      for (const d of domains) {
        try {
          await migrationUtility.createBackup(d);
        } catch (error) {
          console.warn(`Could not create backup for ${d}:`, error.message);
        }
      }
      console.log('');
    }
    
    // Run migration
    const results = await migrationUtility.migrate(domain, dryRun);
    
    // Show summary
    console.log('\n📊 Migration Summary');
    console.log('===================');
    console.log(`✅ Success: ${results.migratedEntities}/${results.totalEntities} entities enhanced`);
    console.log(`🔗 Relationships created: ${results.relationshipsCreated}`);
    
    if (results.errors.length > 0) {
      console.log(`❌ Errors: ${results.errors.length}`);
      console.log('\nError details:');
      results.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }
    
    if (dryRun) {
      console.log('\n💡 This was a dry run. No files were modified.');
      console.log('   Run without --dry-run to apply changes.');
    } else {
      console.log('\n✨ Migration completed successfully!');
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
🔄 Entity Relationship Migration Script

USAGE:
  node scripts/migrate-relationships.js [options]

OPTIONS:
  --domain <name>     Migrate specific domain only (construction, cybersec, default)
  --dry-run          Show what would be changed without modifying files
  --no-backup        Skip creating backup before migration
  --help             Show this help message

EXAMPLES:
  # Dry run migration for all domains
  node scripts/migrate-relationships.js --dry-run
  
  # Migrate cybersec domain only
  node scripts/migrate-relationships.js --domain cybersec
  
  # Migrate all domains without backup
  node scripts/migrate-relationships.js --no-backup

DESCRIPTION:
  This script converts existing merge pairs (co-occurrence relationships) into
  semantic relationships with proper types, confidence scores, and metadata.
  
  The migration process:
  1. Loads existing entities and merge pairs
  2. Analyzes entity content to infer relationship types
  3. Creates semantic relationships based on domain knowledge
  4. Enhances entity schema with relationship support
  5. Saves updated entities with new relationship data

  Relationship types include:
  - Universal: manages, uses, located_at, owns, etc.
  - Cybersec: monitors, protects, integrates_with, etc.
  - Construction: requires, installed_in, supplies, etc.
`);
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

export { main };
