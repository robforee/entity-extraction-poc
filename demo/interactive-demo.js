#!/usr/bin/env node

import ProductionExtractor from '../src/extractors/production-extractor.js';
import MockDiffMem from '../src/diffmem/mock-diffmem.js';
import ContextRetriever from '../src/diffmem/context-retriever.js';
import chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';

/**
 * Interactive Demo: Complete Entity Extraction Workflow
 * 
 * Demonstrates:
 * 1. Message parsing and entity extraction
 * 2. Entity storage in DiffMem
 * 3. Entity querying and retrieval
 * 4. Context generation for specific queries
 */
class InteractiveDemo {
    constructor() {
        this.extractor = new ProductionExtractor();
        this.diffmem = new MockDiffMem();
        this.contextRetriever = new ContextRetriever();
        this.conversationId = uuidv4();
        
        console.log(chalk.blue.bold('🚀 Entity Extraction PoC - Interactive Demo\n'));
        console.log(chalk.cyan(`Conversation ID: ${this.conversationId}\n`));
    }

    async runCompleteDemo() {
        try {
            // Step 1: Parse messages and extract entities
            await this.demoEntityExtraction();
            
            // Step 2: Query for entity lists
            await this.demoEntityListing();
            
            // Step 3: Query about specific entities
            await this.demoSpecificEntityQueries();
            
            // Step 4: Demonstrate context retrieval
            await this.demoContextRetrieval();
            
            console.log(chalk.green.bold('\n🎉 Demo completed successfully!'));
            
        } catch (error) {
            console.error(chalk.red('💥 Demo failed:'), error.message);
            throw error;
        }
    }

    async demoEntityExtraction() {
        console.log(chalk.blue.bold('📝 STEP 1: Message Parsing & Entity Extraction\n'));
        
        const demoMessages = [
            {
                id: 'msg_1',
                text: 'Hey Mike, great news! The permits came through yesterday. We can start the foundation work Monday. I spoke with Sarah about the electrical plans - she wants to review them before we proceed. Budget estimate is $25,000 for the foundation phase.',
                type: 'sms',
                from: 'Rob (Owner)'
            },
            {
                id: 'msg_2',
                text: 'Perfect timing! I\'ll coordinate with Johnson Construction Supply for the concrete delivery. The weather forecast looks good for next week. One issue though - we\'re running into a $3,000 overrun on the steel reinforcement due to recent price increases.',
                type: 'sms', 
                from: 'Mike (Contractor)'
            },
            {
                id: 'msg_3',
                text: 'Meeting scheduled for Friday 2pm on-site to review electrical plans and discuss the steel cost overrun. Please bring the updated material specifications. Also, the kitchen renovation is on hold until we resolve the cabinet supplier quality issues.',
                type: 'sms',
                from: 'Sarah (Architect)'
            }
        ];

        for (let i = 0; i < demoMessages.length; i++) {
            const message = demoMessages[i];
            
            console.log(chalk.cyan(`\n📨 Processing Message ${i + 1}:`));
            console.log(chalk.white(`From: ${message.from}`));
            console.log(chalk.white(`Text: "${message.text}"`));
            
            // Extract entities
            console.log(chalk.yellow('\n🔍 Extracting entities...'));
            const extractionResult = await this.extractor.extractEntities(message.text, {
                communicationType: message.type,
                forceHighAccuracy: true
            });
            
            // Display extracted entities
            this.displayExtractedEntities(extractionResult.entities);
            
            // Store in DiffMem
            console.log(chalk.yellow('\n💾 Storing entities in DiffMem...'));
            const entityId = await this.diffmem.storeEntities(
                this.conversationId,
                extractionResult.entities,
                {
                    ...extractionResult.metadata,
                    messageId: message.id,
                    messageFrom: message.from,
                    originalText: message.text
                }
            );
            
            console.log(chalk.green(`✅ Stored with Entity ID: ${entityId}`));
            console.log(chalk.gray('─'.repeat(80)));
        }
    }

