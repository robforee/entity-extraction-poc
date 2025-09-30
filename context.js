#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import yargs from 'yargs';
import { DataSourceRouter } from './src/routing/data-source-router.js';

class ContextCLI {
  constructor() {
    this.dataPath = path.join(process.cwd(), 'data');
    this.router = null;
    this.outputOptions = {
      format: null,
      debug: false,
      suppressMessages: false
    };
  }

  setOutputOptions(options = {}) {
    this.outputOptions = {
      format: options.format || null,
      debug: options.debug || false,
      suppressMessages: options.format === 'json' || (!options.debug && options.format !== 'json')
    };
  }

  log(message, type = 'info') {
    if (this.outputOptions.suppressMessages && !this.outputOptions.debug) {
      return;
    }
    
    switch (type) {
      case 'success':
        console.log(chalk.green(message));
        break;
      case 'error':
        console.error(chalk.red(message));
        break;
      case 'warning':
        console.warn(chalk.yellow(message));
        break;
      case 'info':
      default:
        console.log(message);
        break;
    }
  }

  async initialize() {
    try {
      // Initialize the Smart Router
      const { DataSourceRouter } = await import('./src/routing/data-source-router.js');
      this.router = new DataSourceRouter();
      
      this.log('✅ Context CLI initialized successfully', 'success');
    } catch (error) {
      // Always show initialization errors
      console.error(chalk.red('❌ Failed to initialize Context CLI:'), error.message);
      process.exit(1);
    }
  }

  async handleSyncCommand(source, options = {}) {
    console.log(chalk.blue.bold(`\n🔄 Syncing from ${source}...`));
    console.log(chalk.blue('='.repeat(60)));

    try {
      if (source === 'snappy') {
        // Use the hash-status client for efficient sync
        const syncResult = await this.router.syncSnappyData();
        
        console.log(chalk.green.bold('\n✅ Sync completed successfully!'));
        console.log(chalk.cyan('\n📊 Sync Summary:'));
        console.log(`  Duration: ${syncResult.duration}ms`);
        console.log(`  Sections synced: ${syncResult.syncResults.synced}`);
        console.log(`  Sections skipped: ${syncResult.syncResults.skipped}`);
        
        if (syncResult.syncResults.details?.data?.projects) {
          const projects = syncResult.syncResults.details.data.projects;
          console.log(`  Projects synced: ${projects.filter(p => p.status === 'synced').length}`);
          console.log(`  Projects unchanged: ${syncResult.syncResults.details.data.unchanged || 0}`);
        }
        
        // Show final entity count
        await this.listAllDomains();
      } else {
        console.log(chalk.red(`❌ Unknown sync source: ${source}`));
        console.log(chalk.yellow('Available sources: snappy'));
      }
    } catch (error) {
      console.error(chalk.red(`❌ Sync failed: ${error.message}`));
      if (options.debug) {
        console.error(chalk.grey(error.stack));
      }
    }
  }

  async handleClearCommand(domain, confirm) {
    if (!confirm) {
      console.log(chalk.red('Please confirm with --confirm'));
      return;
    }
    console.log(chalk.blue.bold(`\n🗑️  Clear Context Database: ${domain}`));
    console.log(chalk.blue('='.repeat(40)));

    const domainPath = path.join(this.dataPath, domain);
    const backupPath = path.join(this.dataPath, `backup-${domain}-${new Date().toISOString().replace(/:/g, '-')}`);

    try {
      if (await fs.pathExists(domainPath)) {
        console.log('📦 Creating backup...');
        await fs.copy(domainPath, backupPath);
        console.log(chalk.green(`✅ Backed up ${domain} to ${backupPath}`));
        await fs.remove(domainPath);
        console.log(chalk.green(`✅ Cleared ${domain} domain`));
      } else {
        console.log(chalk.yellow(`⚠️  Domain ${domain} not found, nothing to clear.`));
      }

      await fs.mkdirp(path.join(domainPath, 'entities'));
      console.log(chalk.green(`📁 Recreated directory structure for ${domain}`));
      console.log(chalk.green('\n🎉 Context database cleared successfully!'));
    } catch (error) {
      console.error(chalk.red(`❌ Error clearing context database: ${error.message}`));
    }
  }

