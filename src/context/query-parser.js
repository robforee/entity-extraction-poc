/**
 * Natural Language Query Parser
 * 
 * Parses natural language queries to extract intent, entities, and context requirements.
 * Handles complex queries like "I'm at John's, add a $30 charge for more screws".
 */

import { LLMClient } from '../utils/llm-client.js';
import chalk from 'chalk';

class QueryParser {
  constructor(options = {}) {
    this.client = new LLMClient();
    this.provider = options.provider || 'openai';
    this.model = options.model || 'gpt-4o-mini';
    this.domain = options.domain || 'construction';
    
    // Query intent patterns
    this.intentPatterns = this.initializeIntentPatterns();
  }

  /**
   * Initialize intent recognition patterns
   */
  initializeIntentPatterns() {
    return {
      // Financial operations
      add_charge: {
        patterns: ['add.*charge', 'charge.*for', 'bill.*for', 'add.*cost', 'expense.*for'],
        entities: ['person', 'location', 'amount', 'item', 'project'],
        context_required: ['location', 'project', 'person']
      },
      
      // Task management
      assign_task: {
        patterns: ['assign.*to', 'give.*task', 'need.*to.*do', 'schedule.*for'],
        entities: ['person', 'task', 'deadline', 'project'],
        context_required: ['person', 'project']
      },
      
      // Status inquiries
      check_status: {
        patterns: ['what.*status', 'how.*going', 'progress.*on', 'update.*on'],
        entities: ['project', 'task', 'person', 'timeline'],
        context_required: ['project']
      },
      
      // Location-based queries
      location_query: {
        patterns: ['at.*location', 'I\'m at', 'here at', 'on site'],
        entities: ['location', 'person', 'project'],
        context_required: ['location']
      },
      
      // Material/supply queries
      material_request: {
        patterns: ['need.*materials', 'order.*supplies', 'get.*more', 'buy.*for'],
        entities: ['material', 'quantity', 'project', 'vendor'],
        context_required: ['project', 'material']
      },
      
      // Timeline queries
      schedule_query: {
        patterns: ['when.*will', 'schedule.*for', 'timeline.*for', 'deadline.*for'],
        entities: ['project', 'task', 'person', 'date'],
        context_required: ['project']
      }
    };
  }

  /**
   * Parse a natural language query
   */
  async parseQuery(query, options = {}) {
    const {
      userId = 'unknown',
      currentLocation = null,
      currentProject = null,
      domain = this.domain
    } = options;

    console.log(chalk.blue(`🔍 Parsing query: "${query}"`));

    try {
      // Step 1: Extract entities and intent using LLM
      const extractionResult = await this.extractQueryComponents(query, domain);
      
      // Step 2: Identify intent using pattern matching
      const intent = this.identifyIntent(query, extractionResult);
      
      // Step 3: Determine context requirements
      const contextRequirements = this.determineContextRequirements(intent, extractionResult);
      
      // Step 4: Build parsed query structure
      const parsedQuery = {
        originalQuery: query,
        intent: intent,
        entities: extractionResult.entities,
        contextRequirements: contextRequirements,
        metadata: {
          userId,
          currentLocation,
          currentProject,
          domain,
          confidence: extractionResult.confidence,
          timestamp: new Date().toISOString()
        }
      };

      console.log(chalk.green(`✅ Query parsed - Intent: ${intent.type}, Entities: ${Object.keys(extractionResult.entities).length}`));
      
      return parsedQuery;

    } catch (error) {
      console.error(chalk.red(`❌ Query parsing failed: ${error.message}`));
      throw new Error(`Failed to parse query: ${error.message}`);
    }
  }

  /**
   * Extract query components using LLM
   */
  async extractQueryComponents(query, domain) {
    const prompt = this.buildExtractionPrompt(query, domain);
    
    const result = await this.client.generateCompletion(prompt, {
      provider: this.provider,
      model: this.model,
      maxTokens: 1000,
      temperature: 0.1,
      systemPrompt: this.getSystemPrompt(domain)
    });

    return this.parseExtractionResponse(result.content);
  }

  /**
   * Build extraction prompt for LLM
   */
  buildExtractionPrompt(query, domain) {
    return `Analyze this natural language query and extract the key components:

QUERY: "${query}"
DOMAIN: ${domain}

Extract and return JSON with this structure:
{
  "entities": {
    "people": [{"name": "string", "role": "string", "confidence": 0.9}],
    "locations": [{"name": "string", "type": "string", "confidence": 0.9}],
    "amounts": [{"value": 30, "currency": "USD", "confidence": 0.9}],
    "items": [{"name": "string", "category": "string", "confidence": 0.9}],
    "projects": [{"name": "string", "type": "string", "confidence": 0.9}],
    "tasks": [{"description": "string", "type": "string", "confidence": 0.9}],
    "dates": [{"value": "string", "type": "string", "confidence": 0.9}]
  },
  "intent_indicators": [
    "add charge",
    "at location"
  ],
  "context_clues": [
    "I'm at" (indicates current location),
    "add charge" (indicates financial transaction)
  ],
  "confidence": 0.85
}

Focus on:
- People mentioned (names, pronouns, roles)
- Locations (addresses, place names, "here", "at")
- Financial amounts (dollars, costs, charges)
- Items/materials (tools, supplies, materials)
- Actions/intents (add, charge, schedule, assign)
- Time references (dates, deadlines, "now", "today")

Return only valid JSON.`;
  }

