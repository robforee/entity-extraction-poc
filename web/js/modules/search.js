/**
 * Search Module - Entity search and analysis functionality
 */
class Search {
    static renderSearch(app) {
        console.log('Rendering search view');
        Search.setupEventListeners(app);
        Search.clearResults();
    }

    static setupEventListeners(app) {
        const searchInput = document.getElementById('entity-context-search');
        const searchBtn = document.getElementById('context-search-btn');

        if (searchInput && searchBtn) {
            // Search on button click
            searchBtn.addEventListener('click', () => {
                const query = searchInput.value.trim();
                if (query) {
                    Search.performSearch(app, query);
                }
            });

            // Search on Enter key
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const query = searchInput.value.trim();
                    if (query) {
                        Search.performSearch(app, query);
                    }
                }
            });

            // Clear results when input is cleared
            searchInput.addEventListener('input', (e) => {
                if (!e.target.value.trim()) {
                    Search.clearResults();
                }
            });
        }

        // Management panel buttons
        const mergeBtn = document.getElementById('merge-selected');
        const splitBtn = document.getElementById('split-entity');
        const viewSimilarBtn = document.getElementById('view-similar');

        if (mergeBtn) {
            mergeBtn.addEventListener('click', () => Search.mergeSelectedEntities(app));
        }

        if (splitBtn) {
            splitBtn.addEventListener('click', () => Search.splitEntity(app));
        }

        if (viewSimilarBtn) {
            viewSimilarBtn.addEventListener('click', () => Search.viewSimilarEntities(app));
        }
    }

    static async performSearch(app, query) {
        try {
            const resultsContainer = document.getElementById('entity-analysis-results');
            if (!resultsContainer) return;

            // Show loading
            resultsContainer.innerHTML = '<div class="loading">🔍 Searching entities...</div>';

            // Search in local entities first
            const localResults = Search.searchLocalEntities(app, query);

            // Try to get server-side search results
            let serverResults = [];
            try {
                const response = await fetch(`${app.apiBaseUrl}/api/entities/search/${encodeURIComponent(query)}`);
                if (response.ok) {
                    const data = await response.json();
                    serverResults = data.entities || data || [];
                }
            } catch (error) {
                console.warn('Server search failed, using local results only:', error);
            }

            // Combine and deduplicate results
            const allResults = Search.combineResults(localResults, serverResults);

            if (allResults.length === 0) {
                resultsContainer.innerHTML = `
                    <div class="no-results">
                        <h3>No entities found for "${query}"</h3>
                        <p>Try searching for:</p>
                        <ul>
                            <li>Entity names (e.g., "SIEM", "Firewall", "SOC")</li>
                            <li>Categories (e.g., "security tools", "vulnerabilities")</li>
                            <li>Partial matches (e.g., "cyber" for cybersecurity terms)</li>
                        </ul>
                    </div>
                `;
                return;
            }

            // Display results
            Search.displayResults(allResults, query);

            // Show management panel if multiple results
            if (allResults.length > 1) {
                Search.showManagementPanel();
            }

        } catch (error) {
            console.error('Search error:', error);
            UIUtils.showToast('Search failed', 'error');
        }
    }

    static searchLocalEntities(app, query) {
        if (!Array.isArray(app.data.entities)) return [];

        const queryLower = query.toLowerCase();
        
        return app.data.entities.filter(entity => {
            return (
                entity.name?.toLowerCase().includes(queryLower) ||
                entity.category?.toLowerCase().includes(queryLower) ||
                entity.role?.toLowerCase().includes(queryLower) ||
                entity.type?.toLowerCase().includes(queryLower) ||
                entity.status?.toLowerCase().includes(queryLower)
            );
        }).map(entity => ({
            ...entity,
            source: 'local',
            relevance: Search.calculateRelevance(entity, queryLower)
        }));
    }

    static calculateRelevance(entity, queryLower) {
        let score = 0;
        
        // Exact name match gets highest score
        if (entity.name?.toLowerCase() === queryLower) score += 100;
        else if (entity.name?.toLowerCase().startsWith(queryLower)) score += 80;
        else if (entity.name?.toLowerCase().includes(queryLower)) score += 60;
        
        // Category matches
        if (entity.category?.toLowerCase().includes(queryLower)) score += 40;
        
        // Other field matches
        if (entity.role?.toLowerCase().includes(queryLower)) score += 20;
        if (entity.type?.toLowerCase().includes(queryLower)) score += 20;
        
        // Confidence bonus
        score += (entity.confidence || 0) * 10;
        
        return score;
    }

    static combineResults(localResults, serverResults) {
        const combined = [...localResults];
        const existingIds = new Set(localResults.map(r => r.id));

        // Add server results that aren't already in local results
        serverResults.forEach(result => {
            if (!existingIds.has(result.id)) {
                combined.push({
                    ...result,
                    source: 'server'
                });
            }
        });

        // Sort by relevance
        return combined.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
    }

    static displayResults(results, query) {
        const container = document.getElementById('entity-analysis-results');
        if (!container) return;

        const html = `
            <div class="search-results">
                <div class="results-header">
                    <h3>Search Results for "${query}" (${results.length} found)</h3>
                    <div class="results-actions">
                        <button onclick="Search.selectAll()" class="btn btn-sm btn-secondary">Select All</button>
                        <button onclick="Search.clearSelection()" class="btn btn-sm btn-outline-secondary">Clear Selection</button>
                    </div>
                </div>
                
                <div class="results-grid">
                    ${results.map((entity, index) => `
                        <div class="result-card" data-entity-id="${entity.id}" data-index="${index}">
                            <div class="result-header">
                                <input type="checkbox" class="entity-checkbox" id="entity-${index}" data-entity-id="${entity.id}">
                                <label for="entity-${index}" class="entity-name">${entity.name}</label>
                                <span class="entity-source ${entity.source}">${entity.source}</span>
                            </div>
                            
                            <div class="result-details">
                                <div class="entity-category">
                                    <span class="category-badge ${entity.category}">${UIUtils.capitalizeWords(entity.category)}</span>
                                </div>
                                
                                <div class="entity-metrics">
                                    <span class="confidence">Confidence: ${UIUtils.formatConfidence(entity.confidence)}</span>
                                    ${entity.relevance ? `<span class="relevance">Relevance: ${entity.relevance.toFixed(0)}%</span>` : ''}
                                </div>
                                
                                ${entity.role ? `<div class="entity-role"><strong>Role:</strong> ${entity.role}</div>` : ''}
                                ${entity.type ? `<div class="entity-type"><strong>Type:</strong> ${entity.type}</div>` : ''}
                                ${entity.status ? `<div class="entity-status"><strong>Status:</strong> ${entity.status}</div>` : ''}
                                
                                <div class="entity-meta">
                                    <small>Source: ${UIUtils.getDocumentName(entity.metadata?.source)}</small>
                                    <small>Added: ${UIUtils.formatDate(entity.timestamp)}</small>
                                </div>
                            </div>
                            
                            <div class="result-actions">
                                <button onclick="Entities.viewEntityDetails('${entity.id}')" class="btn btn-sm btn-primary">
                                    👁️ Details
                                </button>
                                <button onclick="Search.findSimilar('${entity.id}')" class="btn btn-sm btn-secondary">
                                    🔍 Similar
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        container.innerHTML = html;

        // Add checkbox event listeners
        container.querySelectorAll('.entity-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', Search.updateSelectionCount);
        });
    }

    static clearResults() {
        const container = document.getElementById('entity-analysis-results');
        if (container) {
            container.innerHTML = '<p class="placeholder">Enter any entity name to see all variants, context, and merge opportunities</p>';
        }
        Search.hideManagementPanel();
    }

    static showManagementPanel() {
        const panel = document.getElementById('entity-management-panel');
        if (panel) {
            panel.style.display = 'block';
        }
    }

    static hideManagementPanel() {
        const panel = document.getElementById('entity-management-panel');
        if (panel) {
            panel.style.display = 'none';
        }
    }

    static selectAll() {
        document.querySelectorAll('.entity-checkbox').forEach(checkbox => {
            checkbox.checked = true;
        });
        Search.updateSelectionCount();
    }

    static clearSelection() {
        document.querySelectorAll('.entity-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });
        Search.updateSelectionCount();
    }

    static updateSelectionCount() {
        const selected = document.querySelectorAll('.entity-checkbox:checked').length;
        const mergeBtn = document.getElementById('merge-selected');
        
        if (mergeBtn) {
            mergeBtn.textContent = selected > 1 ? `🔗 Merge Selected (${selected})` : '🔗 Merge Selected';
            mergeBtn.disabled = selected < 2;
        }
    }

    static async findSimilar(entityId) {
        try {
            // Use the existing Entities module functionality
            await Entities.findSimilarEntities(entityId);
        } catch (error) {
            console.error('Error finding similar entities:', error);
            UIUtils.showToast('Failed to find similar entities', 'error');
        }
    }

    static mergeSelectedEntities(app) {
        const selectedCheckboxes = document.querySelectorAll('.entity-checkbox:checked');
        
        if (selectedCheckboxes.length < 2) {
            UIUtils.showToast('Please select at least 2 entities to merge', 'warning');
            return;
        }

        const entityIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.entityId);
        const entityNames = Array.from(selectedCheckboxes).map(cb => {
            const card = cb.closest('.result-card');
            return card.querySelector('.entity-name').textContent;
        });

        const confirmed = confirm(`Merge ${entityIds.length} entities?\n\nEntities: ${entityNames.join(', ')}\n\nThis action cannot be undone.`);
        
        if (confirmed) {
            // For now, just show a success message
            // In a real implementation, this would call the merge API
            UIUtils.showToast(`Merge initiated for ${entityIds.length} entities`, 'success');
            
            // Clear selection
            Search.clearSelection();
        }
    }

    static splitEntity(app) {
        const selectedCheckboxes = document.querySelectorAll('.entity-checkbox:checked');
        
        if (selectedCheckboxes.length !== 1) {
            UIUtils.showToast('Please select exactly one entity to split', 'warning');
            return;
        }

        const entityId = selectedCheckboxes[0].dataset.entityId;
        const entityName = selectedCheckboxes[0].closest('.result-card').querySelector('.entity-name').textContent;

        const confirmed = confirm(`Split entity "${entityName}"?\n\nThis will separate merged entities back into individual entities.`);
        
        if (confirmed) {
            // For now, just show a success message
            // In a real implementation, this would call the split API
            UIUtils.showToast(`Split initiated for entity: ${entityName}`, 'success');
            
            // Clear selection
            Search.clearSelection();
        }
    }

    static viewSimilarEntities(app) {
        const selectedCheckboxes = document.querySelectorAll('.entity-checkbox:checked');
        
        if (selectedCheckboxes.length !== 1) {
            UIUtils.showToast('Please select exactly one entity to view similar entities', 'warning');
            return;
        }

        const entityId = selectedCheckboxes[0].dataset.entityId;
        Search.findSimilar(entityId);
    }
}
