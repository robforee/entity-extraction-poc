/**
 * Knowledge Driller
 * 
 * Implements Architecture Principle #4: Progressive Knowledge Drilling
 * Builds hierarchical knowledge through LLM-based entity expansion.
 */

import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

export class KnowledgeDriller {
  constructor(options = {}) {
    this.dataPath = options.dataPath || path.join(process.cwd(), 'data');
    this.knowledgePath = path.join(this.dataPath, 'knowledge-base');
    this.drillHistoryPath = path.join(this.dataPath, 'drill-history');
    
    // Ensure directories exist
    this.ensureDirectories();
    
    // Drilling configuration
    this.config = {
      maxDepth: options.maxDepth || 5,
      confidenceThreshold: options.confidenceThreshold || 0.7,
      maxChildrenPerLevel: options.maxChildrenPerLevel || 10
    };
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.knowledgePath, { recursive: true });
      await fs.mkdir(this.drillHistoryPath, { recursive: true });
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Could not create knowledge drilling directories:', error.message));
    }
  }

  /**
   * Drill into an entity to build progressive knowledge
   */
  async drillEntity(entityName, options = {}) {
    const {
      depth = 3,
      showHierarchy = true,
      domain = null,
      forceRefresh = false
    } = options;

    console.log(chalk.blue(`🔍 Knowledge drilling: ${entityName} (depth: ${depth})`));

    try {
      // Check if we have existing knowledge
      const existingKnowledge = await this.loadExistingKnowledge(entityName);
      
      if (existingKnowledge && !forceRefresh) {
        console.log(chalk.green('✅ Using existing knowledge'));
        return existingKnowledge;
      }

      // Start progressive drilling
      const drillingResult = await this.performProgressiveDrilling(entityName, {
        maxDepth: depth,
        domain,
        showHierarchy
      });

      // Save the knowledge
      await this.saveKnowledge(entityName, drillingResult);
      
      // Record drilling history
      await this.recordDrillingHistory(entityName, drillingResult);

      return drillingResult;
    } catch (error) {
      console.error(chalk.red('❌ Knowledge drilling failed:'), error.message);
      return null;
    }
  }

  /**
   * Load existing knowledge for entity
   */
  async loadExistingKnowledge(entityName) {
    try {
      const knowledgeFile = path.join(this.knowledgePath, `${this.sanitizeFilename(entityName)}.json`);
      const knowledge = JSON.parse(await fs.readFile(knowledgeFile, 'utf-8'));
      
      // Check if knowledge is still fresh (within 7 days)
      const lastUpdated = new Date(knowledge.lastUpdated);
      const daysSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceUpdate < 7) {
        return knowledge;
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Perform progressive knowledge drilling
   */
  async performProgressiveDrilling(entityName, options = {}) {
    const { maxDepth, domain, showHierarchy } = options;
    
    const drillingResult = {
      entity: entityName,
      domain: domain || this.detectDomain(entityName),
      startTime: new Date().toISOString(),
      hierarchy: null,
      knowledge: {},
      confidence: 0,
      depth: 0,
      totalNodes: 0
    };

    console.log(chalk.cyan(`🎯 Detected domain: ${drillingResult.domain}`));

    // Level 0: Root entity analysis
    console.log(chalk.cyan('📊 Level 0: Root entity analysis'));
    const rootAnalysis = await this.analyzeRootEntity(entityName, drillingResult.domain);
    
    if (!rootAnalysis.success) {
      throw new Error(`Failed to analyze root entity: ${rootAnalysis.error}`);
    }

    drillingResult.knowledge[entityName] = rootAnalysis.knowledge;
    drillingResult.confidence = rootAnalysis.confidence;
    drillingResult.totalNodes = 1;

    // Build initial hierarchy
    drillingResult.hierarchy = {
      name: entityName,
      type: rootAnalysis.knowledge.category || 'entity',
      level: 0,
      confidence: rootAnalysis.confidence,
      children: []
    };

    // Progressive drilling through levels
    for (let level = 1; level <= maxDepth; level++) {
      console.log(chalk.cyan(`📊 Level ${level}: Expanding knowledge`));
      
      const expansionResult = await this.expandKnowledgeLevel(
        drillingResult, 
        level, 
        drillingResult.domain
      );
      
      if (!expansionResult.success) {
        console.log(chalk.yellow(`⚠️  Stopped drilling at level ${level - 1}: ${expansionResult.reason}`));
        break;
      }
      
      drillingResult.depth = level;
      drillingResult.totalNodes += expansionResult.newNodes;
      
      // Update confidence based on expansion quality
      drillingResult.confidence = (drillingResult.confidence + expansionResult.confidence) / 2;
    }

    drillingResult.endTime = new Date().toISOString();
    drillingResult.duration = new Date(drillingResult.endTime) - new Date(drillingResult.startTime);

    console.log(chalk.green(`✅ Drilling complete: ${drillingResult.totalNodes} nodes, depth ${drillingResult.depth}`));
    
    return drillingResult;
  }

  /**
   * Analyze root entity
   */
  async analyzeRootEntity(entityName, domain) {
    try {
      // Simulate LLM analysis (in real implementation, this would call LLM API)
      const analysis = await this.simulateEntityAnalysis(entityName, domain, 'root');
      
      return {
        success: true,
        knowledge: analysis.knowledge,
        confidence: analysis.confidence
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Expand knowledge at specific level
   */
  async expandKnowledgeLevel(drillingResult, level, domain) {
    try {
      const currentLevelNodes = this.getNodesAtLevel(drillingResult.hierarchy, level - 1);
      
      if (currentLevelNodes.length === 0) {
        return {
          success: false,
          reason: 'No nodes to expand at previous level'
        };
      }

      let newNodes = 0;
      let totalConfidence = 0;
      let expandedNodes = 0;

      for (const node of currentLevelNodes) {
        // Skip if node already has children or confidence is too low
        if (node.children.length > 0 || node.confidence < this.config.confidenceThreshold) {
          continue;
        }

        const expansion = await this.expandNode(node, level, domain);
        
        if (expansion.success) {
          node.children = expansion.children;
          newNodes += expansion.children.length;
          totalConfidence += expansion.confidence;
          expandedNodes++;

          // Add knowledge for each child
          expansion.children.forEach(child => {
            drillingResult.knowledge[child.name] = expansion.knowledge[child.name] || {};
          });
        }
      }

      if (expandedNodes === 0) {
        return {
          success: false,
          reason: 'No nodes could be expanded at this level'
        };
      }

      return {
        success: true,
        newNodes,
        confidence: totalConfidence / expandedNodes,
        expandedNodes
      };
    } catch (error) {
      return {
        success: false,
        reason: error.message
      };
    }
  }

  /**
   * Get all nodes at specific level
   */
  getNodesAtLevel(hierarchy, targetLevel) {
    const nodes = [];
    
    function traverse(node, currentLevel) {
      if (currentLevel === targetLevel) {
        nodes.push(node);
      } else if (node.children && currentLevel < targetLevel) {
        node.children.forEach(child => traverse(child, currentLevel + 1));
      }
    }
    
    traverse(hierarchy, 0);
    return nodes;
  }

  /**
   * Expand individual node
   */
  async expandNode(node, level, domain) {
    try {
      console.log(chalk.grey(`  🔍 Expanding: ${node.name}`));
      
      // Simulate node expansion (in real implementation, this would call LLM API)
      const expansion = await this.simulateNodeExpansion(node, level, domain);
      
      return expansion;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Simulate entity analysis (placeholder for LLM integration)
   */
  async simulateEntityAnalysis(entityName, domain, analysisType) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

    const lowerName = entityName.toLowerCase();
    let knowledge = {};
    let confidence = 0.8;

    if (lowerName.includes('microsoft defender')) {
      knowledge = {
        category: 'Security Suite',
        type: 'Endpoint Protection Platform',
        vendor: 'Microsoft',
        description: 'Comprehensive security platform for enterprise environments',
        capabilities: ['Threat Detection', 'Incident Response', 'Vulnerability Management'],
        components: ['Defender for Endpoint', 'Defender for Office 365', 'Defender for Identity'],
        integrations: ['Azure Sentinel', 'Microsoft 365', 'Windows Security'],
        deployment: 'Cloud-based with on-premises components'
      };
      confidence = 0.95;
    } else if (lowerName.includes('soc analyst')) {
      knowledge = {
        category: 'Job Role',
        type: 'Security Professional',
        department: 'Security Operations Center',
        description: 'Monitors and analyzes security events and incidents',
        responsibilities: ['Event Monitoring', 'Incident Response', 'Threat Analysis'],
        skills: ['SIEM Tools', 'Network Security', 'Incident Handling'],
        levels: ['Level 1', 'Level 2', 'Level 3'],
        tools: ['Splunk', 'QRadar', 'Sentinel', 'Chronicle']
      };
      confidence = 0.92;
    } else if (lowerName.includes('deck repair')) {
      knowledge = {
        category: 'Construction Project',
        type: 'Maintenance Work',
        scope: 'Residential/Commercial',
        description: 'Restoration and maintenance of outdoor deck structures',
        phases: ['Assessment', 'Planning', 'Material Procurement', 'Execution'],
        materials: ['Lumber', 'Fasteners', 'Sealants', 'Hardware'],
        tools: ['Power Tools', 'Hand Tools', 'Safety Equipment'],
        timeline: '1-3 weeks typical'
      };
      confidence = 0.85;
    } else {
      knowledge = {
        category: 'General Entity',
        type: 'Unknown',
        description: `Analysis of ${entityName}`,
        confidence_note: 'Limited information available'
      };
      confidence = 0.6;
    }

    return { knowledge, confidence };
  }

  /**
   * Simulate node expansion (placeholder for LLM integration)
   */
  async simulateNodeExpansion(node, level, domain) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 800 + 300));

    const children = [];
    const knowledge = {};
    let confidence = 0.7;

    const lowerName = node.name.toLowerCase();

    if (lowerName.includes('microsoft defender')) {
      const components = ['Defender for Endpoint', 'Defender for Office 365', 'Defender for Identity', 'Defender for Cloud'];
      components.forEach(component => {
        children.push({
          name: component,
          type: 'component',
          level: level,
          confidence: 0.9,
          children: []
        });
        knowledge[component] = {
          category: 'Security Component',
          parent: node.name,
          capabilities: this.getComponentCapabilities(component)
        };
      });
      confidence = 0.9;
    } else if (lowerName.includes('soc')) {
      const roles = ['SOC Analyst Level 1', 'SOC Analyst Level 2', 'SOC Manager', 'SOC Supervisor'];
      roles.forEach(role => {
        children.push({
          name: role,
          type: 'role',
          level: level,
          confidence: 0.85,
          children: []
        });
        knowledge[role] = {
          category: 'Job Role',
          parent: node.name,
          responsibilities: this.getRoleResponsibilities(role)
        };
      });
      confidence = 0.85;
    } else if (lowerName.includes('deck repair')) {
      const phases = ['Site Assessment', 'Material Planning', 'Demolition', 'Construction', 'Finishing'];
      phases.forEach(phase => {
        children.push({
          name: phase,
          type: 'phase',
          level: level,
          confidence: 0.8,
          children: []
        });
        knowledge[phase] = {
          category: 'Project Phase',
          parent: node.name,
          activities: this.getPhaseActivities(phase)
        };
      });
      confidence = 0.8;
    } else {
      // Generic expansion
      const genericChildren = [`${node.name} Component A`, `${node.name} Component B`];
      genericChildren.forEach(child => {
        children.push({
          name: child,
          type: 'component',
          level: level,
          confidence: 0.6,
          children: []
        });
        knowledge[child] = {
          category: 'Generic Component',
          parent: node.name
        };
      });
      confidence = 0.6;
    }

    // Limit children to prevent explosion
    const limitedChildren = children.slice(0, this.config.maxChildrenPerLevel);

    return {
      success: true,
      children: limitedChildren,
      knowledge,
      confidence
    };
  }

  /**
   * Get component capabilities
   */
  getComponentCapabilities(component) {
    const capabilities = {
      'Defender for Endpoint': ['Endpoint Detection', 'Response Automation', 'Threat Hunting'],
      'Defender for Office 365': ['Email Security', 'Safe Attachments', 'Safe Links'],
      'Defender for Identity': ['Identity Monitoring', 'Lateral Movement Detection', 'Compromised Credentials'],
      'Defender for Cloud': ['Cloud Security Posture', 'Workload Protection', 'Compliance Monitoring']
    };
    
    return capabilities[component] || ['General Security Capabilities'];
  }

  /**
   * Get role responsibilities
   */
  getRoleResponsibilities(role) {
    const responsibilities = {
      'SOC Analyst Level 1': ['Alert Triage', 'Initial Investigation', 'Escalation'],
      'SOC Analyst Level 2': ['Deep Analysis', 'Incident Response', 'Tool Configuration'],
      'SOC Manager': ['Team Management', 'Process Improvement', 'Stakeholder Communication'],
      'SOC Supervisor': ['Team Leadership', 'Quality Assurance', 'Training Coordination']
    };
    
    return responsibilities[role] || ['General SOC Responsibilities'];
  }

  /**
   * Get phase activities
   */
  getPhaseActivities(phase) {
    const activities = {
      'Site Assessment': ['Structural Inspection', 'Damage Evaluation', 'Safety Assessment'],
      'Material Planning': ['Material Selection', 'Quantity Calculation', 'Supplier Coordination'],
      'Demolition': ['Safe Removal', 'Waste Management', 'Site Preparation'],
      'Construction': ['Framing', 'Decking Installation', 'Railing Construction'],
      'Finishing': ['Staining/Sealing', 'Final Inspection', 'Cleanup']
    };
    
    return activities[phase] || ['General Project Activities'];
  }

  /**
   * Detect domain from entity name
   */
  detectDomain(entityName) {
    const lowerName = entityName.toLowerCase();
    
    if (lowerName.includes('soc') || lowerName.includes('security') || 
        lowerName.includes('defender') || lowerName.includes('firewall') ||
        lowerName.includes('siem') || lowerName.includes('analyst')) {
      return 'cybersecurity';
    }
    
    if (lowerName.includes('deck') || lowerName.includes('repair') ||
        lowerName.includes('construction') || lowerName.includes('material')) {
      return 'construction';
    }
    
    return 'general';
  }

  /**
   * Save knowledge to file
   */
  async saveKnowledge(entityName, drillingResult) {
    try {
      const filename = `${this.sanitizeFilename(entityName)}.json`;
      const filePath = path.join(this.knowledgePath, filename);
      
      const knowledgeData = {
        ...drillingResult,
        lastUpdated: new Date().toISOString(),
        version: '1.0'
      };
      
      await fs.writeFile(filePath, JSON.stringify(knowledgeData, null, 2));
      console.log(chalk.green(`💾 Knowledge saved: ${filename}`));
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Could not save knowledge:', error.message));
    }
  }

  /**
   * Record drilling history
   */
  async recordDrillingHistory(entityName, drillingResult) {
    try {
      const historyFile = path.join(this.drillHistoryPath, 'drilling-history.json');
      
      let history = [];
      try {
        const existingHistory = await fs.readFile(historyFile, 'utf-8');
        history = JSON.parse(existingHistory);
      } catch (error) {
        // File doesn't exist, start with empty history
      }
      
      history.push({
        entity: entityName,
        timestamp: drillingResult.startTime,
        depth: drillingResult.depth,
        totalNodes: drillingResult.totalNodes,
        confidence: drillingResult.confidence,
        duration: drillingResult.duration,
        domain: drillingResult.domain
      });
      
      // Keep only last 1000 entries
      if (history.length > 1000) {
        history = history.slice(-1000);
      }
      
      await fs.writeFile(historyFile, JSON.stringify(history, null, 2));
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Could not record drilling history:', error.message));
    }
  }

  /**
   * Validate drilling results
   */
  async validateDrillingResults(entityName, options = {}) {
    console.log(chalk.blue(`✅ Validating drilling results for: ${entityName}`));

    try {
      const knowledge = await this.loadExistingKnowledge(entityName);
      
      if (!knowledge) {
        console.log(chalk.red('❌ No knowledge found for validation'));
        return { valid: false, reason: 'No knowledge available' };
      }

      const validation = {
        entity: entityName,
        valid: true,
        confidence: knowledge.confidence,
        depth: knowledge.depth,
        totalNodes: knowledge.totalNodes,
        issues: []
      };

      // Check confidence threshold
      if (knowledge.confidence < options.confidenceThreshold || 0.7) {
        validation.issues.push(`Low confidence: ${(knowledge.confidence * 100).toFixed(1)}%`);
      }

      // Check hierarchy completeness
      if (!knowledge.hierarchy || !knowledge.hierarchy.children) {
        validation.issues.push('Incomplete hierarchy structure');
      }

      // Check knowledge depth
      if (knowledge.depth < 2) {
        validation.issues.push('Insufficient drilling depth');
      }

      validation.valid = validation.issues.length === 0;

      this.displayValidationResults(validation);
      return validation;
    } catch (error) {
      console.error(chalk.red('❌ Validation failed:'), error.message);
      return { valid: false, reason: error.message };
    }
  }

  /**
   * Display validation results
   */
  displayValidationResults(validation) {
    console.log(chalk.yellow('\n📊 Validation Results:'));
    
    const statusIcon = validation.valid ? chalk.green('✅') : chalk.red('❌');
    console.log(`${statusIcon} Overall: ${validation.valid ? 'Valid' : 'Invalid'}`);
    console.log(`📈 Confidence: ${(validation.confidence * 100).toFixed(1)}%`);
    console.log(`📊 Depth: ${validation.depth} levels`);
    console.log(`🌳 Nodes: ${validation.totalNodes}`);
    
    if (validation.issues.length > 0) {
      console.log(chalk.red('\n⚠️  Issues:'));
      validation.issues.forEach(issue => {
        console.log(chalk.red(`  • ${issue}`));
      });
    }
  }

  /**
   * Generate missing knowledge for entity
   */
  async generateKnowledge(entityName, options = {}) {
    console.log(chalk.blue(`🔄 Generating knowledge for: ${entityName}`));
    
    return await this.drillEntity(entityName, {
      ...options,
      forceRefresh: true
    });
  }

  /**
   * Sanitize filename for safe file operations
   */
  sanitizeFilename(filename) {
    return filename
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
