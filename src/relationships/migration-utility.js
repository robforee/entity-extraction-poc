/**
 * Migration Utility for Converting Merge Pairs to Semantic Relationships
 * 
 * Converts existing co-occurrence merge pairs into meaningful semantic relationships
 * based on entity types, domain context, and heuristic analysis.
 */

import fs from 'fs';
import path from 'path';
import { EntitySchema } from './entity-schema.js';
import { RelationshipValidator, ALL_RELATIONSHIPS } from './relationship-types.js';
import { ContentRelationshipInference } from './content-relationship-inference.js';

const fsPromises = fs.promises;

class MigrationUtility {
  constructor(dataPath) {
    this.dataPath = dataPath;
    this.migrationLog = [];
  }
  
  /**
   * Main migration function
   */
  async migrate(domain = null, dryRun = false) {
    console.log(`Starting migration${dryRun ? ' (DRY RUN)' : ''}...`);
    
    const domains = domain ? [domain] : ['construction', 'cybersec', 'default'];
    const results = {
      totalEntities: 0,
      migratedEntities: 0,
      relationshipsCreated: 0,
      errors: []
    };
    
    for (const domainName of domains) {
      try {
        const domainResults = await this.migrateDomain(domainName, dryRun);
        results.totalEntities += domainResults.totalEntities;
        results.migratedEntities += domainResults.migratedEntities;
        results.relationshipsCreated += domainResults.relationshipsCreated;
        results.errors.push(...domainResults.errors);
      } catch (error) {
        console.error(`Error migrating domain ${domainName}:`, error);
        results.errors.push(`Domain ${domainName}: ${error.message}`);
      }
    }
    
    console.log('\nMigration Results:');
    console.log(`- Total entities processed: ${results.totalEntities}`);
    console.log(`- Entities migrated: ${results.migratedEntities}`);
    console.log(`- Relationships created: ${results.relationshipsCreated}`);
    console.log(`- Errors: ${results.errors.length}`);
    
    if (results.errors.length > 0) {
      console.log('\nErrors:');
      results.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    return results;
  }
  
  /**
   * Migrate a specific domain
   */
  async migrateDomain(domain, dryRun = false) {
    console.log(`\nMigrating domain: ${domain}`);
    
    const domainPath = path.join(this.dataPath, domain);
    const entitiesPath = path.join(domainPath, 'entities');
    
    const results = {
      totalEntities: 0,
      migratedEntities: 0,
      relationshipsCreated: 0,
      errors: []
    };
    
    try {
      // Load entities
      const entities = await this.loadEntities(entitiesPath);
      results.totalEntities = entities.length;
      
      if (entities.length === 0) {
        console.log(`  - No entities found in ${domain}`);
        return results;
      }
      
      // Use content-based relationship inference
      const inferenceEngine = new ContentRelationshipInference();
      const relationships = inferenceEngine.inferRelationships(entities, domain);
      
      // Apply relationships to entities
      const enhancedEntities = await inferenceEngine.applyRelationshipsToEntities(entities, relationships);
      
      // Migrate entities to new schema and save
      for (const entity of enhancedEntities) {
        try {
          const enhanced = EntitySchema.migrateLegacyEntity(entity);
          
          if (enhanced.relationships && enhanced.relationships.length > 0) {
            results.migratedEntities++;
            results.relationshipsCreated += enhanced.relationships.length;
          }
          
          if (!dryRun) {
            await this.saveEntity(enhanced, entitiesPath);
          }
        } catch (error) {
          results.errors.push(`Entity ${entity.id}: ${error.message}`);
        }
      }
      
      console.log(`  - Processed ${results.totalEntities} entities`);
      console.log(`  - Enhanced ${results.migratedEntities} entities`);
      console.log(`  - Created ${results.relationshipsCreated} relationships`);
      
    } catch (error) {
      console.error(`Error processing domain ${domain}:`, error);
      results.errors.push(error.message);
    }
    
    return results;
  }
  
  /**
   * Load entities from directory
   */
  async loadEntities(entitiesPath) {
    const entities = [];
    
    try {
      const files = await fsPromises.readdir(entitiesPath);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(entitiesPath, file);
          const content = await fsPromises.readFile(filePath, 'utf8');
          const entity = JSON.parse(content);
          entities.push(entity);
        }
      }
    } catch (error) {
      console.warn(`Could not load entities from ${entitiesPath}:`, error.message);
    }
    
