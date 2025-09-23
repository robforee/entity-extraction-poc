/**
 * Universal Knowledge System - Enhanced Frontend Application
 */

class UniversalKnowledgeApp {
    constructor() {
        this.socket = null;
        this.currentView = 'management'; // Set management as default
        this.entities = [];
        this.relationships = [];
        this.documents = [];
        this.networkData = null;
        this.networkSimulation = null;
        this.networkSvg = null;
        this.historyPage = 0;
        this.data = { stats: {}, categories: {}, entities: [], documents: [], relationships: [] };
        this.charts = {};
        
        // Initialize entity filtering and pagination
        this.filters = {
            category: null,
            minConfidence: null
        };
        this.currentPage = 0;
        this.pageSize = 20;
        
        this.init();
    }

    async init() {
        this.showLoading();
        this.setupEventListeners();
        this.connectWebSocket();
        await this.loadInitialData();
        this.hideLoading();
        
        // Set management as default view and update navigation
        this.switchView('management');
    }

    setupEventListeners() {
        // Navigation - fix class selector
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const view = btn.dataset.view;
                console.log('Navigation clicked:', view); // Debug log
                this.switchView(view);
            });
        });
        
        // Network control sliders
        this.setupNetworkSliders();
        
        // Modal
        document.querySelector('.modal-close').addEventListener('click', () => this.closeModal());
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) this.closeModal();
        });

        // Search
        document.getElementById('search-btn').addEventListener('click', () => this.performSearch());
        document.getElementById('search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.performSearch();
        });

        // Filters
        document.getElementById('category-filter').addEventListener('change', (e) => {
            this.filters.category = e.target.value;
            this.loadEntities();
        });

        document.getElementById('confidence-slider').addEventListener('input', (e) => {
            this.filters.minConfidence = parseFloat(e.target.value);
            document.getElementById('confidence-value').textContent = `${Math.round(this.filters.minConfidence * 100)}%`;
            this.loadEntities();
        });

        // Export
        document.getElementById('export-entities').addEventListener('click', () => this.exportEntities());

        // Network controls
        document.getElementById('zoom-center')?.addEventListener('click', () => this.centerNetwork());
        document.getElementById('zoom-fit')?.addEventListener('click', () => this.fitNetwork());
        document.getElementById('toggle-hierarchy')?.addEventListener('click', () => this.toggleHierarchicalLayout());
        document.getElementById('toggle-force')?.addEventListener('click', () => this.toggleForceLayout());
        document.getElementById('siem-perspective')?.addEventListener('click', () => this.showSIEMPerspective());

        // Domain selector
        document.getElementById('domain-select').addEventListener('change', (e) => {
            this.switchDomain(e.target.value);
        });
    }

    connectWebSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.updateConnectionStatus(true);
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.updateConnectionStatus(false);
        });

        this.socket.on('initialData', (data) => {
            this.data = { ...this.data, ...data };
            this.renderCurrentView();
        });

        this.socket.on('statsUpdate', (stats) => {
            this.data.stats = stats;
            this.updateStats();
        });

        this.socket.on('error', (error) => {
            this.showToast(error.message, 'error');
        });

        this.socket.on('domainChanged', (data) => {
            this.showToast(`Domain switched to: ${data.domain}`, 'info');
            this.loadInitialData(); // Reload data for new domain
        });
    }

    updateConnectionStatus(connected) {
        const indicator = document.getElementById('connection-indicator');
        const text = document.getElementById('connection-text');
        
        if (connected) {
            indicator.className = 'status-indicator online';
            text.textContent = 'Connected';
        } else {
            indicator.className = 'status-indicator offline';
            text.textContent = 'Disconnected';
        }
    }

    async loadInitialData() {
        try {
            const [statsRes, categoriesRes, entitiesRes, documentsRes, domainsRes] = await Promise.all([
                fetch('/api/entities/stats'),
                fetch('/api/entities/categories'),
                fetch('/api/entities?limit=50'),
                fetch('/api/documents'),
                fetch('/api/domains')
            ]);

            this.data.stats = await statsRes.json();
            this.data.categories = await categoriesRes.json();
            this.data.entities = (await entitiesRes.json()).entities || [];
            this.data.documents = (await documentsRes.json()).documents || [];
            this.data.domains = await domainsRes.json();

            this.populateFilterOptions();
            this.populateDomainSelector();
            this.renderCurrentView();
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.showToast('Failed to load data', 'error');
        }
    }

    populateDomainSelector() {
        const domainSelect = document.getElementById('domain-select');
        
        if (this.data.domains && this.data.domains.domains) {
            // Clear existing options
            domainSelect.innerHTML = '';
            
            // Add available domains
            this.data.domains.domains.forEach(domain => {
                const option = document.createElement('option');
                option.value = domain.name;
                
                // Add emoji and entity count
                let emoji = '📁';
                if (domain.name === 'cybersec') emoji = '🔒';
                else if (domain.name === 'construction') emoji = '🏗️';
                else if (domain.name === 'misc') emoji = '📁';
                
                option.textContent = `${emoji} ${domain.name.charAt(0).toUpperCase() + domain.name.slice(1)} (${domain.entityCount})`;
                
                if (domain.name === this.data.domains.current) {
                    option.selected = true;
                }
                
                domainSelect.appendChild(option);
            });
        }
    }

    async switchDomain(domainName) {
        try {
            this.showToast(`Switching to ${domainName} domain...`, 'info');
            
            const response = await fetch('/api/domains/switch', {
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
                this.showToast(`Failed to switch domain: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Failed to switch domain:', error);
            this.showToast('Failed to switch domain', 'error');
        }
    }

    populateFilterOptions() {
        const categoryFilter = document.getElementById('category-filter');
        const searchCategory = document.getElementById('search-category');
        
        categoryFilter.innerHTML = '<option value="">All Categories</option>';
        searchCategory.innerHTML = '<option value="">All Categories</option>';
        
        Object.keys(this.data.categories).forEach(category => {
            const option1 = new Option(this.capitalizeWords(category), category);
            const option2 = new Option(this.capitalizeWords(category), category);
            categoryFilter.add(option1);
            searchCategory.add(option2);
        });
    }

    switchView(viewName) {
        console.log('Switching to view:', viewName); // Debug log
        
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        const navBtn = document.querySelector(`[data-view="${viewName}"]`);
        if (navBtn) {
            navBtn.classList.add('active');
        } else {
            console.error('Navigation button not found for view:', viewName);
        }

        // Update views
        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
        const viewElement = document.getElementById(`${viewName}-view`);
        if (viewElement) {
            viewElement.classList.add('active');
        } else {
            console.error('View element not found for view:', viewName);
        }

        this.currentView = viewName;
        this.renderCurrentView();
    }

    renderCurrentView() {
        switch (this.currentView) {
            case 'dashboard': this.renderDashboard(); break;
            case 'entities': this.renderEntities(); break;
            case 'documents': this.renderDocuments(); break;
            case 'analytics': this.renderAnalytics(); break;
            case 'management': this.renderManagement(); break;
            case 'network': this.renderNetwork(); break;
            case 'search': this.renderSearch(); break;
        }
    }

    renderDashboard() {
        this.updateStats();
        this.renderCategoriesChart();
        this.renderRecentEntities();
        this.renderConfidenceChart();
    }

    updateStats() {
        const stats = this.data.stats;
        document.getElementById('total-entities').textContent = stats.totalEntities || 0;
        document.getElementById('total-documents').textContent = stats.totalDocuments || 0;
        document.getElementById('total-categories').textContent = stats.totalCategories || 0;
        
        const avgConfidence = this.calculateAverageConfidence();
        document.getElementById('avg-confidence').textContent = `${(avgConfidence * 100).toFixed(1)}%`;
    }

    calculateAverageConfidence() {
        if (!this.data.entities.length) return 0;
        const sum = this.data.entities.reduce((acc, entity) => acc + (entity.confidence || 0), 0);
        return sum / this.data.entities.length;
    }

    renderCategoriesChart() {
        const ctx = document.getElementById('categories-chart').getContext('2d');
        
        if (this.charts.categories) this.charts.categories.destroy();

        const categories = this.data.categories;
        const labels = Object.keys(categories).map(cat => this.capitalizeWords(cat));
        const data = Object.values(categories);
        const colors = this.generateColors(labels.length);

        this.charts.categories = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { padding: 20, usePointStyle: true } }
                }
            }
        });
    }

    renderRecentEntities() {
        const container = document.getElementById('recent-entities');
        const recentEntities = this.data.entities.slice(0, 10);

        container.innerHTML = recentEntities.map(entity => `
            <div class="entity-item" onclick="app.showEntityDetail('${entity.id}')">
                <div class="entity-name">${entity.name || 'Unnamed Entity'}</div>
                <div class="entity-meta">
                    ${this.capitalizeWords(entity.category)} 
                    <span class="confidence-badge ${this.getConfidenceClass(entity.confidence)}">
                        ${Math.round((entity.confidence || 0) * 100)}%
                    </span>
                </div>
            </div>
        `).join('');
    }

    renderConfidenceChart() {
        const ctx = document.getElementById('confidence-chart').getContext('2d');
        
        if (this.charts.confidence) this.charts.confidence.destroy();

        const confidenceRanges = {
            'High (80-100%)': this.data.entities.filter(e => (e.confidence || 0) >= 0.8).length,
            'Medium (50-79%)': this.data.entities.filter(e => (e.confidence || 0) >= 0.5 && (e.confidence || 0) < 0.8).length,
            'Low (0-49%)': this.data.entities.filter(e => (e.confidence || 0) < 0.5).length
        };

        this.charts.confidence = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(confidenceRanges),
                datasets: [{
                    label: 'Entity Count',
                    data: Object.values(confidenceRanges),
                    backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
            }
        });
    }

    // Utility Methods
    showLoading() {
        document.getElementById('loading-overlay').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading-overlay').classList.add('hidden');
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) {
            console.warn('Toast container not found');
            return;
        }
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // Remove toast after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (container.contains(toast)) {
                    container.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    capitalizeWords(str) {
        return str.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    getConfidenceClass(confidence) {
        const conf = confidence || 0;
        if (conf >= 0.8) return 'confidence-high';
        if (conf >= 0.5) return 'confidence-medium';
        return 'confidence-low';
    }

    generateColors(count) {
        const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe'];
        return Array.from({length: count}, (_, i) => colors[i % colors.length]);
    }

    getDocumentName(source) {
        return source ? source.split('/').pop().replace(/\.(md|txt|json)$/, '') : 'Unknown Document';
    }

    closeModal() {
        document.getElementById('entity-modal').style.display = 'none';
    }

    async showEntityDetail(entityId) {
        // Placeholder for entity detail modal
        this.showToast('Entity details feature coming soon', 'info');
    }

    async exportEntities() {
        this.showToast('Export feature coming soon', 'info');
    }

    async performSearch() {
        this.showToast('Search feature coming soon', 'info');
    }

    async renderEntities() {
        await this.loadEntities();
    }

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

            const response = await fetch(`/api/entities?${params}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();

            // Validate response data
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid response format');
            }

            // Ensure entities is an array
            const entities = Array.isArray(data.entities) ? data.entities : [];
            
            // Filter out any invalid entities
            const validEntities = entities.filter(entity => 
                entity && 
                typeof entity === 'object' && 
                entity.name && 
                entity.category
            );

            this.renderEntitiesGrid(validEntities);
            
            // Handle pagination data safely
            if (data.pagination && typeof data.pagination === 'object') {
                this.renderPagination(data.pagination);
            }
            
        } catch (error) {
            console.error('Failed to load entities:', error);
            this.showToast('Failed to load entities', 'error');
            
            // Render empty state
            this.renderEntitiesGrid([]);
        }
    }

    renderEntitiesGrid(entities) {
        const container = document.getElementById('entities-grid');
        
        if (!entities || entities.length === 0) {
            container.innerHTML = '<div class="text-center"><p>No entities found with current filters.</p></div>';
            return;
        }
        
        container.innerHTML = entities.map(entity => {
            // Safely extract entity properties with defaults
            const name = entity.name || 'Unnamed Entity';
            const category = entity.category || 'Unknown Category';
            const description = entity.description || entity.role || 'No description available';
            const confidence = Math.round((entity.confidence || 0) * 100);
            const source = entity.source || entity.metadata?.source || 'Unknown source';
            const entityId = entity.id || entity._id || 'unknown';
            
            return `
                <div class="entity-card" onclick="app.showEntityDetail('${entityId}')">
                    <div class="entity-card-header">
                        <div class="entity-card-title">${name}</div>
                        <div class="entity-card-category">${category}</div>
                    </div>
                    <div class="entity-card-description">
                        ${description}
                    </div>
                    <div class="entity-card-footer">
                        <span>Confidence: ${confidence}%</span>
                        <span>${source}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderPagination(pagination) {
        const container = document.getElementById('entity-pagination');
        if (!container) return;
        
        // Safely extract pagination properties with defaults
        const page = pagination?.page || 0;
        const pages = pagination?.pages || 1;
        const total = pagination?.total || 0;

        let paginationHTML = `<span>Showing ${total} entities</span>`;
        
        if (pages > 1) {
            paginationHTML += `
                <button ${page === 1 ? 'disabled' : ''} onclick="app.goToPage(${page - 1})">Previous</button>
                <button class="active">${page}</button>
                <button ${page === pages ? 'disabled' : ''} onclick="app.goToPage(${page + 1})">Next</button>
            `;
        }

        container.innerHTML = paginationHTML;
    }

    goToPage(page) {
        this.currentPage = page;
        this.loadEntities();
    }

    async renderDocuments() {
        const container = document.getElementById('documents-list');
        
        if (!this.data.documents || this.data.documents.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>📄 No Documents Found</h3>
                    <p>No documents have been processed yet.</p>
                </div>
            `;
            return;
        }

        // Sort documents by timestamp (newest first)
        const sortedDocs = [...this.data.documents].sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );

        container.innerHTML = `
            <div class="documents-header">
                <div class="documents-stats">
                    <span class="stat-badge">📚 ${sortedDocs.length} Documents</span>
                    <span class="stat-badge">🎯 ${this.data.entities.length} Total Entities</span>
                </div>
                <div class="documents-filters">
                    <select id="doc-type-filter" class="filter-select">
                        <option value="">All Types</option>
                        <option value=".md">Markdown</option>
                        <option value=".txt">Text</option>
                        <option value=".json">JSON</option>
                    </select>
                    <input type="text" id="doc-search" placeholder="Search documents..." class="search-input">
                </div>
            </div>
            <div class="documents-grid">
                ${sortedDocs.map(doc => this.renderDocumentCard(doc)).join('')}
            </div>
        `;

        // Add event listeners for filters
        document.getElementById('doc-type-filter').addEventListener('change', (e) => {
            this.filterDocuments(e.target.value, document.getElementById('doc-search').value);
        });
        
        document.getElementById('doc-search').addEventListener('input', (e) => {
            this.filterDocuments(document.getElementById('doc-type-filter').value, e.target.value);
        });

        // Add click listeners for document cards
        container.querySelectorAll('.document-card').forEach(card => {
            card.addEventListener('click', () => {
                const docId = card.dataset.docId;
                this.showDocumentDetails(docId);
            });
        });
    }

    renderDocumentCard(doc) {
        const fileName = doc.source ? doc.source.split('/').pop() : 'Unknown';
        const fileType = doc.documentType || 'unknown';
        const entityCount = doc.entityCount || 0;
        const categories = doc.categories || [];
        const timestamp = new Date(doc.timestamp).toLocaleDateString();
        
        // Get type icon
        const typeIcon = this.getFileTypeIcon(fileType);
        
        // Calculate confidence color
        const avgConfidence = this.calculateDocumentConfidence(doc.id);
        const confidenceClass = avgConfidence >= 0.8 ? 'high' : avgConfidence >= 0.5 ? 'medium' : 'low';

        return `
            <div class="document-card" data-doc-id="${doc.id}">
                <div class="document-header">
                    <div class="document-icon">${typeIcon}</div>
                    <div class="document-title" title="${doc.source || 'Unknown'}">${fileName}</div>
                    <div class="document-confidence confidence-${confidenceClass}">
                        ${Math.round(avgConfidence * 100)}%
                    </div>
                </div>
                <div class="document-meta">
                    <div class="meta-item">
                        <span class="meta-label">Entities:</span>
                        <span class="meta-value">${entityCount}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Categories:</span>
                        <span class="meta-value">${categories.length}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Processed:</span>
                        <span class="meta-value">${timestamp}</span>
                    </div>
                </div>
                <div class="document-categories">
                    ${categories.slice(0, 3).map(cat => 
                        `<span class="category-tag">${cat}</span>`
                    ).join('')}
                    ${categories.length > 3 ? `<span class="category-more">+${categories.length - 3}</span>` : ''}
                </div>
                <div class="document-actions">
                    <button class="btn-small btn-primary" onclick="event.stopPropagation(); app.showDocumentDetails('${doc.id}')">
                        View Details
                    </button>
                    <button class="btn-small btn-secondary" onclick="event.stopPropagation(); app.showDocumentEntities('${doc.id}')">
                        View Entities
                    </button>
                </div>
            </div>
        `;
    }

    getFileTypeIcon(fileType) {
        const icons = {
            '.md': '📝',
            '.txt': '📄',
            '.json': '🔧',
            '.pdf': '📕',
            '.doc': '📘',
            '.docx': '📘',
            'unknown': '📄'
        };
        return icons[fileType] || icons.unknown;
    }

    calculateDocumentConfidence(docId) {
        const docEntities = this.data.entities.filter(e => e.conversationId === docId);
        if (docEntities.length === 0) return 0;
        
        const totalConfidence = docEntities.reduce((sum, e) => sum + (e.confidence || 0), 0);
        return totalConfidence / docEntities.length;
    }

    filterDocuments(typeFilter, searchQuery) {
        const cards = document.querySelectorAll('.document-card');
        
        cards.forEach(card => {
            const docId = card.dataset.docId;
            const doc = this.data.documents.find(d => d.id === docId);
            
            let show = true;
            
            // Type filter
            if (typeFilter && doc.documentType !== typeFilter) {
                show = false;
            }
            
            // Search filter
            if (searchQuery) {
                const fileName = doc.source ? doc.source.split('/').pop().toLowerCase() : '';
                if (!fileName.includes(searchQuery.toLowerCase())) {
                    show = false;
                }
            }
            
            card.style.display = show ? 'block' : 'none';
        });
    }

    async showDocumentDetails(docId) {
        try {
            this.showLoading();
            
            const response = await fetch(`/api/documents/${docId}`);
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to load document details');
            }
            
            const doc = data.document;
            const fileName = doc.source ? doc.source.split('/').pop() : 'Unknown Document';
            
            const modalContent = `
                <div class="document-details">
                    <div class="document-details-header">
                        <h2>📄 ${fileName}</h2>
                        <div class="document-badges">
                            <span class="badge badge-primary">${doc.entityCount} Entities</span>
                            <span class="badge badge-secondary">${Object.keys(doc.categoryStats || {}).length} Categories</span>
                            <span class="badge badge-info">${Math.round(doc.confidence * 100)}% Confidence</span>
                        </div>
                    </div>
                    
                    <div class="document-metadata">
                        <div class="metadata-grid">
                            <div class="metadata-item">
                                <label>Source Path:</label>
                                <span title="${doc.source}">${doc.source}</span>
                            </div>
                            <div class="metadata-item">
                                <label>Content Length:</label>
                                <span>${(doc.contentLength || 0).toLocaleString()} characters</span>
                            </div>
                            <div class="metadata-item">
                                <label>Processing Time:</label>
                                <span>${(doc.processingTime || 0) / 1000}s</span>
                            </div>
                            <div class="metadata-item">
                                <label>Cost:</label>
                                <span>$${(doc.cost || 0).toFixed(4)}</span>
                            </div>
                            <div class="metadata-item">
                                <label>Model:</label>
                                <span>${doc.provider}/${doc.model}</span>
                            </div>
                            <div class="metadata-item">
                                <label>Processed:</label>
                                <span>${new Date(doc.createdAt).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="document-categories-breakdown">
                        <h3>📊 Entity Categories</h3>
                        <div class="categories-grid">
                            ${Object.entries(doc.categoryStats || {}).map(([category, stats]) => `
                                <div class="category-stat-card">
                                    <div class="category-name">${category.toUpperCase()}</div>
                                    <div class="category-count">${stats.count}</div>
                                    <div class="category-confidence">${Math.round(stats.avgConfidence * 100)}% avg</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="document-top-entities">
                        <h3>🎯 Top Entities</h3>
                        <div class="entities-list">
                            ${(doc.topEntities || []).map(entity => `
                                <div class="entity-item">
                                    <div class="entity-name">${entity.name}</div>
                                    <div class="entity-category">${entity.category}</div>
                                    <div class="entity-confidence">${Math.round(entity.confidence * 100)}%</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="document-actions-footer">
                        <button class="btn btn-primary" onclick="app.showDocumentEntities('${docId}')">
                            View All Entities
                        </button>
                        <button class="btn btn-secondary" onclick="app.closeModal()">
                            Close
                        </button>
                    </div>
                </div>
            `;
            
            this.showModal('Document Details', modalContent);
            
        } catch (error) {
            this.showToast(`Error loading document: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async showDocumentEntities(docId) {
        try {
            this.showLoading();
            
            const response = await fetch(`/api/documents/${docId}/entities`);
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to load document entities');
            }
            
            const entities = data.entities || [];
            const doc = this.data.documents.find(d => d.id === docId);
            const fileName = doc?.source ? doc.source.split('/').pop() : 'Unknown Document';
            
            const modalContent = `
                <div class="document-entities">
                    <div class="entities-header">
                        <h2>🎯 Entities in ${fileName}</h2>
                        <div class="entities-filters">
                            <select id="entity-category-filter" class="filter-select">
                                <option value="">All Categories</option>
                                ${[...new Set(entities.map(e => e.category))].map(cat => 
                                    `<option value="${cat}">${cat.toUpperCase()}</option>`
                                ).join('')}
                            </select>
                            <input type="range" id="entity-confidence-filter" min="0" max="100" value="0" class="confidence-slider">
                            <span id="confidence-display">0%+</span>
                        </div>
                    </div>
                    
                    <div class="entities-grid" id="filtered-entities">
                        ${entities.map(entity => `
                            <div class="entity-card" data-category="${entity.category}" data-confidence="${entity.confidence}">
                                <div class="entity-header">
                                    <div class="entity-name">${entity.name}</div>
                                    <div class="entity-confidence confidence-${entity.confidence >= 0.8 ? 'high' : entity.confidence >= 0.5 ? 'medium' : 'low'}">
                                        ${Math.round(entity.confidence * 100)}%
                                    </div>
                                </div>
                                <div class="entity-category">${entity.category}</div>
                                <div class="entity-description">${entity.description || 'No description'}</div>
                                ${Object.keys(entity.data || {}).length > 0 ? `
                                    <div class="entity-data">
                                        ${Object.entries(entity.data).slice(0, 3).map(([key, value]) => 
                                            `<span class="data-item"><strong>${key}:</strong> ${value}</span>`
                                        ).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            
            this.showModal('Document Entities', modalContent);
            
            // Add filter event listeners
            document.getElementById('entity-category-filter').addEventListener('change', () => {
                this.filterDocumentEntities();
            });
            
            document.getElementById('entity-confidence-filter').addEventListener('input', (e) => {
                document.getElementById('confidence-display').textContent = `${e.target.value}%+`;
                this.filterDocumentEntities();
            });
            
        } catch (error) {
            this.showToast(`Error loading entities: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    filterDocumentEntities() {
        const categoryFilter = document.getElementById('entity-category-filter').value;
        const confidenceFilter = parseFloat(document.getElementById('entity-confidence-filter').value) / 100;
        const entityCards = document.querySelectorAll('.entity-card');
        
        entityCards.forEach(card => {
            const category = card.dataset.category;
            const confidence = parseFloat(card.dataset.confidence);
            
            let show = true;
            
            if (categoryFilter && category !== categoryFilter) {
                show = false;
            }
            
            if (confidence < confidenceFilter) {
                show = false;
            }
            
            card.style.display = show ? 'block' : 'none';
        });
    }

    async renderAnalytics() {
        this.showToast('Advanced analytics coming soon', 'info');
    }

    async renderNetwork() {
        try {
            this.showToast('Loading network data...', 'info');
            
            // Load both relationships and categories data
            const [relationshipsResponse, categoriesResponse] = await Promise.all([
                fetch('/api/relationships'),
                fetch('/api/entities/categories')
            ]);
            
            const data = await relationshipsResponse.json();
            const categoriesData = await categoriesResponse.json();
            
            // Store categories data for color mapping
            this.data.categories = categoriesData;
            
            console.log('Network data received:', data);
            console.log('Categories data received:', categoriesData);
            
            if (!data.success || !data.nodes || (!data.links && !data.relationships)) {
                console.log('No relationships data or invalid format:', data);
                this.showToast('No network data available', 'warning');
                return;
            }
            
            // Use relationships or links, whichever is available
            const rawLinks = data.relationships || data.links || [];
            
            // Filter out invalid relationships
            const validLinks = rawLinks.filter(link => {
                if (!link.source || !link.target) {
                    console.warn('Invalid relationship structure:', link);
                    return false;
                }
                return true;
            });
            
            this.data.relationships = validLinks;
            this.data.networkNodes = data.nodes;
            
            console.log('Sample node:', data.nodes[0]);
            console.log('Sample relationship:', validLinks[0]);
            
            console.log(`Filtered ${rawLinks.length - validLinks.length} invalid relationships`);
            
            if (this.data.relationships.length === 0) {
                this.showToast('No relationships found in data', 'info');
                document.getElementById('network-svg').innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="#666">No relationships to display</text>';
                return;
            }
            
            this.createNetworkVisualization();
            this.showToast(`Network loaded with ${this.data.relationships.length} relationships`, 'success');
        } catch (error) {
            console.error('Failed to load network data:', error);
            this.showToast('Failed to load network: ' + error.message, 'error');
        }
    }

    createNetworkVisualization() {
        const svg = d3.select('#network-svg');
        svg.selectAll('*').remove();

        const width = svg.node().clientWidth;
        const height = svg.node().clientHeight;

        // Add zoom and pan functionality
        const g = svg.append('g');
        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });
        
        svg.call(zoom);
        
        // Store zoom for external controls
        this.networkZoom = zoom;
        this.networkSvg = svg;
        this.networkContainer = g;

        // Create node lookup map
        const nodeMap = new Map();
        this.data.networkNodes.forEach(node => {
            nodeMap.set(node.id, node);
        });

        // Create nodes and links from relationships
        const nodes = new Map();
        const links = [];

        this.data.relationships.forEach(rel => {
            // Validate relationship structure
            if (!rel.source || !rel.target) {
                console.warn('Invalid relationship structure:', rel);
                return;
            }
            
            // Get node data from the node map
            const sourceNode = nodeMap.get(rel.source);
            const targetNode = nodeMap.get(rel.target);
            
            if (!sourceNode || !targetNode) {
                console.warn('Missing node data for relationship:', rel);
                return;
            }
            
            const sourceName = sourceNode.name || sourceNode.id || 'Unknown Source';
            const targetName = targetNode.name || targetNode.id || 'Unknown Target';
            
            if (!nodes.has(sourceNode.id)) {
                nodes.set(sourceNode.id, {
                    id: sourceNode.id,
                    name: sourceName,
                    category: sourceNode.category || 'unknown',
                    confidence: sourceNode.confidence || 0.5,
                    group: this.getCategoryIndex(sourceNode.category || 'unknown')
                });
            }
            if (!nodes.has(targetNode.id)) {
                nodes.set(targetNode.id, {
                    id: targetNode.id,
                    name: targetName,
                    category: targetNode.category || 'unknown',
                    confidence: targetNode.confidence || 0.5,
                    group: this.getCategoryIndex(targetNode.category || 'unknown')
                });
            }
            
            links.push({
                source: sourceNode.id,
                target: targetNode.id,
                type: rel.type || 'co-occurrence'
            });
        });

        const nodeArray = Array.from(nodes.values());
        
        // Detect clusters and create legend
        this.detectClusters(nodeArray, links);
        this.createColorLegend();
        
        // Log color mapping for debugging
        const categories = [...new Set(nodeArray.map(n => n.category))];
        console.log('Category color mapping:');
        categories.forEach(cat => {
            console.log(`${cat}: ${this.getCategoryColor(cat)}`);
        });

        // Create force simulation optimized for clustering with better spacing
        const simulation = d3.forceSimulation(nodeArray)
            .force('link', d3.forceLink(links).id(d => d.id).distance(200)) // Increased for better spacing
            .force('charge', d3.forceManyBody().strength(-500)) // Stronger repulsion for wider spread
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(d => 12 + (d.confidence || 0.5) * 15));

        // Create links
        const link = g.append('g')
            .selectAll('line')
            .data(links)
            .enter().append('line')
            .attr('stroke', '#999')
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', 2);

        // Create nodes
        const node = g.append('g')
            .selectAll('circle')
            .data(nodeArray)
            .enter().append('circle')
            .attr('r', d => 5 + (d.confidence || 0.5) * 10)
            .attr('fill', d => this.getCategoryColor(d.category))
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));

        // Add labels
        const label = g.append('g')
            .attr('class', 'node-labels')
            .selectAll('text')
            .data(nodeArray)
            .enter().append('text')
            .text(d => {
                const text = d.name || d.id || 'Unknown';
                return text.length > 15 ? text.substring(0, 15) + '...' : text;
            })
            .attr('font-size', '10px')
            .attr('dx', 12)
            .attr('dy', 4)
            .style('pointer-events', 'none');

        // Add tooltips
        node.append('title')
            .text(d => `${d.name || d.id || 'Unknown'}\nCategory: ${d.category || 'Unknown'}\nConfidence: ${Math.round((d.confidence || 0) * 100)}%`);

        // Add click handler for nodes
        node.on('click', (event, d) => {
            this.showToast(`Clicked: ${d.name || d.id} (${d.category})`, 'info');
            // Could expand to show entity details
        });

        simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);

            label
                .attr('x', d => d.x)
                .attr('y', d => d.y);
        });

        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }

        // Store simulation for external controls
        this.networkSimulation = simulation;
        
        // Add cluster labels after simulation settles
        setTimeout(() => {
            this.addClusterLabels(g, nodeArray);
        }, 2000);
    }

    addClusterLabels(g, nodeArray) {
        if (!this.clusters || this.clusters.length === 0) return;
        
        // Update cluster centers based on current node positions
        this.clusters.forEach(cluster => {
            cluster.center = this.calculateClusterCenter(cluster.nodes);
        });
        
        // Add cluster background circles
        const clusterBgs = g.append('g')
            .attr('class', 'cluster-backgrounds')
            .selectAll('circle')
            .data(this.clusters)
            .enter().append('circle')
            .attr('cx', d => d.center.x)
            .attr('cy', d => d.center.y)
            .attr('r', d => Math.max(60, Math.sqrt(d.nodes.length) * 25))
            .attr('fill', d => this.getCategoryColor(d.dominantCategory))
            .attr('fill-opacity', 0.1)
            .attr('stroke', d => this.getCategoryColor(d.dominantCategory))
            .attr('stroke-width', 2)
            .attr('stroke-opacity', 0.3)
            .attr('stroke-dasharray', '5,5');
        
        // Add cluster labels - bigger and positioned outside
        const clusterLabels = g.append('g')
            .attr('class', 'cluster-labels')
            .selectAll('text')
            .data(this.clusters)
            .enter().append('text')
            .attr('x', d => d.center.x)
            .attr('y', d => d.center.y - Math.max(100, Math.sqrt(d.nodes.length) * 35)) // Further outside
            .attr('text-anchor', 'middle')
            .attr('font-size', '18px') // Bigger font
            .attr('font-weight', 'bold')
            .attr('fill', d => this.getCategoryColor(d.dominantCategory))
            .attr('stroke', 'white')
            .attr('stroke-width', 4) // Thicker outline
            .attr('paint-order', 'stroke')
            .text(d => d.title)
            .style('cursor', 'pointer')
            .style('user-select', 'none') // Prevent text selection
            .on('click', (event, d) => {
                this.selectCluster(d);
            });
        
        this.showToast(`Added labels for ${this.clusters.length} clusters`, 'success');
    }
    
    selectCluster(cluster) {
        this.showToast(`Selected: ${cluster.title}`, 'info');
        
        // Highlight cluster nodes
        if (this.networkContainer) {
            // Reset all node styles
            this.networkContainer.selectAll('circle')
                .attr('stroke', 'none')
                .attr('stroke-width', 0);
            
            // Highlight selected cluster nodes
            const selectedIds = new Set(cluster.nodes.map(n => n.id));
            this.networkContainer.selectAll('circle')
                .filter(d => selectedIds.has(d.id))
                .attr('stroke', '#ff6b6b')
                .attr('stroke-width', 3);
        }
        
        // Show cluster details
        this.showClusterDetails(cluster);
    }
    
    showClusterDetails(cluster) {
        const details = `
            <div class="cluster-details">
                <h3>${cluster.title}</h3>
                <p><strong>Dominant Category:</strong> ${this.capitalizeWords(cluster.dominantCategory)}</p>
                <p><strong>Entities:</strong> ${cluster.nodes.length}</p>
                <div class="cluster-entities">
                    <h4>Top Entities:</h4>
                    <ul>
                        ${cluster.nodes
                            .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
                            .slice(0, 10)
                            .map(node => `
                                <li>
                                    <strong>${node.name}</strong> 
                                    (${this.capitalizeWords(node.category)}, 
                                    ${Math.round((node.confidence || 0) * 100)}%)
                                </li>
                            `).join('')}
                    </ul>
                </div>
            </div>
        `;
        
        this.showModal('Cluster Details', details);
    }

    getCategoryIndex(category) {
        // Use a predefined list of common categories if data.categories is not available
        const categories = Object.keys(this.data.categories || {});
        if (categories.length === 0) {
            // Fallback to common cybersecurity categories
            const fallbackCategories = [
                'people', 'security_tools', 'threats', 'vulnerabilities', 
                'security_controls', 'compliance', 'projects', 'locations',
                'technologies', 'processes', 'incidents', 'policies'
            ];
            return fallbackCategories.indexOf(category) >= 0 ? 
                fallbackCategories.indexOf(category) : 
                Math.abs(this.hashString(category)) % fallbackCategories.length;
        }
        return categories.indexOf(category) >= 0 ? categories.indexOf(category) : 0;
    }

    hashString(str) {
        let hash = 0;
        if (!str) return hash;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    }

    getCategoryColor(category) {
        const colors = [
            '#667eea', '#764ba2', '#f093fb', '#f5576c', 
            '#4facfe', '#00f2fe', '#43e97b', '#38f9d7',
            '#ffecd2', '#fcb69f', '#a8edea', '#fed6e3'
        ];
        
        if (!category) {
            return colors[0]; // Default color for undefined categories
        }
        
        const index = this.getCategoryIndex(category);
        return colors[index % colors.length];
    }

    centerNetwork() {
        if (this.networkSimulation) {
            this.networkSimulation.alpha(0.3).restart();
            this.showToast('Network centered', 'success');
        }
    }

    fitNetwork() {
        if (this.networkSimulation) {
            const svg = d3.select('#network-svg');
            const g = svg.select('g');
            
            // Get bounds of all elements
            const bounds = g.node().getBBox();
            const fullWidth = svg.node().clientWidth;
            const fullHeight = svg.node().clientHeight;
            const width = bounds.width;
            const height = bounds.height;
            const midX = bounds.x + width / 2;
            const midY = bounds.y + height / 2;
            
            if (width == 0 || height == 0) return; // nothing to fit
            
            const scale = 0.85 / Math.max(width / fullWidth, height / fullHeight);
            const translate = [fullWidth / 2 - scale * midX, fullHeight / 2 - scale * midY];
            
            svg.transition()
                .duration(750)
                .call(d3.zoom().transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
                
            this.showToast('Network fitted to view', 'success');
        }
    }

    toggleHierarchicalLayout() {
        this.layoutMode = 'hierarchical';
        this.showToast('Switching to hierarchical layout...', 'info');
        this.createHierarchicalVisualization();
    }

    toggleForceLayout() {
        this.layoutMode = 'force';
        this.showToast('Switching to force layout...', 'info');
        this.createNetworkVisualization();
    }

    createHierarchicalVisualization() {
        if (!this.data.networkNodes || !this.data.relationships) {
            this.showToast('No network data available for hierarchical view', 'warning');
            return;
        }

        const svg = d3.select('#network-svg');
        svg.selectAll('*').remove();

        const width = svg.node().clientWidth;
        const height = svg.node().clientHeight;

        // Create hierarchical tree layout
        const root = this.createHierarchyFromNodes(this.data.networkNodes, this.data.relationships);
        
        const treeLayout = d3.tree()
            .size([width - 100, height - 100]);

        const hierarchyRoot = d3.hierarchy(root);
        treeLayout(hierarchyRoot);

        const g = svg.append('g')
            .attr('transform', 'translate(50, 50)');

        // Create links (edges)
        const link = g.selectAll('.link')
            .data(hierarchyRoot.links())
            .enter().append('path')
            .attr('class', 'link')
            .attr('d', d3.linkHorizontal()
                .x(d => d.y)
                .y(d => d.x))
            .attr('stroke', '#999')
            .attr('stroke-width', 2)
            .attr('fill', 'none');

        // Create nodes
        const node = g.selectAll('.node')
            .data(hierarchyRoot.descendants())
            .enter().append('g')
            .attr('class', 'node')
            .attr('transform', d => `translate(${d.y},${d.x})`);

        node.append('circle')
            .attr('r', d => 5 + (d.data.confidence || 0.5) * 10)
            .attr('fill', d => this.getCategoryColor(d.data.category))
            .attr('stroke', '#333')
            .attr('stroke-width', 1);

        node.append('text')
            .attr('dx', d => d.children ? -8 : 8)
            .attr('dy', 3)
            .attr('text-anchor', d => d.children ? 'end' : 'start')
            .text(d => d.data.name)
            .attr('font-size', '10px')
            .attr('fill', '#333');

        // Add zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        svg.call(zoom);

        this.showToast('Hierarchical layout created', 'success');
    }

    createHierarchyFromNodes(nodes, relationships) {
        // Simple hierarchy: group by category, then by confidence
        const categories = {};
        
        nodes.forEach(node => {
            const category = node.category || 'uncategorized';
            if (!categories[category]) {
                categories[category] = {
                    name: category,
                    category: category,
                    children: []
                };
            }
            categories[category].children.push({
                name: node.name,
                category: node.category,
                confidence: node.confidence,
                id: node.id
            });
        });

        // Sort children by confidence
        Object.values(categories).forEach(category => {
            category.children.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
        });

        return {
            name: 'Root',
            children: Object.values(categories)
        };
    }

    async showSIEMPerspective() {
        try {
            this.showToast('Loading SIEM perspective...', 'info');
            
            const response = await fetch('/api/siem/perspective');
            const data = await response.json();
            
            if (!data.success) {
                this.showToast('Failed to load SIEM perspective', 'error');
                return;
            }
            
            console.log('SIEM perspective data:', data);
            this.createSIEMVisualization(data);
            
        } catch (error) {
            console.error('Error loading SIEM perspective:', error);
            this.showToast('Error loading SIEM perspective', 'error');
        }
    }

    createSIEMVisualization(data) {
        const svg = d3.select('#network-svg');
        svg.selectAll('*').remove();

        const width = svg.node().clientWidth;
        const height = svg.node().clientHeight;

        // Create a radial layout with SIEM at center
        const g = svg.append('g');

        // SIEM entities at center
        const centerX = width / 2;
        const centerY = height / 2;
        const siemRadius = 80;

        // Position SIEM entities in a small circle at center
        const siemPositions = data.siemEntities.map((entity, i) => {
            const angle = (i / data.siemEntities.length) * 2 * Math.PI;
            return {
                ...entity,
                x: centerX + Math.cos(angle) * (siemRadius / 2),
                y: centerY + Math.sin(angle) * (siemRadius / 2),
                type: 'siem'
            };
        });

        // Group related entities by category and position them in rings
        const categoryGroups = {};
        data.relatedEntities.forEach(entity => {
            const category = entity.category || 'uncategorized';
            if (!categoryGroups[category]) {
                categoryGroups[category] = [];
            }
            categoryGroups[category].push(entity);
        });

        const allNodes = [...siemPositions];
        const categoryNames = Object.keys(categoryGroups);
        const ringRadius = 200;

        categoryNames.forEach((category, categoryIndex) => {
            const entities = categoryGroups[category];
            const categoryAngle = (categoryIndex / categoryNames.length) * 2 * Math.PI;
            const categoryX = centerX + Math.cos(categoryAngle) * ringRadius;
            const categoryY = centerY + Math.sin(categoryAngle) * ringRadius;

            // Position entities in this category around their category center
            entities.forEach((entity, entityIndex) => {
                const entityAngle = (entityIndex / entities.length) * 2 * Math.PI;
                const entityRadius = 60;
                allNodes.push({
                    ...entity,
                    x: categoryX + Math.cos(entityAngle) * entityRadius,
                    y: categoryY + Math.sin(entityAngle) * entityRadius,
                    type: 'related',
                    categoryGroup: category
                });
            });

            // Add category label
            g.append('text')
                .attr('x', categoryX)
                .attr('y', categoryY - 80)
                .attr('text-anchor', 'middle')
                .attr('font-size', '14px')
                .attr('font-weight', 'bold')
                .attr('fill', this.getCategoryColor(category))
                .text(category.toUpperCase());
        });

        // Create links from SIEM entities to related entities
        const links = [];
        data.relationships.forEach(rel => {
            const sourceNode = allNodes.find(n => n.id === rel.source);
            const targetNode = allNodes.find(n => n.id === rel.target);
            if (sourceNode && targetNode) {
                links.push({
                    source: sourceNode,
                    target: targetNode,
                    type: rel.type
                });
            }
        });

        // Draw links
        const link = g.selectAll('.link')
            .data(links)
            .enter().append('line')
            .attr('class', 'link')
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y)
            .attr('stroke', '#999')
            .attr('stroke-width', 1)
            .attr('stroke-opacity', 0.6);

        // Draw SIEM center circle
        g.append('circle')
            .attr('cx', centerX)
            .attr('cy', centerY)
            .attr('r', siemRadius)
            .attr('fill', 'none')
            .attr('stroke', '#ff6b6b')
            .attr('stroke-width', 3)
            .attr('stroke-dasharray', '5,5')
            .attr('opacity', 0.5);

        // Add SIEM label
        g.append('text')
            .attr('x', centerX)
            .attr('y', centerY - siemRadius - 10)
            .attr('text-anchor', 'middle')
            .attr('font-size', '18px')
            .attr('font-weight', 'bold')
            .attr('fill', '#ff6b6b')
            .text('🔒 SIEM ECOSYSTEM');

        // Draw nodes
        const node = g.selectAll('.node')
            .data(allNodes)
            .enter().append('g')
            .attr('class', 'node')
            .attr('transform', d => `translate(${d.x},${d.y})`);

        node.append('circle')
            .attr('r', d => d.type === 'siem' ? 12 : 8)
            .attr('fill', d => d.type === 'siem' ? '#ff6b6b' : this.getCategoryColor(d.category))
            .attr('stroke', d => d.type === 'siem' ? '#fff' : '#333')
            .attr('stroke-width', d => d.type === 'siem' ? 3 : 1);

        node.append('text')
            .attr('dx', 15)
            .attr('dy', 4)
            .attr('font-size', d => d.type === 'siem' ? '12px' : '10px')
            .attr('font-weight', d => d.type === 'siem' ? 'bold' : 'normal')
            .attr('fill', '#333')
            .text(d => d.name);

        // Add hover tooltips
        node.append('title')
            .text(d => `${d.name}\nCategory: ${d.category}\nConfidence: ${(d.confidence * 100).toFixed(0)}%`);

        // Add zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        svg.call(zoom);

        // Show statistics
        this.showToast(`SIEM Perspective: ${data.stats.totalSIEMEntities} SIEM entities, ${data.stats.relatedEntitiesCount} related entities across ${data.stats.categoriesCount} categories`, 'success');
    }

    resetZoom() {
        if (this.networkZoom && this.networkSvg) {
            this.networkSvg.transition().call(
                this.networkZoom.transform,
                d3.zoomIdentity
            );
            this.showToast('Zoom reset', 'success');
        }
    }

    zoomIn() {
        if (this.networkZoom && this.networkSvg) {
            this.networkSvg.transition().call(
                this.networkZoom.scaleBy, 1.5
            );
            this.showToast('Zoomed in', 'success');
        }
    }

    zoomOut() {
        if (this.networkZoom && this.networkSvg) {
            this.networkSvg.transition().call(
                this.networkZoom.scaleBy, 1 / 1.5
            );
            this.showToast('Zoomed out', 'success');
        }
    }

    renderSearch() {
        this.showToast('Search interface ready', 'info');
    }
    
    setupNetworkSliders() {
        // Cluster distance slider
        const clusterDistanceSlider = document.getElementById('cluster-distance');
        const clusterDistanceValue = document.getElementById('cluster-distance-value');
        if (clusterDistanceSlider) {
            clusterDistanceSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                clusterDistanceValue.textContent = `${value}px`;
                this.updateClusterDistance(parseInt(value));
            });
        }
        
        // Entity font size slider
        const entityFontSlider = document.getElementById('entity-font-size');
        const entityFontValue = document.getElementById('entity-font-size-value');
        if (entityFontSlider) {
            entityFontSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                entityFontValue.textContent = `${value}px`;
                this.updateEntityFontSize(parseInt(value));
            });
        }
        
        // Cluster font size slider
        const clusterFontSlider = document.getElementById('cluster-font-size');
        const clusterFontValue = document.getElementById('cluster-font-size-value');
        if (clusterFontSlider) {
            clusterFontSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                clusterFontValue.textContent = `${value}px`;
                this.updateClusterFontSize(parseInt(value));
            });
        }
        
        // Inter-cluster distance slider (charge strength)
        const interClusterSlider = document.getElementById('inter-cluster-distance');
        const interClusterValue = document.getElementById('inter-cluster-distance-value');
        if (interClusterSlider) {
            interClusterSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                interClusterValue.textContent = value;
                this.updateInterClusterDistance(parseInt(value));
            });
        }
    }
    
    updateClusterDistance(distance) {
        if (this.networkSimulation) {
            this.networkSimulation.force('link').distance(distance);
            this.networkSimulation.alpha(0.3).restart();
            this.showToast(`Cluster distance: ${distance}px`, 'info');
        }
    }
    
    updateEntityFontSize(fontSize) {
        if (this.networkContainer) {
            this.networkContainer.selectAll('.node-labels text')
                .attr('font-size', `${fontSize}px`);
            this.showToast(`Entity font: ${fontSize}px`, 'info');
        }
    }
    
    updateClusterFontSize(fontSize) {
        if (this.networkContainer) {
            this.networkContainer.selectAll('.cluster-labels text')
                .attr('font-size', `${fontSize}px`);
            this.showToast(`Cluster labels: ${fontSize}px`, 'info');
        }
    }
    
    updateInterClusterDistance(chargeStrength) {
        if (this.networkSimulation) {
            // Use negative value for repulsion force
            this.networkSimulation.force('charge').strength(-chargeStrength);
            this.networkSimulation.alpha(0.3).restart();
            this.showToast(`Cloud separation: ${chargeStrength} (repulsion force)`, 'info');
        }
    }

    // Entity Management Methods
    renderManagement() {
        console.log('Rendering management view');
        // Initialize merge statistics display
        this.showMergeStatistics();
    }

    async findMergeCandidates() {
        try {
            this.showLoading();
            const response = await fetch('/api/merging/candidates');
            const data = await response.json();
            
            this.displayMergeCandidates(data.candidates);
            this.showToast(`Found ${data.total} merge candidates (${data.autoMergeable} auto-mergeable)`, 'info');
        } catch (error) {
            console.error('Error finding merge candidates:', error);
            this.showToast('Failed to find merge candidates', 'error');
        } finally {
            this.hideLoading();
        }
    }

    displayMergeCandidates(candidates) {
        console.log('Displaying merge candidates:', candidates.length, 'candidates');
        
        // Always use basic display for now to ensure it works
        const container = document.getElementById('merge-candidates');
        if (!container) {
            console.error('Merge candidates container not found');
            return;
        }
        
        if (candidates.length === 0) {
            container.innerHTML = '<p class="placeholder">No merge candidates found</p>';
            return;
        }

        // Basic merge candidates display
        // Add counter header
        const counterHtml = `
            <div class="candidates-counter">
                <h4>🔍 Found <span id="candidate-count">${candidates.length}</span> Merge Candidates</h4>
                <p>Review each pair and decide whether to merge or reject them.</p>
            </div>
        `;

        container.innerHTML = counterHtml + candidates.map((candidate, index) => `
            <div class="merge-candidate" data-index="${index}">
                <div class="candidate-header">
                    <span class="candidate-id">#${index + 1}</span>
                    <span class="similarity-score ${this.getSimilarityClass(candidate.confidence)}">
                        ${(candidate.confidence * 100).toFixed(1)}% Match
                    </span>
                </div>
                
                <div class="entity-comparison">
                    <div class="entity-card primary">
                        <h4>${candidate.primary?.name || 'Unknown Entity'}</h4>
                        <p><strong>Category:</strong> ${candidate.primary?.category || 'Unknown'}</p>
                        <p><strong>Confidence:</strong> ${((candidate.primary?.confidence || 0) * 100).toFixed(1)}%</p>
                    </div>
                    
                    <div class="merge-arrow">→</div>
                    
                    <div class="entity-card secondary">
                        <h4>${candidate.secondary?.name || 'Unknown Entity'}</h4>
                        <p><strong>Category:</strong> ${candidate.secondary?.category || 'Unknown'}</p>
                        <p><strong>Confidence:</strong> ${((candidate.secondary?.confidence || 0) * 100).toFixed(1)}%</p>
                    </div>
                </div>
                
                <div class="merge-actions">
                    <button onclick="app.performManualMerge('${candidate.primary?.id}', '${candidate.secondary?.id}')" 
                            class="btn btn-success btn-sm">
                        ✅ Merge
                    </button>
                    <button onclick="app.rejectMerge('${candidate.primary?.id}', '${candidate.secondary?.id}', ${index})" 
                            class="btn btn-danger btn-sm">
                        ❌ Reject
                    </button>
                </div>
                
                ${candidate.reasons && candidate.reasons.length > 0 ? `
                    <div class="merge-reasons">
                        <strong>Reasons:</strong>
                        <ul>
                            ${candidate.reasons.map(reason => `<li>${reason}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `).join('');
    }

    getSimilarityClass(confidence) {
        if (confidence >= 0.8) return 'similarity-high';
        if (confidence >= 0.6) return 'similarity-medium';
        return 'similarity-low';
    }

    async performManualMerge(primaryId, secondaryId) {
        try {
            this.showLoading();
            
            const response = await fetch('/api/merging/manual-merge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    primaryId,
                    secondaryId,
                    action: 'merge'
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showToast(`Successfully merged entities`, 'success');
                // Refresh the merge candidates
                this.findMergeCandidates();
            } else {
                this.showToast(data.error || 'Failed to merge entities', 'error');
            }
        } catch (error) {
            console.error('Error performing manual merge:', error);
            this.showToast('Failed to merge entities', 'error');
        } finally {
            this.hideLoading();
        }
    }

    removeMergedCandidate(primaryId, secondaryId) {
        // Find and remove the candidate that was just merged
        const candidates = document.querySelectorAll('.merge-candidate');
        candidates.forEach(candidate => {
            const mergeButtons = candidate.querySelectorAll('button[onclick*="performManualMerge"]');
            mergeButtons.forEach(button => {
                const onclick = button.getAttribute('onclick');
                if (onclick && onclick.includes(primaryId) && onclick.includes(secondaryId)) {
                    // Add fade-out animation
                    candidate.style.transition = 'opacity 0.5s ease-out';
                    candidate.style.opacity = '0.3';
                    candidate.style.pointerEvents = 'none';
                    
                    // Add "MERGED" indicator
                    const header = candidate.querySelector('.candidate-header');
                    if (header && !header.querySelector('.merged-indicator')) {
                        const indicator = document.createElement('span');
                        indicator.className = 'merged-indicator';
                        indicator.style.cssText = 'background: #28a745; color: white; padding: 2px 8px; border-radius: 3px; font-size: 0.8em; margin-left: 10px;';
                        indicator.textContent = '✅ MERGED';
                        header.appendChild(indicator);
                    }
                    
                    // Remove after animation
                    setTimeout(() => {
                        candidate.remove();
                        this.updateCandidateCounter();
                    }, 500);
                }
            });
        });
    }

    updateCandidateCounter() {
        const countElement = document.getElementById('candidate-count');
        if (countElement) {
            const remainingCandidates = document.querySelectorAll('.merge-candidate').length;
            countElement.textContent = remainingCandidates;
            
            // Update the header text based on remaining count
            const counterDiv = document.querySelector('.candidates-counter h4');
            if (counterDiv && remainingCandidates === 0) {
                counterDiv.innerHTML = '🎉 All merge candidates processed!';
                const description = counterDiv.parentElement.querySelector('p');
                if (description) {
                    description.textContent = 'Great job! All potential duplicates have been reviewed.';
                }
            }
        }
    }

    async rejectMerge(primaryId, secondaryId, index) {
        try {
            // Remove the candidate from the display
            const candidateElement = document.querySelector(`[data-index="${index}"]`);
            if (candidateElement) {
                candidateElement.style.opacity = '0.5';
                candidateElement.style.pointerEvents = 'none';
            }
            
            // In a full implementation, this would record the rejection
            this.showToast('Merge candidate rejected', 'info');
            
            // Remove the element after a short delay
            setTimeout(() => {
                if (candidateElement) {
                    candidateElement.remove();
                    this.updateCandidateCounter();
                }
            }, 1000);
            
        } catch (error) {
            console.error('Error rejecting merge:', error);
            this.showToast('Failed to reject merge', 'error');
        }
    }

    async performAutoMerge() {
        try {
            this.showLoading();
            const response = await fetch('/api/merging/auto-merge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            
            if (data.success) {
                this.showToast(`Auto-merged ${data.mergesPerformed} entities. ${data.suggestions} suggestions remaining.`, 'success');
                // Refresh the candidates list
                this.findMergeCandidates();
                // Update statistics
                this.showMergeStatistics();
            } else {
                this.showToast('Auto-merge failed', 'error');
            }
        } catch (error) {
            console.error('Error performing auto-merge:', error);
            this.showToast('Failed to perform auto-merge', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async performManualMerge(primaryId, secondaryId) {
        try {
            this.showLoading();
            
            const response = await fetch('/api/merging/manual-merge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ primaryId, secondaryId, action: 'merge' })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showToast(data.message || 'Successfully merged entities', 'success');
                
                // Remove the merged candidate from display immediately
                this.removeMergedCandidate(primaryId, secondaryId);
                
                // Don't refresh automatically - let the user see the progress
                // They can manually refresh if needed
            } else {
                this.showToast(data.error || 'Failed to merge entities', 'error');
            }
        } catch (error) {
            console.error('Error performing manual merge:', error);
            this.showToast('Failed to merge entities', 'error');
        } finally {
            this.hideLoading();
        }
    }

    rejectMerge(primaryId, secondaryId) {
        // In a full implementation, this would record the rejection
        this.showToast('Merge rejected (entities will remain separate)', 'info');
        
        // Remove this candidate from the display
        const candidates = document.querySelectorAll('.merge-candidate');
        candidates.forEach(candidate => {
            const mergeButton = candidate.querySelector(`button[onclick*="${primaryId}"][onclick*="${secondaryId}"]`);
            if (mergeButton) {
                candidate.style.opacity = '0.5';
                candidate.style.pointerEvents = 'none';
            }
        });
    }

    async showMergeStatistics() {
        try {
            const response = await fetch('/api/merging/statistics');
            const stats = await response.json();
            
            document.getElementById('total-merges').textContent = stats.totalMerges || 0;
            document.getElementById('auto-merges').textContent = stats.autoMerges || 0;
            document.getElementById('manual-merges').textContent = stats.manualMerges || 0;
            document.getElementById('avg-similarity').textContent = 
                stats.averageSimilarity ? (stats.averageSimilarity * 100).toFixed(1) + '%' : '-';
        } catch (error) {
            console.error('Error getting merge statistics:', error);
            // Set default values
            document.getElementById('total-merges').textContent = '0';
            document.getElementById('auto-merges').textContent = '0';
            document.getElementById('manual-merges').textContent = '0';
            document.getElementById('avg-similarity').textContent = '-';
        }
    }

    // Merge History Methods
    async loadMergeHistory(direction = null) {
        try {
            this.showLoading();
            
            // Handle pagination
            if (direction === 'prev' && this.historyPage > 0) {
                this.historyPage--;
            } else if (direction === 'next') {
                this.historyPage++;
            } else if (direction !== 'prev' && direction !== 'next') {
                this.historyPage = 0; // Reset to first page
            }
            
            // Get filter values
            const typeFilter = document.getElementById('history-type-filter').value;
            const timeFilter = document.getElementById('history-time-filter').value;
            const entityFilter = document.getElementById('history-entity-filter').value;
            
            // Build query parameters
            const params = new URLSearchParams({
                page: this.historyPage,
                limit: 20,
                timeRange: timeFilter
            });
            
            if (typeFilter) params.append('type', typeFilter);
            if (entityFilter) params.append('entityName', entityFilter);
            
            const response = await fetch(`/api/merging/history?${params}`);
            const data = await response.json();
            
            this.displayMergeHistory(data.records);
            this.updateHistoryPagination(data.pagination);
            this.updateHistoryControls(data.statistics);
            
        } catch (error) {
            console.error('Error loading merge history:', error);
            this.showToast('Failed to load merge history', 'error');
        } finally {
            this.hideLoading();
        }
    }

    displayMergeHistory(records) {
        const container = document.getElementById('merge-history');
        
        if (records.length === 0) {
            container.innerHTML = '<p class="placeholder">No merge history found</p>';
            return;
        }

        container.innerHTML = records.map(record => `
            <div class="history-record ${record.status}">
                <div class="record-header">
                    <div class="record-info">
                        <span class="record-id">#${record.id.slice(-8)}</span>
                        <span class="record-type badge badge-${this.getTypeClass(record.type)}">${record.type}</span>
                        <span class="record-timestamp">${new Date(record.timestamp).toLocaleString()}</span>
                    </div>
                    <div class="record-actions">
                        ${record.status === 'completed' && record.metadata.undoable ? 
                            `<button onclick="app.undoSpecificMerge('${record.id}')" class="btn btn-sm btn-outline-warning">
                                ↶ Undo
                            </button>` : ''
                        }
                        <button onclick="app.showMergeDetails('${record.id}')" class="btn btn-sm btn-outline-info">
                            🔍 Details
                        </button>
                    </div>
                </div>
                
                <div class="record-content">
                    <div class="merge-summary">
                        <div class="entity-merge-flow">
                            <div class="merge-entity primary">
                                <strong>${record.primaryEntity.name}</strong>
                                <small>${record.primaryEntity.category}</small>
                            </div>
                            <div class="merge-arrow">→</div>
                            <div class="merge-entity secondary">
                                <strong>${record.secondaryEntity.name}</strong>
                                <small>${record.secondaryEntity.category}</small>
                            </div>
                            <div class="merge-arrow">→</div>
                            <div class="merge-entity result">
                                <strong>${record.resultingEntity.name}</strong>
                                <small>Result</small>
                            </div>
                        </div>
                        
                        <div class="merge-metrics">
                            <div class="metric">
                                <span class="metric-label">Similarity:</span>
                                <span class="metric-value">${(record.similarity?.overall * 100 || 0).toFixed(1)}%</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Confidence Δ:</span>
                                <span class="metric-value ${record.impact.confidenceChange >= 0 ? 'positive' : 'negative'}">
                                    ${record.impact.confidenceChange >= 0 ? '+' : ''}${(record.impact.confidenceChange * 100).toFixed(1)}%
                                </span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Relations Added:</span>
                                <span class="metric-value">+${record.impact.relationshipsAdded}</span>
                            </div>
                        </div>
                    </div>
                    
                    ${record.reasons && record.reasons.length > 0 ? `
                        <div class="merge-reasons">
                            <strong>Reasons:</strong>
                            <ul>
                                ${record.reasons.map(reason => `<li>${reason}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    updateHistoryPagination(pagination) {
        const totalPages = Math.ceil(pagination.total / pagination.limit);
        const currentPage = pagination.page + 1;
        
        document.getElementById('history-page-info').textContent = `Page ${currentPage} of ${totalPages}`;
        document.getElementById('history-prev').disabled = pagination.page === 0;
        document.getElementById('history-next').disabled = currentPage >= totalPages;
    }

    updateHistoryControls(statistics) {
        // Enable/disable undo/redo buttons based on availability
        document.getElementById('undo-btn').disabled = statistics.undoableOperations === 0;
        // Redo button would be enabled based on redo stack (not implemented in basic stats)
    }

    getTypeClass(type) {
        switch (type) {
            case 'auto': return 'success';
            case 'manual': return 'info';
            case 'batch': return 'warning';
            default: return 'secondary';
        }
    }

    async undoLastMerge() {
        try {
            const confirmed = confirm('Are you sure you want to undo the last merge operation?');
            if (!confirmed) return;
            
            this.showLoading();
            
            const response = await fetch('/api/merging/undo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showToast(data.message, 'success');
                this.loadMergeHistory(); // Refresh history
                this.showMergeStatistics(); // Update stats
            } else {
                this.showToast(data.error || 'Failed to undo merge', 'error');
            }
        } catch (error) {
            console.error('Error undoing merge:', error);
            this.showToast('Failed to undo merge', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async redoLastMerge() {
        try {
            const confirmed = confirm('Are you sure you want to redo the last undone merge?');
            if (!confirmed) return;
            
            this.showLoading();
            
            const response = await fetch('/api/merging/redo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showToast(data.message, 'success');
                this.loadMergeHistory(); // Refresh history
                this.showMergeStatistics(); // Update stats
            } else {
                this.showToast(data.error || 'Failed to redo merge', 'error');
            }
        } catch (error) {
            console.error('Error redoing merge:', error);
            this.showToast('Failed to redo merge', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async exportMergeHistory() {
        try {
            const format = prompt('Export format (json or csv):', 'json');
            if (!format || !['json', 'csv'].includes(format.toLowerCase())) return;
            
            const response = await fetch(`/api/merging/history/export?format=${format.toLowerCase()}`);
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `merge-history-${new Date().toISOString().split('T')[0]}.${format.toLowerCase()}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                this.showToast(`Merge history exported as ${format.toUpperCase()}`, 'success');
            } else {
                this.showToast('Failed to export merge history', 'error');
            }
        } catch (error) {
            console.error('Error exporting merge history:', error);
            this.showToast('Failed to export merge history', 'error');
        }
    }

    async undoSpecificMerge(mergeId) {
        // This would require a more sophisticated undo system
        // For now, show a message
        this.showToast('Specific merge undo not yet implemented. Use "Undo Last Merge" for most recent operation.', 'info');
    }

    async showMergeDetails(mergeId) {
        // This would show detailed information about a specific merge
        this.showToast('Merge details view not yet implemented', 'info');
    }

    detectClusters(nodes, links) {
        // Simple cluster detection based on connected components
        this.clusters = [];
        const visited = new Set();
        const linkMap = new Map();
        
        // Build adjacency list
        links.forEach(link => {
            if (!linkMap.has(link.source)) linkMap.set(link.source, []);
            if (!linkMap.has(link.target)) linkMap.set(link.target, []);
            linkMap.get(link.source).push(link.target);
            linkMap.get(link.target).push(link.source);
        });
        
        // Find connected components (clusters)
        nodes.forEach(node => {
            if (!visited.has(node.id)) {
                const cluster = this.dfsCluster(node.id, linkMap, visited, nodes);
                if (cluster.length > 1) { // Only clusters with multiple nodes
                    this.clusters.push({
                        id: `cluster_${this.clusters.length}`,
                        nodes: cluster,
                        center: this.calculateClusterCenter(cluster),
                        dominantCategory: this.getDominantCategory(cluster),
                        title: this.generateClusterTitle(cluster)
                    });
                }
            }
        });
        
        console.log(`Detected ${this.clusters.length} clusters:`, this.clusters);
    }
    
    dfsCluster(nodeId, linkMap, visited, allNodes) {
        const cluster = [];
        const stack = [nodeId];
        
        while (stack.length > 0) {
            const current = stack.pop();
            if (!visited.has(current)) {
                visited.add(current);
                const node = allNodes.find(n => n.id === current);
                if (node) cluster.push(node);
                
                const neighbors = linkMap.get(current) || [];
                neighbors.forEach(neighbor => {
                    if (!visited.has(neighbor)) {
                        stack.push(neighbor);
                    }
                });
            }
        }
        
        return cluster;
    }
    
    calculateClusterCenter(clusterNodes) {
        const x = clusterNodes.reduce((sum, n) => sum + (n.x || 0), 0) / clusterNodes.length;
        const y = clusterNodes.reduce((sum, n) => sum + (n.y || 0), 0) / clusterNodes.length;
        return { x, y };
    }
    
    getDominantCategory(clusterNodes) {
        const categoryCount = {};
        clusterNodes.forEach(node => {
            const cat = node.category || 'unknown';
            categoryCount[cat] = (categoryCount[cat] || 0) + 1;
        });
        
        return Object.keys(categoryCount).reduce((a, b) => 
            categoryCount[a] > categoryCount[b] ? a : b
        );
    }
    
    generateClusterTitle(clusterNodes) {
        const dominantCategory = this.getDominantCategory(clusterNodes);
        const size = clusterNodes.length;
        
        // Find the most connected or highest confidence entity as the cluster anchor
        const anchorEntity = this.findClusterAnchor(clusterNodes);
        const anchorName = anchorEntity ? anchorEntity.name : 'Unknown';
        
        // Create more specific titles based on anchor entity
        if (anchorName && anchorName !== 'Unknown') {
            const categoryIcons = {
                'people': '👥',
                'projects': '📋',
                'decisions': '⚖️',
                'timeline': '📅',
                'locations': '📍',
                'materials': '📦',
                'costs': '💰',
                'issues': '⚠️',
                'tasks': '✅',
                'documents': '📄'
            };
            
            const icon = categoryIcons[dominantCategory] || '🔗';
            const shortName = anchorName.length > 20 ? anchorName.substring(0, 20) + '...' : anchorName;
            return `${icon} ${shortName} (${size})`;
        }
        
        // Fallback to category-based naming
        const categoryTitles = {
            'people': `👥 People Group (${size})`,
            'projects': `📋 Projects Group (${size})`,
            'decisions': `⚖️ Decisions Group (${size})`,
            'timeline': `📅 Timeline Group (${size})`,
            'locations': `📍 Locations Group (${size})`,
            'materials': `📦 Materials Group (${size})`,
            'costs': `💰 Costs Group (${size})`,
            'issues': `⚠️ Issues Group (${size})`,
            'tasks': `✅ Tasks Group (${size})`,
            'documents': `📄 Documents Group (${size})`
        };
        
        return categoryTitles[dominantCategory] || `🔗 Mixed Group (${size})`;
    }
    
    findClusterAnchor(clusterNodes) {
        // Find entity with highest confidence score as anchor
        return clusterNodes.reduce((best, current) => {
            const currentConf = current.confidence || 0;
            const bestConf = best ? (best.confidence || 0) : 0;
            return currentConf > bestConf ? current : best;
        }, null);
    }
    
    createColorLegend() {
        const legendContainer = document.getElementById('legend-items');
        if (!legendContainer) return;
        
        const categories = [...new Set(this.data.networkNodes.map(n => n.category))];
        legendContainer.innerHTML = '';
        
        // Add "All Categories" option
        const allItem = document.createElement('div');
        allItem.className = 'legend-item active';
        allItem.dataset.category = 'all';
        
        const allColorBox = document.createElement('div');
        allColorBox.className = 'legend-color';
        allColorBox.style.backgroundColor = '#666';
        
        const allLabel = document.createElement('span');
        allLabel.textContent = 'All Categories';
        
        allItem.appendChild(allColorBox);
        allItem.appendChild(allLabel);
        allItem.addEventListener('click', () => this.setPerspective('all'));
        legendContainer.appendChild(allItem);
        
        // Add individual categories
        categories.forEach(category => {
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            legendItem.dataset.category = category;
            
            const colorBox = document.createElement('div');
            colorBox.className = 'legend-color';
            colorBox.style.backgroundColor = this.getCategoryColor(category);
            
            const label = document.createElement('span');
            label.textContent = this.capitalizeWords(category);
            
            legendItem.appendChild(colorBox);
            legendItem.appendChild(label);
            legendItem.addEventListener('click', () => this.setPerspective(category));
            legendContainer.appendChild(legendItem);
        });
    }
    
    setPerspective(category) {
        // Update active legend item
        document.querySelectorAll('.legend-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-category="${category}"]`).classList.add('active');
        
        this.currentPerspective = category;
        this.showToast(`Perspective: ${category === 'all' ? 'All Categories' : this.capitalizeWords(category)}`, 'info');
        
        // Re-render network with new perspective
        this.renderNetworkWithPerspective();
    }
    
    renderNetworkWithPerspective() {
        if (!this.data.networkNodes || !this.data.relationships) return;
        
        if (this.currentPerspective === 'all') {
            // Show all nodes normally
            this.createNetworkVisualization();
            return;
        }
        
        // Create perspective-based layout
        this.createPerspectiveVisualization();
    }
    
    createPerspectiveVisualization() {
        const svg = d3.select('#network-svg');
        svg.selectAll('*').remove();

        const width = svg.node().clientWidth;
        const height = svg.node().clientHeight;

        // Add zoom and pan functionality
        const g = svg.append('g');
        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });
        
        svg.call(zoom);
        this.networkZoom = zoom;
        this.networkSvg = svg;
        this.networkContainer = g;

        // Separate nodes by perspective category
        const centerNodes = this.data.networkNodes.filter(n => n.category === this.currentPerspective);
        const radiatingNodes = this.data.networkNodes.filter(n => n.category !== this.currentPerspective);
        
        // Create node lookup map
        const nodeMap = new Map();
        this.data.networkNodes.forEach(node => {
            nodeMap.set(node.id, node);
        });

        // Create nodes and links
        const allNodes = [...centerNodes, ...radiatingNodes];
        const links = [];

        this.data.relationships.forEach(rel => {
            const sourceNode = nodeMap.get(rel.source);
            const targetNode = nodeMap.get(rel.target);
            
            if (sourceNode && targetNode) {
                links.push({
                    source: rel.source,
                    target: rel.target,
                    type: rel.type || 'co-occurrence'
                });
            }
        });

        // Create force simulation with perspective-based positioning
        const simulation = d3.forceSimulation(allNodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(150))
            .force('charge', d3.forceManyBody().strength(-400))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(d => 12 + (d.confidence || 0.5) * 15))
            // Pull center category nodes toward center
            .force('centerCategory', d3.forceRadial(100, width / 2, height / 2)
                .strength(d => d.category === this.currentPerspective ? 0.8 : 0))
            // Push other nodes outward
            .force('radiateOthers', d3.forceRadial(300, width / 2, height / 2)
                .strength(d => d.category !== this.currentPerspective ? 0.3 : 0));

        // Create links
        const link = g.append('g')
            .selectAll('line')
            .data(links)
            .enter().append('line')
            .attr('stroke', '#999')
            .attr('stroke-opacity', 0.4)
            .attr('stroke-width', 1);

        // Create nodes with different styling for center vs radiating
        const node = g.append('g')
            .selectAll('circle')
            .data(allNodes)
            .enter().append('circle')
            .attr('r', d => d.category === this.currentPerspective ? 
                8 + (d.confidence || 0.5) * 12 : 5 + (d.confidence || 0.5) * 8)
            .attr('fill', d => this.getCategoryColor(d.category))
            .attr('stroke', d => d.category === this.currentPerspective ? '#333' : 'none')
            .attr('stroke-width', d => d.category === this.currentPerspective ? 2 : 0)
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));

        // Add labels with different sizes
        const label = g.append('g')
            .attr('class', 'node-labels')
            .selectAll('text')
            .data(allNodes)
            .enter().append('text')
            .text(d => {
                const text = d.name || d.id || 'Unknown';
                return text.length > 15 ? text.substring(0, 15) + '...' : text;
            })
            .attr('font-size', d => d.category === this.currentPerspective ? '12px' : '9px')
            .attr('font-weight', d => d.category === this.currentPerspective ? 'bold' : 'normal')
            .attr('dx', 12)
            .attr('dy', 4)
            .style('pointer-events', 'none');

        // Add tooltips
        node.append('title')
            .text(d => `${d.name || d.id || 'Unknown'}\nCategory: ${d.category || 'Unknown'}\nConfidence: ${Math.round((d.confidence || 0) * 100)}%`);

        // Add click handler for nodes
        node.on('click', (event, d) => {
            this.showToast(`Clicked: ${d.name || d.id} (${d.category})`, 'info');
        });

        simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);

            label
                .attr('x', d => d.x)
                .attr('y', d => d.y);
        });

        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }

        this.networkSimulation = simulation;
        
        this.showToast(`Perspective view: ${this.capitalizeWords(this.currentPerspective)} entities centered`, 'success');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new UniversalKnowledgeApp();
});
