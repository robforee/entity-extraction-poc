/**
 * Enhanced Entity Schema with Relationships Support
 * 
 * Defines the structure for entities with semantic relationships,
 * metadata tracking, and validation rules.
 */

import { RelationshipValidator } from './relationship-types.js';

/**
 * Enhanced Entity Structure
 */
class EntitySchema {
  static createEntity(baseEntity) {
    return {
      // Core entity fields (existing)
      id: baseEntity.id,
      conversationId: baseEntity.conversationId,
      userId: baseEntity.userId,
      timestamp: baseEntity.timestamp,
      domain: baseEntity.domain,
      
      // Enhanced entity structure
      entities: baseEntity.entities,
      
      // NEW: Relationships array
      relationships: [],
      
      // Enhanced metadata
      metadata: {
        ...baseEntity.metadata,
        relationshipCount: 0,
        lastRelationshipUpdate: null,
        relationshipSources: []
      },
      
      // Migration tracking
      migratedFrom: baseEntity.migratedFrom,
      migrationTimestamp: baseEntity.migrationTimestamp,
      schemaVersion: '2.0.0' // Track schema evolution
    };
  }
  
  /**
   * Create a relationship object
   */
  static createRelationship(config) {
    const {
      type,
      target,
      confidence,
      source,
      establishedOn = null,
      metadata = {},
      temporal = null
    } = config;
    
    const relationship = {
      type,
      target,
      confidence,
      source,
      establishedOn,
      createdAt: new Date().toISOString(),
      metadata
    };
    
    // Add temporal information if provided
    if (temporal) {
      relationship.temporal = temporal;
    }
    
    return relationship;
  }
  
  /**
   * Add relationship to entity
   */
  static addRelationship(entity, relationshipConfig) {
    const relationship = this.createRelationship(relationshipConfig);
    
    // Validate relationship
    const validation = RelationshipValidator.validateRelationship(relationship);
    if (!validation.valid) {
      throw new Error(`Invalid relationship: ${validation.error}`);
    }
    
    // Initialize relationships array if not exists
    if (!entity.relationships) {
      entity.relationships = [];
    }
    
    // Check for duplicate relationships
    const duplicate = entity.relationships.find(r => 
      r.type === relationship.type && 
      r.target === relationship.target
    );
    
    if (duplicate) {
      // Update existing relationship with higher confidence
      if (relationship.confidence > duplicate.confidence) {
        Object.assign(duplicate, relationship);
        duplicate.updatedAt = new Date().toISOString();
      }
    } else {
      // Add new relationship
      entity.relationships.push(relationship);
    }
    
    // Update metadata
    entity.metadata.relationshipCount = entity.relationships.length;
    entity.metadata.lastRelationshipUpdate = new Date().toISOString();
    
    // Track relationship sources
    if (!entity.metadata.relationshipSources) {
      entity.metadata.relationshipSources = [];
    }
    if (!entity.metadata.relationshipSources.includes(relationship.source)) {
      entity.metadata.relationshipSources.push(relationship.source);
    }
    
    return entity;
  }
  
  /**
   * Remove relationship from entity
   */
  static removeRelationship(entity, type, target) {
    if (!entity.relationships) return entity;
    
    entity.relationships = entity.relationships.filter(r => 
      !(r.type === type && r.target === target)
    );
    
    entity.metadata.relationshipCount = entity.relationships.length;
    entity.metadata.lastRelationshipUpdate = new Date().toISOString();
    
    return entity;
  }
  
  /**
   * Get relationships by type
   */
  static getRelationshipsByType(entity, type) {
    if (!entity.relationships) return [];
    return entity.relationships.filter(r => r.type === type);
  }
  
  /**
   * Get relationships by target
   */
  static getRelationshipsByTarget(entity, target) {
    if (!entity.relationships) return [];
    return entity.relationships.filter(r => r.target === target);
  }
  
  /**
   * Get all relationship targets
   */
  static getRelationshipTargets(entity) {
    if (!entity.relationships) return [];
    return entity.relationships.map(r => r.target);
  }
  
