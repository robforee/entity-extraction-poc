#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { MultiDomainDiffMem } from '../src/diffmem/multi-domain-diffmem.js';

/**
 * Domain Query CLI Tool
 * 
 * Query entities and relationships from domain datastores
 */
class DomainQuery {
    constructor(options = {}) {
        this.domain = options.domain || 'cybersec';
        this.diffmem = new MultiDomainDiffMem({ domain: this.domain });
    }

    async listEntities(options = {}) {
        console.log(chalk.blue.bold(`🎯 Entities in domain: ${this.domain}`));
        console.log('');

        try {
            const entitySets = await this.diffmem.getAllEntities();
            
            if (!entitySets || entitySets.length === 0) {
                console.log(chalk.yellow('No entities found in this domain.'));
                return;
            }

            let totalEntities = 0;
            const categoryStats = {};

            // Process each entity set (document)
            entitySets.forEach((entitySet, setIndex) => {
                console.log(chalk.cyan(`📄 Document ${setIndex + 1}: ${entitySet.metadata?.source || 'Unknown source'}`));
                
                if (entitySet.entities) {
                    Object.entries(entitySet.entities).forEach(([category, entityList]) => {
                        if (Array.isArray(entityList) && entityList.length > 0) {
                            console.log(chalk.white(`  ${category.toUpperCase()} (${entityList.length}):`));
                            
                            categoryStats[category] = (categoryStats[category] || 0) + entityList.length;
                            totalEntities += entityList.length;

                            entityList.forEach((entity, index) => {
                                const name = entity.name || entity.description || 'Unnamed entity';
                                const confidence = entity.confidence ? `(${(entity.confidence * 100).toFixed(0)}%)` : '';
                                const role = entity.role ? ` - ${entity.role}` : '';
                                const type = entity.type ? ` - ${entity.type}` : '';
                                const status = entity.status ? ` [${entity.status}]` : '';
                                
                                console.log(chalk.gray(`    ${index + 1}. ${name}${role}${type}${status} ${confidence}`));
                                
                                // Highlight unnamed entities
                                if (name === 'Unnamed entity' || !entity.name) {
                                    console.log(chalk.red(`       ⚠️  UNNAMED ENTITY DETECTED`));
                                    console.log(chalk.gray(`       Raw data: ${JSON.stringify(entity, null, 8)}`));
                                }
                            });
                            console.log('');
                        }
                    });
                }
                console.log('');
            });

            // Summary
            console.log(chalk.blue.bold('📊 SUMMARY'));
            console.log(chalk.white(`Total entities: ${totalEntities}`));
            console.log(chalk.white(`Categories:`));
            Object.entries(categoryStats).forEach(([category, count]) => {
                console.log(chalk.gray(`  ${category}: ${count}`));
            });

        } catch (error) {
            console.error(chalk.red('❌ Error listing entities:'), error.message);
        }
    }

