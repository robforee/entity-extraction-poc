/**
 * Content-Based Relationship Inference
 * 
 * Analyzes entity content to infer semantic relationships without relying on merge pairs.
 * Uses domain knowledge and heuristics to identify meaningful connections.
 */

import { EntitySchema } from './entity-schema.js';
import { RelationshipValidator } from './relationship-types.js';

class ContentRelationshipInference {
  constructor() {
    this.relationshipRules = this.initializeRelationshipRules();
  }
  
  /**
   * Initialize relationship inference rules
   */
  initializeRelationshipRules() {
    return {
      // Universal rules (cross-domain)
      universal: [
        {
          name: 'person_project_management',
          condition: (entity1, entity2) => this.hasPersonAndProject(entity1, entity2),
          relationship: 'manages',
          confidence: 0.75,
          description: 'Person appears to manage or be involved with project'
        },
        {
          name: 'task_assignment',
          condition: (entity1, entity2) => this.hasTaskAssignment(entity1, entity2),
          relationship: 'assigned_to',
          confidence: 0.85,
          description: 'Task is assigned to specific person'
        },
        {
          name: 'project_location',
          condition: (entity1, entity2) => this.hasProjectLocation(entity1, entity2),
          relationship: 'located_at',
          confidence: 0.70,
          description: 'Project appears to be located at specific location'
        },
        {
          name: 'ownership_relationship',
          condition: (entity1, entity2) => this.hasOwnershipIndicators(entity1, entity2),
          relationship: 'owns',
          confidence: 0.80,
          description: 'Ownership relationship detected'
        }
      ],
      
      // Cybersecurity domain rules
      cybersec: [
        {
          name: 'consultant_responsibility',
          condition: (entity1, entity2) => this.hasConsultantProject(entity1, entity2),
          relationship: 'responsible_for',
          confidence: 0.85,
          description: 'Cybersecurity consultant responsible for project/assessment'
        },
        {
          name: 'security_tool_monitoring',
          condition: (entity1, entity2) => this.hasSecurityMonitoring(entity1, entity2),
          relationship: 'monitors',
          confidence: 0.80,
          description: 'Security tool monitors system or network'
        },
        {
          name: 'system_integration',
          condition: (entity1, entity2) => this.hasSystemIntegration(entity1, entity2),
          relationship: 'integrates_with',
          confidence: 0.75,
          description: 'Systems integrate with each other'
        }
      ],
      
      // Construction domain rules
      construction: [
        {
          name: 'material_requirement',
          condition: (entity1, entity2) => this.hasMaterialRequirement(entity1, entity2),
          relationship: 'requires',
          confidence: 0.80,
          description: 'Project or task requires specific materials'
        },
        {
          name: 'component_installation',
          condition: (entity1, entity2) => this.hasComponentInstallation(entity1, entity2),
          relationship: 'installed_in',
          confidence: 0.85,
          description: 'Component installed in structure or location'
        },
        {
          name: 'vendor_supply',
          condition: (entity1, entity2) => this.hasVendorSupply(entity1, entity2),
          relationship: 'supplies',
          confidence: 0.80,
          description: 'Vendor supplies materials or services'
        }
      ]
    };
  }
  
