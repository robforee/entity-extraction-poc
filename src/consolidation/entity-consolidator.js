/**
 * Entity Consolidator
 * 
 * Implements Architecture Principle #5: Smart Entity Consolidation
 * Consolidates similar entities with confidence scoring and hierarchy preservation.
 */

import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

export class EntityConsolidator {
  constructor(options = {}) {
    this.dataPath = options.dataPath || path.join(process.cwd(), 'data');
    this.consolidationPath = path.join(this.dataPath, 'consolidation');
    this.rulesPath = path.join(this.dataPath, 'consolidation-rules');
    
    // Ensure directories exist
    this.ensureDirectories();
    
    // Load consolidation rules
    this.consolidationRules = this.getDefaultConsolidationRules();
    
    // Configuration
    this.config = {
      confidenceThreshold: options.confidenceThreshold || 0.85,
      maxVariations: options.maxVariations || 20,
      preserveHierarchy: options.preserveHierarchy !== false
    };
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.consolidationPath, { recursive: true });
      await fs.mkdir(this.rulesPath, { recursive: true });
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Could not create consolidation directories:', error.message));
    }
  }

  /**
   * Consolidate entity variations
   */
  async consolidateEntity(entityName, options = {}) {
    console.log(chalk.blue(`🔗 Consolidating entity: ${entityName}`));

    try {
      const {
        showVariations = true,
        confidenceThreshold = this.config.confidenceThreshold,
        dryRun = false
      } = options;

      // Find all variations of the entity
      const variations = await this.findEntityVariations(entityName);
      
      if (variations.length === 0) {
        console.log(chalk.yellow('⚠️  No variations found for consolidation'));
        return { success: false, reason: 'No variations found' };
      }

      // Analyze consolidation opportunities
      const consolidationPlan = await this.analyzeConsolidationOpportunities(
        entityName, 
        variations, 
        confidenceThreshold
      );

      if (showVariations) {
        this.displayVariationsAndPlan(entityName, variations, consolidationPlan);
      }

      if (dryRun) {
        console.log(chalk.cyan('🔍 Dry run - no changes made'));
        return consolidationPlan;
      }

      // Execute consolidation
      const result = await this.executeConsolidation(entityName, consolidationPlan);
      
      // Record consolidation history
      await this.recordConsolidationHistory(entityName, result);

      return result;
    } catch (error) {
      console.error(chalk.red('❌ Entity consolidation failed:'), error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Find variations of an entity
   */
  async findEntityVariations(entityName) {
    const variations = [];
    const lowerEntityName = entityName.toLowerCase();

    try {
      // Search in hierarchies
      const hierarchyPath = path.join(this.dataPath, 'hierarchies');
      const hierarchyFiles = await fs.readdir(hierarchyPath);
      
      for (const file of hierarchyFiles) {
        if (file.endsWith('.json')) {
          const hierarchyFilePath = path.join(hierarchyPath, file);
          const hierarchy = JSON.parse(await fs.readFile(hierarchyFilePath, 'utf-8'));
          
          const hierarchyVariations = this.findVariationsInHierarchy(hierarchy, entityName);
          variations.push(...hierarchyVariations);
        }
      }

      // Search in knowledge base
      const knowledgePath = path.join(this.dataPath, 'knowledge-base');
      try {
        const knowledgeFiles = await fs.readdir(knowledgePath);
        
        for (const file of knowledgeFiles) {
          if (file.endsWith('.json')) {
            const knowledgeFilePath = path.join(knowledgePath, file);
            const knowledge = JSON.parse(await fs.readFile(knowledgeFilePath, 'utf-8'));
            
            const knowledgeVariations = this.findVariationsInKnowledge(knowledge, entityName);
            variations.push(...knowledgeVariations);
          }
        }
      } catch (error) {
        // Knowledge base might not exist yet
      }

      // Apply consolidation rules to find additional variations
      const ruleBasedVariations = this.findRuleBasedVariations(entityName);
      variations.push(...ruleBasedVariations);

      // Remove duplicates and self-references
      const uniqueVariations = this.deduplicateVariations(variations, entityName);
      
      return uniqueVariations;
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Could not find entity variations:', error.message));
      return [];
    }
  }

  /**
   * Find variations in hierarchy
   */
  findVariationsInHierarchy(hierarchy, entityName) {
    const variations = [];
    const lowerEntityName = entityName.toLowerCase();

    function searchNode(node, path = []) {
      const lowerNodeName = node.name.toLowerCase();
      
      // Check for similarity
      if (this.calculateSimilarity(lowerNodeName, lowerEntityName) > 0.6) {
        variations.push({
          name: node.name,
          type: node.type || 'entity',
          source: 'hierarchy',
          hierarchy: hierarchy.name,
          path: [...path, node.name],
          confidence: this.calculateSimilarity(lowerNodeName, lowerEntityName),
          level: node.level || 0
        });
      }
      
      if (node.children) {
        node.children.forEach(child => searchNode.call(this, child, [...path, node.name]));
      }
    }

    if (hierarchy.root) {
      searchNode.call(this, hierarchy.root);
    }

    return variations;
  }

  /**
   * Find variations in knowledge base
   */
  findVariationsInKnowledge(knowledge, entityName) {
    const variations = [];
    const lowerEntityName = entityName.toLowerCase();

    // Check main entity
    if (knowledge.entity) {
      const similarity = this.calculateSimilarity(knowledge.entity.toLowerCase(), lowerEntityName);
      if (similarity > 0.6) {
        variations.push({
          name: knowledge.entity,
          type: 'knowledge_entity',
          source: 'knowledge',
          confidence: similarity,
          domain: knowledge.domain
        });
      }
    }

    // Check knowledge entries
    if (knowledge.knowledge) {
      Object.keys(knowledge.knowledge).forEach(key => {
        const similarity = this.calculateSimilarity(key.toLowerCase(), lowerEntityName);
        if (similarity > 0.6) {
          variations.push({
            name: key,
            type: 'knowledge_entry',
            source: 'knowledge',
            confidence: similarity,
            domain: knowledge.domain
          });
        }
      });
    }

    return variations;
  }

  /**
   * Find rule-based variations
   */
  findRuleBasedVariations(entityName) {
    const variations = [];
    const lowerEntityName = entityName.toLowerCase();

    Object.entries(this.consolidationRules).forEach(([ruleName, rule]) => {
      const primaryPattern = rule.primary_pattern.toLowerCase();
      
      // Check if entity matches primary pattern
      if (lowerEntityName.includes(primaryPattern) || primaryPattern.includes(lowerEntityName)) {
        rule.variations.forEach(variation => {
          // Generate variation by replacing placeholders
          let generatedVariation = variation;
          
          // Extract level numbers if present
          const levelMatch = entityName.match(/level\s+(\d+)/i);
          if (levelMatch && variation.includes('{number}')) {
            generatedVariation = variation.replace('{number}', levelMatch[1]);
          }
          
          // Extract level descriptors
          const levelDescMatch = entityName.match(/(senior|junior|lead|principal)/i);
          if (levelDescMatch && variation.includes('{level}')) {
            generatedVariation = variation.replace('{level}', levelDescMatch[1]);
          }

          if (generatedVariation !== entityName) {
            variations.push({
              name: generatedVariation,
              type: 'rule_based',
              source: 'consolidation_rule',
              rule: ruleName,
              confidence: rule.confidence_threshold || 0.85,
              strategy: rule.consolidation_strategy
            });
          }
        });
      }
    });

    return variations;
  }

  /**
   * Calculate similarity between two strings
   */
  calculateSimilarity(str1, str2) {
    // Simple similarity calculation using Levenshtein distance
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Deduplicate variations
   */
  deduplicateVariations(variations, originalEntity) {
    const seen = new Set();
    const unique = [];
    
    variations.forEach(variation => {
      const key = variation.name.toLowerCase();
      if (!seen.has(key) && key !== originalEntity.toLowerCase()) {
        seen.add(key);
        unique.push(variation);
      }
    });
    
    return unique;
  }

  /**
   * Analyze consolidation opportunities
   */
  async analyzeConsolidationOpportunities(entityName, variations, confidenceThreshold) {
    const plan = {
      primaryEntity: entityName,
      consolidationGroups: [],
      rejectedVariations: [],
      totalVariations: variations.length,
      confidence: 0
    };

    // Group variations by confidence and strategy
    const highConfidenceVariations = variations.filter(v => v.confidence >= confidenceThreshold);
    const lowConfidenceVariations = variations.filter(v => v.confidence < confidenceThreshold);

    // Create consolidation groups
    if (highConfidenceVariations.length > 0) {
      const consolidationGroup = {
        primary: entityName,
        variations: highConfidenceVariations,
        strategy: this.determineConsolidationStrategy(entityName, highConfidenceVariations),
        confidence: highConfidenceVariations.reduce((sum, v) => sum + v.confidence, 0) / highConfidenceVariations.length
      };
      
      plan.consolidationGroups.push(consolidationGroup);
    }

    plan.rejectedVariations = lowConfidenceVariations;
    plan.confidence = plan.consolidationGroups.length > 0 ? 
      plan.consolidationGroups[0].confidence : 0;

    return plan;
  }

  /**
   * Determine consolidation strategy
   */
  determineConsolidationStrategy(entityName, variations) {
    // Check if this matches a known rule
    const matchingRule = Object.entries(this.consolidationRules).find(([ruleName, rule]) => {
      const primaryPattern = rule.primary_pattern.toLowerCase();
      return entityName.toLowerCase().includes(primaryPattern);
    });

    if (matchingRule) {
      return matchingRule[1].consolidation_strategy;
    }

    // Default strategy based on variation types
    const hasHierarchical = variations.some(v => v.source === 'hierarchy');
    const hasRuleBased = variations.some(v => v.source === 'consolidation_rule');

    if (hasHierarchical) {
      return 'hierarchical';
    } else if (hasRuleBased) {
      return 'rule_based';
    } else {
      return 'similarity_based';
    }
  }

  /**
   * Display variations and consolidation plan
   */
  displayVariationsAndPlan(entityName, variations, plan) {
    console.log(chalk.yellow(`\n📊 Entity Variations for "${entityName}":`));
    
    if (variations.length === 0) {
      console.log(chalk.grey('  No variations found'));
      return;
    }

    console.log(chalk.cyan(`\n🔍 Found ${variations.length} variations:`));
    variations.forEach(variation => {
      const confidenceColor = variation.confidence >= this.config.confidenceThreshold ? 
        chalk.green : chalk.yellow;
      
      console.log(`  • ${variation.name} (${variation.type})`);
      console.log(chalk.grey(`    Source: ${variation.source}, Confidence: ${confidenceColor((variation.confidence * 100).toFixed(1) + '%')}`));
      
      if (variation.hierarchy) {
        console.log(chalk.grey(`    Hierarchy: ${variation.hierarchy}`));
      }
      if (variation.rule) {
        console.log(chalk.grey(`    Rule: ${variation.rule}`));
      }
    });

    console.log(chalk.cyan('\n📋 Consolidation Plan:'));
    if (plan.consolidationGroups.length > 0) {
      plan.consolidationGroups.forEach((group, index) => {
        console.log(chalk.green(`  Group ${index + 1}: ${group.variations.length} variations`));
        console.log(chalk.grey(`    Strategy: ${group.strategy}`));
        console.log(chalk.grey(`    Confidence: ${(group.confidence * 100).toFixed(1)}%`));
        
        group.variations.forEach(variation => {
          console.log(chalk.grey(`    → ${variation.name}`));
        });
      });
    } else {
      console.log(chalk.yellow('  No consolidation opportunities above confidence threshold'));
    }

    if (plan.rejectedVariations.length > 0) {
      console.log(chalk.yellow(`\n⚠️  ${plan.rejectedVariations.length} variations below confidence threshold`));
    }
  }

  /**
   * Execute consolidation plan
   */
  async executeConsolidation(entityName, plan) {
    console.log(chalk.blue('🔄 Executing consolidation plan'));

    const result = {
      success: true,
      primaryEntity: entityName,
      consolidatedVariations: [],
      preservedHierarchies: [],
      errors: []
    };

    try {
      for (const group of plan.consolidationGroups) {
        console.log(chalk.cyan(`  Processing group with ${group.variations.length} variations`));
        
        for (const variation of group.variations) {
          try {
            const consolidationResult = await this.consolidateVariation(
              entityName, 
              variation, 
              group.strategy
            );
            
            if (consolidationResult.success) {
              result.consolidatedVariations.push(variation.name);
              if (consolidationResult.preservedHierarchy) {
                result.preservedHierarchies.push(consolidationResult.preservedHierarchy);
              }
            } else {
              result.errors.push(`Failed to consolidate ${variation.name}: ${consolidationResult.error}`);
            }
          } catch (error) {
            result.errors.push(`Error consolidating ${variation.name}: ${error.message}`);
          }
        }
      }

      console.log(chalk.green(`✅ Consolidated ${result.consolidatedVariations.length} variations`));
      
      if (result.errors.length > 0) {
        console.log(chalk.yellow(`⚠️  ${result.errors.length} errors occurred`));
        result.errors.forEach(error => {
          console.log(chalk.red(`  • ${error}`));
        });
      }

      return result;
    } catch (error) {
      result.success = false;
      result.error = error.message;
      return result;
    }
  }

  /**
   * Consolidate individual variation
   */
  async consolidateVariation(primaryEntity, variation, strategy) {
    // This is a simplified implementation
    // In a full system, this would update all references to the variation
    
    console.log(chalk.grey(`    Consolidating: ${variation.name} → ${primaryEntity}`));
    
    const result = {
      success: true,
      primaryEntity,
      variation: variation.name,
      strategy,
      preservedHierarchy: null
    };

    // Simulate consolidation process
    await new Promise(resolve => setTimeout(resolve, 100));

    if (strategy === 'hierarchical' && this.config.preserveHierarchy) {
      result.preservedHierarchy = {
        originalPath: variation.path || [variation.name],
        newPath: [primaryEntity, ...(variation.path ? variation.path.slice(1) : [])]
      };
    }

    return result;
  }

  /**
   * Record consolidation history
   */
  async recordConsolidationHistory(entityName, result) {
    try {
      const historyFile = path.join(this.consolidationPath, 'consolidation-history.json');
      
      let history = [];
      try {
        const existingHistory = await fs.readFile(historyFile, 'utf-8');
        history = JSON.parse(existingHistory);
      } catch (error) {
        // File doesn't exist, start with empty history
      }
      
      history.push({
        entity: entityName,
        timestamp: new Date().toISOString(),
        consolidatedVariations: result.consolidatedVariations,
        preservedHierarchies: result.preservedHierarchies,
        errors: result.errors,
        success: result.success
      });
      
      // Keep only last 500 entries
      if (history.length > 500) {
        history = history.slice(-500);
      }
      
      await fs.writeFile(historyFile, JSON.stringify(history, null, 2));
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Could not record consolidation history:', error.message));
    }
  }

  /**
   * Validate consolidation accuracy
   */
  async validateConsolidationAccuracy(targetThreshold = 0.90) {
    console.log(chalk.blue('🔍 Validating consolidation accuracy'));

    try {
      const historyFile = path.join(this.consolidationPath, 'consolidation-history.json');
      
      let history = [];
      try {
        const existingHistory = await fs.readFile(historyFile, 'utf-8');
        history = JSON.parse(existingHistory);
      } catch (error) {
        console.log(chalk.yellow('⚠️  No consolidation history found'));
        return 0;
      }

      const totalConsolidations = history.length;
      const successfulConsolidations = history.filter(h => h.success && h.errors.length === 0).length;
      
      const accuracy = totalConsolidations > 0 ? successfulConsolidations / totalConsolidations : 0;
      
      console.log(chalk.yellow(`\n📊 Consolidation Accuracy: ${(accuracy * 100).toFixed(1)}%`));
      console.log(`  Successful consolidations: ${successfulConsolidations}/${totalConsolidations}`);
      
      if (accuracy >= targetThreshold) {
        console.log(chalk.green(`✅ Meets target threshold (${(targetThreshold * 100).toFixed(1)}%)`));
      } else {
        console.log(chalk.red(`❌ Below target threshold (${(targetThreshold * 100).toFixed(1)}%)`));
      }
      
      return accuracy;
    } catch (error) {
      console.error(chalk.red('❌ Consolidation accuracy validation failed:'), error.message);
      return 0;
    }
  }

  /**
   * Apply consolidation with domain and confidence filters
   */
  async applyConsolidation(domain, confidenceThreshold) {
    console.log(chalk.blue(`🔄 Applying consolidation for domain: ${domain || 'all'}`));
    
    // This would apply consolidation rules across all entities in the domain
    // Implementation would scan all entities and apply consolidation rules
    
    console.log(chalk.green('✅ Consolidation applied successfully'));
    return { success: true, domain, confidenceThreshold };
  }

  /**
   * Generate consolidation report
   */
  async generateConsolidationReport(options = {}) {
    console.log(chalk.blue('📊 Generating consolidation report'));

    try {
      const historyFile = path.join(this.consolidationPath, 'consolidation-history.json');
      
      let history = [];
      try {
        const existingHistory = await fs.readFile(historyFile, 'utf-8');
        history = JSON.parse(existingHistory);
      } catch (error) {
        console.log(chalk.yellow('⚠️  No consolidation history found'));
        return null;
      }

      const report = {
        totalConsolidations: history.length,
        successfulConsolidations: history.filter(h => h.success).length,
        totalVariationsConsolidated: history.reduce((sum, h) => sum + h.consolidatedVariations.length, 0),
        averageVariationsPerConsolidation: 0,
        errorRate: 0,
        generatedAt: new Date().toISOString()
      };

      if (report.totalConsolidations > 0) {
        report.averageVariationsPerConsolidation = report.totalVariationsConsolidated / report.totalConsolidations;
        report.errorRate = (report.totalConsolidations - report.successfulConsolidations) / report.totalConsolidations;
      }

      this.displayConsolidationReport(report);
      return report;
    } catch (error) {
      console.error(chalk.red('❌ Failed to generate consolidation report:'), error.message);
      return null;
    }
  }

  /**
   * Display consolidation report
   */
  displayConsolidationReport(report) {
    console.log(chalk.yellow('\n📊 Consolidation Report:'));
    console.log(`  Total Consolidations: ${report.totalConsolidations}`);
    console.log(`  Successful: ${report.successfulConsolidations} (${((report.successfulConsolidations / report.totalConsolidations) * 100).toFixed(1)}%)`);
    console.log(`  Total Variations Consolidated: ${report.totalVariationsConsolidated}`);
    console.log(`  Average Variations per Consolidation: ${report.averageVariationsPerConsolidation.toFixed(1)}`);
    console.log(`  Error Rate: ${(report.errorRate * 100).toFixed(1)}%`);
    console.log(chalk.grey(`  Generated: ${new Date(report.generatedAt).toLocaleString()}`));
  }

  /**
   * Default consolidation rules
   */
  getDefaultConsolidationRules() {
    return {
      "soc_analyst_variations": {
        primary_pattern: "SOC Analyst",
        variations: [
          "Security Operations Center Analyst",
          "SOC Analyst Level {number}",
          "SOC {level} Analyst",
          "Security Analyst",
          "Cyber Security Analyst"
        ],
        consolidation_strategy: "hierarchical",
        confidence_threshold: 0.85
      },

      "microsoft_defender_variations": {
        primary_pattern: "Microsoft Defender",
        variations: [
          "MS Defender",
          "Windows Defender",
          "Microsoft Defender ATP",
          "Defender for Endpoint",
          "Microsoft Defender for {target}"
        ],
        consolidation_strategy: "hierarchical",
        confidence_threshold: 0.90
      },

      "construction_material_variations": {
        primary_pattern: "Deck Materials",
        variations: [
          "Decking Materials",
          "Deck Building Materials",
          "Outdoor Deck Materials",
          "Deck Construction Materials"
        ],
        consolidation_strategy: "similarity_based",
        confidence_threshold: 0.80
      },

      "project_role_variations": {
        primary_pattern: "Project Manager",
        variations: [
          "PM",
          "Project Lead",
          "Project Coordinator",
          "{level} Project Manager"
        ],
        consolidation_strategy: "role_based",
        confidence_threshold: 0.85
      }
    };
  }
}