    async listRelationships(options = {}) {
        console.log(chalk.blue.bold(`🕸️  Relationships in domain: ${this.domain}`));
        console.log('');

        try {
            // Get all entities first to build relationships
            const entitySets = await this.diffmem.getAllEntities();
            
            if (!entitySets || entitySets.length === 0) {
                console.log(chalk.yellow('No entities found to build relationships.'));
                return;
            }

            const relationships = this.buildRelationships(entitySets);
            
            if (relationships.length === 0) {
                console.log(chalk.yellow('No relationships found.'));
                return;
            }

            console.log(chalk.white(`Found ${relationships.length} relationships:`));
            console.log('');

            relationships.forEach((rel, index) => {
                const sourceInfo = rel.source.name || rel.source.description || 'Unnamed entity';
                const targetInfo = rel.target.name || rel.target.description || 'Unnamed entity';
                const strength = rel.strength ? `(strength: ${rel.strength.toFixed(2)})` : '';
                
                console.log(chalk.cyan(`${index + 1}. ${sourceInfo} ↔ ${targetInfo} ${strength}`));
                console.log(chalk.gray(`   Categories: ${rel.source.category} ↔ ${rel.target.category}`));
                console.log(chalk.gray(`   Reason: ${rel.reason || 'Co-occurrence in same document'}`));
                
                // Highlight problematic relationships
                if (sourceInfo === 'Unnamed entity' || targetInfo === 'Unnamed entity') {
                    console.log(chalk.red(`   ⚠️  RELATIONSHIP WITH UNNAMED ENTITY`));
                }
                
                console.log('');
            });

            // Relationship stats
            const categoryPairs = {};
            relationships.forEach(rel => {
                const pair = `${rel.source.category} ↔ ${rel.target.category}`;
                categoryPairs[pair] = (categoryPairs[pair] || 0) + 1;
            });

            console.log(chalk.blue.bold('📊 RELATIONSHIP SUMMARY'));
            console.log(chalk.white(`Total relationships: ${relationships.length}`));
            console.log(chalk.white(`Category pairs:`));
            Object.entries(categoryPairs).forEach(([pair, count]) => {
                console.log(chalk.gray(`  ${pair}: ${count}`));
            });

        } catch (error) {
            console.error(chalk.red('❌ Error listing relationships:'), error.message);
        }
    }

    buildRelationships(entitySets) {
        const relationships = [];
        const entityMap = new Map();

        // First, collect all entities with their metadata
        entitySets.forEach((entitySet, setIndex) => {
            if (entitySet.entities) {
                Object.entries(entitySet.entities).forEach(([category, entityList]) => {
                    if (Array.isArray(entityList)) {
                        entityList.forEach((entity, entityIndex) => {
                            const entityId = `${setIndex}_${category}_${entityIndex}`;
                            entityMap.set(entityId, {
                                ...entity,
                                category,
                                setIndex,
                                source: entitySet.metadata?.source || 'Unknown'
                            });
                        });
                    }
                });
            }
        });

        // Build relationships between entities in the same document
        entitySets.forEach((entitySet, setIndex) => {
            const entitiesInSet = [];
            
            if (entitySet.entities) {
                Object.entries(entitySet.entities).forEach(([category, entityList]) => {
                    if (Array.isArray(entityList)) {
                        entityList.forEach((entity, entityIndex) => {
                            entitiesInSet.push({
                                ...entity,
                                category,
                                id: `${setIndex}_${category}_${entityIndex}`
                            });
                        });
                    }
                });
            }

            // Create relationships between all entities in the same document
            for (let i = 0; i < entitiesInSet.length; i++) {
                for (let j = i + 1; j < entitiesInSet.length; j++) {
                    const source = entitiesInSet[i];
                    const target = entitiesInSet[j];
                    
                    // Calculate relationship strength based on confidence and category compatibility
                    let strength = 0.5; // Base strength for co-occurrence
                    
                    if (source.confidence && target.confidence) {
                        strength = (source.confidence + target.confidence) / 2;
                    }
                    
                    // Boost strength for related categories
                    if (this.areRelatedCategories(source.category, target.category)) {
                        strength += 0.2;
                    }
                    
                    relationships.push({
                        source,
                        target,
                        strength: Math.min(strength, 1.0),
                        reason: `Co-occurrence in ${entitySet.metadata?.source || 'same document'}`,
                        documentSource: entitySet.metadata?.source
                    });
                }
            }
        });

        return relationships;
    }

    areRelatedCategories(cat1, cat2) {
        const relatedPairs = [
            ['people', 'projects'],
            ['people', 'tasks'],
            ['projects', 'materials'],
            ['projects', 'costs'],
            ['issues', 'tasks'],
            ['documents', 'decisions'],
            ['materials', 'costs']
        ];
        
        return relatedPairs.some(([a, b]) => 
            (cat1 === a && cat2 === b) || (cat1 === b && cat2 === a)
        );
    }