  /**
   * Infer relationships for a set of entities
   */
  inferRelationships(entities, domain = 'universal') {
    const relationships = [];
    const applicableRules = [
      ...this.relationshipRules.universal,
      ...(this.relationshipRules[domain] || [])
    ];
    
    console.log(`Analyzing ${entities.length} entities with ${applicableRules.length} rules...`);
    
    // Compare each entity with every other entity
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entity1 = entities[i];
        const entity2 = entities[j];
        
        // Apply all applicable rules
        for (const rule of applicableRules) {
          try {
            // Check both directions
            if (rule.condition(entity1, entity2)) {
              relationships.push({
                sourceId: entity1.id,
                targetId: entity2.id,
                type: rule.relationship,
                confidence: rule.confidence,
                source: 'content_inference',
                rule: rule.name,
                description: rule.description,
                metadata: {
                  inferenceRule: rule.name,
                  sourceEntity: this.getEntitySummary(entity1),
                  targetEntity: this.getEntitySummary(entity2)
                }
              });
            }
            
            // Check reverse direction (if rule is not inherently directional)
            if (rule.condition(entity2, entity1) && !this.isDirectionalRule(rule.name)) {
              relationships.push({
                sourceId: entity2.id,
                targetId: entity1.id,
                type: rule.relationship,
                confidence: rule.confidence,
                source: 'content_inference',
                rule: rule.name,
                description: rule.description,
                metadata: {
                  inferenceRule: rule.name,
                  sourceEntity: this.getEntitySummary(entity2),
                  targetEntity: this.getEntitySummary(entity1)
                }
              });
            }
          } catch (error) {
            console.warn(`Error applying rule ${rule.name}:`, error.message);
          }
        }
      }
    }
    
    console.log(`Generated ${relationships.length} potential relationships`);
    return this.deduplicateRelationships(relationships);
  }
  
  /**
   * Check if entity has person and another has project
   */
  hasPersonAndProject(entity1, entity2) {
    const hasPerson1 = entity1.entities?.people?.length > 0;
    const hasProject1 = entity1.entities?.projects?.length > 0;
    const hasPerson2 = entity2.entities?.people?.length > 0;
    const hasProject2 = entity2.entities?.projects?.length > 0;
    
    return (hasPerson1 && hasProject2) || (hasProject1 && hasPerson2);
  }
  
  /**
   * Check for task assignment relationships
   */
  hasTaskAssignment(entity1, entity2) {
    const tasks1 = entity1.entities?.tasks || [];
    const people2 = entity2.entities?.people || [];
    
    for (const task of tasks1) {
      if (task.assigned_to) {
        for (const person of people2) {
          if (person.name && task.assigned_to.toLowerCase().includes(person.name.toLowerCase())) {
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  /**
   * Check for project-location relationships
   */
  hasProjectLocation(entity1, entity2) {
    const projects1 = entity1.entities?.projects || [];
    const locations2 = entity2.entities?.locations || [];
    
    return projects1.length > 0 && locations2.length > 0;
  }
  
  /**
   * Check for ownership indicators
   */
  hasOwnershipIndicators(entity1, entity2) {
    // Look for ownership keywords in metadata or source
    const source1 = entity1.metadata?.source || '';
    const source2 = entity2.metadata?.source || '';
    
    const ownershipKeywords = ['owner', 'owns', 'property', 'deed', 'title'];
    
    return ownershipKeywords.some(keyword => 
      source1.toLowerCase().includes(keyword) || 
      source2.toLowerCase().includes(keyword)
    );
  }
  
  /**
   * Check for cybersecurity consultant-project relationships
   */
  hasConsultantProject(entity1, entity2) {
    const people1 = entity1.entities?.people || [];
    const projects2 = entity2.entities?.projects || [];
    
    const hasConsultant = people1.some(person => 
      person.role && person.role.toLowerCase().includes('consultant')
    );
    
    const hasSecurityProject = projects2.some(project =>
      project.type && (
        project.type.toLowerCase().includes('security') ||
        project.type.toLowerCase().includes('assessment') ||
        project.type.toLowerCase().includes('compliance')
      )
    );
    
    return hasConsultant && hasSecurityProject;
  }
  
  /**
   * Check for security monitoring relationships
   */
  hasSecurityMonitoring(entity1, entity2) {
    const projects1 = entity1.entities?.projects || [];
    const projects2 = entity2.entities?.projects || [];
    
    const hasMonitoringSystem = projects1.some(project =>
      project.name && (
        project.name.toLowerCase().includes('monitoring') ||
        project.name.toLowerCase().includes('siem') ||
        project.name.toLowerCase().includes('detection')
      )
    );
    
    const hasTargetSystem = projects2.some(project =>
      project.type && (
        project.type.toLowerCase().includes('system') ||
        project.type.toLowerCase().includes('network') ||
        project.type.toLowerCase().includes('infrastructure')
      )
    );
    
    return hasMonitoringSystem && hasTargetSystem;
  }
  
  /**
   * Check for system integration relationships
   */
  hasSystemIntegration(entity1, entity2) {
    const projects1 = entity1.entities?.projects || [];
    const projects2 = entity2.entities?.projects || [];
    
    const hasIntegrationKeywords = (projects) => projects.some(project =>
      project.name && (
        project.name.toLowerCase().includes('integration') ||
        project.name.toLowerCase().includes('platform') ||
        project.name.toLowerCase().includes('system')
      )
    );
    
    return hasIntegrationKeywords(projects1) && hasIntegrationKeywords(projects2);
  }
  
  /**
   * Check for material requirement relationships
   */
  hasMaterialRequirement(entity1, entity2) {
    const projects1 = entity1.entities?.projects || [];
    const materials2 = entity2.entities?.materials || [];
    
    return projects1.length > 0 && materials2.length > 0;
  }
  
  /**
   * Check for component installation relationships
   */
  hasComponentInstallation(entity1, entity2) {
    const materials1 = entity1.entities?.materials || [];
    const locations2 = entity2.entities?.locations || [];
    
    const hasComponents = materials1.some(material =>
      material.type && (
        material.type.toLowerCase().includes('component') ||
        material.type.toLowerCase().includes('fixture') ||
        material.type.toLowerCase().includes('system')
      )
    );
    
    return hasComponents && locations2.length > 0;
  }
  
  /**
   * Check for vendor supply relationships
   */
  hasVendorSupply(entity1, entity2) {
    const people1 = entity1.entities?.people || [];
    const materials2 = entity2.entities?.materials || [];
    
    const hasVendor = people1.some(person =>
      person.role && (
        person.role.toLowerCase().includes('vendor') ||
        person.role.toLowerCase().includes('supplier') ||
        person.role.toLowerCase().includes('contractor')
      )
    );
    
    return hasVendor && materials2.length > 0;
  }
  
  /**
   * Check if rule is inherently directional
   */
  isDirectionalRule(ruleName) {
    const directionalRules = [
      'task_assignment',
      'consultant_responsibility',
      'security_tool_monitoring',
      'material_requirement',
      'component_installation',
      'vendor_supply'
    ];
    
    return directionalRules.includes(ruleName);
  }
  
  /**
   * Get entity summary for metadata
   */
  getEntitySummary(entity) {
    const summary = {
      id: entity.id,
      domain: entity.domain
    };
    
    if (entity.entities) {
      Object.keys(entity.entities).forEach(category => {
        if (Array.isArray(entity.entities[category]) && entity.entities[category].length > 0) {
          summary[category] = entity.entities[category].length;
        }
      });
    }
    
    return summary;
  }
  
  /**
   * Remove duplicate relationships
   */
  deduplicateRelationships(relationships) {
    const seen = new Set();
    const deduplicated = [];
    
    for (const rel of relationships) {
      const key = `${rel.sourceId}|${rel.targetId}|${rel.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(rel);
      }
    }
    
    console.log(`Deduplicated ${relationships.length} relationships to ${deduplicated.length}`);
    return deduplicated;
  }
  
  /**
   * Apply inferred relationships to entities
   */
  async applyRelationshipsToEntities(entities, relationships) {
    const entityMap = new Map(entities.map(e => [e.id, e]));
    let appliedCount = 0;
    
    for (const rel of relationships) {
      const sourceEntity = entityMap.get(rel.sourceId);
      if (sourceEntity) {
        try {
          EntitySchema.addRelationship(sourceEntity, {
            type: rel.type,
            target: rel.targetId,
            confidence: rel.confidence,
            source: rel.source,
            metadata: rel.metadata
          });
          appliedCount++;
        } catch (error) {
          console.warn(`Failed to apply relationship ${rel.type} from ${rel.sourceId} to ${rel.targetId}:`, error.message);
        }
      }
    }
    
    console.log(`Applied ${appliedCount} relationships to entities`);
    return entities;
  }
}

export { ContentRelationshipInference };
