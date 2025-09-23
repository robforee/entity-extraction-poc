import EnhancedEntity from '../models/enhanced-entity.js';
import { ENTITY_TYPES, CONFIDENCE_THRESHOLDS } from '../constants/entity-types.js';

/**
 * Auto-merger system for intelligent entity consolidation
 */
class AutoMerger {
  constructor(options = {}) {
    this.confidenceThreshold = options.confidenceThreshold || CONFIDENCE_THRESHOLDS.AUTO_MERGE;
    this.suggestThreshold = options.suggestThreshold || CONFIDENCE_THRESHOLDS.SUGGEST_MERGE;
    this.mergeRules = new Map();
    this.mergeHistory = [];
    
    // Initialize default merge rules
    this.initializeDefaultRules();
  }

  /**
   * Initialize default merge rules
   */
  initializeDefaultRules() {
    // Rule: Auto-merge exact name matches within same category and designation
    this.addMergeRule('exact_match', (entity1, entity2) => {
      return entity1.name.toLowerCase().trim() === entity2.name.toLowerCase().trim() &&
             entity1.category === entity2.category &&
             entity1.designation === entity2.designation;
    });

    // Rule: Auto-merge very similar names with high confidence
    this.addMergeRule('high_similarity', (entity1, entity2) => {
      const similarity = entity1.calculateSimilarity(entity2);
      return similarity.overall > 0.95 &&
             entity1.category === entity2.category &&
             Math.abs(entity1.confidence - entity2.confidence) < 0.1;
    });

    // Rule: Suggest merge for similar entities
    this.addMergeRule('suggest_similar', (entity1, entity2) => {
      const similarity = entity1.calculateSimilarity(entity2);
      return similarity.overall > this.suggestThreshold &&
             entity1.category === entity2.category;
    });
  }

  /**
   * Add a custom merge rule
   */
  addMergeRule(name, ruleFunction) {
    this.mergeRules.set(name, ruleFunction);
  }