  async handleShowCommand(entityName) {
    if (!entityName) {
      // List all entities
      await this.listAllEntities();
      return;
    }

    console.log(chalk.blue.bold(`\nℹ️  Showing details for: "${entityName}"`));
    console.log(chalk.blue('='.repeat(60)));

    try {
      let entityData = null;
      const domains = ['construction', 'system'];

      for (const domain of domains) {
        const domainPath = path.join(this.dataPath, domain, 'entities');
        if (!await fs.pathExists(domainPath)) continue;

        const entityTypes = await fs.readdir(domainPath);
        for (const type of entityTypes) {
          const foundEntity = await this.findEntityByName(entityName, type, domain);
          if (foundEntity) {
            entityData = foundEntity;
            break;
          }
        }
        if (entityData) break;
      }

      if (entityData) {
        console.log(`\nEntity: ${chalk.bold(entityData.name)}`);
        console.log(`  - Type: ${entityData.type}`);
        console.log(`  - Domain: ${entityData.domain}`);
        console.log(`  - Source: ${entityData.source}`);

        if (entityData.data && entityData.type === 'command_execution') {
          console.log(chalk.cyan('\n  Details:'));
          console.log(`    • Command: ${entityData.data.command}`);
          console.log(`    • Timestamp: ${entityData.data.timestamp}`);
        }

        if (entityData.relationships && entityData.relationships.length > 0) {
          console.log(chalk.cyan('\n  Relationships:'));
          for (const rel of entityData.relationships) {
            const relatedDomain = rel.target_type === 'command_execution' ? 'system' : 'construction';
            const relatedEntity = await this.findEntityByName(rel.target, rel.target_type, relatedDomain);
            if (relatedEntity) {
              let detail = relatedEntity.name;
              if (relatedEntity.type === 'command_execution') {
                detail = relatedEntity.data.command;
              }
              console.log(`    • ${chalk.bold(rel.type)} → ${chalk.green(detail)} (${rel.target_type})`);
            } else {
              console.log(`    • ${chalk.bold(rel.type)} → ${chalk.yellow(rel.target)} (${rel.target_type}) - Not Found`);
            }
          }
        } else {
          console.log(chalk.cyan('\n  No relationships found.'));
        }
      } else {
        console.log(chalk.red(`❌ Entity "${entityName}" not found in the context database.`));
      }
    } catch (error) {
      console.error(chalk.red(`❌ Error showing entity: ${error.message}`));
    }
  }

  async listAllEntities() {
    console.log(chalk.blue.bold('\n📋 Context Database Entities'));
    console.log(chalk.blue('='.repeat(60)));

    try {
      const domains = ['construction', 'system'];
      let totalEntities = 0;

      for (const domain of domains) {
        const domainPath = path.join(this.dataPath, domain, 'entities');
        if (!await fs.pathExists(domainPath)) continue;

        const entityTypes = await fs.readdir(domainPath);
        for (const type of entityTypes) {
          const typePath = path.join(domainPath, type);
          if (!await fs.pathExists(typePath)) continue;

          const entityFiles = await fs.readdir(typePath);
          for (const file of entityFiles) {
            if (!file.endsWith('.json')) continue;

            try {
              const entityData = JSON.parse(await fs.readFile(path.join(typePath, file), 'utf-8'));
              totalEntities++;

              // Format relationships as comma-separated list
              let relationshipsList = 'none';
              if (entityData.relationships && entityData.relationships.length > 0) {
                relationshipsList = entityData.relationships
                  .map(rel => `${rel.type}:${rel.target}`)
                  .join(', ');
              }

              console.log(`${chalk.bold(entityData.name)} (${chalk.cyan(entityData.type)}) - ${chalk.grey(relationshipsList)}`);
            } catch (parseError) {
              console.warn(chalk.yellow(`⚠️  Failed to parse ${file}: ${parseError.message}`));
            }
          }
        }
      }

      if (totalEntities === 0) {
        console.log(chalk.yellow('\n📭 No entities found in the context database.'));
      } else {
        console.log(chalk.green(`\n✅ Found ${totalEntities} entities total`));
      }
    } catch (error) {
      console.error(chalk.red(`❌ Error listing entities: ${error.message}`));
    }
  }

