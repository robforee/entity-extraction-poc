/**
 * Context Resolution Engine
 * 
 * Resolves ambiguous references in queries using the relationship graph.
 * Handles context like "John's" → "John's Construction Project at 123 Main St"
 */

import fs from 'fs';
import path from 'path';
import { RelationshipGraph } from '../relationships/entity-schema.js';
import chalk from 'chalk';

const fsPromises = fs.promises;

class ContextResolver {
  constructor(options = {}) {
    this.dataPath = options.dataPath || path.join(process.cwd(), 'data');
    this.domain = options.domain || 'construction';
    this.entityCache = new Map();
    this.relationshipGraph = null;
    this.lastCacheUpdate = null;
  }

  /**
   * Resolve context for a parsed query
   */
  async resolveContext(parsedQuery, options = {}) {
    const {
      userId = parsedQuery.metadata?.userId,
      currentLocation = parsedQuery.metadata?.currentLocation,
      currentProject = parsedQuery.metadata?.currentProject
    } = options;

    console.log(chalk.blue(`🔍 Resolving context for query: "${parsedQuery.originalQuery}"`));

    try {
      // Ensure we have fresh entity data
      await this.refreshEntityCache();

      // Build resolution context
      const resolutionContext = {
        userId,
        currentLocation,
        currentProject,
        domain: parsedQuery.metadata.domain,
        timestamp: new Date().toISOString()
      };

      // Resolve each context requirement
      const resolvedContext = {
        entities: { ...parsedQuery.entities },
        resolvedReferences: [],
        contextualInformation: [],
        confidence: parsedQuery.metadata.confidence || 0.5,
        ambiguities: []
      };

      // Process context resolution requirements
      for (const requirement of parsedQuery.contextRequirements.context_resolution_needed) {
        const resolution = await this.resolveRequirement(requirement, resolutionContext, parsedQuery);
        if (resolution) {
          resolvedContext.resolvedReferences.push(resolution);
          
          // Add resolved entities to the context
          if (resolution.resolvedEntity) {
            const entityType = resolution.type + 's'; // Make plural
            if (!resolvedContext.entities[entityType]) {
              resolvedContext.entities[entityType] = [];
            }
            resolvedContext.entities[entityType].push(resolution.resolvedEntity);
          }
        }
      }

      // Gather contextual information using relationship graph
      const contextualInfo = await this.gatherContextualInformation(resolvedContext, resolutionContext);
      resolvedContext.contextualInformation = contextualInfo;

      // Calculate overall confidence
      resolvedContext.confidence = this.calculateResolutionConfidence(resolvedContext, parsedQuery);

      console.log(chalk.green(`✅ Context resolved - ${resolvedContext.resolvedReferences.length} references, ${contextualInfo.length} contextual items`));

      return {
        originalQuery: parsedQuery,
        resolvedContext,
        metadata: {
          ...parsedQuery.metadata,
          resolutionTimestamp: new Date().toISOString(),
          resolutionConfidence: resolvedContext.confidence
        }
      };

    } catch (error) {
      console.error(chalk.red(`❌ Context resolution failed: ${error.message}`));
      throw new Error(`Failed to resolve context: ${error.message}`);
    }
  }

  /**
   * Resolve a specific context requirement
   */
  async resolveRequirement(requirement, resolutionContext, parsedQuery) {
    const { type, value, reason } = requirement;

    console.log(chalk.gray(`  🔍 Resolving ${type}: "${value}" (${reason})`));

    switch (reason) {
      case 'ambiguous_reference':
        return await this.resolveAmbiguousReference(type, value, resolutionContext, parsedQuery);
      
      case 'implicit_reference':
        return await this.resolveImplicitReference(type, value, resolutionContext, parsedQuery);
      
      case 'possessive_reference':
        return await this.resolvePossessiveReference(type, value, resolutionContext, parsedQuery);
      
      default:
        console.warn(chalk.yellow(`⚠️  Unknown resolution reason: ${reason}`));
        return null;
    }
  }

  /**
   * Resolve ambiguous references like "John's"
   */
  async resolveAmbiguousReference(type, value, resolutionContext, parsedQuery) {
    // Handle possessive references (John's → John)
    if (value.endsWith("'s")) {
      const baseName = value.slice(0, -2);
      return await this.resolvePossessiveReference(type, baseName, resolutionContext, parsedQuery);
    }

    // Handle pronouns and demonstratives
    if (['he', 'she', 'they', 'it', 'this', 'that', 'here', 'there'].includes(value.toLowerCase())) {
      return await this.resolvePronouns(type, value, resolutionContext, parsedQuery);
    }

    return null;
  }

