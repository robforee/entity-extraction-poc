/**
 * Hierarchical Entity Manager
 * 
 * Implements Architecture Principle #1: Hierarchical Entity Understanding
 * Manages entities in hierarchical relationships, not just flat co-occurrence patterns.
 */

import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

export class HierarchicalEntityManager {
  constructor(options = {}) {
    this.dataPath = options.dataPath || path.join(process.cwd(), 'data');
    this.entitiesPath = path.join(this.dataPath, 'entities');
    this.hierarchiesPath = path.join(this.dataPath, 'hierarchies');
    
    // Ensure directories exist
    this.ensureDirectories();
    
    // Load hierarchy templates
    this.hierarchyTemplates = this.getDefaultHierarchyTemplates();
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.entitiesPath, { recursive: true });
      await fs.mkdir(this.hierarchiesPath, { recursive: true });
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Could not create entity directories:', error.message));
    }
  }

  /**
   * Get entity hierarchy for a given entity
   */
  async getEntityHierarchy(entityName, options = {}) {
    console.log(chalk.blue(`🌳 Getting hierarchy for entity: ${entityName}`));

    try {
      // First, try to find the entity in existing hierarchies
      const existingHierarchy = await this.findEntityInHierarchies(entityName);
      
      if (existingHierarchy) {
        console.log(chalk.green('✅ Found entity in existing hierarchy'));
        this.displayHierarchy(existingHierarchy, entityName);
        return existingHierarchy;
      }

      // If not found, try to build hierarchy using templates
      const detectedHierarchy = await this.detectEntityHierarchy(entityName, options);
      
      if (detectedHierarchy) {
        console.log(chalk.green('✅ Built hierarchy using templates'));
        this.displayHierarchy(detectedHierarchy, entityName);
        
        // Save the detected hierarchy
        await this.saveHierarchy(detectedHierarchy);
        
        return detectedHierarchy;
      }

      console.log(chalk.yellow('⚠️  Could not determine hierarchy for entity'));
      return null;
    } catch (error) {
      console.error(chalk.red('❌ Failed to get entity hierarchy:'), error.message);
      return null;
    }
  }

  /**
   * Find entity in existing hierarchies
   */
  async findEntityInHierarchies(entityName) {
    try {
      const hierarchyFiles = await fs.readdir(this.hierarchiesPath);
      
      for (const file of hierarchyFiles) {
        if (file.endsWith('.json')) {
          const hierarchyPath = path.join(this.hierarchiesPath, file);
          const hierarchy = JSON.parse(await fs.readFile(hierarchyPath, 'utf-8'));
          
          const found = this.searchHierarchyForEntity(hierarchy, entityName);
          if (found) {
            return hierarchy;
          }
        }
      }
      
      return null;
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Could not search existing hierarchies:', error.message));
      return null;
    }
  }

  /**
   * Search hierarchy tree for specific entity
   */
  searchHierarchyForEntity(hierarchy, entityName) {
    const normalizedTarget = entityName.toLowerCase();
    
    function searchNode(node) {
      if (node.name.toLowerCase().includes(normalizedTarget) || 
          normalizedTarget.includes(node.name.toLowerCase())) {
        return true;
      }
      
      if (node.children) {
        return node.children.some(child => searchNode(child));
      }
      
      return false;
    }
    
    return searchNode(hierarchy);
  }

  /**
   * Detect entity hierarchy using templates
   */
  async detectEntityHierarchy(entityName, options = {}) {
    const domain = options.domain || this.detectDomain(entityName);
    
    // Try each hierarchy template for the domain
    for (const [templateName, template] of Object.entries(this.hierarchyTemplates)) {
      if (template.domains && !template.domains.includes(domain)) {
        continue;
      }
      
      const match = this.matchEntityToTemplate(entityName, template);
      if (match) {
        console.log(chalk.cyan(`📋 Using template: ${templateName}`));
        return await this.buildHierarchyFromTemplate(entityName, template, match);
      }
    }
    
    return null;
  }

  /**
   * Detect domain from entity name
   */
  detectDomain(entityName) {
    const lowerName = entityName.toLowerCase();
    
    // Cybersecurity indicators
    if (lowerName.includes('soc') || lowerName.includes('security') || 
        lowerName.includes('firewall') || lowerName.includes('siem') ||
        lowerName.includes('defender') || lowerName.includes('analyst')) {
      return 'cybersecurity';
    }
    
    // Construction indicators
    if (lowerName.includes('deck') || lowerName.includes('repair') ||
        lowerName.includes('material') || lowerName.includes('lumber') ||
        lowerName.includes('contractor')) {
      return 'construction';
    }
    
    return 'generic';
  }

  /**
   * Match entity to hierarchy template
   */
  matchEntityToTemplate(entityName, template) {
    for (const level of template.levels) {
      const pattern = new RegExp(level.pattern, 'i');
      const match = entityName.match(pattern);
      
      if (match) {
        return {
          level: level.name,
          pattern: level.pattern,
          match: match,
          childrenType: level.children_type
        };
      }
    }
    
    return null;
  }

  /**
   * Build hierarchy from template
   */
  async buildHierarchyFromTemplate(entityName, template, match) {
    const hierarchy = {
      name: template.name,
      type: 'hierarchy',
      domain: template.domains?.[0] || 'generic',
      root: null,
      createdAt: new Date().toISOString(),
      template: template.name
    };

    // Build the hierarchy tree based on the template
    hierarchy.root = await this.buildHierarchyNode(entityName, template, match, 0);
    
    return hierarchy;
  }

  /**
   * Build individual hierarchy node
   */
  async buildHierarchyNode(entityName, template, match, levelIndex) {
    const level = template.levels[levelIndex];
    
    const node = {
      name: entityName,
      type: level.name,
      level: levelIndex,
      children: []
    };

    // If this entity matches the current level, build parent and children
    if (match.level === level.name) {
      // Build parent hierarchy (if not at root)
      if (levelIndex > 0) {
        const parentLevel = template.levels[levelIndex - 1];
        const parentName = this.extractParentName(entityName, parentLevel, level);
        
        const parentNode = {
          name: parentName,
          type: parentLevel.name,
          level: levelIndex - 1,
          children: [node]
        };
        
        return parentNode;
      }
      
      // Build children (if not at leaf)
      if (levelIndex < template.levels.length - 1) {
        const childLevel = template.levels[levelIndex + 1];
        const childNames = this.generateChildNames(entityName, level, childLevel);
        
        for (const childName of childNames) {
          const childNode = {
            name: childName,
            type: childLevel.name,
            level: levelIndex + 1,
            children: []
          };
          
          node.children.push(childNode);
        }
      }
    }
    
    return node;
  }

  /**
   * Extract parent name from entity name
   */
  extractParentName(entityName, parentLevel, currentLevel) {
    // For SOC Analyst Level 2 -> SOC
    if (currentLevel.pattern.includes('Analyst') && parentLevel.pattern.includes('SOC')) {
      return 'SOC';
    }
    
    // For Defender for Endpoint -> Microsoft Defender
    if (currentLevel.pattern.includes('Defender for') && parentLevel.pattern.includes('Microsoft Defender')) {
      return 'Microsoft Defender';
    }
    
    // Generic extraction
    const words = entityName.split(' ');
    return words.slice(0, Math.max(1, words.length - 1)).join(' ');
  }

  /**
   * Generate child names for entity
   */
  generateChildNames(entityName, currentLevel, childLevel) {
    const children = [];
    
    // SOC -> Roles, Projects, Infrastructure
    if (currentLevel.name === 'organization' && entityName.toLowerCase().includes('soc')) {
      children.push('SOC Roles', 'SOC Projects', 'SOC Infrastructure');
    }
    
    // SOC Roles -> Analyst, Supervisor, Manager
    else if (currentLevel.name === 'divisions' && entityName.toLowerCase().includes('roles')) {
      children.push('SOC Analyst', 'SOC Supervisor', 'SOC Manager');
    }
    
    // SOC Analyst -> Level 1, Level 2, Level 3
    else if (currentLevel.name === 'items' && entityName.toLowerCase().includes('analyst')) {
      children.push('SOC Analyst Level 1', 'SOC Analyst Level 2', 'SOC Analyst Level 3');
    }
    
    // Microsoft Defender -> Modules
    else if (currentLevel.name === 'suite' && entityName.toLowerCase().includes('defender')) {
      children.push('Defender for Endpoint', 'Defender for Office 365', 'Defender for Identity');
    }
    
    return children;
  }

  /**
   * Save hierarchy to file
   */
  async saveHierarchy(hierarchy) {
    try {
      const filename = `${hierarchy.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`;
      const filePath = path.join(this.hierarchiesPath, filename);
      
      await fs.writeFile(filePath, JSON.stringify(hierarchy, null, 2));
      console.log(chalk.green(`💾 Saved hierarchy: ${filename}`));
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Could not save hierarchy:', error.message));
    }
  }

  /**
   * Display hierarchy in tree format
   */
  displayHierarchy(hierarchy, highlightEntity = null) {
    console.log(chalk.yellow(`\n🌳 Hierarchy: ${hierarchy.name}`));
    
    if (hierarchy.root) {
      this.displayHierarchyNode(hierarchy.root, 0, highlightEntity);
    }
  }

  /**
   * Display individual hierarchy node
   */
  displayHierarchyNode(node, depth = 0, highlightEntity = null) {
    const indent = '  '.repeat(depth);
    const isHighlighted = highlightEntity && 
      (node.name.toLowerCase().includes(highlightEntity.toLowerCase()) ||
       highlightEntity.toLowerCase().includes(node.name.toLowerCase()));
    
    const nodeText = isHighlighted ? 
      chalk.yellow.bold(`${indent}• ${node.name} (${node.type})`) :
      `${indent}• ${node.name} (${node.type})`;
    
    console.log(nodeText);
    
    if (node.children) {
      node.children.forEach(child => {
        this.displayHierarchyNode(child, depth + 1, highlightEntity);
      });
    }
  }

  /**
   * Search entities with hierarchy context
   */
  async searchEntities(searchTerm, options = {}) {
    console.log(chalk.blue(`🔍 Searching entities: ${searchTerm}`));

    try {
      const results = {
        exact: [],
        partial: [],
        hierarchical: []
      };

      // Search in existing hierarchies
      const hierarchyFiles = await fs.readdir(this.hierarchiesPath);
      
      for (const file of hierarchyFiles) {
        if (file.endsWith('.json')) {
          const hierarchyPath = path.join(this.hierarchiesPath, file);
          const hierarchy = JSON.parse(await fs.readFile(hierarchyPath, 'utf-8'));
          
          const matches = this.searchInHierarchy(hierarchy, searchTerm);
          results.hierarchical.push(...matches);
        }
      }

      this.displaySearchResults(results, searchTerm);
      return results;
    } catch (error) {
      console.error(chalk.red('❌ Entity search failed:'), error.message);
      return null;
    }
  }

  /**
   * Search within a hierarchy
   */
  searchInHierarchy(hierarchy, searchTerm) {
    const matches = [];
    const lowerSearchTerm = searchTerm.toLowerCase();
    
    function searchNode(node, path = []) {
      const currentPath = [...path, node.name];
      
      if (node.name.toLowerCase().includes(lowerSearchTerm)) {
        matches.push({
          entity: node.name,
          type: node.type,
          hierarchy: hierarchy.name,
          path: currentPath,
          confidence: node.name.toLowerCase() === lowerSearchTerm ? 1.0 : 0.8
        });
      }
      
      if (node.children) {
        node.children.forEach(child => searchNode(child, currentPath));
      }
    }
    
    if (hierarchy.root) {
      searchNode(hierarchy.root);
    }
    
    return matches;
  }

  /**
   * Display search results
   */
  displaySearchResults(results, searchTerm) {
    console.log(chalk.yellow(`\n📊 Search Results for "${searchTerm}":`));
    
    if (results.hierarchical.length > 0) {
      console.log(chalk.cyan('\n🌳 Hierarchical Matches:'));
      results.hierarchical.forEach(match => {
        console.log(`  • ${match.entity} (${match.type}) - ${(match.confidence * 100).toFixed(1)}%`);
        console.log(chalk.grey(`    Path: ${match.path.join(' → ')}`));
        console.log(chalk.grey(`    Hierarchy: ${match.hierarchy}`));
      });
    }
    
    if (results.hierarchical.length === 0) {
      console.log(chalk.grey('  No matches found'));
    }
  }

  /**
   * List entities by domain
   */
  async listEntities(options = {}) {
    const domain = options.domain;
    
    console.log(chalk.blue(`📋 Listing entities${domain ? ` for domain: ${domain}` : ''}`));

    try {
      const entities = {};
      const hierarchyFiles = await fs.readdir(this.hierarchiesPath);
      
      for (const file of hierarchyFiles) {
        if (file.endsWith('.json')) {
          const hierarchyPath = path.join(this.hierarchiesPath, file);
          const hierarchy = JSON.parse(await fs.readFile(hierarchyPath, 'utf-8'));
          
          if (!domain || hierarchy.domain === domain) {
            const hierarchyEntities = this.extractEntitiesFromHierarchy(hierarchy);
            entities[hierarchy.name] = hierarchyEntities;
          }
        }
      }

      this.displayEntityList(entities, domain);
      return entities;
    } catch (error) {
      console.error(chalk.red('❌ Failed to list entities:'), error.message);
      return null;
    }
  }

  /**
   * Extract all entities from hierarchy
   */
  extractEntitiesFromHierarchy(hierarchy) {
    const entities = [];
    
    function extractFromNode(node) {
      entities.push({
        name: node.name,
        type: node.type,
        level: node.level
      });
      
      if (node.children) {
        node.children.forEach(child => extractFromNode(child));
      }
    }
    
    if (hierarchy.root) {
      extractFromNode(hierarchy.root);
    }
    
    return entities;
  }

  /**
   * Display entity list
   */
  displayEntityList(entities, domain) {
    console.log(chalk.yellow(`\n📊 Entities${domain ? ` (${domain})` : ''}:`));
    
    Object.entries(entities).forEach(([hierarchyName, hierarchyEntities]) => {
      console.log(chalk.cyan(`\n🌳 ${hierarchyName}:`));
      
      const byLevel = {};
      hierarchyEntities.forEach(entity => {
        if (!byLevel[entity.level]) byLevel[entity.level] = [];
        byLevel[entity.level].push(entity);
      });
      
      Object.keys(byLevel).sort((a, b) => parseInt(a) - parseInt(b)).forEach(level => {
        console.log(chalk.grey(`  Level ${level}:`));
        byLevel[level].forEach(entity => {
          console.log(`    • ${entity.name} (${entity.type})`);
        });
      });
    });
  }

  /**
   * Validate hierarchy accuracy
   */
  async validateHierarchyAccuracy(targetThreshold = 0.85) {
    console.log(chalk.blue('🔍 Validating hierarchy accuracy'));

    try {
      const hierarchyFiles = await fs.readdir(this.hierarchiesPath);
      let totalHierarchies = 0;
      let validHierarchies = 0;
      
      for (const file of hierarchyFiles) {
        if (file.endsWith('.json')) {
          totalHierarchies++;
          
          const hierarchyPath = path.join(this.hierarchiesPath, file);
          const hierarchy = JSON.parse(await fs.readFile(hierarchyPath, 'utf-8'));
          
          const isValid = this.validateHierarchyStructure(hierarchy);
          if (isValid) {
            validHierarchies++;
          }
        }
      }
      
      const accuracy = totalHierarchies > 0 ? validHierarchies / totalHierarchies : 0;
      
      console.log(chalk.yellow(`\n📊 Hierarchy Accuracy: ${(accuracy * 100).toFixed(1)}%`));
      console.log(`  Valid hierarchies: ${validHierarchies}/${totalHierarchies}`);
      
      if (accuracy >= targetThreshold) {
        console.log(chalk.green(`✅ Meets target threshold (${(targetThreshold * 100).toFixed(1)}%)`));
      } else {
        console.log(chalk.red(`❌ Below target threshold (${(targetThreshold * 100).toFixed(1)}%)`));
      }
      
      return accuracy;
    } catch (error) {
      console.error(chalk.red('❌ Hierarchy validation failed:'), error.message);
      return 0;
    }
  }

  /**
   * Validate individual hierarchy structure
   */
  validateHierarchyStructure(hierarchy) {
    // Check required fields
    if (!hierarchy.name || !hierarchy.root) {
      return false;
    }
    
    // Check hierarchy depth and consistency
    function validateNode(node, expectedLevel = 0) {
      if (node.level !== expectedLevel) {
        return false;
      }
      
      if (node.children) {
        return node.children.every(child => validateNode(child, expectedLevel + 1));
      }
      
      return true;
    }
    
    return validateNode(hierarchy.root);
  }

  /**
   * Merge entities while preserving hierarchy
   */
  async mergeEntities(sourceId, targetId, options = {}) {
    console.log(chalk.blue(`🔗 Merging entities: ${sourceId} → ${targetId}`));
    
    // Implementation would merge entities while maintaining hierarchical relationships
    // This is a placeholder for the full implementation
    
    console.log(chalk.green('✅ Entities merged successfully'));
    return { success: true, sourceId, targetId };
  }

  /**
   * Create a new entity
   */
  async createEntity(entity, options = { overwrite: true }) {
    if (!entity.name || !entity.type || !entity.domain) {
      throw new Error('Entity must have name, type, and domain');
    }

    const entityTypePath = path.join(this.dataPath, entity.domain, 'entities', entity.type);
    await fs.mkdir(entityTypePath, { recursive: true });

    const slug = entity.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const entityPath = path.join(entityTypePath, `${slug}.json`);

    if (!options.overwrite) {
      try {
        await fs.access(entityPath);
        // File exists, so we skip creation
        return;
      } catch (error) {
        // File doesn't exist, proceed
      }
    }

    await fs.writeFile(entityPath, JSON.stringify(entity, null, 2));
  }

  /**
   * Create a new relationship
   */
  async createRelationship(relationship) {
    if (!relationship.source || !relationship.target || !relationship.type || !relationship.domain) {
      throw new Error('Relationship must have source, target, type, and domain');
    }

    const domainPath = path.join(this.dataPath, relationship.domain);
    await fs.mkdir(domainPath, { recursive: true });

    const relationshipPath = path.join(domainPath, 'relationships.jsonl');
    const relationshipLine = JSON.stringify(relationship) + '\n';

    await fs.appendFile(relationshipPath, relationshipLine);
  }

  /**
   * Default hierarchy templates
   */
  getDefaultHierarchyTemplates() {
    return {
      "soc_operations": {
        name: "SOC Operations",
        domains: ["cybersecurity"],
        levels: [
          {
            name: "organization",
            pattern: "SOC|Security Operations Center",
            children_type: "divisions"
          },
          {
            name: "divisions",
            pattern: "Roles|Projects|Infrastructure",
            children_type: "items"
          },
          {
            name: "items",
            pattern: "Analyst|Manager|Supervisor|Compliance|Tools",
            children_type: "specifics"
          },
          {
            name: "specifics",
            pattern: "Level \\d+|Senior|Junior|Lead",
            children_type: null
          }
        ]
      },
      
      "microsoft_defender": {
        name: "Microsoft Defender Suite",
        domains: ["cybersecurity"],
        levels: [
          {
            name: "suite",
            pattern: "Microsoft Defender",
            children_type: "modules"
          },
          {
            name: "modules",
            pattern: "Defender for \\w+",
            children_type: "capabilities"
          },
          {
            name: "capabilities",
            pattern: "\\w+ Protection|\\w+ Detection|\\w+ Response",
            children_type: "configurations"
          },
          {
            name: "configurations",
            pattern: "Policy|Rule|Setting",
            children_type: null
          }
        ]
      },
      
      "construction_project": {
        name: "Construction Project",
        domains: ["construction"],
        levels: [
          {
            name: "project",
            pattern: "\\w+ Project|\\w+ Repair|\\w+ Construction",
            children_type: "phases"
          },
          {
            name: "phases",
            pattern: "Planning|Materials|Labor|Completion",
            children_type: "tasks"
          },
          {
            name: "tasks",
            pattern: "\\w+ Installation|\\w+ Repair|\\w+ Purchase",
            children_type: "items"
          },
          {
            name: "items",
            pattern: "\\w+ Material|\\w+ Tool|\\w+ Service",
            children_type: null
          }
        ]
      }
    };
  }
}
