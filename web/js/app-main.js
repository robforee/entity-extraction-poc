/**
 * Main Application File - Extends base app with all functionality
 */
class UniversalKnowledgeAppMain extends UniversalKnowledgeApp {
    constructor() {
        super();
        // Initialize URL routing
        this.initializeRouting();
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

    renderEntities() {
        Entities.renderEntities(this);
    }

    renderDocuments() {
        Documents.renderDocuments(this);
    }

    renderAnalytics() {
        this.showToast('Analytics view coming soon', 'info');
    }

    renderSearch() {
        Search.renderSearch(this);
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

    async findSimilarEntities(entityId) {
        this.showToast('Find similar entities feature coming soon', 'info');
    }

    async downloadDocument(documentId) {
        this.showToast('Document download feature coming soon', 'info');
    }

    async exportEntities() {
        this.showToast('Entity export feature coming soon', 'info');
    }

    async exportDocuments() {
        this.showToast('Document export feature coming soon', 'info');
    }

    async exportNetwork() {
        this.showToast('Network export feature coming soon', 'info');
    }

    // URL Routing System
    initializeRouting() {
        // Handle initial page load
        this.handleRoute();
        
        // Handle browser back/forward buttons
        window.addEventListener('popstate', () => {
            this.handleRoute();
        });
        
        // Override navigation clicks to update URL
        this.setupNavigationInterception();
    }

    handleRoute() {
        const path = window.location.pathname;
        const params = new URLSearchParams(window.location.search);
        
        console.log(`Routing to: ${path} with params:`, params);
        
        // Route to specific pages
        switch(path) {
            case '/network':
                this.navigateToPage('network');
                this.handleNetworkParams(params);
                break;
            case '/entities':
                this.navigateToPage('entities');
                break;
            case '/documents':
                this.navigateToPage('documents');
                break;
            case '/search':
                this.navigateToPage('search');
                break;
            case '/management':
                this.navigateToPage('management');
                break;
            case '/analysis':
                this.navigateToPage('analysis');
                break;
            default:
                // Default to dashboard
                this.navigateToPage('dashboard');
                break;
        }
    }

    handleNetworkParams(params) {
        // Wait for network to load, then apply filters
        setTimeout(() => {
            const showCategories = params.get('show');
            const hideCategories = params.get('no-show');
            
            if (showCategories) {
                const categories = showCategories.split(',');
                this.showOnlyCategories(categories);
            } else if (hideCategories) {
                const categories = hideCategories.split(',');
                this.hideCategories(categories);
            }
        }, 1000);
    }

    showOnlyCategories(categoriesToShow) {
        console.log('Showing only categories:', categoriesToShow);
        
        // Hide all categories first, then show only specified ones
        const legendItems = document.querySelectorAll('.legend-item');
        legendItems.forEach(item => {
            const category = item.dataset.category;
            const shouldShow = categoriesToShow.includes(category);
            
            if (!shouldShow) {
                NetworkVisualization.toggleCategoryVisibility(this, category, item);
            }
        });
        
        UIUtils.showToast(`Showing only: ${categoriesToShow.join(', ')}`, 'info');
    }

    hideCategories(categoriesToHide) {
        console.log('Hiding categories:', categoriesToHide);
        
        const legendItems = document.querySelectorAll('.legend-item');
        legendItems.forEach(item => {
            const category = item.dataset.category;
            if (categoriesToHide.includes(category)) {
                NetworkVisualization.toggleCategoryVisibility(this, category, item);
            }
        });
        
        UIUtils.showToast(`Hidden: ${categoriesToHide.join(', ')}`, 'info');
    }

    setupNavigationInterception() {
        // Intercept navigation clicks to update URL
        document.addEventListener('click', (e) => {
            const navButton = e.target.closest('[data-view]');
            if (navButton) {
                e.preventDefault();
                const view = navButton.dataset.view;
                this.navigateToUrl(view);
            }
        });
    }

    navigateToUrl(page) {
        const url = page === 'dashboard' ? '/' : `/${page}`;
        window.history.pushState({}, '', url);
        this.navigateToPage(page);
    }

    navigateToPage(page) {
        // Use existing navigation logic
        if (this.switchView) {
            this.switchView(page);
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new UniversalKnowledgeAppMain();
    console.log('Universal Knowledge App initialized successfully');
});
