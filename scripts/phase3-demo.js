#!/usr/bin/env node

/**
 * Phase 3: Context Assembly Engine Demo
 * 
 * Demonstrates the complete contextual intelligence system with natural language queries
 * like "I'm at John's, add a $30 charge for more screws"
 */

import { ContextAssemblyEngine } from '../src/context/context-assembly-engine.js';
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log(chalk.blue.bold('🧠 Phase 3: Context Assembly Engine Demo'));
  console.log(chalk.blue.bold('=========================================='));
  console.log('');

  // Initialize the context assembly engine
  const dataPath = path.join(__dirname, '..', 'data');
  const engine = new ContextAssemblyEngine({
    dataPath,
    domain: 'construction',
    provider: 'openai',
    model: 'gpt-4o-mini'
  });

  // Demo scenarios showing progressive context building
  const scenarios = [
    {
      name: 'Scenario 1: Basic Context Establishment',
      description: 'User establishes location and project context',
      queries: [
        {
          query: "I'm at John's house working on the kitchen renovation",
          userId: 'rob_foree',
          sessionId: 'demo_session_1',
          currentLocation: "John's House - 123 Main St",
          currentProject: 'Kitchen Renovation',
          executeActions: false
        }
      ]
    },
    {
      name: 'Scenario 2: Contextual Financial Transaction',
      description: 'The target query - contextual charge addition',
      queries: [
        {
          query: "I'm at John's, add a $30 charge for more screws",
          userId: 'rob_foree',
          sessionId: 'demo_session_1', // Same session to maintain context
          executeActions: false
        }
      ]
    },
    {
      name: 'Scenario 3: Complex Multi-Entity Query',
      description: 'Complex query involving multiple entities and relationships',
      queries: [
        {
          query: "Mike needs to inspect the electrical work before we can schedule the drywall installation next week",
          userId: 'rob_foree',
          sessionId: 'demo_session_1',
          executeActions: false
        }
      ]
    },
    {
      name: 'Scenario 4: Status and Timeline Query',
      description: 'Checking project status with contextual awareness',
      queries: [
        {
          query: "What's the status of the kitchen project and when will it be done?",
          userId: 'rob_foree',
          sessionId: 'demo_session_1',
          executeActions: false
        }
      ]
    }
  ];

  for (const scenario of scenarios) {
    console.log(chalk.yellow.bold(`\n📋 ${scenario.name}`));
    console.log(chalk.yellow(`${scenario.description}`));
    console.log(chalk.gray('─'.repeat(80)));

    for (const queryConfig of scenario.queries) {
      try {
        console.log(chalk.cyan(`\n🗣️  Query: "${queryConfig.query}"`));
        
        const result = await engine.processContextualQuery(queryConfig.query, {
          userId: queryConfig.userId,
          sessionId: queryConfig.sessionId,
          currentLocation: queryConfig.currentLocation,
          currentProject: queryConfig.currentProject,
          executeActions: queryConfig.executeActions,
          maintainContext: true
        });

        // Display results
        displayResults(result);

        // Small delay between queries
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(chalk.red(`❌ Query failed: ${error.message}`));
        if (error.message.includes('cost limit') || error.message.includes('API key')) {
          console.log(chalk.yellow('💡 Tip: Check your API keys and cost limits in .env'));
          break;
        }
      }
    }
  }

  // Show session statistics
  console.log(chalk.green.bold('\n📊 Session Statistics'));
  console.log(chalk.green.bold('====================='));
  
  const sessionStats = engine.getSessionStats('demo_session_1');
  if (sessionStats) {
    console.log(`Session ID: ${sessionStats.sessionId}`);
    console.log(`User: ${sessionStats.userId}`);
    console.log(`Duration: ${Math.round(sessionStats.duration / 1000)}s`);
    console.log(`Queries Processed: ${sessionStats.queryCount}`);
    console.log(`Entities Tracked: ${sessionStats.entitiesTracked}`);
    console.log(`Current Location: ${sessionStats.currentLocation || 'None'}`);
    console.log(`Current Project: ${sessionStats.currentProject || 'None'}`);
    console.log(`Recent Locations: ${sessionStats.recentLocations}`);
    console.log(`Recent Projects: ${sessionStats.recentProjects}`);
    console.log(`Recent People: ${sessionStats.recentPeople}`);
  }

  // Phase 3 Summary
  console.log(chalk.green.bold('\n🎉 Phase 3 Implementation Complete!'));
  console.log(chalk.green.bold('===================================='));
  console.log('');
  console.log(chalk.blue('✅ Phase 3 Achievements:'));
  console.log('   • Natural language query parsing with intent recognition');
  console.log('   • Context resolution using relationship graphs');
  console.log('   • Contextual intelligence assembly with multi-entity reasoning');
  console.log('   • Conversation state management and session tracking');
  console.log('   • Enhanced response generation with contextual insights');
  console.log('');
  console.log(chalk.blue('🔧 Technical Capabilities:'));
  console.log('   • Query: "I\'m at John\'s, add a $30 charge for more screws"');
  console.log('   • → Parses intent (add_charge) and entities (location, amount, item)');
  console.log('   • → Resolves "John\'s" using relationship graph and context');
  console.log('   • → Assembles spatial, financial, and project context');
  console.log('   • → Generates contextually-aware response and actions');
  console.log('   • → Maintains conversation state for follow-up queries');
  console.log('');
  console.log(chalk.blue('🧠 Intelligence Levels:'));
  console.log('   • Basic: Simple entity extraction');
  console.log('   • Relational: Entity relationships identified');
  console.log('   • Contextual: Multi-domain context assembly');
  console.log('   • Advanced: Full contextual intelligence with insights');
  console.log('');
  console.log(chalk.blue('🚀 Ready for Phase 4:'));
  console.log('   • REST API endpoints for context-aware queries');
  console.log('   • Real-time WebSocket integration');
  console.log('   • Enhanced visualization with relationship networks');
  console.log('   • Production deployment and scaling');
}

