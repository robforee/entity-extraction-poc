/**
 * Base Application Class - Core initialization and setup
 */
class UniversalKnowledgeApp {
    constructor() {
        this.socket = null;
        this.apiBaseUrl = 'http://localhost:8080'; // Enhanced Viz Server with all API endpoints
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

        this.socket.on('data-updated', (data) => {
            console.log('Data updated:', data);
            this.loadInitialData();
        });

        this.socket.on('merge-completed', (data) => {
            console.log('Merge completed:', data);
            this.showToast(`Merge completed: ${data.message}`, 'success');
            if (this.currentView === 'management') {
                setTimeout(() => this.findMergeCandidates(), 1000);
            }
        });

        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            this.showToast('Connection error occurred', 'error');
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
                fetch(`${this.apiBaseUrl}/api/entities/stats`),
                fetch(`${this.apiBaseUrl}/api/entities/categories`),
                fetch(`${this.apiBaseUrl}/api/entities?limit=50`),
                fetch(`${this.apiBaseUrl}/api/documents`),
                fetch(`${this.apiBaseUrl}/api/domains`)
            ]);

            this.data.stats = await statsRes.json();
            this.data.categories = await categoriesRes.json();
            const entitiesData = await entitiesRes.json();
            this.data.entities = entitiesData.entities || entitiesData || [];
            const documentsData = await documentsRes.json();
            this.data.documents = documentsData.documents || documentsData || [];
            this.data.domains = await domainsRes.json();

            this.populateFilterOptions();
            this.populateDomainSelector();
            
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.showToast('Failed to load application data', 'error');
        }
    }

    switchView(viewName) {
        console.log('Switching to view:', viewName);
        
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        const navBtn = document.querySelector(`[data-view="${viewName}"]`);
        if (navBtn) {
            navBtn.classList.add('active');
        }

        // Update views
        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
        const viewElement = document.getElementById(`${viewName}-view`);
        if (viewElement) {
            viewElement.classList.add('active');
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
}