  /**
   * Get system prompt for extraction
   */
  getSystemPrompt(domain) {
    return `You are an expert natural language query analyzer for ${domain} project management.

Your task is to extract structured information from conversational queries that people use when managing projects. These queries often contain:
- Implicit context (location, current project)
- Informal references ("John's place", "more screws")
- Action intents (billing, scheduling, task assignment)
- Relationship implications (who works where, what belongs to what project)

Be precise in entity extraction and confident in your assessments.`;
  }

  /**
   * Parse LLM extraction response
   */
  parseExtractionResponse(content) {
    try {
      // Clean and parse JSON response
      let cleanContent = content.trim();
      cleanContent = cleanContent.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      const jsonStart = cleanContent.indexOf('{');
      const jsonEnd = cleanContent.lastIndexOf('}') + 1;
      
      if (jsonStart === -1 || jsonEnd === 0) {
        throw new Error('No JSON found in response');
      }
      
      const parsed = JSON.parse(cleanContent.substring(jsonStart, jsonEnd));
      
      // Ensure required structure
      return {
        entities: parsed.entities || {},
        intentIndicators: parsed.intent_indicators || [],
        contextClues: parsed.context_clues || [],
        confidence: parsed.confidence || 0.5
      };
      
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Failed to parse extraction response: ${error.message}`));
      return {
        entities: {},
        intentIndicators: [],
        contextClues: [],
        confidence: 0.3
      };
    }
  }

  /**
   * Identify intent using pattern matching and LLM results
   */
  identifyIntent(query, extractionResult) {
    const queryLower = query.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;

    // Pattern-based intent recognition
    for (const [intentType, config] of Object.entries(this.intentPatterns)) {
      let score = 0;
      
      // Check pattern matches
      for (const pattern of config.patterns) {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(query)) {
          score += 2;
        }
      }
      
      // Check intent indicators from LLM
      for (const indicator of extractionResult.intentIndicators) {
        if (config.patterns.some(pattern => {
          const regex = new RegExp(pattern, 'i');
          return regex.test(indicator);
        })) {
          score += 1;
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          type: intentType,
          confidence: Math.min(score / 3, 1.0),
          patterns_matched: config.patterns.filter(pattern => {
            const regex = new RegExp(pattern, 'i');
            return regex.test(query);
          })
        };
      }
    }

    return bestMatch || {
      type: 'unknown',
      confidence: 0.1,
      patterns_matched: []
    };
  }

  /**
   * Determine what context is required to resolve the query
   */
  determineContextRequirements(intent, extractionResult) {
    const requirements = {
      required_entities: [],
      optional_entities: [],
      context_resolution_needed: [],
      ambiguities: []
    };

    // Get base requirements from intent pattern
    if (this.intentPatterns[intent.type]) {
      requirements.required_entities = [...this.intentPatterns[intent.type].context_required];
    }

    // Analyze extracted entities for missing context
    const extractedEntityTypes = Object.keys(extractionResult.entities).filter(
      type => extractionResult.entities[type].length > 0
    );

    // Check for ambiguous references
    for (const [entityType, entities] of Object.entries(extractionResult.entities)) {
      for (const entity of entities) {
        if (entity.name && this.isAmbiguousReference(entity.name)) {
          requirements.context_resolution_needed.push({
            type: entityType,
            value: entity.name,
            reason: 'ambiguous_reference'
          });
        }
      }
    }

    // Check for implicit location references
    if (extractionResult.contextClues.some(clue => clue.includes("I'm at") || clue.includes("here"))) {
      if (!extractedEntityTypes.includes('locations')) {
        requirements.context_resolution_needed.push({
          type: 'location',
          value: 'current_location',
          reason: 'implicit_reference'
        });
      }
    }

    // Check for missing required entities
    for (const requiredType of requirements.required_entities) {
      if (!extractedEntityTypes.includes(requiredType + 's')) { // Handle plural forms
        requirements.ambiguities.push({
          type: requiredType,
          reason: 'missing_required_entity'
        });
      }
    }

    return requirements;
  }

  /**
   * Check if a reference is ambiguous and needs context resolution
   */
  isAmbiguousReference(reference) {
    const ambiguousPatterns = [
      /^(he|she|they|it)$/i,
      /^(here|there)$/i,
      /^(this|that)$/i,
      /^(the\s+\w+)$/i,
      /^\w+\'s$/i, // Possessive names like "John's"
    ];

    return ambiguousPatterns.some(pattern => pattern.test(reference.trim()));
  }

  /**
   * Get query complexity score
   */
  getQueryComplexity(parsedQuery) {
    let complexity = 0;
    
    // Count entities
    const entityCount = Object.values(parsedQuery.entities)
      .reduce((sum, entities) => sum + entities.length, 0);
    complexity += entityCount;
    
    // Count context requirements
    complexity += parsedQuery.contextRequirements.context_resolution_needed.length * 2;
    complexity += parsedQuery.contextRequirements.ambiguities.length * 3;
    
    // Intent complexity
    if (parsedQuery.intent.type === 'unknown') {
      complexity += 5;
    }
    
    return {
      score: complexity,
      level: complexity < 3 ? 'simple' : complexity < 8 ? 'moderate' : 'complex'
    };
  }
}

export { QueryParser };
