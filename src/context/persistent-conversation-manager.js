/**
 * Persistent Conversation Manager
 * 
 * Manages persistent conversation state and pending requests across CLI sessions.
 * Stores incomplete queries and tracks outstanding questions for completion.
 */

import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

class PersistentConversationManager {
  constructor(options = {}) {
    this.dataPath = options.dataPath || path.join(process.cwd(), 'data');
    this.conversationsFile = path.join(this.dataPath, 'persistent-conversations.json');
    this.pendingRequestsFile = path.join(this.dataPath, 'pending-requests.json');
    
    // In-memory cache
    this.conversations = new Map();
    this.pendingRequests = new Map();
    
    this.initialized = false;
  }

  /**
   * Initialize the persistent storage
   */
  async initialize() {
    try {
      // Ensure data directory exists
      await fs.mkdir(this.dataPath, { recursive: true });
      
      // Load existing conversations
      await this.loadConversations();
      await this.loadPendingRequests();
      
      this.initialized = true;
      console.log(chalk.green('✅ Persistent conversation manager initialized'));
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize persistent conversation manager:'), error.message);
      throw error;
    }
  }

  /**
   * Load conversations from disk
   */
  async loadConversations() {
    try {
      const data = await fs.readFile(this.conversationsFile, 'utf8');
      const conversations = JSON.parse(data);
      
      for (const [sessionId, conversation] of Object.entries(conversations)) {
        this.conversations.set(sessionId, conversation);
      }
      
      console.log(chalk.gray(`📂 Loaded ${this.conversations.size} persistent conversations`));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(chalk.yellow('⚠️  Failed to load conversations:'), error.message);
      }
      // File doesn't exist yet, start fresh
    }
  }

  /**
   * Load pending requests from disk
   */
  async loadPendingRequests() {
    try {
      const data = await fs.readFile(this.pendingRequestsFile, 'utf8');
      const requests = JSON.parse(data);
      
      for (const [requestId, request] of Object.entries(requests)) {
        this.pendingRequests.set(requestId, request);
      }
      
      console.log(chalk.gray(`📋 Loaded ${this.pendingRequests.size} pending requests`));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(chalk.yellow('⚠️  Failed to load pending requests:'), error.message);
      }
      // File doesn't exist yet, start fresh
    }
  }

  /**
   * Save conversations to disk
   */
  async saveConversations() {
    try {
      const conversationsObj = Object.fromEntries(this.conversations);
      await fs.writeFile(this.conversationsFile, JSON.stringify(conversationsObj, null, 2));
    } catch (error) {
      console.error(chalk.red('❌ Failed to save conversations:'), error.message);
    }
  }

  /**
   * Save pending requests to disk
   */
  async savePendingRequests() {
    try {
      const requestsObj = Object.fromEntries(this.pendingRequests);
      await fs.writeFile(this.pendingRequestsFile, JSON.stringify(requestsObj, null, 2));
    } catch (error) {
      console.error(chalk.red('❌ Failed to save pending requests:'), error.message);
    }
  }

  /**
   * Get or create persistent conversation
   */
  async getConversation(userId, sessionId = null) {
    if (!this.initialized) {
      await this.initialize();
    }

    const conversationId = sessionId || `${userId}-default`;
    
    if (this.conversations.has(conversationId)) {
      const conversation = this.conversations.get(conversationId);
      conversation.lastAccessed = new Date().toISOString();
      return conversation;
    }

    // Create new conversation
    const newConversation = {
      id: conversationId,
      userId,
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      queryHistory: [],
      entities: {},
      contextualMemory: {
        recentProjects: [],
        recentLocations: [],
        recentPeople: [],
        recentActions: []
      },
      pendingRequestIds: []
    };

    this.conversations.set(conversationId, newConversation);
    await this.saveConversations();
    
    console.log(chalk.gray(`📝 Created new persistent conversation: ${conversationId}`));
    return newConversation;
  }

  /**
   * Update conversation with new query and context
   */
  async updateConversation(conversationId, queryResult, contextualIntelligence) {
    if (!this.conversations.has(conversationId)) {
      console.warn(chalk.yellow(`⚠️  Conversation ${conversationId} not found`));
      return;
    }

    const conversation = this.conversations.get(conversationId);
    
    // Add query to history
    conversation.queryHistory.push({
      query: queryResult.originalQuery,
      timestamp: new Date().toISOString(),
      intent: queryResult.finalResult?.intent,
      confidence: queryResult.finalResult?.confidence,
      entities: queryResult.finalResult?.resolvedContext?.entities || {},
      completed: queryResult.finalResult?.actions?.length > 0
    });

    // Update entities
    if (queryResult.finalResult?.resolvedContext?.entities) {
      for (const [entityType, entities] of Object.entries(queryResult.finalResult.resolvedContext.entities)) {
        if (!conversation.entities[entityType]) {
          conversation.entities[entityType] = [];
        }
        
        for (const entity of entities) {
          // Avoid duplicates
          const exists = conversation.entities[entityType].some(e => 
            e.name === entity.name || e.id === entity.id
          );
          
          if (!exists) {
            conversation.entities[entityType].push({
              ...entity,
              firstMentioned: new Date().toISOString(),
              lastMentioned: new Date().toISOString()
            });
          } else {
            // Update last mentioned
            const existing = conversation.entities[entityType].find(e => 
              e.name === entity.name || e.id === entity.id
            );
            if (existing) {
              existing.lastMentioned = new Date().toISOString();
            }
          }
        }
      }
    }

    // Update contextual memory
    this.updateContextualMemory(conversation, contextualIntelligence);

    conversation.lastAccessed = new Date().toISOString();
    await this.saveConversations();
  }

  /**
   * Create a pending request for incomplete queries
   */
  async createPendingRequest(conversationId, queryResult, missingInfo) {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const pendingRequest = {
      id: requestId,
      conversationId,
      originalQuery: queryResult.originalQuery,
      intent: queryResult.finalResult?.intent,
      extractedEntities: queryResult.finalResult?.resolvedContext?.entities || {},
      missingInfo,
      status: 'pending',
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      attempts: 1,
      questionAsked: missingInfo.question || 'Additional information needed',
      projectContext: this.extractProjectContext(queryResult)
    };

    this.pendingRequests.set(requestId, pendingRequest);
    
    // Add to conversation's pending requests
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.pendingRequestIds.push(requestId);
      await this.saveConversations();
    }
    
    await this.savePendingRequests();
    
    console.log(chalk.blue(`📋 Created pending request: ${requestId}`));
    return pendingRequest;
  }

  /**
   * Check for pending requests related to a new query
   */
  async checkPendingRequests(conversationId, newQuery, queryResult) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation || conversation.pendingRequestIds.length === 0) {
      return null;
    }

    // Look for pending requests that might be completed by this query
    for (const requestId of conversation.pendingRequestIds) {
      const pendingRequest = this.pendingRequests.get(requestId);
      if (!pendingRequest || pendingRequest.status !== 'pending') {
        continue;
      }

      // Check if this query provides the missing information
      const completion = await this.checkRequestCompletion(pendingRequest, newQuery, queryResult);
      if (completion.isComplete) {
        await this.completePendingRequest(requestId, completion);
        return {
          completedRequest: pendingRequest,
          completion: completion
        };
      }
    }

    return null;
  }

  /**
   * Check if a new query completes a pending request
   */
  async checkRequestCompletion(pendingRequest, newQuery, queryResult) {
    const completion = {
      isComplete: false,
      providedInfo: {},
      combinedData: {},
      readyForSnappy: false
    };

    // Check for amount completion
    if (pendingRequest.missingInfo.type === 'amount') {
      const amounts = queryResult.finalResult?.resolvedContext?.entities?.amounts || [];
      if (amounts.length > 0) {
        completion.isComplete = true;
        completion.providedInfo.amount = amounts[0];
        
        // Combine with original request data
        completion.combinedData = {
          ...pendingRequest.extractedEntities,
          amounts: [amounts[0]]
        };
        
        completion.readyForSnappy = this.isReadyForSnappy(completion.combinedData);
      }
    }

    // Check for project context completion
    if (pendingRequest.missingInfo.type === 'project_context') {
      const projects = queryResult.finalResult?.resolvedContext?.entities?.projects || [];
      if (projects.length > 0) {
        completion.isComplete = true;
        completion.providedInfo.project = projects[0];
        completion.combinedData = {
          ...pendingRequest.extractedEntities,
          projects: [projects[0]]
        };
        completion.readyForSnappy = this.isReadyForSnappy(completion.combinedData);
      }
    }

    return completion;
  }

  /**
   * Complete a pending request
   */
  async completePendingRequest(requestId, completion) {
    const pendingRequest = this.pendingRequests.get(requestId);
    if (!pendingRequest) return;

    pendingRequest.status = 'completed';
    pendingRequest.completedAt = new Date().toISOString();
    pendingRequest.completion = completion;
    pendingRequest.lastUpdated = new Date().toISOString();

    // Remove from conversation's pending list
    const conversation = this.conversations.get(pendingRequest.conversationId);
    if (conversation) {
      conversation.pendingRequestIds = conversation.pendingRequestIds.filter(id => id !== requestId);
      await this.saveConversations();
    }

    await this.savePendingRequests();
    
    console.log(chalk.green(`✅ Completed pending request: ${requestId}`));
  }

  /**
   * Get pending requests for a project
   */
  async getPendingRequestsForProject(projectName) {
    const projectRequests = [];
    
    for (const [requestId, request] of this.pendingRequests) {
      if (request.status === 'pending' && 
          request.projectContext?.projectName?.toLowerCase().includes(projectName.toLowerCase())) {
        projectRequests.push(request);
      }
    }
    
    return projectRequests;
  }

  /**
   * Extract project context from query result
   */
  extractProjectContext(queryResult) {
    const entities = queryResult.finalResult?.resolvedContext?.entities || {};
    
    // Look for project indicators
    const projects = entities.projects || [];
    const locations = entities.locations || [];
    const people = entities.people || [];
    
    // Infer project from context
    let projectName = null;
    if (projects.length > 0) {
      projectName = projects[0].name;
    } else if (locations.length > 0) {
      // Infer project from location (e.g., "John's deck" -> "John's deck project")
      projectName = locations[0].name;
    } else if (people.length > 0) {
      // Infer project from person (e.g., "John" -> "John's project")
      projectName = `${people[0].name}'s project`;
    }

    return {
      projectName,
      inferredFromLocation: locations.length > 0,
      inferredFromPerson: people.length > 0,
      explicitProject: projects.length > 0
    };
  }

  /**
   * Check if data is ready for Snappy integration
   */
  isReadyForSnappy(combinedData) {
    // Need at least: amount, item, and project context
    const hasAmount = combinedData.amounts && combinedData.amounts.length > 0;
    const hasItem = combinedData.items && combinedData.items.length > 0;
    const hasProject = combinedData.projects && combinedData.projects.length > 0;
    
    return hasAmount && hasItem && (hasProject || combinedData.locations);
  }

  /**
   * Update contextual memory
   */
  updateContextualMemory(conversation, contextualIntelligence) {
    if (!contextualIntelligence) return;

    const memory = conversation.contextualMemory;

    // Update recent projects
    if (contextualIntelligence.projectContext?.mentionedProjects) {
      for (const project of contextualIntelligence.projectContext.mentionedProjects) {
        if (!memory.recentProjects.includes(project)) {
          memory.recentProjects.unshift(project);
          memory.recentProjects = memory.recentProjects.slice(0, 10);
        }
      }
    }

    // Update recent locations
    if (contextualIntelligence.spatialContext?.mentionedLocations) {
      for (const location of contextualIntelligence.spatialContext.mentionedLocations) {
        if (!memory.recentLocations.includes(location)) {
          memory.recentLocations.unshift(location);
          memory.recentLocations = memory.recentLocations.slice(0, 10);
        }
      }
    }

    // Update recent people
    const people = contextualIntelligence.contextEntities?.filter(e => e.type === 'person') || [];
    for (const person of people) {
      if (!memory.recentPeople.some(p => p.name === person.name)) {
        memory.recentPeople.unshift(person);
        memory.recentPeople = memory.recentPeople.slice(0, 10);
      }
    }
  }

  /**
   * Get conversation summary
   */
  getConversationSummary(conversationId) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return null;

    return {
      id: conversation.id,
      userId: conversation.userId,
      createdAt: conversation.createdAt,
      lastAccessed: conversation.lastAccessed,
      queryCount: conversation.queryHistory.length,
      pendingRequests: conversation.pendingRequestIds.length,
      recentProjects: conversation.contextualMemory.recentProjects,
      recentLocations: conversation.contextualMemory.recentLocations,
      entityTypes: Object.keys(conversation.entities)
    };
  }

  /**
   * List all pending requests
   */
  async listPendingRequests(options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const { 
      status = 'pending',
      projectName = null,
      userId = null,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    let requests = Array.from(this.pendingRequests.values());

    // Filter by status
    if (status) {
      requests = requests.filter(req => req.status === status);
    }

    // Filter by project name
    if (projectName) {
      requests = requests.filter(req => 
        req.projectContext?.projectName?.toLowerCase().includes(projectName.toLowerCase())
      );
    }

    // Filter by user ID
    if (userId) {
      const conversation = this.conversations.get(userId) || 
                          Array.from(this.conversations.values()).find(c => c.userId === userId);
      if (conversation) {
        requests = requests.filter(req => req.conversationId === conversation.id);
      } else {
        requests = [];
      }
    }

    // Sort requests
    requests.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      
      if (sortOrder === 'desc') {
        return new Date(bVal) - new Date(aVal);
      } else {
        return new Date(aVal) - new Date(bVal);
      }
    });

    return requests;
  }

  /**
   * Get pending request by ID
   */
  async getPendingRequest(requestId) {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.pendingRequests.get(requestId) || null;
  }

  /**
   * Get pending requests summary
   */
  async getPendingRequestsSummary() {
    if (!this.initialized) {
      await this.initialize();
    }

    const allRequests = Array.from(this.pendingRequests.values());
    const pendingRequests = allRequests.filter(req => req.status === 'pending');
    const completedRequests = allRequests.filter(req => req.status === 'completed');

    // Group by project
    const byProject = {};
    for (const request of pendingRequests) {
      const projectName = request.projectContext?.projectName || 'Unknown Project';
      if (!byProject[projectName]) {
        byProject[projectName] = [];
      }
      byProject[projectName].push(request);
    }

    // Group by age
    const now = Date.now();
    const ageGroups = {
      recent: [], // < 1 hour
      today: [],  // < 24 hours
      week: [],   // < 7 days
      old: []     // > 7 days
    };

    for (const request of pendingRequests) {
      const age = now - new Date(request.createdAt).getTime();
      const hours = age / (1000 * 60 * 60);
      
      if (hours < 1) {
        ageGroups.recent.push(request);
      } else if (hours < 24) {
        ageGroups.today.push(request);
      } else if (hours < 24 * 7) {
        ageGroups.week.push(request);
      } else {
        ageGroups.old.push(request);
      }
    }

    return {
      total: allRequests.length,
      pending: pendingRequests.length,
      completed: completedRequests.length,
      byProject,
      byAge: ageGroups,
      oldestPending: pendingRequests.length > 0 ? 
        pendingRequests.reduce((oldest, req) => 
          new Date(req.createdAt) < new Date(oldest.createdAt) ? req : oldest
        ) : null
    };
  }

  /**
   * Clean up old conversations and completed requests
   */
  async cleanup(maxAge = 30 * 24 * 60 * 60 * 1000) { // 30 days
    const cutoff = new Date(Date.now() - maxAge);
    let cleaned = 0;

    // Clean old conversations
    for (const [id, conversation] of this.conversations) {
      if (new Date(conversation.lastAccessed) < cutoff) {
        this.conversations.delete(id);
        cleaned++;
      }
    }

    // Clean completed requests older than cutoff
    for (const [id, request] of this.pendingRequests) {
      if (request.status === 'completed' && new Date(request.completedAt) < cutoff) {
        this.pendingRequests.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      await this.saveConversations();
      await this.savePendingRequests();
      console.log(chalk.gray(`🗑️  Cleaned up ${cleaned} old records`));
    }

    return cleaned;
  }
}

export { PersistentConversationManager };
