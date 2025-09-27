/**
 * Merge Handlers Module
 * Handles entity merging and relationship functionality
 */
import chalk from 'chalk';

export class MergeHandlers {
    constructor(server) {
        this.server = server;
    }

    async getMergeCandidates(req, res) {
        try {
            // Get real entities from current domain
            const allEntities = await this.server.getAllEntitiesFlat();
            
            if (allEntities.length === 0) {
                return res.json({ candidates: [] });
            }

            console.log(chalk.cyan(`🔍 Analyzing ${allEntities.length} entities for merge candidates...`));

            // Group entities by category for more efficient comparison
            const entitiesByCategory = {};
            allEntities.forEach(entity => {
                const category = entity.category || 'unknown';
                if (!entitiesByCategory[category]) {
                    entitiesByCategory[category] = [];
                }
                entitiesByCategory[category].push(entity);
            });

            const candidates = [];
            const processedPairs = new Set();

            // Compare entities within the same category
            for (const [category, entities] of Object.entries(entitiesByCategory)) {
                console.log(chalk.gray(`  📂 Processing ${entities.length} entities in category: ${category}`));
                
                for (let i = 0; i < entities.length; i++) {
                    for (let j = i + 1; j < entities.length; j++) {
                        const entity1 = entities[i];
                        const entity2 = entities[j];
                        
                        // Create a unique pair identifier
                        const pairId = [entity1.id, entity2.id].sort().join('|');
                        
                        // Skip if we've already processed this pair or if it's been merged
                        if (processedPairs.has(pairId) || this.server.mergedPairs.has(pairId)) {
                            continue;
                        }
                        
                        processedPairs.add(pairId);
                        
                        const similarity = this.server.calculateSimilarity(entity1.name, entity2.name);
                        
                        // Consider it a candidate if similarity is above threshold
                        if (similarity > 0.6) {
                            const confidence = this.calculateMergeConfidence(entity1, entity2, similarity);
                            
                            candidates.push({
                                primary: entity1,
                                secondary: entity2,
                                similarity: similarity,
                                confidence: confidence,
                                reasons: this.getMergeReasons(entity1, entity2, similarity),
                                category: category
                            });
                        }
                    }
                }
            }

            // Sort by confidence (highest first)
            candidates.sort((a, b) => b.confidence - a.confidence);
            
            // Limit to top candidates
            const topCandidates = candidates.slice(0, 20);
            
            console.log(chalk.green(`✅ Found ${topCandidates.length} merge candidates`));
            
            res.json({ 
                candidates: topCandidates,
                totalAnalyzed: allEntities.length,
                totalCandidates: candidates.length
            });
            
        } catch (error) {
            console.error('Error getting merge candidates:', error);
            res.status(500).json({ error: 'Failed to get merge candidates' });
        }
    }

    calculateMergeConfidence(entity1, entity2, similarity) {
        let confidence = similarity * 0.6; // Base similarity weight
        
        // Same category bonus
        if (entity1.category === entity2.category) {
            confidence += 0.2;
        }
        
        // Same document bonus
        if (entity1.conversationId === entity2.conversationId) {
            confidence += 0.1;
        }
        
        // High confidence entities bonus
        const avgConfidence = ((entity1.confidence || 0) + (entity2.confidence || 0)) / 2;
        confidence += avgConfidence * 0.1;
        
        return Math.min(confidence, 1.0);
    }

    getMergeReasons(entity1, entity2, similarity) {
        const reasons = [];
        
        if (similarity > 0.8) {
            reasons.push('Very similar names');
        } else if (similarity > 0.6) {
            reasons.push('Similar names');
        }
        
        if (entity1.category === entity2.category) {
            reasons.push('Same category');
        }
        
        if (entity1.conversationId === entity2.conversationId) {
            reasons.push('Same document');
        }
        
        if ((entity1.confidence || 0) > 0.8 && (entity2.confidence || 0) > 0.8) {
            reasons.push('High confidence entities');
        }
        
        return reasons;
    }

    async performAutoMerge(req, res) {
        try {
            const { threshold = 0.8 } = req.body; // Lower default threshold for more merges
            
            const candidatesResponse = await this.getMergeCandidatesInternal();
            const allCandidates = candidatesResponse.candidates;
            const highConfidenceCandidates = allCandidates.filter(
                candidate => candidate.confidence >= threshold
            );
            
            console.log(chalk.cyan(`🔍 Auto-merge analysis:`));
            console.log(chalk.gray(`  Total candidates: ${allCandidates.length}`));
            console.log(chalk.gray(`  High confidence (>=${threshold}): ${highConfidenceCandidates.length}`));
            
            let mergedCount = 0;
            const mergedPairs = [];
            
            for (const candidate of highConfidenceCandidates) {
                const pairId = [candidate.primary.id, candidate.secondary.id].sort().join('|');
                
                // Skip if already merged
                if (this.server.mergedPairs.has(pairId)) {
                    continue;
                }
                
                // Perform the merge (in a real implementation, this would update the database)
                this.server.mergedPairs.add(pairId);
                mergedPairs.push({
                    primary: candidate.primary.name,
                    secondary: candidate.secondary.name,
                    confidence: candidate.confidence
                });
                mergedCount++;
            }
            
            // Save merged pairs
            await this.server.saveMergedPairs();
            
            console.log(chalk.green(`✅ Auto-merge completed: ${mergedCount} pairs merged`));
            if (mergedPairs.length > 0) {
                console.log(chalk.gray('  Merged pairs:'));
                mergedPairs.forEach(pair => {
                    console.log(chalk.gray(`    "${pair.primary}" ← "${pair.secondary}" (${(pair.confidence * 100).toFixed(1)}%)`));
                });
            }
            
            res.json({
                success: true,
                mergedCount,
                mergedPairs,
                totalCandidates: allCandidates.length,
                highConfidenceCandidates: highConfidenceCandidates.length,
                threshold,
                message: `Auto-merged ${mergedCount} entity pairs`
            });
            
        } catch (error) {
            console.error('Error performing auto-merge:', error);
            res.status(500).json({ error: 'Failed to perform auto-merge' });
        }
    }