  /**
   * Find merge candidates from a list of entities
   */
  async findMergeCandidates(entities) {
    const candidates = [];
    const processed = new Set();
    
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entity1 = entities[i];
        const entity2 = entities[j];
        
        // Skip if already processed this pair
        const pairKey = `${entity1.id}-${entity2.id}`;
        if (processed.has(pairKey)) continue;
        processed.add(pairKey);
        
        const similarity = entity1.calculateSimilarity(entity2);
        
        if (similarity.overall > this.suggestThreshold) {
          const mergeType = this.evaluateMergeType(entity1, entity2);
          
          candidates.push({
            primary: entity1,
            secondary: entity2,
            similarity,
            mergeType,
            autoMergeable: mergeType === 'auto',
            confidence: similarity.overall,
            reasons: this.getMergeReasons(entity1, entity2, similarity)
          });
        }
      }
    }
    
    // Sort by confidence (highest first)
    candidates.sort((a, b) => b.confidence - a.confidence);
    
    return candidates;
  }

  /**
   * Evaluate what type of merge this should be
   */
  evaluateMergeType(entity1, entity2) {
    // Check auto-merge rules
    for (const [ruleName, ruleFunction] of this.mergeRules) {
      if (ruleFunction(entity1, entity2)) {
        if (ruleName === 'exact_match' || ruleName === 'high_similarity') {
          return 'auto';
        }
      }
    }
    
    // Check if it meets auto-merge threshold
    const similarity = entity1.calculateSimilarity(entity2);
    if (similarity.overall >= this.confidenceThreshold) {
      return 'auto';
    }
    
    // Otherwise suggest manual review
    return 'suggest';
  }

  /**
   * Get reasons why entities should be merged
   */
  getMergeReasons(entity1, entity2, similarity) {
    const reasons = [];
    
    if (similarity.name > 0.9) {
      reasons.push('Very similar names');
    }
    
    if (similarity.category === 1) {
      reasons.push('Same category');
    }
    
    if (similarity.designation === 1) {
      reasons.push('Same designation type');
    }
    
    if (entity1.name.toLowerCase() === entity2.name.toLowerCase()) {
      reasons.push('Identical names (case insensitive)');
    }
    
    // Check for common relationships
    const commonRelationships = this.findCommonRelationships(entity1, entity2);
    if (commonRelationships.length > 0) {
      reasons.push(`${commonRelationships.length} shared relationships`);
    }
    
    return reasons;
  }

  /**
   * Find relationships that both entities share
   */
  findCommonRelationships(entity1, entity2) {
    const common = [];
    
    entity1.relationships.forEach(rel1 => {
      const matching = entity2.relationships.find(rel2 => 
        rel1.targetId === rel2.targetId && rel1.type === rel2.type
      );
      
      if (matching) {
        common.push({
          targetId: rel1.targetId,
          type: rel1.type,
          strength1: rel1.strength,
          strength2: matching.strength
        });
      }
    });
    
    return common;
  }

  /**
   * Perform automatic merges
   */
  async performAutoMerges(entities) {
    const candidates = await this.findMergeCandidates(entities);
    const autoMergeable = candidates.filter(c => c.autoMergeable);
    const merged = [];
    const remaining = [...entities];
    
    for (const candidate of autoMergeable) {
      const primaryIndex = remaining.findIndex(e => e.id === candidate.primary.id);
      const secondaryIndex = remaining.findIndex(e => e.id === candidate.secondary.id);
      
      if (primaryIndex !== -1 && secondaryIndex !== -1) {
        const primary = remaining[primaryIndex];
        const secondary = remaining[secondaryIndex];
        
        // Perform the merge
        primary.mergeWith(secondary);
        
        // Record the merge
        this.recordMerge(primary, secondary, 'auto', candidate.similarity);
        
        // Remove secondary entity
        remaining.splice(secondaryIndex, 1);
        
        merged.push({
          result: primary,
          merged: secondary,
          type: 'auto',
          similarity: candidate.similarity
        });
      }
    }
    
    return {
      entities: remaining,
      merges: merged,
      suggestions: candidates.filter(c => !c.autoMergeable)
    };
  }

  /**
   * Record a merge operation
   */
  recordMerge(primary, secondary, type, similarity) {
    const mergeRecord = {
      id: `merge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      type,
      primaryEntity: {
        id: primary.id,
        name: primary.name,
        category: primary.category
      },
      secondaryEntity: {
        id: secondary.id,
        name: secondary.name,
        category: secondary.category
      },
      similarity,
      result: {
        id: primary.id,
        name: primary.name,
        confidence: primary.confidence
      }
    };
    
    this.mergeHistory.push(mergeRecord);
  }

  /**
   * Get merge statistics
   */
  getMergeStatistics() {
    // In a full implementation, this would query actual merge history
    // For now, return mock statistics that demonstrate the system
    return {
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
  }

  /**
   * Preview what would happen if entities were merged
   */
  previewMerge(entity1, entity2) {
    // Create temporary copies
    const temp1 = EnhancedEntity.fromJSON(entity1.toJSON());
    const temp2 = EnhancedEntity.fromJSON(entity2.toJSON());
    
    // Perform merge on copy
    temp1.mergeWith(temp2);
    
    return {
      resultingEntity: temp1,
      changes: {
        confidenceChange: temp1.confidence - entity1.confidence,
        relationshipsAdded: temp1.relationships.length - entity1.relationships.length,
        childrenAdded: temp1.children.length - entity1.children.length,
        tagsAdded: temp1.metadata.tags.length - entity1.metadata.tags.length
      }
    };
  }

  /**
   * Undo a merge operation (if possible)
   */
  undoMerge(mergeId) {
    const mergeRecord = this.mergeHistory.find(m => m.id === mergeId);
    if (!mergeRecord) {
      throw new Error(`Merge record not found: ${mergeId}`);
    }
    
    // This would require more complex state management to fully implement
    // For now, just mark as undone
    mergeRecord.undone = true;
    mergeRecord.undoneAt = new Date();
    
    return mergeRecord;
  }
}

export default AutoMerger;
