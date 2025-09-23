/**
 * Entity designation types for hierarchical organization
 */
const ENTITY_TYPES = {
  GENERIC: 'generic',        // "SIEM", "doors", "project management"
  PRODUCT: 'product',        // "Splunk SIEM", "Andersen Windows"  
  INSTANCE: 'instance'       // "Splunk at DataCenter-A", "Door-Room201-Building5"
};

/**
 * Relationship types for semantic connections
 */
const RELATIONSHIP_TYPES = {
  // Functional relationships
  REQUIRES: 'requires',
  USES: 'uses',
  IMPLEMENTS: 'implements',
  PROVIDES: 'provides',
  
  // Hierarchical relationships
  PARENT_OF: 'parent_of',
  CHILD_OF: 'child_of',
  INSTANCE_OF: 'instance_of',
  VARIANT_OF: 'variant_of',
  PART_OF: 'part_of',
  
  // Spatial relationships
  LOCATED_AT: 'located_at',
  CONTAINS: 'contains',
  ADJACENT_TO: 'adjacent_to',
  
  // Temporal relationships
  PRECEDES: 'precedes',
  FOLLOWS: 'follows',
  DEPENDS_ON: 'depends_on',
  SCHEDULED_FOR: 'scheduled_for',
  
  // Project relationships
  ASSIGNED_TO: 'assigned_to',
  SUPPLIES: 'supplies',
  MANAGES: 'manages',
  COLLABORATES_WITH: 'collaborates_with',
  
  // Generic relationships
  CO_OCCURRENCE: 'co_occurrence',
  RELATED_TO: 'related_to'
};

/**
 * Entity categories for domain organization
 */
const ENTITY_CATEGORIES = {
  // Cybersecurity domain
  SECURITY_TOOLS: 'security_tools',
  VULNERABILITIES: 'vulnerabilities',
  THREATS: 'threats',
  POLICIES: 'policies',
  
  // Construction domain
  MATERIALS: 'materials',
  EQUIPMENT: 'equipment',
  CONTRACTORS: 'contractors',
  LOCATIONS: 'locations',
  
  // General domains
  PEOPLE: 'people',
  PROJECTS: 'projects',
  DOCUMENTS: 'documents',
  DECISIONS: 'decisions',
  TIMELINE: 'timeline',
  COSTS: 'costs',
  ISSUES: 'issues',
  TASKS: 'tasks'
};

/**
 * Confidence thresholds for various operations
 */
const CONFIDENCE_THRESHOLDS = {
  AUTO_MERGE: 0.9,
  SUGGEST_MERGE: 0.7,
  RELATIONSHIP_CONFIDENCE: 0.6,
  DISPLAY_MINIMUM: 0.3
};

export {
  ENTITY_TYPES,
  RELATIONSHIP_TYPES,
  ENTITY_CATEGORIES,
  CONFIDENCE_THRESHOLDS
};
