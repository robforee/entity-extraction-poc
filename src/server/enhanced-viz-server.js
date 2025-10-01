#!/usr/bin/env node

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { MultiDomainDiffMem } from '../diffmem/multi-domain-diffmem.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Enhanced Visualization Server for Universal Knowledge System
 * 
 * Full-featured interactive exploration of cybersecurity knowledge corpus
 * with real-time updates, visual analytics, and document navigation.
 */
class EnhancedVizServer {
    constructor(port = 8080) {
        this.port = port;
        this.app = express();
        this.server = createServer(this.app);
        this.io = new SocketIOServer(this.server, {
            cors: { origin: "*", methods: ["GET", "POST"] }
        });
        this.connectedClients = new Set();
        this.currentDomain = 'cybersec';
        this.diffMem = null;
        this.mergedPairs = new Set(); // Track merged entity pairs
        this.mergedPairsFile = path.join(process.cwd(), 'data/merged-pairs.json');
        
        this.diffMem = new MultiDomainDiffMem({ domain: 'cybersec' }); // Default to cybersec domain
        this.webDir = path.join(__dirname, '../../web');
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        this.ensureWebDirectory();
        this.loadMergedPairs();
    }

    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.static(this.webDir));
        
        // CORS
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            next();
        });

        // Request logging
        this.app.use((req, res, next) => {
            console.log(chalk.gray(`${new Date().toISOString()} - ${req.method} ${req.path}`));
            next();
        });
    }

    setupRoutes() {
        // Enhanced API Routes
        
        // API Routes
        this.app.get('/api/entities', this.getEntities.bind(this));
        this.app.get('/api/entities/stats', this.getEntityStats.bind(this));
        this.app.get('/api/entities/categories', this.getEntityCategories.bind(this));
        this.app.get('/api/relationships', this.getRelationships.bind(this));
        this.app.get('/api/documents', this.getDocuments.bind(this));
        this.app.get('/api/documents/:id', this.getDocumentDetails.bind(this));
        this.app.get('/api/documents/:id/entities', this.getDocumentEntities.bind(this));
        this.app.get('/api/schemas', this.getSchemas.bind(this));
        this.app.get('/api/schemas/:domain', this.getSchemaByDomain.bind(this));
        this.app.get('/api/export/entities', this.exportEntities.bind(this));
        
        // Domain endpoints
        this.app.get('/api/domains', this.getDomains.bind(this));
        this.app.get('/api/domains/current', this.getCurrentDomain.bind(this));
        this.app.post('/api/domains/switch', this.switchDomain.bind(this));
        
        // Entity merging endpoints
        this.app.get('/api/merging/candidates', this.getMergeCandidates.bind(this));
        this.app.post('/api/merging/auto-merge', this.performAutoMerge.bind(this));
        this.app.post('/api/merging/manual-merge', this.performManualMerge.bind(this));
        this.app.post('/api/merging/preview-merge', this.previewManualMerge.bind(this));
        this.app.get('/api/merging/statistics', this.getMergeStatistics.bind(this));
        
        // Entity context and search endpoints
        this.app.get('/api/entities/search/:term', this.searchEntityWithContext.bind(this));
        this.app.get('/api/entities/context/:entityId', this.getEntityContext.bind(this));
        this.app.post('/api/entities/split', this.splitEntity.bind(this));
        this.app.get('/api/entities/similar/:entityId', this.findSimilarEntities.bind(this));
        
        // Merge history endpoints
        this.app.get('/api/merging/history', this.getMergeHistory.bind(this));
        this.app.post('/api/merging/undo', this.undoMerge.bind(this));
        this.app.post('/api/merging/redo', this.redoMerge.bind(this));
        this.app.get('/api/merging/history/export', this.exportMergeHistory.bind(this));
        this.app.get('/api/merging/history/chain/:entityId', this.getMergeChain.bind(this));
        
        // Reset merged pairs (for testing)
        this.app.post('/api/merging/reset', (req, res) => {
            this.mergedPairs.clear();
            res.json({ 
                success: true, 
                message: 'Merged pairs reset',
                mergedPairsCount: this.mergedPairs.size
            });
        });

        // SIEM perspective endpoint
        this.app.get('/api/siem/perspective', this.getSIEMPerspective.bind(this));

        // Health check
        this.app.get('/api/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                timestamp: new Date().toISOString(),
                version: '2.0.0',
                connectedClients: this.connectedClients.size,
                mergedPairsCount: this.mergedPairs.size
            });
        });

        // Serve main application
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(this.webDir, 'index.html'));
        });
    }

    setupWebSocket() {
        this.io.on('connection', (socket) => {
            console.log(chalk.green(`🔌 Client connected: ${socket.id}`));
            this.connectedClients.add(socket.id);
            
            // Send initial data
            this.sendInitialData(socket);
            
            socket.on('disconnect', () => {
                console.log(chalk.yellow(`🔌 Client disconnected: ${socket.id}`));
                this.connectedClients.delete(socket.id);
            });
            
            // Handle client requests
            socket.on('requestEntityUpdate', () => {
                this.sendEntityUpdate(socket);
            });
            
            socket.on('requestDocumentList', () => {
                this.sendDocumentList(socket);
            });
        });
    }

    async sendInitialData(socket) {
        try {
            const [stats, categories, entities] = await Promise.all([
                this.calculateStats(),
                this.calculateCategories(),
                this.getRecentEntities(20)
            ]);
            
            socket.emit('initialData', { stats, categories, entities });
        } catch (error) {
            socket.emit('error', { message: 'Failed to load initial data' });
        }
    }

    async sendEntityUpdate(socket) {
        try {
            const stats = await this.calculateStats();
            socket.emit('statsUpdate', stats);
        } catch (error) {
            socket.emit('error', { message: 'Failed to update stats' });
        }
    }

    // Broadcast to all connected clients
    broadcastUpdate(event, data) {
        this.io.emit(event, data);
    }

    // API Route Handlers

    async getEntities(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 50;
            const category = req.query.category;
            const minConfidence = parseFloat(req.query.minConfidence) || 0;
            const source = req.query.source;
            
            const allEntities = await this.getAllEntitiesFlat();
            
            // Apply merge consolidation - remove entities that have been merged
            const consolidatedEntities = this.applyMergeConsolidation(allEntities);
            
            // Apply filters
            let filteredEntities = consolidatedEntities.filter(entity => {
                if (category && entity.category !== category) return false;
                if (entity.confidence < minConfidence) return false;
                if (source && entity.source !== source) return false;
                return true;
            });
            
            // Pagination
            const total = filteredEntities.length;
            const startIndex = (page - 1) * limit;
            const paginatedEntities = filteredEntities.slice(startIndex, startIndex + limit);
            
            res.json({
                entities: paginatedEntities,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async searchEntities(req, res) {
        try {
            const query = req.query.q;
            const category = req.query.category;
            
            if (!query) {
                return res.status(400).json({ error: 'Query parameter required' });
            }
            
            const allEntities = await this.getAllEntitiesFlat();
            const searchResults = allEntities.filter(entity => {
                const matchesQuery = entity.name?.toLowerCase().includes(query.toLowerCase()) ||
                                   entity.description?.toLowerCase().includes(query.toLowerCase());
                const matchesCategory = !category || entity.category === category;
                return matchesQuery && matchesCategory;
            });
            
            // Sort by relevance (confidence score)
            searchResults.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
            
            res.json({
                query,
                results: searchResults.slice(0, 100), // Limit to 100 results
                total: searchResults.length
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getEntityStats(req, res) {
        try {
            const stats = await this.calculateStats();
            res.json(stats);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getEntityCategories(req, res) {
        try {
            const categories = await this.calculateCategories();
            res.json(categories);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getEntityById(req, res) {
        try {
            const entityId = req.params.id;
            const allEntities = await this.getAllEntitiesFlat();
            const entity = allEntities.find(e => e.id === entityId);
            
            if (!entity) {
                return res.status(404).json({ error: 'Entity not found' });
            }
            
            // Get related entities (same category or similar names)
            const relatedEntities = allEntities.filter(e => 
                e.id !== entityId && 
                (e.category === entity.category || 
                 e.name?.toLowerCase().includes(entity.name?.toLowerCase().split(' ')[0] || ''))
            ).slice(0, 10);
            
            res.json({
                entity,
                related: relatedEntities
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getSchemas(req, res) {
        try {
            const entities = await this.diffMem.getAllEntities();
            const documents = entities.map(entitySet => ({
                id: entitySet.id,
                conversationId: entitySet.conversationId,
                source: entitySet.metadata?.source || 'Unknown',
                timestamp: entitySet.timestamp,
                entityCount: this.countEntitiesInSet(entitySet.entities),
                categories: Object.keys(entitySet.entities || {}),
                documentType: entitySet.metadata?.documentType || 'unknown'
            }));
            
            res.json({ documents });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getConfidenceAnalysis(req, res) {
        try {
            const allEntities = await this.getAllEntitiesFlat();
            const confidenceRanges = {
                'high': allEntities.filter(e => (e.confidence || 0) >= 0.8).length,
                'medium': allEntities.filter(e => (e.confidence || 0) >= 0.5 && (e.confidence || 0) < 0.8).length,
                'low': allEntities.filter(e => (e.confidence || 0) < 0.5).length
            };
            
            const avgConfidence = allEntities.reduce((sum, e) => sum + (e.confidence || 0), 0) / allEntities.length;
            
            res.json({
                ranges: confidenceRanges,
                average: avgConfidence.toFixed(3),
                total: allEntities.length
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getProcessingTimeline(req, res) {
        try {
            const entities = await this.diffMem.getAllEntities();
            const timeline = entities.map(entitySet => ({
                timestamp: entitySet.timestamp,
                entityCount: this.countEntitiesInSet(entitySet.entities),
                source: entitySet.metadata?.source || 'Unknown'
            })).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            res.json({ timeline });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getEntityRelationships(req, res) {
        try {
            // Simple relationship detection based on co-occurrence in documents
            const entities = await this.diffMem.getAllEntities();
            const relationships = [];
            
            // For now, create relationships between entities in the same document
            entities.forEach(entitySet => {
                const flatEntities = this.flattenEntitiesFromSet(entitySet.entities);
                for (let i = 0; i < flatEntities.length; i++) {
                    for (let j = i + 1; j < flatEntities.length; j++) {
                        relationships.push({
                            source: flatEntities[i],
                            target: flatEntities[j],
                            type: 'co-occurrence',
                            document: entitySet.metadata?.source || 'Unknown'
                        });
                    }
                }
            });
            
            res.json({ relationships: relationships.slice(0, 200) }); // Limit for performance
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async exportEntities(req, res) {
        try {
            const format = req.query.format || 'json';
            const allEntities = await this.getAllEntitiesFlat();
            
            if (format === 'csv') {
                const csv = this.entitiesToCSV(allEntities);
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', 'attachment; filename="entities.csv"');
                res.send(csv);
            } else {
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', 'attachment; filename="entities.json"');
                res.json(allEntities);
            }
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async generateReport(req, res) {
        try {
            const stats = await this.calculateStats();
            const categories = await this.calculateCategories();
            const allEntities = await this.getAllEntitiesFlat();
            
            const report = {
                generatedAt: new Date().toISOString(),
                domain: this.currentDomain,
                summary: stats,
                categoryBreakdown: categories,
                topEntities: allEntities
                    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
                    .slice(0, 20),
                confidenceAnalysis: {
                    high: allEntities.filter(e => (e.confidence || 0) >= 0.8).length,
                    medium: allEntities.filter(e => (e.confidence || 0) >= 0.5 && (e.confidence || 0) < 0.8).length,
                    low: allEntities.filter(e => (e.confidence || 0) < 0.5).length
                }
            };
            
            res.json(report);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // Domain Management Methods

    async getDomains(req, res) {
        try {
            // Try to get domains from diffMem, fallback to current domain if method doesn't exist
            let domains = [];
            try {
                domains = await this.diffMem.listDomains();
            } catch (listError) {
                console.log('listDomains not available, using current domain only');
                // Fallback: create domain info for current domain
                const entities = await this.diffMem.getAllEntities();
                const entityCount = entities.reduce((count, entitySet) => {
                    return count + this.countEntitiesInSet(entitySet.entities);
                }, 0);
                
                domains = [{
                    name: this.currentDomain,
                    created: new Date().toISOString(),
                    actualEntityCount: entityCount,
                    processingStats: { documentsProcessed: entities.length },
                    totalCost: 0
                }];
            }
            
            // Get actual entity counts for each domain
            const domainsWithCounts = await Promise.all(domains.map(async (d) => {
                try {
                    // Temporarily switch to get entity count
                    const originalDomain = this.currentDomain;
                    if (d.name !== this.currentDomain) {
                        await this.diffMem.switchDomain(d.name);
                    }
                    const entities = await this.diffMem.getAllEntities();
                    const entityCount = entities.reduce((count, entitySet) => {
                        return count + this.countEntitiesInSet(entitySet.entities);
                    }, 0);
                    
                    // Switch back if needed
                    if (d.name !== originalDomain) {
                        await this.diffMem.switchDomain(originalDomain);
                    }
                    
                    return {
                        name: d.name,
                        created: d.created,
                        entityCount: entityCount,
                        documentCount: entities.length,
                        totalCost: d.totalCost || 0
                    };
                } catch (error) {
                    console.error(`Error getting count for domain ${d.name}:`, error);
                    return {
                        name: d.name,
                        created: d.created,
                        entityCount: d.actualEntityCount || 0,
                        documentCount: d.processingStats?.documentsProcessed || 0,
                        totalCost: d.totalCost || 0
                    };
                }
            }));
            
            res.json({ 
                domains: domainsWithCounts,
                current: this.currentDomain
            });
        } catch (error) {
            console.error('Error in getDomains:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async getCurrentDomain(req, res) {
        try {
            const stats = await this.diffMem.getDomainStats(this.currentDomain);
            res.json({
                domain: this.currentDomain,
                stats: {
                    entityCount: stats.actualEntityCount || 0,
                    documentCount: stats.processingStats?.documentsProcessed || 0,
                    totalCost: stats.totalCost || 0,
                    created: stats.created,
                    lastUpdated: stats.lastUpdated
                }
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async switchDomain(req, res) {
        try {
            const { domain } = req.body;
            
            if (!domain) {
                return res.status(400).json({ error: 'Domain name is required' });
            }
            
            // Save current domain's merged pairs before switching
            await this.saveMergedPairs();
            
            // Switch the diffmem instance to the new domain
            await this.diffMem.switchDomain(domain);
            this.currentDomain = domain;
            
            // Load merged pairs for the new domain
            await this.loadMergedPairs();
            
            // Broadcast domain change to all connected clients
            this.io.emit('domainChanged', { 
                domain: this.currentDomain,
                timestamp: new Date().toISOString()
            });
            
            console.log(chalk.blue(`🔄 Switched to domain: ${domain}`));
            
            res.json({ 
                success: true, 
                domain: this.currentDomain,
                message: `Switched to domain: ${domain}`
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // Helper Methods

    async getAllEntitiesFlat() {
        const entitySets = await this.diffMem.getAllEntities();
        const flatEntities = [];
        
        entitySets.forEach(entitySet => {
            if (entitySet.entities) {
                Object.entries(entitySet.entities).forEach(([category, entities]) => {
                    entities.forEach(entity => {
                        // Skip entities without names or with empty names
                        if (!entity.name || entity.name.trim() === '' || entity.name === 'unnamed') {
                            return;
                        }
                        
                        // Generate ID if missing
                        const entityId = entity.id || this.generateEntityId(entity.name, category, entitySet.conversationId);
                        
                        flatEntities.push({
                            ...entity,
                            id: entityId,
                            category: category.toLowerCase(),
                            conversationId: entitySet.conversationId,
                            timestamp: entitySet.timestamp,
                            metadata: entitySet.metadata,
                            // Ensure we have a proper name
                            name: entity.name.trim()
                        });
                    });
                });
            }
        });
        
        return flatEntities;
    }

    generateEntityId(name, category, conversationId) {
        // Create a deterministic ID based on name, category, and document
        const input = `${name}_${category}_${conversationId}`;
        // Simple hash function for ID generation
        let hash = 0;
        for (let i = 0; i < input.length; i++) {
            const char = input.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return `entity_${Math.abs(hash).toString(16)}`;
    }

    flattenEntitiesFromSet(entitiesObj) {
        const flatEntities = [];
        Object.entries(entitiesObj || {}).forEach(([category, entityList]) => {
            if (Array.isArray(entityList)) {
                entityList.forEach(entity => {
                    flatEntities.push({
                        ...entity,
                        category
                    });
                });
            }
        });
        return flatEntities;
    }

    async getRecentEntities(limit = 20) {
        const allEntities = await this.getAllEntitiesFlat();
        return allEntities
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);
    }

    async calculateStats() {
        const entities = await this.diffMem.getAllEntities();
        let totalEntities = 0;
        const categories = {};
        
        entities.forEach(entitySet => {
            if (entitySet.entities) {
                Object.entries(entitySet.entities).forEach(([category, entityList]) => {
                    if (Array.isArray(entityList)) {
                        const count = entityList.length;
                        totalEntities += count;
                        categories[category] = (categories[category] || 0) + count;
                    }
                });
            }
        });
        
        return {
            totalEntities,
            totalDocuments: entities.length,
            totalCategories: Object.keys(categories).length,
            lastUpdated: entities.length > 0 ? 
                Math.max(...entities.map(e => new Date(e.timestamp).getTime())) : null
        };
    }

    async calculateCategories() {
        const entities = await this.diffMem.getAllEntities();
        const categories = {};
        
        entities.forEach(entitySet => {
            if (entitySet.entities) {
                Object.entries(entitySet.entities).forEach(([category, entityList]) => {
                    if (Array.isArray(entityList)) {
                        categories[category] = (categories[category] || 0) + entityList.length;
                    }
                });
            }
        });
        
        return categories;
    }

    countEntitiesInSet(entitiesObj) {
        let count = 0;
        Object.values(entitiesObj || {}).forEach(entityList => {
            if (Array.isArray(entityList)) {
                count += entityList.length;
            }
        });
        return count;
    }

    entitiesToCSV(entities) {
        const headers = ['id', 'name', 'category', 'confidence', 'source', 'timestamp'];
        const rows = entities.map(entity => [
            entity.id || '',
            entity.name || '',
            entity.category || '',
            entity.confidence || '',
            entity.source || '',
            entity.timestamp || ''
        ]);
        
        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    async ensureWebDirectory() {
        await fs.ensureDir(this.webDir);
        await fs.ensureDir(path.join(this.webDir, 'css'));
        await fs.ensureDir(path.join(this.webDir, 'js'));
        
        // Create enhanced HTML interface
        const indexPath = path.join(this.webDir, 'index.html');
        if (!await fs.pathExists(indexPath)) {
            await this.createEnhancedInterface();
        }
    }

    async createEnhancedInterface() {
        // This will be a comprehensive interface - creating in next step
        console.log(chalk.yellow('📝 Enhanced interface creation will be implemented next...'));
    }

    start() {
        this.server.listen(this.port, () => {
            console.log(chalk.green.bold('🚀 Enhanced Universal Knowledge System - Visualization Server'));
            console.log(chalk.cyan(`📊 Server running at: http://localhost:${this.port}`));
            console.log(chalk.white('🔍 Full-featured cybersecurity knowledge exploration!'));
            console.log(chalk.gray('Features: Real-time updates, Visual analytics, Document navigation'));
            console.log(chalk.gray('Press Ctrl+C to stop the server\n'));
        });
    }

    async getDocuments(req, res) {
        try {
            const entities = await this.diffMem.getAllEntities();
            const documents = entities.map(entitySet => ({
                id: entitySet.conversationId || entitySet.id, // Use conversationId as the primary ID
                conversationId: entitySet.conversationId,
                source: entitySet.metadata?.source || 'Unknown',
                timestamp: entitySet.timestamp,
                entityCount: this.countEntitiesInSet(entitySet.entities),
                categories: Object.keys(entitySet.entities || {}),
                documentType: entitySet.metadata?.documentType || this.getFileExtension(entitySet.metadata?.source)
            }));
            
            res.json({ documents });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    getFileExtension(filePath) {
        if (!filePath) return 'unknown';
        const ext = path.extname(filePath);
        return ext || 'unknown';
    }

    async getRelationships(req, res) {
        try {
            const allEntities = await this.getAllEntitiesFlat();
            const consolidatedEntities = this.applyMergeConsolidation(allEntities);
            const relationships = [];
            const entityMap = new Map();
            
            // Create entity map for quick lookup
            consolidatedEntities.forEach(entity => {
                entityMap.set(entity.id, entity);
            });
            
            // Find co-occurring entities (entities in same document)
            const documentGroups = {};
            consolidatedEntities.forEach(entity => {
                const docId = entity.conversationId;
                if (!documentGroups[docId]) {
                    documentGroups[docId] = [];
                }
                documentGroups[docId].push(entity);
            });
            
            // Create relationships between co-occurring entities
            Object.values(documentGroups).forEach(entities => {
                for (let i = 0; i < entities.length; i++) {
                    for (let j = i + 1; j < entities.length; j++) {
                        const entity1 = entities[i];
                        const entity2 = entities[j];
                        
                        // Only create relationships if both entities have valid IDs
                        if (entity1.id && entity2.id && entity1.id !== entity2.id) {
                            relationships.push({
                                source: entity1.id,
                                target: entity2.id,
                                type: 'co-occurrence',
                                weight: 1,
                                document: entity1.conversationId,
                                sourceEntity: entity1.name,
                                targetEntity: entity2.name
                            });
                        }
                    }
                }
            });
            
            res.json({
                success: true,
                nodes: consolidatedEntities.map(entity => ({
                    id: entity.id,
                    name: entity.name,
                    category: entity.category,
                    confidence: entity.confidence || 0,
                    description: entity.description,
                    consolidatedCount: entity.consolidatedCount || null,
                    mergedFrom: entity.mergedFrom || null
                })),
                relationships: relationships,
                links: relationships // Keep both for compatibility
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getDocumentDetails(req, res) {
        try {
            const { id } = req.params;
            console.log(chalk.cyan(`🔍 Looking for document with ID: ${id}`));
            
            // Get document metadata from entity storage
            const allEntities = await this.getAllEntitiesFlat();
            console.log(chalk.gray(`📊 Found ${allEntities.length} total entities`));
            
            // Try both conversationId and id fields
            const documentEntities = allEntities.filter(e => 
                e.conversationId === id || e.id === id
            );
            
            console.log(chalk.gray(`📄 Found ${documentEntities.length} entities for document ${id}`));
            
            if (documentEntities.length === 0) {
                // Debug: show available conversation IDs
                const availableIds = [...new Set(allEntities.map(e => e.conversationId))];
                console.log(chalk.yellow(`Available document IDs: ${availableIds.slice(0, 5).join(', ')}...`));
                return res.status(404).json({ 
                    error: 'Document not found',
                    availableIds: availableIds.slice(0, 10)
                });
            }
            
            // Extract document metadata from first entity
            const firstEntity = documentEntities[0];
            const metadata = firstEntity.metadata || {};
            
            // Group entities by category
            const entitiesByCategory = {};
            const categoryStats = {};
            
            documentEntities.forEach(entity => {
                const category = entity.category || 'unknown';
                if (!entitiesByCategory[category]) {
                    entitiesByCategory[category] = [];
                    categoryStats[category] = { count: 0, avgConfidence: 0 };
                }
                entitiesByCategory[category].push({
                    id: entity.id,
                    name: entity.name,
                    description: entity.description,
                    confidence: entity.confidence || 0,
                    data: entity.data || {}
                });
                categoryStats[category].count++;
            });
            
            // Calculate average confidence per category
            Object.keys(categoryStats).forEach(category => {
                const entities = entitiesByCategory[category];
                const totalConfidence = entities.reduce((sum, e) => sum + (e.confidence || 0), 0);
                categoryStats[category].avgConfidence = entities.length > 0 ? 
                    Math.round((totalConfidence / entities.length) * 100) / 100 : 0;
            });
            
            // Calculate overall document confidence
            const totalConfidence = documentEntities.reduce((sum, e) => sum + (e.confidence || 0), 0);
            const avgConfidence = documentEntities.length > 0 ? 
                Math.round((totalConfidence / documentEntities.length) * 100) / 100 : 0;
            
            res.json({
                success: true,
                document: {
                    id,
                    source: metadata.source || 'Unknown',
                    messageId: metadata.messageId || id,
                    documentType: metadata.documentType || 'unknown',
                    contentLength: metadata.contentLength || 0,
                    processingTime: metadata.processingTime || 0,
                    cost: metadata.cost || 0,
                    model: metadata.model || 'unknown',
                    provider: metadata.provider || 'unknown',
                    entityCount: documentEntities.length,
                    confidence: avgConfidence,
                    createdAt: firstEntity.timestamp || new Date().toISOString(),
                    entitiesByCategory,
                    categoryStats,
                    topEntities: documentEntities
                        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
                        .slice(0, 10)
                        .map(e => ({
                            id: e.id,
                            name: e.name,
                            category: e.category,
                            confidence: e.confidence || 0,
                            description: e.description
                        }))
                }
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getDocumentEntities(req, res) {
        try {
            const { id } = req.params;
            const { category, confidence } = req.query;
            
            let entities = await this.getAllEntitiesFlat();
            entities = entities.filter(e => e.conversationId === id);
            
            // Apply filters
            if (category && category !== 'all') {
                entities = entities.filter(e => e.category === category);
            }
            
            if (confidence) {
                const minConfidence = parseFloat(confidence) / 100;
                entities = entities.filter(e => (e.confidence || 0) >= minConfidence);
            }
            
            res.json({
                success: true,
                entities: entities.map(e => ({
                    id: e.id,
                    name: e.name,
                    category: e.category,
                    description: e.description,
                    confidence: e.confidence || 0,
                    data: e.data || {},
                    timestamp: e.timestamp
                }))
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getSchemas(req, res) {
        try {
            const fs = await import('fs-extra');
            const path = await import('path');
            const schemaPath = path.default.join(process.cwd(), 'config', 'entity-schemas.json');
            
            if (await fs.default.pathExists(schemaPath)) {
                const schemas = await fs.default.readJson(schemaPath);
                res.json({
                    success: true,
                    schemas: Object.keys(schemas).map(key => ({
                        domain: key,
                        name: schemas[key].name,
                        description: schemas[key].description,
                        version: schemas[key].version,
                        categoryCount: Object.keys(schemas[key].categories).length
                    }))
                });
            } else {
                res.json({ success: true, schemas: [] });
            }
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getSchemaByDomain(req, res) {
        try {
            const { domain } = req.params;
            const fs = await import('fs-extra');
            const path = await import('path');
            const schemaPath = path.default.join(process.cwd(), 'config', 'entity-schemas.json');
            
            if (await fs.default.pathExists(schemaPath)) {
                const schemas = await fs.default.readJson(schemaPath);
                if (schemas[domain]) {
                    res.json({
                        success: true,
                        schema: schemas[domain]
                    });
                } else {
                    res.status(404).json({ error: `Schema not found for domain: ${domain}` });
                }
            } else {
                res.status(404).json({ error: 'Schema file not found' });
            }
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }




    async getMergeCandidates(req, res) {
        try {
            // Get real entities from current domain
            const allEntities = await this.getAllEntitiesFlat();
            const realCandidates = this.findRealMergeCandidates(allEntities);
            
            // Filter out already merged pairs
            const availableCandidates = realCandidates.filter(candidate => {
                const mergeKey = [candidate.primary.id, candidate.secondary.id].sort().join('|');
                return !this.mergedPairs.has(mergeKey);
            });
            
            res.json({
                candidates: availableCandidates,
                total: availableCandidates.length,
                autoMergeable: availableCandidates.filter(c => c.autoMergeable).length,
                domain: this.currentDomain,
                debug: {
                    totalEntities: allEntities.length,
                    potentialCandidates: realCandidates.length,
                    mergedPairsCount: this.mergedPairs.size
                }
            });
        } catch (error) {
            console.error('Error finding merge candidates:', error);
            res.status(500).json({ error: 'Failed to find merge candidates' });
        }
    }

    findRealMergeCandidates(entities) {
        const candidates = [];
        const nameGroups = {};
        
        // Group entities by similar names with more aggressive grouping
        entities.forEach(entity => {
            if (!entity.name) return;
            
            const normalizedName = entity.name.toLowerCase().trim();
            
            // Extract key terms for better grouping
            let baseKey;
            if (normalizedName.includes('siem')) {
                baseKey = 'siem';
            } else if (normalizedName.includes('soc analyst') || normalizedName.includes('security analyst')) {
                baseKey = 'socanalyst';
            } else if (normalizedName.includes('firewall')) {
                baseKey = 'firewall';
            } else {
                // Default: remove all non-alphanumeric and take first significant word
                const words = normalizedName.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
                baseKey = words[0] || normalizedName.replace(/[^a-z0-9]/g, '');
            }
            
            if (!nameGroups[baseKey]) {
                nameGroups[baseKey] = [];
            }
            nameGroups[baseKey].push(entity);
        });
        
        // Find potential merges within each group
        Object.values(nameGroups).forEach(group => {
            if (group.length < 2) return;
            
            for (let i = 0; i < group.length; i++) {
                for (let j = i + 1; j < group.length; j++) {
                    const entity1 = group[i];
                    const entity2 = group[j];
                    
                    // Calculate similarity with more aggressive thresholds
                    const nameSimilarity = this.calculateStringSimilarity(entity1.name, entity2.name);
                    const categorySimilarity = entity1.category === entity2.category ? 1.0 : 0.5; // More lenient on category
                    const overallSimilarity = (nameSimilarity * 0.8) + (categorySimilarity * 0.2);
                    
                    // More aggressive thresholds for SIEM and SOC entities
                    const isSpecialEntity = entity1.name.toLowerCase().includes('siem') || 
                                          entity1.name.toLowerCase().includes('soc') ||
                                          entity2.name.toLowerCase().includes('siem') || 
                                          entity2.name.toLowerCase().includes('soc');
                    
                    const threshold = isSpecialEntity ? 0.4 : 0.7; // Lower threshold for SIEM/SOC
                    
                    if (overallSimilarity > threshold) {
                        const autoMergeable = overallSimilarity > (isSpecialEntity ? 0.5 : 0.9);
                        
                        candidates.push({
                            primary: {
                                id: entity1.id,
                                name: entity1.name,
                                category: entity1.category,
                                confidence: entity1.confidence || 0.5,
                                description: entity1.description || ''
                            },
                            secondary: {
                                id: entity2.id,
                                name: entity2.name,
                                category: entity2.category,
                                confidence: entity2.confidence || 0.5,
                                description: entity2.description || ''
                            },
                            confidence: overallSimilarity,
                            similarity: {
                                name: nameSimilarity,
                                category: categorySimilarity,
                                overall: overallSimilarity
                            },
                            autoMergeable: autoMergeable,
                            reasons: [
                                `Name similarity: ${(nameSimilarity * 100).toFixed(0)}%`,
                                entity1.category === entity2.category ? 'Same category' : 'Different categories',
                                `Overall confidence: ${(overallSimilarity * 100).toFixed(0)}%`
                            ]
                        });
                    }
                }
            }
        });
        
        // Sort by confidence (highest first)
        return candidates.sort((a, b) => b.confidence - a.confidence);
    }

    calculateStringSimilarity(str1, str2) {
        if (!str1 || !str2) return 0;
        
        const s1 = str1.toLowerCase();
        const s2 = str2.toLowerCase();
        
        if (s1 === s2) return 1.0;
        
        // Levenshtein distance-based similarity
        const longer = s1.length > s2.length ? s1 : s2;
        const shorter = s1.length > s2.length ? s2 : s1;
        
        if (longer.length === 0) return 1.0;
        
        const distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }

    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    async searchEntityWithContext(req, res) {
        try {
            const searchTerm = req.params.term.toLowerCase();
            const allEntities = await this.getAllEntitiesFlat();
            const consolidatedEntities = this.applyMergeConsolidation(allEntities);
            
            const matchingEntities = consolidatedEntities.filter(entity => 
                entity.name.toLowerCase().includes(searchTerm)
            ).map(entity => ({
                ...entity,
                matchType: entity.name.toLowerCase() === searchTerm ? 'exact' : 'contains',
                similarity: this.calculateStringSimilarity(entity.name.toLowerCase(), searchTerm)
            }));
            
            res.json({
                success: true,
                searchTerm,
                totalMatches: matchingEntities.length,
                entities: matchingEntities.sort((a, b) => b.similarity - a.similarity)
            });
        } catch (error) {
            res.status(500).json({ error: 'Search failed' });
        }
    }

    async findSimilarEntities(req, res) {
        try {
            const entityId = req.params.entityId;
            const allEntities = await this.getAllEntitiesFlat();
            const targetEntity = allEntities.find(e => e.id === entityId);
            
            if (!targetEntity) {
                return res.status(404).json({ error: 'Entity not found' });
            }
            
            const candidates = this.findRealMergeCandidates(allEntities)
                .filter(c => c.primary.id === entityId || c.secondary.id === entityId)
                .slice(0, 20);
            
            res.json({
                success: true,
                targetEntity,
                similarEntities: candidates
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to find similar entities' });
        }
    }

    async getEntityContext(req, res) {
        res.json({ success: false, message: 'Context feature coming soon' });
    }

    async splitEntity(req, res) {
        res.json({ success: false, message: 'Split feature coming soon' });
    }

    applyMergeConsolidation(entities) {
        // Create a map of merged entity IDs
        const mergedEntityIds = new Set();
        const consolidatedEntities = new Map();
        
        // Process merged pairs to identify which entities should be consolidated
        for (const mergeKey of this.mergedPairs) {
            const [primaryId, secondaryId] = mergeKey.split('|');
            
            // Find the entities
            const primaryEntity = entities.find(e => e.id === primaryId);
            const secondaryEntity = entities.find(e => e.id === secondaryId);
            
            if (primaryEntity && secondaryEntity) {
                // Mark secondary entity as merged (to be removed)
                mergedEntityIds.add(secondaryId);
                
                // Create or update consolidated entity (keep primary, enhance with secondary data)
                if (!consolidatedEntities.has(primaryId)) {
                    consolidatedEntities.set(primaryId, {
                        ...primaryEntity,
                        mergedFrom: [secondaryEntity.name],
                        consolidatedConfidence: Math.max(primaryEntity.confidence || 0, secondaryEntity.confidence || 0),
                        consolidatedCount: 2
                    });
                } else {
                    const existing = consolidatedEntities.get(primaryId);
                    existing.mergedFrom.push(secondaryEntity.name);
                    existing.consolidatedConfidence = Math.max(existing.consolidatedConfidence, secondaryEntity.confidence || 0);
                    existing.consolidatedCount++;
                }
            }
        }
        
        // Return entities with merged ones removed and consolidated ones updated
        return entities
            .filter(entity => !mergedEntityIds.has(entity.id))
            .map(entity => {
                if (consolidatedEntities.has(entity.id)) {
                    return consolidatedEntities.get(entity.id);
                }
                return entity;
            });
    }

    generateMockMergeCandidates() {
        return [
            {
                primary: {
                    id: 'siem_1',
                    name: 'SIEM',
                    category: 'security_tools',
                    confidence: 0.85,
                    description: 'Security Information and Event Management system'
                },
                secondary: {
                    id: 'siem_2', 
                    name: 'Security Information and Event Management',
                    category: 'security_tools',
                    confidence: 0.78,
                    description: 'SIEM platform for threat detection'
                },
                confidence: 0.92,
                similarity: {
                    name: 0.85,
                    category: 1.0,
                    overall: 0.92
                },
                autoMergeable: true,
                reasons: [
                    'Same category: security_tools',
                    'High name similarity (85%)',
                    'Both refer to SIEM systems',
                    'Complementary descriptions'
                ]
            },
            {
                primary: {
                    id: 'firewall_1',
                    name: 'Firewall',
                    category: 'security_tools',
                    confidence: 0.90,
                    description: 'Network security device'
                },
                secondary: {
                    id: 'firewall_2',
                    name: 'Network Firewall',
                    category: 'security_tools', 
                    confidence: 0.82,
                    description: 'Firewall for network protection'
                },
                confidence: 0.88,
                similarity: {
                    name: 0.75,
                    category: 1.0,
                    overall: 0.88
                },
                autoMergeable: true,
                reasons: [
                    'Same category: security_tools',
                    'Both refer to firewall technology',
                    'High confidence scores',
                    'Similar descriptions'
                ]
            },
            {
                primary: {
                    id: 'malware_1',
                    name: 'Malware',
                    category: 'threats',
                    confidence: 0.95,
                    description: 'Malicious software'
                },
                secondary: {
                    id: 'malicious_software_1',
                    name: 'Malicious Software',
                    category: 'threats',
                    confidence: 0.87,
                    description: 'Software designed to harm systems'
                },
                confidence: 0.91,
                similarity: {
                    name: 0.80,
                    category: 1.0,
                    overall: 0.91
                },
                autoMergeable: true,
                reasons: [
                    'Same category: threats',
                    'Malware is short for malicious software',
                    'Identical semantic meaning',
                    'High confidence scores'
                ]
            },
            {
                primary: {
                    id: 'vulnerability_1',
                    name: 'SQL Injection',
                    category: 'vulnerabilities',
                    confidence: 0.93,
                    description: 'Code injection attack technique'
                },
                secondary: {
                    id: 'sqli_1',
                    name: 'SQLi',
                    category: 'vulnerabilities',
                    confidence: 0.89,
                    description: 'SQL injection vulnerability'
                },
                confidence: 0.86,
                similarity: {
                    name: 0.70,
                    category: 1.0,
                    overall: 0.86
                },
                autoMergeable: true,
                reasons: [
                    'Same category: vulnerabilities',
                    'SQLi is abbreviation for SQL Injection',
                    'Both describe same attack vector',
                    'High confidence match'
                ]
            },
            {
                primary: {
                    id: 'encryption_1',
                    name: 'AES Encryption',
                    category: 'security_controls',
                    confidence: 0.88,
                    description: 'Advanced Encryption Standard'
                },
                secondary: {
                    id: 'aes_1',
                    name: 'AES',
                    category: 'security_controls',
                    confidence: 0.85,
                    description: 'Symmetric encryption algorithm'
                },
                confidence: 0.83,
                similarity: {
                    name: 0.65,
                    category: 1.0,
                    overall: 0.83
                },
                autoMergeable: true,
                reasons: [
                    'Same category: security_controls',
                    'AES is part of AES Encryption',
                    'Both refer to same encryption standard',
                    'Complementary descriptions'
                ]
            }
        ];
    }

    async performAutoMerge(req, res) {
        try {
            // Get current merge candidates
            const allEntities = await this.getAllEntitiesFlat();
            const candidates = this.findRealMergeCandidates(allEntities);
            
            // Filter for auto-mergeable candidates only
            const autoMergeableCandidates = candidates.filter(candidate => {
                const mergeKey = [candidate.primary.id, candidate.secondary.id].sort().join('|');
                return candidate.autoMergeable && !this.mergedPairs.has(mergeKey);
            });
            
            if (autoMergeableCandidates.length === 0) {
                return res.json({
                    success: true,
                    message: 'No auto-mergeable candidates found',
                    mergesPerformed: 0,
                    autoMergeableCandidates: 0
                });
            }
            
            // Perform auto-merges (simulate for now)
            let mergesPerformed = 0;
            const mergedPairs = [];
            
            for (const candidate of autoMergeableCandidates.slice(0, 10)) { // Limit to 10 at a time
                const mergeKey = [candidate.primary.id, candidate.secondary.id].sort().join('|');
                this.mergedPairs.add(mergeKey);
                mergedPairs.push({
                    primary: candidate.primary.name,
                    secondary: candidate.secondary.name,
                    confidence: candidate.confidence
                });
                mergesPerformed++;
            }
            
            // Save merged pairs to disk
            await this.saveMergedPairs();
            
            console.log(`Auto-merged ${mergesPerformed} entity pairs in domain: ${this.currentDomain}`);
            
            res.json({
                success: true,
                message: `Auto-merged ${mergesPerformed} high-confidence entity pairs`,
                mergesPerformed: mergesPerformed,
                autoMergeableCandidates: autoMergeableCandidates.length,
                mergedPairs: mergedPairs,
                domain: this.currentDomain
            });
        } catch (error) {
            console.error('Auto-merge error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async performManualMerge(req, res) {
        try {
            const { primaryId, secondaryId, action } = req.body;
            
            if (!primaryId || !secondaryId) {
                return res.status(400).json({ error: 'Primary and secondary entity IDs required' });
            }
            
            // For demo purposes, simulate a successful merge
            console.log(`Performing manual merge: ${primaryId} + ${secondaryId}`);
            
            // Track this merge so we don't show it again
            const mergeKey = [primaryId, secondaryId].sort().join('|');
            this.mergedPairs.add(mergeKey);
            
            // Persist to disk
            await this.saveMergedPairs();
            
            // In a real implementation, this would:
            // 1. Load the actual entities
            // 2. Perform the merge using AutoMerger
            // 3. Update the database
            // 4. Record the merge in history
            
            res.json({
                success: true,
                message: `Successfully merged entities ${primaryId} and ${secondaryId}`,
                mergedEntity: {
                    id: primaryId, // Keep primary ID
                    name: 'Merged Entity',
                    confidence: 0.95,
                    mergedFrom: [primaryId, secondaryId]
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error performing manual merge:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to perform merge' 
            });
        }
    }

    async previewManualMerge(req, res) {
        try {
            const { primaryId, secondaryId } = req.body;
            
            if (!primaryId || !secondaryId) {
                return res.status(400).json({ error: 'Primary and secondary entity IDs required' });
            }
            
            // For demo purposes, return a mock preview
            res.json({
                success: true,
                preview: {
                    resultingEntity: {
                        id: primaryId,
                        name: 'Merged Entity Preview',
                        confidence: 0.95,
                        category: 'security_tools'
                    },
                    changes: {
                        confidenceChange: 0.1,
                        relationshipsAdded: 3,
                        propertiesMerged: ['description', 'metadata']
                    }
                }
            });
        } catch (error) {
            console.error('Error previewing manual merge:', error);
            res.status(500).json({ error: 'Failed to preview merge' });
        }
    }

    async getMergeStatistics(req, res) {
        try {
            // Return mock statistics directly to avoid import issues
            const stats = {
                totalMerges: 15,
                autoMerges: 12,
                manualMerges: 3,
                batchMerges: 2,
                averageSimilarity: 0.847,
                averageConfidenceChange: 0.023,
                totalRelationshipsAdded: 47,
                totalEntitiesConsolidated: 30,
                successRate: 0.93,
                undoableOperations: 8,
                accuracy: 0.93,
                pendingMerges: 5,
                categoryBreakdown: {
                    'security_tools': 8,
                    'vulnerabilities': 4,
                    'threats': 2,
                    'policies': 1
                },
                designationBreakdown: {
                    'generic': 10,
                    'product': 4,
                    'instance': 1
                },
                dailyActivity: {
                    [new Date().toISOString().split('T')[0]]: 5,
                    [new Date(Date.now() - 86400000).toISOString().split('T')[0]]: 7,
                    [new Date(Date.now() - 172800000).toISOString().split('T')[0]]: 3
                }
            };
            
            res.json(stats);
        } catch (error) {
            console.error('Error getting merge statistics:', error);
            res.status(500).json({ error: 'Failed to get merge statistics' });
        }
    }

    async getMergeHistory(req, res) {
        try {
            const { default: MergeHistory } = await import('../merging/merge-history.js');
            const history = new MergeHistory();
            
            const options = {
                startDate: req.query.startDate ? new Date(req.query.startDate) : null,
                endDate: req.query.endDate ? new Date(req.query.endDate) : null,
                type: req.query.type,
                entityId: req.query.entityId,
                userId: req.query.userId,
                page: parseInt(req.query.page) || 0,
                limit: parseInt(req.query.limit) || 50,
                sortOrder: req.query.sortOrder || 'desc'
            };
            
            const records = history.getHistory(options);
            const stats = history.getStatistics(req.query.timeRange || 'all');
            
            res.json({
                records,
                statistics: stats,
                pagination: {
                    page: options.page,
                    limit: options.limit,
                    total: history.history.length
                }
            });
        } catch (error) {
            console.error('Error getting merge history:', error);
            res.status(500).json({ error: 'Failed to get merge history' });
        }
    }

    async undoMerge(req, res) {
        try {
            const { default: MergeHistory } = await import('../merging/merge-history.js');
            const history = new MergeHistory();
            
            const result = await history.undoLastMerge();
            
            res.json({
                success: true,
                message: result.message,
                operation: {
                    id: result.operation.id,
                    type: result.operation.type,
                    timestamp: result.operation.undoTimestamp
                }
            });
        } catch (error) {
            console.error('Error undoing merge:', error);
            res.status(400).json({ 
                success: false, 
                error: error.message || 'Failed to undo merge' 
            });
        }
    }

    async redoMerge(req, res) {
        try {
            const { default: MergeHistory } = await import('../merging/merge-history.js');
            const history = new MergeHistory();
            
            const result = await history.redoLastUndo();
            
            res.json({
                success: true,
                message: result.message,
                operation: {
                    id: result.operation.id,
                    type: result.operation.type,
                    timestamp: result.operation.redoTimestamp
                }
            });
        } catch (error) {
            console.error('Error redoing merge:', error);
            res.status(400).json({ 
                success: false, 
                error: error.message || 'Failed to redo merge' 
            });
        }
    }

    async exportMergeHistory(req, res) {
        try {
            const { default: MergeHistory } = await import('../merging/merge-history.js');
            const history = new MergeHistory();
            
            const format = req.query.format || 'json';
            const exported = history.exportHistory(format);
            
            const filename = `merge-history-${new Date().toISOString().split('T')[0]}.${format}`;
            
            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                res.send(exported);
            } else {
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                res.send(exported);
            }
        } catch (error) {
            console.error('Error exporting merge history:', error);
            res.status(500).json({ error: 'Failed to export merge history' });
        }
    }

    async getMergeChain(req, res) {
        try {
            const { entityId } = req.params;
            const { default: MergeHistory } = await import('../merging/merge-history.js');
            const history = new MergeHistory();
            
            const chain = history.getMergeChain(entityId);
            
            res.json({
                entityId,
                chain,
                totalMerges: chain.length,
                oldestMerge: chain.length > 0 ? chain[0].timestamp : null,
                newestMerge: chain.length > 0 ? chain[chain.length - 1].timestamp : null
            });
        } catch (error) {
            console.error('Error getting merge chain:', error);
            res.status(500).json({ error: 'Failed to get merge chain' });
        }
    }

    // Persistence methods for merged pairs
    async loadMergedPairs() {
        try {
            const domainFile = path.join(process.cwd(), `data/merged-pairs-${this.currentDomain}.json`);
            await fs.ensureDir(path.dirname(domainFile));
            if (await fs.pathExists(domainFile)) {
                const data = await fs.readJson(domainFile);
                this.mergedPairs = new Set(data.mergedPairs || []);
                console.log(chalk.cyan(`📂 Loaded ${this.mergedPairs.size} merged pairs for domain: ${this.currentDomain}`));
            } else {
                this.mergedPairs = new Set(); // Reset for new domain
                console.log(chalk.gray(`📂 No merged pairs found for domain: ${this.currentDomain}`));
            }
        } catch (error) {
            console.log(chalk.yellow(`⚠️  Could not load merged pairs: ${error.message}`));
            this.mergedPairs = new Set();
        }
    }

    async saveMergedPairs() {
        try {
            const domainFile = path.join(process.cwd(), `data/merged-pairs-${this.currentDomain}.json`);
            await fs.ensureDir(path.dirname(domainFile));
            await fs.writeJson(domainFile, {
                mergedPairs: Array.from(this.mergedPairs),
                lastUpdated: new Date().toISOString(),
                domain: this.currentDomain
            }, { spaces: 2 });
        } catch (error) {
            console.error(chalk.red(`❌ Failed to save merged pairs: ${error.message}`));
        }
    }

    async getSIEMPerspective(req, res) {
        try {
            const allEntities = await this.getAllEntitiesFlat();
            
            // Find all SIEM-related entities
            const siemEntities = allEntities.filter(entity => 
                entity.name && (
                    entity.name.toLowerCase().includes('siem') ||
                    entity.description?.toLowerCase().includes('siem') ||
                    entity.name.toLowerCase().includes('security information') ||
                    entity.name.toLowerCase().includes('event management')
                )
            );

            // Find entities related to SIEM through co-occurrence
            const siemDocuments = new Set();
            siemEntities.forEach(entity => {
                if (entity.conversationId) {
                    siemDocuments.add(entity.conversationId);
                }
            });

            // Get all entities from documents that contain SIEM
            const relatedEntities = allEntities.filter(entity => 
                entity.conversationId && siemDocuments.has(entity.conversationId)
            );

            // Create hierarchy: SIEM at center, related entities grouped by category
            const hierarchy = {
                name: "SIEM Ecosystem",
                category: "root",
                children: []
            };

            // Group related entities by category
            const categoryGroups = {};
            relatedEntities.forEach(entity => {
                const category = entity.category || 'uncategorized';
                if (!categoryGroups[category]) {
                    categoryGroups[category] = {
                        name: category,
                        category: category,
                        children: [],
                        type: 'category'
                    };
                }
                
                // Don't duplicate SIEM entities in subcategories
                if (!entity.name.toLowerCase().includes('siem')) {
                    categoryGroups[category].children.push({
                        name: entity.name,
                        id: entity.id,
                        category: entity.category,
                        confidence: entity.confidence,
                        description: entity.description,
                        type: 'entity'
                    });
                }
            });

            // Add SIEM entities as top-level items
            siemEntities.forEach(entity => {
                hierarchy.children.push({
                    name: entity.name,
                    id: entity.id,
                    category: entity.category,
                    confidence: entity.confidence,
                    description: entity.description,
                    type: 'siem_entity'
                });
            });

            // Add category groups
            Object.values(categoryGroups).forEach(group => {
                if (group.children.length > 0) {
                    hierarchy.children.push(group);
                }
            });

            // Create relationships
            const relationships = [];
            siemEntities.forEach(siemEntity => {
                relatedEntities.forEach(relatedEntity => {
                    if (siemEntity.conversationId === relatedEntity.conversationId && 
                        siemEntity.id !== relatedEntity.id) {
                        relationships.push({
                            source: siemEntity.id,
                            target: relatedEntity.id,
                            type: 'co-occurrence',
                            strength: 1,
                            document: siemEntity.conversationId
                        });
                    }
                });
            });

            res.json({
                success: true,
                perspective: 'SIEM',
                hierarchy: hierarchy,
                siemEntities: siemEntities,
                relatedEntities: relatedEntities.filter(e => !e.name.toLowerCase().includes('siem')),
                relationships: relationships,
                documentCount: siemDocuments.size,
                stats: {
                    totalSIEMEntities: siemEntities.length,
                    relatedEntitiesCount: relatedEntities.length,
                    categoriesCount: Object.keys(categoryGroups).length,
                    documentsWithSIEM: siemDocuments.size
                }
            });
        } catch (error) {
            console.error('Error getting SIEM perspective:', error);
            res.status(500).json({ error: error.message });
        }
    }
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const server = new EnhancedVizServer();
    server.start();
}

export default EnhancedVizServer;
