/**
 * Main Application File - Extends base app with all functionality
 */
class UniversalKnowledgeAppMain extends UniversalKnowledgeApp {
    constructor() {
        super();
    }

    // Override setupEventListeners to use the EventHandlers module
    setupEventListeners() {
        EventHandlers.setupEventListeners(this);
    }

    // Override UI utility methods to use UIUtils module
    showLoading() {
        UIUtils.showLoading();
    }

    hideLoading() {
        UIUtils.hideLoading();
    }

    showToast(message, type = 'info', duration = 5000) {
        UIUtils.showToast(message, type, duration);
    }

    closeModal() {
        UIUtils.closeModal();
    }

    capitalizeWords(str) {
        return UIUtils.capitalizeWords(str);
    }

    populateDomainSelector() {
        UIUtils.populateDomainSelector(this);
    }

    populateFilterOptions() {
        UIUtils.populateFilterOptions(this);
    }

    // Domain switching
    async switchDomain(domainName) {
        try {
            this.showToast(`Switching to ${domainName} domain...`, 'info');
            
            const response = await fetch(`${this.apiBaseUrl}/api/domains/switch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ domain: domainName })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast(`Switched to ${domainName} domain`, 'success');
                // Data will be reloaded via WebSocket event
            } else {
                this.showToast('Failed to switch domain', 'error');
            }
        } catch (error) {
            console.error('Error switching domain:', error);
            this.showToast('Failed to switch domain', 'error');
        }
    }

    // View rendering methods
    renderDashboard() {
        Dashboard.renderDashboard(this);
    }

    renderManagement() {
        Management.renderManagement(this);
    }

    renderNetwork() {
        NetworkVisualization.renderNetwork(this);
    }

    async renderEntities() {
        await this.loadEntities();
    }

    async renderDocuments() {
        await this.loadDocuments();
    }

    renderAnalytics() {
        this.showToast('Analytics view coming soon', 'info');
    }

    renderSearch() {
        this.showToast('Search view coming soon', 'info');
    }

    // Entity loading and management
    async loadEntities() {
        try {
            const params = new URLSearchParams({
                page: this.currentPage || 0,
                limit: this.pageSize || 20
            });

            // Add filters only if they exist and are not null/empty
            if (this.filters && this.filters.category) {
                params.append('category', this.filters.category);
            }
            if (this.filters && this.filters.minConfidence) {
                params.append('minConfidence', this.filters.minConfidence);
            }

            const response = await fetch(`${this.apiBaseUrl}/api/entities?${params}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            this.displayEntities(data.entities || []);
            
        } catch (error) {
            console.error('Error loading entities:', error);
            this.showToast('Failed to load entities', 'error');
        }
    }

    displayEntities(entities) {
        const container = document.getElementById('entities-list');
        if (!container) return;

        if (entities.length === 0) {
            container.innerHTML = '<p class="placeholder">No entities found</p>';
            return;
        }

        container.innerHTML = entities.map(entity => `
            <div class="entity-card" data-entity-id="${entity.id}">
                <div class="entity-header">
                    <h3 class="entity-name">${entity.name}</h3>
                    <span class="entity-confidence ${this.getConfidenceClass(entity.confidence)}">
                        ${UIUtils.formatConfidence(entity.confidence)}
                    </span>
                </div>
                <div class="entity-details">
                    <p><strong>Category:</strong> ${UIUtils.capitalizeWords(entity.category)}</p>
                    <p><strong>Source:</strong> ${UIUtils.getDocumentName(entity.metadata?.source)}</p>
                    <p><strong>Context:</strong> ${UIUtils.truncateText(entity.context, 100)}</p>
                </div>
                <div class="entity-actions">
                    <button onclick="window.app.showEntityDetail('${entity.id}')" class="btn btn-sm btn-info">
                        View Details
                    </button>
                </div>
            </div>
        `).join('');

        // Add click handlers for selection
        container.querySelectorAll('.entity-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.tagName !== 'BUTTON') {
                    card.classList.toggle('selected');
                    Management.updateMergeButtons();
                }
            });
        });
    }

    getConfidenceClass(confidence) {
        if (confidence >= 0.8) return 'high-confidence';
        if (confidence >= 0.6) return 'medium-confidence';
        return 'low-confidence';
    }

    async loadDocuments() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/documents`);
            const data = await response.json();
            this.displayDocuments(data.documents || []);
        } catch (error) {
            console.error('Error loading documents:', error);
            this.showToast('Failed to load documents', 'error');
        }
    }

    displayDocuments(documents) {
        const container = document.getElementById('documents-list');
        if (!container) return;

        if (documents.length === 0) {
            container.innerHTML = '<p class="placeholder">No documents found</p>';
            return;
        }

        container.innerHTML = documents.map(doc => `
            <div class="document-card">
                <div class="document-header">
                    <h3>${UIUtils.getDocumentName(doc.source)}</h3>
                    <span class="document-entities">${doc.entityCount || 0} entities</span>
                </div>
                <div class="document-details">
                    <p><strong>Path:</strong> ${doc.source}</p>
                    <p><strong>Processed:</strong> ${UIUtils.formatDate(doc.processedAt)}</p>
                    <p><strong>Size:</strong> ${doc.size || 'Unknown'}</p>
                </div>
                <div class="document-actions">
                    <button onclick="window.app.showDocumentDetail('${doc.id}')" class="btn btn-sm btn-info">
                        View Details
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Management methods - delegate to Management module
    findMergeCandidates() {
        Management.findMergeCandidates(this);
    }

    performAutoMerge() {
        Management.performAutoMerge(this);
    }

    async performManualMerge(primaryId, secondaryId) {
        return Management.performManualMerge(this, primaryId, secondaryId);
    }

    resetMergedPairs() {
        Management.resetMergedPairs(this);
    }

    mergeSelectedEntities() {
        Management.mergeSelectedEntities(this);
    }

    splitEntity() {
        Management.splitEntity();
    }

    viewSimilarEntities() {
        Management.viewSimilarEntities();
    }

    // Network methods - delegate to NetworkVisualization module
    toggleHierarchicalLayout() {
        this.showToast('Hierarchical layout coming soon', 'info');
    }

    toggleForceLayout() {
        this.showToast('Force layout toggle coming soon', 'info');
    }

    showSIEMPerspective() {
        this.showToast('SIEM perspective coming soon', 'info');
    }

    showEntityPerspective() {
        const entityName = document.getElementById('entity-search')?.value?.trim();
        if (!entityName) {
            this.showToast('Please enter an entity name in the search box first', 'warning');
            return;
        }
        this.showToast(`Entity perspective for "${entityName}" coming soon`, 'info');
    }

    filterNetworkByCategory(category) {
        this.showToast(category ? `Filtering by ${category}` : 'Showing all categories', 'info');
    }

    handleEntitySearch(query) {
        if (query.length > 2) {
            // TODO: Add autocomplete dropdown
        }
    }

    // Placeholder methods for features to be implemented
    async showEntityDetail(entityId) {
        this.showToast('Entity details feature coming soon', 'info');
    }

    async showDocumentDetail(docId) {
        this.showToast('Document details feature coming soon', 'info');
    }

    async exportEntities() {
        this.showToast('Export feature coming soon', 'info');
    }

    async performSearch() {
        this.showToast('Search feature coming soon', 'info');
    }

    async performEntityContextSearch() {
        this.showToast('Entity context search coming soon', 'info');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new UniversalKnowledgeAppMain();
    console.log('Universal Knowledge App initialized successfully');
});
