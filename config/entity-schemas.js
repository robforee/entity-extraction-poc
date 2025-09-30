/**
 * Entity schemas for construction project communications
 * 
 * These schemas define the structure and validation rules for entities
 * that can be extracted from construction-related communications like
 * SMS, emails, meeting notes, and project documents.
 */

export const ENTITY_TYPES = {
    // Domain Entities
    PERSON: 'person',
    PROJECT: 'project', 
    DECISION: 'decision',
    TIMELINE: 'timeline',
    LOCATION: 'location',
    MATERIAL: 'material',
    COST: 'cost',
    ISSUE: 'issue',
    TASK: 'task',
    DOCUMENT: 'document',

    // System/Meta Entities
    SOFTWARE_SYSTEM: 'software_system',
    COMMAND_SIGNATURE: 'command_signature',
    COMMAND_EXECUTION: 'command_execution'
};

export const RELATIONSHIP_TYPES = {
    // System Relationships
    INSTANTIATES: 'instantiates', // command_execution -> command_signature
    GENERATES: 'generates',       // command_execution -> any data entity
    USES: 'uses',                 // software_system -> software_system
    OWNED_BY: 'owned_by',         // software_system -> person

    // Domain Relationships (can be expanded)
    MANAGES: 'manages',
    LOCATED_AT: 'located_at',
    ASSIGNED_TO: 'assigned_to',
    OWNS: 'owns',
    HAS_RESIDENT: 'has_resident',
    HAS_PROJECT: 'has_project'
};

export const PERSON_ROLES = {
    OWNER: 'owner',
    CONTRACTOR: 'contractor', 
    ARCHITECT: 'architect',
    ENGINEER: 'engineer',
    SUBCONTRACTOR: 'subcontractor',
    SUPPLIER: 'supplier',
    INSPECTOR: 'inspector',
    DESIGNER: 'designer',
    PROJECT_MANAGER: 'project_manager',
    WORKER: 'worker'
};

export const PROJECT_PHASES = {
    PLANNING: 'planning',
    PERMITS: 'permits',
    SITE_PREP: 'site_preparation',
    FOUNDATION: 'foundation',
    FRAMING: 'framing',
    ROOFING: 'roofing',
    PLUMBING: 'plumbing',
    ELECTRICAL: 'electrical',
    INSULATION: 'insulation',
    DRYWALL: 'drywall',
    FLOORING: 'flooring',
    KITCHEN: 'kitchen',
    BATHROOM: 'bathroom',
    PAINTING: 'painting',
    LANDSCAPING: 'landscaping',
    FINAL_INSPECTION: 'final_inspection',
    CLEANUP: 'cleanup'
};

export const DECISION_TYPES = {
    APPROVAL: 'approval',
    REJECTION: 'rejection',
    CHANGE_ORDER: 'change_order',
    MATERIAL_SELECTION: 'material_selection',
    SCHEDULE_CHANGE: 'schedule_change',
    BUDGET_ADJUSTMENT: 'budget_adjustment',
    DESIGN_MODIFICATION: 'design_modification',
    CONTRACTOR_SELECTION: 'contractor_selection'
};

export const TIMELINE_STATUSES = {
    PLANNED: 'planned',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    DELAYED: 'delayed',
    CANCELLED: 'cancelled',
    ON_HOLD: 'on_hold'
};

export const ISSUE_SEVERITIES = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

