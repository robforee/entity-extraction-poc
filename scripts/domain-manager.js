#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { MultiDomainDiffMem } from '../src/diffmem/multi-domain-diffmem.js';

/**
 * Domain Manager
 * 
 * Manage multiple datastores for different domains (cybersec, construction, etc.)
 */
class DomainManager {
    constructor() {
        this.diffmem = new MultiDomainDiffMem();
    }

    async listDomains() {
        console.log(chalk.blue.bold('📂 Available Domains\n'));
        
        const domains = await this.diffmem.listDomains();
        
        if (domains.length === 0) {
            console.log(chalk.yellow('No domains found. Create one with: --create <domain-name>'));
            return;
        }
        
        for (const domain of domains) {
            console.log(chalk.white.bold(`🏷️  ${domain.name}`));
            console.log(chalk.gray(`   Created: ${new Date(domain.created).toLocaleString()}`));
            console.log(chalk.gray(`   Entities: ${domain.actualEntityCount || 0}`));
            console.log(chalk.gray(`   Documents: ${domain.processingStats?.documentsProcessed || 0}`));
            console.log(chalk.gray(`   Total Cost: $${(domain.totalCost || 0).toFixed(4)}`));
            console.log(chalk.gray(`   Path: ${domain.domainPath}`));
            console.log('');
        }
    }

    async createDomain(domainName) {
        console.log(chalk.blue(`📂 Creating domain: ${domainName}`));
        
        await this.diffmem.ensureDomainDirectory(domainName);
        
        console.log(chalk.green(`✅ Domain '${domainName}' created successfully`));
        
        const stats = await this.diffmem.getDomainStats(domainName);
        console.log(chalk.gray(`Path: ${stats.domainPath}`));
    }

    async analyzeDomain(domainName) {
        console.log(chalk.blue.bold(`🔍 Analyzing Domain: ${domainName}\n`));
        
        const stats = await this.diffmem.getDomainStats(domainName);
        
        if (stats.error) {
            console.log(chalk.red(`❌ Error: ${stats.error}`));
            return;
        }
        
        console.log(chalk.white.bold('📊 Domain Statistics'));
        console.log(chalk.white(`Domain: ${stats.domain}`));
        console.log(chalk.white(`Created: ${new Date(stats.created).toLocaleString()}`));
        console.log(chalk.white(`Last Updated: ${new Date(stats.lastUpdated).toLocaleString()}`));
        console.log(chalk.white(`Entities: ${stats.actualEntityCount}`));
        console.log(chalk.white(`Documents: ${stats.processingStats?.documentsProcessed || 0}`));
        console.log(chalk.white(`Total Cost: $${(stats.totalCost || 0).toFixed(4)}`));
        console.log('');
        
        // Analyze entity types
        const entities = await this.diffmem.getAllEntities(domainName);
        
        if (entities.length > 0) {
            console.log(chalk.white.bold('🎯 Entity Analysis'));
            
            const categoryCount = {};
            const sourceFiles = new Set();
            let totalEntities = 0;
            
            entities.forEach(entitySet => {
                if (entitySet.entities) {
                    Object.entries(entitySet.entities).forEach(([category, entityList]) => {
                        if (Array.isArray(entityList)) {
                            categoryCount[category] = (categoryCount[category] || 0) + entityList.length;
                            totalEntities += entityList.length;
                        }
                    });
                }
                
                if (entitySet.metadata?.source) {
                    sourceFiles.add(entitySet.metadata.source);
                }
            });
            
            console.log(chalk.white(`Total Entities: ${totalEntities}`));
            console.log(chalk.white(`Categories: ${Object.keys(categoryCount).length}`));
            console.log(chalk.white(`Source Files: ${sourceFiles.size}`));
            console.log('');
            
            if (Object.keys(categoryCount).length > 0) {
                console.log(chalk.white.bold('📋 Entity Categories'));
                Object.entries(categoryCount)
                    .sort(([,a], [,b]) => b - a)
                    .forEach(([category, count]) => {
                        console.log(chalk.white(`  ${category}: ${count}`));
                    });
                console.log('');
            }
            
            if (sourceFiles.size > 0) {
                console.log(chalk.white.bold('📄 Source Files'));
                Array.from(sourceFiles).slice(0, 10).forEach(source => {
                    console.log(chalk.gray(`  ${path.basename(source)}`));
                });
                if (sourceFiles.size > 10) {
                    console.log(chalk.gray(`  ... and ${sourceFiles.size - 10} more`));
                }
            }
        }
    }