  /**
   * Validate entity structure
   */
  static validateEntity(entity) {
    const errors = [];
    
    // Check required fields
    const requiredFields = ['id', 'conversationId', 'userId', 'timestamp', 'domain'];
    for (const field of requiredFields) {
      if (!entity.hasOwnProperty(field)) {
        errors.push(`Missing required field: ${field}`);
      }
    }
    
    // Validate relationships
    if (entity.relationships) {
      for (let i = 0; i < entity.relationships.length; i++) {
        const relationship = entity.relationships[i];
        const validation = RelationshipValidator.validateRelationship(relationship);
        if (!validation.valid) {
          errors.push(`Invalid relationship at index ${i}: ${validation.error}`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Migrate legacy entity to new schema
   */
  static migrateLegacyEntity(legacyEntity) {
    const enhancedEntity = this.createEntity(legacyEntity);
    
    // Preserve existing relationships if they exist
    if (legacyEntity.relationships && legacyEntity.relationships.length > 0) {
      enhancedEntity.relationships = [...legacyEntity.relationships];
      enhancedEntity.metadata.relationshipCount = legacyEntity.relationships.length;
      enhancedEntity.metadata.lastRelationshipUpdate = new Date().toISOString();
    }
    
    // Add migration metadata
    enhancedEntity.metadata.migratedAt = new Date().toISOString();
    enhancedEntity.metadata.legacySchema = '1.0.0';
    
    return enhancedEntity;
  }
  
  /**
   * Get entity summary with relationship counts
   */
  static getEntitySummary(entity) {
    const relationshipCounts = {};
    
    if (entity.relationships) {
      for (const relationship of entity.relationships) {
        relationshipCounts[relationship.type] = (relationshipCounts[relationship.type] || 0) + 1;
      }
    }
    
    return {
      id: entity.id,
      domain: entity.domain,
      entityCount: Object.keys(entity.entities || {}).reduce((sum, category) => 
        sum + (Array.isArray(entity.entities[category]) ? entity.entities[category].length : 0), 0
      ),
      relationshipCount: entity.relationships ? entity.relationships.length : 0,
      relationshipTypes: Object.keys(relationshipCounts),
      relationshipCounts,
      lastUpdated: entity.metadata.lastRelationshipUpdate || entity.timestamp
    };
  }
}

/**
 * Relationship Graph utilities
 */
class RelationshipGraph {
  /**
   * Build relationship graph from entities
   */
  static buildGraph(entities) {
    const graph = {
      nodes: new Map(),
      edges: []
    };
    
    // Add entity nodes
    for (const entity of entities) {
      graph.nodes.set(entity.id, {
        id: entity.id,
        domain: entity.domain,
        type: 'entity',
        metadata: entity.metadata
      });
      
      // Add relationships as edges
      if (entity.relationships) {
        for (const relationship of entity.relationships) {
          graph.edges.push({
            source: entity.id,
            target: relationship.target,
            type: relationship.type,
            confidence: relationship.confidence,
            metadata: relationship.metadata
          });
        }
      }
    }
    
    return graph;
  }
  
  /**
   * Find paths between entities
   */
  static findPaths(graph, sourceId, targetId, maxDepth = 3) {
    const paths = [];
    const visited = new Set();
    
    function dfs(currentId, path, depth) {
      if (depth > maxDepth) return;
      if (currentId === targetId && path.length > 0) {
        paths.push([...path]);
        return;
      }
      
      visited.add(currentId);
      
      // Find outgoing edges
      for (const edge of graph.edges) {
        if (edge.source === currentId && !visited.has(edge.target)) {
          path.push(edge);
          dfs(edge.target, path, depth + 1);
          path.pop();
        }
      }
      
      visited.delete(currentId);
    }
    
    dfs(sourceId, [], 0);
    return paths;
  }
  
  /**
   * Get entity neighbors
   */
  static getNeighbors(graph, entityId) {
    const neighbors = {
      outgoing: [],
      incoming: []
    };
    
    for (const edge of graph.edges) {
      if (edge.source === entityId) {
        neighbors.outgoing.push({
          target: edge.target,
          relationship: edge.type,
          confidence: edge.confidence
        });
      }
      if (edge.target === entityId) {
        neighbors.incoming.push({
          source: edge.source,
          relationship: edge.type,
          confidence: edge.confidence
        });
      }
    }
    
    return neighbors;
  }
}

export {
  EntitySchema,
  RelationshipGraph
};
