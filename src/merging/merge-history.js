import { ENTITY_TYPES, RELATIONSHIP_TYPES } from '../constants/entity-types.js';

/**
 * Merge History Tracking System
 * Provides comprehensive tracking, auditing, and undo functionality for entity merges
 */
class MergeHistory {
    constructor() {
        this.history = [];
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistorySize = 1000;
        this.maxUndoSize = 50;
        
        this.initializeStorage();
    }

    /**
     * Initialize persistent storage for merge history
     */
    initializeStorage() {
        // In a full implementation, this would connect to a database
        // For now, use in-memory storage with localStorage backup
        this.loadFromStorage();
    }

    /**
     * Record a merge operation
     */
    recordMerge(mergeOperation) {
        const record = {
            id: this.generateMergeId(),
            timestamp: new Date(),
            type: mergeOperation.type, // 'auto', 'manual', 'batch'
            status: 'completed',
            
            // Entity information
            primaryEntity: this.captureEntitySnapshot(mergeOperation.primaryEntity),
            secondaryEntity: this.captureEntitySnapshot(mergeOperation.secondaryEntity),
            resultingEntity: this.captureEntitySnapshot(mergeOperation.resultingEntity),
            
            // Merge details
            similarity: mergeOperation.similarity,
            confidence: mergeOperation.confidence,
            reasons: mergeOperation.reasons || [],
            
            // Impact analysis
            impact: {
                relationshipsAdded: mergeOperation.impact?.relationshipsAdded || 0,
                relationshipsRemoved: mergeOperation.impact?.relationshipsRemoved || 0,
                confidenceChange: mergeOperation.impact?.confidenceChange || 0,
                childrenMerged: mergeOperation.impact?.childrenMerged || 0,
                tagsAdded: mergeOperation.impact?.tagsAdded || 0
            },
            
            // Metadata
            metadata: {
                userId: mergeOperation.userId || 'system',
                source: mergeOperation.source || 'merge-interface',
                batchId: mergeOperation.batchId || null,
                undoable: mergeOperation.undoable !== false
            }
        };

        // Add to history
        this.history.push(record);
        
        // Maintain history size limit
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }
        
        // Add to undo stack if undoable
        if (record.metadata.undoable) {
            this.undoStack.push(record);
            
            // Clear redo stack when new operation is performed
            this.redoStack = [];
            
            // Maintain undo stack size
            if (this.undoStack.length > this.maxUndoSize) {
                this.undoStack.shift();
            }
        }
        
        // Persist to storage
        this.saveToStorage();
        
