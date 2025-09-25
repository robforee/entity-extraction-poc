/**
 * Advanced Merge Interface for Entity Management
 * Provides detailed entity comparison, relationship analysis, and merge workflows
 */
class MergeInterface {
    constructor(app) {
        this.app = app;
        this.pendingMerges = [];
        this.mergeHistory = [];
        this.selectedCandidates = new Set();
        
        this.initializeInterface();
    }

    initializeInterface() {
        // Add event listeners for batch operations
        this.setupBatchControls();
    }

    setupBatchControls() {
        const managementView = document.getElementById('management-view');
        if (managementView) {
            // Add batch selection controls
            const batchControls = document.createElement('div');
            batchControls.className = 'batch-controls';
            batchControls.innerHTML = `
                <div class="batch-selection">
                    <button onclick="mergeInterface.selectAllCandidates()" class="btn btn-secondary">
                        ☑️ Select All
                    </button>
                    <button onclick="mergeInterface.clearSelection()" class="btn btn-secondary">
                        ❌ Clear Selection
                    </button>
                    <button onclick="mergeInterface.batchAutoMerge()" class="btn btn-success" disabled id="batch-merge-btn">
                        ⚡ Batch Auto-Merge (<span id="selected-count">0</span>)
                    </button>
                </div>
                <div class="merge-filters">
                    <label>
                        <input type="checkbox" id="filter-auto-mergeable" checked>
                        Show auto-mergeable only
                    </label>
                    <label>
                        Min similarity: 
                        <input type="range" id="similarity-threshold" min="0.5" max="1" step="0.05" value="0.7">
                        <span id="similarity-value">70%</span>
                    </label>
                </div>
            `;
            
            const managementControls = managementView.querySelector('.management-controls');
            managementControls.after(batchControls);
            
            // Add event listeners
            document.getElementById('similarity-threshold').addEventListener('input', (e) => {
                const value = (e.target.value * 100).toFixed(0);
                document.getElementById('similarity-value').textContent = `${value}%`;
                this.filterCandidates();
            });
            
            document.getElementById('filter-auto-mergeable').addEventListener('change', () => {
                this.filterCandidates();
            });
        }
    }

