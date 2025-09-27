/**
 * Management Module - Entity management and merge functionality
 */
class Management {
    static renderManagement(app) {
        console.log('Rendering management view');
        Management.showMergeStatistics(app);
    }

    static async findMergeCandidates(app) {
        try {
            app.showLoading();
            const response = await fetch(`${app.apiBaseUrl}/api/merging/candidates`);
            const data = await response.json();
            
            Management.displayMergeCandidates(app, data.candidates);
            
        } catch (error) {
            console.error('Error loading merge candidates:', error);
            UIUtils.showToast('Failed to load merge candidates', 'error');
        } finally {
            app.hideLoading();
        }
    }

    static displayMergeCandidates(app, candidates) {
        console.log('Displaying merge candidates:', candidates.length, 'candidates');
        
        const container = document.getElementById('merge-candidates');
        if (!container) return;

        if (candidates.length === 0) {
            container.innerHTML = '<p class="placeholder">No merge candidates found</p>';
            return;
        }

        container.innerHTML = candidates.map((candidate, index) => `
            <div class="merge-candidate" data-similarity="${candidate.confidence}">
                <div class="candidate-header">
                    <h4>Merge Candidate #${index + 1}</h4>
                    <span class="confidence-badge ${Management.getConfidenceClass(candidate.confidence)}">
                        ${(candidate.confidence * 100).toFixed(0)}% Match
                    </span>
                </div>
                
                <div class="candidate-entities">
                    <div class="entity-pair">
                        <div class="entity primary-entity">
                            <h5>${candidate.primary.name}</h5>
                            <p><strong>Category:</strong> ${candidate.primary.category}</p>
                            <p><strong>Confidence:</strong> ${UIUtils.formatConfidence(candidate.primary.confidence)}</p>
                            <p><strong>Source:</strong> ${UIUtils.getDocumentName(candidate.primary.metadata?.source)}</p>
                        </div>
                        
                        <div class="merge-arrow">→</div>
                        
                        <div class="entity secondary-entity">
                            <h5>${candidate.secondary.name}</h5>
                            <p><strong>Category:</strong> ${candidate.secondary.category}</p>
                            <p><strong>Confidence:</strong> ${UIUtils.formatConfidence(candidate.secondary.confidence)}</p>
                            <p><strong>Source:</strong> ${UIUtils.getDocumentName(candidate.secondary.metadata?.source)}</p>
                        </div>
                    </div>
                </div>
                
                <div class="candidate-actions">
                    <button onclick="window.app.performManualMerge('${candidate.primary.id}', '${candidate.secondary.id}')" 
                            class="btn btn-success">
                        ✅ Merge
                    </button>
                    <button onclick="Management.rejectMerge('${candidate.primary.id}', '${candidate.secondary.id}')" 
                            class="btn btn-danger">
                        ❌ Reject
                    </button>
                    <button onclick="Management.postponeMerge(${index})" 
                            class="btn btn-secondary">
                        ⏸️ Postpone
                    </button>
                </div>
            </div>
        `).join('');
    }

    static getConfidenceClass(confidence) {
        if (confidence >= 0.8) return 'high-confidence';
        if (confidence >= 0.6) return 'medium-confidence';
        return 'low-confidence';
    }

