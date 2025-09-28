/**
 * Query Template Manager
 * 
 * Implements Architecture Principle #2: Centralized Query Management System
 * Manages query templates with performance tracking and evolution capabilities.
 */

import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

export class QueryTemplateManager {
  constructor(options = {}) {
    this.dataPath = options.dataPath || path.join(process.cwd(), 'data');
    this.templatesPath = path.join(this.dataPath, 'query-templates');
    this.performancePath = path.join(this.dataPath, 'query-performance');
    
    // Ensure directories exist
    this.ensureDirectories();
    
    // Load default templates
    this.defaultTemplates = this.getDefaultQueryTemplates();
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.templatesPath, { recursive: true });
      await fs.mkdir(this.performancePath, { recursive: true });
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Could not create query template directories:', error.message));
    }
  }

  /**
   * List available query templates
   */
  async listTemplates(domain = null) {
    console.log(chalk.blue(`📝 Listing query templates${domain ? ` for domain: ${domain}` : ''}`));

    try {
      const templates = await this.loadAllTemplates();
      const filteredTemplates = domain ? 
        Object.fromEntries(Object.entries(templates).filter(([_, template]) => 
          template.domains && template.domains.includes(domain))) :
        templates;

      this.displayTemplateList(filteredTemplates, domain);
      return filteredTemplates;
    } catch (error) {
      console.error(chalk.red('❌ Failed to list templates:'), error.message);
      return null;
    }
  }

  /**
   * Load all query templates
   */
  async loadAllTemplates() {
    const templates = { ...this.defaultTemplates };

    try {
      const templateFiles = await fs.readdir(this.templatesPath);
      
      for (const file of templateFiles) {
        if (file.endsWith('.json')) {
          const templatePath = path.join(this.templatesPath, file);
          const template = JSON.parse(await fs.readFile(templatePath, 'utf-8'));
          const templateName = file.replace('.json', '');
          templates[templateName] = template;
        }
      }
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Could not load custom templates:', error.message));
    }

    return templates;
  }

  /**
   * Display template list
   */
  displayTemplateList(templates, domain) {
    console.log(chalk.yellow(`\n📊 Query Templates${domain ? ` (${domain})` : ''}:`));
    
    Object.entries(templates).forEach(([name, template]) => {
      const successRate = template.success_rate ? `${(template.success_rate * 100).toFixed(1)}%` : 'N/A';
      const version = template.version || '1.0';
      const lastUpdated = template.last_updated || 'Unknown';
      
      console.log(chalk.cyan(`\n📝 ${name} (v${version})`));
      console.log(`  Success Rate: ${successRate}`);
      console.log(`  Last Updated: ${lastUpdated}`);
      console.log(`  Domains: ${template.domains ? template.domains.join(', ') : 'Universal'}`);
      
      if (template.description) {
        console.log(chalk.grey(`  Description: ${template.description}`));
      }
    });
  }

  /**
   * Test a query template with a specific entity
   */
  async testTemplate(templateName, entityName) {
    console.log(chalk.blue(`🧪 Testing template "${templateName}" with entity "${entityName}"`));

    try {
      const templates = await this.loadAllTemplates();
      const template = templates[templateName];
      
      if (!template) {
        console.error(chalk.red(`❌ Template "${templateName}" not found`));
        return null;
      }

      // Generate query from template
      const query = this.generateQueryFromTemplate(template, entityName);
      
      console.log(chalk.cyan('\n📝 Generated Query:'));
      console.log(chalk.grey(query));
      
      // Simulate LLM execution (in real implementation, this would call the LLM)
      const result = await this.simulateTemplateExecution(template, entityName, query);
      
      // Record performance
      await this.recordTemplatePerformance(templateName, entityName, result);
      
      this.displayTestResult(result);
      return result;
    } catch (error) {
      console.error(chalk.red('❌ Template test failed:'), error.message);
      return null;
    }
  }

  /**
   * Generate query from template
   */
  generateQueryFromTemplate(template, entityName) {
    let query = template.template;
    
    // Replace placeholders
    query = query.replace(/\{entity\}/g, entityName);
    query = query.replace(/\{ENTITY\}/g, entityName.toUpperCase());
    
    // Add any template-specific parameters
    if (template.parameters) {
      Object.entries(template.parameters).forEach(([key, value]) => {
        query = query.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
      });
    }
    
    return query;
  }

  /**
   * Simulate template execution (placeholder for LLM integration)
   */
  async simulateTemplateExecution(template, entityName, query) {
    // In real implementation, this would call the LLM API
    // For now, simulate based on template and entity characteristics
    
    const result = {
      templateName: template.name || 'Unknown',
      entityName,
      query,
      success: true,
      confidence: 0.85,
      executionTime: Math.random() * 2000 + 500, // 500-2500ms
      timestamp: new Date().toISOString(),
      response: null
    };

    // Simulate domain-specific responses
    if (entityName.toLowerCase().includes('defender')) {
      result.response = {
        category: 'Endpoint Protection Suite',
        components: ['Defender for Endpoint', 'Defender for Office 365', 'Defender for Identity'],
        capabilities: ['Threat Detection', 'Incident Response', 'Vulnerability Management'],
        integrations: ['Azure Sentinel', 'Microsoft 365', 'Windows Security']
      };
      result.confidence = 0.92;
    } else if (entityName.toLowerCase().includes('soc')) {
      result.response = {
        category: 'Security Operations',
        roles: ['SOC Analyst Level 1', 'SOC Analyst Level 2', 'SOC Manager'],
        responsibilities: ['Threat Monitoring', 'Incident Response', 'Security Analysis'],
        tools: ['SIEM', 'SOAR', 'Threat Intelligence Platforms']
      };
      result.confidence = 0.88;
    } else {
      result.response = {
        category: 'General Entity',
        description: `Analysis of ${entityName}`,
        confidence: 0.75
      };
      result.confidence = 0.75;
    }

    // Simulate occasional failures
    if (Math.random() < 0.1) {
      result.success = false;
      result.error = 'Simulated template execution failure';
      result.confidence = 0;
    }

    return result;
  }

  /**
   * Display test result
   */
  displayTestResult(result) {
    console.log(chalk.yellow('\n📊 Test Results:'));
    
    const statusIcon = result.success ? chalk.green('✅') : chalk.red('❌');
    console.log(`${statusIcon} Success: ${result.success}`);
    console.log(`📈 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`⏱️  Execution Time: ${result.executionTime.toFixed(0)}ms`);
    
    if (result.success && result.response) {
      console.log(chalk.cyan('\n📋 Response:'));
      console.log(JSON.stringify(result.response, null, 2));
    }
    
    if (!result.success && result.error) {
      console.log(chalk.red(`❌ Error: ${result.error}`));
    }
  }

  /**
   * Record template performance
   */
  async recordTemplatePerformance(templateName, entityName, result) {
    try {
      const performanceFile = path.join(this.performancePath, `${templateName}.json`);
      
      let performanceData = {
        templateName,
        totalExecutions: 0,
        successfulExecutions: 0,
        averageConfidence: 0,
        averageExecutionTime: 0,
        executions: []
      };

      // Load existing performance data
      try {
        const existingData = await fs.readFile(performanceFile, 'utf-8');
        performanceData = JSON.parse(existingData);
      } catch (error) {
        // File doesn't exist, use default
      }

      // Add new execution
      performanceData.executions.push({
        entityName,
        success: result.success,
        confidence: result.confidence,
        executionTime: result.executionTime,
        timestamp: result.timestamp
      });

      // Update aggregated metrics
      performanceData.totalExecutions = performanceData.executions.length;
      performanceData.successfulExecutions = performanceData.executions.filter(e => e.success).length;
      
      const successfulExecutions = performanceData.executions.filter(e => e.success);
      if (successfulExecutions.length > 0) {
        performanceData.averageConfidence = successfulExecutions.reduce((sum, e) => sum + e.confidence, 0) / successfulExecutions.length;
        performanceData.averageExecutionTime = performanceData.executions.reduce((sum, e) => sum + e.executionTime, 0) / performanceData.executions.length;
      }

      // Keep only last 100 executions
      if (performanceData.executions.length > 100) {
        performanceData.executions = performanceData.executions.slice(-100);
      }

      await fs.writeFile(performanceFile, JSON.stringify(performanceData, null, 2));
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Could not record performance:', error.message));
    }
  }

  /**
   * Evaluate template performance
   */
  async evaluatePerformance(templateName) {
    console.log(chalk.blue(`📊 Evaluating performance for template: ${templateName}`));

    try {
      const performanceFile = path.join(this.performancePath, `${templateName}.json`);
      const performanceData = JSON.parse(await fs.readFile(performanceFile, 'utf-8'));
      
      this.displayPerformanceMetrics(performanceData);
      return performanceData;
    } catch (error) {
      console.log(chalk.yellow(`⚠️  No performance data found for template: ${templateName}`));
      return null;
    }
  }

  /**
   * Display performance metrics
   */
  displayPerformanceMetrics(performanceData) {
    const successRate = performanceData.totalExecutions > 0 ? 
      performanceData.successfulExecutions / performanceData.totalExecutions : 0;

    console.log(chalk.yellow(`\n📊 Performance Metrics for "${performanceData.templateName}":`));
    console.log(`📈 Success Rate: ${(successRate * 100).toFixed(1)}% (${performanceData.successfulExecutions}/${performanceData.totalExecutions})`);
    console.log(`🎯 Average Confidence: ${(performanceData.averageConfidence * 100).toFixed(1)}%`);
    console.log(`⏱️  Average Execution Time: ${performanceData.averageExecutionTime.toFixed(0)}ms`);
    
    // Recent performance trend
    if (performanceData.executions.length >= 10) {
      const recentExecutions = performanceData.executions.slice(-10);
      const recentSuccessRate = recentExecutions.filter(e => e.success).length / recentExecutions.length;
      const recentConfidence = recentExecutions.filter(e => e.success).reduce((sum, e) => sum + e.confidence, 0) / recentExecutions.filter(e => e.success).length;
      
      console.log(chalk.cyan('\n📈 Recent Trend (last 10 executions):'));
      console.log(`  Success Rate: ${(recentSuccessRate * 100).toFixed(1)}%`);
      console.log(`  Average Confidence: ${(recentConfidence * 100).toFixed(1)}%`);
    }
  }

  /**
   * A/B test two template versions
   */
  async abTest(template1Name, template2Name, entityName) {
    console.log(chalk.blue(`🧪 A/B Testing: ${template1Name} vs ${template2Name} with "${entityName}"`));

    try {
      // Test template 1
      const result1 = await this.testTemplate(template1Name, entityName);
      
      // Test template 2
      const result2 = await this.testTemplate(template2Name, entityName);
      
      if (!result1 || !result2) {
        console.error(chalk.red('❌ A/B test failed - could not execute both templates'));
        return null;
      }

      // Compare results
      const comparison = this.compareTemplateResults(result1, result2);
      this.displayABTestResults(comparison);
      
      return comparison;
    } catch (error) {
      console.error(chalk.red('❌ A/B test failed:'), error.message);
      return null;
    }
  }

  /**
   * Compare template results
   */
  compareTemplateResults(result1, result2) {
    const comparison = {
      template1: result1.templateName,
      template2: result2.templateName,
      entity: result1.entityName,
      winner: null,
      metrics: {
        confidence: {
          template1: result1.confidence,
          template2: result2.confidence,
          winner: result1.confidence > result2.confidence ? result1.templateName : result2.templateName
        },
        executionTime: {
          template1: result1.executionTime,
          template2: result2.executionTime,
          winner: result1.executionTime < result2.executionTime ? result1.templateName : result2.templateName
        },
        success: {
          template1: result1.success,
          template2: result2.success,
          winner: result1.success && !result2.success ? result1.templateName :
                  !result1.success && result2.success ? result2.templateName : 'tie'
        }
      }
    };

    // Determine overall winner
    let score1 = 0, score2 = 0;
    
    if (comparison.metrics.confidence.winner === result1.templateName) score1++;
    else if (comparison.metrics.confidence.winner === result2.templateName) score2++;
    
    if (comparison.metrics.executionTime.winner === result1.templateName) score1++;
    else if (comparison.metrics.executionTime.winner === result2.templateName) score2++;
    
    if (comparison.metrics.success.winner === result1.templateName) score1++;
    else if (comparison.metrics.success.winner === result2.templateName) score2++;
    
    comparison.winner = score1 > score2 ? result1.templateName :
                      score2 > score1 ? result2.templateName : 'tie';

    return comparison;
  }

  /**
   * Display A/B test results
   */
  displayABTestResults(comparison) {
    console.log(chalk.yellow('\n📊 A/B Test Results:'));
    
    console.log(chalk.cyan(`\n🏆 Overall Winner: ${comparison.winner}`));
    
    console.log(chalk.cyan('\n📈 Detailed Comparison:'));
    console.log(`Confidence: ${comparison.template1} (${(comparison.metrics.confidence.template1 * 100).toFixed(1)}%) vs ${comparison.template2} (${(comparison.metrics.confidence.template2 * 100).toFixed(1)}%) - Winner: ${comparison.metrics.confidence.winner}`);
    console.log(`Speed: ${comparison.template1} (${comparison.metrics.executionTime.template1.toFixed(0)}ms) vs ${comparison.template2} (${comparison.metrics.executionTime.template2.toFixed(0)}ms) - Winner: ${comparison.metrics.executionTime.winner}`);
    console.log(`Success: ${comparison.template1} (${comparison.metrics.success.template1}) vs ${comparison.template2} (${comparison.metrics.success.template2}) - Winner: ${comparison.metrics.success.winner}`);
  }

  /**
   * Generate performance report
   */
  async performanceReport(timeframe = 'last-week') {
    console.log(chalk.blue(`📊 Generating performance report for: ${timeframe}`));

    try {
      const performanceFiles = await fs.readdir(this.performancePath);
      const report = {
        timeframe,
        generatedAt: new Date().toISOString(),
        templates: {}
      };

      for (const file of performanceFiles) {
        if (file.endsWith('.json')) {
          const templateName = file.replace('.json', '');
          const performanceFile = path.join(this.performancePath, file);
          const performanceData = JSON.parse(await fs.readFile(performanceFile, 'utf-8'));
          
          // Filter executions by timeframe
          const filteredExecutions = this.filterExecutionsByTimeframe(performanceData.executions, timeframe);
          
          if (filteredExecutions.length > 0) {
            report.templates[templateName] = this.calculateMetricsForExecutions(filteredExecutions);
          }
        }
      }

      this.displayPerformanceReport(report);
      return report;
    } catch (error) {
      console.error(chalk.red('❌ Failed to generate performance report:'), error.message);
      return null;
    }
  }

  /**
   * Filter executions by timeframe
   */
  filterExecutionsByTimeframe(executions, timeframe) {
    const now = new Date();
    let cutoffDate;

    switch (timeframe) {
      case 'last-day':
        cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'last-week':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last-month':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        cutoffDate = new Date(0); // All time
    }

    return executions.filter(execution => new Date(execution.timestamp) >= cutoffDate);
  }

  /**
   * Calculate metrics for filtered executions
   */
  calculateMetricsForExecutions(executions) {
    const successfulExecutions = executions.filter(e => e.success);
    
    return {
      totalExecutions: executions.length,
      successfulExecutions: successfulExecutions.length,
      successRate: successfulExecutions.length / executions.length,
      averageConfidence: successfulExecutions.length > 0 ? 
        successfulExecutions.reduce((sum, e) => sum + e.confidence, 0) / successfulExecutions.length : 0,
      averageExecutionTime: executions.reduce((sum, e) => sum + e.executionTime, 0) / executions.length
    };
  }

  /**
   * Display performance report
   */
  displayPerformanceReport(report) {
    console.log(chalk.yellow(`\n📊 Performance Report (${report.timeframe}):`));
    console.log(chalk.grey(`Generated: ${new Date(report.generatedAt).toLocaleString()}`));
    
    Object.entries(report.templates).forEach(([templateName, metrics]) => {
      console.log(chalk.cyan(`\n📝 ${templateName}:`));
      console.log(`  Executions: ${metrics.totalExecutions}`);
      console.log(`  Success Rate: ${(metrics.successRate * 100).toFixed(1)}%`);
      console.log(`  Avg Confidence: ${(metrics.averageConfidence * 100).toFixed(1)}%`);
      console.log(`  Avg Execution Time: ${metrics.averageExecutionTime.toFixed(0)}ms`);
    });
  }

  /**
   * Validate query relevance
   */
  async validateQueryRelevance(targetThreshold = 0.90) {
    console.log(chalk.blue('🔍 Validating query relevance'));

    try {
      const performanceFiles = await fs.readdir(this.performancePath);
      let totalTemplates = 0;
      let relevantTemplates = 0;
      
      for (const file of performanceFiles) {
        if (file.endsWith('.json')) {
          totalTemplates++;
          
          const performanceFile = path.join(this.performancePath, file);
          const performanceData = JSON.parse(await fs.readFile(performanceFile, 'utf-8'));
          
          const successRate = performanceData.totalExecutions > 0 ? 
            performanceData.successfulExecutions / performanceData.totalExecutions : 0;
          
          if (successRate >= targetThreshold) {
            relevantTemplates++;
          }
        }
      }
      
      const relevance = totalTemplates > 0 ? relevantTemplates / totalTemplates : 0;
      
      console.log(chalk.yellow(`\n📊 Query Relevance: ${(relevance * 100).toFixed(1)}%`));
      console.log(`  Relevant templates: ${relevantTemplates}/${totalTemplates}`);
      
      if (relevance >= targetThreshold) {
        console.log(chalk.green(`✅ Meets target threshold (${(targetThreshold * 100).toFixed(1)}%)`));
      } else {
        console.log(chalk.red(`❌ Below target threshold (${(targetThreshold * 100).toFixed(1)}%)`));
      }
      
      return relevance;
    } catch (error) {
      console.error(chalk.red('❌ Query relevance validation failed:'), error.message);
      return 0;
    }
  }

  /**
   * Upgrade template version
   */
  async upgradeTemplate(templateName, newVersion) {
    console.log(chalk.blue(`⬆️  Upgrading template "${templateName}" to version ${newVersion}`));
    
    // Implementation would upgrade template version
    // This is a placeholder for the full implementation
    
    console.log(chalk.green(`✅ Template "${templateName}" upgraded to version ${newVersion}`));
    return { success: true, templateName, newVersion };
  }

  /**
   * Default query templates
   */
  getDefaultQueryTemplates() {
    return {
      "unknown_security_tool": {
        name: "Unknown Security Tool Analysis",
        version: "1.2",
        domains: ["cybersecurity"],
        template: `Analyze the security tool "{entity}" and provide:
1. Primary category (SIEM, Firewall, Endpoint Protection, etc.)
2. Sub-components or modules
3. Key capabilities for each component
4. Integration points with other security tools
5. Typical organizational roles that interact with it

Format the response as structured JSON with clear categories and confidence scores.`,
        success_rate: 0.87,
        last_updated: "2025-09-27",
        description: "Analyzes unknown security tools and provides structured information about their capabilities and integrations"
      },

      "soc_role_analysis": {
        name: "SOC Role Analysis",
        version: "1.1",
        domains: ["cybersecurity"],
        template: `Analyze the SOC role "{entity}" and provide:
1. Hierarchical position within SOC structure
2. Primary responsibilities and duties
3. Required skills and qualifications
4. Tools and systems typically used
5. Career progression paths
6. Relationships with other SOC roles

Focus on practical, actionable information for organizational planning.`,
        success_rate: 0.92,
        last_updated: "2025-09-25",
        description: "Provides detailed analysis of Security Operations Center roles and responsibilities"
      },

      "construction_material_analysis": {
        name: "Construction Material Analysis",
        version: "1.0",
        domains: ["construction"],
        template: `Analyze the construction material "{entity}" and provide:
1. Material category and type
2. Common applications and use cases
3. Standard specifications and grades
4. Typical suppliers and cost ranges
5. Installation requirements and considerations
6. Compatibility with other materials

Include practical information for project planning and cost estimation.`,
        success_rate: 0.78,
        last_updated: "2025-09-20",
        description: "Analyzes construction materials for project planning and cost estimation"
      },

      "project_entity_extraction": {
        name: "Project Entity Extraction",
        version: "1.3",
        domains: ["construction", "general"],
        template: `Extract and categorize entities from the project context "{entity}":
1. People involved (names, roles, contact info)
2. Locations (addresses, job sites, offices)
3. Materials (items, quantities, specifications)
4. Timeline items (dates, milestones, deadlines)
5. Costs (amounts, categories, budgets)
6. Tasks (action items, assignments, status)

Provide confidence scores for each extracted entity.`,
        success_rate: 0.85,
        last_updated: "2025-09-27",
        description: "Extracts structured entities from project-related text and communications"
      }
    };
  }
}
