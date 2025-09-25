/**
 * API Client Example
 * 
 * Demonstrates how to interact with the Contextual Intelligence API
 * using both REST endpoints and WebSocket connections.
 */

import WebSocket from 'ws';
import chalk from 'chalk';

class ContextualIntelligenceClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:3000';
    this.wsUrl = options.wsUrl || 'ws://localhost:3000/ws';
    this.userId = options.userId || 'demo_user';
    this.sessionId = options.sessionId || this.userId;
    this.ws = null;
    this.connected = false;
  }

  /**
   * REST API Methods
   */

  /**
   * Send a contextual query via REST API
   */
  async sendQuery(query, options = {}) {
    const {
      currentLocation = null,
      currentProject = null,
      executeActions = false,
      maintainContext = true
    } = options;

    try {
      const response = await fetch(`${this.baseUrl}/api/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query,
          userId: this.userId,
          sessionId: this.sessionId,
          currentLocation,
          currentProject,
          executeActions,
          maintainContext
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();

    } catch (error) {
      console.error(chalk.red(`❌ REST query failed: ${error.message}`));
      throw error;
    }
  }

  /**
   * Send a simple query via REST API
   */
  async sendSimpleQuery(query, options = {}) {
    const {
      currentLocation = null,
      currentProject = null,
      executeActions = false
    } = options;

    try {
      const response = await fetch(`${this.baseUrl}/api/query/simple`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query,
          userId: this.userId,
          currentLocation,
          currentProject,
          executeActions
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();

    } catch (error) {
      console.error(chalk.red(`❌ Simple REST query failed: ${error.message}`));
      throw error;
    }
  }

  /**
   * Get session information
   */
  async getSessionInfo() {
    try {
      const response = await fetch(`${this.baseUrl}/api/sessions/${this.sessionId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();

    } catch (error) {
      console.error(chalk.red(`❌ Get session info failed: ${error.message}`));
      throw error;
    }
  }

  /**
   * Get system statistics
   */
  async getStats() {
    try {
      const response = await fetch(`${this.baseUrl}/api/stats`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();

    } catch (error) {
      console.error(chalk.red(`❌ Get stats failed: ${error.message}`));
      throw error;
    }
  }

  /**
   * WebSocket Methods
   */

  /**
   * Connect to WebSocket
   */
  async connectWebSocket() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.on('open', () => {
          console.log(chalk.green('🔌 WebSocket connected'));
          this.connected = true;
          resolve();
        });

        this.ws.on('message', (data) => {
          this.handleWebSocketMessage(JSON.parse(data.toString()));
        });

        this.ws.on('close', (code, reason) => {
          console.log(chalk.yellow(`🔌 WebSocket disconnected: ${code} ${reason}`));
          this.connected = false;
        });

        this.ws.on('error', (error) => {
          console.error(chalk.red(`❌ WebSocket error: ${error.message}`));
          this.connected = false;
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Authenticate WebSocket connection
   */
  async authenticateWebSocket(options = {}) {
    if (!this.connected) {
      throw new Error('WebSocket not connected');
    }

    const {
      currentLocation = null,
      currentProject = null
    } = options;

    this.sendWebSocketMessage({
      type: 'auth',
      userId: this.userId,
      sessionId: this.sessionId,
      currentLocation,
      currentProject
    });
  }

  /**
   * Send query via WebSocket
   */
  async sendWebSocketQuery(query, executeActions = false) {
    if (!this.connected) {
      throw new Error('WebSocket not connected');
    }

    this.sendWebSocketMessage({
      type: 'query',
      query,
      executeActions
    });
  }

  /**
   * Update context via WebSocket
   */
  async updateContext(currentLocation = null, currentProject = null) {
    if (!this.connected) {
      throw new Error('WebSocket not connected');
    }

    this.sendWebSocketMessage({
      type: 'context_update',
      currentLocation,
      currentProject
    });
  }

  /**
   * Send WebSocket message
   */
  sendWebSocketMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      throw new Error('WebSocket not ready');
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleWebSocketMessage(message) {
    console.log(chalk.blue(`📨 WebSocket message: ${message.type}`));

    switch (message.type) {
      case 'welcome':
        console.log(chalk.green(`✅ ${message.message}`));
        break;

      case 'auth_success':
        console.log(chalk.green(`🔐 Authenticated as ${message.userId} (session: ${message.sessionId})`));
        break;

      case 'query_processing':
        console.log(chalk.cyan(`⏳ Processing query: "${message.query}"`));
        break;

      case 'query_result':
        this.displayQueryResult(message);
        break;

      case 'context_updated':
        console.log(chalk.cyan(`📍 Context updated: location=${message.currentLocation}, project=${message.currentProject}`));
        break;

      case 'session_update':
        console.log(chalk.blue(`📊 Session updated: ${message.intelligence.level} intelligence, ${message.intelligence.entities} entities`));
        break;

      case 'error':
        console.error(chalk.red(`❌ WebSocket error: ${message.error} (${message.code})`));
        break;

      case 'pong':
        console.log(chalk.gray('🏓 Pong received'));
        break;

      default:
        console.log(chalk.gray(`📨 Unknown message type: ${message.type}`));
    }
  }

  /**
   * Display query result
   */
  displayQueryResult(result) {
    console.log(chalk.green.bold(`\n✅ Query Result:`));
    console.log(chalk.cyan(`Query: "${result.query}"`));
    console.log(chalk.cyan(`Intelligence Level: ${result.intelligence.level} (${(result.intelligence.confidence * 100).toFixed(1)}%)`));
    console.log(chalk.cyan(`Entities: ${result.intelligence.entities}`));
    console.log(chalk.cyan(`Processing Time: ${result.metadata.processingTime}ms`));
    
    console.log(chalk.yellow(`\n💬 Response:`));
    console.log(`   ${result.response.primary}`);
    
    if (result.response.contextualInsights.length > 0) {
      console.log(chalk.yellow(`\n🔍 Contextual Insights:`));
      result.response.contextualInsights.forEach(insight => {
        console.log(`   • ${insight}`);
      });
    }
    
    if (result.response.recommendations.length > 0) {
      console.log(chalk.yellow(`\n💡 Recommendations:`));
      result.response.recommendations.forEach(rec => {
        console.log(`   • ${rec}`);
      });
    }
    
    if (result.actions.length > 0) {
      console.log(chalk.yellow(`\n⚡ Actions:`));
      result.actions.forEach((action, index) => {
        console.log(`   ${index + 1}. ${action.type}: ${JSON.stringify(action, null, 2).slice(0, 100)}...`);
      });
    }
    
    console.log('');
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.connected = false;
    }
  }
}

/**
 * Demo function showing API usage
 */
async function runDemo() {
  console.log(chalk.blue.bold('🚀 Contextual Intelligence API Demo'));
  console.log(chalk.blue.bold('==================================='));
  console.log('');

  const client = new ContextualIntelligenceClient({
    baseUrl: 'http://localhost:3000',
    userId: 'demo_user',
    sessionId: 'demo_session'
  });

  try {
    // Demo 1: REST API Query
    console.log(chalk.yellow.bold('📋 Demo 1: REST API Contextual Query'));
    console.log(chalk.gray('─'.repeat(50)));
    
    const restResult = await client.sendQuery("I'm at John's, add a $30 charge for more screws", {
      currentLocation: "John's House - 123 Main St",
      currentProject: "Kitchen Renovation",
      executeActions: false
    });
    
    console.log(chalk.green(`✅ REST Query completed in ${restResult.metadata.processingTime}ms`));
    console.log(chalk.cyan(`Intelligence: ${restResult.intelligence.level} (${(restResult.intelligence.confidence * 100).toFixed(1)}%)`));
    console.log(chalk.cyan(`Response: ${restResult.response.primary}`));
    console.log('');

    // Demo 2: WebSocket Connection
    console.log(chalk.yellow.bold('📋 Demo 2: WebSocket Real-time Conversation'));
    console.log(chalk.gray('─'.repeat(50)));
    
    await client.connectWebSocket();
    await client.authenticateWebSocket({
      currentLocation: "John's House - 123 Main St",
      currentProject: "Kitchen Renovation"
    });
    
    // Wait for authentication
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Send queries via WebSocket
    await client.sendWebSocketQuery("What's the status of the kitchen project?");
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await client.sendWebSocketQuery("Mike needs to inspect the electrical work");
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Update context
    await client.updateContext("Mike's Workshop", "Electrical Inspection");
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await client.sendWebSocketQuery("Add a $50 charge for electrical inspection");
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Demo 3: Session Information
    console.log(chalk.yellow.bold('📋 Demo 3: Session Management'));
    console.log(chalk.gray('─'.repeat(50)));
    
    const sessionInfo = await client.getSessionInfo();
    console.log(chalk.green('✅ Session Information:'));
    console.log(`   Session ID: ${sessionInfo.session.sessionId}`);
    console.log(`   Query Count: ${sessionInfo.session.queryCount}`);
    console.log(`   Entities Tracked: ${sessionInfo.session.entitiesTracked}`);
    console.log(`   Duration: ${Math.round(sessionInfo.session.duration / 1000)}s`);
    console.log('');

    // Demo 4: System Statistics
    console.log(chalk.yellow.bold('📋 Demo 4: System Statistics'));
    console.log(chalk.gray('─'.repeat(50)));
    
    const stats = await client.getStats();
    console.log(chalk.green('✅ System Statistics:'));
    console.log(`   Active Sessions: ${stats.stats.activeSessions}`);
    console.log(`   Memory Usage: ${Math.round(stats.stats.memory.rss / 1024 / 1024)}MB`);
    console.log(`   Uptime: ${Math.round(stats.stats.uptime)}s`);
    console.log('');

    console.log(chalk.green.bold('🎉 Demo completed successfully!'));
    
    // Cleanup
    client.disconnect();

  } catch (error) {
    console.error(chalk.red(`❌ Demo failed: ${error.message}`));
    client.disconnect();
  }
}

// Export for use as module
export { ContextualIntelligenceClient, runDemo };

// Run demo if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo().catch(console.error);
}
