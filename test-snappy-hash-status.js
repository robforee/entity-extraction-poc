#!/usr/bin/env node

/**
 * Test Snappy Hash-Status Integration
 * 
 * Demonstrates the efficient sync pattern using Snappy's hash-status API
 */

import chalk from 'chalk';
import { SnappyHashStatusClient } from './src/integrations/snappy-hash-status-client.js';
import { DataSourceRouter } from './src/routing/data-source-router.js';

async function main() {
  console.log(chalk.blue.bold('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.blue.bold('║   Snappy Hash-Status Integration Test                      ║'));
  console.log(chalk.blue.bold('╚════════════════════════════════════════════════════════════╝\n'));

  const command = process.argv[2] || 'full-sync';

  try {
    if (command === 'full-sync') {
      await testFullSync();
    } else if (command === 'detect-changes') {
      await testDetectChanges();
    } else if (command === 'router-sync') {
      await testRouterSync();
    } else if (command === 'clear-cache') {
      await testClearCache();
    } else if (command === 'stats') {
      await testStats();
    } else {
      showUsage();
    }
  } catch (error) {
    console.error(chalk.red('\n❌ Test failed:'), error.message);
    console.error(chalk.grey(error.stack));
    process.exit(1);
  }
}

/**
 * Test 1: Full sync workflow
 */
async function testFullSync() {
  console.log(chalk.cyan.bold('Test 1: Full Sync Workflow\n'));
  
  const client = new SnappyHashStatusClient();
  const result = await client.performFullSync();
  
  console.log(chalk.green.bold('\n📊 Sync Results:'));
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Test 2: Change detection only
 */
async function testDetectChanges() {
  console.log(chalk.cyan.bold('Test 2: Change Detection\n'));
  
  const client = new SnappyHashStatusClient();
  await client.initialize();
  
  const changes = await client.detectChanges();
  
  console.log(chalk.green.bold('\n📊 Detected Changes:'));
  console.log(JSON.stringify(changes, null, 2));
  
  if (changes.hasChanges) {
    console.log(chalk.yellow('\n⚠️  Changes detected! Run "full-sync" to synchronize.'));
  } else {
    console.log(chalk.green('\n✅ No changes detected - system is up to date.'));
  }
}

/**
 * Test 3: Router integration
 */
async function testRouterSync() {
  console.log(chalk.cyan.bold('Test 3: DataSourceRouter Integration\n'));
  
  const router = new DataSourceRouter();
  
  // Check sync status
  console.log(chalk.blue('Checking sync status...'));
  const status = await router.checkSnappySyncStatus();
  
  console.log(chalk.green.bold('\n📊 Sync Status:'));
  console.log(JSON.stringify(status, null, 2));
  
  if (status.needsSync) {
    console.log(chalk.yellow('\n⚠️  Sync needed - performing sync...'));
    const syncResult = await router.syncSnappyData();
    
    console.log(chalk.green.bold('\n📊 Sync Result:'));
    console.log(JSON.stringify(syncResult, null, 2));
  } else {
    console.log(chalk.green('\n✅ No sync needed - data is current.'));
  }
}

/**
 * Test 4: Clear cache
 */
async function testClearCache() {
  console.log(chalk.cyan.bold('Test 4: Clear Cache\n'));
  
  const client = new SnappyHashStatusClient();
  await client.initialize();
  await client.clearCache();
  
  console.log(chalk.green('✅ Cache cleared successfully'));
  console.log(chalk.yellow('\nNext sync will perform a full data fetch.'));
}

/**
 * Test 5: Show statistics
 */
async function testStats() {
  console.log(chalk.cyan.bold('Test 5: Sync Statistics\n'));
  
  const client = new SnappyHashStatusClient();
  await client.initialize();
  
  const stats = client.getSyncStats();
  
  console.log(chalk.green.bold('📊 Sync Statistics:'));
  console.log(`  Last Update: ${stats.lastUpdate ? new Date(stats.lastUpdate).toLocaleString() : 'Never'}`);
  console.log(`  Cached Projects: ${stats.cachedProjects}`);
  console.log(`  Cached Structures: ${stats.cachedStructures}`);
  console.log(`  Cache Size: ${(stats.cacheSize / 1024).toFixed(2)} KB`);
  
  // Get available commands
  console.log(chalk.green.bold('\n⚙️  Available Snappy Commands:'));
  const commands = await client.getAvailableCommands();
  
  for (const [groupName, group] of Object.entries(commands)) {
    console.log(chalk.cyan(`\n${group.description || groupName}:`));
    if (group.commands) {
      group.commands.forEach(cmd => {
        console.log(`  • ${cmd.name}: ${cmd.description}`);
        console.log(chalk.grey(`    Usage: ${cmd.usage}`));
      });
    }
  }
  
  // Get project type structures
  console.log(chalk.green.bold('\n🏗️  Project Type Structures:'));
  const structures = await client.getProjectTypeStructures();
  
  for (const [typeName, typeInfo] of Object.entries(structures)) {
    console.log(chalk.cyan(`\n${typeName}:`));
    console.log(chalk.grey(`  Hash: ${typeInfo.hash}`));
    console.log(chalk.grey(`  More: ${typeInfo.more}`));
  }
}

/**
 * Show usage information
 */
function showUsage() {
  console.log(chalk.yellow('Usage: node test-snappy-hash-status.js [command]\n'));
  console.log(chalk.cyan('Available commands:'));
  console.log('  full-sync        - Perform full sync with change detection (default)');
  console.log('  detect-changes   - Only detect changes, don\'t sync');
  console.log('  router-sync      - Test DataSourceRouter integration');
  console.log('  clear-cache      - Clear cached hashes (force full resync)');
  console.log('  stats            - Show sync statistics and available commands');
  console.log('');
  console.log(chalk.grey('Examples:'));
  console.log(chalk.grey('  node test-snappy-hash-status.js full-sync'));
  console.log(chalk.grey('  node test-snappy-hash-status.js detect-changes'));
  console.log(chalk.grey('  node test-snappy-hash-status.js stats'));
}

// Run the main function
main().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
