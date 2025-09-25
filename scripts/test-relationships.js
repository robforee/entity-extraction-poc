#!/usr/bin/env node

/**
 * Relationship System Test Script
 * 
 * Demonstrates the semantic relationship system by showing:
 * - Loaded entities with relationships
 * - Relationship graph traversal
 * - Context queries
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EntitySchema, RelationshipGraph } from '../src/relationships/entity-schema.js';
import { RelationshipValidator } from '../src/relationships/relationship-types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('🔗 Entity Relationship System Test');
  console.log('==================================');
  
  const dataPath = path.join(__dirname, '..', 'data');
  
  try {
    // Load cybersec entities (which have relationships)
    const entities = await loadEntities(path.join(dataPath, 'cybersec', 'entities'));
    console.log(`\n📊 Loaded ${entities.length} entities from cybersec domain`);
    
    // Show relationship statistics
    showRelationshipStats(entities);
    
    // Build relationship graph
    const graph = RelationshipGraph.buildGraph(entities);
    console.log(`\n🕸️  Relationship Graph:`);
    console.log(`   - Nodes: ${graph.nodes.size}`);
    console.log(`   - Edges: ${graph.edges.length}`);
    
    // Show sample relationships
    showSampleRelationships(entities);
    
    // Demonstrate graph traversal
    demonstrateGraphTraversal(graph, entities);
    
    // Show relationship types distribution
    showRelationshipTypeDistribution(entities);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

async function loadEntities(entitiesPath) {
  const entities = [];
  const files = await fs.promises.readdir(entitiesPath);
  
  for (const file of files) {
    if (file.endsWith('.json')) {
      const filePath = path.join(entitiesPath, file);
      const content = await fs.promises.readFile(filePath, 'utf8');
      const entity = JSON.parse(content);
      entities.push(entity);
    }
  }
  
  return entities;
}

function showRelationshipStats(entities) {
  let totalRelationships = 0;
  let entitiesWithRelationships = 0;
  
  for (const entity of entities) {
    if (entity.relationships && entity.relationships.length > 0) {
      entitiesWithRelationships++;
      totalRelationships += entity.relationships.length;
    }
  }
  
  console.log(`\n📈 Relationship Statistics:`);
  console.log(`   - Entities with relationships: ${entitiesWithRelationships}/${entities.length}`);
  console.log(`   - Total relationships: ${totalRelationships}`);
  console.log(`   - Average relationships per entity: ${(totalRelationships / entities.length).toFixed(1)}`);
}

function showSampleRelationships(entities) {
  console.log(`\n🔍 Sample Relationships:`);
  
  let shown = 0;
  for (const entity of entities) {
    if (entity.relationships && entity.relationships.length > 0 && shown < 5) {
      const entityName = getEntityDisplayName(entity);
      console.log(`\n   Entity: ${entityName} (${entity.id.substring(0, 8)}...)`);
      
      for (let i = 0; i < Math.min(3, entity.relationships.length); i++) {
        const rel = entity.relationships[i];
        const targetEntity = entities.find(e => e.id === rel.target);
        const targetName = targetEntity ? getEntityDisplayName(targetEntity) : 'Unknown';
        
        console.log(`     → ${rel.type} → ${targetName} (confidence: ${rel.confidence})`);
        console.log(`       Source: ${rel.source}, Rule: ${rel.metadata?.inferenceRule || 'N/A'}`);
      }
      
      if (entity.relationships.length > 3) {
        console.log(`     ... and ${entity.relationships.length - 3} more relationships`);
      }
      
      shown++;
    }
  }
}

function demonstrateGraphTraversal(graph, entities) {
  console.log(`\n🗺️  Graph Traversal Demo:`);
  
  // Find two entities with relationships
  const entityIds = Array.from(graph.nodes.keys());
  if (entityIds.length >= 2) {
    const sourceId = entityIds[0];
    const targetId = entityIds[1];
    
    const paths = RelationshipGraph.findPaths(graph, sourceId, targetId, 2);
    
    console.log(`   Searching paths from ${sourceId.substring(0, 8)}... to ${targetId.substring(0, 8)}...`);
    console.log(`   Found ${paths.length} paths`);
    
    if (paths.length > 0) {
      const path = paths[0];
      console.log(`   Sample path: ${path.map(edge => edge.type).join(' → ')}`);
    }
    
    // Show neighbors
    const neighbors = RelationshipGraph.getNeighbors(graph, sourceId);
    console.log(`   Entity ${sourceId.substring(0, 8)}... has:`);
    console.log(`     - ${neighbors.outgoing.length} outgoing relationships`);
    console.log(`     - ${neighbors.incoming.length} incoming relationships`);
  }
}

function showRelationshipTypeDistribution(entities) {
  console.log(`\n📊 Relationship Type Distribution:`);
  
  const typeCounts = {};
  
  for (const entity of entities) {
    if (entity.relationships) {
      for (const rel of entity.relationships) {
        typeCounts[rel.type] = (typeCounts[rel.type] || 0) + 1;
      }
    }
  }
  
  const sortedTypes = Object.entries(typeCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10);
  
  for (const [type, count] of sortedTypes) {
    const bar = '█'.repeat(Math.ceil(count / 5));
    console.log(`   ${type.padEnd(20)} ${count.toString().padStart(3)} ${bar}`);
  }
}

function getEntityDisplayName(entity) {
  // Try to get a meaningful name from the entity
  if (entity.entities?.people?.[0]?.name) {
    return entity.entities.people[0].name;
  }
  if (entity.entities?.projects?.[0]?.name) {
    return entity.entities.projects[0].name;
  }
  if (entity.entities?.locations?.[0]?.name) {
    return entity.entities.locations[0].name;
  }
  return `${entity.domain} entity`;
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

export { main };
