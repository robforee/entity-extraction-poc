#!/usr/bin/env node

/**
 * Production API Server
 * 
 * Combined REST API and WebSocket server for the contextual intelligence system.
 * Production-ready with authentication, rate limiting, and monitoring.
 */

import { ContextAPIServer } from './context-api-server.js';
import { WebSocketHandler } from './websocket-handler.js';
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ProductionServer {
  constructor(options = {}) {
    this.options = {
      port: options.port || process.env.PORT || 3000,
      host: options.host || process.env.HOST || 'localhost',
      domain: options.domain || process.env.DOMAIN || 'construction',
      dataPath: options.dataPath || path.join(__dirname, '..', '..', 'data'),
      provider: options.provider || process.env.LLM_PROVIDER || 'openai',
      model: options.model || process.env.LLM_MODEL || 'gpt-4o-mini',
      ...options
    };

    this.apiServer = null;
    this.wsHandler = null;
    this.httpServer = null;
  }

  /**
   * Start the production server
   */
  async start() {
    try {
      console.log(chalk.blue.bold('🚀 Starting Production Contextual Intelligence Server'));
      console.log(chalk.blue.bold('==================================================='));
      console.log('');
      
      // Display configuration
      console.log(chalk.cyan('📋 Server Configuration:'));
      console.log(`   Host: ${this.options.host}`);
      console.log(`   Port: ${this.options.port}`);
      console.log(`   Domain: ${this.options.domain}`);
      console.log(`   LLM Provider: ${this.options.provider}`);
      console.log(`   LLM Model: ${this.options.model}`);
      console.log(`   Data Path: ${this.options.dataPath}`);
      console.log('');

      // Initialize API server
      console.log(chalk.cyan('🔧 Initializing REST API server...'));
      this.apiServer = new ContextAPIServer(this.options);
      
      // Start HTTP server
      this.httpServer = await this.apiServer.start();
      
      // Initialize WebSocket handler
      console.log(chalk.cyan('🔌 Initializing WebSocket handler...'));
      this.wsHandler = new WebSocketHandler(this.httpServer, this.options);
      
      // Setup monitoring and cleanup
      this.setupMonitoring();
      this.setupGracefulShutdown();
      
      console.log(chalk.green.bold('✅ Production Server Started Successfully!'));
      console.log('');
      console.log(chalk.blue('🌐 Available Services:'));
      console.log(`   REST API: http://${this.options.host}:${this.options.port}/api`);
      console.log(`   WebSocket: ws://${this.options.host}:${this.options.port}/ws`);
      console.log(`   Health Check: http://${this.options.host}:${this.options.port}/health`);
      console.log('');
      console.log(chalk.blue('📖 API Documentation:'));
      console.log('   POST /api/query - Contextual query processing');
      console.log('   POST /api/query/simple - Simple query processing');
      console.log('   GET /api/sessions/:id - Session management');
      console.log('   GET /api/entities - Entity listing');
      console.log('   GET /api/relationships - Relationship data');
      console.log('   GET /api/stats - System statistics');
      console.log('');
      console.log(chalk.blue('🔌 WebSocket Events:'));
      console.log('   auth - Authenticate user session');
      console.log('   query - Process contextual queries');
      console.log('   context_update - Update location/project context');
      console.log('   session_info - Get session information');
      console.log('');

      return {
        httpServer: this.httpServer,
        apiServer: this.apiServer,
        wsHandler: this.wsHandler
      };

    } catch (error) {
      console.error(chalk.red(`❌ Failed to start production server: ${error.message}`));
      throw error;
    }
  }

  /**
   * Setup monitoring and periodic tasks
   */
  setupMonitoring() {
    // Periodic cleanup of inactive connections and sessions
    setInterval(() => {
      if (this.wsHandler) {
        const cleanedConnections = this.wsHandler.cleanupInactiveConnections();
        if (cleanedConnections > 0) {
          console.log(chalk.yellow(`🧹 Cleaned up ${cleanedConnections} inactive WebSocket connections`));
        }
      }

      if (this.apiServer?.contextEngine) {
        const cleanedSessions = this.apiServer.contextEngine.cleanupExpiredSessions();
        if (cleanedSessions > 0) {
          console.log(chalk.yellow(`🧹 Cleaned up ${cleanedSessions} expired sessions`));
        }
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    // Periodic stats logging
    setInterval(() => {
      this.logStats();
    }, 15 * 60 * 1000); // Every 15 minutes
  }

  /**
   * Log system statistics
   */
  logStats() {
    try {
      const wsStats = this.wsHandler?.getStats() || {};
      const activeSessions = this.apiServer?.contextEngine?.conversationState?.size || 0;
      const memoryUsage = process.memoryUsage();
      
      console.log(chalk.blue('📊 System Statistics:'));
      console.log(`   Active WebSocket Connections: ${wsStats.totalConnections || 0}`);
      console.log(`   Authenticated Connections: ${wsStats.authenticatedConnections || 0}`);
      console.log(`   Active Sessions: ${activeSessions}`);
      console.log(`   Total Messages: ${wsStats.totalMessages || 0}`);
      console.log(`   Memory Usage: ${Math.round(memoryUsage.rss / 1024 / 1024)}MB`);
      console.log(`   Uptime: ${Math.round(process.uptime())}s`);
      console.log('');
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Failed to log stats: ${error.message}`));
    }
  }

  /**
   * Setup graceful shutdown
   */
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      console.log(chalk.yellow(`\n🛑 Received ${signal}, shutting down gracefully...`));
      
      try {
        // Close WebSocket connections
        if (this.wsHandler) {
          console.log(chalk.cyan('🔌 Closing WebSocket connections...'));
          this.wsHandler.broadcast({
            type: 'server_shutdown',
            message: 'Server is shutting down',
            timestamp: new Date().toISOString()
          });
          
          // Give clients time to receive the message
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Close HTTP server
        if (this.httpServer) {
          console.log(chalk.cyan('🌐 Closing HTTP server...'));
          await new Promise((resolve) => {
            this.httpServer.close(resolve);
          });
        }

        console.log(chalk.green('✅ Server shutdown complete'));
        process.exit(0);

      } catch (error) {
        console.error(chalk.red(`❌ Error during shutdown: ${error.message}`));
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error(chalk.red('💥 Uncaught Exception:'), error);
      shutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error(chalk.red('💥 Unhandled Rejection at:'), promise, 'reason:', reason);
      shutdown('UNHANDLED_REJECTION');
    });
  }

  /**
   * Stop the server
   */
  async stop() {
    if (this.httpServer) {
      await new Promise((resolve) => {
        this.httpServer.close(resolve);
      });
    }
  }
}

// CLI interface
async function main() {
  const server = new ProductionServer({
    port: process.argv[2] ? parseInt(process.argv[2]) : undefined,
    domain: process.argv[3] || undefined
  });

  try {
    await server.start();
  } catch (error) {
    console.error(chalk.red('Failed to start server:'), error);
    process.exit(1);
  }
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { ProductionServer };
