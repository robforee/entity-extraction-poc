/**
 * Document Handlers Module
 * Handles all document-related API endpoints
 */
import chalk from 'chalk';
import path from 'path';

export class DocumentHandlers {
    constructor(server) {
        this.server = server;
    }

    async getDocuments(req, res) {
        try {
            const entities = await this.server.diffMem.getAllEntities();
            const documents = entities.map(entitySet => ({
                id: entitySet.conversationId,
                conversationId: entitySet.conversationId,
                source: entitySet.metadata?.source || 'Unknown',
                timestamp: entitySet.timestamp,
                entityCount: entitySet.entities ? entitySet.entities.length : 1,
                categories: [...new Set(entitySet.entities ? 
                    entitySet.entities.map(e => e.category).filter(Boolean) : 
                    [entitySet.category].filter(Boolean))],
                documentType: this.getFileExtension(entitySet.metadata?.source)
            }));

            const uniqueDocuments = documents.reduce((acc, doc) => {
                if (!acc.find(d => d.id === doc.id)) {
                    acc.push(doc);
                }
                return acc;
            }, []);

            res.json({ documents: uniqueDocuments });
        } catch (error) {
            console.error('Error getting documents:', error);
            res.status(500).json({ error: 'Failed to get documents' });
        }
    }

    getFileExtension(filePath) {
        if (!filePath) return 'unknown';
        const ext = path.extname(filePath);
        return ext || 'unknown';
    }

    async getDocumentDetails(req, res) {
        try {
            const { id } = req.params;
            console.log(chalk.cyan(`🔍 Looking for document with ID: ${id}`));
            
            const entities = await this.server.diffMem.getAllEntities();
            console.log(chalk.gray(`📊 Total entity sets: ${entities.length}`));
            
            // Find entities that belong to this document
            const documentEntities = entities.filter(entitySet => {
                const conversationMatch = entitySet.conversationId === id;
                const idMatch = entitySet.id === id;
                
                if (conversationMatch || idMatch) {
                    console.log(chalk.green(`✅ Found matching entity set: ${entitySet.conversationId || entitySet.id}`));
                    return true;
                }
                return false;
            });
            
            if (documentEntities.length === 0) {
                console.log(chalk.yellow(`⚠️ No entities found for document ID: ${id}`));
                
                // Try to find by partial match or source path
                const partialMatches = entities.filter(entitySet => {
                    const sourceMatch = entitySet.metadata?.source?.includes(id);
                    const nameMatch = entitySet.name?.includes(id);
                    return sourceMatch || nameMatch;
                });
                
                if (partialMatches.length > 0) {
                    console.log(chalk.blue(`🔍 Found ${partialMatches.length} partial matches`));
                    return res.json({
                        id,
                        source: partialMatches[0].metadata?.source || 'Unknown',
                        timestamp: partialMatches[0].timestamp,
                        entityCount: partialMatches.length,
                        entities: partialMatches.map(e => ({
                            id: e.id,
                            name: e.name,
                            category: e.category,
                            confidence: e.confidence
                        })),
                        categories: [...new Set(partialMatches.map(e => e.category).filter(Boolean))],
                        documentType: this.getFileExtension(partialMatches[0].metadata?.source),
                        note: 'Found by partial matching'
                    });
                }
                
                return res.status(404).json({ 
                    error: 'Document not found',
                    searchedId: id,
                    availableIds: entities.slice(0, 5).map(e => e.conversationId || e.id)
                });
            }
            
            // Aggregate document information
            const firstEntity = documentEntities[0];
            const allEntitiesInDoc = documentEntities.flatMap(entitySet => 
                entitySet.entities || [entitySet]
            );
            
            const documentDetails = {
                id,
                conversationId: firstEntity.conversationId,
                source: firstEntity.metadata?.source || 'Unknown',
                timestamp: firstEntity.timestamp,
                entityCount: allEntitiesInDoc.length,
                entities: allEntitiesInDoc.map(entity => ({
                    id: entity.id,
                    name: entity.name,
                    category: entity.category,
                    confidence: entity.confidence,
                    role: entity.role,
                    type: entity.type,
                    status: entity.status
                })),
                categories: [...new Set(allEntitiesInDoc.map(e => e.category).filter(Boolean))],
                documentType: this.getFileExtension(firstEntity.metadata?.source),
                metadata: firstEntity.metadata
            };
            
            console.log(chalk.green(`✅ Document details compiled: ${documentDetails.entityCount} entities`));
            res.json(documentDetails);
            
        } catch (error) {
            console.error('Error getting document details:', error);
            res.status(500).json({ error: 'Failed to get document details' });
        }
    }

    async getDocumentEntities(req, res) {
        try {
            const { id } = req.params;
            const { category, confidence } = req.query;
            
            const entities = await this.server.diffMem.getAllEntities();
            const documentEntities = entities.filter(entitySet => 
                entitySet.conversationId === id || entitySet.id === id
            );
            
            if (documentEntities.length === 0) {
                return res.status(404).json({ error: 'Document not found' });
            }
            
            let allEntities = documentEntities.flatMap(entitySet => 
                entitySet.entities || [entitySet]
            );
            
            // Apply filters
            if (category) {
                allEntities = allEntities.filter(e => e.category === category);
            }
            
            if (confidence) {
                const minConfidence = parseFloat(confidence);
                allEntities = allEntities.filter(e => (e.confidence || 0) >= minConfidence);
            }
            
            res.json(allEntities);
            
        } catch (error) {
            console.error('Error getting document entities:', error);
            res.status(500).json({ error: 'Failed to get document entities' });
        }
    }

    async getSchemas(req, res) {
        try {
            const fs = await import('fs-extra');
            const path = await import('path');
            
            const schemaDir = path.join(process.cwd(), 'config');
            const schemaFiles = await fs.readdir(schemaDir);
            const schemas = [];
            
            for (const file of schemaFiles) {
                if (file.endsWith('.js') && file.includes('schema')) {
                    const schemaPath = path.join(schemaDir, file);
                    const schema = await import(schemaPath);
                    schemas.push({
                        name: file.replace('.js', ''),
                        schema: schema.default || schema
                    });
                }
            }
            
            res.json({ schemas });
        } catch (error) {
            console.error('Error getting schemas:', error);
            res.status(500).json({ error: 'Failed to get schemas' });
        }
    }

    async getSchemaByDomain(req, res) {
        try {
            const { domain } = req.params;
            const fs = await import('fs-extra');
            const path = await import('path');
            
            const schemaPath = path.join(process.cwd(), 'config', `${domain}-schema.js`);
            
            if (await fs.pathExists(schemaPath)) {
                const schema = await import(schemaPath);
                res.json({ 
                    domain,
                    schema: schema.default || schema 
                });
            } else {
                res.status(404).json({ error: 'Schema not found for domain' });
            }
        } catch (error) {
            console.error('Error getting schema by domain:', error);
            res.status(500).json({ error: 'Failed to get schema' });
        }
    }
}
