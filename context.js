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
import { DataSourceRouter } from './src/routing/data-source-router.js';
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
    this.dataSourceRouter = null;
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

      this.dataSourceRouter = new DataSourceRouter({
        dataPath: this.dataPath,
        snappyPath: path.resolve(__dirname, '..', 'snappy')
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
      // Use smart router if enabled, otherwise fall back to context engine
      let result;
      if (options.useSmartRouter !== false) {
        result = await this.dataSourceRouter.processSmartQuery(queryText, {
          userId: options.userId || 'cli-user',
          executeActions: options.execute || false
        });
      } else {
        result = await this.contextEngine.processContextualQuery(queryText, {
          userId: options.userId || 'cli-user',
          executeActions: options.execute || false,
          maintainContext: true
        });
      }

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

  /**
   * Handle smart router data commands for structured data routing
   */
  async handleDataCommand(dataType, options = {}) {
    console.log(chalk.blue.bold(`\n📊 Data Command: ${dataType}`));
    console.log(chalk.blue('=' .repeat(40)));

    try {
      switch (dataType) {
        case 'costs':
          return await this.handleCostsData(options);
        case 'projects':
          return await this.handleProjectsData(options);
        case 'materials':
          return await this.handleMaterialsData(options);
        default:
          console.error(chalk.red(`❌ Unknown data type: ${dataType}`));
          return null;
      }
    } catch (error) {
      console.error(chalk.red('❌ Data command failed:'), error.message);
      return null;
    }
  }

  async handleCostsData(options = {}) {
    if (!options.project) {
      console.error(chalk.red('❌ Project ID required for costs data'));
      return null;
    }

    console.log(chalk.cyan(`📊 Retrieving costs for project: ${options.project}`));
    
    // Use data source router to get structured cost data
    const result = await this.dataSourceRouter.processSmartQuery(
      `Get cost breakdown for project ${options.project}`, 
      { dataType: 'costs', format: options.format || 'json' }
    );

    if (options.format === 'json') {
      console.log(JSON.stringify(result, null, 2));
    }

    return result;
  }

  async handleProjectsData(options = {}) {
    console.log(chalk.cyan('📊 Retrieving projects data'));
    
    const result = await this.dataSourceRouter.processSmartQuery(
      'List all projects with details',
      { dataType: 'projects', format: options.format || 'json' }
    );

    if (options.format === 'json') {
      console.log(JSON.stringify(result, null, 2));
    }

    return result;
  }

  async handleMaterialsData(options = {}) {
    console.log(chalk.cyan('📊 Retrieving materials data'));
    
    const result = await this.dataSourceRouter.processSmartQuery(
      `Get materials list ${options.project ? 'for project ' + options.project : ''}`,
      { dataType: 'materials', format: options.format || 'json' }
    );

    if (options.format === 'json') {
      console.log(JSON.stringify(result, null, 2));
    }

    return result;
  }

  /**
   * Handle smart discovery commands
   */
  async handleDiscoverCommand(discoverType, options = {}) {
    console.log(chalk.blue.bold(`\n🔍 Discovery Command: ${discoverType}`));
    console.log(chalk.blue('=' .repeat(40)));

    try {
      switch (discoverType) {
        case 'projects':
          return await this.discoverProjects(options);
        case 'people':
          return await this.discoverPeople(options);
        case 'relationships':
          return await this.discoverRelationships(options);
        default:
          console.error(chalk.red(`❌ Unknown discovery type: ${discoverType}`));
          return null;
      }
    } catch (error) {
      console.error(chalk.red('❌ Discovery command failed:'), error.message);
      return null;
    }
  }

  async discoverProjects(options = {}) {
    let query = 'Discover existing projects';
    if (options.person) query += ` for person ${options.person}`;
    if (options.location) query += ` at location ${options.location}`;

    console.log(chalk.cyan(`🔍 ${query}`));
    
    const result = await this.dataSourceRouter.processSmartQuery(query, {
      discoveryType: 'projects',
      person: options.person,
      location: options.location
    });

    this.displayDiscoveryResult(result, 'projects');
    return result;
  }

  async discoverPeople(options = {}) {
    let query = 'Discover people';
    if (options.project) query += ` associated with project ${options.project}`;

    console.log(chalk.cyan(`🔍 ${query}`));
    
    const result = await this.dataSourceRouter.processSmartQuery(query, {
      discoveryType: 'people',
      project: options.project
    });

    this.displayDiscoveryResult(result, 'people');
    return result;
  }

  async discoverRelationships(options = {}) {
    let query = 'Discover relationships';
    if (options.entity) query += ` for entity ${options.entity}`;

    console.log(chalk.cyan(`🔍 ${query}`));
    
    const result = await this.dataSourceRouter.processSmartQuery(query, {
      discoveryType: 'relationships',
      entity: options.entity
    });

    this.displayDiscoveryResult(result, 'relationships');
    return result;
  }

  displayDiscoveryResult(result, type) {
    console.log(chalk.yellow(`\n📋 Discovery Results (${type}):`));
    
    if (result?.contextualIntelligence?.externalDiscoveries) {
      const discoveries = result.contextualIntelligence.externalDiscoveries;
      
      if (type === 'projects' && discoveries.snappyProjects?.length > 0) {
        console.log(chalk.cyan('\n🏗️  Discovered Projects:'));
        discoveries.snappyProjects.forEach(project => {
          console.log(`  • ${project.name || project.clientName} (ID: ${project.id})`);
          console.log(`    Match Confidence: ${(project.matchConfidence * 100).toFixed(1)}%`);
          if (project.matchedMention) {
            console.log(`    Matched: "${project.matchedMention}"`);
          }
        });
      }
      
      if (discoveries.projectDetails?.length > 0) {
        console.log(chalk.cyan('\n📊 Project Details Available:'));
        discoveries.projectDetails.forEach(detail => {
          console.log(`  • ${detail.name || detail.id}`);
        });
      }
    }

    if (result?.contextualIntelligence?.overallConfidence) {
      console.log(chalk.cyan(`\n✅ Discovery Confidence: ${(result.contextualIntelligence.overallConfidence * 100).toFixed(1)}%`));
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

  async handleClear(options = {}) {
    const { domain, confirm, backup } = options;

    if (!confirm) {
      console.log(chalk.red('❌ Clear operation requires --confirm flag'));
      console.log(chalk.yellow('💡 Use: node context.js clear --domain <domain> --confirm'));
      return;
    }

    console.log(chalk.blue.bold(`\n🗑️  Clear Context Database: ${domain}`));
    console.log(chalk.blue('=' .repeat(40)));

    try {
      // Create backup if requested
      if (backup) {
        console.log(chalk.yellow('📦 Creating backup...'));
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(this.dataPath, `backup-${domain}-${timestamp}`);
        
        await fs.mkdir(backupPath, { recursive: true });
        
        // Copy existing data to backup
        const sourcePaths = domain === 'all' 
          ? [path.join(this.dataPath, 'construction'), path.join(this.dataPath, 'cybersec')]
          : [path.join(this.dataPath, domain)];

        for (const sourcePath of sourcePaths) {
          try {
            const stats = await fs.stat(sourcePath);
            if (stats.isDirectory()) {
              const domainName = path.basename(sourcePath);
              const targetPath = path.join(backupPath, domainName);
              await this.copyDirectory(sourcePath, targetPath);
              console.log(chalk.green(`✅ Backed up ${domainName} to ${backupPath}`));
            }
          } catch (error) {
            // Directory doesn't exist, skip
            console.log(chalk.gray(`ℹ️  No existing data for ${path.basename(sourcePath)}`));
          }
        }
      }

      // Clear the specified domains
      const domainsToClear = domain === 'all' ? ['construction', 'cybersec'] : [domain];
      
      for (const domainName of domainsTolear) {
        const domainPath = path.join(this.dataPath, domainName);
        
        try {
          await fs.rm(domainPath, { recursive: true, force: true });
          console.log(chalk.green(`✅ Cleared ${domainName} domain`));
        } catch (error) {
          console.log(chalk.gray(`ℹ️  No existing data for ${domainName} domain`));
        }

        // Recreate empty directory structure
        await fs.mkdir(path.join(domainPath, 'context'), { recursive: true });
        await fs.mkdir(path.join(domainPath, 'conversations'), { recursive: true });
        await fs.mkdir(path.join(domainPath, 'entities'), { recursive: true });
        
        console.log(chalk.blue(`📁 Recreated directory structure for ${domainName}`));
      }

      console.log(chalk.green.bold('\n🎉 Context database cleared successfully!'));
      
      if (backup) {
        console.log(chalk.yellow(`📦 Backup saved to: ${path.join(this.dataPath, `backup-${domain}-*`)}`));
      }

    } catch (error) {
      console.error(chalk.red('❌ Clear operation failed:'), error.message);
      throw error;
    }
  }

  async copyDirectory(source, target) {
    await fs.mkdir(target, { recursive: true });
    const entries = await fs.readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const targetPath = path.join(target, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(sourcePath, targetPath);
      } else {
        await fs.copyFile(sourcePath, targetPath);
      }
    }
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
    
    console.log(chalk.cyan('\n📝 Context Queries (Smart Router):'));
    console.log('  query "text"                    - Process natural language context query (uses smart router)');
    console.log('  test query "text"               - Test query without executing actions');
    
    console.log(chalk.cyan('\n📊 Structured Data Routing:'));
    console.log('  data costs --project <id> --format json    - Get project cost data');
    console.log('  data projects --format json                - List all projects');
    console.log('  data materials --project <id>              - Get materials data');
    
    console.log(chalk.cyan('\n🔍 Smart Discovery:'));
    console.log('  discover projects --person <name> --location <loc>  - Discover existing projects');
    console.log('  discover people --project <id>                      - Discover people in project');
    console.log('  discover relationships --entity <name>              - Discover entity relationships');
    
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
    
    console.log(chalk.cyan('\n🗑️  Database Management:'));
    console.log('  clear --domain <domain> --confirm  - Clear context database');
    console.log('    --domain: construction, cybersec, or all');
    console.log('    --backup: Create backup before clearing (default: true)');
    
    console.log(chalk.yellow('\n💡 Smart Router Examples:'));
    console.log(chalk.grey('  # Conceptual queries (Context DB relationships)'));
    console.log(chalk.grey('  node context.js query "What are cost components for John\'s deck?"'));
    console.log(chalk.grey(''));
    console.log(chalk.grey('  # Structured data routing (Source Systems with full fidelity)'));
    console.log(chalk.grey('  node context.js data costs --project john-deck --format json'));
    console.log(chalk.grey(''));
    console.log(chalk.grey('  # Smart discovery (Context DB + External Sources)'));
    console.log(chalk.grey('  node context.js discover projects --person john --location deck'));
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
        })
        .option('smart-router', {
          type: 'boolean',
          description: 'Use smart router (default: true)',
          default: true
        });
    })
    .command('data <type>', 'Structured data routing commands', (yargs) => {
      return yargs
        .positional('type', {
          describe: 'Data type to retrieve',
          choices: ['costs', 'projects', 'materials']
        })
        .option('project', {
          alias: 'p',
          type: 'string',
          description: 'Project ID'
        })
        .option('format', {
          alias: 'f',
          type: 'string',
          description: 'Output format',
          choices: ['json', 'table'],
          default: 'table'
        });
    })
    .command('discover <type>', 'Smart discovery commands', (yargs) => {
      return yargs
        .positional('type', {
          describe: 'Discovery type',
          choices: ['projects', 'people', 'relationships']
        })
        .option('person', {
          type: 'string',
          description: 'Person name for project discovery'
        })
        .option('location', {
          type: 'string',
          description: 'Location for project discovery'
        })
        .option('project', {
          alias: 'p',
          type: 'string',
          description: 'Project ID for people discovery'
        })
        .option('entity', {
          alias: 'e',
          type: 'string',
          description: 'Entity name for relationship discovery'
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
    .command('clear', 'Clear context database', (yargs) => {
      return yargs
        .option('domain', {
          type: 'string',
          description: 'Domain to clear (construction, cybersec, or all)',
          choices: ['construction', 'cybersec', 'all'],
          default: 'all'
        })
        .option('confirm', {
          type: 'boolean',
          description: 'Confirm the clear operation',
          default: false
        })
        .option('backup', {
          type: 'boolean',
          description: 'Create backup before clearing',
          default: true
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
          userId: argv.userId,
          useSmartRouter: argv.smartRouter
        });
        break;
        
      case 'data':
        await cli.handleDataCommand(argv.type, {
          project: argv.project,
          format: argv.format
        });
        break;
        
      case 'discover':
        await cli.handleDiscoverCommand(argv.type, {
          person: argv.person,
          location: argv.location,
          project: argv.project,
          entity: argv.entity
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
        
      case 'clear':
        await cli.handleClear({
          domain: argv.domain,
          confirm: argv.confirm,
          backup: argv.backup
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