    async migrateLegacyData() {
        console.log(chalk.blue.bold('🔄 Legacy Data Migration\n'));
        
        const legacyPath = path.join(process.cwd(), 'data/mock-diffmem');
        
        if (!(await fs.pathExists(legacyPath))) {
            console.log(chalk.yellow('No legacy data found at data/mock-diffmem'));
            return;
        }
        
        console.log(chalk.white('Found legacy data. Analyzing content...'));
        
        // Analyze legacy data to suggest domains
        const entities = await this.analyzeLegacyData(legacyPath);
        
        if (entities.length === 0) {
            console.log(chalk.yellow('No entities found in legacy data'));
            return;
        }
        
        console.log(chalk.white(`Found ${entities.length} entity sets in legacy data\n`));
        
        // Categorize by source path - check both metadata.source and entities.source
        const cybersecEntities = entities.filter(e => {
            const source = e.source || (e.entities && e.entities.source);
            return source && source.includes('cybersec-dogfood');
        });
        
        const constructionEntities = entities.filter(e => {
            const source = e.source || (e.entities && e.entities.source);
            return source && (source.includes('construction') || this.hasConstructionKeywords(e));
        });
        
        const otherEntities = entities.filter(e => 
            !cybersecEntities.includes(e) && !constructionEntities.includes(e)
        );
        
        console.log(chalk.white.bold('📊 Legacy Data Analysis'));
        console.log(chalk.green(`Cybersecurity entities: ${cybersecEntities.length}`));
        console.log(chalk.blue(`Construction entities: ${constructionEntities.length}`));
        console.log(chalk.gray(`Other entities: ${otherEntities.length}`));
        console.log('');
        
        // Suggest migration plan
        console.log(chalk.white.bold('💡 Suggested Migration Plan'));
        
        if (cybersecEntities.length > 0) {
            console.log(chalk.green(`1. Migrate ${cybersecEntities.length} cybersecurity entities to 'cybersec' domain`));
        }
        
        if (constructionEntities.length > 0) {
            console.log(chalk.blue(`2. Migrate ${constructionEntities.length} construction entities to 'construction' domain`));
        }
        
        if (otherEntities.length > 0) {
            console.log(chalk.gray(`3. Migrate ${otherEntities.length} other entities to 'misc' domain`));
        }
        
        console.log('');
        console.log(chalk.yellow('Run with --migrate-auto to perform automatic migration'));
    }

    async performAutoMigration() {
        console.log(chalk.blue.bold('🚀 Performing Automatic Migration\n'));
        
        const legacyPath = path.join(process.cwd(), 'data/mock-diffmem');
        
        // Create domains
        await this.diffmem.ensureDomainDirectory('cybersec');
        await this.diffmem.ensureDomainDirectory('construction');
        await this.diffmem.ensureDomainDirectory('misc');
        
        // Migrate cybersec data
        console.log(chalk.green('📂 Migrating cybersecurity data...'));
        await this.migrateDomainData(legacyPath, 'cybersec', (entity) => {
            const source = entity.source || (entity.entities && entity.entities.source);
            return source && source.includes('cybersec-dogfood');
        });
        
        // Migrate construction data
        console.log(chalk.blue('📂 Migrating construction data...'));
        await this.migrateDomainData(legacyPath, 'construction', (entity) => {
            const source = entity.source || (entity.entities && entity.entities.source);
            return source && (source.includes('construction') || this.hasConstructionKeywords(entity));
        });
        
        // Migrate remaining data
        console.log(chalk.gray('📂 Migrating other data...'));
        await this.migrateDomainData(legacyPath, 'misc', (entity) => true);
        
        console.log(chalk.green.bold('\n✅ Migration completed!'));
        console.log(chalk.white('Use --list to see the new domain structure'));
    }

