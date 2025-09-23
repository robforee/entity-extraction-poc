import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';

/**
 * Multi-Domain DiffMem Implementation
 * 
 * Supports separate datastores for different domains (cybersec, construction, etc.)
 * with domain isolation and independent cost tracking.
 */
export class MultiDomainDiffMem {
    constructor(options = {}) {
        this.basePath = options.basePath || path.join(process.cwd(), 'data');
        this.currentDomain = options.domain || 'default';
        this.userId = options.userId || process.env.DIFFMEM_USER_ID || 'test_user';
        this.autoCommit = options.autoCommit !== false;
        
        this.initialize();
    }

    async initialize() {
        // Create base directory structure
        await fs.ensureDir(this.basePath);
        
        // Create domain-specific directory
        await this.ensureDomainDirectory(this.currentDomain);
        
        console.log(chalk.blue(`📂 Initialized multi-domain DiffMem for domain: ${this.currentDomain}`));
    }

    async ensureDomainDirectory(domain) {
        const domainPath = this.getDomainPath(domain);
        
        await fs.ensureDir(domainPath);
        await fs.ensureDir(path.join(domainPath, 'entities'));
        await fs.ensureDir(path.join(domainPath, 'conversations'));
        await fs.ensureDir(path.join(domainPath, 'context'));
        await fs.ensureDir(path.join(domainPath, 'metadata'));

        // Initialize domain metadata
        const metadataPath = path.join(domainPath, 'metadata', 'domain-info.json');
        if (!(await fs.pathExists(metadataPath))) {
            await fs.writeJson(metadataPath, {
                domain: domain,
                created: new Date().toISOString(),
                userId: this.userId,
                version: '1.0.0',
                entityCount: 0,
                conversationCount: 0,
                totalCost: 0,
                lastUpdated: new Date().toISOString(),
                processingStats: {
                    documentsProcessed: 0,
                    entitiesExtracted: 0,
                    averageConfidence: 0,
                    lastProcessingBatch: null
                }
            }, { spaces: 2 });
        }
    }

    getDomainPath(domain = this.currentDomain) {
        return path.join(this.basePath, domain);
    }

    async switchDomain(domain) {
        console.log(chalk.yellow(`🔄 Switching from domain '${this.currentDomain}' to '${domain}'`));
        
        await this.ensureDomainDirectory(domain);
        this.currentDomain = domain;
        
        console.log(chalk.green(`✅ Now using domain: ${domain}`));
    }

    async listDomains() {
        try {
            const items = await fs.readdir(this.basePath);
            const domains = [];
            
            for (const item of items) {
                const itemPath = path.join(this.basePath, item);
                const stat = await fs.stat(itemPath);
                
                if (stat.isDirectory()) {
                    const metadataPath = path.join(itemPath, 'metadata', 'domain-info.json');
                    if (await fs.pathExists(metadataPath)) {
                        const metadata = await fs.readJson(metadataPath);
                        domains.push({
                            name: item,
                            ...metadata
                        });
                    }
                }
            }
            
            return domains;
        } catch (error) {
            console.warn(chalk.yellow('⚠️  Could not list domains'));
            return [];
        }
    }

    async getDomainStats(domain = this.currentDomain) {
        const metadataPath = path.join(this.getDomainPath(domain), 'metadata', 'domain-info.json');
        
        try {
            const metadata = await fs.readJson(metadataPath);
            
            // Count actual entities
            const entitiesDir = path.join(this.getDomainPath(domain), 'entities');
            const entityFiles = await fs.readdir(entitiesDir);
            const actualEntityCount = entityFiles.filter(f => f.endsWith('.json')).length;
            
            return {
                ...metadata,
                actualEntityCount,
                domainPath: this.getDomainPath(domain)
            };
        } catch (error) {
            return {
                domain,
                entityCount: 0,
                conversationCount: 0,
                totalCost: 0,
                error: error.message
            };
        }
    }

    async storeEntities(conversationId, entities, metadata = {}) {
        console.log(chalk.blue(`📝 Storing entities for conversation ${conversationId} in domain '${this.currentDomain}'...`));

        const entityId = uuidv4();
        const timestamp = new Date().toISOString();

        const entityRecord = {
            id: entityId,
            conversationId,
            userId: this.userId,
            domain: this.currentDomain,
            timestamp,
            entities,
            metadata: {
                ...metadata,
                extractionModel: metadata.model || 'unknown',
                extractionProvider: metadata.provider || 'unknown',
                confidence: metadata.confidence || 0,
                processingTime: metadata.duration || 0,
                cost: metadata.cost || 0
            }
        };

        // Store entity record in domain-specific directory
        const entityPath = path.join(this.getDomainPath(), 'entities', `${entityId}.json`);
        await fs.writeJson(entityPath, entityRecord, { spaces: 2 });

        // Update domain metadata
        await this.updateDomainMetadata(entities, metadata.cost || 0);

        // Update conversation index
        await this.updateConversationIndex(conversationId, entityId, entities);

        console.log(chalk.green(`✅ Stored entities in domain '${this.currentDomain}': ${entityId}`));
        return entityId;
    }

