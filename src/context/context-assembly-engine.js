/**
 * Context Assembly Engine
 * 
 * Main orchestrator for the contextual intelligence system.
 * Handles complex multi-entity queries and maintains conversation state.
 */

import { QueryProcessor } from './query-processor.js';
import { RelationshipGraph } from '../relationships/entity-schema.js';
import chalk from 'chalk';

class ContextAssemblyEngine {
  constructor(options = {}) {
    this.queryProcessor = new QueryProcessor(options);
    this.domain = options.domain || 'construction';
    this.dataPath = options.dataPath;
    
    // Conversation state management
    this.conversationState = new Map();
    this.sessionTimeout = options.sessionTimeout || 30 * 60 * 1000; // 30 minutes
    
    // Context assembly configuration
    this.config = {
      maxContextDepth: options.maxContextDepth || 3,
      confidenceThreshold: options.confidenceThreshold || 0.6,
      maxRelatedEntities: options.maxRelatedEntities || 10
    };
  }

  /**
   * Process a contextual query with full context assembly
   */
  async processContextualQuery(query, options = {}) {
    const {
      userId = 'unknown',
      sessionId = userId,
      currentLocation = null,
      currentProject = null,
      executeActions = false,
      maintainContext = true
    } = options;

    console.log(chalk.blue.bold(`🧠 Context Assembly Engine`));
    console.log(chalk.blue.bold(`Query: "${query}"`));
    console.log(chalk.blue.bold('=' .repeat(80)));

    const assemblyResult = {
      query,
      sessionId,
      userId,
      timestamp: new Date().toISOString(),
      steps: [],
      contextualIntelligence: null,
      finalResponse: null,
      metadata: {
        startTime: Date.now(),
        executeActions
      }
    };

    try {
      // Step 1: Load/Update conversation context
      console.log(chalk.cyan('Step 1: Context State Management'));
      const conversationContext = await this.loadConversationContext(sessionId, userId);
      
      // Update with current information
      if (currentLocation) conversationContext.currentLocation = currentLocation;
      if (currentProject) conversationContext.currentProject = currentProject;
      
      assemblyResult.steps.push({
        step: 'context_loading',
        result: {
          sessionAge: Date.now() - conversationContext.startTime,
          entitiesInContext: conversationContext.entities.size,
          currentLocation: conversationContext.currentLocation,
          currentProject: conversationContext.currentProject
        },
        success: true
      });

      // Step 2: Process the query
      console.log(chalk.cyan('Step 2: Query Processing'));
      const queryResult = await this.queryProcessor.processQuery(query, {
        userId,
        currentLocation: conversationContext.currentLocation,
        currentProject: conversationContext.currentProject,
        executeActions
      });

      assemblyResult.steps.push({
        step: 'query_processing',
        result: queryResult,
        success: queryResult.metadata.success
      });

      // Step 3: Assemble contextual intelligence
      console.log(chalk.cyan('Step 3: Contextual Intelligence Assembly'));
      const contextualIntelligence = await this.assembleContextualIntelligence(
        queryResult,
        conversationContext
      );

      assemblyResult.contextualIntelligence = contextualIntelligence;
      assemblyResult.steps.push({
        step: 'intelligence_assembly',
        result: contextualIntelligence,
        success: true
      });

      // Step 4: Generate enhanced response
      console.log(chalk.cyan('Step 4: Response Generation'));
      const enhancedResponse = await this.generateEnhancedResponse(
        queryResult,
        contextualIntelligence,
        conversationContext
      );

      assemblyResult.finalResponse = enhancedResponse;
      assemblyResult.steps.push({
        step: 'response_generation',
        result: enhancedResponse,
        success: true
      });

      // Step 5: Update conversation state
      if (maintainContext) {
        console.log(chalk.cyan('Step 5: Context State Update'));
        await this.updateConversationContext(
          sessionId,
          queryResult,
          contextualIntelligence,
          conversationContext
        );
        
        assemblyResult.steps.push({
          step: 'context_update',
          result: { contextUpdated: true },
          success: true
        });
      }

      assemblyResult.metadata.totalDuration = Date.now() - assemblyResult.metadata.startTime;
      assemblyResult.metadata.success = true;

      console.log(chalk.green.bold(`✅ Context Assembly Complete (${assemblyResult.metadata.totalDuration}ms)`));
      console.log(chalk.green(`   Intelligence Level: ${contextualIntelligence.intelligenceLevel}`));
      console.log(chalk.green(`   Context Entities: ${contextualIntelligence.contextEntities.length}`));
      console.log(chalk.green(`   Actions: ${queryResult.finalResult?.actions?.length || 0}`));

      return assemblyResult;

    } catch (error) {
      console.error(chalk.red(`❌ Context assembly failed: ${error.message}`));
      
      assemblyResult.steps.push({
        step: 'error',
        error: error.message,
        success: false
      });
      
      assemblyResult.metadata.success = false;
      assemblyResult.metadata.error = error.message;
      
      throw error;
    }
  }