    return entities;
  }
  
  /**
   * Load merge pairs (deprecated - kept for compatibility)
   */
  async loadMergePairs(mergePairsPath) {
    try {
      const content = await fsPromises.readFile(mergePairsPath, 'utf8');
      const data = JSON.parse(content);
      return data.mergedPairs || [];
    } catch (error) {
      console.warn(`Could not load merge pairs from ${mergePairsPath}:`, error.message);
      return [];
    }
  }
  
  /**
   * Create entity lookup map
   */
  createEntityMap(entities) {
    const entityMap = new Map();
    
    for (const entity of entities) {
      // Create searchable index of entity content
      const searchableContent = this.extractSearchableContent(entity);
      entityMap.set(entity.id, {
        entity,
        searchableContent
      });
    }
    
    return entityMap;
  }
  
  /**
   * Extract searchable content from entity
   */
  extractSearchableContent(entity) {
    const content = {
      people: [],
      projects: [],
      locations: [],
      materials: [],
      tasks: [],
      organizations: [],
      systems: []
    };
    
    if (entity.entities) {
      // Extract people
      if (entity.entities.people) {
        content.people = entity.entities.people.map(p => ({
          name: p.name,
          role: p.role,
          confidence: p.confidence
        }));
      }
      
      // Extract projects
      if (entity.entities.projects) {
        content.projects = entity.entities.projects.map(p => ({
          name: p.name,
          type: p.type,
          phase: p.phase,
          confidence: p.confidence
        }));
      }
      
      // Extract locations
      if (entity.entities.locations) {
        content.locations = entity.entities.locations.map(l => ({
          name: l.name || l.address,
          type: l.type,
          confidence: l.confidence
        }));
      }
      
      // Extract materials
      if (entity.entities.materials) {
        content.materials = entity.entities.materials.map(m => ({
          name: m.name || m.item,
          type: m.type,
          confidence: m.confidence
        }));
      }
      
      // Extract tasks
      if (entity.entities.tasks) {
        content.tasks = entity.entities.tasks.map(t => ({
          description: t.description,
          assignedTo: t.assigned_to,
          confidence: t.confidence
        }));
      }
    }
    
    return content;
  }
  
  /**
   * Convert merge pairs to semantic relationships
   */
  convertMergePairsToRelationships(mergePairs, entityMap, domain) {
    const relationshipMap = new Map();
    
    for (const pair of mergePairs) {
      const [entityId1, entityId2] = pair.split('|');
      
      const entity1Data = entityMap.get(entityId1);
      const entity2Data = entityMap.get(entityId2);
      
      if (!entity1Data || !entity2Data) {
        continue; // Skip if entities not found
      }
      
      // Infer relationships between entities
      const relationships = this.inferRelationships(
        entity1Data,
        entity2Data,
        domain
      );
      
      // Add relationships to map
      for (const relationship of relationships) {
        if (!relationshipMap.has(relationship.sourceId)) {
          relationshipMap.set(relationship.sourceId, []);
        }
        relationshipMap.get(relationship.sourceId).push(relationship);
      }
    }
    
    return relationshipMap;
  }
  
  /**
   * Infer relationships between two entities
   */
  inferRelationships(entity1Data, entity2Data, domain) {
    const relationships = [];
    const entity1 = entity1Data.entity;
    const entity2 = entity2Data.entity;
    const content1 = entity1Data.searchableContent;
    const content2 = entity2Data.searchableContent;
    
    // Person-Project relationships
    const personProjectRels = this.inferPersonProjectRelationships(content1, content2, entity1.id, entity2.id);
    relationships.push(...personProjectRels);
    
    // Person-Task relationships
    const personTaskRels = this.inferPersonTaskRelationships(content1, content2, entity1.id, entity2.id);
    relationships.push(...personTaskRels);
    
    // Project-Location relationships
    const projectLocationRels = this.inferProjectLocationRelationships(content1, content2, entity1.id, entity2.id);
    relationships.push(...projectLocationRels);
    
    // Domain-specific relationships
    if (domain === 'cybersec') {
      const cybersecRels = this.inferCybersecRelationships(content1, content2, entity1.id, entity2.id);
      relationships.push(...cybersecRels);
    } else if (domain === 'construction') {
      const constructionRels = this.inferConstructionRelationships(content1, content2, entity1.id, entity2.id);
      relationships.push(...constructionRels);
    }
    
    return relationships;
  }
  
  /**
   * Infer person-project relationships
   */
  inferPersonProjectRelationships(content1, content2, id1, id2) {
    const relationships = [];
    
    // Check if one entity has people and the other has projects
    if (content1.people.length > 0 && content2.projects.length > 0) {
      relationships.push({
        sourceId: id1,
        type: 'manages',
        target: id2,
        confidence: 0.7,
        source: 'migration_inference',
        metadata: {
          inferenceType: 'person_project_cooccurrence',
          people: content1.people.map(p => p.name),
          projects: content2.projects.map(p => p.name)
        }
      });
    }
    
    if (content2.people.length > 0 && content1.projects.length > 0) {
      relationships.push({
        sourceId: id2,
        type: 'manages',
        target: id1,
        confidence: 0.7,
        source: 'migration_inference',
        metadata: {
          inferenceType: 'person_project_cooccurrence',
          people: content2.people.map(p => p.name),
          projects: content1.projects.map(p => p.name)
        }
      });
    }
    
    return relationships;
  }
  
  /**
   * Infer person-task relationships
   */
  inferPersonTaskRelationships(content1, content2, id1, id2) {
    const relationships = [];
    
    // Check for task assignments
    if (content1.tasks.length > 0 && content2.people.length > 0) {
      for (const task of content1.tasks) {
        for (const person of content2.people) {
          if (task.assignedTo && task.assignedTo.toLowerCase().includes(person.name.toLowerCase())) {
            relationships.push({
              sourceId: id1,
              type: 'assigned_to',
              target: id2,
              confidence: 0.8,
              source: 'migration_inference',
              metadata: {
                inferenceType: 'task_assignment',
                task: task.description,
                assignee: person.name
              }
            });
          }
        }
      }
    }
    
    return relationships;
  }
  
  /**
   * Infer project-location relationships
   */
  inferProjectLocationRelationships(content1, content2, id1, id2) {
    const relationships = [];
    
    if (content1.projects.length > 0 && content2.locations.length > 0) {
      relationships.push({
        sourceId: id1,
        type: 'located_at',
        target: id2,
        confidence: 0.6,
        source: 'migration_inference',
        metadata: {
          inferenceType: 'project_location_cooccurrence',
          projects: content1.projects.map(p => p.name),
          locations: content2.locations.map(l => l.name)
        }
      });
    }
    
    return relationships;
  }
  
  /**
   * Infer cybersecurity-specific relationships
   */
  inferCybersecRelationships(content1, content2, id1, id2) {
    const relationships = [];
    
    // Look for consultant-project relationships
    const hasConsultant1 = content1.people.some(p => 
      p.role && p.role.toLowerCase().includes('consultant')
    );
    const hasConsultant2 = content2.people.some(p => 
      p.role && p.role.toLowerCase().includes('consultant')
    );
    
    if (hasConsultant1 && content2.projects.length > 0) {
      relationships.push({
        sourceId: id1,
        type: 'responsible_for',
        target: id2,
        confidence: 0.8,
        source: 'migration_inference',
        metadata: {
          inferenceType: 'consultant_project_responsibility'
        }
      });
    }
    
    return relationships;
  }
  
  /**
   * Infer construction-specific relationships
   */
  inferConstructionRelationships(content1, content2, id1, id2) {
    const relationships = [];
    
    // Look for material-project relationships
    if (content1.materials.length > 0 && content2.projects.length > 0) {
      relationships.push({
        sourceId: id2,
        type: 'requires',
        target: id1,
        confidence: 0.7,
        source: 'migration_inference',
        metadata: {
          inferenceType: 'project_material_requirement',
          materials: content1.materials.map(m => m.name)
        }
      });
    }
    
    return relationships;
  }
  
  /**
   * Enhance entity with relationships
   */
  async enhanceEntityWithRelationships(entity, relationshipMap, entityMap) {
    // Migrate to new schema
    const enhanced = EntitySchema.migrateLegacyEntity(entity);
    
    // Add inferred relationships
    const relationships = relationshipMap.get(entity.id) || [];
    
    for (const relationshipConfig of relationships) {
      try {
        EntitySchema.addRelationship(enhanced, {
          type: relationshipConfig.type,
          target: relationshipConfig.target,
          confidence: relationshipConfig.confidence,
          source: relationshipConfig.source,
          metadata: relationshipConfig.metadata
        });
      } catch (error) {
        console.warn(`Failed to add relationship to ${entity.id}:`, error.message);
      }
    }
    
    return enhanced;
  }
  
  /**
   * Save enhanced entity
   */
  async saveEntity(entity, entitiesPath) {
    const filePath = path.join(entitiesPath, `${entity.id}.json`);
    await fsPromises.writeFile(filePath, JSON.stringify(entity, null, 2));
  }
  
  /**
   * Create backup of existing data
   */
  async createBackup(domain) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.dataPath, `backup-${domain}-${timestamp}`);
    
    const sourcePath = path.join(this.dataPath, domain);
    
    // Copy directory recursively
    await fsPromises.mkdir(backupPath, { recursive: true });
    
    const copyRecursive = async (src, dest) => {
      const stats = await fsPromises.stat(src);
      
      if (stats.isDirectory()) {
        await fsPromises.mkdir(dest, { recursive: true });
        const files = await fsPromises.readdir(src);
        
        for (const file of files) {
          await copyRecursive(path.join(src, file), path.join(dest, file));
        }
      } else {
        await fsPromises.copyFile(src, dest);
      }
    };
    
    await copyRecursive(sourcePath, backupPath);
    console.log(`Backup created: ${backupPath}`);
    
    return backupPath;
  }
}

export { MigrationUtility };
