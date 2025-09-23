#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { MultiDomainDiffMem } from '../src/diffmem/multi-domain-diffmem.js';

/**
 * Repair Unnamed Entities
 * 
 * Fix entities that have description but no name field
 */
class EntityRepairer {
    constructor(domain = 'cybersec') {
        this.domain = domain;
        this.diffmem = new MultiDomainDiffMem({ domain });
    }

    async repairUnnamedEntities() {
        console.log(chalk.blue.bold(`🔧 Repairing unnamed entities in domain: ${this.domain}`));
        console.log('');

        try {
            const domainPath = this.diffmem.getDomainPath(this.domain);
            const entitiesPath = path.join(domainPath, 'entities');
            
            if (!await fs.pathExists(entitiesPath)) {
                console.log(chalk.yellow('No entities directory found.'));
                return;
            }

            const files = await fs.readdir(entitiesPath);
            const jsonFiles = files.filter(f => f.endsWith('.json'));
            
            let totalRepaired = 0;
            let filesModified = 0;

            for (const file of jsonFiles) {
                const filePath = path.join(entitiesPath, file);
                const entityData = await fs.readJson(filePath);
                
                let fileModified = false;
                let repairedInFile = 0;

                if (entityData.entities) {
                    // Fix issues, tasks, decisions, timeline entities
                    ['issues', 'tasks', 'decisions', 'timeline'].forEach(category => {
                        if (Array.isArray(entityData.entities[category])) {
                            entityData.entities[category] = entityData.entities[category].map(entity => {
                                if (!entity.name && entity.description) {
                                    console.log(chalk.yellow(`  Fixing ${category} entity: "${entity.description}"`));
                                    fileModified = true;
                                    repairedInFile++;
                                    return {
                                        ...entity,
                                        name: entity.description
                                    };
                                }
                                return entity;
                            });
                        }
                    });
                }

                if (fileModified) {
                    await fs.writeJson(filePath, entityData, { spaces: 2 });
                    console.log(chalk.green(`✅ Repaired ${repairedInFile} entities in ${file}`));
                    filesModified++;
                    totalRepaired += repairedInFile;
                }
            }

            console.log('');
            console.log(chalk.blue.bold('📊 REPAIR SUMMARY'));
            console.log(chalk.white(`Files processed: ${jsonFiles.length}`));
            console.log(chalk.white(`Files modified: ${filesModified}`));
            console.log(chalk.white(`Total entities repaired: ${totalRepaired}`));

            if (totalRepaired > 0) {
                console.log('');
                console.log(chalk.green('🎉 Repair completed! Restart the visualization server to see changes.'));
            } else {
                console.log('');
                console.log(chalk.green('✅ No repairs needed - all entities have names.'));
            }

        } catch (error) {
            console.error(chalk.red('❌ Error during repair:'), error.message);
        }
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    const domain = args.find(arg => arg.startsWith('--domain='))?.split('=')[1] || 'cybersec';
    
    const repairer = new EntityRepairer(domain);
    await repairer.repairUnnamedEntities();
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default EntityRepairer;