  /**
   * Load or create conversation context
   */
  async loadConversationContext(sessionId, userId) {
    if (this.conversationState.has(sessionId)) {
      const context = this.conversationState.get(sessionId);
      
      // Check if session has expired
      if (Date.now() - context.lastActivity > this.sessionTimeout) {
        console.log(chalk.yellow(`⏰ Session ${sessionId} expired, creating new context`));
        this.conversationState.delete(sessionId);
        return this.createNewConversationContext(sessionId, userId);
      }
      
      context.lastActivity = Date.now();
      return context;
    }
    
    return this.createNewConversationContext(sessionId, userId);
  }

  /**
   * Create new conversation context
   */
  createNewConversationContext(sessionId, userId) {
    const context = {
      sessionId,
      userId,
      startTime: Date.now(),
      lastActivity: Date.now(),
      currentLocation: null,
      currentProject: null,
      entities: new Map(), // Track entities mentioned in conversation
      relationships: new Map(), // Track relationships discovered
      queryHistory: [],
      contextualMemory: {
        recentLocations: [],
        recentProjects: [],
        recentPeople: [],
        recentActions: []
      }
    };
    
    this.conversationState.set(sessionId, context);
    console.log(chalk.gray(`📝 Created new conversation context for session ${sessionId}`));
    
    return context;
  }

