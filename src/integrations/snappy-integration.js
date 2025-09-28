/**
 * Snappy Integration Module
 * 
 * Bidirectional sync between Snappy project management and Context Intelligence system.
 * Implements Architecture Principle #3 from notes-evolution-architecture.md
 */

import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import crypto from 'crypto';

export class SnappyIntegration {
  constructor(options = {}) {
    this.snappyPath = options.snappyPath || path.resolve(process.cwd(), '..', 'snappy');
    this.projectsDir = path.join(this.snappyPath, 'projects');
    this.clientProjectsDir = path.join(this.snappyPath, 'client-projects');
    this.subscriptionsDir = path.join(this.snappyPath, 'subscriptions');
    this.ciDataPath = options.ciDataPath || path.join(process.cwd(), 'data', 'snappy-sync');
    
    // Ensure CI data directory exists
    this.ensureCIDataDir();
  }

  async ensureCIDataDir() {
    try {
      await fs.mkdir(this.ciDataPath, { recursive: true });
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Could not create CI data directory:', error.message));
    }
  }

  /**
   * Export Snappy project data in CI-compatible format
   */
  async exportForCI(projectId) {
    console.log(chalk.blue(`📤 Exporting project ${projectId} for CI system`));

    try {
      const projectPath = path.join(this.projectsDir, projectId);
      const projectJsonPath = path.join(projectPath, 'project.json');

      // Check if project exists
      try {
        await fs.access(projectJsonPath);
      } catch (error) {
        throw new Error(`Project '${projectId}' not found in Snappy`);
      }

      // Read project metadata
      const projectData = JSON.parse(await fs.readFile(projectJsonPath, 'utf-8'));

      // Extract entities from project files
      const entities = await this.extractProjectEntities(projectPath, projectData);

      // Create CI-compatible export
      const ciExport = {
        project: {
          id: projectId,
          name: `${projectData.clientName} - ${projectData.projectType}`,
          status: projectData.status,
          lastModified: projectData.updatedAt,
          entities: entities,
          metadata: {
            clientName: projectData.clientName,
            projectType: projectData.projectType,
            createdAt: projectData.createdAt,
            updatedAt: projectData.updatedAt
          }
        },
        syncHash: await this.calculateProjectHash(projectPath),
        ciLastSync: new Date().toISOString(),
        exportedAt: new Date().toISOString()
      };

      // Save CI export
      const exportPath = path.join(this.ciDataPath, `${projectId}-export.json`);
      await fs.writeFile(exportPath, JSON.stringify(ciExport, null, 2));

      console.log(chalk.green(`✅ Project ${projectId} exported for CI`));
      console.log(chalk.grey(`   Export saved to: ${exportPath}`));
      console.log(chalk.grey(`   Entities found: ${Object.keys(entities).reduce((sum, key) => sum + entities[key].length, 0)}`));

      return ciExport;
    } catch (error) {
      console.error(chalk.red(`❌ Failed to export project ${projectId}:`, error.message));
      throw error;
    }
  }