    async migrateDomainData(legacyPath, targetDomain, filterFn) {
        const entitiesPath = path.join(legacyPath, 'entities');
        
        if (!(await fs.pathExists(entitiesPath))) return;
        
        const files = await fs.readdir(entitiesPath);
        let migratedCount = 0;
        
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            
            try {
                const filePath = path.join(entitiesPath, file);
                const entityData = await fs.readJson(filePath);
                
                // Check if this entity matches the filter
                const checkData = {
                    ...entityData.metadata,
                    entities: entityData.entities
                };
                if (filterFn(checkData)) {
                    // Copy to target domain
                    const targetPath = path.join(
                        this.diffmem.getDomainPath(targetDomain), 
                        'entities', 
                        file
                    );
                    
                    // Add migration metadata
                    entityData.domain = targetDomain;
                    entityData.migratedFrom = legacyPath;
                    entityData.migrationTimestamp = new Date().toISOString();
                    
                    await fs.writeJson(targetPath, entityData, { spaces: 2 });
                    migratedCount++;
                }
            } catch (error) {
                console.warn(chalk.yellow(`⚠️  Could not migrate ${file}: ${error.message}`));
            }
        }
        
        console.log(chalk.white(`  Migrated ${migratedCount} files to '${targetDomain}' domain`));
    }

    async analyzeLegacyData(legacyPath) {
        const entitiesPath = path.join(legacyPath, 'entities');
        const entities = [];
        
        try {
            const files = await fs.readdir(entitiesPath);
            
            for (const file of files) {
                if (file.endsWith('.json')) {
                    try {
                        const filePath = path.join(entitiesPath, file);
                        const entityData = await fs.readJson(filePath);
                        // Include both metadata and entities fields for analysis
                        entities.push({
                            ...entityData.metadata,
                            entities: entityData.entities
                        });
                    } catch (error) {
                        // Skip invalid files
                    }
                }
            }
        } catch (error) {
            // No entities directory
        }
        
        return entities;
    }

    hasConstructionKeywords(entity) {
        const text = JSON.stringify(entity).toLowerCase();
        const constructionKeywords = [
            'construction', 'building', 'contractor', 'project manager',
            'site', 'materials', 'concrete', 'steel', 'foundation'
        ];
        
        return constructionKeywords.some(keyword => text.includes(keyword));
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    const manager = new DomainManager();
    
    if (args.includes('--help') || args.includes('-h') || args.length === 0) {
        console.log(chalk.blue.bold('Domain Manager'));
        console.log(chalk.white('\nUsage: node domain-manager.js [command] [options]'));
        console.log(chalk.white('\nCommands:'));
        console.log(chalk.white('  --list                 List all domains'));
        console.log(chalk.white('  --create <name>        Create a new domain'));
        console.log(chalk.white('  --analyze <name>       Analyze a domain'));
        console.log(chalk.white('  --migrate-analyze      Analyze legacy data for migration'));
        console.log(chalk.white('  --migrate-auto         Perform automatic migration'));
        console.log(chalk.white('  --help, -h             Show this help'));
        return;
    }
    
    try {
        if (args.includes('--list')) {
            await manager.listDomains();
        } else if (args.includes('--create')) {
            const domainIndex = args.indexOf('--create') + 1;
            const domainName = args[domainIndex];
            if (!domainName) {
                console.error(chalk.red('❌ Domain name is required'));
                return;
            }
            await manager.createDomain(domainName);
        } else if (args.includes('--analyze')) {
            const domainIndex = args.indexOf('--analyze') + 1;
            const domainName = args[domainIndex];
            if (!domainName) {
                console.error(chalk.red('❌ Domain name is required'));
                return;
            }
            await manager.analyzeDomain(domainName);
        } else if (args.includes('--migrate-analyze')) {
            await manager.migrateLegacyData();
        } else if (args.includes('--migrate-auto')) {
            await manager.performAutoMigration();
        } else {
            console.error(chalk.red('❌ Unknown command. Use --help for usage information'));
        }
    } catch (error) {
        console.error(chalk.red('❌ Error:'), error.message);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default DomainManager;