  /**
   * Assemble contextual intelligence from query results and conversation state
   */
  async assembleContextualIntelligence(queryResult, conversationContext) {
    const intelligence = {
      intelligenceLevel: 'basic',
      contextEntities: [],
      relationshipNetwork: null,
      spatialContext: null,
      temporalContext: null,
      financialContext: null,
      projectContext: null,
      confidence: 0.5,
      insights: []
    };

    try {
      // Extract entities from query result
      const queryEntities = this.extractEntitiesFromQueryResult(queryResult);
      
      // Combine with conversation context entities
      const allEntities = this.combineEntities(queryEntities, conversationContext.entities);
      intelligence.contextEntities = Array.from(allEntities.values());

      // Build relationship network
      if (intelligence.contextEntities.length > 1) {
        intelligence.relationshipNetwork = await this.buildContextualRelationshipNetwork(
          intelligence.contextEntities
        );
        intelligence.intelligenceLevel = 'relational';
      }

      // Assemble spatial context
      intelligence.spatialContext = this.assembleSpatialContext(
        intelligence.contextEntities,
        conversationContext
      );

      // Assemble temporal context
      intelligence.temporalContext = this.assembleTemporalContext(
        queryResult,
        conversationContext
      );

      // Assemble financial context
      intelligence.financialContext = this.assembleFinancialContext(
        queryResult,
        intelligence.contextEntities
      );

      // Assemble project context
      intelligence.projectContext = this.assembleProjectContext(
        intelligence.contextEntities,
        conversationContext
      );

      // Generate insights
      intelligence.insights = await this.generateContextualInsights(intelligence);

      // Determine overall intelligence level
      intelligence.intelligenceLevel = this.determineIntelligenceLevel(intelligence);
      intelligence.confidence = this.calculateIntelligenceConfidence(intelligence);

      console.log(chalk.green(`🧠 Assembled ${intelligence.intelligenceLevel} intelligence (${(intelligence.confidence * 100).toFixed(1)}%)`));

      return intelligence;

    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Intelligence assembly failed: ${error.message}`));
      return intelligence; // Return basic intelligence on failure
    }
  }

  /**
   * Extract entities from query processing result
   */
  extractEntitiesFromQueryResult(queryResult) {
    const entities = new Map();
    
    if (queryResult.finalResult?.resolvedContext?.entities) {
      for (const [type, entityList] of Object.entries(queryResult.finalResult.resolvedContext.entities)) {
        if (Array.isArray(entityList)) {
          for (const entity of entityList) {
            const key = `${type}:${entity.name || entity.id}`;
            entities.set(key, {
              ...entity,
              type: type.slice(0, -1), // Remove 's' from plural
              source: 'query',
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    }

    return entities;
  }

  /**
   * Combine entities from different sources
   */
  combineEntities(queryEntities, contextEntities) {
    const combined = new Map();
    
    // Add context entities
    for (const [key, entity] of contextEntities) {
      combined.set(key, { ...entity, source: 'context' });
    }
    
    // Add/update with query entities
    for (const [key, entity] of queryEntities) {
      if (combined.has(key)) {
        // Merge entities, preferring query data
        const existing = combined.get(key);
        combined.set(key, {
          ...existing,
          ...entity,
          confidence: Math.max(existing.confidence || 0, entity.confidence || 0),
          sources: [existing.source, entity.source]
        });
      } else {
        combined.set(key, entity);
      }
    }
    
    return combined;
  }

  /**
   * Build contextual relationship network
   */
  async buildContextualRelationshipNetwork(entities) {
    // Create a mini relationship graph from the contextual entities
    const nodes = new Map();
    const edges = [];

    for (const entity of entities) {
      nodes.set(entity.id || entity.name, {
        id: entity.id || entity.name,
        type: entity.type,
        name: entity.name,
        confidence: entity.confidence
      });
    }

    // Infer relationships based on entity types and context
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entity1 = entities[i];
        const entity2 = entities[j];
        
        const relationship = this.inferContextualRelationship(entity1, entity2);
        if (relationship) {
          edges.push({
            source: entity1.id || entity1.name,
            target: entity2.id || entity2.name,
            type: relationship.type,
            confidence: relationship.confidence,
            context: 'inferred'
          });
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * Infer relationship between two entities based on context
   */
  inferContextualRelationship(entity1, entity2) {
    // Simple heuristic-based relationship inference
    if (entity1.type === 'person' && entity2.type === 'project') {
      return { type: 'works_on', confidence: 0.7 };
    }
    
    if (entity1.type === 'person' && entity2.type === 'location') {
      return { type: 'located_at', confidence: 0.6 };
    }
    
    if (entity1.type === 'project' && entity2.type === 'location') {
      return { type: 'located_at', confidence: 0.8 };
    }
    
    if (entity1.type === 'amount' && entity2.type === 'item') {
      return { type: 'costs', confidence: 0.9 };
    }
    
    return null;
  }

  /**
   * Assemble spatial context
   */
  assembleSpatialContext(entities, conversationContext) {
    const locations = entities.filter(e => e.type === 'location');
    const people = entities.filter(e => e.type === 'person');
    const projects = entities.filter(e => e.type === 'project');

    return {
      currentLocation: conversationContext.currentLocation,
      mentionedLocations: locations.map(l => l.name),
      locationBasedRelationships: this.findLocationBasedRelationships(locations, people, projects),
      spatialInferences: this.generateSpatialInferences(locations, conversationContext)
    };
  }

  /**
   * Assemble temporal context
   */
  assembleTemporalContext(queryResult, conversationContext) {
    const dates = [];
    const timeline = [];
    
    // Extract temporal information from query
    if (queryResult.finalResult?.resolvedContext?.entities?.dates) {
      dates.push(...queryResult.finalResult.resolvedContext.entities.dates);
    }
    
    return {
      queryTimestamp: queryResult.metadata?.startTime,
      sessionDuration: Date.now() - conversationContext.startTime,
      mentionedDates: dates,
      timeline: timeline,
      temporalInferences: []
    };
  }

  /**
   * Assemble financial context
   */
  assembleFinancialContext(queryResult, entities) {
    const amounts = entities.filter(e => e.type === 'amount');
    const items = entities.filter(e => e.type === 'item');
    
    return {
      transactions: amounts.map(amount => ({
        amount: amount.value,
        currency: amount.currency || 'USD',
        item: items.find(item => item.confidence > 0.7)?.name || 'unspecified',
        confidence: amount.confidence
      })),
      totalValue: amounts.reduce((sum, amount) => sum + (amount.value || 0), 0),
      financialInferences: []
    };
  }

  /**
   * Assemble project context
   */
  assembleProjectContext(entities, conversationContext) {
    const projects = entities.filter(e => e.type === 'project');
    const tasks = entities.filter(e => e.type === 'task');
    
    return {
      currentProject: conversationContext.currentProject,
      mentionedProjects: projects.map(p => p.name),
      activeTasks: tasks,
      projectInferences: []
    };
  }

  /**
   * Generate contextual insights
   */
  async generateContextualInsights(intelligence) {
    const insights = [];

    // Spatial insights
    if (intelligence.spatialContext?.currentLocation && 
        intelligence.projectContext?.mentionedProjects?.length > 0) {
      insights.push({
        type: 'spatial',
        description: `User is at ${intelligence.spatialContext.currentLocation} discussing ${intelligence.projectContext.mentionedProjects[0]}`,
        confidence: 0.8
      });
    }

    // Financial insights
    if (intelligence.financialContext?.totalValue > 0) {
      insights.push({
        type: 'financial',
        description: `Financial transaction of $${intelligence.financialContext.totalValue} identified`,
        confidence: 0.9
      });
    }

    // Relationship insights
    if (intelligence.relationshipNetwork?.edges?.length > 0) {
      insights.push({
        type: 'relational',
        description: `${intelligence.relationshipNetwork.edges.length} relationships identified between entities`,
        confidence: 0.7
      });
    }

    return insights;
  }

  /**
   * Determine intelligence level based on assembled context
   */
  determineIntelligenceLevel(intelligence) {
    let score = 0;
    
    if (intelligence.contextEntities.length > 0) score += 1;
    if (intelligence.relationshipNetwork?.edges?.length > 0) score += 2;
    if (intelligence.spatialContext?.currentLocation) score += 1;
    if (intelligence.financialContext?.totalValue > 0) score += 1;
    if (intelligence.projectContext?.currentProject) score += 1;
    if (intelligence.insights.length > 2) score += 1;

    if (score >= 6) return 'advanced';
    if (score >= 4) return 'contextual';
    if (score >= 2) return 'relational';
    return 'basic';
  }

  /**
   * Calculate overall intelligence confidence
   */
  calculateIntelligenceConfidence(intelligence) {
    let totalConfidence = 0;
    let count = 0;

    // Entity confidences
    for (const entity of intelligence.contextEntities) {
      if (entity.confidence) {
        totalConfidence += entity.confidence;
        count++;
      }
    }

    // Insight confidences
    for (const insight of intelligence.insights) {
      totalConfidence += insight.confidence;
      count++;
    }

    return count > 0 ? totalConfidence / count : 0.5;
  }

  /**
   * Generate enhanced response with contextual intelligence
   */
  async generateEnhancedResponse(queryResult, contextualIntelligence, conversationContext) {
    const baseResponse = queryResult.finalResult?.response || 'I processed your request.';
    
    const enhancedResponse = {
      primaryResponse: baseResponse,
      contextualInsights: [],
      recommendations: [],
      confidence: contextualIntelligence.confidence,
      intelligenceLevel: contextualIntelligence.intelligenceLevel
    };

    // Add contextual insights to response
    for (const insight of contextualIntelligence.insights) {
      enhancedResponse.contextualInsights.push(insight.description);
    }

    // Generate recommendations based on context
    if (contextualIntelligence.spatialContext?.currentLocation && 
        contextualIntelligence.projectContext?.mentionedProjects?.length > 0) {
      enhancedResponse.recommendations.push(
        `Since you're at ${contextualIntelligence.spatialContext.currentLocation}, I can help track location-specific activities for ${contextualIntelligence.projectContext.mentionedProjects[0]}.`
      );
    }

