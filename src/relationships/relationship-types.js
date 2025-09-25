/**
 * Relationship Type Registry
 * 
 * Defines all supported relationship types with validation rules,
 * domain inheritance, and cardinality constraints.
 */

// Universal Relationship Types (Cross-Domain)
const UNIVERSAL_RELATIONSHIPS = {
  // Functional Relationships
  uses: {
    label: 'Uses',
    description: '[Actor] uses [Tool/Resource]',
    domains: ['universal'],
    cardinality: 'many-to-many',
    inverse: 'used_by',
    validation: {
      sourceTypes: ['person', 'organization', 'system'],
      targetTypes: ['tool', 'resource', 'system', 'material'],
      required: ['confidence', 'source']
    }
  },
  
  manages: {
    label: 'Manages',
    description: '[Person] manages [Project/System/Resource]',
    domains: ['universal'],
    cardinality: 'one-to-many',
    inverse: 'managed_by',
    validation: {
      sourceTypes: ['person'],
      targetTypes: ['project', 'system', 'resource', 'organization'],
      required: ['confidence', 'source']
    }
  },
  
  responsible_for: {
    label: 'Responsible For',
    description: '[Person] responsible_for [Task/Outcome/Area]',
    domains: ['universal'],
    cardinality: 'many-to-many',
    inverse: 'responsibility_of',
    validation: {
      sourceTypes: ['person'],
      targetTypes: ['task', 'project', 'area', 'outcome'],
      required: ['confidence', 'source']
    }
  },
  
  assigned_to: {
    label: 'Assigned To',
    description: '[Task/Project] assigned_to [Person]',
    domains: ['universal'],
    cardinality: 'many-to-one',
    inverse: 'assignee_of',
    validation: {
      sourceTypes: ['task', 'project'],
      targetTypes: ['person'],
      required: ['confidence', 'source']
    }
  },
  
  // Spatial Relationships
  located_at: {
    label: 'Located At',
    description: '[Entity] located_at [Location]',
    domains: ['universal'],
    cardinality: 'many-to-one',
    inverse: 'location_of',
    validation: {
      sourceTypes: ['person', 'asset', 'project', 'organization'],
      targetTypes: ['location', 'address', 'property'],
      required: ['confidence', 'source']
    }
  },
  
  belongs_to: {
    label: 'Belongs To',
    description: '[Asset/Location] belongs_to [Owner/Organization]',
    domains: ['universal'],
    cardinality: 'many-to-one',
    inverse: 'owner_of',
    validation: {
      sourceTypes: ['asset', 'location', 'property', 'system'],
      targetTypes: ['person', 'organization'],
      required: ['confidence', 'source']
    }
  },
  
  contains: {
    label: 'Contains',
    description: '[Container] contains [Content]',
    domains: ['universal'],
    cardinality: 'one-to-many',
    inverse: 'contained_in',
    validation: {
      sourceTypes: ['location', 'system', 'project'],
      targetTypes: ['asset', 'component', 'subsystem'],
      required: ['confidence', 'source']
    }
  },
  
  // Temporal Relationships
  configured_on: {
    label: 'Configured On',
    description: '[System/Project] configured_on [Date]',
    domains: ['universal'],
    cardinality: 'many-to-one',
    temporal: true,
    validation: {
      sourceTypes: ['system', 'project'],
      targetTypes: ['date', 'timestamp'],
      required: ['confidence', 'source', 'timestamp']
    }
  },
  
  active_during: {
    label: 'Active During',
    description: '[Project/Event] active_during [TimeRange]',
    domains: ['universal'],
    cardinality: 'many-to-one',
    temporal: true,
    validation: {
      sourceTypes: ['project', 'event', 'task'],
      targetTypes: ['timerange', 'period'],
      required: ['confidence', 'source', 'start_date']
    }
  },
  
  // Ownership/Authority
  owns: {
    label: 'Owns',
    description: '[Person/Organization] owns [Asset/Property]',
    domains: ['universal'],
    cardinality: 'many-to-many',
    inverse: 'owned_by',
    validation: {
      sourceTypes: ['person', 'organization'],
      targetTypes: ['asset', 'property', 'system'],
      required: ['confidence', 'source']
    }
  },
  
  reports_to: {
    label: 'Reports To',
    description: '[Person] reports_to [Person/Organization]',
    domains: ['universal'],
    cardinality: 'many-to-one',
    inverse: 'supervisor_of',
    validation: {
      sourceTypes: ['person'],
      targetTypes: ['person', 'organization'],
      required: ['confidence', 'source']
    }
  }
};