  async handleDatabaseDomainsCommand(domainName, action, entityName, options = {}) {
    if (!domainName) {
      // List all domains
      await this.listAllDomains();
      return;
    }

    if (action === 'entities') {
      if (entityName) {
        // Show specific entity details within domain
        await this.showDomainEntityDetails(domainName, entityName, options);
        return;
      }
      // Show entities for specific domain
      await this.showDomainEntities(domainName, options);
      return;
    }

    if (action === 'relations') {
      // Show relationship counts for domain
      await this.showDomainRelations(domainName, options);
      return;
    }

    // Show details for specific domain
    await this.showDomainDetails(domainName);
  }

  async listAllDomains() {
    console.log(chalk.blue.bold('\n🗂️  Context Database Domains'));
    console.log(chalk.blue('='.repeat(60)));

    try {
      const dataDir = this.dataPath;
      if (!await fs.pathExists(dataDir)) {
        console.log(chalk.yellow('\n📭 No data directory found.'));
        return;
      }

      const items = await fs.readdir(dataDir);
      const domains = [];

      for (const item of items) {
        const itemPath = path.join(dataDir, item);
        const stat = await fs.stat(itemPath);
        
        if (stat.isDirectory() && !item.startsWith('backup-') && !item.startsWith('.')) {
          const entitiesPath = path.join(itemPath, 'entities');
          if (await fs.pathExists(entitiesPath)) {
            // Count entities in this domain
            let entityCount = 0;
            const entityTypes = await fs.readdir(entitiesPath);
            
            for (const type of entityTypes) {
              const typePath = path.join(entitiesPath, type);
              if ((await fs.stat(typePath)).isDirectory()) {
                const entityFiles = await fs.readdir(typePath);
                entityCount += entityFiles.filter(file => file.endsWith('.json')).length;
              }
            }

            domains.push({ name: item, entityCount });
          }
        }
      }

      if (domains.length === 0) {
        console.log(chalk.yellow('\n📭 No domains found in the context database.'));
      } else {
        domains.sort((a, b) => a.name.localeCompare(b.name));
        for (const domain of domains) {
          console.log(`${chalk.bold(domain.name)} - ${chalk.cyan(domain.entityCount)} entities`);
        }
        console.log(chalk.green(`\n✅ Found ${domains.length} domains total`));
      }
    } catch (error) {
      console.error(chalk.red(`❌ Error listing domains: ${error.message}`));
    }
  }