    async updateDomainMetadata(entities, cost = 0) {
        const metadataPath = path.join(this.getDomainPath(), 'metadata', 'domain-info.json');
        
        try {
            const metadata = await fs.readJson(metadataPath);
            
            // Count entities
            let entityCount = 0;
            for (const entityList of Object.values(entities)) {
                if (Array.isArray(entityList)) {
                    entityCount += entityList.length;
                }
            }
            
            metadata.entityCount = (metadata.entityCount || 0) + entityCount;
            metadata.conversationCount = (metadata.conversationCount || 0) + 1;
            metadata.totalCost = (metadata.totalCost || 0) + cost;
            metadata.lastUpdated = new Date().toISOString();
            metadata.processingStats.documentsProcessed = (metadata.processingStats.documentsProcessed || 0) + 1;
            metadata.processingStats.entitiesExtracted = (metadata.processingStats.entitiesExtracted || 0) + entityCount;
            
            await fs.writeJson(metadataPath, metadata, { spaces: 2 });
        } catch (error) {
            console.warn(chalk.yellow('⚠️  Could not update domain metadata'));
        }
    }

    async updateConversationIndex(conversationId, entityId, entities) {
        const indexPath = path.join(this.getDomainPath(), 'conversations', 'index.json');
        
        try {
            let index = {};
            if (await fs.pathExists(indexPath)) {
                index = await fs.readJson(indexPath);
            }
            
            if (!index[conversationId]) {
                index[conversationId] = {
                    entities: [],
                    created: new Date().toISOString(),
                    domain: this.currentDomain
                };
            }
            
            index[conversationId].entities.push(entityId);
            index[conversationId].lastUpdated = new Date().toISOString();
            
            await fs.writeJson(indexPath, index, { spaces: 2 });
        } catch (error) {
            console.warn(chalk.yellow('⚠️  Could not update conversation index'));
        }
    }

    async getAllEntities(domain = this.currentDomain) {
        const entitiesDir = path.join(this.getDomainPath(domain), 'entities');
        
        try {
            const files = await fs.readdir(entitiesDir);
            const entities = [];
            
            for (const file of files) {
                if (file.endsWith('.json')) {
                    try {
                        const filePath = path.join(entitiesDir, file);
                        const entityData = await fs.readJson(filePath);
                        entities.push(entityData);
                    } catch (error) {
                        console.warn(chalk.yellow(`⚠️  Could not read entity file: ${file}`));
                    }
                }
            }
            
            return entities;
        } catch (error) {
            console.warn(chalk.yellow(`⚠️  Could not read entities directory for domain: ${domain}`));
            return [];
        }
    }

    async clearDomain(domain) {
        console.log(chalk.yellow(`🗑️  Clearing domain: ${domain}`));
        
        const domainPath = this.getDomainPath(domain);
        
        if (await fs.pathExists(domainPath)) {
            await fs.remove(domainPath);
            console.log(chalk.green(`✅ Domain '${domain}' cleared`));
        } else {
            console.log(chalk.gray(`ℹ️  Domain '${domain}' does not exist`));
        }
    }

    async migrateLegacyData(legacyPath, targetDomain) {
        console.log(chalk.blue(`🔄 Migrating legacy data from ${legacyPath} to domain '${targetDomain}'`));
        
        if (!(await fs.pathExists(legacyPath))) {
            console.log(chalk.yellow('⚠️  Legacy path does not exist'));
            return;
        }
        
        await this.ensureDomainDirectory(targetDomain);
        
        // Copy entities
        const legacyEntitiesPath = path.join(legacyPath, 'entities');
        const targetEntitiesPath = path.join(this.getDomainPath(targetDomain), 'entities');
        
        if (await fs.pathExists(legacyEntitiesPath)) {
            const files = await fs.readdir(legacyEntitiesPath);
            let migratedCount = 0;
            
            for (const file of files) {
                if (file.endsWith('.json')) {
                    try {
                        const sourcePath = path.join(legacyEntitiesPath, file);
                        const targetPath = path.join(targetEntitiesPath, file);
                        
                        // Read and update entity record with domain info
                        const entityData = await fs.readJson(sourcePath);
                        entityData.domain = targetDomain;
                        entityData.migratedFrom = legacyPath;
                        entityData.migrationTimestamp = new Date().toISOString();
                        
                        await fs.writeJson(targetPath, entityData, { spaces: 2 });
                        migratedCount++;
                    } catch (error) {
                        console.warn(chalk.yellow(`⚠️  Could not migrate file: ${file}`));
                    }
                }
            }
            
            console.log(chalk.green(`✅ Migrated ${migratedCount} entity files to domain '${targetDomain}'`));
        }
        
        // Update domain metadata
        const stats = await this.getDomainStats(targetDomain);
        console.log(chalk.blue(`📊 Domain '${targetDomain}' now has ${stats.actualEntityCount} entities`));
    }

    // Legacy compatibility methods
    async getStats() {
        return this.getDomainStats();
    }

    async clear() {
        return this.clearDomain(this.currentDomain);
    }
}

export default MultiDomainDiffMem;