  /**
   * Extract entities from project files for CI system
   */
  async extractProjectEntities(projectPath, projectData) {
    const entities = {
      people: [],
      locations: [],
      materials: [],
      timeline: [],
      costs: [],
      tasks: [],
      documents: []
    };

    try {
      // Add primary entities from project metadata
      entities.people.push({
        name: projectData.clientName,
        type: 'client',
        role: 'project_owner',
        confidence: 1.0,
        source: 'project_metadata'
      });

      // Extract from project files
      const files = await fs.readdir(projectPath);
      
      for (const file of files) {
        if (file.endsWith('.md')) {
          const filePath = path.join(projectPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          
          // Extract entities from markdown content
          await this.extractEntitiesFromContent(content, file, entities);
        }
      }

      // Extract from cost-breakdown.md if it exists
      const costBreakdownPath = path.join(projectPath, 'cost-breakdown.md');
      try {
        const costContent = await fs.readFile(costBreakdownPath, 'utf-8');
        await this.extractCostEntities(costContent, entities);
      } catch (error) {
        // cost-breakdown.md doesn't exist, skip
      }

      return entities;
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Could not extract entities from ${projectPath}:`, error.message));
      return entities;
    }
  }

  /**
   * Extract entities from markdown content
   */
  async extractEntitiesFromContent(content, filename, entities) {
    const lines = content.split('\n');
    
    for (const line of lines) {
      // Extract materials (look for $ amounts and material keywords)
      const materialMatch = line.match(/(\w+\s+\w*)\s*[:]\s*\$(\d+\.?\d*)/i);
      if (materialMatch) {
        entities.materials.push({
          name: materialMatch[1].trim(),
          cost: parseFloat(materialMatch[2]),
          source: filename,
          confidence: 0.8
        });
      }

      // Extract locations (look for addresses)
      const addressMatch = line.match(/(\d+\s+[A-Za-z\s]+(?:Dr|St|Ave|Rd|Ln|Ct|Way|Blvd))/i);
      if (addressMatch) {
        entities.locations.push({
          name: addressMatch[1].trim(),
          type: 'address',
          source: filename,
          confidence: 0.9
        });
      }

      // Extract timeline items (look for dates)
      const dateMatch = line.match(/(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/);
      if (dateMatch) {
        entities.timeline.push({
          date: dateMatch[1],
          description: line.trim(),
          source: filename,
          confidence: 0.7
        });
      }

      // Extract tasks (look for action items)
      if (line.match(/^[\s]*[-*]\s+/)) {
        const task = line.replace(/^[\s]*[-*]\s+/, '').trim();
        if (task.length > 5) {
          entities.tasks.push({
            description: task,
            status: 'pending',
            source: filename,
            confidence: 0.6
          });
        }
      }
    }
  }

  /**
   * Extract cost entities from cost-breakdown.md
   */
  async extractCostEntities(content, entities) {
    const lines = content.split('\n');
    
    for (const line of lines) {
      // Extract labor costs
      const laborMatch = line.match(/^[-*]\s*(.+?):\s*(\d+(?:\.\d+)?)\s*hours?\s*@\s*\$(\d+(?:\.\d+)?)/i);
      if (laborMatch) {
        entities.costs.push({
          type: 'labor',
          description: laborMatch[1].trim(),
          hours: parseFloat(laborMatch[2]),
          rate: parseFloat(laborMatch[3]),
          total: parseFloat(laborMatch[2]) * parseFloat(laborMatch[3]),
          source: 'cost-breakdown.md',
          confidence: 0.95
        });
      }

      // Extract material costs
      const materialCostMatch = line.match(/^[-*]\s*(.+?):\s*\$(\d+(?:\.\d+)?)/i);
      if (materialCostMatch) {
        entities.costs.push({
          type: 'material',
          description: materialCostMatch[1].trim(),
          amount: parseFloat(materialCostMatch[2]),
          source: 'cost-breakdown.md',
          confidence: 0.9
        });
      }

      // Extract project totals
      const totalMatch = line.match(/\*\*(TOTAL|LABOR|MATERIALS):\*\*\s*\$(\d+(?:\.\d+)?)/i);
      if (totalMatch) {
        entities.costs.push({
          type: 'total',
          category: totalMatch[1].toLowerCase(),
          amount: parseFloat(totalMatch[2]),
          source: 'cost-breakdown.md',
          confidence: 1.0
        });
      }
    }
  }

  /**
   * Calculate hash for project files to detect changes
   */
  async calculateProjectHash(projectPath) {
    try {
      const files = await fs.readdir(projectPath);
      const hash = crypto.createHash('sha256');
      
      // Sort files for consistent hashing
      files.sort();
      
      for (const file of files) {
        if (file.endsWith('.md') || file === 'project.json') {
          const filePath = path.join(projectPath, file);
          const stats = await fs.stat(filePath);
          const content = await fs.readFile(filePath, 'utf-8');
          
          // Hash file name, modification time, and content
          hash.update(`${file}:${stats.mtime.toISOString()}:${content}`);
        }
      }
      
      return hash.digest('hex');
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Could not calculate hash for ${projectPath}:`, error.message));
      return 'unknown';
    }
  }

  /**
   * Check synchronization status with CI system
   */
  async checkSyncStatus(allProjects = false) {
    console.log(chalk.blue('🔍 Checking Snappy sync status'));

    try {
      const status = {
        projects: {},
        lastCheck: new Date().toISOString(),
        summary: {
          total: 0,
          upToDate: 0,
          needsSync: 0,
          conflicts: 0
        }
      };

      // Get all projects
      const projectDirs = await fs.readdir(this.projectsDir, { withFileTypes: true });
      
      for (const dir of projectDirs) {
        if (dir.isDirectory()) {
          const projectId = dir.name;
          const projectStatus = await this.checkProjectSyncStatus(projectId);
          status.projects[projectId] = projectStatus;
          status.summary.total++;
          
          if (projectStatus.status === 'up_to_date') {
            status.summary.upToDate++;
          } else if (projectStatus.status === 'needs_sync') {
            status.summary.needsSync++;
          } else if (projectStatus.status === 'conflict') {
            status.summary.conflicts++;
          }
        }
      }

      this.displaySyncStatus(status);
      return status;
    } catch (error) {
      console.error(chalk.red('❌ Failed to check sync status:'), error.message);
      throw error;
    }
  }

  /**
   * Check sync status for a specific project
   */
  async checkProjectSyncStatus(projectId) {
    try {
      const projectPath = path.join(this.projectsDir, projectId);
      const exportPath = path.join(this.ciDataPath, `${projectId}-export.json`);
      
      // Calculate current hash
      const currentHash = await this.calculateProjectHash(projectPath);
      
      // Check if export exists
      try {
        const exportData = JSON.parse(await fs.readFile(exportPath, 'utf-8'));
        const lastSyncHash = exportData.syncHash;
        
        return {
          projectId,
          status: currentHash === lastSyncHash ? 'up_to_date' : 'needs_sync',
          currentHash,
          lastSyncHash,
          lastSync: exportData.ciLastSync,
          hasExport: true
        };
      } catch (error) {
        return {
          projectId,
          status: 'never_synced',
          currentHash,
          lastSyncHash: null,
          lastSync: null,
          hasExport: false
        };
      }
    } catch (error) {
      return {
        projectId,
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Display sync status in a readable format
   */
  displaySyncStatus(status) {
    console.log(chalk.yellow('\n📊 Sync Status Summary:'));
    console.log(`  Total projects: ${status.summary.total}`);
    console.log(chalk.green(`  Up to date: ${status.summary.upToDate}`));
    console.log(chalk.yellow(`  Needs sync: ${status.summary.needsSync}`));
    console.log(chalk.red(`  Conflicts: ${status.summary.conflicts}`));

    console.log(chalk.yellow('\n📋 Project Details:'));
    Object.values(status.projects).forEach(project => {
      const statusIcon = project.status === 'up_to_date' ? chalk.green('✅') :
                        project.status === 'needs_sync' ? chalk.yellow('⚠️') :
                        project.status === 'never_synced' ? chalk.blue('🆕') :
                        chalk.red('❌');
      
      console.log(`${statusIcon} ${project.projectId} - ${project.status}`);
      if (project.lastSync) {
        console.log(chalk.grey(`    Last sync: ${new Date(project.lastSync).toLocaleString()}`));
      }
    });
  }

  /**
   * Pull insights from CI system back to Snappy
   */
  async pullInsights(projectId) {
    console.log(chalk.blue(`📥 Pulling CI insights for project ${projectId}`));

    try {
      const insightsPath = path.join(this.ciDataPath, `${projectId}-insights.json`);
      
      // Check if insights exist
      try {
        const insights = JSON.parse(await fs.readFile(insightsPath, 'utf-8'));
        
        // Apply insights to Snappy project
        await this.applyInsightsToProject(projectId, insights);
        
        console.log(chalk.green(`✅ Applied CI insights to project ${projectId}`));
        return insights;
      } catch (error) {
        console.log(chalk.grey(`ℹ️  No CI insights found for project ${projectId}`));
        return null;
      }
    } catch (error) {
      console.error(chalk.red(`❌ Failed to pull insights for ${projectId}:`, error.message));
      throw error;
    }
  }

  /**
   * Apply CI insights to Snappy project
   */
  async applyInsightsToProject(projectId, insights) {
    const projectPath = path.join(this.projectsDir, projectId);
    const insightsFilePath = path.join(projectPath, 'ci-insights.md');

    let content = `# CI System Insights\n\n`;
    content += `**Generated:** ${new Date().toLocaleString()}\n\n`;

    if (insights.newEntities && insights.newEntities.length > 0) {
      content += `## New Entities Discovered\n\n`;
      insights.newEntities.forEach(entity => {
        content += `- **${entity.name}** (${entity.type}) - Confidence: ${(entity.confidence * 100).toFixed(1)}%\n`;
      });
      content += '\n';
    }

    if (insights.relationships && insights.relationships.length > 0) {
      content += `## Discovered Relationships\n\n`;
      insights.relationships.forEach(rel => {
        content += `- ${rel.source} → ${rel.type} → ${rel.target}\n`;
      });
      content += '\n';
    }

    if (insights.suggestions && insights.suggestions.length > 0) {
      content += `## AI Suggestions\n\n`;
      insights.suggestions.forEach(suggestion => {
        content += `- ${suggestion}\n`;
      });
      content += '\n';
    }

    await fs.writeFile(insightsFilePath, content);
  }

  /**
   * Push updates from Snappy to CI system
   */
  async pushUpdates(projectId) {
    console.log(chalk.blue(`📤 Pushing updates for project ${projectId} to CI`));

    try {
      // Re-export the project with latest data
      const exportData = await this.exportForCI(projectId);
      
      console.log(chalk.green(`✅ Pushed updates for project ${projectId} to CI`));
      return exportData;
    } catch (error) {
      console.error(chalk.red(`❌ Failed to push updates for ${projectId}:`, error.message));
      throw error;
    }
  }

  /**
   * Validate sync consistency
   */
  async validateSyncConsistency(targetThreshold = 1.0) {
    console.log(chalk.blue('🔍 Validating sync consistency'));

    try {
      const status = await this.checkSyncStatus();
      const consistency = status.summary.upToDate / status.summary.total;
      
      console.log(chalk.yellow(`\n📊 Sync Consistency: ${(consistency * 100).toFixed(1)}%`));
      
      if (consistency >= targetThreshold) {
        console.log(chalk.green(`✅ Sync consistency meets target (${(targetThreshold * 100).toFixed(1)}%)`));
      } else {
        console.log(chalk.red(`❌ Sync consistency below target (${(targetThreshold * 100).toFixed(1)}%)`));
      }

      return consistency;
    } catch (error) {
      console.error(chalk.red('❌ Failed to validate sync consistency:'), error.message);
      return 0;
    }
  }

  /**
   * Validate sync with options
   */
  async validateSync(options = {}) {
    if (options.checkHashes) {
      return await this.validateSyncConsistency();
    }
    
    return await this.checkSyncStatus();
  }
}
