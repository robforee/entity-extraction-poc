/**
 * Context API Server
 * 
 * REST API server for the contextual intelligence system.
 * Provides endpoints for natural language query processing with full context resolution.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ContextAssemblyEngine } from '../context/context-assembly-engine.js';
import { QueryProcessor } from '../context/query-processor.js';
import { RelationshipGraph } from '../relationships/entity-schema.js';
import { DataSourceRouter } from '../routing/data-source-router.js';
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ContextAPIServer {
  constructor(options = {}) {
    this.port = options.port || process.env.PORT || 3000;
    this.host = options.host || process.env.HOST || 'localhost';
    this.domain = options.domain || 'construction';
    this.dataPath = options.dataPath || path.join(__dirname, '..', '..', 'data');
    
    // Initialize core components with Smart Router as primary
    this.smartRouter = new DataSourceRouter({
      dataPath: this.dataPath,
      snappyPath: options.snappyPath || path.resolve(this.dataPath, '..', '..', 'snappy')
    });
    
    // Keep legacy components for fallback
    this.contextEngine = new ContextAssemblyEngine({
      dataPath: this.dataPath,
      domain: this.domain,
      provider: options.provider || 'openai',
      model: options.model || 'gpt-4o-mini'
    });
    
    this.queryProcessor = new QueryProcessor({
      dataPath: this.dataPath,
      domain: this.domain,
      provider: options.provider || 'openai',
      model: options.model || 'gpt-4o-mini'
    });

    // Initialize Express app
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup middleware
   */
  setupMiddleware() {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:8080'],
      credentials: true
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
      }
    });
    this.app.use('/api/', limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      console.log(chalk.gray(`${new Date().toISOString()} ${req.method} ${req.path}`));
      next();
    });
  }

  /**
   * Setup API routes
   */
  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        domain: this.domain
      });
    });

    // API info
    this.app.get('/api', (req, res) => {
      res.json({
        name: 'Contextual Intelligence API',
        version: '1.0.0',
        description: 'Natural language query processing with contextual intelligence',
        domain: this.domain,
        endpoints: {
          'POST /api/query': 'Process natural language queries with full context',
          'POST /api/query/simple': 'Simple query processing without conversation state',
          'GET /api/sessions/:sessionId': 'Get session information',
          'DELETE /api/sessions/:sessionId': 'Clear session state',
          'GET /api/entities': 'List entities in the domain',
          'GET /api/relationships': 'Get relationship data for visualization',
          'GET /api/stats': 'Get system statistics'
        }
      });
    });

    // Main contextual query endpoint
    this.app.post('/api/query', async (req, res) => {
      try {
        const {
          query,
          userId = 'anonymous',
          sessionId = userId,
          currentLocation = null,
          currentProject = null,
          executeActions = false,
          maintainContext = true
        } = req.body;

        if (!query || typeof query !== 'string') {
          return res.status(400).json({
            error: 'Query is required and must be a string',
            code: 'INVALID_QUERY'
          });
        }

        console.log(chalk.blue(`🔍 Processing query with Smart Router: "${query}" (session: ${sessionId})`));

        // Use Smart Router as primary processing engine
        const result = await this.smartRouter.processSmartQuery(query, {
          userId,
          sessionId,
          currentLocation,
          currentProject,
          executeActions,
          maintainContext
        });

        // Format Smart Router response
        const ci = result.contextualIntelligence;
        const response = {
          success: true,
          query: result.query,
          sessionId: sessionId,
          userId: userId,
          timestamp: result.timestamp,
          smartRouter: {
            version: '1.0',
            stepsCompleted: result.steps?.length || 0,
            overallConfidence: ci?.overallConfidence || 0,
            processingTime: result.processingTime || 0
          },
          intelligence: {
            level: 'smart_router',
            confidence: ci?.overallConfidence || 0,
            entities: ci?.contextKnowledge?.entities?.length || 0,
            relationships: ci?.contextKnowledge?.relationships?.length || 0,
            knowledgeGaps: ci?.contextKnowledge?.knowledgeGaps?.length || 0
          },
          discoveries: {
            snappyProjects: ci?.externalDiscoveries?.snappyProjects?.length || 0,
            projectDetails: ci?.externalDiscoveries?.projectDetails?.length || 0,
            projects: ci?.externalDiscoveries?.snappyProjects || []
          },
          connections: {
            entityConnections: ci?.connections?.entityConnections?.length || 0,
            temporalConnections: ci?.connections?.temporalConnections?.length || 0,
            spatialConnections: ci?.connections?.spatialConnections?.length || 0,
            details: ci?.connections || {}
          },
          response: {
            primary: this.generateSmartRouterResponse(result),
            contextualInsights: this.extractInsights(result),
            recommendations: this.extractRecommendations(result)
          },
          metadata: {
            processingTime: result.processingTime || 0,
            executed: executeActions,
            steps: result.steps || [],
            architecture: 'smart_router'
          }
        };

        res.json(response);

      } catch (error) {
        console.error(chalk.red(`❌ Query processing failed: ${error.message}`));
        res.status(500).json({
          error: 'Query processing failed',
          message: error.message,
          code: 'PROCESSING_ERROR'
        });
      }
    });

    // Simple query endpoint (no conversation state)
    this.app.post('/api/query/simple', async (req, res) => {
      try {
        const {
          query,
          userId = 'anonymous',
          currentLocation = null,
          currentProject = null,
          executeActions = false
        } = req.body;

        if (!query || typeof query !== 'string') {
          return res.status(400).json({
            error: 'Query is required and must be a string',
            code: 'INVALID_QUERY'
          });
        }

        console.log(chalk.blue(`🔍 Processing simple query: "${query}"`));

        const result = await this.queryProcessor.processQuery(query, {
          userId,
          currentLocation,
          currentProject,
          executeActions
        });

        const response = {
          success: true,
          query: result.originalQuery,
          intent: result.finalResult?.intent || { type: 'unknown', confidence: 0 },
          entities: this.extractEntities(result),
          actions: result.finalResult?.actions || [],
          response: result.finalResult?.response || 'Query processed',
          metadata: {
            processingTime: result.metadata?.totalDuration || 0,
            confidence: result.finalResult?.confidence || 0.5,
            executed: result.metadata?.executeActions || false
          }
        };

        res.json(response);

      } catch (error) {
        console.error(chalk.red(`❌ Simple query processing failed: ${error.message}`));
        res.status(500).json({
          error: 'Simple query processing failed',
          message: error.message,
          code: 'PROCESSING_ERROR'
        });
      }
    });

    // Session management
    this.app.get('/api/sessions/:sessionId', (req, res) => {
      try {
        const { sessionId } = req.params;
        const sessionStats = this.contextEngine.getSessionStats(sessionId);
        
        if (!sessionStats) {
          return res.status(404).json({
            error: 'Session not found',
            code: 'SESSION_NOT_FOUND'
          });
        }

        res.json({
          success: true,
          session: sessionStats
        });

      } catch (error) {
        res.status(500).json({
          error: 'Failed to get session information',
          message: error.message,
          code: 'SESSION_ERROR'
        });
      }
    });

    this.app.delete('/api/sessions/:sessionId', (req, res) => {
      try {
        const { sessionId } = req.params;
        
        // Clear session from context engine
        if (this.contextEngine.conversationState.has(sessionId)) {
          this.contextEngine.conversationState.delete(sessionId);
          console.log(chalk.yellow(`🗑️  Cleared session: ${sessionId}`));
        }

        res.json({
          success: true,
          message: `Session ${sessionId} cleared`
        });

      } catch (error) {
        res.status(500).json({
          error: 'Failed to clear session',
          message: error.message,
          code: 'SESSION_CLEAR_ERROR'
        });
      }
    });

    // Entity and relationship endpoints
    this.app.get('/api/entities', async (req, res) => {
      try {
        const { domain = this.domain, limit = 50, offset = 0 } = req.query;
        
        // Get entities from resolver
        const entities = await this.contextEngine.queryProcessor.resolver.getAllEntities(domain);
        
        const paginatedEntities = entities.slice(offset, offset + parseInt(limit));
        
        res.json({
          success: true,
          entities: paginatedEntities.map(entity => ({
            id: entity.id,
            domain: entity.domain,
            timestamp: entity.timestamp,
            entityCount: this.countEntities(entity.entities),
            relationships: entity.relationships?.length || 0
          })),
          pagination: {
            total: entities.length,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: offset + parseInt(limit) < entities.length
          }
        });

      } catch (error) {
        res.status(500).json({
          error: 'Failed to get entities',
          message: error.message,
          code: 'ENTITIES_ERROR'
        });
      }
    });

    this.app.get('/api/relationships', async (req, res) => {
      try {
        const { domain = this.domain } = req.query;
        
        // Get entities and build relationship graph
        const entities = await this.contextEngine.queryProcessor.resolver.getAllEntities(domain);
        const graph = RelationshipGraph.buildGraph(entities);
        
        const relationships = [];
        for (const edge of graph.edges) {
          relationships.push({
            source: edge.source,
            target: edge.target,
            type: edge.type,
            confidence: edge.confidence,
            metadata: edge.metadata
          });
        }

        res.json({
          success: true,
          relationships,
          nodes: Array.from(graph.nodes.values()),
          stats: {
            nodeCount: graph.nodes.size,
            edgeCount: graph.edges.length,
            domain
          }
        });

      } catch (error) {
        res.status(500).json({
          error: 'Failed to get relationships',
          message: error.message,
          code: 'RELATIONSHIPS_ERROR'
        });
      }
    });

    // System statistics
    this.app.get('/api/stats', (req, res) => {
      try {
        const activeSessions = this.contextEngine.conversationState.size;
        const expiredSessions = this.contextEngine.cleanupExpiredSessions();
        
        res.json({
          success: true,
          stats: {
            activeSessions,
            expiredSessionsCleaned: expiredSessions,
            domain: this.domain,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            timestamp: new Date().toISOString()
          }
        });

      } catch (error) {
        res.status(500).json({
          error: 'Failed to get statistics',
          message: error.message,
          code: 'STATS_ERROR'
        });
      }
    });
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.path,
        method: req.method,
        code: 'NOT_FOUND'
      });
    });

    // Smart Router specific endpoints
    
    // Structured data routing endpoint
    this.app.post('/api/data/:type', async (req, res) => {
      try {
        const { type } = req.params;
        const { project, format = 'json' } = req.body;

        console.log(chalk.blue(`📊 Data request: ${type} (project: ${project})`));

        let query;
        switch (type) {
          case 'costs':
            if (!project) {
              return res.status(400).json({ error: 'Project ID required for costs data' });
            }
            query = `Get cost breakdown for project ${project}`;
            break;
          case 'projects':
            query = 'List all projects with details';
            break;
          case 'materials':
            query = project ? `Get materials list for project ${project}` : 'Get materials list';
            break;
          default:
            return res.status(400).json({ error: `Unknown data type: ${type}` });
        }

        const result = await this.smartRouter.processSmartQuery(query, {
          dataType: type,
          format,
          project
        });

        res.json({
          success: true,
          dataType: type,
          project,
          data: result.contextualIntelligence?.externalDiscoveries || {},
          metadata: {
            processingTime: result.processingTime,
            confidence: result.contextualIntelligence?.overallConfidence || 0
          }
        });

      } catch (error) {
        console.error(chalk.red(`❌ Data request failed: ${error.message}`));
        res.status(500).json({
          error: 'Data request failed',
          message: error.message
        });
      }
    });

    // Smart discovery endpoint
    this.app.post('/api/discover/:type', async (req, res) => {
      try {
        const { type } = req.params;
        const { person, location, project, entity } = req.body;

        console.log(chalk.blue(`🔍 Discovery request: ${type}`));

        let query;
        switch (type) {
          case 'projects':
            query = 'Discover existing projects';
            if (person) query += ` for person ${person}`;
            if (location) query += ` at location ${location}`;
            break;
          case 'people':
            query = 'Discover people';
            if (project) query += ` associated with project ${project}`;
            break;
          case 'relationships':
            query = 'Discover relationships';
            if (entity) query += ` for entity ${entity}`;
            break;
          default:
            return res.status(400).json({ error: `Unknown discovery type: ${type}` });
        }

        const result = await this.smartRouter.processSmartQuery(query, {
          discoveryType: type,
          person,
          location,
          project,
          entity
        });

        res.json({
          success: true,
          discoveryType: type,
          discovers: result.contextualIntelligence?.externalDiscoveries || {},
          connections: result.contextualIntelligence?.connections || {},
          confidence: result.contextualIntelligence?.overallConfidence || 0,
          metadata: {
            processingTime: result.processingTime,
            steps: result.steps?.length || 0
          }
        });

      } catch (error) {
        console.error(chalk.red(`❌ Discovery request failed: ${error.message}`));
        res.status(500).json({
          error: 'Discovery request failed',
          message: error.message
        });
      }
    });
  }

  // Smart Router helper methods
  generateSmartRouterResponse(result) {
    const ci = result.contextualIntelligence;
    
    if (!ci) {
      return 'Query processed by Smart Router';
    }

    let response = '';
    
    // Report discovers
    if (ci.externalDiscoveries?.snappyProjects?.length > 0) {
      response += `🏗️ Discovered ${ci.externalDiscoveries.snappyProjects.length} existing projects:\n`;
      ci.externalDiscoveries.snappyProjects.slice(0, 3).forEach(project => {
        response += `• ${project.name || project.clientName} (${(project.matchConfidence * 100).toFixed(0)}% match)\n`;
      });
      
      if (ci.externalDiscoveries.snappyProjects.length > 3) {
        response += `... and ${ci.externalDiscoveries.snappyProjects.length - 3} more projects\n`;
      }
      response += '\n';
    }

    // Report connections
    const totalConnections = (ci.connections?.entityConnections?.length || 0) + 
                           (ci.connections?.temporalConnections?.length || 0) + 
                           (ci.connections?.spatialConnections?.length || 0);
    
    if (totalConnections > 0) {
      response += `🔗 Made ${totalConnections} intelligent connections between Context DB and external data\n\n`;
    }

    // Report confidence
    response += `✅ Smart Router confidence: ${(ci.overallConfidence * 100).toFixed(1)}%`;
    
    return response || 'Smart Router processed your query successfully';
  }

  extractInsights(result) {
    const insights = [];
    const ci = result.contextualIntelligence;
    
    if (!ci) return insights;

    // Knowledge gap insights
    if (ci.contextKnowledge?.knowledgeGaps?.length > 0) {
      insights.push(`Found ${ci.contextKnowledge.knowledgeGaps.length} knowledge gaps that could be filled from external sources`);
    }

    // Discovery insights
    if (ci.externalDiscoveries?.snappyProjects?.length > 0) {
      insights.push(`Smart Router discovered existing projects instead of creating new ones - architectural breakthrough working!`);
    }

    // Connection insights
    const totalConnections = (ci.connections?.entityConnections?.length || 0) + 
                           (ci.connections?.temporalConnections?.length || 0) + 
                           (ci.connections?.spatialConnections?.length || 0);
    
    if (totalConnections > 0) {
      insights.push(`Made ${totalConnections} intelligent connections between conceptual understanding and structured data`);
    }

    return insights;
  }

  extractRecommendations(result) {
    const recommendations = [];
    const ci = result.contextualIntelligence;
    
    if (!ci) return recommendations;

    // Project-specific recommendations
    if (ci.externalDiscoveries?.snappyProjects?.length > 0) {
      const highConfidenceProjects = ci.externalDiscoveries.snappyProjects.filter(p => p.matchConfidence > 0.8);
      if (highConfidenceProjects.length > 0) {
        recommendations.push(`Consider using existing project: ${highConfidenceProjects[0].name || highConfidenceProjects[0].clientName}`);
      }
    }

    // Data completeness recommendations
    if (ci.contextKnowledge?.knowledgeGaps?.length > 0) {
      recommendations.push('Additional project details could be retrieved from Snappy for more complete context');
    }

    return recommendations;
  }

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
   * Extract entities from processing result
   */
  extractEntities(result) {
    const entities = {};
    
    if (result.finalResult?.resolvedContext?.entities) {
      for (const [type, entityList] of Object.entries(result.finalResult.resolvedContext.entities)) {
        if (Array.isArray(entityList) && entityList.length > 0) {
          entities[type] = entityList.length;
        }
      }
    }
    
    return entities;
  }

  /**
   * Count entities in an entity object
   */
  countEntities(entities) {
    let count = 0;
    for (const entityList of Object.values(entities || {})) {
      if (Array.isArray(entityList)) {
        count += entityList.length;
      }
    }
    return count;
  }

  /**
   * Start the server
   */
  async start() {
    try {
      console.log(chalk.blue.bold('🚀 Starting Context API Server'));
      console.log(chalk.blue.bold('================================'));
      
      // Initialize components
      console.log(chalk.cyan('Initializing contextual intelligence engine...'));
      
      const server = this.app.listen(this.port, this.host, () => {
        console.log(chalk.green.bold(`✅ Context API Server running`));
        console.log(chalk.green(`   URL: http://${this.host}:${this.port}`));
        console.log(chalk.green(`   Domain: ${this.domain}`));
        console.log(chalk.green(`   Health: http://${this.host}:${this.port}/health`));
        console.log(chalk.green(`   API Info: http://${this.host}:${this.port}/api`));
        console.log('');
        console.log(chalk.blue('📋 Available Endpoints:'));
        console.log('   POST /api/query - Process contextual queries');
        console.log('   POST /api/query/simple - Simple query processing');
        console.log('   GET /api/sessions/:id - Session management');
        console.log('   GET /api/entities - Entity listing');
        console.log('   GET /api/relationships - Relationship data');
        console.log('   GET /api/stats - System statistics');
      });

      // Graceful shutdown
      process.on('SIGTERM', () => {
        console.log(chalk.yellow('Received SIGTERM, shutting down gracefully...'));
        server.close(() => {
          console.log(chalk.green('Server closed'));
          process.exit(0);
        });
      });

      return server;

    } catch (error) {
      console.error(chalk.red(`❌ Failed to start server: ${error.message}`));
      throw error;
    }
  }
}

export { ContextAPIServer };
