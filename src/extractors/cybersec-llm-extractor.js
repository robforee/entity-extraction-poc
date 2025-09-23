import { CloudLLMExtractor } from './cloud-llm-extractor.js';
import chalk from 'chalk';

/**
 * Cybersecurity-specific LLM Entity Extractor
 * 
 * Extends the CloudLLMExtractor with cybersecurity-focused prompts and entity types.
 */
export class CybersecLLMExtractor extends CloudLLMExtractor {
    constructor(options = {}) {
        super(options);
        // Override the prompt template for cybersecurity domain
    }

    getSystemPrompt() {
        return `You are an expert entity extraction system specialized in cybersecurity documents and communications.

Your task is to analyze cybersecurity text and extract structured entities in JSON format. Focus on security roles, threats, tools, processes, and compliance requirements. Be conservative and only extract entities you are confident about. Use consistent naming and include confidence scores for each entity.

Always return valid JSON that matches the specified schema. Do not include any explanatory text, only the JSON response.`;
    }

    getDefaultPrompt() {
        return `You are an expert entity extraction system for cybersecurity documents and communications.

Extract entities from the following categories:

**PEOPLE**: Security professionals, analysts, managers, incident responders
- name: Full name or role title
- role: Job title or function (e.g., "SOC Analyst", "CISO", "Security Engineer")
- confidence: 0.0-1.0

**PROJECTS**: Security initiatives, implementations, assessments
- name: Project name or initiative
- type: Project type (e.g., "Security Assessment", "Tool Implementation", "Compliance Initiative")
- phase: Current phase (e.g., "Planning", "Implementation", "Monitoring")
- confidence: 0.0-1.0

**DECISIONS**: Security decisions, policy changes, risk acceptances
- type: Decision type (e.g., "Policy", "Risk Acceptance", "Tool Selection")
- description: What was decided
- date: When decided (if mentioned)
- confidence: 0.0-1.0

**TIMELINE**: Security events, incidents, deadlines, milestones
- event: What happened or needs to happen
- status: Current status (e.g., "Completed", "In Progress", "Planned")
- date: When it occurred or is due
- confidence: 0.0-1.0

**LOCATIONS**: Data centers, offices, network segments, cloud regions
- name: Location name
- type: Location type (e.g., "Data Center", "Office", "Cloud Region")
- confidence: 0.0-1.0

**MATERIALS**: Security tools, software, hardware, documentation
- name: Tool or material name
- type: Category (e.g., "SIEM", "Firewall", "Documentation", "Scanner")
- status: Current status (e.g., "Active", "Planned", "Deprecated")
- confidence: 0.0-1.0

**COSTS**: Security budgets, tool costs, incident costs
- amount: Dollar amount or budget
- category: What the cost is for (e.g., "Tool License", "Training", "Incident Response")
- confidence: 0.0-1.0

**ISSUES**: Security incidents, vulnerabilities, compliance gaps
- description: What the issue is
- severity: Severity level (e.g., "Critical", "High", "Medium", "Low")
- status: Current status (e.g., "Open", "In Progress", "Resolved")
- confidence: 0.0-1.0

**TASKS**: Security tasks, remediation actions, assessments
- description: What needs to be done
- assigned_to: Who is responsible
- due_date: When it's due (if mentioned)
- confidence: 0.0-1.0

**DOCUMENTS**: Security policies, procedures, reports, standards
- name: Document name
- type: Document type (e.g., "Policy", "Procedure", "Report", "Standard")
- status: Current status (e.g., "Active", "Draft", "Under Review")
- confidence: 0.0-1.0

Return a JSON object with these exact keys: people, projects, decisions, timeline, locations, materials, costs, issues, tasks, documents. Each should contain an array of entities with the specified fields.

Example response format:
{
  "people": [
    {
      "name": "SOC Analyst Level 2",
      "role": "Security Operations Center Analyst",
      "confidence": 0.9
    }
  ],
  "projects": [
    {
      "name": "SIEM Implementation",
      "type": "Security Tool Implementation",
      "phase": "Deployment",
      "confidence": 0.8
    }
  ],
  "decisions": [],
  "timeline": [],
  "locations": [],
  "materials": [],
  "costs": [],
  "issues": [],
  "tasks": [],
  "documents": []
}

Your task is to analyze text and extract structured entities in JSON format. Be conservative and only extract entities you are confident about. Use consistent naming and include confidence scores for each entity.

Always return valid JSON that matches the specified schema. Do not include any explanatory text, only the JSON response.`;
    }

