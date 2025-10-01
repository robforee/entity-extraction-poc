/**
 * Snappy Hash-Status Client
 * 
 * Leverages Snappy's hash-status self-documenting pattern for:
 * - Efficient change detection
 * - Lazy-loading data synchronization
 * - Self-discovering API capabilities
 * - Minimal bandwidth usage
 * 
 * Implements the hash-status pattern from /home/robforee/analyst-server/docs/hash-status-pattern.md
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import chalk from 'chalk';
import crypto from 'crypto';

const execAsync = promisify(exec);

export class SnappyHashStatusClient {
  constructor(options = {}) {
    this.snappyPath = options.snappyPath || path.resolve(process.cwd(), '..', 'snappy');
    this.cachePath = options.cachePath || path.join(process.cwd(), 'data', 'snappy-cache');
    this.cacheFile = path.join(this.cachePath, 'hash-status-cache.json');
    
    // In-memory cache for hash-status responses
    this.cache = {
      root: null,
      sections: {},
      data: {},
      lastUpdate: null
    };
    
    this.initialized = false;
  }

  /**
   * Initialize the client and load cached hashes
   */
  async initialize() {
    if (this.initialized) return;
    
    console.log(chalk.blue('🔧 Initializing Snappy Hash-Status Client...'));
    
    // Ensure cache directory exists
    await fs.mkdir(this.cachePath, { recursive: true });
    
    // Load cached hashes if they exist
    try {
      const cacheData = await fs.readFile(this.cacheFile, 'utf-8');
      this.cache = JSON.parse(cacheData);
      console.log(chalk.grey(`   Loaded cached hashes from ${new Date(this.cache.lastUpdate).toLocaleString()}`));
    } catch (error) {
      console.log(chalk.grey('   No cache found, will perform full sync'));
    }
    
    this.initialized = true;
  }

  /**
   * Execute snappy command and return parsed JSON
   */
  async executeSnappyCommand(command) {
    const fullCommand = `node snappy.js ${command}`;
    const { stdout } = await execAsync(fullCommand, { cwd: this.snappyPath });
    return JSON.parse(stdout);
  }

  /**
   * Get root hash-status (entry point)
   */
  async getRootHashStatus() {
    console.log(chalk.cyan('📊 Fetching root hash-status...'));
    const rootStatus = await this.executeSnappyCommand('hash-status');
    // Don't overwrite cache here - let detectChanges/syncChanges handle it
    return rootStatus;
  }

  /**
   * Check what has changed since last sync
   */
  async detectChanges() {
    await this.initialize();
    
    console.log(chalk.blue.bold('\n🔍 Detecting Changes in Snappy...'));
    console.log(chalk.blue('=' .repeat(60)));
    
    // Check if we have a previous cache BEFORE fetching current root
    const hadPreviousCache = this.cache.root && this.cache.lastUpdate;
    
    const currentRoot = await this.getRootHashStatus();
    const changes = {
      hasChanges: false,
      sections: {},
      timestamp: new Date().toISOString()
    };

    // If no previous cache, everything is new
    if (!hadPreviousCache) {
      console.log(chalk.yellow('   No previous cache - treating all data as new'));
      changes.hasChanges = true;
      changes.sections = {
        cmds: { changed: true, reason: 'initial_sync' },
        config: { changed: true, reason: 'initial_sync' },
        structure: { changed: true, reason: 'initial_sync' },
        data: { changed: true, reason: 'initial_sync' },
        docs: { changed: true, reason: 'initial_sync' }
      };
      return changes;
    }
    
    // Get the previous root hash for comparison
    const previousRoot = this.cache.root;

    // Compare root hash
    if (currentRoot.hash !== previousRoot.hash) {
      console.log(chalk.yellow('   Root hash changed - drilling down to find specific changes'));
      changes.hasChanges = true;

      // Check each section
      for (const section of ['cmds', 'config', 'structure', 'data', 'docs']) {
        const currentHash = currentRoot[section]?.hash;
        const cachedHash = previousRoot[section]?.hash;
        
        if (currentHash !== cachedHash) {
          changes.sections[section] = {
            changed: true,
            currentHash,
            previousHash: cachedHash,
            reason: 'hash_mismatch'
          };
          console.log(chalk.yellow(`   ✓ ${section} has changed`));
        } else {
          changes.sections[section] = {
            changed: false,
            currentHash
          };
          console.log(chalk.grey(`   - ${section} unchanged`));
        }
      }
    } else {
      console.log(chalk.green('   ✓ No changes detected - all hashes match'));
    }

    return changes;
  }

  /**
   * Sync only changed data (lazy loading)
   */
  async syncChanges(changes) {
    if (!changes.hasChanges) {
      console.log(chalk.green('\n✅ No sync needed - everything up to date'));
      return { synced: 0, skipped: 0 };
    }

    console.log(chalk.blue.bold('\n📥 Syncing Changed Data...'));
    console.log(chalk.blue('=' .repeat(60)));

    const syncResults = {
      synced: 0,
      skipped: 0,
      details: {}
    };

    // Sync data section if changed (most important for Context DB)
    if (changes.sections.data?.changed) {
      console.log(chalk.cyan('\n📦 Syncing data section...'));
      const dataSync = await this.syncDataSection();
      syncResults.details.data = dataSync;
      syncResults.synced += dataSync.synced;
    } else {
      console.log(chalk.grey('\n📦 Data section unchanged - skipping'));
      syncResults.skipped++;
    }

    // Sync structure section if changed (important for schema changes)
    if (changes.sections.structure?.changed) {
      console.log(chalk.cyan('\n🏗️  Syncing structure section...'));
      const structureSync = await this.syncStructureSection();
      syncResults.details.structure = structureSync;
      syncResults.synced += structureSync.synced;
    } else {
      console.log(chalk.grey('\n🏗️  Structure section unchanged - skipping'));
      syncResults.skipped++;
    }

    // Sync commands section if changed (API discovery)
    if (changes.sections.cmds?.changed) {
      console.log(chalk.cyan('\n⚙️  Syncing commands section...'));
      const cmdsSync = await this.syncCommandsSection();
      syncResults.details.cmds = cmdsSync;
      syncResults.synced += cmdsSync.synced;
    } else {
      console.log(chalk.grey('\n⚙️  Commands section unchanged - skipping'));
      syncResults.skipped++;
    }

    // Update cache with new root hash
    this.cache.root = await this.getRootHashStatus();
    this.cache.lastUpdate = new Date().toISOString();
    await this.saveCache();

    console.log(chalk.green(`\n✅ Sync complete: ${syncResults.synced} sections synced, ${syncResults.skipped} skipped`));
    return syncResults;
  }

  /**
   * Sync data section - drill down to individual projects
   */
  async syncDataSection() {
    console.log(chalk.blue('   Drilling down into data section...'));
    
    const dataDetails = await this.executeSnappyCommand('hash-status --drill-down data');
    const syncResults = {
      synced: 0,
      unchanged: 0,
      projects: []
    };

    // Get cached data hashes
    const cachedData = this.cache.sections.data || {};

    // Check each project
    for (const [projectId, projectInfo] of Object.entries(dataDetails)) {
      if (projectId === '.gitkeep') continue; // Skip .gitkeep

      const currentHash = projectInfo.hash;
      const cachedHash = cachedData[projectId];

      if (currentHash !== cachedHash && currentHash !== 'error_hashing') {
        // Project changed - fetch full data
        console.log(chalk.yellow(`   → Fetching changed project: ${projectId}`));
        try {
          const projectData = await this.executeSnappyCommand(`project ${projectId} --properties json`);
          
          // Store in cache.data for future use
          if (!this.cache.data) this.cache.data = {};
          this.cache.data[projectId] = projectData;
          
          syncResults.projects.push({
            id: projectId,
            hash: currentHash,
            data: projectData,
            status: 'synced'
          });
          syncResults.synced++;
        } catch (error) {
          console.warn(chalk.red(`   ✗ Failed to fetch ${projectId}: ${error.message}`));
          syncResults.projects.push({
            id: projectId,
            hash: currentHash,
            status: 'error',
            error: error.message
          });
        }
      } else {
        syncResults.unchanged++;
      }
    }

    // Update cached data hashes
    this.cache.sections.data = dataDetails;

    console.log(chalk.grey(`   Synced ${syncResults.synced} projects, ${syncResults.unchanged} unchanged`));
    return syncResults;
  }

  /**
   * Sync structure section - get project type definitions
   */
  async syncStructureSection() {
    console.log(chalk.blue('   Drilling down into structure section...'));
    
    const structureDetails = await this.executeSnappyCommand('hash-status --drill-down structure');
    const syncResults = {
      synced: 0,
      types: {}
    };

    // Fetch each project type structure
    for (const [typeName, typeInfo] of Object.entries(structureDetails)) {
      console.log(chalk.yellow(`   → Fetching structure: ${typeName}`));
      try {
        const typeStructure = await this.executeSnappyCommand(`database project-types ${typeName} --format json`);
        syncResults.types[typeName] = {
          hash: typeInfo.hash,
          structure: typeStructure
        };
        syncResults.synced++;
      } catch (error) {
        console.warn(chalk.red(`   ✗ Failed to fetch ${typeName}: ${error.message}`));
      }
    }

    // Update cached structure
    this.cache.sections.structure = structureDetails;

    console.log(chalk.grey(`   Synced ${syncResults.synced} structure types`));
    return syncResults;
  }

  /**
   * Sync commands section - discover available operations
   */
  async syncCommandsSection() {
    console.log(chalk.blue('   Drilling down into commands section...'));
    
    const cmdsDetails = await this.executeSnappyCommand('hash-status --drill-down cmds');
    const syncResults = {
      synced: 1,
      commands: cmdsDetails
    };

    // Update cached commands
    this.cache.sections.cmds = cmdsDetails;

    const totalCommands = Object.values(cmdsDetails).reduce((sum, group) => {
      return sum + (group.commands?.length || 0);
    }, 0);

    console.log(chalk.grey(`   Discovered ${totalCommands} available commands`));
    return syncResults;
  }

  /**
   * Get specific project data (with caching)
   * @param {string} projectId - The project ID
   * @param {boolean} forceRefresh - Force fetch even if cached (default: false)
   */
  async getProject(projectId, forceRefresh = false) {
    await this.initialize();
    
    // If we have cached data and not forcing refresh, use it
    if (!forceRefresh && this.cache.data?.[projectId]) {
      console.log(chalk.grey(`   Using cached data for ${projectId}`));
      return this.cache.data[projectId];
    }

    // Fetch fresh data
    console.log(chalk.blue(`   Fetching fresh data for ${projectId}`));
    const projectData = await this.executeSnappyCommand(`project ${projectId} --properties json`);
    
    // Cache the data
    if (!this.cache.data) this.cache.data = {};
    this.cache.data[projectId] = projectData;
    
    return projectData;
  }

  /**
   * Get all projects from cache (no fetching)
   */
  async getAllCachedProjects() {
    await this.initialize();
    return this.cache.data || {};
  }

  /**
   * Get all available commands (self-documenting API)
   */
  async getAvailableCommands() {
    await this.initialize();
    
    const cmdsDetails = await this.executeSnappyCommand('hash-status --drill-down cmds');
    return cmdsDetails;
  }

  /**
   * Get project type structures (schema information)
   */
  async getProjectTypeStructures() {
    await this.initialize();
    
    const structureDetails = await this.executeSnappyCommand('hash-status --drill-down structure');
    return structureDetails;
  }

  /**
   * Save cache to disk
   */
  async saveCache() {
    try {
      await fs.writeFile(this.cacheFile, JSON.stringify(this.cache, null, 2));
      console.log(chalk.grey(`   Cache saved to ${this.cacheFile}`));
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Failed to save cache: ${error.message}`));
    }
  }

  /**
   * Clear cache (force full resync)
   */
  async clearCache() {
    this.cache = {
      root: null,
      sections: {},
      data: {},
      lastUpdate: null
    };
    
    try {
      await fs.unlink(this.cacheFile);
      console.log(chalk.green('✅ Cache cleared'));
    } catch (error) {
      // Cache file doesn't exist, that's fine
    }
  }

  /**
   * Get sync statistics
   */
  getSyncStats() {
    return {
      lastUpdate: this.cache.lastUpdate,
      cachedProjects: Object.keys(this.cache.sections.data || {}).length,
      cachedStructures: Object.keys(this.cache.sections.structure || {}).length,
      cacheSize: JSON.stringify(this.cache).length
    };
  }

  /**
   * Full sync workflow - detect and sync changes
   */
  async performFullSync() {
    console.log(chalk.blue.bold('\n🔄 Starting Full Sync with Snappy...'));
    console.log(chalk.blue('=' .repeat(60)));
    
    const startTime = Date.now();
    
    // Step 1: Detect changes
    const changes = await this.detectChanges();
    
    // Step 2: Sync only what changed
    const syncResults = await this.syncChanges(changes);
    
    const duration = Date.now() - startTime;
    
    console.log(chalk.green.bold(`\n✅ Full sync completed in ${duration}ms`));
    console.log(chalk.grey(`   Bandwidth saved by skipping ${syncResults.skipped} unchanged sections`));
    
    return {
      changes,
      syncResults,
      duration,
      stats: this.getSyncStats()
    };
  }
}