    async analyzeUnnamedEntities() {
        console.log(chalk.red.bold('🔍 ANALYZING UNNAMED ENTITIES'));
        console.log('');

        try {
            const entitySets = await this.diffmem.getAllEntities();
            const unnamedEntities = [];

            entitySets.forEach((entitySet, setIndex) => {
                if (entitySet.entities) {
                    Object.entries(entitySet.entities).forEach(([category, entityList]) => {
                        if (Array.isArray(entityList)) {
                            entityList.forEach((entity, entityIndex) => {
                                const name = entity.name || entity.description;
                                if (!name || name === 'Unnamed entity' || name.trim() === '') {
                                    unnamedEntities.push({
                                        ...entity,
                                        category,
                                        setIndex,
                                        entityIndex,
                                        source: entitySet.metadata?.source || 'Unknown'
                                    });
                                }
                            });
                        }
                    });
                }
            });

            if (unnamedEntities.length === 0) {
                console.log(chalk.green('✅ No unnamed entities found!'));
                return;
            }

            console.log(chalk.yellow(`Found ${unnamedEntities.length} unnamed entities:`));
            console.log('');

            unnamedEntities.forEach((entity, index) => {
                console.log(chalk.red(`${index + 1}. UNNAMED ENTITY`));
                console.log(chalk.gray(`   Category: ${entity.category}`));
                console.log(chalk.gray(`   Source: ${entity.source}`));
                console.log(chalk.gray(`   Set Index: ${entity.setIndex}, Entity Index: ${entity.entityIndex}`));
                console.log(chalk.gray(`   Raw Data: ${JSON.stringify(entity, null, 4)}`));
                console.log('');
            });

            // Suggestions
            console.log(chalk.blue.bold('💡 SUGGESTIONS TO FIX:'));
            console.log(chalk.white('1. Check LLM extraction prompts for missing name fields'));
            console.log(chalk.white('2. Improve entity validation in cybersec-llm-extractor.js'));
            console.log(chalk.white('3. Add fallback naming based on other entity fields'));
            console.log(chalk.white('4. Re-process documents with improved prompts'));

        } catch (error) {
            console.error(chalk.red('❌ Error analyzing unnamed entities:'), error.message);
        }
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log(chalk.blue.bold('Domain Query CLI'));
        console.log(chalk.white('\nUsage: node domain-query.js [command] [options]'));
        console.log(chalk.white('\nCommands:'));
        console.log(chalk.white('  entities             List all entities'));
        console.log(chalk.white('  relationships        List all relationships'));
        console.log(chalk.white('  unnamed              Analyze unnamed entities'));
        console.log(chalk.white('\nOptions:'));
        console.log(chalk.white('  --domain <name>      Domain to query (default: "cybersec")'));
        console.log(chalk.white('  --help, -h           Show this help'));
        console.log(chalk.white('\nExamples:'));
        console.log(chalk.gray('  node domain-query.js entities --domain cybersec'));
        console.log(chalk.gray('  node domain-query.js relationships'));
        console.log(chalk.gray('  node domain-query.js unnamed'));
        return;
    }
    
    const options = {};
    const commands = [];
    
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--domain':
                options.domain = args[++i];
                break;
            default:
                if (!args[i].startsWith('--')) {
                    commands.push(args[i]);
                }
        }
    }
    
    if (commands.length === 0) {
        commands.push('entities'); // Default command
    }
    
    const query = new DomainQuery(options);
    
    for (const command of commands) {
        switch (command) {
            case 'entities':
                await query.listEntities();
                break;
            case 'relationships':
                await query.listRelationships();
                break;
            case 'unnamed':
                await query.analyzeUnnamedEntities();
                break;
            default:
                console.error(chalk.red(`❌ Unknown command: ${command}`));
                console.log(chalk.gray('Use --help for usage information'));
        }
        
        if (commands.length > 1) {
            console.log('\n' + '='.repeat(60) + '\n');
        }
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default DomainQuery;
