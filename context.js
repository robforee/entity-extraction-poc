#!/usr/bin/env node

/**
 * Context Management System CLI
 * 
 * CLI-first context tool for intelligent context assembly and query management.
 * Implements the architectural principles from notes-evolution-architecture.md
 */

import { ContextAssemblyEngine } from './src/context/context-assembly-engine.js';
import { SnappyIntegration } from './src/integrations/snappy-integration.js';
import { HierarchicalEntityManager } from './src/entities/hierarchical-entity-manager.js';
import { QueryTemplateManager } from './src/queries/query-template-manager.js';
import { KnowledgeDriller } from './src/knowledge/knowledge-driller.js';
import { EntityConsolidator } from './src/consolidation/entity-consolidator.js';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ContextCLI {
  constructor() {
    this.dataPath = path.join(__dirname, 'data');
    this.contextEngine = null;
    this.snappyIntegration = null;
    this.entityManager = null;
    this.queryManager = null;
    this.knowledgeDriller = null;
    this.consolidator = null;
  }

  async initialize() {
    try {
      // Initialize core components
      this.contextEngine = new ContextAssemblyEngine({
        dataPath: this.dataPath,
        domain: 'universal',
        confidenceThreshold: 0.85
      });

      this.snappyIntegration = new SnappyIntegration({
        snappyPath: path.resolve(__dirname, '..', 'snappy')
      });

      this.entityManager = new HierarchicalEntityManager({
        dataPath: this.dataPath
      });

      this.queryManager = new QueryTemplateManager({
        dataPath: this.dataPath
      });

      this.knowledgeDriller = new KnowledgeDriller({
        dataPath: this.dataPath
      });

      this.consolidator = new EntityConsolidator({
        dataPath: this.dataPath
      });

      console.log(chalk.green('✅ Context CLI initialized successfully'));
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize Context CLI:'), error.message);
      process.exit(1);
    }
  }

  async handleQuery(queryText, options = {}) {
    console.log(chalk.blue.bold(`\n🧠 Context Query: "${queryText}"`));
    console.log(chalk.blue('=' .repeat(60)));

    try {
      const result = await this.contextEngine.processContextualQuery(queryText, {
        userId: options.userId || 'cli-user',
        executeActions: options.execute || false,
        maintainContext: true
      });

      // Display results
      this.displayQueryResult(result);
      
      return result;
    } catch (error) {
      console.error(chalk.red('❌ Query processing failed:'), error.message);
      return null;
    }
  }

  displayQueryResult(result) {
    console.log(chalk.yellow('\n📋 Query Results:'));
    
    if (result.contextualIntelligence) {
      const ci = result.contextualIntelligence;
      
      console.log(chalk.cyan('\n🎯 Resolved Entities:'));
      if (ci.resolvedEntities && ci.resolvedEntities.length > 0) {
        ci.resolvedEntities.forEach(entity => {
          console.log(`  • ${entity.name} (${entity.type}) - Confidence: ${(entity.confidence * 100).toFixed(1)}%`);
        });
      } else {
        console.log(chalk.grey('  No entities resolved'));
      }

      console.log(chalk.cyan('\n🔗 Relationships:'));
      if (ci.relationships && ci.relationships.length > 0) {
        ci.relationships.forEach(rel => {
          console.log(`  • ${rel.source} → ${rel.type} → ${rel.target}`);
        });
      } else {
        console.log(chalk.grey('  No relationships found'));
      }

      console.log(chalk.cyan('\n📊 Context Summary:'));
      console.log(`  • Entities found: ${ci.resolvedEntities?.length || 0}`);
      console.log(`  • Relationships: ${ci.relationships?.length || 0}`);
      console.log(`  • Confidence: ${((ci.overallConfidence || 0) * 100).toFixed(1)}%`);
    }

    if (result.finalResponse) {
      console.log(chalk.green('\n💬 Response:'));
      console.log(result.finalResponse);
    }
  }

  async handleSnappySync(action, options = {}) {
    console.log(chalk.blue.bold(`\n🔄 Snappy Sync: ${action}`));
    console.log(chalk.blue('=' .repeat(40)));

    try {
      switch (action) {
        case 'export-ci':
          return await this.snappyIntegration.exportForCI(options.project);
        case 'check-status':
          return await this.snappyIntegration.checkSyncStatus(options.allProjects);
        case 'pull-insights':
          return await this.snappyIntegration.pullInsights(options.project);
        case 'push-updates':
          return await this.snappyIntegration.pushUpdates(options.project);
        case 'validate':
          return await this.snappyIntegration.validateSync(options);
        default:
          console.error(chalk.red(`❌ Unknown sync action: ${action}`));
          return null;
      }
    } catch (error) {
      console.error(chalk.red('❌ Snappy sync failed:'), error.message);
      return null;
    }
  }

  async handleEntityOperations(operation, entityId, options = {}) {
    console.log(chalk.blue.bold(`\n🏷️  Entity Operation: ${operation}`));
    console.log(chalk.blue('=' .repeat(40)));

    try {
      switch (operation) {
        case 'hierarchy':
          return await this.entityManager.getEntityHierarchy(entityId, options);
        case 'search':
          return await this.entityManager.searchEntities(entityId, options);
        case 'consolidate':
          return await this.consolidator.consolidateEntity(entityId, options);
        case 'validate':
          return await this.entityManager.validateHierarchy(options);
        case 'list':
          return await this.entityManager.listEntities(options);
        case 'merge':
          return await this.entityManager.mergeEntities(entityId, options.target, options);
        default:
          console.error(chalk.red(`❌ Unknown entity operation: ${operation}`));
          return null;
      }
    } catch (error) {
      console.error(chalk.red('❌ Entity operation failed:'), error.message);
      return null;
    }
  }

  async handleQueryTemplates(operation, templateName, options = {}) {
    console.log(chalk.blue.bold(`\n📝 Query Templates: ${operation}`));
    console.log(chalk.blue('=' .repeat(40)));

    try {
      switch (operation) {
        case 'list-templates':
          return await this.queryManager.listTemplates(options.domain);
        case 'test-template':
          return await this.queryManager.testTemplate(templateName, options.entity);
        case 'evaluate-performance':
          return await this.queryManager.evaluatePerformance(templateName);
        case 'upgrade-template':
          return await this.queryManager.upgradeTemplate(templateName, options.version);
        case 'a-b-test':
          return await this.queryManager.abTest(options.template1, options.template2, options.entity);
        case 'performance-report':
          return await this.queryManager.performanceReport(options.timeframe);
        default:
          console.error(chalk.red(`❌ Unknown query template operation: ${operation}`));
          return null;
      }
    } catch (error) {
      console.error(chalk.red('❌ Query template operation failed:'), error.message);
      return null;
    }
  }

  async handleKnowledgeDrilling(entity, options = {}) {
    console.log(chalk.blue.bold(`\n🔍 Knowledge Drilling: ${entity}`));
    console.log(chalk.blue('=' .repeat(40)));

    try {
      const result = await this.knowledgeDriller.drillEntity(entity, {
        depth: options.depth || 3,
        showHierarchy: options.showHierarchy || false,
        domain: options.domain || null
      });

      this.displayDrillingResult(result);
      return result;
    } catch (error) {
      console.error(chalk.red('❌ Knowledge drilling failed:'), error.message);
      return null;
    }
  }

  displayDrillingResult(result) {
    console.log(chalk.yellow('\n📊 Drilling Results:'));
    
    if (result.hierarchy) {
      console.log(chalk.cyan('\n🌳 Hierarchy:'));
      this.displayHierarchy(result.hierarchy, 0);
    }

    if (result.knowledge) {
      console.log(chalk.cyan('\n📚 Generated Knowledge:'));
      console.log(result.knowledge);
    }

    if (result.confidence) {
      console.log(chalk.cyan(`\n✅ Confidence: ${(result.confidence * 100).toFixed(1)}%`));
    }
  }

  displayHierarchy(hierarchy, depth = 0) {
    const indent = '  '.repeat(depth);
    console.log(`${indent}• ${hierarchy.name} (${hierarchy.type})`);
    
    if (hierarchy.children) {
      hierarchy.children.forEach(child => {
        this.displayHierarchy(child, depth + 1);
      });
    }
  }

  async handlePendingRequests(operation, options = {}) {
    console.log(chalk.blue.bold(`\n📋 Pending Requests: ${operation}`));
    console.log(chalk.blue('=' .repeat(40)));

    try {
      switch (operation) {
        case 'list':
          return await this.listPendingRequests(options);
        case 'summary':
          return await this.showPendingRequestsSummary(options);
        case 'show':
          return await this.showPendingRequest(options.requestId);
        case 'cleanup':
          return await this.cleanupPendingRequests(options);
        default:
          console.error(chalk.red(`❌ Unknown pending requests operation: ${operation}`));
          return null;
      }
    } catch (error) {
      console.error(chalk.red('❌ Pending requests operation failed:'), error.message);
      return null;
    }
  }

  async listPendingRequests(options = {}) {
    const requests = await this.contextEngine.persistentConversationManager.listPendingRequests(options);
    
    if (requests.length === 0) {
      console.log(chalk.gray('📭 No pending requests found'));
      return requests;
    }

    console.log(chalk.yellow(`\n📋 Found ${requests.length} pending request(s):\n`));
    
    for (const request of requests) {
      const age = this.formatAge(request.createdAt);
      const projectName = request.projectContext?.projectName || 'Unknown Project';
      
      console.log(chalk.cyan(`🔸 ${request.id}`));
      console.log(`   Project: ${chalk.white(projectName)}`);
      console.log(`   Question: ${chalk.yellow(request.questionAsked)}`);
      console.log(`   Original: "${chalk.gray(request.originalQuery)}"`);
      console.log(`   Created: ${age}`);
      console.log(`   Status: ${this.formatStatus(request.status)}`);
      console.log('');
    }

    return requests;
  }

  async showPendingRequestsSummary(options = {}) {
    const summary = await this.contextEngine.persistentConversationManager.getPendingRequestsSummary();
    
    console.log(chalk.yellow('\n📊 Pending Requests Summary\n'));
    
    console.log(chalk.cyan('📈 Overview:'));
    console.log(`   Total Requests: ${summary.total}`);
    console.log(`   Pending: ${chalk.yellow(summary.pending)}`);
    console.log(`   Completed: ${chalk.green(summary.completed)}`);
    
    if (summary.pending > 0) {
      console.log(chalk.cyan('\n🏗️  By Project:'));
      for (const [projectName, requests] of Object.entries(summary.byProject)) {
        console.log(`   ${projectName}: ${chalk.yellow(requests.length)} pending`);
      }
      
      console.log(chalk.cyan('\n⏰ By Age:'));
      console.log(`   Recent (< 1h): ${summary.byAge.recent.length}`);
      console.log(`   Today (< 24h): ${summary.byAge.today.length}`);
      console.log(`   This Week (< 7d): ${summary.byAge.week.length}`);
      console.log(`   Older (> 7d): ${summary.byAge.old.length}`);
      
      if (summary.oldestPending) {
        const age = this.formatAge(summary.oldestPending.createdAt);
        console.log(chalk.cyan('\n⚠️  Oldest Pending:'));
        console.log(`   ${summary.oldestPending.id} - ${age}`);
        console.log(`   "${summary.oldestPending.questionAsked}"`);
      }
    }

    return summary;
  }

  async showPendingRequest(requestId) {
    if (!requestId) {
      console.error(chalk.red('❌ Request ID required'));
      return null;
    }

    const request = await this.contextEngine.persistentConversationManager.getPendingRequest(requestId);
    
    if (!request) {
      console.error(chalk.red(`❌ Request ${requestId} not found`));
      return null;
    }

    console.log(chalk.yellow(`\n📋 Pending Request Details: ${request.id}\n`));
    
    console.log(chalk.cyan('📝 Basic Info:'));
    console.log(`   Status: ${this.formatStatus(request.status)}`);
    console.log(`   Created: ${this.formatAge(request.createdAt)}`);
    console.log(`   Updated: ${this.formatAge(request.lastUpdated)}`);
    console.log(`   Attempts: ${request.attempts}`);
    
    console.log(chalk.cyan('\n🎯 Request Details:'));
    console.log(`   Original Query: "${request.originalQuery}"`);
    console.log(`   Intent: ${request.intent?.type} (${(request.intent?.confidence * 100).toFixed(1)}%)`);
    console.log(`   Question: "${request.questionAsked}"`);
    
    console.log(chalk.cyan('\n🏗️  Project Context:'));
    console.log(`   Project: ${request.projectContext?.projectName || 'Unknown'}`);
    console.log(`   Inferred from Location: ${request.projectContext?.inferredFromLocation ? 'Yes' : 'No'}`);
    console.log(`   Inferred from Person: ${request.projectContext?.inferredFromPerson ? 'Yes' : 'No'}`);
    
    console.log(chalk.cyan('\n🏷️  Extracted Entities:'));
    for (const [entityType, entities] of Object.entries(request.extractedEntities)) {
      if (entities.length > 0) {
        console.log(`   ${entityType}: ${entities.map(e => e.name).join(', ')}`);
      }
    }
    
    console.log(chalk.cyan('\n❓ Missing Information:'));
    console.log(`   Type: ${request.missingInfo?.type}`);
    console.log(`   Required: ${request.missingInfo?.requiredEntity}`);
    console.log(`   Context: ${request.missingInfo?.context}`);

    if (request.status === 'completed' && request.completion) {
      console.log(chalk.cyan('\n✅ Completion Details:'));
      console.log(`   Completed: ${this.formatAge(request.completedAt)}`);
      console.log(`   Ready for Snappy: ${request.completion.readyForSnappy ? 'Yes' : 'No'}`);
      if (request.completion.providedInfo) {
        console.log(`   Provided Info: ${JSON.stringify(request.completion.providedInfo, null, 2)}`);
      }
    }

    return request;
  }

  async cleanupPendingRequests(options = {}) {
    const cleaned = await this.contextEngine.persistentConversationManager.cleanup(options.maxAge);
    console.log(chalk.green(`✅ Cleaned up ${cleaned} old records`));
    return cleaned;
  }

  formatAge(timestamp) {
    const now = Date.now();
    const age = now - new Date(timestamp).getTime();
    const minutes = Math.floor(age / (1000 * 60));
    const hours = Math.floor(age / (1000 * 60 * 60));
    const days = Math.floor(age / (1000 * 60 * 60 * 24));
    
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  formatStatus(status) {
    switch (status) {
      case 'pending': return chalk.yellow('⏳ Pending');
      case 'completed': return chalk.green('✅ Completed');
      case 'failed': return chalk.red('❌ Failed');
      default: return chalk.gray(`❓ ${status}`);
    }
  }

  async handleValidation(type, options = {}) {
    console.log(chalk.blue.bold(`\n✅ Validation: ${type}`));
    console.log(chalk.blue('=' .repeat(40)));

    try {
      let result;
      switch (type) {
        case 'all':
          result = await this.validateAll(options);
          break;
        case 'hierarchy-accuracy':
          result = await this.entityManager.validateHierarchyAccuracy(options.targetThreshold);
          break;
        case 'consolidation-accuracy':
          result = await this.consolidator.validateConsolidationAccuracy(options.targetThreshold);
          break;
        case 'query-relevance':
          result = await this.queryManager.validateQueryRelevance(options.targetThreshold);
          break;
        case 'sync-consistency':
          result = await this.snappyIntegration.validateSyncConsistency(options.targetThreshold);
          break;
        default:
          console.error(chalk.red(`❌ Unknown validation type: ${type}`));
          return null;
      }

      this.displayValidationResult(result, type);
      return result;
    } catch (error) {
      console.error(chalk.red('❌ Validation failed:'), error.message);
      return null;
    }
  }

  async validateAll(options = {}) {
    const results = {
      hierarchyAccuracy: await this.entityManager.validateHierarchyAccuracy(0.85),
      consolidationAccuracy: await this.consolidator.validateConsolidationAccuracy(0.90),
      queryRelevance: await this.queryManager.validateQueryRelevance(0.90),
      syncConsistency: await this.snappyIntegration.validateSyncConsistency(1.0)
    };

    return results;
  }

  displayValidationResult(result, type) {
    console.log(chalk.yellow(`\n📊 ${type} Validation Results:`));
    
    if (typeof result === 'object') {
      Object.entries(result).forEach(([key, value]) => {
        const status = value >= 0.85 ? chalk.green('✅') : chalk.red('❌');
        console.log(`${status} ${key}: ${(value * 100).toFixed(1)}%`);
      });
    } else {
      const status = result >= 0.85 ? chalk.green('✅') : chalk.red('❌');
      console.log(`${status} Result: ${(result * 100).toFixed(1)}%`);
    }
  }

  showUsage() {
    console.log(chalk.yellow.bold('\n🧠 Context Management System CLI'));
    console.log(chalk.yellow('Usage: node context.js <command> [options]'));
    console.log(chalk.yellow('\nCommands:'));
    
    console.log(chalk.cyan('\n📝 Context Queries:'));
    console.log('  query "text"                    - Process natural language context query');
    console.log('  test query "text"               - Test query without executing actions');
    
    console.log(chalk.cyan('\n🔄 Snappy Integration:'));
    console.log('  sync snappy --export-ci --project <id>     - Export CI-compatible data');
    console.log('  sync snappy --check-status --all-projects  - Check sync status');
    console.log('  sync snappy --pull-insights --project <id> - Pull insights from CI');
    console.log('  sync snappy --push-updates --project <id>  - Push updates to CI');
    console.log('  sync validate --source snappy --check-hashes - Validate sync');
    
    console.log(chalk.cyan('\n🏷️  Entity Management:'));
    console.log('  entities hierarchy <entity>     - Show entity hierarchy');
    console.log('  entities search <term>          - Search entities');
    console.log('  entities consolidate <entity>   - Consolidate entity variations');
    console.log('  entities validate hierarchy     - Validate hierarchy structure');
    console.log('  entities list --domain <domain> - List entities by domain');
    
    console.log(chalk.cyan('\n📝 Query Templates:'));
    console.log('  queries list-templates --domain <domain>   - List query templates');
    console.log('  queries test-template <name> --entity <e>  - Test template');
    console.log('  queries evaluate-performance <template>    - Evaluate performance');
    console.log('  queries performance-report --timeframe <t> - Performance report');
    
    console.log(chalk.cyan('\n🔍 Knowledge Drilling:'));
    console.log('  drill <entity> --depth <n>      - Progressive knowledge drilling');
    console.log('  drill validate <entity>         - Validate drilling results');
    console.log('  generate knowledge <entity>     - Generate missing knowledge');
    
    console.log(chalk.cyan('\n📋 Pending Requests:'));
    console.log('  pending list                    - List all pending requests');
    console.log('  pending summary                 - Show pending requests summary');
    console.log('  pending show <request-id>       - Show detailed request info');
    console.log('  pending cleanup                 - Clean up old completed requests');
    
    console.log(chalk.cyan('\n✅ Validation:'));
    console.log('  validate all --domain <domain>  - Comprehensive validation');
    console.log('  validate hierarchy-accuracy     - Validate hierarchy accuracy');
    console.log('  validate consolidation-accuracy - Validate consolidation accuracy');
    console.log('  validate query-relevance        - Validate query relevance');
    console.log('  validate sync-consistency       - Validate sync consistency');
  }
}

// CLI argument parsing and execution
async function main() {
  const cli = new ContextCLI();
  
  const argv = yargs(hideBin(process.argv))
    .command('query <text>', 'Process natural language context query', (yargs) => {
      return yargs
        .positional('text', {
          describe: 'Query text to process',
          type: 'string'
        })
        .option('execute', {
          alias: 'e',
          type: 'boolean',
          description: 'Execute actions found in query',
          default: false
        })
        .option('user-id', {
          alias: 'u',
          type: 'string',
          description: 'User ID for context',
          default: 'cli-user'
        });
    })
    .command('sync <action>', 'Snappy synchronization operations', (yargs) => {
      return yargs
        .positional('action', {
          describe: 'Sync action to perform',
          choices: ['snappy']
        })
        .option('export-ci', {
          type: 'boolean',
          description: 'Export CI-compatible data'
        })
        .option('check-status', {
          type: 'boolean',
          description: 'Check sync status'
        })
        .option('pull-insights', {
          type: 'boolean',
          description: 'Pull insights from CI'
        })
        .option('push-updates', {
          type: 'boolean',
          description: 'Push updates to CI'
        })
        .option('validate', {
          type: 'boolean',
          description: 'Validate sync'
        })
        .option('project', {
          alias: 'p',
          type: 'string',
          description: 'Project ID'
        })
        .option('all-projects', {
          type: 'boolean',
          description: 'Apply to all projects'
        });
    })
    .command('entities <operation> [entity]', 'Entity management operations', (yargs) => {
      return yargs
        .positional('operation', {
          describe: 'Entity operation to perform',
          choices: ['hierarchy', 'search', 'consolidate', 'validate', 'list', 'merge']
        })
        .positional('entity', {
          describe: 'Entity name or ID',
          type: 'string'
        })
        .option('domain', {
          alias: 'd',
          type: 'string',
          description: 'Domain filter'
        })
        .option('show-variations', {
          type: 'boolean',
          description: 'Show entity variations'
        })
        .option('confidence-threshold', {
          type: 'number',
          description: 'Confidence threshold',
          default: 0.85
        });
    })
    .command('drill <entity>', 'Knowledge drilling operations', (yargs) => {
      return yargs
        .positional('entity', {
          describe: 'Entity to drill into',
          type: 'string'
        })
        .option('depth', {
          alias: 'd',
          type: 'number',
          description: 'Drilling depth',
          default: 3
        })
        .option('show-hierarchy', {
          type: 'boolean',
          description: 'Show hierarchy structure',
          default: true
        })
        .option('domain', {
          type: 'string',
          description: 'Domain context'
        });
    })
    .command('pending <operation> [request-id]', 'Pending request operations', (yargs) => {
      return yargs
        .positional('operation', {
          describe: 'Pending request operation',
          choices: ['list', 'summary', 'show', 'cleanup']
        })
        .positional('request-id', {
          describe: 'Request ID for show operation',
          type: 'string'
        })
        .option('status', {
          type: 'string',
          description: 'Filter by status',
          choices: ['pending', 'completed', 'failed']
        })
        .option('project', {
          alias: 'p',
          type: 'string',
          description: 'Filter by project name'
        })
        .option('user-id', {
          alias: 'u',
          type: 'string',
          description: 'Filter by user ID'
        })
        .option('max-age', {
          type: 'number',
          description: 'Maximum age in milliseconds for cleanup',
          default: 30 * 24 * 60 * 60 * 1000
        });
    })
    .command('validate <type>', 'Validation operations', (yargs) => {
      return yargs
        .positional('type', {
          describe: 'Validation type',
          choices: ['all', 'hierarchy-accuracy', 'consolidation-accuracy', 'query-relevance', 'sync-consistency']
        })
        .option('target-threshold', {
          type: 'number',
          description: 'Target threshold for validation',
          default: 0.85
        })
        .option('domain', {
          type: 'string',
          description: 'Domain filter'
        });
    })
    .help()
    .alias('help', 'h')
    .argv;

  // Initialize CLI
  await cli.initialize();

  // Handle commands
  const command = argv._[0];
  
  try {
    switch (command) {
      case 'query':
        await cli.handleQuery(argv.text, {
          execute: argv.execute,
          userId: argv.userId
        });
        break;
        
      case 'sync':
        if (argv.action === 'snappy') {
          const syncAction = argv.exportCi ? 'export-ci' :
                           argv.checkStatus ? 'check-status' :
                           argv.pullInsights ? 'pull-insights' :
                           argv.pushUpdates ? 'push-updates' :
                           argv.validate ? 'validate' : null;
                           
          if (syncAction) {
            await cli.handleSnappySync(syncAction, {
              project: argv.project,
              allProjects: argv.allProjects
            });
          }
        }
        break;
        
      case 'entities':
        await cli.handleEntityOperations(argv.operation, argv.entity, {
          domain: argv.domain,
          showVariations: argv.showVariations,
          confidenceThreshold: argv.confidenceThreshold
        });
        break;
        
      case 'drill':
        await cli.handleKnowledgeDrilling(argv.entity, {
          depth: argv.depth,
          showHierarchy: argv.showHierarchy,
          domain: argv.domain
        });
        break;
        
      case 'pending':
        await cli.handlePendingRequests(argv.operation, {
          requestId: argv.requestId,
          status: argv.status,
          projectName: argv.project,
          userId: argv.userId,
          maxAge: argv.maxAge
        });
        break;
        
      case 'validate':
        await cli.handleValidation(argv.type, {
          targetThreshold: argv.targetThreshold,
          domain: argv.domain
        });
        break;
        
      default:
        cli.showUsage();
        break;
    }
  } catch (error) {
    console.error(chalk.red('❌ Command execution failed:'), error.message);
    process.exit(1);
  }
}

// Handle CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(chalk.red('❌ CLI execution failed:'), error);
    process.exit(1);
  });
}

export { ContextCLI };
