/**
 * Natural Language Query Processor
 * 
 * Main orchestrator for processing natural language queries.
 * Combines parsing, context resolution, and intent execution.
 */

import { QueryParser } from './query-parser.js';
import { ContextResolver } from './context-resolver.js';
import { EntitySchema } from '../relationships/entity-schema.js';
import chalk from 'chalk';

class QueryProcessor {
  constructor(options = {}) {
    this.parser = new QueryParser(options);
    this.resolver = new ContextResolver(options);
    this.domain = options.domain || 'construction';
    
    // Intent handlers
    this.intentHandlers = this.initializeIntentHandlers();
  }

  /**
   * Initialize intent-specific handlers
   */
  initializeIntentHandlers() {
    return {
      add_charge: this.handleAddCharge.bind(this),
      assign_task: this.handleAssignTask.bind(this),
      check_status: this.handleCheckStatus.bind(this),
      location_query: this.handleLocationQuery.bind(this),
      material_request: this.handleMaterialRequest.bind(this),
      schedule_query: this.handleScheduleQuery.bind(this),
      unknown: this.handleUnknownIntent.bind(this)
    };
  }

  /**
   * Process a natural language query end-to-end
   */
  async processQuery(query, options = {}) {
    const {
      userId = 'unknown',
      currentLocation = null,
      currentProject = null,
      executeActions = false
    } = options;

    console.log(chalk.blue.bold(`🚀 Processing Query: "${query}"`));
    console.log(chalk.blue.bold('=' .repeat(60)));

    const processingResult = {
      originalQuery: query,
      steps: [],
      finalResult: null,
      metadata: {
        userId,
        currentLocation,
        currentProject,
        executeActions,
        startTime: Date.now()
      }
    };

    try {
      // Step 1: Parse the query
      console.log(chalk.cyan('Step 1: Query Parsing'));
      const parsedQuery = await this.parser.parseQuery(query, {
        userId,
        currentLocation,
        currentProject,
        domain: this.domain
      });
      
      processingResult.steps.push({
        step: 'parsing',
        result: parsedQuery,
        success: true,
        duration: Date.now() - processingResult.metadata.startTime
      });

      // Step 2: Resolve context
      console.log(chalk.cyan('Step 2: Context Resolution'));
      const resolvedContext = await this.resolver.resolveContext(parsedQuery, {
        userId,
        currentLocation,
        currentProject
      });
      
      processingResult.steps.push({
        step: 'resolution',
        result: resolvedContext,
        success: true,
        duration: Date.now() - processingResult.metadata.startTime
      });

      // Step 3: Execute intent
      console.log(chalk.cyan('Step 3: Intent Execution'));
      const intentResult = await this.executeIntent(resolvedContext, executeActions);
      
      processingResult.steps.push({
        step: 'execution',
        result: intentResult,
        success: true,
        duration: Date.now() - processingResult.metadata.startTime
      });

      // Final result
      processingResult.finalResult = {
        intent: parsedQuery.intent,
        resolvedContext: resolvedContext.resolvedContext,
        actions: intentResult.actions,
        response: intentResult.response,
        confidence: resolvedContext.metadata.resolutionConfidence,
        executed: executeActions
      };

      processingResult.metadata.totalDuration = Date.now() - processingResult.metadata.startTime;
      processingResult.metadata.success = true;

      console.log(chalk.green.bold(`✅ Query Processing Complete (${processingResult.metadata.totalDuration}ms)`));
      console.log(chalk.green(`   Intent: ${parsedQuery.intent.type} (${(parsedQuery.intent.confidence * 100).toFixed(1)}%)`));
      console.log(chalk.green(`   Actions: ${intentResult.actions.length}`));
      console.log(chalk.green(`   Executed: ${executeActions ? 'Yes' : 'No'}`));

      return processingResult;

    } catch (error) {
      console.error(chalk.red(`❌ Query processing failed: ${error.message}`));
      
      processingResult.steps.push({
        step: 'error',
        error: error.message,
        success: false,
        duration: Date.now() - processingResult.metadata.startTime
      });
      
      processingResult.metadata.success = false;
      processingResult.metadata.error = error.message;
      
      throw error;
    }
  }

  /**
   * Execute the identified intent
   */
  async executeIntent(resolvedContext, executeActions = false) {
    const intent = resolvedContext.originalQuery.intent;
    const handler = this.intentHandlers[intent.type] || this.intentHandlers.unknown;
    
    console.log(chalk.gray(`  🎯 Executing intent: ${intent.type}`));
    
    return await handler(resolvedContext, executeActions);
  }