        return record;
    }

    /**
     * Capture a complete snapshot of an entity for history tracking
     */
    captureEntitySnapshot(entity) {
        return {
            id: entity.id,
            name: entity.name,
            category: entity.category,
            designation: entity.designation,
            confidence: entity.confidence,
            description: entity.description,
            parentId: entity.parentId,
            children: [...(entity.children || [])],
            relationships: entity.relationships?.map(rel => ({
                targetId: rel.targetId,
                type: rel.type,
                strength: rel.strength,
                metadata: { ...rel.metadata }
            })) || [],
            metadata: {
                source: entity.metadata?.source,
                extractionDate: entity.metadata?.extractionDate,
                lastUpdated: entity.metadata?.lastUpdated,
                tags: [...(entity.metadata?.tags || [])],
                mergeHistory: [...(entity.metadata?.mergeHistory || [])]
            }
        };
    }

    /**
     * Generate unique merge ID
     */
    generateMergeId() {
        return `merge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get merge history with filtering options
     */
    getHistory(options = {}) {
        let filtered = [...this.history];
        
        // Filter by date range
        if (options.startDate) {
            filtered = filtered.filter(record => record.timestamp >= options.startDate);
        }
        if (options.endDate) {
            filtered = filtered.filter(record => record.timestamp <= options.endDate);
        }
        
        // Filter by type
        if (options.type) {
            filtered = filtered.filter(record => record.type === options.type);
        }
        
        // Filter by entity
        if (options.entityId) {
            filtered = filtered.filter(record => 
                record.primaryEntity.id === options.entityId ||
                record.secondaryEntity.id === options.entityId ||
                record.resultingEntity.id === options.entityId
            );
        }
        
        // Filter by user
        if (options.userId) {
            filtered = filtered.filter(record => record.metadata.userId === options.userId);
        }
        
        // Sort by timestamp (newest first by default)
        filtered.sort((a, b) => {
            const order = options.sortOrder === 'asc' ? 1 : -1;
            return (b.timestamp - a.timestamp) * order;
        });
        
        // Pagination
        if (options.limit) {
            const start = (options.page || 0) * options.limit;
            filtered = filtered.slice(start, start + options.limit);
        }
        
        return filtered;
    }

    /**
     * Get merge statistics
     */
    getStatistics(timeRange = 'all') {
        let records = this.history;
        
        // Filter by time range
        if (timeRange !== 'all') {
            const now = new Date();
            let startDate;
            
            switch (timeRange) {
                case 'today':
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case 'week':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
                default:
                    startDate = new Date(0);
            }
            
            records = records.filter(record => record.timestamp >= startDate);
        }
        
        const stats = {
            totalMerges: records.length,
            autoMerges: records.filter(r => r.type === 'auto').length,
            manualMerges: records.filter(r => r.type === 'manual').length,
            batchMerges: records.filter(r => r.type === 'batch').length,
            
            averageSimilarity: 0,
            averageConfidenceChange: 0,
            totalRelationshipsAdded: 0,
            totalEntitiesConsolidated: records.length * 2, // Each merge consolidates 2 entities
            
            categoryBreakdown: {},
            designationBreakdown: {},
            dailyActivity: {},
            
            successRate: records.filter(r => r.status === 'completed').length / Math.max(records.length, 1),
            undoableOperations: records.filter(r => r.metadata.undoable).length
        };
        
        if (records.length > 0) {
            // Calculate averages
            stats.averageSimilarity = records.reduce((sum, r) => sum + (r.similarity?.overall || 0), 0) / records.length;
            stats.averageConfidenceChange = records.reduce((sum, r) => sum + (r.impact.confidenceChange || 0), 0) / records.length;
            stats.totalRelationshipsAdded = records.reduce((sum, r) => sum + (r.impact.relationshipsAdded || 0), 0);
            
            // Category breakdown
            records.forEach(record => {
                const category = record.primaryEntity.category;
                stats.categoryBreakdown[category] = (stats.categoryBreakdown[category] || 0) + 1;
            });
            
            // Designation breakdown
            records.forEach(record => {
                const designation = record.primaryEntity.designation || 'generic';
                stats.designationBreakdown[designation] = (stats.designationBreakdown[designation] || 0) + 1;
            });
            
            // Daily activity
            records.forEach(record => {
                const date = record.timestamp.toISOString().split('T')[0];
                stats.dailyActivity[date] = (stats.dailyActivity[date] || 0) + 1;
            });
        }
        
        return stats;
    }

    /**
     * Undo the last merge operation
     */
    async undoLastMerge() {
        if (this.undoStack.length === 0) {
            throw new Error('No operations to undo');
        }
        
        const lastOperation = this.undoStack.pop();
        
        try {
            // In a full implementation, this would:
            // 1. Restore the original entities
            // 2. Remove the merged entity
            // 3. Update all relationships
            // 4. Notify other systems
            
            const undoResult = await this.performUndo(lastOperation);
            
            // Add to redo stack
            this.redoStack.push({
                ...lastOperation,
                undoTimestamp: new Date(),
                undoResult
            });
            
            // Update the original record
            const originalRecord = this.history.find(r => r.id === lastOperation.id);
            if (originalRecord) {
                originalRecord.status = 'undone';
                originalRecord.undoTimestamp = new Date();
            }
            
            this.saveToStorage();
            
            return {
                success: true,
                operation: lastOperation,
                message: `Undid merge of "${lastOperation.primaryEntity.name}" and "${lastOperation.secondaryEntity.name}"`
            };
            
        } catch (error) {
            // Put the operation back on the undo stack if undo failed
            this.undoStack.push(lastOperation);
            throw error;
        }
    }

    /**
     * Redo the last undone operation
     */
    async redoLastUndo() {
        if (this.redoStack.length === 0) {
            throw new Error('No operations to redo');
        }
        
        const lastUndo = this.redoStack.pop();
        
        try {
            // Perform the merge again
            const redoResult = await this.performRedo(lastUndo);
            
            // Add back to undo stack
            this.undoStack.push(lastUndo);
            
            // Update the record
            const originalRecord = this.history.find(r => r.id === lastUndo.id);
            if (originalRecord) {
                originalRecord.status = 'completed';
                originalRecord.redoTimestamp = new Date();
            }
            
            this.saveToStorage();
            
            return {
                success: true,
                operation: lastUndo,
                message: `Redid merge of "${lastUndo.primaryEntity.name}" and "${lastUndo.secondaryEntity.name}"`
            };
            
        } catch (error) {
            // Put the operation back on the redo stack if redo failed
            this.redoStack.push(lastUndo);
            throw error;
        }
    }

    /**
     * Perform the actual undo operation
     */
    async performUndo(operation) {
        // This would be implemented to actually restore entities
        // For now, return a mock result
        return {
            entitiesRestored: [operation.primaryEntity.id, operation.secondaryEntity.id],
            entityRemoved: operation.resultingEntity.id,
            relationshipsRestored: operation.impact.relationshipsAdded
        };
    }

    /**
     * Perform the actual redo operation
     */
    async performRedo(operation) {
        // This would be implemented to actually re-merge entities
        // For now, return a mock result
        return {
            entityCreated: operation.resultingEntity.id,
            entitiesRemoved: [operation.primaryEntity.id, operation.secondaryEntity.id],
            relationshipsMerged: operation.impact.relationshipsAdded
        };
    }

    /**
     * Get merge chain for an entity (all merges that led to current state)
     */
    getMergeChain(entityId) {
        const chain = [];
        const visited = new Set();
        
        const findMerges = (id) => {
            if (visited.has(id)) return;
            visited.add(id);
            
            // Find merges where this entity was the result
            const merges = this.history.filter(record => 
                record.resultingEntity.id === id && record.status === 'completed'
            );
            
            merges.forEach(merge => {
                chain.push(merge);
                // Recursively find merges for the source entities
                findMerges(merge.primaryEntity.id);
                findMerges(merge.secondaryEntity.id);
            });
        };
        
        findMerges(entityId);
        
        // Sort by timestamp
        chain.sort((a, b) => a.timestamp - b.timestamp);
        
        return chain;
    }

    /**
     * Export merge history for analysis or backup
     */
    exportHistory(format = 'json') {
        const data = {
            exportTimestamp: new Date(),
            totalRecords: this.history.length,
            statistics: this.getStatistics(),
            history: this.history
        };
        
        switch (format) {
            case 'json':
                return JSON.stringify(data, null, 2);
            case 'csv':
                return this.convertToCSV(this.history);
            default:
                return data;
        }
    }

    /**
     * Convert history to CSV format
     */
    convertToCSV(records) {
        const headers = [
            'ID', 'Timestamp', 'Type', 'Status',
            'Primary Entity', 'Secondary Entity', 'Resulting Entity',
            'Similarity', 'Confidence Change', 'Relationships Added',
            'User ID', 'Source'
        ];
        
        const rows = records.map(record => [
            record.id,
            record.timestamp.toISOString(),
            record.type,
            record.status,
            record.primaryEntity.name,
            record.secondaryEntity.name,
            record.resultingEntity.name,
            record.similarity?.overall || 0,
            record.impact.confidenceChange,
            record.impact.relationshipsAdded,
            record.metadata.userId,
            record.metadata.source
        ]);
        
        return [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');
    }

    /**
     * Load history from persistent storage
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem('merge-history');
            if (stored) {
                const data = JSON.parse(stored);
                this.history = data.history || [];
                this.undoStack = data.undoStack || [];
                this.redoStack = data.redoStack || [];
                
                // Convert timestamp strings back to Date objects
                this.history.forEach(record => {
                    record.timestamp = new Date(record.timestamp);
                    if (record.undoTimestamp) {
                        record.undoTimestamp = new Date(record.undoTimestamp);
                    }
                });
            }
        } catch (error) {
            console.error('Failed to load merge history from storage:', error);
        }
    }

    /**
     * Save history to persistent storage
     */
    saveToStorage() {
        try {
            const data = {
                history: this.history,
                undoStack: this.undoStack,
                redoStack: this.redoStack,
                lastSaved: new Date()
            };
            localStorage.setItem('merge-history', JSON.stringify(data));
        } catch (error) {
            console.error('Failed to save merge history to storage:', error);
        }
    }

    /**
     * Clear all history (use with caution)
     */
    clearHistory() {
        this.history = [];
        this.undoStack = [];
        this.redoStack = [];
        this.saveToStorage();
    }

    /**
     * Validate merge history integrity
     */
    validateIntegrity() {
        const issues = [];
        
        this.history.forEach((record, index) => {
            // Check required fields
            if (!record.id || !record.timestamp || !record.primaryEntity || !record.secondaryEntity) {
                issues.push(`Record ${index}: Missing required fields`);
            }
            
            // Check entity consistency
            if (record.primaryEntity.id === record.secondaryEntity.id) {
                issues.push(`Record ${index}: Primary and secondary entities are the same`);
            }
            
            // Check timestamp order
            if (index > 0 && record.timestamp < this.history[index - 1].timestamp) {
                issues.push(`Record ${index}: Timestamp out of order`);
            }
        });
        
        return {
            valid: issues.length === 0,
            issues
        };
    }
}

export default MergeHistory;