export const ENTITY_SCHEMAS = {
    [ENTITY_TYPES.PERSON]: {
        type: 'object',
        required: ['name'],
        properties: {
            name: {
                type: 'string',
                description: 'Full name or commonly used name of the person'
            },
            role: {
                type: 'string',
                enum: Object.values(PERSON_ROLES),
                description: 'Role of the person in the construction project'
            },
            company: {
                type: 'string',
                description: 'Company or organization the person works for'
            },
            contact: {
                type: 'object',
                properties: {
                    phone: { type: 'string' },
                    email: { type: 'string' },
                    address: { type: 'string' }
                }
            },
            specialties: {
                type: 'array',
                items: { type: 'string' },
                description: 'Areas of expertise or specialization'
            },
            confidence: {
                type: 'number',
                minimum: 0,
                maximum: 1,
                description: 'Confidence score for entity extraction accuracy'
            }
        }
    },

    [ENTITY_TYPES.PROJECT]: {
        type: 'object',
        required: ['name'],
        properties: {
            name: {
                type: 'string',
                description: 'Name or description of the project or project component'
            },
            type: {
                type: 'string',
                description: 'Type of project (renovation, new construction, repair, etc.)'
            },
            phase: {
                type: 'string',
                enum: Object.values(PROJECT_PHASES),
                description: 'Current phase of the project'
            },
            location: {
                type: 'string',
                description: 'Physical location or area of the project'
            },
            scope: {
                type: 'string',
                description: 'Detailed scope of work'
            },
            budget: {
                type: 'object',
                properties: {
                    estimated: { type: 'number' },
                    actual: { type: 'number' },
                    currency: { type: 'string', default: 'USD' }
                }
            },
            timeline: {
                type: 'object',
                properties: {
                    start_date: { type: 'string', format: 'date' },
                    end_date: { type: 'string', format: 'date' },
                    duration: { type: 'string' }
                }
            },
            confidence: {
                type: 'number',
                minimum: 0,
                maximum: 1
            }
        }
    },

    [ENTITY_TYPES.DECISION]: {
        type: 'object',
        required: ['type', 'description'],
        properties: {
            type: {
                type: 'string',
                enum: Object.values(DECISION_TYPES),
                description: 'Type of decision made'
            },
            description: {
                type: 'string',
                description: 'Description of what was decided'
            },
            decision_maker: {
                type: 'string',
                description: 'Person who made the decision'
            },
            date: {
                type: 'string',
                description: 'When the decision was made (can be relative like "yesterday")'
            },
            impact: {
                type: 'object',
                properties: {
                    cost: { type: 'number' },
                    schedule: { type: 'string' },
                    scope: { type: 'string' }
                }
            },
            approval_required: {
                type: 'boolean',
                description: 'Whether this decision requires additional approval'
            },
            confidence: {
                type: 'number',
                minimum: 0,
                maximum: 1
            }
        }
    },

    [ENTITY_TYPES.TIMELINE]: {
        type: 'object',
        required: ['event'],
        properties: {
            event: {
                type: 'string',
                description: 'Description of the timeline event or milestone'
            },
            status: {
                type: 'string',
                enum: Object.values(TIMELINE_STATUSES),
                description: 'Current status of the timeline item'
            },
            date: {
                type: 'string',
                description: 'Scheduled or actual date (can be relative)'
            },
            duration: {
                type: 'string',
                description: 'Expected or actual duration'
            },
            dependencies: {
                type: 'array',
                items: { type: 'string' },
                description: 'Other events this depends on'
            },
            responsible_party: {
                type: 'string',
                description: 'Person or company responsible for this timeline item'
            },
            confidence: {
                type: 'number',
                minimum: 0,
                maximum: 1
            }
        }
    },

    [ENTITY_TYPES.LOCATION]: {
        type: 'object',
        required: ['name'],
        properties: {
            name: {
                type: 'string',
                description: 'Name or description of the location'
            },
            type: {
                type: 'string',
                enum: ['room', 'area', 'floor', 'building', 'site', 'address'],
                description: 'Type of location'
            },
            address: {
                type: 'string',
                description: 'Physical address if applicable'
            },
            coordinates: {
                type: 'object',
                properties: {
                    latitude: { type: 'number' },
                    longitude: { type: 'number' }
                }
            },
            confidence: {
                type: 'number',
                minimum: 0,
                maximum: 1
            }
        }
    },

    [ENTITY_TYPES.MATERIAL]: {
        type: 'object',
        required: ['name'],
        properties: {
            name: {
                type: 'string',
                description: 'Name of the material or product'
            },
            category: {
                type: 'string',
                enum: ['lumber', 'concrete', 'steel', 'electrical', 'plumbing', 'roofing', 'flooring', 'fixtures', 'hardware', 'other'],
                description: 'Category of material'
            },
            quantity: {
                type: 'object',
                properties: {
                    amount: { type: 'number' },
                    unit: { type: 'string' }
                }
            },
            specifications: {
                type: 'string',
                description: 'Technical specifications or model numbers'
            },
            supplier: {
                type: 'string',
                description: 'Supplier or manufacturer'
            },
            cost: {
                type: 'object',
                properties: {
                    unit_price: { type: 'number' },
                    total_price: { type: 'number' },
                    currency: { type: 'string', default: 'USD' }
                }
            },
            confidence: {
                type: 'number',
                minimum: 0,
                maximum: 1
            }
        }
    },

    [ENTITY_TYPES.COST]: {
        type: 'object',
        required: ['amount'],
        properties: {
            amount: {
                type: 'number',
                description: 'Cost amount'
            },
            currency: {
                type: 'string',
                default: 'USD',
                description: 'Currency code'
            },
            type: {
                type: 'string',
                enum: ['estimate', 'quote', 'invoice', 'actual', 'budget', 'overrun'],
                description: 'Type of cost'
            },
            category: {
                type: 'string',
                description: 'What the cost is for (labor, materials, permits, etc.)'
            },
            date: {
                type: 'string',
                description: 'Date associated with the cost'
            },
            confidence: {
                type: 'number',
                minimum: 0,
                maximum: 1
            }
        }
    },

    [ENTITY_TYPES.ISSUE]: {
        type: 'object',
        required: ['description'],
        properties: {
            description: {
                type: 'string',
                description: 'Description of the issue or problem'
            },
            severity: {
                type: 'string',
                enum: Object.values(ISSUE_SEVERITIES),
                description: 'Severity level of the issue'
            },
            category: {
                type: 'string',
                enum: ['quality', 'safety', 'schedule', 'budget', 'design', 'regulatory', 'weather', 'other'],
                description: 'Category of issue'
            },
            status: {
                type: 'string',
                enum: ['open', 'in_progress', 'resolved', 'closed'],
                description: 'Current status of the issue'
            },
            reported_by: {
                type: 'string',
                description: 'Person who reported the issue'
            },
            assigned_to: {
                type: 'string',
                description: 'Person responsible for resolving the issue'
            },
            date_reported: {
                type: 'string',
                description: 'When the issue was reported'
            },
            resolution: {
                type: 'string',
                description: 'How the issue was or will be resolved'
            },
            confidence: {
                type: 'number',
                minimum: 0,
                maximum: 1
            }
        }
    },

    [ENTITY_TYPES.TASK]: {
        type: 'object',
        required: ['description'],
        properties: {
            description: {
                type: 'string',
                description: 'Description of the task or action item'
            },
            status: {
                type: 'string',
                enum: ['pending', 'in_progress', 'completed', 'cancelled'],
                description: 'Current status of the task'
            },
            assigned_to: {
                type: 'string',
                description: 'Person responsible for the task'
            },
            due_date: {
                type: 'string',
                description: 'When the task is due'
            },
            priority: {
                type: 'string',
                enum: ['low', 'medium', 'high', 'urgent'],
                description: 'Priority level of the task'
            },
            dependencies: {
                type: 'array',
                items: { type: 'string' },
                description: 'Other tasks this depends on'
            },
            confidence: {
                type: 'number',
                minimum: 0,
                maximum: 1
            }
        }
    },

    [ENTITY_TYPES.DOCUMENT]: {
        type: 'object',
        required: ['name'],
        properties: {
            name: {
                type: 'string',
                description: 'Name or title of the document'
            },
            type: {
                type: 'string',
                enum: ['plan', 'permit', 'contract', 'invoice', 'report', 'specification', 'drawing', 'photo', 'other'],
                description: 'Type of document'
            },
            status: {
                type: 'string',
                enum: ['draft', 'pending_approval', 'approved', 'rejected', 'final'],
                description: 'Status of the document'
            },
            author: {
                type: 'string',
                description: 'Who created or is responsible for the document'
            },
            date: {
                type: 'string',
                description: 'Date the document was created or last modified'
            },
            location: {
                type: 'string',
                description: 'Where the document is stored or can be found'
            },
            confidence: {
                type: 'number',
                minimum: 0,
                maximum: 1
            }
        }
    },

    // --- System/Meta Schemas ---

    [ENTITY_TYPES.SOFTWARE_SYSTEM]: {
        type: 'object',
        required: ['name', 'type'],
        properties: {
            name: {
                type: 'string',
                description: 'Unique name of the software system (e.g., snappy, context-db)'
            },
            type: {
                type: 'string',
                enum: ['repository', 'service', 'database', 'application'],
                description: 'The type of software system'
            },
            description: {
                type: 'string',
                description: 'A brief description of the system\'s purpose'
            }
        }
    },

    [ENTITY_TYPES.COMMAND_SIGNATURE]: {
        type: 'object',
        required: ['name', 'system', 'template'],
        properties: {
            name: {
                type: 'string',
                description: 'A unique, human-readable name for the command (e.g., snappy-project-details)'
            },
            system: {
                type: 'string',
                description: 'The software system this command belongs to (e.g., snappy)'
            },
            template: {
                type: 'string',
                description: 'The command string with placeholders (e.g., node snappy.js project {projectId} --format json)'
            },
            description: {
                type: 'string',
                description: 'A brief description of what the command does'
            }
        }
    },

    [ENTITY_TYPES.COMMAND_EXECUTION]: {
        type: 'object',
        required: ['command_string', 'timestamp', 'status'],
        properties: {
            command_string: {
                type: 'string',
                description: 'The exact command string that was executed'
            },
            timestamp: {
                type: 'string',
                format: 'date-time',
                description: 'ISO 8601 timestamp of when the command was executed'
            },
            status: {
                type: 'string',
                enum: ['success', 'failure'],
                description: 'The execution status of the command'
            },
            output_summary: {
                type: 'string',
                description: 'A summary of the output or error message'
            }
        }
    }
};