  /**
   * Handle add_charge intent
   */
  async handleAddCharge(resolvedContext, executeActions) {
    const context = resolvedContext.resolvedContext;
    const actions = [];
    let response = '';

    // Extract charge information
    const amounts = context.entities.amounts || [];
    const items = context.entities.items || [];
    const people = context.entities.people || [];
    const locations = context.entities.locations || [];

    if (amounts.length === 0) {
      response = 'I need to know the amount to charge. Could you specify the cost?';
      return { actions, response, confidence: 0.3 };
    }

    const amount = amounts[0];
    const item = items.length > 0 ? items[0].name : 'unspecified item';
    const person = people.length > 0 ? people[0].name : 'unknown person';
    const location = locations.length > 0 ? locations[0].name : 'unknown location';

    // Create charge action
    const chargeAction = {
      type: 'add_charge',
      amount: amount.value,
      currency: amount.currency || 'USD',
      item: item,
      person: person,
      location: location,
      confidence: amount.confidence,
      metadata: {
        originalQuery: resolvedContext.originalQuery.originalQuery,
        timestamp: new Date().toISOString()
      }
    };

    actions.push(chargeAction);

    if (executeActions) {
      // In a real system, this would create a billing entry
      console.log(chalk.green(`💰 Would create charge: $${amount.value} for ${item} at ${location}`));
      response = `Added $${amount.value} charge for ${item} at ${location}.`;
    } else {
      response = `I would add a $${amount.value} charge for ${item} at ${location}. Confirm to execute.`;
    }

    return {
      actions,
      response,
      confidence: context.confidence
    };
  }

  /**
   * Handle assign_task intent
   */
  async handleAssignTask(resolvedContext, executeActions) {
    const context = resolvedContext.resolvedContext;
    const actions = [];
    let response = '';

    const tasks = context.entities.tasks || [];
    const people = context.entities.people || [];
    const projects = context.entities.projects || [];

    if (tasks.length === 0) {
      response = 'I need to know what task to assign. Could you specify the task?';
      return { actions, response, confidence: 0.3 };
    }

    if (people.length === 0) {
      response = 'I need to know who to assign the task to. Could you specify the person?';
      return { actions, response, confidence: 0.3 };
    }

    const task = tasks[0];
    const person = people[0];
    const project = projects.length > 0 ? projects[0].name : 'current project';

    const assignAction = {
      type: 'assign_task',
      task: task.description || task.name,
      assignee: person.name,
      project: project,
      confidence: Math.min(task.confidence || 0.8, person.confidence || 0.8),
      metadata: {
        originalQuery: resolvedContext.originalQuery.originalQuery,
        timestamp: new Date().toISOString()
      }
    };

    actions.push(assignAction);

    if (executeActions) {
      console.log(chalk.green(`📋 Would assign task "${task.description}" to ${person.name}`));
      response = `Assigned "${task.description}" to ${person.name} for ${project}.`;
    } else {
      response = `I would assign "${task.description}" to ${person.name} for ${project}. Confirm to execute.`;
    }

    return {
      actions,
      response,
      confidence: context.confidence
    };
  }

  /**
   * Handle check_status intent
   */
  async handleCheckStatus(resolvedContext, executeActions) {
    const context = resolvedContext.resolvedContext;
    const actions = [];
    let response = '';

    const projects = context.entities.projects || [];
    const people = context.entities.people || [];

    if (projects.length === 0 && people.length === 0) {
      response = 'I need to know what status to check. Could you specify a project or person?';
      return { actions, response, confidence: 0.3 };
    }

    const statusAction = {
      type: 'check_status',
      target: projects.length > 0 ? projects[0].name : people[0].name,
      targetType: projects.length > 0 ? 'project' : 'person',
      confidence: 0.8,
      metadata: {
        originalQuery: resolvedContext.originalQuery.originalQuery,
        timestamp: new Date().toISOString()
      }
    };

    actions.push(statusAction);

    // Simulate status check using contextual information
    const contextualInfo = context.contextualInformation || [];
    const relevantInfo = contextualInfo.filter(info => 
      info.description.toLowerCase().includes(statusAction.target.toLowerCase())
    );

    if (relevantInfo.length > 0) {
      response = `Status for ${statusAction.target}:\n`;
      relevantInfo.slice(0, 3).forEach(info => {
        response += `• ${info.description}\n`;
      });
    } else {
      response = `I found limited status information for ${statusAction.target}. You may need to check the project management system directly.`;
    }

    return {
      actions,
      response,
      confidence: context.confidence
    };
  }