  async showDomainEntityDetails(domainName, entityName, options = {}) {
    if (options.format !== 'json') {
      this.log(chalk.blue.bold(`\nℹ️  Entity Details: "${entityName}" in ${domainName} domain`));
      this.log(chalk.blue('='.repeat(60)));
    }

    try {
      const domainPath = path.join(this.dataPath, domainName);
      if (!await fs.pathExists(domainPath)) {
        console.log(chalk.red(`❌ Domain "${domainName}" not found.`));
        return;
      }

      const entitiesPath = path.join(domainPath, 'entities');
      if (!await fs.pathExists(entitiesPath)) {
        console.log(chalk.yellow(`⚠️  Domain "${domainName}" has no entities directory.`));
        return;
      }

      // Search for the entity across all types in the domain
      let entityData = null;
      const entityTypes = await fs.readdir(entitiesPath);
      
      for (const type of entityTypes) {
        const foundEntity = await this.findEntityByName(entityName, type, domainName);
        if (foundEntity) {
          entityData = foundEntity;
          break;
        }
      }

      if (entityData) {
        if (options.format === 'json') {
          console.log(JSON.stringify(entityData, null, 2));
        } else {
          this.log(`\nEntity: ${chalk.bold(entityData.name)}`);
          this.log(`  - Type: ${entityData.type}`);
          this.log(`  - Domain: ${entityData.domain}`);
          this.log(`  - Source: ${entityData.source || 'unknown'}`);

          // Show command execution specific details
          if (entityData.type === 'command_execution') {
            this.log(chalk.cyan('\n  Command Execution Details:'));
            this.log(`    • Command: ${entityData.command_string}`);
            this.log(`    • Timestamp: ${entityData.timestamp}`);
            this.log(`    • Status: ${entityData.status}`);
            if (entityData.output_summary) {
              this.log(`    • Output Summary: ${entityData.output_summary}`);
            }
          }

          // Show project specific details
          if (entityData.type === 'project' && entityData.data) {
            this.log(chalk.cyan('\n  Project Details:'));
            this.log(`    • ID: ${entityData.data.id}`);
            this.log(`    • Client: ${entityData.data.clientName}`);
            this.log(`    • Type: ${entityData.data.projectType}`);
            this.log(`    • Status: ${entityData.data.status}`);
            if (entityData.data.statusNotes) {
              this.log(`    • Notes: ${entityData.data.statusNotes}`);
            }
          }

          // Show relationships
          if (entityData.relationships && entityData.relationships.length > 0) {
            this.log(chalk.cyan('\n  Relationships:'));
            for (const rel of entityData.relationships) {
              const relatedDomain = rel.target_type === 'command_execution' ? 'system' : domainName;
              const relatedEntity = await this.findEntityByName(rel.target, rel.target_type, relatedDomain);
              if (relatedEntity) {
                let detail = relatedEntity.name;
                if (relatedEntity.type === 'command_execution') {
                  detail = relatedEntity.command_string;
                }
                const confidence = rel.confidence ? ` (${(rel.confidence * 100).toFixed(1)}%)` : '';
                this.log(`    • ${chalk.bold(rel.type)} → ${chalk.green(detail)} (${rel.target_type})${confidence}`);
              } else {
                const confidence = rel.confidence ? ` (${(rel.confidence * 100).toFixed(1)}%)` : '';
                this.log(`    • ${chalk.bold(rel.type)} → ${chalk.yellow(rel.target)} (${rel.target_type}) - Not Found${confidence}`);
              }
            }
          } else {
            this.log(chalk.cyan('\n  No relationships found.'));
          }
        }
      } else {
        if (options.format === 'json') {
          console.log(JSON.stringify({ error: `Entity "${entityName}" not found in domain "${domainName}"` }, null, 2));
        } else {
          this.log(`❌ Entity "${entityName}" not found in domain "${domainName}".`, 'error');
        }
      }
    } catch (error) {
      console.error(chalk.red(`❌ Error showing entity details: ${error.message}`));
    }
  }

