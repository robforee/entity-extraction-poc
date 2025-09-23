#!/usr/bin/env node

import ProductionExtractor from '../src/extractors/production-extractor.js';
import MockDiffMem from '../src/diffmem/mock-diffmem.js';
import chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';

/**
 * Simple Demo: Core Workflow
 * Shows the essential steps clearly
 */
async function runSimpleDemo() {
    console.log(chalk.blue.bold('🚀 Simple Entity Extraction Demo\n'));
    
    const extractor = new ProductionExtractor();
    const diffmem = new MockDiffMem();
    const conversationId = uuidv4();
    
    // 1. Parse a construction message
    const message = "Hey Mike, permits approved! Foundation work starts Monday. Budget is $25,000. Sarah needs to review electrical plans by Friday.";
    
    console.log(chalk.cyan('📨 Original Message:'));
    console.log(chalk.white(`"${message}"\n`));
    
    // 2. Extract entities
    console.log(chalk.cyan('🔍 Extracting Entities...'));
    const result = await extractor.extractEntities(message, { 
        communicationType: 'sms',
        forceHighAccuracy: true 
    });
    
    console.log(chalk.green(`✅ Extracted ${countEntities(result.entities)} entities in ${result.metadata.duration}ms\n`));
    
    // 3. Display entities clearly
    console.log(chalk.cyan('📋 Extracted Entities:'));
    displayEntities(result.entities);
    
    // 4. Store in DiffMem
    console.log(chalk.cyan('\n💾 Storing in DiffMem...'));
    const entityId = await diffmem.storeEntities(conversationId, result.entities, result.metadata);
    console.log(chalk.green(`✅ Stored with ID: ${entityId}\n`));
    
    // 5. Query entities
    console.log(chalk.cyan('🔍 Querying Stored Entities:'));
    
    // Query by entity type
    const peopleResults = await diffmem.searchEntities({ entityType: 'people' });
    console.log(chalk.white(`  People: ${peopleResults.length} records found`));
    
    const costResults = await diffmem.searchEntities({ entityType: 'costs' });
    console.log(chalk.white(`  Costs: ${costResults.length} records found`));
    
    const timelineResults = await diffmem.searchEntities({ entityType: 'timeline' });
    console.log(chalk.white(`  Timeline: ${timelineResults.length} records found`));
    
    // Query by text
    const mikeResults = await diffmem.searchEntities({ text: 'Mike' });
    console.log(chalk.white(`  "Mike" mentions: ${mikeResults.length} records found`));
    
    const foundationResults = await diffmem.searchEntities({ text: 'foundation' });
    console.log(chalk.white(`  "foundation" mentions: ${foundationResults.length} records found\n`));
    
    // 6. Show specific entity details
    if (peopleResults.length > 0) {
        console.log(chalk.cyan('👥 People Details:'));
        const people = peopleResults[0].entities.people || [];
        for (const person of people) {
            console.log(chalk.white(`  • ${person.name}${person.role ? ` (${person.role})` : ''} - ${Math.round(person.confidence * 100)}% confidence`));
        }
    }
    
    if (costResults.length > 0) {
        console.log(chalk.cyan('\n💰 Cost Details:'));
        const costs = costResults[0].entities.costs || [];
        for (const cost of costs) {
            console.log(chalk.white(`  • $${cost.amount?.toLocaleString() || 'N/A'}${cost.category ? ` (${cost.category})` : ''} - ${Math.round(cost.confidence * 100)}% confidence`));
        }
    }
    
    // 7. Show DiffMem stats
    console.log(chalk.cyan('\n📊 DiffMem Statistics:'));
    const stats = await diffmem.getStats();
    console.log(chalk.white(`  Total entities: ${stats.entityCount}`));
    console.log(chalk.white(`  Conversations: ${stats.conversationCount}`));
    console.log(chalk.white(`  Storage path: ${stats.repoPath}`));
    
    console.log(chalk.green.bold('\n🎉 Demo Complete! Entity extraction → storage → querying all working perfectly!'));
}

function countEntities(entities) {
    let count = 0;
    for (const entityList of Object.values(entities)) {
        if (Array.isArray(entityList)) {
            count += entityList.length;
        }
    }
    return count;
}

function displayEntities(entities) {
    for (const [entityType, entityList] of Object.entries(entities)) {
        if (entityList.length > 0) {
            console.log(chalk.blue(`  ${entityType.toUpperCase()}:`));
            for (const entity of entityList) {
                const confidence = entity.confidence ? ` (${Math.round(entity.confidence * 100)}%)` : '';
                let display = '';
                
                switch (entityType) {
                    case 'people':
                        display = `${entity.name}${entity.role ? ` - ${entity.role}` : ''}`;
                        break;
                    case 'projects':
                        display = `${entity.name}${entity.phase ? ` (${entity.phase})` : ''}`;
                        break;
                    case 'decisions':
                        display = `${entity.type}: ${entity.description}`;
                        break;
                    case 'timeline':
                        display = `${entity.event}${entity.date ? ` - ${entity.date}` : ''}`;
                        break;
                    case 'costs':
                        display = `$${entity.amount?.toLocaleString() || 'N/A'}${entity.category ? ` (${entity.category})` : ''}`;
                        break;
                    default:
                        display = entity.name || entity.description || entity.event || JSON.stringify(entity);
                }
                
                console.log(chalk.white(`    • ${display}${confidence}`));
            }
        }
    }
}

// Run the demo
runSimpleDemo().catch(error => {
    console.error(chalk.red('💥 Demo failed:'), error.message);
    process.exit(1);
});