    /**
     * Enhanced display of merge candidates with detailed comparison
     */
    displayMergeCandidates(candidates) {
        const container = document.getElementById('merge-candidates');
        
        if (candidates.length === 0) {
            container.innerHTML = '<p class="placeholder">No merge candidates found</p>';
            return;
        }

        // Store candidates for filtering
        this.allCandidates = candidates;
        
        container.innerHTML = candidates.map((candidate, index) => `
            <div class="merge-candidate" data-index="${index}" data-similarity="${candidate.confidence}">
                <div class="candidate-header">
                    <div class="candidate-selection">
                        <input type="checkbox" class="candidate-checkbox" data-index="${index}">
                        <span class="candidate-id">#${index + 1}</span>
                    </div>
                    <div class="candidate-actions">
                        <button onclick="mergeInterface.showDetailedComparison(${index})" class="btn btn-info btn-sm">
                            🔍 Detailed View
                        </button>
                        <button onclick="mergeInterface.quickMerge(${index})" class="btn btn-success btn-sm">
                            ⚡ Quick Merge
                        </button>
                    </div>
                </div>
                
                <div class="entity-comparison">
                    <div class="entity-card primary">
                        <div class="entity-header">
                            <h4>${candidate.primary.name}</h4>
                            <span class="entity-designation">${candidate.primary.designation || 'generic'}</span>
                        </div>
                        <div class="entity-details">
                            <p><strong>Category:</strong> ${candidate.primary.category}</p>
                            <p><strong>Confidence:</strong> ${(candidate.primary.confidence * 100).toFixed(1)}%</p>
                            <p><strong>Relationships:</strong> ${candidate.primary.relationships?.length || 0}</p>
                            <p><strong>Source:</strong> ${candidate.primary.metadata?.source || 'Unknown'}</p>
                        </div>
                    </div>
                    
                    <div class="merge-analysis">
                        <div class="similarity-breakdown">
                            <h5>Similarity Analysis</h5>
                            <div class="similarity-bars">
                                <div class="similarity-bar">
                                    <span>Name:</span>
                                    <div class="bar">
                                        <div class="fill" style="width: ${(candidate.similarity.name * 100)}%"></div>
                                    </div>
                                    <span>${(candidate.similarity.name * 100).toFixed(0)}%</span>
                                </div>
                                <div class="similarity-bar">
                                    <span>Category:</span>
                                    <div class="bar">
                                        <div class="fill" style="width: ${(candidate.similarity.category * 100)}%"></div>
                                    </div>
                                    <span>${(candidate.similarity.category * 100).toFixed(0)}%</span>
                                </div>
                                <div class="similarity-bar">
                                    <span>Overall:</span>
                                    <div class="bar">
                                        <div class="fill ${this.getSimilarityClass(candidate.confidence)}" style="width: ${(candidate.confidence * 100)}%"></div>
                                    </div>
                                    <span>${(candidate.confidence * 100).toFixed(0)}%</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="merge-impact">
                            <h5>Merge Impact</h5>
                            <ul class="impact-list">
                                ${candidate.reasons.map(reason => `<li>${reason}</li>`).join('')}
                            </ul>
                            <div class="merge-type">
                                <span class="badge ${candidate.autoMergeable ? 'badge-success' : 'badge-warning'}">
                                    ${candidate.autoMergeable ? 'Auto-mergeable' : 'Manual review'}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="entity-card secondary">
                        <div class="entity-header">
                            <h4>${candidate.secondary.name}</h4>
                            <span class="entity-designation">${candidate.secondary.designation || 'generic'}</span>
                        </div>
                        <div class="entity-details">
                            <p><strong>Category:</strong> ${candidate.secondary.category}</p>
                            <p><strong>Confidence:</strong> ${(candidate.secondary.confidence * 100).toFixed(1)}%</p>
                            <p><strong>Relationships:</strong> ${candidate.secondary.relationships?.length || 0}</p>
                            <p><strong>Source:</strong> ${candidate.secondary.metadata?.source || 'Unknown'}</p>
                        </div>
                    </div>
                </div>
                
                <div class="candidate-footer">
                    <button onclick="mergeInterface.rejectMerge('${candidate.primary.id}', '${candidate.secondary.id}', ${index})" 
                            class="btn btn-outline-danger btn-sm">
                        ❌ Reject
                    </button>
                    <button onclick="mergeInterface.postponeMerge(${index})" class="btn btn-outline-secondary btn-sm">
                        ⏸️ Postpone
                    </button>
                </div>
            </div>
        `).join('');

        // Add checkbox event listeners
        document.querySelectorAll('.candidate-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', () => this.updateSelection());
        });
    }

    /**
     * Show detailed comparison modal for complex merge decisions
     */
    showDetailedComparison(candidateIndex) {
        const candidate = this.allCandidates[candidateIndex];
        
        // Create detailed comparison modal
        const modal = document.createElement('div');
        modal.className = 'merge-modal';
        modal.innerHTML = `
            <div class="modal-content large">
                <div class="modal-header">
                    <h3>Detailed Entity Comparison</h3>
                    <button onclick="this.closest('.merge-modal').remove()" class="modal-close">×</button>
                </div>
                
                <div class="modal-body">
                    <div class="detailed-comparison">
                        <div class="comparison-section">
                            <h4>Entity Details</h4>
                            <div class="details-grid">
                                <div class="detail-column">
                                    <h5>Primary Entity</h5>
                                    <div class="entity-full-details">
                                        <p><strong>Name:</strong> ${candidate.primary.name}</p>
                                        <p><strong>Category:</strong> ${candidate.primary.category}</p>
                                        <p><strong>Designation:</strong> ${candidate.primary.designation || 'generic'}</p>
                                        <p><strong>Confidence:</strong> ${(candidate.primary.confidence * 100).toFixed(1)}%</p>
                                        <p><strong>Description:</strong> ${candidate.primary.description || 'No description'}</p>
                                        <p><strong>Source:</strong> ${candidate.primary.metadata?.source || 'Unknown'}</p>
                                        <p><strong>Extraction Date:</strong> ${new Date(candidate.primary.metadata?.extractionDate || Date.now()).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                
                                <div class="detail-column">
                                    <h5>Secondary Entity</h5>
                                    <div class="entity-full-details">
                                        <p><strong>Name:</strong> ${candidate.secondary.name}</p>
                                        <p><strong>Category:</strong> ${candidate.secondary.category}</p>
                                        <p><strong>Designation:</strong> ${candidate.secondary.designation || 'generic'}</p>
                                        <p><strong>Confidence:</strong> ${(candidate.secondary.confidence * 100).toFixed(1)}%</p>
                                        <p><strong>Description:</strong> ${candidate.secondary.description || 'No description'}</p>
                                        <p><strong>Source:</strong> ${candidate.secondary.metadata?.source || 'Unknown'}</p>
                                        <p><strong>Extraction Date:</strong> ${new Date(candidate.secondary.metadata?.extractionDate || Date.now()).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="comparison-section">
                            <h4>Relationship Analysis</h4>
                            <div class="relationship-comparison">
                                <div class="relationship-column">
                                    <h5>Primary Relationships (${candidate.primary.relationships?.length || 0})</h5>
                                    <div class="relationship-list">
                                        ${this.renderRelationshipList(candidate.primary.relationships)}
                                    </div>
                                </div>
                                
                                <div class="relationship-column">
                                    <h5>Secondary Relationships (${candidate.secondary.relationships?.length || 0})</h5>
                                    <div class="relationship-list">
                                        ${this.renderRelationshipList(candidate.secondary.relationships)}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="comparison-section">
                            <h4>Merge Preview</h4>
                            <div id="merge-preview-${candidateIndex}" class="merge-preview-container">
                                <button onclick="mergeInterface.generateMergePreview(${candidateIndex})" class="btn btn-primary">
                                    Generate Merge Preview
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button onclick="mergeInterface.confirmDetailedMerge(${candidateIndex})" class="btn btn-success">
                        ✅ Confirm Merge
                    </button>
                    <button onclick="mergeInterface.rejectMerge('${candidate.primary.id}', '${candidate.secondary.id}', ${candidateIndex})" class="btn btn-danger">
                        ❌ Reject Merge
                    </button>
                    <button onclick="this.closest('.merge-modal').remove()" class="btn btn-secondary">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    renderRelationshipList(relationships) {
        if (!relationships || relationships.length === 0) {
            return '<p class="no-relationships">No relationships found</p>';
        }
        
        return relationships.map(rel => `
            <div class="relationship-item">
                <span class="relationship-type">${rel.type}</span>
                <span class="relationship-target">${rel.targetId}</span>
                <span class="relationship-strength">${(rel.strength * 100).toFixed(0)}%</span>
            </div>
        `).join('');
    }

    /**
     * Generate detailed merge preview
     */
    async generateMergePreview(candidateIndex) {
        const candidate = this.allCandidates[candidateIndex];
        const container = document.getElementById(`merge-preview-${candidateIndex}`);
        
        try {
            container.innerHTML = '<div class="loading">Generating preview...</div>';
            
            const response = await fetch('/api/merging/manual-merge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    primaryId: candidate.primary.id, 
                    secondaryId: candidate.secondary.id 
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                const preview = data.preview;
                container.innerHTML = `
                    <div class="merge-preview-details">
                        <h5>Resulting Entity</h5>
                        <div class="preview-entity">
                            <p><strong>Name:</strong> ${preview.resultingEntity.name}</p>
                            <p><strong>Confidence:</strong> ${(preview.resultingEntity.confidence * 100).toFixed(1)}%</p>
                            <p><strong>Total Relationships:</strong> ${preview.resultingEntity.relationships?.length || 0}</p>
                        </div>
                        
                        <h5>Changes Summary</h5>
                        <div class="changes-summary">
                            <div class="change-item ${preview.changes.confidenceChange > 0 ? 'positive' : 'negative'}">
                                <span>Confidence Change:</span>
                                <span>${preview.changes.confidenceChange > 0 ? '+' : ''}${(preview.changes.confidenceChange * 100).toFixed(1)}%</span>
                            </div>
                            <div class="change-item positive">
                                <span>Relationships Added:</span>
                                <span>+${preview.changes.relationshipsAdded}</span>
                            </div>
                            <div class="change-item positive">
                                <span>Children Added:</span>
                                <span>+${preview.changes.childrenAdded}</span>
                            </div>
                            <div class="change-item positive">
                                <span>Tags Added:</span>
                                <span>+${preview.changes.tagsAdded}</span>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                container.innerHTML = '<div class="error">Failed to generate preview</div>';
            }
        } catch (error) {
            console.error('Error generating merge preview:', error);
            container.innerHTML = '<div class="error">Error generating preview</div>';
        }
    }

    /**
     * Batch operations
     */
    selectAllCandidates() {
        document.querySelectorAll('.candidate-checkbox').forEach(checkbox => {
            checkbox.checked = true;
        });
        this.updateSelection();
    }

    clearSelection() {
        document.querySelectorAll('.candidate-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });
        this.updateSelection();
    }

    updateSelection() {
        const checkboxes = document.querySelectorAll('.candidate-checkbox:checked');
        const count = checkboxes.length;
        
        document.getElementById('selected-count').textContent = count;
        document.getElementById('batch-merge-btn').disabled = count === 0;
        
        // Update selected candidates set
        this.selectedCandidates.clear();
        checkboxes.forEach(checkbox => {
            this.selectedCandidates.add(parseInt(checkbox.dataset.index));
        });
    }

    async batchAutoMerge() {
        if (this.selectedCandidates.size === 0) {
            this.app.showToast('No candidates selected for batch merge', 'warning');
            return;
        }
        
        const selectedCandidates = Array.from(this.selectedCandidates).map(index => this.allCandidates[index]);
        const autoMergeableCandidates = selectedCandidates.filter(c => c.autoMergeable);
        
        if (autoMergeableCandidates.length === 0) {
            this.app.showToast('No auto-mergeable candidates selected', 'warning');
            return;
        }
        
        const confirmed = confirm(`Batch merge ${autoMergeableCandidates.length} auto-mergeable entities?`);
        if (!confirmed) return;
        
        try {
            this.app.showToast('Processing batch merge...', 'info');
            
            // Process each auto-mergeable candidate via API
            let successCount = 0;
            for (const candidate of autoMergeableCandidates) {
                try {
                    const response = await fetch('/api/merging/manual-merge', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            primaryId: candidate.primary.id,
                            secondaryId: candidate.secondary.id,
                            action: 'merge'
                        })
                    });
                    
                    if (response.ok) {
                        successCount++;
                    }
                } catch (mergeError) {
                    console.error('Individual merge failed:', mergeError);
                }
            }
            
            this.app.showToast(`Successfully batch merged ${successCount}/${autoMergeableCandidates.length} entities`, 'success');
            
            // Clear selection and refresh
            this.clearSelection();
            this.app.findMergeCandidates();
            
        } catch (error) {
            console.error('Error in batch merge:', error);
            this.app.showToast('Batch merge failed', 'error');
        } finally {
            this.app.hideLoading();
        }
    }

    /**
     * Filter candidates based on criteria
     */
    filterCandidates() {
        const autoMergeableOnly = document.getElementById('filter-auto-mergeable').checked;
        const minSimilarity = parseFloat(document.getElementById('similarity-threshold').value);
        
        document.querySelectorAll('.merge-candidate').forEach(candidate => {
            const similarity = parseFloat(candidate.dataset.similarity);
            const isAutoMergeable = candidate.querySelector('.badge-success') !== null;
            
            const showCandidate = (!autoMergeableOnly || isAutoMergeable) && similarity >= minSimilarity;
            
            candidate.style.display = showCandidate ? 'block' : 'none';
        });
    }

    /**
     * Utility methods
     */
    getSimilarityClass(confidence) {
        if (confidence >= 0.8) return 'similarity-high';
        if (confidence >= 0.6) return 'similarity-medium';
        return 'similarity-low';
    }

    quickMerge(candidateIndex) {
        const candidate = this.allCandidates[candidateIndex];
        if (candidate.autoMergeable) {
            this.app.performManualMerge(candidate.primary.id, candidate.secondary.id);
        } else {
            this.showDetailedComparison(candidateIndex);
        }
    }

    confirmDetailedMerge(candidateIndex) {
        const candidate = this.allCandidates[candidateIndex];
        this.app.performManualMerge(candidate.primary.id, candidate.secondary.id);
        
        // Close modal
        document.querySelector('.merge-modal').remove();
    }

    rejectMerge(primaryId, secondaryId, candidateIndex) {
        this.app.rejectMerge(primaryId, secondaryId);
        
        // Remove from display
        const candidateElement = document.querySelector(`[data-index="${candidateIndex}"]`);
        if (candidateElement) {
            candidateElement.style.opacity = '0.5';
            candidateElement.style.pointerEvents = 'none';
        }
        
        // Close modal if open
        const modal = document.querySelector('.merge-modal');
        if (modal) modal.remove();
    }

    postponeMerge(candidateIndex) {
        const candidateElement = document.querySelector(`[data-index="${candidateIndex}"]`);
        if (candidateElement) {
            candidateElement.style.opacity = '0.7';
            candidateElement.classList.add('postponed');
        }
        
        this.app.showToast('Merge postponed for later review', 'info');
    }
}

// Global instance
let mergeInterface = null;