    buildPrompt(text, communicationType, context) {
        let prompt = this.getDefaultPrompt();
        
        // Add communication type specific instructions for cybersecurity
        if (communicationType === 'document') {
            prompt += `\n\nThis is a cybersecurity document. Focus on security roles, tools, processes, threats, and compliance requirements. Look for specific job functions, security technologies, and operational procedures.`;
        } else if (communicationType === 'email') {
            prompt += `\n\nThis is a cybersecurity email communication. Pay attention to incident reports, security alerts, and operational communications.`;
        } else if (communicationType === 'incident_report') {
            prompt += `\n\nThis is a security incident report. Focus on timeline events, affected systems, response actions, and lessons learned.`;
        }

        // Add context if provided
        if (context) {
            prompt += `\n\nCONTEXT: ${context}`;
        }

        prompt += `\n\nTEXT TO ANALYZE:\n${text}`;
        
        return prompt;
    }

    validateExtractedEntities(entities) {
        console.log('Debug - Raw entities before validation:', JSON.stringify(entities, null, 2));
        
        // The parent class expects { entities: {...} } but LLM returns entities directly
        // So we need to wrap it properly
        const wrappedEntities = { entities: entities };
        
        try {
            // Use the parent class validation but with cybersecurity-specific adjustments
            const validated = super.validateExtractedEntities(wrappedEntities);
            return validated;
        } catch (error) {
            // If parent validation fails, do our own basic validation
            console.log('Parent validation failed, using custom validation:', error.message);
            return this.customValidation(entities);
        }
        
        // Additional cybersecurity-specific validation
        if (validated.entities.people) {
            validated.entities.people = validated.entities.people.filter(person => {
                // Filter out generic terms that aren't actually people/roles
                const genericTerms = ['system', 'network', 'data', 'security', 'compliance'];
                return !genericTerms.some(term => 
                    person.name && person.name.toLowerCase().includes(term) && 
                    person.name.toLowerCase() === term
                );
            });
        }

        return validated;
    }

    customValidation(entities) {
        // Basic validation for cybersecurity entities
        if (!entities || typeof entities !== 'object') {
            throw new Error('Invalid entities: not an object');
        }

        // Ensure all required categories exist as arrays
        const requiredCategories = ['people', 'projects', 'decisions', 'timeline', 'locations', 'materials', 'costs', 'issues', 'tasks', 'documents'];
        
        const validatedEntities = {};
        requiredCategories.forEach(category => {
            validatedEntities[category] = Array.isArray(entities[category]) ? entities[category] : [];
        });

        // Fix unnamed entities by using description as name for certain categories
        ['issues', 'tasks', 'decisions', 'timeline'].forEach(category => {
            if (validatedEntities[category]) {
                validatedEntities[category] = validatedEntities[category].map(entity => {
                    if (!entity.name && entity.description) {
                        return {
                            ...entity,
                            name: entity.description
                        };
                    }
                    return entity;
                });
            }
        });

        // Filter out invalid people entities
        if (validatedEntities.people) {
            validatedEntities.people = validatedEntities.people.filter(person => {
                const genericTerms = ['system', 'network', 'data', 'security', 'compliance'];
                return person.name && 
                       !genericTerms.some(term => 
                           person.name.toLowerCase().includes(term) && 
                           person.name.toLowerCase() === term
                       );
            });
        }

        console.log(`Custom validation passed: found ${this.countEntities(validatedEntities)} entities`);
        
        return {
            entities: validatedEntities,
            relationships: [],
            summary: `Extracted ${this.countEntities(validatedEntities)} cybersecurity entities`
        };
    }

    countEntities(entities) {
        let count = 0;
        Object.values(entities).forEach(entityList => {
            if (Array.isArray(entityList)) {
                count += entityList.length;
            }
        });
        return count;
    }

    calculateOverallConfidence(entities) {
        let totalEntities = 0;
        let totalConfidence = 0;
        
        Object.values(entities).forEach(entityList => {
            if (Array.isArray(entityList)) {
                entityList.forEach(entity => {
                    if (entity.confidence) {
                        totalEntities++;
                        totalConfidence += entity.confidence;
                    }
                });
            }
        });
        
        return totalEntities > 0 ? totalConfidence / totalEntities : 0;
    }
}

export default CybersecLLMExtractor;