/**
 * Validation function for extracted entities
 */
export function validateEntity(entity, entityType) {
    const schema = ENTITY_SCHEMAS[entityType];
    if (!schema) {
        return { valid: false, errors: [`Unknown entity type: ${entityType}`] };
    }

    const errors = [];
    
    // Check required fields
    if (schema.required) {
        for (const field of schema.required) {
            if (!entity.hasOwnProperty(field) || entity[field] === null || entity[field] === undefined) {
                errors.push(`Missing required field: ${field}`);
            }
        }
    }

    // Check enum values
    for (const [field, value] of Object.entries(entity)) {
        const fieldSchema = schema.properties[field];
        if (fieldSchema && fieldSchema.enum && !fieldSchema.enum.includes(value)) {
            errors.push(`Invalid value for ${field}: ${value}. Must be one of: ${fieldSchema.enum.join(', ')}`);
        }
    }

    // Check confidence score
    if (entity.confidence !== undefined) {
        if (typeof entity.confidence !== 'number' || entity.confidence < 0 || entity.confidence > 1) {
            errors.push('Confidence must be a number between 0 and 1');
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Get all possible entity types
 */
export function getEntityTypes() {
    return Object.values(ENTITY_TYPES);
}

/**
 * Get schema for a specific entity type
 */
export function getEntitySchema(entityType) {
    return ENTITY_SCHEMAS[entityType];
}

/**
 * Create a template entity with default values
 */
export function createEntityTemplate(entityType) {
    const schema = ENTITY_SCHEMAS[entityType];
    if (!schema) {
        throw new Error(`Unknown entity type: ${entityType}`);
    }

    const template = { type: entityType };
    
    // Add required fields with empty values
    if (schema.required) {
        for (const field of schema.required) {
            const fieldSchema = schema.properties[field];
            if (fieldSchema.type === 'string') {
                template[field] = '';
            } else if (fieldSchema.type === 'number') {
                template[field] = 0;
            } else if (fieldSchema.type === 'boolean') {
                template[field] = false;
            } else if (fieldSchema.type === 'array') {
                template[field] = [];
            } else if (fieldSchema.type === 'object') {
                template[field] = {};
            }
        }
    }

    // Add confidence score
    template.confidence = 0.0;

    return template;
}

export default {
    ENTITY_TYPES,
    PERSON_ROLES,
    PROJECT_PHASES,
    DECISION_TYPES,
    TIMELINE_STATUSES,
    ISSUE_SEVERITIES,
    ENTITY_SCHEMAS,
    validateEntity,
    getEntityTypes,
    getEntitySchema,
    createEntityTemplate
};
