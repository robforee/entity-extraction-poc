import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';

/**
 * Mock DiffMem Implementation
 * 
 * Simulates DiffMem storage and retrieval operations for entity extraction PoC.
 * This mock system provides the same interface as the real DiffMem system
 * but stores data locally in JSON files.
 */
export class MockDiffMem {
    constructor(options = {}) {
        this.repoPath = options.repoPath || path.join(process.cwd(), 'data/mock-diffmem');
        this.userId = options.userId || process.env.DIFFMEM_USER_ID || 'test_user';
        this.autoCommit = options.autoCommit !== false; // Default to true
        
        this.initialize();
    }

    async initialize() {
        // Create directory structure
        await fs.ensureDir(this.repoPath);
        await fs.ensureDir(path.join(this.repoPath, 'entities'));
        await fs.ensureDir(path.join(this.repoPath, 'conversations'));
        await fs.ensureDir(path.join(this.repoPath, 'context'));
        await fs.ensureDir(path.join(this.repoPath, 'metadata'));

        // Initialize metadata if it doesn't exist
        const metadataPath = path.join(this.repoPath, 'metadata', 'repo-info.json');
        if (!(await fs.pathExists(metadataPath))) {
            await fs.writeJson(metadataPath, {
                created: new Date().toISOString(),
                userId: this.userId,
                version: '1.0.0',
                entityCount: 0,
                conversationCount: 0,
                lastUpdated: new Date().toISOString()
            }, { spaces: 2 });
        }
    }

    /**
     * Store extracted entities from a conversation
     */
    async storeEntities(conversationId, entities, metadata = {}) {
        console.log(chalk.blue(`📝 Storing entities for conversation ${conversationId}...`));

        const entityId = uuidv4();
        const timestamp = new Date().toISOString();

        const entityRecord = {
            id: entityId,
            conversationId,
            userId: this.userId,
            timestamp,
            entities,
            metadata: {
                ...metadata,
                extractionModel: metadata.model || 'unknown',
                extractionProvider: metadata.provider || 'unknown',
                confidence: metadata.confidence || 0,
                processingTime: metadata.duration || 0
            }
        };

        // Store entity record
        const entityPath = path.join(this.repoPath, 'entities', `${entityId}.json`);
        await fs.writeJson(entityPath, entityRecord, { spaces: 2 });

        // Update conversation index
        await this.updateConversationIndex(conversationId, entityId, entities);

        // Update metadata
        await this.updateRepoMetadata();

        console.log(chalk.green(`✅ Stored ${this.countEntities(entities)} entities with ID ${entityId}`));
        
        return entityId;
    }

    /**
     * Retrieve entities by conversation ID
     */
    async getEntitiesByConversation(conversationId) {
        const conversationPath = path.join(this.repoPath, 'conversations', `${conversationId}.json`);
        
        if (!(await fs.pathExists(conversationPath))) {
            return [];
        }

        const conversationIndex = await fs.readJson(conversationPath);
        const entities = [];

        for (const entityId of conversationIndex.entityIds || []) {
            const entityPath = path.join(this.repoPath, 'entities', `${entityId}.json`);
            if (await fs.pathExists(entityPath)) {
                const entityRecord = await fs.readJson(entityPath);
                entities.push(entityRecord);
            }
        }

        return entities;
    }

    /**
     * Search entities by type and criteria
     */
    async searchEntities(query) {
        console.log(chalk.blue(`🔍 Searching entities: ${JSON.stringify(query)}`));

        const results = [];
        const entitiesDir = path.join(this.repoPath, 'entities');
        
        if (!(await fs.pathExists(entitiesDir))) {
            return results;
        }

        const entityFiles = await fs.readdir(entitiesDir);

        for (const filename of entityFiles) {
            if (!filename.endsWith('.json')) continue;

            const entityPath = path.join(entitiesDir, filename);
            const entityRecord = await fs.readJson(entityPath);

            if (this.matchesQuery(entityRecord, query)) {
                results.push(entityRecord);
            }
        }

        // Sort by relevance and timestamp
        results.sort((a, b) => {
            const scoreA = this.calculateRelevanceScore(a, query);
            const scoreB = this.calculateRelevanceScore(b, query);
            
            if (scoreA !== scoreB) {
                return scoreB - scoreA; // Higher score first
            }
            
            return new Date(b.timestamp) - new Date(a.timestamp); // Newer first
        });

        console.log(chalk.green(`✅ Found ${results.length} matching entities`));
        return results;
    }

    /**
     * Get context for a specific query
     */
    async getContext(query, options = {}) {
        const maxEntities = options.maxEntities || 20;
        const maxAge = options.maxAge || 30; // days
        const minConfidence = options.minConfidence || 0.5;

        console.log(chalk.blue(`🧠 Generating context for query: "${query}"`));

        // Search for relevant entities
        const searchQuery = this.parseQuery(query);
        const entities = await this.searchEntities(searchQuery);

        // Filter by age and confidence
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - maxAge);