    displayExtractedEntities(entities) {
        let totalEntities = 0;
        
        for (const [entityType, entityList] of Object.entries(entities)) {
            if (entityList.length > 0) {
                totalEntities += entityList.length;
                console.log(chalk.blue(`\n  ${entityType.toUpperCase()}:`));
                
                for (const entity of entityList) {
                    const confidence = entity.confidence ? ` (${Math.round(entity.confidence * 100)}%)` : '';
                    
                    switch (entityType) {
                        case 'people':
                            console.log(chalk.white(`    • ${entity.name}${entity.role ? ` - ${entity.role}` : ''}${confidence}`));
                            break;
                        case 'projects':
                            console.log(chalk.white(`    • ${entity.name}${entity.phase ? ` (${entity.phase})` : ''}${confidence}`));
                            break;
                        case 'decisions':
                            console.log(chalk.white(`    • ${entity.type}: ${entity.description}${confidence}`));
                            break;
                        case 'timeline':
                            console.log(chalk.white(`    • ${entity.event}${entity.date ? ` - ${entity.date}` : ''}${confidence}`));
                            break;
                        case 'costs':
                            console.log(chalk.white(`    • $${entity.amount?.toLocaleString() || 'N/A'}${entity.category ? ` (${entity.category})` : ''}${confidence}`));
                            break;
                        case 'issues':
                            console.log(chalk.white(`    • ${entity.description}${entity.severity ? ` [${entity.severity}]` : ''}${confidence}`));
                            break;
                        case 'materials':
                            console.log(chalk.white(`    • ${entity.name}${entity.category ? ` (${entity.category})` : ''}${confidence}`));
                            break;
                        case 'tasks':
                            console.log(chalk.white(`    • ${entity.description}${entity.assigned_to ? ` → ${entity.assigned_to}` : ''}${confidence}`));
                            break;
                        case 'documents':
                            console.log(chalk.white(`    • ${entity.name}${entity.type ? ` (${entity.type})` : ''}${confidence}`));
                            break;
                        case 'locations':
                            console.log(chalk.white(`    • ${entity.name}${entity.type ? ` (${entity.type})` : ''}${confidence}`));
                            break;
                        default:
                            console.log(chalk.white(`    • ${JSON.stringify(entity)}`));
                    }
                }
            }
        }
        
        console.log(chalk.green(`\n  📊 Total entities extracted: ${totalEntities}`));
    }

    async demoEntityListing() {
        console.log(chalk.blue.bold('\n📋 STEP 2: Entity Listing & Search\n'));
        
        // Get all entities by conversation
        console.log(chalk.cyan('🔍 Retrieving all entities from conversation...'));
        const conversationEntities = await this.diffmem.getEntitiesByConversation(this.conversationId);
        
        console.log(chalk.green(`✅ Found ${conversationEntities.length} entity records in conversation`));
        
        // Aggregate entities by type
        const aggregatedEntities = this.aggregateEntities(conversationEntities);
        
        console.log(chalk.blue('\n📊 Entity Summary by Type:'));
        for (const [entityType, entities] of Object.entries(aggregatedEntities)) {
            if (entities.length > 0) {
                console.log(chalk.white(`  ${entityType}: ${entities.length} entities`));
                
                // Show first few examples
                for (const entity of entities.slice(0, 3)) {
                    const name = entity.name || entity.description || entity.event || 'unnamed';
                    console.log(chalk.gray(`    - ${name}`));
                }
                if (entities.length > 3) {
                    console.log(chalk.gray(`    ... and ${entities.length - 3} more`));
                }
            }
        }
        
        // Search for specific entity types
        console.log(chalk.blue('\n🔍 Searching for specific entity types:'));
        
        const searchQueries = [
            { entityType: 'people', description: 'All people mentioned' },
            { entityType: 'costs', description: 'Budget and cost information' },
            { entityType: 'timeline', description: 'Schedule and timeline items' },
            { entityType: 'issues', description: 'Problems and concerns' }
        ];
        
        for (const query of searchQueries) {
            console.log(chalk.cyan(`\n  Searching for: ${query.description}`));
            const results = await this.diffmem.searchEntities({
                entityType: query.entityType,
                conversationId: this.conversationId
            });
            
            console.log(chalk.green(`  ✅ Found ${results.length} records with ${query.entityType}`));
            
            if (results.length > 0) {
                const entities = this.extractEntitiesOfType(results, query.entityType);
                for (const entity of entities.slice(0, 2)) {
                    const display = this.formatEntityForDisplay(entity, query.entityType);
                    console.log(chalk.white(`    • ${display}`));
                }
            }
        }
    }

    async demoSpecificEntityQueries() {
        console.log(chalk.blue.bold('\n🎯 STEP 3: Specific Entity Queries\n'));
        
        const specificQueries = [
            {
                query: 'foundation work',
                description: 'Information about foundation work'
            },
            {
                query: 'Mike',
                description: 'All mentions of Mike'
            },
            {
                query: 'budget overrun',
                description: 'Budget and cost overruns'
            },
            {
                query: 'Friday meeting',
                description: 'Meeting scheduled for Friday'
            }
        ];
        
        for (const queryInfo of specificQueries) {
            console.log(chalk.cyan(`\n🔍 Query: "${queryInfo.query}" (${queryInfo.description})`));
            
            const results = await this.diffmem.searchEntities({
                text: queryInfo.query,
                conversationId: this.conversationId,
                minConfidence: 0.5
            });
            
            console.log(chalk.green(`✅ Found ${results.length} relevant entity records`));
            
            if (results.length > 0) {
                // Show the most relevant entities
                const topResult = results[0];
                console.log(chalk.blue('  📋 Most relevant entities:'));
                
                for (const [entityType, entityList] of Object.entries(topResult.entities)) {
                    if (entityList.length > 0) {
                        const relevantEntities = entityList.filter(entity => {
                            const entityText = JSON.stringify(entity).toLowerCase();
                            return entityText.includes(queryInfo.query.toLowerCase());
                        });
                        
                        if (relevantEntities.length > 0) {
                            console.log(chalk.white(`    ${entityType}:`));
                            for (const entity of relevantEntities) {
                                const display = this.formatEntityForDisplay(entity, entityType);
                                console.log(chalk.gray(`      - ${display}`));
                            }
                        }
                    }
                }
                
                // Show metadata
                console.log(chalk.blue('  📊 Metadata:'));
                console.log(chalk.gray(`    Confidence: ${Math.round((topResult.metadata?.confidence || 0) * 100)}%`));
                console.log(chalk.gray(`    Timestamp: ${new Date(topResult.timestamp).toLocaleString()}`));
                console.log(chalk.gray(`    Model: ${topResult.metadata?.model || 'unknown'}`));
            }
        }
    }