  /**
   * Resolve implicit references like "current_location"
   */
  async resolveImplicitReference(type, value, resolutionContext, parsedQuery) {
    switch (value) {
      case 'current_location':
        if (resolutionContext.currentLocation) {
          return {
            type: 'location',
            originalValue: 'current_location',
            resolvedEntity: {
              name: resolutionContext.currentLocation,
              type: 'current_location',
              confidence: 0.9
            },
            confidence: 0.9,
            method: 'implicit_context'
          };
        }
        break;
      
      case 'current_project':
        if (resolutionContext.currentProject) {
          return {
            type: 'project',
            originalValue: 'current_project',
            resolvedEntity: {
              name: resolutionContext.currentProject,
              type: 'active_project',
              confidence: 0.9
            },
            confidence: 0.9,
            method: 'implicit_context'
          };
        }
        break;
    }

    return null;
  }

  /**
   * Resolve possessive references like "John" from "John's"
   */
  async resolvePossessiveReference(type, baseName, resolutionContext, parsedQuery) {
    // Find entities matching the base name
    const matchingEntities = await this.findEntitiesByName(baseName, resolutionContext.domain);
    
    if (matchingEntities.length === 0) {
      return null;
    }

    // If multiple matches, try to disambiguate using context
    let bestMatch = matchingEntities[0];
    if (matchingEntities.length > 1) {
      bestMatch = await this.disambiguateEntities(matchingEntities, resolutionContext, parsedQuery);
    }

    // Find related entities (what John owns/manages/works on)
    const relatedEntities = await this.findRelatedEntities(bestMatch, ['owns', 'manages', 'located_at', 'works_on']);

    return {
      type: 'person',
      originalValue: baseName + "'s",
      resolvedEntity: {
        name: bestMatch.name || baseName,
        role: bestMatch.role,
        confidence: bestMatch.confidence || 0.8
      },
      relatedEntities: relatedEntities,
      confidence: bestMatch.confidence || 0.8,
      method: 'possessive_resolution'
    };
  }

  /**
   * Resolve pronouns using recent context
   */
  async resolvePronouns(type, value, resolutionContext, parsedQuery) {
    // This would typically use conversation history or recent entity mentions
    // For now, return a placeholder resolution
    return {
      type: type,
      originalValue: value,
      resolvedEntity: null,
      confidence: 0.3,
      method: 'pronoun_resolution',
      note: 'Pronoun resolution requires conversation history'
    };
  }

  /**
   * Find entities by name across the domain
   */
  async findEntitiesByName(name, domain) {
    const entities = await this.getAllEntities(domain);
    const matches = [];

    for (const entity of entities) {
      // Check people
      if (entity.entities?.people) {
        for (const person of entity.entities.people) {
          if (person.name && this.nameMatches(person.name, name)) {
            matches.push({
              ...person,
              entityId: entity.id,
              entityType: 'person',
              sourceEntity: entity
            });
          }
        }
      }

      // Check projects
      if (entity.entities?.projects) {
        for (const project of entity.entities.projects) {
          if (project.name && this.nameMatches(project.name, name)) {
            matches.push({
              ...project,
              entityId: entity.id,
              entityType: 'project',
              sourceEntity: entity
            });
          }
        }
      }

      // Check locations
      if (entity.entities?.locations) {
        for (const location of entity.entities.locations) {
          if (location.name && this.nameMatches(location.name, name)) {
            matches.push({
              ...location,
              entityId: entity.id,
              entityType: 'location',
              sourceEntity: entity
            });
          }
        }
      }
    }

    return matches;
  }

  /**
   * Check if two names match (fuzzy matching)
   */
  nameMatches(fullName, searchName) {
    const full = fullName.toLowerCase().trim();
    const search = searchName.toLowerCase().trim();
    
    // Exact match
    if (full === search) return true;
    
    // First name match
    if (full.split(' ')[0] === search) return true;
    
    // Contains match
    if (full.includes(search) || search.includes(full)) return true;
    
    return false;
  }

  /**
   * Disambiguate between multiple entity matches
   */
  async disambiguateEntities(entities, resolutionContext, parsedQuery) {
    // Simple disambiguation: prefer entities from current project/location
    for (const entity of entities) {
      if (resolutionContext.currentProject && 
          entity.sourceEntity?.entities?.projects?.some(p => 
            p.name === resolutionContext.currentProject)) {
        return entity;
      }
    }

    // Fallback: return the first match
    return entities[0];
  }