  async showDomainRelations(domainName, options = {}) {
    if (options.format !== 'json') {
      this.log(chalk.blue.bold(`\n🔗 ${domainName.charAt(0).toUpperCase() + domainName.slice(1)} Domain Relations`));
      this.log(chalk.blue('='.repeat(60)));
    }

    try {
      const domainPath = path.join(this.dataPath, domainName);
      if (!await fs.pathExists(domainPath)) {
        console.log(chalk.red(`❌ Domain "${domainName}" not found.`));
        return;
      }

      const entitiesPath = path.join(domainPath, 'entities');
      if (!await fs.pathExists(entitiesPath)) {
        console.log(chalk.yellow(`⚠️  Domain "${domainName}" has no entities directory.`));
        return;
      }

      const relationCounts = {};
      const entityTypes = await fs.readdir(entitiesPath);
      let totalRelations = 0;

      for (const type of entityTypes) {
        const typePath = path.join(entitiesPath, type);
        if (!(await fs.stat(typePath)).isDirectory()) continue;

        const entityFiles = await fs.readdir(typePath);
        for (const file of entityFiles) {
          if (!file.endsWith('.json')) continue;

          try {
            const entityData = JSON.parse(await fs.readFile(path.join(typePath, file), 'utf-8'));
            
            if (entityData.relationships && entityData.relationships.length > 0) {
              for (const rel of entityData.relationships) {
                const relKey = `${rel.type} → ${rel.target_type}`;
                relationCounts[relKey] = (relationCounts[relKey] || 0) + 1;
                totalRelations++;
              }
            }
          } catch (parseError) {
            console.warn(chalk.yellow(`⚠️  Failed to parse ${file}: ${parseError.message}`));
          }
        }
      }

      if (options.format === 'json') {
        console.log(JSON.stringify({ domain: domainName, totalRelations, relationCounts }, null, 2));
        return;
      }

      if (totalRelations === 0) {
        if (options.format === 'json') {
          console.log(JSON.stringify({ domain: domainName, totalRelations: 0, relationCounts: {} }, null, 2));
        } else {
          this.log(chalk.yellow(`\n📭 No relationships found in domain "${domainName}".`));
        }
      } else {
        if (options.format !== 'json') {
          this.log(`\nTotal Relationships: ${chalk.cyan(totalRelations)}\n`);
          
          // Sort by count descending
          const sortedRelations = Object.entries(relationCounts)
            .sort(([,a], [,b]) => b - a);

          for (const [relType, count] of sortedRelations) {
            this.log(`  • ${chalk.bold(relType)}: ${chalk.cyan(count)} relationships`);
          }
        }
      }
    } catch (error) {
      this.log(`❌ Error showing domain relations: ${error.message}`, 'error');
    }
  }

  async showDomainEntities(domainName, options = {}) {
    const entities = [];
    
    try {
      const domainPath = path.join(this.dataPath, domainName);
      if (!await fs.pathExists(domainPath)) {
        console.log(chalk.red(`❌ Domain "${domainName}" not found.`));
        return;
      }

      const entitiesPath = path.join(domainPath, 'entities');
      if (!await fs.pathExists(entitiesPath)) {
        console.log(chalk.yellow(`⚠️  Domain "${domainName}" has no entities directory.`));
        return;
      }

      const entityTypes = await fs.readdir(entitiesPath);
      let totalEntities = 0;

      for (const type of entityTypes) {
        const typePath = path.join(entitiesPath, type);
        if (!(await fs.stat(typePath)).isDirectory()) continue;

        const entityFiles = await fs.readdir(typePath);
        for (const file of entityFiles) {
          if (!file.endsWith('.json')) continue;

          try {
            const entityData = JSON.parse(await fs.readFile(path.join(typePath, file), 'utf-8'));
            totalEntities++;

            if (options.format === 'json') {
              // For JSON output, collect entities
              if (options.properties) {
                const filteredEntity = this.filterEntityProperties(entityData, options.properties);
                entities.push(filteredEntity);
              } else {
                entities.push(entityData);
              }
            } else {
              // For console output
              if (options.properties) {
                const output = this.formatEntityProperties(entityData, options.properties);
                console.log(output);
              } else {
                // Default format (same as before)
                let relationshipsList = 'none';
                if (entityData.relationships && entityData.relationships.length > 0) {
                  relationshipsList = entityData.relationships
                    .map(rel => `${rel.type}:${rel.target}`)
                    .join(', ');
                }
                console.log(`${chalk.bold(entityData.name)} (${chalk.cyan(entityData.type)}) - ${chalk.grey(relationshipsList)}`);
              }
            }
          } catch (parseError) {
            console.warn(chalk.yellow(`⚠️  Failed to parse ${file}: ${parseError.message}`));
          }
        }
      }

      if (options.format === 'json') {
        console.log(JSON.stringify({ domain: domainName, totalEntities, entities }, null, 2));
        return;
      }

      if (!options.properties) {
        console.log(chalk.blue.bold(`\n📋 ${domainName.charAt(0).toUpperCase() + domainName.slice(1)} Domain Entities`));
        console.log(chalk.blue('='.repeat(60)));
      }

      if (totalEntities === 0) {
        console.log(chalk.yellow(`\n📭 No entities found in domain "${domainName}".`));
      } else if (!options.properties) {
        console.log(chalk.green(`\n✅ Found ${totalEntities} entities total`));
      }
    } catch (error) {
      console.error(chalk.red(`❌ Error listing domain entities: ${error.message}`));
    }
  }