// Cybersecurity Domain Relationships
const CYBERSEC_RELATIONSHIPS = {
  // Technical Relationships
  deployed_in: {
    label: 'Deployed In',
    description: '[Security Tool] deployed_in [Network/Environment]',
    domains: ['cybersec'],
    cardinality: 'many-to-many',
    inverse: 'deployment_of',
    validation: {
      sourceTypes: ['security_tool', 'system'],
      targetTypes: ['network', 'environment', 'infrastructure'],
      required: ['confidence', 'source']
    }
  },
  
  integrates_with: {
    label: 'Integrates With',
    description: '[System A] integrates_with [System B]',
    domains: ['cybersec'],
    cardinality: 'many-to-many',
    bidirectional: true,
    validation: {
      sourceTypes: ['system', 'security_tool', 'platform'],
      targetTypes: ['system', 'security_tool', 'platform'],
      required: ['confidence', 'source']
    }
  },
  
  monitors: {
    label: 'Monitors',
    description: '[Monitoring System] monitors [Target System/Network]',
    domains: ['cybersec'],
    cardinality: 'one-to-many',
    inverse: 'monitored_by',
    validation: {
      sourceTypes: ['monitoring_system', 'siem', 'security_tool'],
      targetTypes: ['system', 'network', 'asset'],
      required: ['confidence', 'source']
    }
  },
  
  alerts_to: {
    label: 'Alerts To',
    description: '[System] alerts_to [Person/Team]',
    domains: ['cybersec'],
    cardinality: 'many-to-many',
    inverse: 'receives_alerts_from',
    validation: {
      sourceTypes: ['system', 'security_tool', 'monitoring_system'],
      targetTypes: ['person', 'team', 'organization'],
      required: ['confidence', 'source']
    }
  },
  
  protects: {
    label: 'Protects',
    description: '[Security Control] protects [Asset/System]',
    domains: ['cybersec'],
    cardinality: 'many-to-many',
    inverse: 'protected_by',
    validation: {
      sourceTypes: ['security_control', 'security_tool', 'system'],
      targetTypes: ['asset', 'system', 'network'],
      required: ['confidence', 'source']
    }
  },
  
  // Operational Relationships
  escalates_to: {
    label: 'Escalates To',
    description: '[Alert/Incident] escalates_to [Person/Team]',
    domains: ['cybersec'],
    cardinality: 'many-to-one',
    inverse: 'escalation_target_for',
    validation: {
      sourceTypes: ['alert', 'incident', 'event'],
      targetTypes: ['person', 'team'],
      required: ['confidence', 'source']
    }
  },
  
  investigates: {
    label: 'Investigates',
    description: '[Person] investigates [Incident/Alert]',
    domains: ['cybersec'],
    cardinality: 'many-to-many',
    inverse: 'investigated_by',
    validation: {
      sourceTypes: ['person'],
      targetTypes: ['incident', 'alert', 'event'],
      required: ['confidence', 'source']
    }
  },
  
  remediates: {
    label: 'Remediates',
    description: '[Person/System] remediates [Vulnerability/Issue]',
    domains: ['cybersec'],
    cardinality: 'many-to-many',
    inverse: 'remediated_by',
    validation: {
      sourceTypes: ['person', 'system', 'security_tool'],
      targetTypes: ['vulnerability', 'issue', 'incident'],
      required: ['confidence', 'source']
    }
  }
};