    async performManualMerge(req, res) {
        try {
            const { primaryId, secondaryId, confirmed = false } = req.body;
            
            if (!primaryId || !secondaryId) {
                return res.status(400).json({ error: 'Primary and secondary entity IDs required' });
            }
            
            const pairId = [primaryId, secondaryId].sort().join('|');
            
            // Check if already merged
            if (this.server.mergedPairs.has(pairId)) {
                return res.status(400).json({ error: 'Entities already merged' });
            }
            
            if (!confirmed) {
                // Return preview of what would be merged
                const allEntities = await this.server.getAllEntitiesFlat();
                const primary = allEntities.find(e => e.id === primaryId);
                const secondary = allEntities.find(e => e.id === secondaryId);
                
                if (!primary || !secondary) {
                    return res.status(404).json({ error: 'One or both entities not found' });
                }
                
                return res.json({
                    preview: true,
                    primary,
                    secondary,
                    similarity: this.server.calculateSimilarity(primary.name, secondary.name),
                    mergedEntity: {
                        name: primary.name, // Keep primary name
                        category: primary.category,
                        confidence: Math.max(primary.confidence || 0, secondary.confidence || 0),
                        sources: [primary.metadata?.source, secondary.metadata?.source].filter(Boolean)
                    }
                });
            }
            
            // Perform the actual merge
            this.server.mergedPairs.add(pairId);
            await this.server.saveMergedPairs();
            
            res.json({
                success: true,
                message: 'Entities merged successfully',
                mergedPair: { primaryId, secondaryId }
            });
            
        } catch (error) {
            console.error('Error performing manual merge:', error);
            res.status(500).json({ error: 'Failed to perform manual merge' });
        }
    }

    async previewManualMerge(req, res) {
        try {
            const { primaryId, secondaryId } = req.body;
            
            const allEntities = await this.server.getAllEntitiesFlat();
            const primary = allEntities.find(e => e.id === primaryId);
            const secondary = allEntities.find(e => e.id === secondaryId);
            
            if (!primary || !secondary) {
                return res.status(404).json({ error: 'One or both entities not found' });
            }
            
            const similarity = this.server.calculateSimilarity(primary.name, secondary.name);
            const confidence = this.calculateMergeConfidence(primary, secondary, similarity);
            
            res.json({
                primary,
                secondary,
                similarity,
                confidence,
                reasons: this.getMergeReasons(primary, secondary, similarity),
                mergedEntity: {
                    name: primary.name,
                    category: primary.category,
                    confidence: Math.max(primary.confidence || 0, secondary.confidence || 0),
                    combinedSources: [primary.metadata?.source, secondary.metadata?.source].filter(Boolean)
                }
            });
            
        } catch (error) {
            console.error('Error previewing manual merge:', error);
            res.status(500).json({ error: 'Failed to preview merge' });
        }
    }

    async getMergeCandidatesInternal() {
        // Internal method that returns candidates without HTTP response
        const allEntities = await this.server.getAllEntitiesFlat();
        const candidates = [];
        const processedPairs = new Set();

        for (let i = 0; i < allEntities.length; i++) {
            for (let j = i + 1; j < allEntities.length; j++) {
                const entity1 = allEntities[i];
                const entity2 = allEntities[j];
                
                const pairId = [entity1.id, entity2.id].sort().join('|');
                
                if (processedPairs.has(pairId) || this.server.mergedPairs.has(pairId)) {
                    continue;
                }
                
                processedPairs.add(pairId);
                
                const similarity = this.server.calculateSimilarity(entity1.name, entity2.name);
                
                if (similarity > 0.6) {
                    const confidence = this.calculateMergeConfidence(entity1, entity2, similarity);
                    
                    candidates.push({
                        primary: entity1,
                        secondary: entity2,
                        similarity: similarity,
                        confidence: confidence,
                        reasons: this.getMergeReasons(entity1, entity2, similarity),
                        category: entity1.category
                    });
                }
            }
        }

        return { candidates: candidates.sort((a, b) => b.confidence - a.confidence) };
    }
}
