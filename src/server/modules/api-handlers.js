/**
 * API Route Handlers Module
 * Handles all entity-related API endpoints
 */
import chalk from 'chalk';

export class APIHandlers {
    constructor(server) {
        this.server = server;
    }

    async getEntities(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 50;
            const category = req.query.category;
            const confidence = parseFloat(req.query.confidence) || 0;

            const allEntities = await this.server.getAllEntitiesFlat();
            let filteredEntities = allEntities;

            if (category) {
                filteredEntities = filteredEntities.filter(e => e.category === category);
            }

            if (confidence > 0) {
                filteredEntities = filteredEntities.filter(e => (e.confidence || 0) >= confidence);
            }

            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedEntities = filteredEntities.slice(startIndex, endIndex);

            res.json({
                entities: paginatedEntities,
                pagination: {
                    page,
                    limit,
                    total: filteredEntities.length,
                    totalPages: Math.ceil(filteredEntities.length / limit)
                }
            });
        } catch (error) {
            console.error('Error getting entities:', error);
            res.status(500).json({ error: 'Failed to get entities' });
        }
    }

    async searchEntities(req, res) {
        try {
            const query = req.query.q;
            const category = req.query.category;
            const confidence = parseFloat(req.query.confidence) || 0;

            if (!query) {
                return res.status(400).json({ error: 'Query parameter required' });
            }

            const allEntities = await this.server.getAllEntitiesFlat();
            const searchResults = allEntities.filter(entity => {
                const matchesQuery = entity.name?.toLowerCase().includes(query.toLowerCase()) ||
                                  entity.category?.toLowerCase().includes(query.toLowerCase());
                const matchesCategory = !category || entity.category === category;
                const matchesConfidence = (entity.confidence || 0) >= confidence;
                
                return matchesQuery && matchesCategory && matchesConfidence;
            });

            res.json({ entities: searchResults });
        } catch (error) {
            console.error('Error searching entities:', error);
            res.status(500).json({ error: 'Failed to search entities' });
        }
    }

    async getEntityStats(req, res) {
        try {
            const stats = await this.server.calculateStats();
            res.json(stats);
        } catch (error) {
            console.error('Error getting entity stats:', error);
            res.status(500).json({ error: 'Failed to get entity stats' });
        }
    }

    async getEntityCategories(req, res) {
        try {
            const categories = await this.server.calculateCategories();
            res.json(categories);
        } catch (error) {
            console.error('Error getting entity categories:', error);
            res.status(500).json({ error: 'Failed to get entity categories' });
        }
    }

    async getEntityById(req, res) {
        try {
            const entityId = req.params.id;
            const allEntities = await this.server.getAllEntitiesFlat();
            
            const entity = allEntities.find(e => e.id === entityId);
            
            if (!entity) {
                return res.status(404).json({ error: 'Entity not found' });
            }

            // Get related entities (same document or similar names)
            const relatedEntities = allEntities.filter(e => 
                e.id !== entityId && (
                    e.conversationId === entity.conversationId ||
                    e.name.toLowerCase().includes(entity.name.toLowerCase()) ||
                    entity.name.toLowerCase().includes(e.name.toLowerCase())
                )
            ).slice(0, 10);

            res.json({
                entity,
                relatedEntities
            });
        } catch (error) {
            console.error('Error getting entity by ID:', error);
            res.status(500).json({ error: 'Failed to get entity' });
        }
    }

    async exportEntities(req, res) {
        try {
            const format = req.query.format || 'json';
            const allEntities = await this.server.getAllEntitiesFlat();

            if (format === 'csv') {
                const csv = this.server.convertToCSV(allEntities);
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', 'attachment; filename="entities.csv"');
                res.send(csv);
            } else {
                res.json({ entities: allEntities });
            }
        } catch (error) {
            console.error('Error exporting entities:', error);
            res.status(500).json({ error: 'Failed to export entities' });
        }
    }

    async searchEntityWithContext(req, res) {
        try {
            const searchTerm = req.params.term.toLowerCase();
            const allEntities = await this.server.getAllEntitiesFlat();
            
            const matchingEntities = allEntities.filter(entity => 
                entity.name?.toLowerCase().includes(searchTerm)
            );

            const contextualResults = matchingEntities.map(entity => ({
                ...entity,
                context: {
                    documentSource: entity.metadata?.source,
                    relatedEntities: allEntities.filter(e => 
                        e.conversationId === entity.conversationId && e.id !== entity.id
                    ).slice(0, 5)
                }
            }));

            res.json({ results: contextualResults });
        } catch (error) {
            console.error('Error searching entity with context:', error);
            res.status(500).json({ error: 'Failed to search entity with context' });
        }
    }

    async findSimilarEntities(req, res) {
        try {
            const entityId = req.params.entityId;
            const allEntities = await this.server.getAllEntitiesFlat();
            
            const targetEntity = allEntities.find(e => e.id === entityId);
            if (!targetEntity) {
                return res.status(404).json({ error: 'Entity not found' });
            }

            const similarEntities = allEntities
                .filter(e => e.id !== entityId)
                .map(entity => ({
                    ...entity,
                    similarity: this.server.calculateSimilarity(targetEntity.name, entity.name)
                }))
                .filter(e => e.similarity > 0.3)
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, 10);

            res.json(similarEntities);
        } catch (error) {
            console.error('Error finding similar entities:', error);
            res.status(500).json({ error: 'Failed to find similar entities' });
        }
    }

    async getEntityContext(req, res) {
        try {
            const entityId = req.params.entityId;
            const allEntities = await this.server.getAllEntitiesFlat();
            
            const entity = allEntities.find(e => e.id === entityId);
            if (!entity) {
                return res.status(404).json({ error: 'Entity not found' });
            }

            const context = {
                entity,
                documentContext: allEntities.filter(e => 
                    e.conversationId === entity.conversationId && e.id !== entityId
                ),
                similarEntities: allEntities
                    .filter(e => e.id !== entityId && e.category === entity.category)
                    .slice(0, 5),
                relatedDocuments: [...new Set(allEntities
                    .filter(e => e.name.toLowerCase().includes(entity.name.toLowerCase()))
                    .map(e => e.metadata?.source)
                    .filter(Boolean)
                )].slice(0, 3)
            };

            res.json(context);
        } catch (error) {
            console.error('Error getting entity context:', error);
            res.status(500).json({ error: 'Failed to get entity context' });
        }
    }
}
