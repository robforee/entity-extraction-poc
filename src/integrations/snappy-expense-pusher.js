/**
 * Snappy Expense Pusher
 * 
 * Handles pushing completed expense/charge requests to Snappy projects.
 * Integrates with the existing Snappy system to add charges and track expenses.
 */

import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

class SnappyExpensePusher {
  constructor(options = {}) {
    this.snappyPath = options.snappyPath || path.resolve(process.cwd(), '..', 'snappy');
    this.projectsPath = path.join(this.snappyPath, 'projects');
    this.clientProjectsPath = path.join(this.snappyPath, 'client-projects');
  }

  /**
   * Push a completed expense to the appropriate Snappy project
   */
  async pushExpenseToSnappy(completedRequest, completion) {
    try {
      console.log(chalk.blue('📤 Pushing expense to Snappy...'));
      
      // Extract expense data
      const expenseData = this.extractExpenseData(completedRequest, completion);
      
      // Find or create project
      const projectPath = await this.findOrCreateProject(expenseData.projectName);
      
      // Add expense to project
      await this.addExpenseToProject(projectPath, expenseData);
      
      console.log(chalk.green(`✅ Expense pushed to Snappy project: ${expenseData.projectName}`));
      
      return {
        success: true,
        projectPath,
        expenseData,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to push expense to Snappy:'), error.message);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Extract expense data from completed request
   */
  extractExpenseData(completedRequest, completion) {
    const combinedData = completion.combinedData;
    
    // Extract amount
    const amount = combinedData.amounts?.[0] || { value: 0, currency: 'USD' };
    
    // Extract item/description
    const item = combinedData.items?.[0]?.name || 'Unspecified item';
    
    // Extract project name
    let projectName = 'Unknown Project';
    if (combinedData.projects?.[0]) {
      projectName = combinedData.projects[0].name;
    } else if (combinedData.locations?.[0]) {
      projectName = this.inferProjectFromLocation(combinedData.locations[0].name);
    } else if (combinedData.people?.[0]) {
      projectName = `${combinedData.people[0].name} Project`;
    }
    
    // Extract location/person context
    const location = combinedData.locations?.[0]?.name || 'Unknown location';
    const person = combinedData.people?.[0]?.name || 'Unknown person';
    
    return {
      amount: amount.value,
      currency: amount.currency || 'USD',
      item,
      description: `${item} - ${completedRequest.originalQuery}`,
      projectName: this.sanitizeProjectName(projectName),
      location,
      person,
      originalQuery: completedRequest.originalQuery,
      timestamp: new Date().toISOString(),
      source: 'context-system'
    };
  }

  /**
   * Infer project name from location
   */
  inferProjectFromLocation(locationName) {
    // Handle possessive forms like "John's deck" -> "John Deck Project"
    if (locationName.includes("'s ")) {
      const parts = locationName.split("'s ");
      return `${parts[0]} ${parts[1]} Project`;
    }
    
    return `${locationName} Project`;
  }

  /**
   * Sanitize project name for file system
   */
  sanitizeProjectName(projectName) {
    return projectName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  /**
   * Find existing project or create new one
   */
  async findOrCreateProject(projectName) {
    const sanitizedName = this.sanitizeProjectName(projectName);
    
    // Check regular projects first
    const regularProjectPath = path.join(this.projectsPath, sanitizedName);
    if (await this.directoryExists(regularProjectPath)) {
      console.log(chalk.gray(`📁 Found existing project: ${sanitizedName}`));
      return regularProjectPath;
    }
    
    // Check client projects
    const clientProjectPath = path.join(this.clientProjectsPath, sanitizedName);
    if (await this.directoryExists(clientProjectPath)) {
      console.log(chalk.gray(`📁 Found existing client project: ${sanitizedName}`));
      return clientProjectPath;
    }
    
    // Create new project in regular projects
    await fs.mkdir(regularProjectPath, { recursive: true });
    
    // Create basic project structure
    await this.createProjectStructure(regularProjectPath, projectName);
    
    console.log(chalk.green(`📁 Created new project: ${sanitizedName}`));
    return regularProjectPath;
  }

  /**
   * Create basic project structure
   */
  async createProjectStructure(projectPath, displayName) {
    // Create project.json metadata
    const projectMetadata = {
      name: displayName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
      projectType: 'context-created',
      source: 'context-management-system'
    };
    
    await fs.writeFile(
      path.join(projectPath, 'project.json'),
      JSON.stringify(projectMetadata, null, 2)
    );
    
    // Create notes.md
    const notesContent = `# ${displayName}

## Project Overview
Project created automatically by Context Management System.

## Expenses
Expenses will be tracked below as they are added through the context system.

## Notes
- Created: ${new Date().toISOString()}
- Source: Context Management System
`;
    
    await fs.writeFile(path.join(projectPath, 'notes.md'), notesContent);
    
    // Create cost-breakdown.md
    const costBreakdownContent = `# Cost Breakdown - ${displayName}

## Materials
*Materials will be added automatically as expenses are tracked*

## Labor
*Labor costs will be tracked here*

## Project Totals
**MATERIALS:** $0.00
**LABOR:** $0.00
**TOTAL PROJECT COST:** $0.00

---
*Last updated: ${new Date().toISOString()}*
`;
    
    await fs.writeFile(path.join(projectPath, 'cost-breakdown.md'), costBreakdownContent);
  }

  /**
   * Add expense to project
   */
  async addExpenseToProject(projectPath, expenseData) {
    // Update cost-breakdown.md
    await this.updateCostBreakdown(projectPath, expenseData);
    
    // Update notes.md
    await this.updateProjectNotes(projectPath, expenseData);
    
    // Update project.json metadata
    await this.updateProjectMetadata(projectPath, expenseData);
  }

  /**
   * Update cost breakdown file
   */
  async updateCostBreakdown(projectPath, expenseData) {
    const costBreakdownPath = path.join(projectPath, 'cost-breakdown.md');
    
    try {
      let content = await fs.readFile(costBreakdownPath, 'utf8');
      
      // Find the Materials section and add the new expense
      const materialsSectionRegex = /## Materials\n(.*?)(?=\n## |$)/s;
      const match = content.match(materialsSectionRegex);
      
      if (match) {
        const currentMaterials = match[1];
        const newExpenseEntry = `\n**${expenseData.item}:** $${expenseData.amount.toFixed(2)}
  - Date: ${new Date(expenseData.timestamp).toLocaleDateString()}
  - Location: ${expenseData.location}
  - Notes: ${expenseData.originalQuery}`;
        
        const updatedMaterials = currentMaterials.includes('*Materials will be added automatically*') 
          ? newExpenseEntry 
          : currentMaterials + newExpenseEntry;
        
        content = content.replace(materialsSectionRegex, `## Materials\n${updatedMaterials}\n`);
      }
      
      // Update totals (simple approach - could be enhanced with proper parsing)
      const totalRegex = /\*\*MATERIALS:\*\* \$(\d+\.?\d*)/;
      const totalMatch = content.match(totalRegex);
      
      if (totalMatch) {
        const currentTotal = parseFloat(totalMatch[1]) || 0;
        const newTotal = currentTotal + expenseData.amount;
        content = content.replace(totalRegex, `**MATERIALS:** $${newTotal.toFixed(2)}`);
        
        // Update project total
        const projectTotalRegex = /\*\*TOTAL PROJECT COST:\*\* \$(\d+\.?\d*)/;
        const projectTotalMatch = content.match(projectTotalRegex);
        if (projectTotalMatch) {
          const currentProjectTotal = parseFloat(projectTotalMatch[1]) || 0;
          const newProjectTotal = currentProjectTotal + expenseData.amount;
          content = content.replace(projectTotalRegex, `**TOTAL PROJECT COST:** $${newProjectTotal.toFixed(2)}`);
        }
      }
      
      // Update timestamp
      content = content.replace(/\*Last updated:.*\*/, `*Last updated: ${new Date().toISOString()}*`);
      
      await fs.writeFile(costBreakdownPath, content);
      console.log(chalk.gray(`📝 Updated cost breakdown: +$${expenseData.amount.toFixed(2)}`));
      
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Failed to update cost breakdown:'), error.message);
    }
  }

  /**
   * Update project notes
   */
  async updateProjectNotes(projectPath, expenseData) {
    const notesPath = path.join(projectPath, 'notes.md');
    
    try {
      let content = await fs.readFile(notesPath, 'utf8');
      
      // Add expense entry to expenses section or create it
      const expenseEntry = `\n### ${new Date(expenseData.timestamp).toLocaleDateString()} - ${expenseData.item}
- **Amount:** $${expenseData.amount.toFixed(2)}
- **Location:** ${expenseData.location}
- **Query:** "${expenseData.originalQuery}"
- **Added via:** Context Management System\n`;

      if (content.includes('## Expenses')) {
        // Find expenses section and add entry
        const expensesSectionRegex = /(## Expenses\n)(.*?)(?=\n## |$)/s;
        const match = content.match(expensesSectionRegex);
        
        if (match) {
          const currentExpenses = match[2];
          const updatedExpenses = currentExpenses.includes('Expenses will be tracked below') 
            ? expenseEntry 
            : currentExpenses + expenseEntry;
          
          content = content.replace(expensesSectionRegex, `$1${updatedExpenses}\n`);
        }
      } else {
        // Add expenses section
        content += `\n## Expenses${expenseEntry}`;
      }
      
      await fs.writeFile(notesPath, content);
      console.log(chalk.gray(`📝 Updated project notes with expense entry`));
      
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Failed to update project notes:'), error.message);
    }
  }

  /**
   * Update project metadata
   */
  async updateProjectMetadata(projectPath, expenseData) {
    const metadataPath = path.join(projectPath, 'project.json');
    
    try {
      let metadata = {};
      
      try {
        const content = await fs.readFile(metadataPath, 'utf8');
        metadata = JSON.parse(content);
      } catch (error) {
        // File doesn't exist or is invalid, create new metadata
        metadata = {
          name: path.basename(projectPath),
          createdAt: new Date().toISOString(),
          projectType: 'context-created'
        };
      }
      
      // Update metadata
      metadata.updatedAt = new Date().toISOString();
      metadata.lastExpenseAdded = expenseData.timestamp;
      metadata.totalExpenses = (metadata.totalExpenses || 0) + expenseData.amount;
      metadata.expenseCount = (metadata.expenseCount || 0) + 1;
      
      if (!metadata.contextSystemIntegration) {
        metadata.contextSystemIntegration = {
          enabled: true,
          firstExpense: expenseData.timestamp,
          totalFromContext: expenseData.amount,
          expenseCountFromContext: 1
        };
      } else {
        metadata.contextSystemIntegration.totalFromContext += expenseData.amount;
        metadata.contextSystemIntegration.expenseCountFromContext += 1;
      }
      
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      console.log(chalk.gray(`📊 Updated project metadata`));
      
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Failed to update project metadata:'), error.message);
    }
  }

  /**
   * Check if directory exists
   */
  async directoryExists(dirPath) {
    try {
      const stat = await fs.stat(dirPath);
      return stat.isDirectory();
    } catch (error) {
      return false;
    }
  }

  /**
   * Get project summary for a given project name
   */
  async getProjectSummary(projectName) {
    const sanitizedName = this.sanitizeProjectName(projectName);
    
    // Check both regular and client projects
    const paths = [
      path.join(this.projectsPath, sanitizedName),
      path.join(this.clientProjectsPath, sanitizedName)
    ];
    
    for (const projectPath of paths) {
      if (await this.directoryExists(projectPath)) {
        try {
          const metadataPath = path.join(projectPath, 'project.json');
          const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
          
          return {
            name: metadata.name || projectName,
            path: projectPath,
            totalExpenses: metadata.totalExpenses || 0,
            expenseCount: metadata.expenseCount || 0,
            lastUpdated: metadata.updatedAt,
            contextIntegration: metadata.contextSystemIntegration || null
          };
        } catch (error) {
          console.warn(chalk.yellow(`⚠️  Failed to read project metadata: ${error.message}`));
        }
      }
    }
    
    return null;
  }
}

export { SnappyExpensePusher };