  filterEntityProperties(entity, propertiesString) {
    const properties = propertiesString.split(',').map(p => p.trim());
    const filtered = {};
    
    for (const prop of properties) {
      if (prop.toLowerCase() === 'id' && entity.name) {
        filtered.id = entity.name;
      } else if (prop.toLowerCase() === 'timestamp' && entity.timestamp) {
        filtered.timestamp = entity.timestamp;
      } else if (entity[prop] !== undefined) {
        filtered[prop] = entity[prop];
      }
    }
    
    return filtered;
  }

  formatEntityProperties(entity, propertiesString) {
    const properties = propertiesString.split(',').map(p => p.trim());
    const values = [];
    
    for (const prop of properties) {
      let value = '';
      if (prop.toLowerCase() === 'id' && entity.name) {
        value = entity.name;
      } else if (prop.toLowerCase() === 'timestamp' && entity.timestamp) {
        value = entity.timestamp;
      } else if (entity[prop] !== undefined) {
        value = entity[prop];
      } else {
        value = 'N/A';
      }
      values.push(`${prop}: ${value}`);
    }
    
    return values.join(' | ');
  }

  async showDomainDetails(domainName) {
    console.log(chalk.blue.bold(`\n🗂️  Domain Details: ${domainName}`));
    console.log(chalk.blue('='.repeat(60)));

    try {
      const domainPath = path.join(this.dataPath, domainName);
      if (!await fs.pathExists(domainPath)) {
        console.log(chalk.red(`❌ Domain "${domainName}" not found.`));
        return;
      }

      const entitiesPath = path.join(domainPath, 'entities');
      if (!await fs.pathExists(entitiesPath)) {
        console.log(chalk.yellow(`⚠️  Domain "${domainName}" has no entities directory.`));
        return;
      }

      const entityTypes = await fs.readdir(entitiesPath);
      const typeStats = [];
      let totalEntities = 0;
      let totalRelationships = 0;

      for (const type of entityTypes) {
        const typePath = path.join(entitiesPath, type);
        if (!(await fs.stat(typePath)).isDirectory()) continue;

        const entityFiles = await fs.readdir(typePath);
        const jsonFiles = entityFiles.filter(file => file.endsWith('.json'));
        let typeRelationships = 0;

        // Count relationships for this type
        for (const file of jsonFiles) {
          try {
            const entityData = JSON.parse(await fs.readFile(path.join(typePath, file), 'utf-8'));
            if (entityData.relationships && Array.isArray(entityData.relationships)) {
              typeRelationships += entityData.relationships.length;
            }
          } catch (parseError) {
            // Skip invalid JSON files
          }
        }

        if (jsonFiles.length > 0) {
          typeStats.push({
            type,
            count: jsonFiles.length,
            relationships: typeRelationships
          });
          totalEntities += jsonFiles.length;
          totalRelationships += typeRelationships;
        }
      }

      if (typeStats.length === 0) {
        console.log(chalk.yellow(`\n📭 No entities found in domain "${domainName}".`));
      } else {
        console.log(`\nDomain: ${chalk.bold(domainName)}`);
        console.log(`Total Entities: ${chalk.cyan(totalEntities)}`);
        console.log(`Total Relationships: ${chalk.cyan(totalRelationships)}`);
        
        console.log(chalk.cyan('\nEntity Types:'));
        typeStats.sort((a, b) => b.count - a.count);
        for (const stat of typeStats) {
          console.log(`  • ${chalk.bold(stat.type)}: ${stat.count} entities, ${stat.relationships} relationships`);
        }

        // Show recent activity if available
        const domainStat = await fs.stat(domainPath);
        console.log(chalk.grey(`\nLast Modified: ${domainStat.mtime.toISOString()}`));
      }
    } catch (error) {
      console.error(chalk.red(`❌ Error showing domain details: ${error.message}`));
    }
  }

