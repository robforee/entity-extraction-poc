/**
 * Event Handlers Module - All event listener setup and handling
 */
class EventHandlers {
    static setupEventListeners(app) {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const view = btn.dataset.view;
                console.log('Navigation clicked:', view);
                app.switchView(view);
            });
        });

        // Domain selector
        document.getElementById('domain-select')?.addEventListener('change', (e) => {
            app.switchDomain(e.target.value);
        });

        // Modal
        document.querySelector('.modal-close')?.addEventListener('click', () => app.closeModal());
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) app.closeModal();
        });

        // Search
        document.getElementById('context-search-btn')?.addEventListener('click', () => app.performSearch());
        document.getElementById('entity-context-search')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') app.performSearch();
        });

        // Filters
        document.getElementById('category-filter')?.addEventListener('change', (e) => {
            app.filters.category = e.target.value || null;
            app.loadEntities();
        });

        document.getElementById('confidence-slider')?.addEventListener('input', (e) => {
            app.filters.minConfidence = parseFloat(e.target.value);
            const confidenceValue = document.getElementById('confidence-value');
            if (confidenceValue) {
                confidenceValue.textContent = `${Math.round(app.filters.minConfidence * 100)}%`;
            }
            app.loadEntities();
        });

        // Network controls
        document.getElementById('toggle-hierarchy')?.addEventListener('click', () => app.toggleHierarchicalLayout());
        document.getElementById('toggle-force')?.addEventListener('click', () => app.toggleForceLayout());
        document.getElementById('siem-perspective')?.addEventListener('click', () => app.showSIEMPerspective());
        document.getElementById('entity-perspective')?.addEventListener('click', () => app.showEntityPerspective());
        
        // Network category filter
        document.getElementById('network-category-filter')?.addEventListener('change', (e) => {
            app.filterNetworkByCategory(e.target.value);
        });

        // Entity search in network view
        document.getElementById('entity-search')?.addEventListener('input', (e) => {
            app.handleEntitySearch(e.target.value);
        });

        // Auto-merge button
        document.getElementById('auto-merge-btn')?.addEventListener('click', () => app.performAutoMerge());
        
        // Reset merged pairs button
        document.getElementById('reset-merged-pairs')?.addEventListener('click', () => app.resetMergedPairs());
        
        // Entity context search
        document.getElementById('entity-context-search')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                app.performEntityContextSearch();
            }
        });

        // Management buttons
        document.getElementById('merge-selected')?.addEventListener('click', () => app.mergeSelectedEntities());
        document.getElementById('split-entity')?.addEventListener('click', () => app.splitEntity());
        document.getElementById('view-similar')?.addEventListener('click', () => app.viewSimilarEntities());
    }
}
