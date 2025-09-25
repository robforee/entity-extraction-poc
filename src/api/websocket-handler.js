/**
 * WebSocket Handler
 * 
 * Real-time WebSocket support for conversational contextual intelligence.
 * Enables live chat-like interactions with context preservation.
 */

import { WebSocketServer } from 'ws';
import { ContextAssemblyEngine } from '../context/context-assembly-engine.js';
import chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';

class WebSocketHandler {
  constructor(server, options = {}) {
    this.server = server;
    this.domain = options.domain || 'construction';
    this.dataPath = options.dataPath;
    
    // Initialize context engine
    this.contextEngine = new ContextAssemblyEngine({
      dataPath: this.dataPath,
      domain: this.domain,
      provider: options.provider || 'openai',
      model: options.model || 'gpt-4o-mini'
    });

    // WebSocket server
    this.wss = new WebSocketServer({ 
      server: this.server,
      path: '/ws'
    });

    // Connection management
    this.connections = new Map();
    this.setupWebSocketServer();
  }

  /**
   * Setup WebSocket server with event handlers
   */
  setupWebSocketServer() {
    this.wss.on('connection', (ws, request) => {
      const connectionId = uuidv4();
      const clientIP = request.socket.remoteAddress;
      
      console.log(chalk.blue(`🔌 WebSocket connected: ${connectionId} (${clientIP})`));

      // Initialize connection state
      const connection = {
        id: connectionId,
        ws,
        userId: null,
        sessionId: null,
        currentLocation: null,
        currentProject: null,
        connectedAt: new Date(),
        lastActivity: new Date(),
        messageCount: 0
      };

      this.connections.set(connectionId, connection);

      // Setup message handlers
      ws.on('message', async (data) => {
        await this.handleMessage(connectionId, data);
      });

      ws.on('close', (code, reason) => {
        console.log(chalk.yellow(`🔌 WebSocket disconnected: ${connectionId} (${code}: ${reason})`));
        this.connections.delete(connectionId);
      });

      ws.on('error', (error) => {
        console.error(chalk.red(`❌ WebSocket error for ${connectionId}: ${error.message}`));
        this.connections.delete(connectionId);
      });

      // Send welcome message
      this.sendMessage(connectionId, {
        type: 'welcome',
        connectionId,
        message: 'Connected to Contextual Intelligence WebSocket',
        domain: this.domain,
        timestamp: new Date().toISOString()
      });
    });

    console.log(chalk.green('✅ WebSocket server initialized on /ws'));
  }

  /**
   * Handle incoming WebSocket messages
   */
  async handleMessage(connectionId, data) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      const message = JSON.parse(data.toString());
      connection.lastActivity = new Date();
      connection.messageCount++;

      console.log(chalk.gray(`📨 WebSocket message from ${connectionId}: ${message.type}`));