  async findEntityByName(name, type, domain) {
    try {
      const entityDir = path.join(this.dataPath, domain, 'entities', type);
      const filename = `${name.replace(/[^a-z0-9\s-]/gi, '').replace(/\s+/g, '-').toLowerCase()}.json`;
      const filePath = path.join(entityDir, filename);

      if (await fs.pathExists(filePath)) {
        const entityData = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(entityData);
      }
      return null;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.log(`⚠️  Failed to read entity ${name} (${type}): ${error.message}`, 'warning');
      }
      return null;
    }
  }
}

async function main() {
  const argv = yargs(process.argv.slice(2))
    .command('query <text>', 'Ask a contextual query', (yargs) => {
      return yargs.positional('text', { describe: 'Query text' });
    })
    .command('discover <type>', 'Discover entities from external sources', (yargs) => {
        return yargs.positional('type', { describe: 'e.g., projects' })
            .option('person', { type: 'string' });
    })
    .command('show [name]', 'Show details for a specific entity or list all entities', (yargs) => {
        return yargs.positional('name', { describe: 'Entity name (optional - if not provided, lists all entities)' });
    })
    .command('database <subcommand>', 'Database management commands', (yargs) => {
        return yargs.command('domains [domain] [action] [entity]', 'List all domains or show details for specific domain', (yargs) => {
            return yargs.positional('domain', { describe: 'Domain name (optional - if not provided, lists all domains)' })
                        .positional('action', { describe: 'Action to perform (e.g., entities, relations)' })
                        .positional('entity', { describe: 'Entity name (optional - shows detailed view of specific entity)' })
                        .option('properties', { describe: 'Comma-separated list of properties to display', type: 'string' })
                        .option('format', { describe: 'Output format (json)', type: 'string' })
                        .option('debug', { describe: 'Show debug messages and warnings', type: 'boolean' });
        });
    })
    .command('sync <source>', 'Sync data from external source to Context DB', (yargs) => {
        return yargs.positional('source', {
            describe: 'Data source to sync from (e.g., snappy)',
            type: 'string'
        }).option('debug', {
            describe: 'Show debug information',
            type: 'boolean',
            default: false
        });
    })
    .command('clear', 'Clear the context database', (yargs) => {
        return yargs.option('domain', {
            describe: 'The domain to clear (e.g., construction, system)',
            type: 'string',
            default: 'construction'
        }).option('confirm', {
            describe: 'Confirm the clear operation',
            type: 'boolean',
            default: false
        });
    })
    .demandCommand(1, 'You need at least one command before moving on')
    .help()
    .argv;

  const cli = new ContextCLI();
  
  // Set output options based on command line arguments
  cli.setOutputOptions({
    format: argv.format,
    debug: argv.debug
  });

  // Check for API keys and warn if not configured (only if debug mode)
  if (cli.outputOptions.debug) {
    if (!process.env.OPENROUTER_API_KEY) {
      cli.log('⚠️  OpenRouter API key not configured', 'warning');
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      cli.log('⚠️  Anthropic API key not configured', 'warning');
    }
  }

  await cli.initialize();

  const command = argv._[0];

  switch (command) {
    case 'query':
      await cli.router.processSmartQuery(argv.text);
      break;
    case 'discover':
      const query = `Discover ${argv.type} for person ${argv.person}`;
      await cli.router.processSmartQuery(query);
      break;
    case 'show':
      await cli.handleShowCommand(argv.name);
      break;
    case 'database':
      if (argv._[1] === 'domains') {
        const options = {
          properties: argv.properties,
          format: argv.format,
          debug: argv.debug
        };
        await cli.handleDatabaseDomainsCommand(argv.domain, argv.action, argv.entity, options);
      } else {
        cli.log('Unknown database subcommand. Use --help to see available commands.', 'error');
      }
      break;
    case 'sync':
      await cli.handleSyncCommand(argv.source, { debug: argv.debug });
      break;
    case 'clear':
      await cli.handleClearCommand(argv.domain, argv.confirm);
      break;
    default:
      cli.log('Unknown command. Use --help to see available commands.', 'error');
      break;
  }
}

main();