    static async performAutoMerge(app) {
        try {
            app.showLoading();
            const response = await fetch(`${app.apiBaseUrl}/api/merging/auto-merge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            
            if (data.success) {
                UIUtils.showToast(`Auto-merged ${data.mergesPerformed} entities. ${data.suggestions} suggestions remaining.`, 'success');
                // Refresh the candidates list
                Management.findMergeCandidates(app);
                // Update statistics
                Management.showMergeStatistics(app);
            } else {
                UIUtils.showToast('Auto-merge failed', 'error');
            }
        } catch (error) {
            console.error('Error performing auto-merge:', error);
            UIUtils.showToast('Failed to perform auto-merge', 'error');
        } finally {
            app.hideLoading();
        }
    }

    static async performManualMerge(app, primaryId, secondaryId) {
        try {
            app.showLoading();
            
            const response = await fetch(`${app.apiBaseUrl}/api/merging/manual-merge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ primaryId, secondaryId, action: 'merge' })
            });
            
            const result = await response.json();
            
            if (result.success) {
                UIUtils.showToast(`Successfully merged entities: ${result.mergedEntity?.name || 'entities'}`, 'success');
                
                // Refresh merge candidates
                Management.findMergeCandidates(app);
                
                // Update statistics
                Management.showMergeStatistics(app);
                
                // Refresh network if currently viewing
                if (app.currentView === 'network') {
                    NetworkVisualization.renderNetwork(app);
                }
            } else {
                UIUtils.showToast(`Merge failed: ${result.message}`, 'error');
            }
            
        } catch (error) {
            console.error('Error performing manual merge:', error);
            UIUtils.showToast('Failed to perform merge', 'error');
        } finally {
            app.hideLoading();
        }
    }

    static async showMergeStatistics(app) {
        try {
            const response = await fetch(`${app.apiBaseUrl}/api/merging/statistics`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const stats = await response.json();
            console.log('Merge statistics loaded successfully:', stats);
            
            document.getElementById('total-merges').textContent = stats.totalMerges || 0;
            document.getElementById('auto-merges').textContent = stats.autoMerges || 0;
            document.getElementById('manual-merges').textContent = stats.manualMerges || 0;
            document.getElementById('avg-similarity').textContent = `${(stats.averageSimilarity * 100).toFixed(1)}%` || '0%';
            document.getElementById('pending-merges').textContent = stats.pendingMerges || 0;
            document.getElementById('merge-accuracy').textContent = `${(stats.accuracy * 100).toFixed(1)}%` || '0%';
            
        } catch (error) {
            console.error('Error loading merge statistics:', error);
            // Set default values if API fails
            document.getElementById('total-merges').textContent = '0';
            document.getElementById('auto-merges').textContent = '0';
            document.getElementById('manual-merges').textContent = '0';
            document.getElementById('avg-similarity').textContent = '0%';
            document.getElementById('pending-merges').textContent = '0';
            document.getElementById('merge-accuracy').textContent = '0%';
        }
    }

    static async resetMergedPairs(app) {
        const confirmed = confirm('Reset all merged pairs? This will make previously merged entities appear as candidates again.');
        if (!confirmed) return;
        
        try {
            const response = await fetch(`${app.apiBaseUrl}/api/merging/reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const result = await response.json();
            
            if (result.success) {
                UIUtils.showToast('Merged pairs reset successfully', 'success');
                Management.findMergeCandidates(app);
                Management.showMergeStatistics(app);
            } else {
                UIUtils.showToast('Failed to reset merged pairs', 'error');
            }
            
        } catch (error) {
            console.error('Error resetting merged pairs:', error);
            UIUtils.showToast('Failed to reset merged pairs', 'error');
        }
    }

    static rejectMerge(primaryId, secondaryId) {
        UIUtils.showToast('Merge rejected (functionality to be implemented)', 'info');
    }

    static postponeMerge(index) {
        UIUtils.showToast('Merge postponed (functionality to be implemented)', 'info');
    }

    static async mergeSelectedEntities(app) {
        const selectedCards = document.querySelectorAll('.entity-card.selected');
        if (selectedCards.length < 2) {
            UIUtils.showToast('Please select at least 2 entities to merge', 'warning');
            return;
        }

        const selectedEntities = Array.from(selectedCards).map(card => ({
            id: card.dataset.entityId,
            name: card.querySelector('.entity-name')?.textContent || 'Unknown'
        }));

        console.log('Merging entities:', selectedEntities);
        UIUtils.showToast(`Merging ${selectedEntities.length} entities: ${selectedEntities.map(e => e.name).join(', ')}`, 'info');
        
        // TODO: Implement actual merge API call
        // For now, just show what would be merged
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            UIUtils.showToast('Entities merged successfully! (Demo mode)', 'success');
            
            // Clear selections
            selectedCards.forEach(card => card.classList.remove('selected'));
            Management.updateMergeButtons();
        } catch (error) {
            console.error('Merge failed:', error);
            UIUtils.showToast('Failed to merge entities', 'error');
        }
    }

    static splitEntity() {
        UIUtils.showToast('Split entity functionality coming soon', 'info');
    }

    static async viewSimilarEntities() {
        const selectedCards = document.querySelectorAll('.entity-card.selected');
        if (selectedCards.length !== 1) {
            UIUtils.showToast('Please select exactly one entity to view similar entities', 'warning');
            return;
        }

        const entityName = selectedCards[0].querySelector('.entity-name')?.textContent;
        UIUtils.showToast(`Finding entities similar to: ${entityName}`, 'info');
        
        // TODO: Implement similar entity search
        console.log('Finding similar entities for:', entityName);
    }

    static updateMergeButtons() {
        const selectedCount = document.querySelectorAll('.entity-card.selected').length;
        const mergeBtn = document.getElementById('merge-selected');
        const splitBtn = document.getElementById('split-entity');
        const similarBtn = document.getElementById('view-similar');
        
        if (mergeBtn) mergeBtn.disabled = selectedCount < 2;
        if (splitBtn) splitBtn.disabled = selectedCount !== 1;
        if (similarBtn) similarBtn.disabled = selectedCount !== 1;
    }
}