// Construction Domain Relationships
const CONSTRUCTION_RELATIONSHIPS = {
  // Physical Relationships
  installed_in: {
    label: 'Installed In',
    description: '[Component] installed_in [Structure/Location]',
    domains: ['construction'],
    cardinality: 'many-to-one',
    inverse: 'installation_of',
    validation: {
      sourceTypes: ['component', 'material', 'system'],
      targetTypes: ['structure', 'location', 'building'],
      required: ['confidence', 'source']
    }
  },
  
  connects_to: {
    label: 'Connects To',
    description: '[System A] connects_to [System B]',
    domains: ['construction'],
    cardinality: 'many-to-many',
    bidirectional: true,
    validation: {
      sourceTypes: ['system', 'component', 'infrastructure'],
      targetTypes: ['system', 'component', 'infrastructure'],
      required: ['confidence', 'source']
    }
  },
  
  supports: {
    label: 'Supports',
    description: '[Structure A] supports [Structure B]',
    domains: ['construction'],
    cardinality: 'one-to-many',
    inverse: 'supported_by',
    validation: {
      sourceTypes: ['structure', 'foundation', 'beam'],
      targetTypes: ['structure', 'component', 'system'],
      required: ['confidence', 'source']
    }
  },
  
  requires: {
    label: 'Requires',
    description: '[Task/Component] requires [Material/Tool]',
    domains: ['construction'],
    cardinality: 'many-to-many',
    inverse: 'required_by',
    validation: {
      sourceTypes: ['task', 'component', 'system'],
      targetTypes: ['material', 'tool', 'resource'],
      required: ['confidence', 'source']
    }
  },
  
  // Project Relationships
  phase_of: {
    label: 'Phase Of',
    description: '[Task] phase_of [Project]',
    domains: ['construction'],
    cardinality: 'many-to-one',
    inverse: 'includes_phase',
    validation: {
      sourceTypes: ['task', 'phase', 'milestone'],
      targetTypes: ['project'],
      required: ['confidence', 'source']
    }
  },
  
  precedes: {
    label: 'Precedes',
    description: '[Task A] precedes [Task B]',
    domains: ['construction'],
    cardinality: 'many-to-many',
    inverse: 'follows',
    temporal: true,
    validation: {
      sourceTypes: ['task', 'phase', 'milestone'],
      targetTypes: ['task', 'phase', 'milestone'],
      required: ['confidence', 'source']
    }
  },
  
  inspects: {
    label: 'Inspects',
    description: '[Inspector] inspects [Work/Component]',
    domains: ['construction'],
    cardinality: 'many-to-many',
    inverse: 'inspected_by',
    validation: {
      sourceTypes: ['person'],
      targetTypes: ['work', 'component', 'system'],
      required: ['confidence', 'source']
    }
  },
  
  supplies: {
    label: 'Supplies',
    description: '[Vendor] supplies [Material/Service]',
    domains: ['construction'],
    cardinality: 'many-to-many',
    inverse: 'supplied_by',
    validation: {
      sourceTypes: ['vendor', 'organization'],
      targetTypes: ['material', 'service', 'component'],
      required: ['confidence', 'source']
    }
  }
};

// Combine all relationship types
const ALL_RELATIONSHIPS = {
  ...UNIVERSAL_RELATIONSHIPS,
  ...CYBERSEC_RELATIONSHIPS,
  ...CONSTRUCTION_RELATIONSHIPS
};

/**
 * Relationship validation functions
 */
class RelationshipValidator {
  static validateRelationshipType(type) {
    return ALL_RELATIONSHIPS.hasOwnProperty(type);
  }
  
  static validateRelationship(relationship) {
    const { type, source, target, confidence } = relationship;
    
    if (!this.validateRelationshipType(type)) {
      return { valid: false, error: `Unknown relationship type: ${type}` };
    }
    
    const relationshipDef = ALL_RELATIONSHIPS[type];
    
    // Check required fields if validation rules exist
    if (relationshipDef.validation && relationshipDef.validation.required) {
      for (const field of relationshipDef.validation.required) {
        if (!relationship.hasOwnProperty(field)) {
          return { valid: false, error: `Missing required field: ${field}` };
        }
      }
    }
    
    // Validate confidence range
    if (confidence !== undefined && (confidence < 0 || confidence > 1)) {
      return { valid: false, error: 'Confidence must be between 0 and 1' };
    }
    
    return { valid: true };
  }
  
  static getRelationshipsByDomain(domain) {
    const relationships = {};
    
    for (const [type, def] of Object.entries(ALL_RELATIONSHIPS)) {
      if (def.domains.includes('universal') || def.domains.includes(domain)) {
        relationships[type] = def;
      }
    }
    
    return relationships;
  }
  
  static getInverseRelationship(type) {
    const relationshipDef = ALL_RELATIONSHIPS[type];
    return relationshipDef ? relationshipDef.inverse : null;
  }
  
  static isBidirectional(type) {
    const relationshipDef = ALL_RELATIONSHIPS[type];
    return relationshipDef ? relationshipDef.bidirectional === true : false;
  }
}

export {
  UNIVERSAL_RELATIONSHIPS,
  CYBERSEC_RELATIONSHIPS,
  CONSTRUCTION_RELATIONSHIPS,
  ALL_RELATIONSHIPS,
  RelationshipValidator
};