  /**
   * Find entities related to a given entity
   */
  async findRelatedEntities(entity, relationshipTypes) {
    if (!this.relationshipGraph) {
      await this.buildRelationshipGraph();
    }

    const relatedEntities = [];
    const entityId = entity.entityId;

    if (this.relationshipGraph.nodes.has(entityId)) {
      // Find outgoing relationships
      for (const edge of this.relationshipGraph.edges) {
        if (edge.source === entityId && relationshipTypes.includes(edge.type)) {
          const targetNode = this.relationshipGraph.nodes.get(edge.target);
          if (targetNode) {
            relatedEntities.push({
              relationship: edge.type,
              entity: targetNode,
              confidence: edge.confidence
            });
          }
        }
      }
    }

    return relatedEntities;
  }

  /**
   * Gather contextual information using relationship graph
   */
  async gatherContextualInformation(resolvedContext, resolutionContext) {
    const contextualInfo = [];

    // For each resolved entity, gather related information
    for (const resolution of resolvedContext.resolvedReferences) {
      if (resolution.relatedEntities) {
        for (const related of resolution.relatedEntities) {
          contextualInfo.push({
            type: 'relationship',
            description: `${resolution.resolvedEntity.name} ${related.relationship} ${related.entity.name || related.entity.id}`,
            confidence: related.confidence,
            entities: [resolution.resolvedEntity, related.entity]
          });
        }
      }
    }

    // Add domain-specific contextual information
    if (resolutionContext.domain === 'construction') {
      await this.addConstructionContext(contextualInfo, resolvedContext, resolutionContext);
    }

    return contextualInfo;
  }

  /**
   * Add construction-specific contextual information
   */
  async addConstructionContext(contextualInfo, resolvedContext, resolutionContext) {
    // Add project-location relationships
    const projects = resolvedContext.entities.projects || [];
    const locations = resolvedContext.entities.locations || [];

    for (const project of projects) {
      for (const location of locations) {
        contextualInfo.push({
          type: 'domain_context',
          description: `Project "${project.name}" may be located at "${location.name}"`,
          confidence: 0.6,
          entities: [project, location]
        });
      }
    }

    // Add cost context for financial queries
    const amounts = resolvedContext.entities.amounts || [];
    if (amounts.length > 0) {
      contextualInfo.push({
        type: 'financial_context',
        description: `Financial transaction involving ${amounts.map(a => `$${a.value}`).join(', ')}`,
        confidence: 0.8,
        entities: amounts
      });
    }
  }

  /**
   * Calculate overall resolution confidence
   */
  calculateResolutionConfidence(resolvedContext, parsedQuery) {
    let totalConfidence = parsedQuery.metadata.confidence || 0.5;
    let confidenceCount = 1;

    // Factor in resolution confidences
    for (const resolution of resolvedContext.resolvedReferences) {
      totalConfidence += resolution.confidence;
      confidenceCount++;
    }

    // Factor in contextual information confidence
    for (const info of resolvedContext.contextualInformation) {
      totalConfidence += info.confidence * 0.5; // Weight contextual info less
      confidenceCount++;
    }

    return totalConfidence / confidenceCount;
  }

  /**
   * Refresh entity cache
   */
  async refreshEntityCache() {
    const cacheAge = this.lastCacheUpdate ? Date.now() - this.lastCacheUpdate : Infinity;
    
    // Refresh cache if older than 5 minutes
    if (cacheAge > 5 * 60 * 1000) {
      console.log(chalk.gray('🔄 Refreshing entity cache...'));
      this.entityCache.clear();
      this.relationshipGraph = null;
      this.lastCacheUpdate = Date.now();
    }
  }

  /**
   * Get all entities for a domain
   */
  async getAllEntities(domain) {
    const cacheKey = `entities_${domain}`;
    
    if (this.entityCache.has(cacheKey)) {
      return this.entityCache.get(cacheKey);
    }

    const entities = [];
    const entitiesPath = path.join(this.dataPath, domain, 'entities');

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
      console.warn(chalk.yellow(`⚠️  Could not load entities for domain ${domain}: ${error.message}`));
    }

    this.entityCache.set(cacheKey, entities);
    return entities;
  }

  /**
   * Build relationship graph from entities
   */
  async buildRelationshipGraph() {
    const entities = await this.getAllEntities(this.domain);
    this.relationshipGraph = RelationshipGraph.buildGraph(entities);
    console.log(chalk.gray(`📊 Built relationship graph: ${this.relationshipGraph.nodes.size} nodes, ${this.relationshipGraph.edges.length} edges`));
  }
}

export { ContextResolver };
