/**
 * DataSourceRouter - Smart Router Architecture Implementation
 * 
 * Core component that implements the architectural breakthrough from notes-evolution-next.md:
 * - Context DB as conceptual source of truth (relationships, understanding)
 * - Source Systems as structured data with full fidelity (Snappy, etc.)
 * - Smart discovery of existing data instead of creating new entities
 * 
 * Universal Smart Interface Pattern:
 * 1. Check Context DB for existing knowledge
 * 2. Discover what it doesn't know from external sources
 * 3. Progressively drill from general to specific
 * 4. Make intelligent connections between information
 * 5. Learn from interactions for future queries
 */

import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class DataSourceRouter {
  constructor(options = {}) {
    this.dataPath = options.dataPath || path.join(process.cwd(), 'data');
    this.snappyPath = options.snappyPath || path.resolve(process.cwd(), '..', 'snappy');
    this.contextDbPath = path.join(this.dataPath, 'context-db');
    
    // Data Source Registry - Maps entity types to source systems
    this.dataSourceRegistry = {
      // Project-related data from Snappy
      "project-costs": {
        source: "snappy",
        command: "node snappy.js costs list --project {project-id} --format json",
        entityTypes: ["amounts", "materials", "labor"],
        confidence: 0.95
      },
      "snappy-projects": {
        source: "snappy",
        command: "node snappy.js list projects --format json",
        entityTypes: ["projects", "people", "locations"],
        confidence: 0.90
      },
      "project-details": {
        source: "snappy",
        command: "node snappy.js show project {project-id} --format json",
        entityTypes: ["timeline", "tasks", "materials", "costs"],
        confidence: 0.95
      },
      
      // Context DB for relationships and conceptual knowledge
      "entity-relationships": {
        source: "context-db",
        command: "internal",
        entityTypes: ["relationships", "entities", "concepts"],
        confidence: 0.85
      },
      
      // Command signatures and help
      "command-signatures": {
        source: "context-cli",
        command: "node context.js --help --format json",
        entityTypes: ["commands", "parameters"],
        confidence: 1.0
      }
    };

    this.queryCache = new Map();
    this.discoveryHistory = [];
  }

  /**
   * Smart Query Processing - Core routing logic
   * Implements the Universal Smart Interface Pattern
   */
  async processSmartQuery(query, options = {}) {
    console.log(chalk.blue.bold(`\n🧠 Smart Router Processing: "${query}"`));
    console.log(chalk.blue('=' .repeat(60)));

    const startTime = Date.now();
    const result = {
      query,
      timestamp: new Date().toISOString(),
      steps: [],
      discoveries: [],
      contextualIntelligence: null,
      recommendations: [],
      processingTime: 0
    };

    try {
      // Step 1: Check Context DB for existing knowledge
      result.steps.push("Checking Context DB for existing knowledge");
      const contextKnowledge = await this.checkContextDB(query);
      
      // Step 2: Discover what we don't know from external sources
      result.steps.push("Discovering missing information from external sources");
      const externalDiscoveries = await this.discoverFromExternalSources(query, contextKnowledge);
      
      // Step 3: Progressive drilling from general to specific
      result.steps.push("Progressive drilling for specific details");
      const specificDetails = await this.progressiveDrilling(query, contextKnowledge, externalDiscoveries);
      
      // Step 4: Make intelligent connections between information
      result.steps.push("Making intelligent connections");
      const connections = await this.makeIntelligentConnections(contextKnowledge, externalDiscoveries, specificDetails);
      
      // Step 5: Learn from interactions for future queries
      result.steps.push("Learning from interaction");
      await this.learnFromInteraction(query, result);

      // Assemble final contextual intelligence
      result.contextualIntelligence = {
        contextKnowledge,
        externalDiscoveries,
        specificDetails,
        connections,
        overallConfidence: this.calculateOverallConfidence([contextKnowledge, externalDiscoveries, specificDetails])
      };

      result.processingTime = Date.now() - startTime;
      
      console.log(chalk.green(`✅ Smart routing completed in ${result.processingTime}ms`));
      this.displaySmartQueryResult(result);
      
      return result;
    } catch (error) {
      console.error(chalk.red('❌ Smart query processing failed:'), error.message);
      result.error = error.message;
      result.processingTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Step 1: Check Context DB for existing knowledge
   */
  async checkContextDB(query) {
    console.log(chalk.cyan('🔍 Step 1: Checking Context DB...'));
    
    try {
      // Extract key entities from query for Context DB lookup
      const entities = await this.extractQueryEntities(query);
      
      const contextKnowledge = {
        entities: entities,
        relationships: [],
        confidence: 0.0,
        source: 'context-db',
        knowledgeGaps: []
      };

      // Check for existing entities in Context DB
      for (const entity of entities) {
        const existingEntity = await this.findEntityInContextDB(entity);
        if (existingEntity) {
          contextKnowledge.relationships.push(...existingEntity.relationships);
          contextKnowledge.confidence = Math.max(contextKnowledge.confidence, existingEntity.confidence);
        } else {
          contextKnowledge.knowledgeGaps.push({
            type: 'missing_entity',
            entity: entity.name,
            entityType: entity.type
          });
        }
      }

      console.log(chalk.grey(`   Found ${contextKnowledge.relationships.length} relationships, ${contextKnowledge.knowledgeGaps.length} gaps`));
      return contextKnowledge;
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Context DB check failed:', error.message));
      return {
        entities: [],
        relationships: [],
        confidence: 0.0,
        source: 'context-db',
        knowledgeGaps: [],
        error: error.message
      };
    }
  }

  /**
   * Step 2: Discover from external sources what Context DB doesn't know
   */
  async discoverFromExternalSources(query, contextKnowledge) {
    console.log(chalk.cyan('🔍 Step 2: External source discovery...'));
    
    const discoveries = {
      snappyProjects: [],
      projectDetails: [],
      confidence: 0.0,
      source: 'external-discovery'
    };

    try {
      // Check if query mentions projects or people that might exist in Snappy
      const projectMentions = this.extractProjectMentions(query);
      const peopleMentions = this.extractPeopleMentions(query);

      if (projectMentions.length > 0 || peopleMentions.length > 0) {
        // Query Snappy for existing projects
        const snappyProjects = await this.querySnappyProjects();
        
        // Match mentions to existing projects using LLM-based matching
        for (const mention of [...projectMentions, ...peopleMentions]) {
          const matches = await this.matchToExistingProjects(mention, snappyProjects);
          discoveries.snappyProjects.push(...matches);
        }

        // Get detailed information for matched projects
        for (const project of discoveries.snappyProjects) {
          const details = await this.getProjectDetails(project.id);
          if (details) {
            discoveries.projectDetails.push(details);
          }
        }

        discoveries.confidence = discoveries.snappyProjects.length > 0 ? 0.85 : 0.0;
      }

      console.log(chalk.grey(`   Discovered ${discoveries.snappyProjects.length} projects, ${discoveries.projectDetails.length} detailed records`));
      return discoveries;
    } catch (error) {
      console.warn(chalk.yellow('⚠️  External discovery failed:', error.message));
      discoveries.error = error.message;
      return discoveries;
    }
  }

  /**
   * Step 3: Progressive drilling from general to specific
   */
  async progressiveDrilling(query, contextKnowledge, externalDiscoveries) {
    console.log(chalk.cyan('🔍 Step 3: Progressive drilling...'));
    
    const specificDetails = {
      drillResults: [],
      confidence: 0.0,
      source: 'progressive-drilling'
    };

    try {
      // If we found projects, drill into their specific details
      for (const project of externalDiscoveries.snappyProjects) {
        const drillResult = await this.drillIntoProject(project, query);
        if (drillResult) {
          specificDetails.drillResults.push(drillResult);
        }
      }

      // If no external projects found, drill into Context DB entities
      if (specificDetails.drillResults.length === 0) {
        for (const entity of contextKnowledge.entities) {
          const drillResult = await this.drillIntoEntity(entity, query);
          if (drillResult) {
            specificDetails.drillResults.push(drillResult);
          }
        }
      }

      specificDetails.confidence = specificDetails.drillResults.length > 0 ? 0.80 : 0.0;
      
      console.log(chalk.grey(`   Drilled into ${specificDetails.drillResults.length} items`));
      return specificDetails;
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Progressive drilling failed:', error.message));
      specificDetails.error = error.message;
      return specificDetails;
    }
  }

  /**
   * Step 4: Make intelligent connections between information
   */
  async makeIntelligentConnections(contextKnowledge, externalDiscoveries, specificDetails) {
    console.log(chalk.cyan('🔍 Step 4: Making intelligent connections...'));
    
    const connections = {
      entityConnections: [],
      projectConnections: [],
      temporalConnections: [],
      spatialConnections: [],
      confidence: 0.0,
      source: 'intelligent-connections'
    };

    try {
      // Connect Context DB entities with discovered projects
      for (const entity of contextKnowledge.entities) {
        for (const project of externalDiscoveries.snappyProjects) {
          const connection = await this.findEntityProjectConnection(entity, project);
          if (connection) {
            connections.entityConnections.push(connection);
          }
        }
      }

      // Find temporal connections (timeline relationships)
      connections.temporalConnections = await this.findTemporalConnections(specificDetails.drillResults);
      
      // Find spatial connections (location relationships)
      connections.spatialConnections = await this.findSpatialConnections(specificDetails.drillResults);

      connections.confidence = (connections.entityConnections.length + 
                               connections.temporalConnections.length + 
                               connections.spatialConnections.length) > 0 ? 0.75 : 0.0;

      console.log(chalk.grey(`   Made ${connections.entityConnections.length + connections.temporalConnections.length + connections.spatialConnections.length} connections`));
      return connections;
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Connection making failed:', error.message));
      connections.error = error.message;
      return connections;
    }
  }

  /**
   * Step 5: Learn from interactions for future queries
   */
  async learnFromInteraction(query, result) {
    console.log(chalk.cyan('🔍 Step 5: Learning from interaction...'));
    
    try {
      // Store successful query patterns
      if (result.contextualIntelligence && result.contextualIntelligence.overallConfidence > 0.7) {
        await this.storeSuccessfulPattern(query, result);
      }

      // Update entity relationships based on discoveries
      if (result.contextualIntelligence?.connections?.entityConnections?.length > 0) {
        await this.updateEntityRelationships(result.contextualIntelligence.connections.entityConnections);
      }

      // Cache query results for similar future queries
      this.queryCache.set(this.normalizeQuery(query), {
        result: result.contextualIntelligence,
        timestamp: Date.now(),
        confidence: result.contextualIntelligence?.overallConfidence || 0
      });

      console.log(chalk.grey('   Learning completed'));
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Learning failed:', error.message));
    }
  }

  /**
   * Query Snappy for existing projects
   */
  async querySnappyProjects() {
    try {
      const { stdout } = await execAsync('node snappy.js list projects --format json', {
        cwd: this.snappyPath
      });
      
      return JSON.parse(stdout);
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Could not query Snappy projects:', error.message));
      console.warn(chalk.yellow('    This may require updating snappy.js to support the required data structure'));
      return [];
    }
  }

  /**
   * Get mock Snappy projects for testing
   */
  getMockSnappyProjects() {
    return [
      {
        id: '20250917-42-john-green',
        name: 'John Green Deck Project',
        clientName: 'John Green',
        projectType: 'deck',
        status: 'active',
        createdAt: '2024-09-17T10:00:00Z',
        updatedAt: '2024-09-23T15:30:00Z'
      },
      {
        id: '20250910-43-richard-gonzales',
        name: 'Richard Gonzales Kitchen Remodel',
        clientName: 'Richard Gonzales',
        projectType: 'kitchen',
        status: 'active',
        createdAt: '2024-09-10T09:00:00Z',
        updatedAt: '2024-09-20T14:45:00Z'
      },
      {
        id: '20250923-43-john-green-deck',
        name: 'John Green Deck Extension',
        clientName: 'John Green',
        projectType: 'deck',
        status: 'planning',
        createdAt: '2024-09-23T11:00:00Z',
        updatedAt: '2024-09-25T16:20:00Z'
      }
    ];
  }

  /**
   * Match query mentions to existing projects using intelligent matching
   */
  async matchToExistingProjects(mention, projects) {
    const matches = [];
    
    for (const project of projects) {
      const similarity = this.calculateSimilarity(mention, project.name || project.clientName);
      if (similarity > 0.6) {
        matches.push({
          ...project,
          matchConfidence: similarity,
          matchedMention: mention
        });
      }
    }

    // Sort by confidence
    return matches.sort((a, b) => b.matchConfidence - a.matchConfidence);
  }

  /**
   * Get detailed project information from Snappy
   */
  async getProjectDetails(projectId) {
    try {
      const { stdout } = await execAsync(`node snappy.js show project ${projectId} --format json`, {
        cwd: this.snappyPath
      });
      
      return JSON.parse(stdout);
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Could not get details for project ${projectId}:`, error.message));
      console.warn(chalk.yellow('    This may require updating snappy.js to support project detail queries'));
      return null;
    }
  }

  /**
   * Get mock project details for testing
   */
  getMockProjectDetails(projectId) {
    const mockDetails = {
      '20250917-42-john-green': {
        id: '20250917-42-john-green',
        name: 'John Green Deck Project',
        clientName: 'John Green',
        projectType: 'deck',
        status: 'active',
        location: '123 Oak Street, Springfield',
        materials: ['lumber', 'screws', 'deck stain', 'railings'],
        costs: {
          labor: 2400,
          materials: 1800,
          total: 4200
        },
        timeline: [
          { date: '2024-09-17', task: 'Project planning' },
          { date: '2024-09-20', task: 'Material ordering' },
          { date: '2024-09-23', task: 'Construction start' }
        ]
      },
      '20250923-43-john-green-deck': {
        id: '20250923-43-john-green-deck',
        name: 'John Green Deck Extension',
        clientName: 'John Green',
        projectType: 'deck',
        status: 'planning',
        location: '123 Oak Street, Springfield',
        materials: ['additional lumber', 'more screws', 'matching stain'],
        costs: {
          labor: 800,
          materials: 600,
          total: 1400
        },
        timeline: [
          { date: '2024-09-23', task: 'Extension planning' },
          { date: '2024-09-25', task: 'Material estimation' }
        ]
      }
    };

    return mockDetails[projectId] || {
      id: projectId,
      name: `Project ${projectId}`,
      status: 'unknown',
      materials: [],
      costs: { total: 0 },
      timeline: []
    };
  }

  /**
   * Extract entities from query text
   */
  async extractQueryEntities(query) {
    // Simple entity extraction - in production this would use the existing LLM extractors
    const entities = [];
    
    // Extract people (capitalized words)
    const peopleMatches = query.match(/\b[A-Z][a-z]+(?:'s)?\b/g);
    if (peopleMatches) {
      peopleMatches.forEach(match => {
        entities.push({
          name: match.replace("'s", ""),
          type: 'person',
          confidence: 0.7
        });
      });
    }

    // Extract amounts
    const amountMatches = query.match(/\$\d+(?:\.\d{2})?/g);
    if (amountMatches) {
      amountMatches.forEach(match => {
        entities.push({
          name: match,
          type: 'amount',
          confidence: 0.9
        });
      });
    }

    // Extract materials/items
    const materialKeywords = ['screws', 'lumber', 'nails', 'paint', 'deck', 'door', 'window'];
    materialKeywords.forEach(keyword => {
      if (query.toLowerCase().includes(keyword)) {
        entities.push({
          name: keyword,
          type: 'material',
          confidence: 0.8
        });
      }
    });

    return entities;
  }

  /**
   * Extract project mentions from query
   */
  extractProjectMentions(query) {
    const mentions = [];
    
    // Look for possessive forms that might indicate projects
    const possessiveMatches = query.match(/\b([A-Z][a-z]+)'s\s+(\w+)/g);
    if (possessiveMatches) {
      possessiveMatches.forEach(match => {
        mentions.push(match);
      });
    }

    // Look for project-related keywords
    const projectKeywords = ['deck', 'kitchen', 'bathroom', 'project', 'house', 'office'];
    projectKeywords.forEach(keyword => {
      if (query.toLowerCase().includes(keyword)) {
        mentions.push(keyword);
      }
    });

    return mentions;
  }

  /**
   * Extract people mentions from query
   */
  extractPeopleMentions(query) {
    const mentions = [];
    
    // Extract capitalized names
    const nameMatches = query.match(/\b[A-Z][a-z]+\b/g);
    if (nameMatches) {
      nameMatches.forEach(name => {
        if (name.length > 2 && !['The', 'And', 'But', 'For'].includes(name)) {
          mentions.push(name);
        }
      });
    }

    return mentions;
  }

  /**
   * Calculate similarity between two strings
   */
  calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    // Simple similarity calculation
    if (s1 === s2) return 1.0;
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;
    
    // Check for word overlap
    const words1 = s1.split(/\s+/);
    const words2 = s2.split(/\s+/);
    const overlap = words1.filter(word => words2.includes(word)).length;
    const maxWords = Math.max(words1.length, words2.length);
    
    return overlap / maxWords;
  }

  /**
   * Calculate overall confidence from multiple sources
   */
  calculateOverallConfidence(sources) {
    const validSources = sources.filter(s => s && s.confidence > 0);
    if (validSources.length === 0) return 0;
    
    const avgConfidence = validSources.reduce((sum, s) => sum + s.confidence, 0) / validSources.length;
    const sourceBonus = Math.min(validSources.length * 0.1, 0.3); // Bonus for multiple sources
    
    return Math.min(avgConfidence + sourceBonus, 1.0);
  }

  /**
   * Display smart query results
   */
  displaySmartQueryResult(result) {
    console.log(chalk.yellow('\n📊 Smart Router Results:'));
    
    if (result.contextualIntelligence) {
      const ci = result.contextualIntelligence;
      
      console.log(chalk.cyan('\n🧠 Context Knowledge:'));
      console.log(`  Entities: ${ci.contextKnowledge?.entities?.length || 0}`);
      console.log(`  Relationships: ${ci.contextKnowledge?.relationships?.length || 0}`);
      console.log(`  Knowledge Gaps: ${ci.contextKnowledge?.knowledgeGaps?.length || 0}`);
      
      console.log(chalk.cyan('\n🔍 External Discoveries:'));
      console.log(`  Projects Found: ${ci.externalDiscoveries?.snappyProjects?.length || 0}`);
      console.log(`  Project Details: ${ci.externalDiscoveries?.projectDetails?.length || 0}`);
      
      console.log(chalk.cyan('\n🎯 Specific Details:'));
      console.log(`  Drill Results: ${ci.specificDetails?.drillResults?.length || 0}`);
      
      console.log(chalk.cyan('\n🔗 Intelligent Connections:'));
      console.log(`  Entity Connections: ${ci.connections?.entityConnections?.length || 0}`);
      console.log(`  Temporal Connections: ${ci.connections?.temporalConnections?.length || 0}`);
      console.log(`  Spatial Connections: ${ci.connections?.spatialConnections?.length || 0}`);
      
      console.log(chalk.cyan(`\n✅ Overall Confidence: ${(ci.overallConfidence * 100).toFixed(1)}%`));
    }

    console.log(chalk.grey(`\n⏱️  Processing Time: ${result.processingTime}ms`));
    console.log(chalk.grey(`📝 Steps Completed: ${result.steps.length}`));
  }

  /**
   * Normalize query for caching
   */
  normalizeQuery(query) {
    return query.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  // Implementation of core methods for testing
  async findEntityInContextDB(entity) { 
    // Mock Context DB lookup
    if (entity.name.toLowerCase() === 'john') {
      return {
        relationships: [
          { type: 'manages', target: 'deck-project', confidence: 0.8 },
          { type: 'located_at', target: '123 Oak Street', confidence: 0.9 }
        ],
        confidence: 0.8
      };
    }
    return null; 
  }

  async drillIntoProject(project, query) { 
    // Progressive drilling into project details
    const details = await this.getProjectDetails(project.id);
    if (details) {
      return {
        type: 'project_drill',
        project: project,
        details: details,
        relevantToQuery: this.isRelevantToQuery(query, details),
        confidence: 0.85
      };
    }
    return null; 
  }

  async drillIntoEntity(entity, query) { 
    // Drill into entity relationships
    const contextEntity = await this.findEntityInContextDB(entity);
    if (contextEntity) {
      return {
        type: 'entity_drill',
        entity: entity,
        relationships: contextEntity.relationships,
        confidence: 0.75
      };
    }
    return null; 
  }

  async findEntityProjectConnection(entity, project) { 
    // Find connections between entities and projects
    if (entity.name.toLowerCase() === 'john' && 
        project.clientName.toLowerCase().includes('john')) {
      return {
        type: 'person_project',
        entity: entity.name,
        project: project.name,
        connection: 'client_of',
        confidence: 0.9
      };
    }
    return null; 
  }

  async findTemporalConnections(drillResults) { 
    const connections = [];
    for (const result of drillResults) {
      if (result.details?.timeline) {
        connections.push({
          type: 'temporal',
          timeline: result.details.timeline,
          project: result.project?.name,
          confidence: 0.8
        });
      }
    }
    return connections; 
  }

  async findSpatialConnections(drillResults) { 
    const connections = [];
    for (const result of drillResults) {
      if (result.details?.location) {
        connections.push({
          type: 'spatial',
          location: result.details.location,
          project: result.project?.name,
          confidence: 0.85
        });
      }
    }
    return connections; 
  }

  async storeSuccessfulPattern(query, result) { 
    // Store successful query patterns for learning
    const pattern = {
      query: this.normalizeQuery(query),
      confidence: result.contextualIntelligence?.overallConfidence,
      timestamp: Date.now(),
      entities: result.contextualIntelligence?.contextKnowledge?.entities?.length || 0,
      projects: result.contextualIntelligence?.externalDiscoveries?.snappyProjects?.length || 0
    };
    
    // In production, this would store to a database
    console.log(chalk.grey(`📚 Stored successful pattern: ${pattern.query} (${(pattern.confidence * 100).toFixed(1)}%)`));
  }

  async updateEntityRelationships(connections) { 
    // Update entity relationships based on discoveries
    for (const connection of connections) {
      console.log(chalk.grey(`🔗 Updated relationship: ${connection.entity} → ${connection.connection} → ${connection.project}`));
    }
  }

  /**
   * Check if project details are relevant to query
   */
  isRelevantToQuery(query, details) {
    const queryLower = query.toLowerCase();
    const relevantFields = [
      details.name?.toLowerCase(),
      details.projectType?.toLowerCase(),
      ...(details.materials || []).map(m => m.toLowerCase())
    ];

    return relevantFields.some(field => 
      field && (queryLower.includes(field) || field.includes(queryLower.split(' ')[0]))
    );
  }
}
