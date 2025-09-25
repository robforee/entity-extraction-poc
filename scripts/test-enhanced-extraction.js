#!/usr/bin/env node

/**
 * Enhanced Relationship Extraction Test Script
 * 
 * Tests the new enhanced relationship extractor with sample construction communications
 * to demonstrate Phase 2 capabilities.
 */

import { EnhancedRelationshipExtractor } from '../src/extractors/enhanced-relationship-extractor.js';
import chalk from 'chalk';

async function main() {
  console.log(chalk.blue.bold('🚀 Enhanced Relationship Extraction Test'));
  console.log(chalk.blue.bold('=========================================='));
  
  const extractor = new EnhancedRelationshipExtractor({
    provider: 'openai',
    model: 'gpt-4o-mini',
    domain: 'construction'
  });

  // Test cases
  const testCases = [
    {
      name: 'Foundation Work Coordination',
      text: `Rob: Hey Mike, when can we start the foundation work? The permits came through yesterday.
Mike: Great news! I can start Monday if the weather holds. Need to coordinate with the concrete supplier first.
Rob: Perfect. What's the timeline looking like?
Mike: About 3 weeks for foundation if everything goes smooth. I'll need Sarah to inspect the forms before we pour.
Sarah: I can do the inspection Tuesday morning. Just let me know when you're ready.`,
      type: 'sms'
    },
    {
      name: 'Material Supply Chain Issue',
      text: `Mike: The lumber order from ABC Supply is delayed again. We need those 2x10s for the floor joists by Thursday.
Rob: Can we get them from someone else? This is the third delay.
Mike: I'll call Johnson Lumber. They usually have good stock. Might cost 10% more though.
Rob: Do it. We can't afford another delay. The electrician is scheduled for next week.`,
      type: 'sms'
    },
    {
      name: 'Budget Review Email',
      text: `Subject: Budget Review - Kitchen Renovation

Hi team,

I've been reviewing the budget and we're about $15K over on the kitchen renovation. Here are the main overruns:

- Custom cabinets: $8,000 over budget
- Appliance upgrades: $5,000 over budget  
- Electrical work: $2,000 over budget

Can we discuss alternatives? I'm flexible on the appliances but really want to keep the custom cabinets.

Rob`,
      type: 'email'
    }
  ];

  for (const testCase of testCases) {
    console.log(chalk.yellow(`\n📝 Testing: ${testCase.name}`));
    console.log(chalk.gray('─'.repeat(50)));
    
    try {
      const result = await extractor.extractEntitiesAndRelationships(testCase.text, {
        communicationType: testCase.type,
        context: 'Construction project communication'
      });

      // Display results
      console.log(chalk.green(`✅ Extraction successful`));
      console.log(chalk.cyan(`📊 Results Summary:`));
      console.log(`   - Entities: ${result.metadata.entityCount}`);
      console.log(`   - Relationships: ${result.metadata.relationshipCount}`);
      console.log(`   - Overall Confidence: ${(result.metadata.confidence * 100).toFixed(1)}%`);
      console.log(`   - Processing Time: ${result.metadata.duration}ms`);
      console.log(`   - Estimated Cost: $${result.metadata.cost.toFixed(4)}`);

      // Show entity breakdown
      console.log(chalk.cyan(`\n🏷️  Entity Breakdown:`));
      for (const [type, entities] of Object.entries(result.entities)) {
        if (Array.isArray(entities) && entities.length > 0) {
          console.log(`   ${type}: ${entities.length}`);
          entities.slice(0, 2).forEach(entity => {
            console.log(`     - ${entity.name || entity.description || JSON.stringify(entity).slice(0, 50)}`);
          });
          if (entities.length > 2) {
            console.log(`     ... and ${entities.length - 2} more`);
          }
        }
      }

      // Show relationships
      if (result.relationships.length > 0) {
        console.log(chalk.cyan(`\n🔗 Relationships Extracted:`));
        result.relationships.slice(0, 5).forEach((rel, index) => {
          console.log(`   ${index + 1}. ${rel.source} --[${rel.type}]--> ${rel.target}`);
          console.log(`      Confidence: ${(rel.confidence * 100).toFixed(1)}% | Context: ${rel.metadata?.context || 'N/A'}`);
        });
        if (result.relationships.length > 5) {
          console.log(`   ... and ${result.relationships.length - 5} more relationships`);
        }
      }

      // Show summary
      if (result.summary) {
        console.log(chalk.cyan(`\n📝 Summary:`));
        console.log(`   ${result.summary}`);
      }

    } catch (error) {
      console.error(chalk.red(`❌ Test failed: ${error.message}`));
      if (error.message.includes('cost limit')) {
        console.log(chalk.yellow('💡 Tip: Check your API keys and cost limits in .env'));
        break;
      }
    }
  }

  console.log(chalk.green.bold(`\n🎉 Enhanced Extraction Testing Complete!`));
  console.log(chalk.blue(`\nThis demonstrates Phase 2.1 capabilities:`));
  console.log(`✅ Enhanced LLM prompts with relationship extraction`);
  console.log(`✅ Semantic relationship identification`);
  console.log(`✅ Confidence scoring for entities and relationships`);
  console.log(`✅ Domain-specific relationship types`);
  console.log(`✅ Metadata and temporal context extraction`);
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

export { main };