function displayResults(result) {
  console.log(chalk.green(`\n✅ Processing Complete (${result.metadata.totalDuration}ms)`));
  
  // Show intelligence level and confidence
  if (result.contextualIntelligence) {
    const intelligence = result.contextualIntelligence;
    console.log(chalk.cyan(`🧠 Intelligence Level: ${intelligence.intelligenceLevel} (${(intelligence.confidence * 100).toFixed(1)}%)`));
    console.log(chalk.cyan(`📊 Context Entities: ${intelligence.contextEntities.length}`));
    
    if (intelligence.insights.length > 0) {
      console.log(chalk.cyan(`💡 Insights:`));
      intelligence.insights.forEach((insight, index) => {
        console.log(`   ${index + 1}. ${insight.description} (${(insight.confidence * 100).toFixed(1)}%)`);
      });
    }
  }

  // Show final response
  if (result.finalResponse) {
    console.log(chalk.cyan(`💬 Response: ${result.finalResponse.primaryResponse}`));
    
    if (result.finalResponse.contextualInsights.length > 0) {
      console.log(chalk.cyan(`🔍 Contextual Insights:`));
      result.finalResponse.contextualInsights.forEach((insight, index) => {
        console.log(`   • ${insight}`);
      });
    }
    
    if (result.finalResponse.recommendations.length > 0) {
      console.log(chalk.cyan(`💡 Recommendations:`));
      result.finalResponse.recommendations.forEach((rec, index) => {
        console.log(`   • ${rec}`);
      });
    }
  }

  // Show actions that would be taken
  const queryResult = result.steps.find(s => s.step === 'query_processing')?.result;
  if (queryResult?.finalResult?.actions?.length > 0) {
    console.log(chalk.cyan(`⚡ Actions Generated:`));
    queryResult.finalResult.actions.forEach((action, index) => {
      console.log(`   ${index + 1}. ${action.type}: ${JSON.stringify(action, null, 2).slice(0, 100)}...`);
    });
  }

  // Show step timing
  console.log(chalk.gray(`📈 Step Timing:`));
  let lastTime = 0;
  for (const step of result.steps) {
    if (step.success) {
      const stepTime = step.result?.metadata?.totalDuration || 
                     (step.result?.metadata?.startTime ? Date.now() - step.result.metadata.startTime : 0);
      console.log(chalk.gray(`   ${step.step}: ${stepTime - lastTime}ms`));
      lastTime = stepTime;
    }
  }
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Demo failed:', error);
    process.exit(1);
  });
}

export { main };