    if (contextualIntelligence.financialContext?.totalValue > 0) {
      enhancedResponse.recommendations.push(
        `I can help track this $${contextualIntelligence.financialContext.totalValue} expense in your project budget.`
      );
    }

    return enhancedResponse;
  }

  /**
   * Update conversation context with new information
   */
  async updateConversationContext(sessionId, queryResult, contextualIntelligence, conversationContext) {
    // Add query to history
    conversationContext.queryHistory.push({
      query: queryResult.originalQuery,
      timestamp: new Date().toISOString(),
      intent: queryResult.finalResult?.intent,
      confidence: queryResult.finalResult?.confidence
    });

    // Update entities
    const queryEntities = this.extractEntitiesFromQueryResult(queryResult);
    for (const [key, entity] of queryEntities) {
      conversationContext.entities.set(key, entity);
    }

    // Update contextual memory
    this.updateContextualMemory(conversationContext, contextualIntelligence);

    // Clean up old data (keep last 50 queries)
    if (conversationContext.queryHistory.length > 50) {
      conversationContext.queryHistory = conversationContext.queryHistory.slice(-50);
    }

    conversationContext.lastActivity = Date.now();
  }

  /**
   * Update contextual memory with recent information
   */
  updateContextualMemory(conversationContext, contextualIntelligence) {
    const memory = conversationContext.contextualMemory;

    // Update recent locations
    if (contextualIntelligence.spatialContext?.mentionedLocations) {
      for (const location of contextualIntelligence.spatialContext.mentionedLocations) {
        if (!memory.recentLocations.includes(location)) {
          memory.recentLocations.unshift(location);
          memory.recentLocations = memory.recentLocations.slice(0, 10);
        }
      }
    }

    // Update recent projects
    if (contextualIntelligence.projectContext?.mentionedProjects) {
      for (const project of contextualIntelligence.projectContext.mentionedProjects) {
        if (!memory.recentProjects.includes(project)) {
          memory.recentProjects.unshift(project);
          memory.recentProjects = memory.recentProjects.slice(0, 10);
        }
      }
    }

    // Update recent people
    const people = contextualIntelligence.contextEntities.filter(e => e.type === 'person');
    for (const person of people) {
      if (!memory.recentPeople.some(p => p.name === person.name)) {
        memory.recentPeople.unshift(person);
        memory.recentPeople = memory.recentPeople.slice(0, 10);
      }
    }
  }

  /**
   * Helper methods for spatial context
   */
  findLocationBasedRelationships(locations, people, projects) {
    const relationships = [];
    
    for (const location of locations) {
      for (const person of people) {
        relationships.push({
          type: 'person_at_location',
          person: person.name,
          location: location.name,
          confidence: 0.7
        });
      }
      
      for (const project of projects) {
        relationships.push({
          type: 'project_at_location',
          project: project.name,
          location: location.name,
          confidence: 0.8
        });
      }
    }
    
    return relationships;
  }

  generateSpatialInferences(locations, conversationContext) {
    const inferences = [];
    
    if (conversationContext.currentLocation && locations.length > 0) {
      const mentionedLocation = locations[0].name;
      if (mentionedLocation !== conversationContext.currentLocation) {
        inferences.push({
          type: 'location_discrepancy',
          description: `User mentioned ${mentionedLocation} but current location is ${conversationContext.currentLocation}`,
          confidence: 0.6
        });
      }
    }
    
    return inferences;
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId) {
    const context = this.conversationState.get(sessionId);
    if (!context) return null;

    return {
      sessionId,
      userId: context.userId,
      startTime: context.startTime,
      lastActivity: context.lastActivity,
      duration: Date.now() - context.startTime,
      queryCount: context.queryHistory.length,
      entitiesTracked: context.entities.size,
      currentLocation: context.currentLocation,
      currentProject: context.currentProject,
      recentLocations: context.contextualMemory.recentLocations.length,
      recentProjects: context.contextualMemory.recentProjects.length,
      recentPeople: context.contextualMemory.recentPeople.length
    };
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    const expiredSessions = [];

    for (const [sessionId, context] of this.conversationState) {
      if (now - context.lastActivity > this.sessionTimeout) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      this.conversationState.delete(sessionId);
      console.log(chalk.gray(`🗑️  Cleaned up expired session: ${sessionId}`));
    }

    return expiredSessions.length;
  }
}

export { ContextAssemblyEngine };