    async demoContextRetrieval() {
        console.log(chalk.blue.bold('\n🧠 STEP 4: Context Retrieval & Generation\n'));
        
        const contextQueries = [
            'What is the current status of the foundation work?',
            'Who are the key people involved in this project?',
            'What are the budget concerns?',
            'What meetings are scheduled?'
        ];
        
        for (const query of contextQueries) {
            console.log(chalk.cyan(`\n🔍 Context Query: "${query}"`));
            
            const context = await this.contextRetriever.retrieveContext(query, {
                conversationId: this.conversationId,
                includeHistory: true,
                maxAge: 30,
                minConfidence: 0.5
            });
            
            console.log(chalk.green(`✅ Generated context with ${context.entities.length} relevant entities`));
            console.log(chalk.blue(`📊 Overall confidence: ${Math.round(context.metadata.confidence * 100)}%`));
            
            if (context.summary && context.summary.length > 100) {
                console.log(chalk.blue('\n📋 Context Summary:'));
                console.log(chalk.white(context.summary));
            } else {
                console.log(chalk.yellow('⚠️  Limited context available - may need search optimization'));
            }
        }
        
        // Show DiffMem statistics
        console.log(chalk.blue.bold('\n📊 DiffMem Statistics:'));
        const stats = await this.diffmem.getStats();
        console.log(chalk.white(`  Total entities stored: ${stats.entityCount}`));
        console.log(chalk.white(`  Conversations: ${stats.conversationCount}`));
        console.log(chalk.white(`  Last updated: ${new Date(stats.lastUpdated).toLocaleString()}`));
        console.log(chalk.white(`  Storage path: ${stats.repoPath}`));
    }

    // Helper methods
    aggregateEntities(entityRecords) {
        const aggregated = {};
        
        for (const record of entityRecords) {
            for (const [entityType, entityList] of Object.entries(record.entities)) {
                if (!aggregated[entityType]) {
                    aggregated[entityType] = [];
                }
                aggregated[entityType].push(...entityList);
            }
        }
        
        return aggregated;
    }

    extractEntitiesOfType(entityRecords, entityType) {
        const entities = [];
        
        for (const record of entityRecords) {
            if (record.entities[entityType]) {
                entities.push(...record.entities[entityType]);
            }
        }
        
        return entities;
    }

    formatEntityForDisplay(entity, entityType) {
        switch (entityType) {
            case 'people':
                return `${entity.name}${entity.role ? ` (${entity.role})` : ''}`;
            case 'projects':
                return `${entity.name}${entity.phase ? ` - ${entity.phase}` : ''}`;
            case 'decisions':
                return `${entity.type}: ${entity.description}`;
            case 'timeline':
                return `${entity.event}${entity.date ? ` (${entity.date})` : ''}`;
            case 'costs':
                return `$${entity.amount?.toLocaleString() || 'N/A'}${entity.category ? ` - ${entity.category}` : ''}`;
            case 'issues':
                return `${entity.description}${entity.severity ? ` [${entity.severity}]` : ''}`;
            case 'tasks':
                return `${entity.description}${entity.assigned_to ? ` → ${entity.assigned_to}` : ''}`;
            case 'materials':
                return `${entity.name}${entity.category ? ` (${entity.category})` : ''}`;
            case 'documents':
                return `${entity.name}${entity.type ? ` (${entity.type})` : ''}`;
            case 'locations':
                return `${entity.name}${entity.type ? ` (${entity.type})` : ''}`;
            default:
                return entity.name || entity.description || entity.event || JSON.stringify(entity);
        }
    }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const demo = new InteractiveDemo();
    demo.runCompleteDemo().catch(error => {
        console.error(chalk.red('💥 Demo failed:'), error.message);
        process.exit(1);
    });
}

export default InteractiveDemo;