        const relevantEntities = entities
            .filter(entity => {
                const entityDate = new Date(entity.timestamp);
                const confidence = entity.metadata?.confidence || 0;
                return entityDate >= cutoffDate && confidence >= minConfidence;
            })
            .slice(0, maxEntities);

        // Generate context summary
        const context = await this.generateContextSummary(relevantEntities, query);

        console.log(chalk.green(`✅ Generated context with ${relevantEntities.length} entities`));
        
        return {
            query,
            entities: relevantEntities,
            summary: context,
            metadata: {
                entityCount: relevantEntities.length,
                maxAge,
                minConfidence,
                generatedAt: new Date().toISOString()
            }
        };
    }

    /**
     * Store conversation context for future retrieval
     */
    async storeContext(contextId, context) {
        const contextPath = path.join(this.repoPath, 'context', `${contextId}.json`);
        await fs.writeJson(contextPath, {
            id: contextId,
            ...context,
            storedAt: new Date().toISOString()
        }, { spaces: 2 });

        return contextId;
    }

    /**
     * Helper methods
     */
    
    async updateConversationIndex(conversationId, entityId, entities) {
        const conversationPath = path.join(this.repoPath, 'conversations', `${conversationId}.json`);
        
        let conversationIndex;
        if (await fs.pathExists(conversationPath)) {
            conversationIndex = await fs.readJson(conversationPath);
        } else {
            conversationIndex = {
                id: conversationId,
                created: new Date().toISOString(),
                entityIds: [],
                entitySummary: {}
            };
        }

        conversationIndex.entityIds.push(entityId);
        conversationIndex.lastUpdated = new Date().toISOString();
        
        // Update entity summary
        for (const [entityType, entityList] of Object.entries(entities)) {
            if (!conversationIndex.entitySummary[entityType]) {
                conversationIndex.entitySummary[entityType] = 0;
            }
            conversationIndex.entitySummary[entityType] += entityList.length;
        }

        await fs.writeJson(conversationPath, conversationIndex, { spaces: 2 });
    }

    async updateRepoMetadata() {
        const metadataPath = path.join(this.repoPath, 'metadata', 'repo-info.json');
        const metadata = await fs.readJson(metadataPath);

        // Count entities and conversations
        const entitiesDir = path.join(this.repoPath, 'entities');
        const conversationsDir = path.join(this.repoPath, 'conversations');

        const entityFiles = await fs.readdir(entitiesDir).catch(() => []);
        const conversationFiles = await fs.readdir(conversationsDir).catch(() => []);

        metadata.entityCount = entityFiles.filter(f => f.endsWith('.json')).length;
        metadata.conversationCount = conversationFiles.filter(f => f.endsWith('.json')).length;
        metadata.lastUpdated = new Date().toISOString();

        await fs.writeJson(metadataPath, metadata, { spaces: 2 });
    }

    matchesQuery(entityRecord, query) {
        // Simple matching logic - in real DiffMem this would be more sophisticated
        if (query.entityType) {
            const hasType = entityRecord.entities[query.entityType] && 
                           entityRecord.entities[query.entityType].length > 0;
            if (!hasType) return false;
        }

        if (query.conversationId) {
            if (entityRecord.conversationId !== query.conversationId) return false;
        }

        if (query.userId) {
            if (entityRecord.userId !== query.userId) return false;
        }

        if (query.text) {
            const searchText = query.text.toLowerCase();
            const entityText = JSON.stringify(entityRecord.entities).toLowerCase();
            if (!entityText.includes(searchText)) return false;
        }

        if (query.minConfidence) {
            const confidence = entityRecord.metadata?.confidence || 0;
            if (confidence < query.minConfidence) return false;
        }

        return true;
    }

    calculateRelevanceScore(entityRecord, query) {
        let score = 0;

        // Base score from confidence
        score += (entityRecord.metadata?.confidence || 0) * 10;

        // Bonus for matching entity types
        if (query.entityType && entityRecord.entities[query.entityType]) {
            score += entityRecord.entities[query.entityType].length * 5;
        }

        // Bonus for text matches
        if (query.text) {
            const searchText = query.text.toLowerCase();
            const entityText = JSON.stringify(entityRecord.entities).toLowerCase();
            const matches = (entityText.match(new RegExp(searchText, 'g')) || []).length;
            score += matches * 3;
        }

        // Recency bonus (newer is better)
        const age = Date.now() - new Date(entityRecord.timestamp).getTime();
        const daysSinceCreation = age / (1000 * 60 * 60 * 24);
        score += Math.max(0, 10 - daysSinceCreation); // Up to 10 points for recent entities

        return score;
    }

    parseQuery(query) {
        // Simple query parsing - extract key terms and entity types
        const parsed = {
            text: query
        };

        // Look for entity type hints
        const entityTypes = ['person', 'project', 'decision', 'timeline', 'cost', 'material', 'issue', 'task'];
        for (const type of entityTypes) {
            if (query.toLowerCase().includes(type)) {
                parsed.entityType = type + 's'; // Pluralize for storage format
                break;
            }
        }

        // Look for names (capitalized words)
        const names = query.match(/\b[A-Z][a-z]+\b/g);
        if (names && names.length > 0) {
            parsed.names = names;
        }

        return parsed;
    }

    async generateContextSummary(entities, query) {
        if (entities.length === 0) {
            return `No relevant information found for query: "${query}"`;
        }

        const summary = {
            totalEntities: entities.length,
            entityTypes: {},
            keyPeople: new Set(),
            keyProjects: new Set(),
            recentDecisions: [],
            timelineItems: [],
            costInformation: [],
            issues: []
        };

        // Analyze entities
        for (const entityRecord of entities) {
            for (const [entityType, entityList] of Object.entries(entityRecord.entities)) {
                if (!summary.entityTypes[entityType]) {
                    summary.entityTypes[entityType] = 0;
                }
                summary.entityTypes[entityType] += entityList.length;

                // Extract key information
                for (const entity of entityList) {
                    switch (entityType) {
                        case 'people':
                            if (entity.name) summary.keyPeople.add(entity.name);
                            break;
                        case 'projects':
                            if (entity.name) summary.keyProjects.add(entity.name);
                            break;
                        case 'decisions':
                            summary.recentDecisions.push({
                                type: entity.type,
                                description: entity.description,
                                date: entity.date,
                                confidence: entity.confidence
                            });
                            break;
                        case 'timeline':
                            summary.timelineItems.push({
                                event: entity.event,
                                status: entity.status,
                                date: entity.date,
                                confidence: entity.confidence
                            });
                            break;
                        case 'costs':
                            summary.costInformation.push({
                                amount: entity.amount,
                                type: entity.type,
                                category: entity.category,
                                confidence: entity.confidence
                            });
                            break;
                        case 'issues':
                            summary.issues.push({
                                description: entity.description,
                                severity: entity.severity,
                                status: entity.status,
                                confidence: entity.confidence
                            });
                            break;
                    }
                }
            }
        }

        // Convert sets to arrays
        summary.keyPeople = Array.from(summary.keyPeople);
        summary.keyProjects = Array.from(summary.keyProjects);

        // Generate text summary
        let textSummary = `Context for "${query}":\n\n`;
        
        if (summary.keyPeople.length > 0) {
            textSummary += `Key People: ${summary.keyPeople.join(', ')}\n`;
        }
        
        if (summary.keyProjects.length > 0) {
            textSummary += `Active Projects: ${summary.keyProjects.join(', ')}\n`;
        }
        
        if (summary.recentDecisions.length > 0) {
            textSummary += `Recent Decisions: ${summary.recentDecisions.slice(0, 3).map(d => d.description).join('; ')}\n`;
        }
        
        if (summary.timelineItems.length > 0) {
            textSummary += `Timeline Items: ${summary.timelineItems.slice(0, 3).map(t => t.event).join('; ')}\n`;
        }
        
        if (summary.issues.length > 0) {
            textSummary += `Active Issues: ${summary.issues.slice(0, 2).map(i => i.description).join('; ')}\n`;
        }

        return {
            structured: summary,
            text: textSummary.trim()
        };
    }

    countEntities(entities) {
        let count = 0;
        for (const entityList of Object.values(entities)) {
            if (Array.isArray(entityList)) {
                count += entityList.length;
            }
        }
        return count;
    }

    /**
     * Get all stored entities
     */
    async getAllEntities() {
        const entitiesDir = path.join(this.repoPath, 'entities');
        
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
            console.warn(chalk.yellow('⚠️  Could not read entities directory'));
            return [];
        }
    }

    /**
     * Get repository statistics
     */
    async getStats() {
        const metadataPath = path.join(this.repoPath, 'metadata', 'repo-info.json');
        const metadata = await fs.readJson(metadataPath).catch(() => ({
            entityCount: 0,
            conversationCount: 0
        }));

        return {
            entityCount: metadata.entityCount || 0,
            conversationCount: metadata.conversationCount || 0,
            lastUpdated: metadata.lastUpdated,
            userId: this.userId,
            repoPath: this.repoPath
        };
    }

    /**
     * Clear all data (for testing)
     */
    async clear() {
        await fs.remove(this.repoPath);
        await this.initialize();
        console.log(chalk.yellow('🗑️  Mock DiffMem cleared'));
    }
}

export default MockDiffMem;