  /**
   * Handle location_query intent
   */
  async handleLocationQuery(resolvedContext, executeActions) {
    const context = resolvedContext.resolvedContext;
    const actions = [];
    let response = '';

    const locations = context.entities.locations || [];
    const people = context.entities.people || [];
    const projects = context.entities.projects || [];

    const locationAction = {
      type: 'location_context',
      location: locations.length > 0 ? locations[0].name : 'current location',
      people: people.map(p => p.name),
      projects: projects.map(p => p.name),
      confidence: 0.8,
      metadata: {
        originalQuery: resolvedContext.originalQuery.originalQuery,
        timestamp: new Date().toISOString()
      }
    };

    actions.push(locationAction);

    response = `Location context established: ${locationAction.location}`;
    if (people.length > 0) {
      response += `\nPeople: ${people.map(p => p.name).join(', ')}`;
    }
    if (projects.length > 0) {
      response += `\nProjects: ${projects.map(p => p.name).join(', ')}`;
    }

    return {
      actions,
      response,
      confidence: context.confidence
    };
  }

  /**
   * Handle material_request intent
   */
  async handleMaterialRequest(resolvedContext, executeActions) {
    const context = resolvedContext.resolvedContext;
    const actions = [];
    let response = '';

    const materials = context.entities.items || context.entities.materials || [];
    const projects = context.entities.projects || [];
    const amounts = context.entities.amounts || [];

    if (materials.length === 0) {
      response = 'I need to know what materials you need. Could you specify the materials?';
      return { actions, response, confidence: 0.3 };
    }

    const material = materials[0];
    const project = projects.length > 0 ? projects[0].name : 'current project';
    const quantity = amounts.length > 0 ? amounts[0].value : 'unspecified quantity';

    const materialAction = {
      type: 'material_request',
      material: material.name,
      quantity: quantity,
      project: project,
      confidence: material.confidence || 0.8,
      metadata: {
        originalQuery: resolvedContext.originalQuery.originalQuery,
        timestamp: new Date().toISOString()
      }
    };

    actions.push(materialAction);

    if (executeActions) {
      console.log(chalk.green(`📦 Would request ${quantity} ${material.name} for ${project}`));
      response = `Material request created: ${quantity} ${material.name} for ${project}.`;
    } else {
      response = `I would request ${quantity} ${material.name} for ${project}. Confirm to execute.`;
    }

    return {
      actions,
      response,
      confidence: context.confidence
    };
  }

  /**
   * Handle schedule_query intent
   */
  async handleScheduleQuery(resolvedContext, executeActions) {
    const context = resolvedContext.resolvedContext;
    const actions = [];
    let response = '';

    const projects = context.entities.projects || [];
    const dates = context.entities.dates || [];
    const people = context.entities.people || [];

    const scheduleAction = {
      type: 'schedule_query',
      target: projects.length > 0 ? projects[0].name : (people.length > 0 ? people[0].name : 'unknown'),
      targetType: projects.length > 0 ? 'project' : 'person',
      timeframe: dates.length > 0 ? dates[0].value : 'unspecified',
      confidence: 0.7,
      metadata: {
        originalQuery: resolvedContext.originalQuery.originalQuery,
        timestamp: new Date().toISOString()
      }
    };

    actions.push(scheduleAction);

    response = `Schedule query for ${scheduleAction.target}`;
    if (scheduleAction.timeframe !== 'unspecified') {
      response += ` (${scheduleAction.timeframe})`;
    }
    response += '. Checking project timeline...';

    return {
      actions,
      response,
      confidence: context.confidence
    };
  }

  /**
   * Handle unknown intent
   */
  async handleUnknownIntent(resolvedContext, executeActions) {
    const actions = [{
      type: 'unknown_intent',
      confidence: 0.1,
      metadata: {
        originalQuery: resolvedContext.originalQuery.originalQuery,
        timestamp: new Date().toISOString()
      }
    }];

    const response = `I'm not sure what you want me to do with "${resolvedContext.originalQuery.originalQuery}". Could you rephrase or be more specific?`;

    return {
      actions,
      response,
      confidence: 0.1
    };
  }

  /**
   * Get processing statistics
   */
  getProcessingStats(processingResult) {
    const stats = {
      totalDuration: processingResult.metadata.totalDuration,
      success: processingResult.metadata.success,
      steps: processingResult.steps.length,
      confidence: processingResult.finalResult?.confidence || 0,
      actionsGenerated: processingResult.finalResult?.actions?.length || 0,
      executed: processingResult.metadata.executeActions
    };

    // Step-by-step timing
    stats.stepTiming = {};
    for (let i = 0; i < processingResult.steps.length; i++) {
      const step = processingResult.steps[i];
      const prevDuration = i > 0 ? processingResult.steps[i - 1].duration : 0;
      stats.stepTiming[step.step] = step.duration - prevDuration;
    }

    return stats;
  }
}

export { QueryProcessor };