      switch (message.type) {
        case 'auth':
          await this.handleAuth(connectionId, message);
          break;
        
        case 'query':
          await this.handleQuery(connectionId, message);
          break;
        
        case 'context_update':
          await this.handleContextUpdate(connectionId, message);
          break;
        
        case 'session_info':
          await this.handleSessionInfo(connectionId, message);
          break;
        
        case 'ping':
          this.sendMessage(connectionId, { type: 'pong', timestamp: new Date().toISOString() });
          break;
        
        default:
          this.sendError(connectionId, `Unknown message type: ${message.type}`, 'UNKNOWN_MESSAGE_TYPE');
      }

    } catch (error) {
      console.error(chalk.red(`❌ Error handling WebSocket message: ${error.message}`));
      this.sendError(connectionId, 'Invalid message format', 'INVALID_MESSAGE');
    }
  }

  /**
   * Handle authentication
   */
  async handleAuth(connectionId, message) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { userId, sessionId, currentLocation, currentProject } = message;

    if (!userId) {
      return this.sendError(connectionId, 'userId is required for authentication', 'AUTH_REQUIRED');
    }

    // Update connection state
    connection.userId = userId;
    connection.sessionId = sessionId || userId;
    connection.currentLocation = currentLocation;
    connection.currentProject = currentProject;

    console.log(chalk.green(`🔐 Authenticated WebSocket: ${connectionId} (user: ${userId}, session: ${connection.sessionId})`));

    this.sendMessage(connectionId, {
      type: 'auth_success',
      userId: connection.userId,
      sessionId: connection.sessionId,
      currentLocation: connection.currentLocation,
      currentProject: connection.currentProject,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle contextual queries
   */
  async handleQuery(connectionId, message) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    if (!connection.userId) {
      return this.sendError(connectionId, 'Authentication required before sending queries', 'AUTH_REQUIRED');
    }

    const { query, executeActions = false } = message;

    if (!query || typeof query !== 'string') {
      return this.sendError(connectionId, 'Query is required and must be a string', 'INVALID_QUERY');
    }

    try {
      // Send processing status
      this.sendMessage(connectionId, {
        type: 'query_processing',
        query,
        status: 'processing',
        timestamp: new Date().toISOString()
      });

      console.log(chalk.blue(`🔍 Processing WebSocket query: "${query}" (${connectionId})`));

      // Process query with context engine
      const result = await this.contextEngine.processContextualQuery(query, {
        userId: connection.userId,
        sessionId: connection.sessionId,
        currentLocation: connection.currentLocation,
        currentProject: connection.currentProject,
        executeActions,
        maintainContext: true
      });

      // Send comprehensive response
      const response = {
        type: 'query_result',
        query: result.query,
        sessionId: result.sessionId,
        intelligence: {
          level: result.contextualIntelligence?.intelligenceLevel || 'basic',
          confidence: result.contextualIntelligence?.confidence || 0.5,
          entities: result.contextualIntelligence?.contextEntities?.length || 0,
          insights: result.contextualIntelligence?.insights || []
        },
        response: {
          primary: result.finalResponse?.primaryResponse || 'Query processed successfully',
          contextualInsights: result.finalResponse?.contextualInsights || [],
          recommendations: result.finalResponse?.recommendations || []
        },
        actions: this.extractActions(result),
        metadata: {
          processingTime: result.metadata?.totalDuration || 0,
          executed: result.metadata?.executeActions || false,
          steps: result.steps?.length || 0
        },
        timestamp: new Date().toISOString()
      };

      this.sendMessage(connectionId, response);

      // Send session update if significant context changes
      if (result.contextualIntelligence?.intelligenceLevel !== 'basic') {
        this.sendSessionUpdate(connectionId, result);
      }

    } catch (error) {
      console.error(chalk.red(`❌ WebSocket query processing failed: ${error.message}`));
      this.sendError(connectionId, 'Query processing failed', 'PROCESSING_ERROR', { originalQuery: query });
    }
  }

  /**
   * Handle context updates
   */
  async handleContextUpdate(connectionId, message) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { currentLocation, currentProject } = message;

    // Update connection context
    if (currentLocation !== undefined) connection.currentLocation = currentLocation;
    if (currentProject !== undefined) connection.currentProject = currentProject;

    console.log(chalk.cyan(`📍 Context updated for ${connectionId}: location=${connection.currentLocation}, project=${connection.currentProject}`));

    this.sendMessage(connectionId, {
      type: 'context_updated',
      currentLocation: connection.currentLocation,
      currentProject: connection.currentProject,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle session info requests
   */
  async handleSessionInfo(connectionId, message) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    if (!connection.sessionId) {
      return this.sendError(connectionId, 'No active session', 'NO_SESSION');
    }

    try {
      const sessionStats = this.contextEngine.getSessionStats(connection.sessionId);
      
      this.sendMessage(connectionId, {
        type: 'session_info',
        session: sessionStats,
        connection: {
          id: connectionId,
          connectedAt: connection.connectedAt,
          messageCount: connection.messageCount,
          lastActivity: connection.lastActivity
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.sendError(connectionId, 'Failed to get session information', 'SESSION_ERROR');
    }
  }

  /**
   * Send session update notifications
   */
  sendSessionUpdate(connectionId, result) {
    const update = {
      type: 'session_update',
      sessionId: result.sessionId,
      intelligence: {
        level: result.contextualIntelligence?.intelligenceLevel,
        entities: result.contextualIntelligence?.contextEntities?.length || 0,
        insights: result.contextualIntelligence?.insights?.length || 0
      },
      timestamp: new Date().toISOString()
    };

    this.sendMessage(connectionId, update);
  }

  /**
   * Send message to a specific connection
   */
  sendMessage(connectionId, message) {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.ws.readyState !== connection.ws.OPEN) {
      return false;
    }

    try {
      connection.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(chalk.red(`❌ Failed to send WebSocket message: ${error.message}`));
      return false;
    }
  }

  /**
   * Send error message
   */
  sendError(connectionId, message, code, details = {}) {
    this.sendMessage(connectionId, {
      type: 'error',
      error: message,
      code,
      details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast message to all connections
   */
  broadcast(message, filter = null) {
    let sent = 0;
    
    for (const [connectionId, connection] of this.connections) {
      if (filter && !filter(connection)) continue;
      
      if (this.sendMessage(connectionId, message)) {
        sent++;
      }
    }
    
    return sent;
  }

  /**
   * Extract actions from processing result
   */
  extractActions(result) {
    const actions = [];
    
    for (const step of result.steps || []) {
      if (step.step === 'query_processing' && step.result?.finalResult?.actions) {
        actions.push(...step.result.finalResult.actions);
      }
    }
    
    return actions;
  }

  /**
   * Get connection statistics
   */
  getStats() {
    const now = new Date();
    const connections = Array.from(this.connections.values());
    
    return {
      totalConnections: connections.length,
      authenticatedConnections: connections.filter(c => c.userId).length,
      totalMessages: connections.reduce((sum, c) => sum + c.messageCount, 0),
      averageSessionDuration: connections.length > 0 
        ? connections.reduce((sum, c) => sum + (now - c.connectedAt), 0) / connections.length / 1000
        : 0,
      activeUsers: new Set(connections.filter(c => c.userId).map(c => c.userId)).size
    };
  }

  /**
   * Cleanup inactive connections
   */
  cleanupInactiveConnections(maxInactiveTime = 30 * 60 * 1000) { // 30 minutes
    const now = new Date();
    const toRemove = [];
    
    for (const [connectionId, connection] of this.connections) {
      if (now - connection.lastActivity > maxInactiveTime) {
        toRemove.push(connectionId);
      }
    }
    
    for (const connectionId of toRemove) {
      const connection = this.connections.get(connectionId);
      if (connection) {
        console.log(chalk.yellow(`🧹 Cleaning up inactive WebSocket: ${connectionId}`));
        connection.ws.close(1000, 'Inactive connection cleanup');
        this.connections.delete(connectionId);
      }
    }
    
    return toRemove.length;
  }
}

export { WebSocketHandler };
