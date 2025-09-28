#!/usr/bin/env node

/**
 * Smart Router API Test Server
 * 
 * Simple test server to validate Smart Router integration with production API
 */

import express from 'express';
import cors from 'cors';
import { DataSourceRouter } from './src/routing/data-source-router.js';
import chalk from 'chalk';
import path from 'path';

const app = express();
const port = 3001;

// Initialize Smart Router
const smartRouter = new DataSourceRouter({
  dataPath: path.join(process.cwd(), 'data'),
  snappyPath: path.resolve(process.cwd(), '..', 'snappy')
});

// Middleware
app.use(cors());
app.use(express.json());

// Smart Router Query Endpoint
app.post('/api/query', async (req, res) => {
  try {
    const { query, userId = 'test-user' } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    console.log(chalk.blue(`🔍 Smart Router Query: "${query}"`));

    const result = await smartRouter.processSmartQuery(query, { userId });
    const ci = result.contextualIntelligence;

    const response = {
      success: true,
      query: result.query,
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
        spatialConnections: ci?.connections?.spatialConnections?.length || 0
      },
      response: {
        primary: generateSmartRouterResponse(result),
        insights: extractInsights(result),
        recommendations: extractRecommendations(result)
      }
    };

    res.json(response);

  } catch (error) {
    console.error(chalk.red(`❌ Query failed: ${error.message}`));
    res.status(500).json({
      error: 'Query processing failed',
      message: error.message
    });
  }
});

// Structured Data Routing Endpoint
app.post('/api/data/:type', async (req, res) => {
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

    const result = await smartRouter.processSmartQuery(query, {
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

// Smart Discovery Endpoint
app.post('/api/discover/:type', async (req, res) => {
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

    const result = await smartRouter.processSmartQuery(query, {
      discoveryType: type,
      person,
      location,
      project,
      entity
    });

    res.json({
      success: true,
      discoveryType: type,
      discoveries: result.contextualIntelligence?.externalDiscoveries || {},
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

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Smart Router API',
    version: '1.0',
    timestamp: new Date().toISOString()
  });
});

// Helper functions
function generateSmartRouterResponse(result) {
  const ci = result.contextualIntelligence;
  
  if (!ci) {
    return 'Query processed by Smart Router';
  }

  let response = '';
  
  // Report discoveries
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

function extractInsights(result) {
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

function extractRecommendations(result) {
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

// Start server
app.listen(port, () => {
  console.log(chalk.green.bold(`\n🚀 Smart Router API Server`));
  console.log(chalk.green(`✅ Server running on http://localhost:${port}`));
  console.log(chalk.yellow('\n📋 Available Endpoints:'));
  console.log(chalk.cyan('  POST /api/query              - Smart Router natural language queries'));
  console.log(chalk.cyan('  POST /api/data/:type         - Structured data routing (costs, projects, materials)'));
  console.log(chalk.cyan('  POST /api/discover/:type     - Smart discovery (projects, people, relationships)'));
  console.log(chalk.cyan('  GET  /health                 - Health check'));
  console.log(chalk.yellow('\n💡 Example Usage:'));
  console.log(chalk.grey('  curl -X POST http://localhost:3001/api/query \\'));
  console.log(chalk.grey('    -H "Content-Type: application/json" \\'));
  console.log(chalk.grey('    -d \'{"query": "I bought screws for John\'s deck"}\''));
  console.log('');
});
