/**
 * Entities Module - Entity Explorer functionality
 */
class Entities {
    static renderEntities(app) {
        console.log('Rendering entities view');
        Entities.populateFilters(app);
        Entities.renderEntitiesGrid(app);
        Entities.setupEventListeners(app);
    }

    static populateFilters(app) {
        const categoryFilter = document.getElementById('category-filter');
        if (!categoryFilter) return;

        // Clear existing options except "All Categories"
        categoryFilter.innerHTML = '<option value="">All Categories</option>';

        // Add category options
        if (app.data.categories) {
            Object.keys(app.data.categories).forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = UIUtils.capitalizeWords(category);
                categoryFilter.appendChild(option);
            });
        }
    }

    static renderEntitiesGrid(app) {
        const grid = document.getElementById('entities-grid');
        if (!grid) return;

        if (!Array.isArray(app.data.entities) || app.data.entities.length === 0) {
            grid.innerHTML = '<p class="placeholder">No entities available</p>';
            return;
        }

        // Get filter values
        const categoryFilter = document.getElementById('category-filter')?.value || '';
        const confidenceSlider = document.getElementById('confidence-slider')?.value || 0;

        // Filter entities
        let filteredEntities = app.data.entities;
        
        if (categoryFilter) {
            filteredEntities = filteredEntities.filter(entity => 
                entity.category === categoryFilter
            );
        }

        if (confidenceSlider > 0) {
            filteredEntities = filteredEntities.filter(entity => 
                (entity.confidence || 0) >= parseFloat(confidenceSlider)
            );
        }

        // Sort by confidence (highest first)
        filteredEntities.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

        // Render entities
        grid.innerHTML = filteredEntities.map(entity => `
            <div class="entity-card" data-entity-id="${entity.id}">
                <div class="entity-header">
                    <h4 class="entity-name">${entity.name}</h4>
                    <span class="entity-category ${entity.category}">${UIUtils.capitalizeWords(entity.category)}</span>
                </div>
                <div class="entity-details">
                    <div class="entity-confidence">
                        <span class="confidence-label">Confidence:</span>
                        <span class="confidence-value">${UIUtils.formatConfidence(entity.confidence)}</span>
                        <div class="confidence-bar">
                            <div class="confidence-fill" style="width: ${(entity.confidence || 0) * 100}%"></div>
                        </div>
                    </div>
                    ${entity.role ? `<div class="entity-role"><strong>Role:</strong> ${entity.role}</div>` : ''}
                    ${entity.type ? `<div class="entity-type"><strong>Type:</strong> ${entity.type}</div>` : ''}
                    ${entity.status ? `<div class="entity-status"><strong>Status:</strong> ${entity.status}</div>` : ''}
                </div>
                <div class="entity-meta">
                    <small class="entity-source">Source: ${UIUtils.getDocumentName(entity.metadata?.source)}</small>
                    <small class="entity-date">Added: ${UIUtils.formatDate(entity.timestamp)}</small>
                </div>
                <div class="entity-actions">
                    <button onclick="Entities.viewEntityDetails('${entity.id}')" class="btn btn-sm btn-primary">
                        👁️ View Details
                    </button>
                    <button onclick="Entities.findSimilarEntities('${entity.id}')" class="btn btn-sm btn-secondary">
                        🔍 Find Similar
                    </button>
                </div>
            </div>
        `).join('');

        // Update count
        Entities.updateEntityCount(filteredEntities.length, app.data.entities.length);
    }

    static updateEntityCount(filtered, total) {
        const countElement = document.querySelector('.entities-count');
        if (countElement) {
            countElement.textContent = filtered === total ? 
                `${total} entities` : 
                `${filtered} of ${total} entities`;
        }
    }

    static setupEventListeners(app) {
        // Category filter
        const categoryFilter = document.getElementById('category-filter');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', () => {
                Entities.renderEntitiesGrid(app);
            });
        }

        // Confidence slider
        const confidenceSlider = document.getElementById('confidence-slider');
        const confidenceValue = document.getElementById('confidence-value');
        if (confidenceSlider && confidenceValue) {
            confidenceSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                confidenceValue.textContent = `${(value * 100).toFixed(0)}%`;
                Entities.renderEntitiesGrid(app);
            });
        }

        // Export button
        const exportBtn = document.getElementById('export-entities');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                Entities.exportEntities(app);
            });
        }
    }

    static async viewEntityDetails(entityId) {
        try {
            // Find the entity
            const entity = window.app.data.entities.find(e => e.id === entityId);
            if (!entity) {
                UIUtils.showToast('Entity not found', 'error');
                return;
            }

            // Create modal
            const modal = document.createElement('div');
            modal.className = 'entity-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Entity Details: ${entity.name}</h3>
                        <button onclick="this.closest('.entity-modal').remove()" class="close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="entity-detail-grid">
                            <div class="detail-item">
                                <strong>Name:</strong> ${entity.name}
                            </div>
                            <div class="detail-item">
                                <strong>Category:</strong> ${UIUtils.capitalizeWords(entity.category)}
                            </div>
                            <div class="detail-item">
                                <strong>Confidence:</strong> ${UIUtils.formatConfidence(entity.confidence)}
                            </div>
                            ${entity.role ? `<div class="detail-item"><strong>Role:</strong> ${entity.role}</div>` : ''}
                            ${entity.type ? `<div class="detail-item"><strong>Type:</strong> ${entity.type}</div>` : ''}
                            ${entity.status ? `<div class="detail-item"><strong>Status:</strong> ${entity.status}</div>` : ''}
                            <div class="detail-item">
                                <strong>Source:</strong> ${UIUtils.getDocumentName(entity.metadata?.source)}
                            </div>
                            <div class="detail-item">
                                <strong>Added:</strong> ${UIUtils.formatDate(entity.timestamp)}
                            </div>
                            <div class="detail-item">
                                <strong>ID:</strong> ${entity.id}
                            </div>
                        </div>
                        ${entity.metadata ? `
                            <div class="metadata-section">
                                <h4>Metadata</h4>
                                <pre>${JSON.stringify(entity.metadata, null, 2)}</pre>
                            </div>
                        ` : ''}
                    </div>
                    <div class="modal-footer">
                        <button onclick="this.closest('.entity-modal').remove()" class="btn btn-secondary">Close</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

        } catch (error) {
            console.error('Error viewing entity details:', error);
            UIUtils.showToast('Failed to load entity details', 'error');
        }
    }

    static async findSimilarEntities(entityId) {
        try {
            console.log(`Finding similar entities for: ${entityId}`);
            const response = await fetch(`${window.app.apiBaseUrl}/api/entities/similar/${entityId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            const similarEntities = Array.isArray(data) ? data : (data.entities || data.similar || []);
            
            if (!Array.isArray(similarEntities) || similarEntities.length === 0) {
                UIUtils.showToast('No similar entities found', 'info');
                return;
            }

            // Show similar entities in a modal
            const modal = document.createElement('div');
            modal.className = 'similar-entities-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Similar Entities (${similarEntities.length} found)</h3>
                        <button onclick="this.closest('.similar-entities-modal').remove()" class="close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="similar-entities-list">
                            ${similarEntities.map(entity => `
                                <div class="similar-entity-item">
                                    <div class="entity-info">
                                        <h4>${entity.name}</h4>
                                        <p class="entity-category">${UIUtils.capitalizeWords(entity.category)}</p>
                                        <p class="similarity-score">Similarity: ${(entity.similarity * 100).toFixed(1)}%</p>
                                    </div>
                                    <div class="entity-actions">
                                        <button onclick="Entities.viewEntityDetails('${entity.id}')" class="btn btn-sm btn-primary">View</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button onclick="this.closest('.similar-entities-modal').remove()" class="btn btn-secondary">Close</button>
                    </div>
                </div>
            `;

            // Add modal styles
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                background: rgba(0,0,0,0.5); display: flex; align-items: center; 
                justify-content: center; z-index: 1000;
            `;

            document.body.appendChild(modal);

        } catch (error) {
            console.error('Error finding similar entities:', error);
            UIUtils.showToast('Failed to find similar entities', 'error');
        }
    }

    static async viewEntityDetails(entityId) {
        try {
            // Find the entity
            const entity = window.app.data.entities.find(e => e.id === entityId);
            if (!entity) {
                UIUtils.showToast('Entity not found', 'error');
                return;
            }

            // Create modal with entity details
            const modal = document.createElement('div');
            modal.className = 'entity-details-modal';
            modal.innerHTML = `
                <div class="modal-content large">
                    <div class="modal-header">
                        <h3>🎯 Entity Details</h3>
                        <button onclick="this.closest('.entity-details-modal').remove()" class="close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="entity-details">
                            <div class="detail-section">
                                <h4>Basic Information</h4>
                                <p><strong>Name:</strong> ${entity.name}</p>
                                <p><strong>ID:</strong> ${entity.id}</p>
                                <p><strong>Category:</strong> ${UIUtils.capitalizeWords(entity.category)}</p>
                                <p><strong>Confidence:</strong> ${UIUtils.formatConfidence(entity.confidence)}</p>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button onclick="this.closest('.entity-details-modal').remove()" class="btn btn-secondary">Close</button>
                        <button onclick="Entities.findSimilarEntities('${entityId}')" class="btn btn-primary">Find Similar</button>
                    </div>
                </div>
            `;

            // Add modal styles
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                background: rgba(0,0,0,0.5); display: flex; align-items: center; 
                justify-content: center; z-index: 1000;
            `;

            document.body.appendChild(modal);

        } catch (error) {
            console.error('Error viewing entity details:', error);
            UIUtils.showToast('Failed to load entity details', 'error');
        }
    }

    static exportEntities(app) {
        try {
            // Get filtered entities
            const categoryFilter = document.getElementById('category-filter')?.value || '';
            const confidenceSlider = document.getElementById('confidence-slider')?.value || 0;
            let entitiesToExport = app.data.entities || [];
            
            if (categoryFilter) {
                entitiesToExport = entitiesToExport.filter(entity => 
                    entity.category === categoryFilter
                );
            }

            if (confidenceSlider > 0) {
                entitiesToExport = entitiesToExport.filter(entity => 
                    (entity.confidence || 0) >= parseFloat(confidenceSlider)
                );
            }

            // Create CSV content
            const headers = ['Name', 'Category', 'Confidence', 'Role', 'Type', 'Status', 'Source', 'Date Added', 'ID'];
            const csvContent = [
                headers.join(','),
                ...entitiesToExport.map(entity => [
                    `"${entity.name || ''}"`,
                    `"${entity.category || ''}"`,
                    entity.confidence || 0,
                    `"${entity.role || ''}"`,
                    `"${entity.type || ''}"`,
                    `"${entity.status || ''}"`,
                    `"${UIUtils.getDocumentName(entity.metadata?.source) || ''}"`,
                    `"${UIUtils.formatDate(entity.timestamp) || ''}"`,
                    `"${entity.id || ''}"`
                ].join(','))
            ].join('\n');

            // Download CSV
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `entities_export_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            UIUtils.showToast(`Exported ${entitiesToExport.length} entities to CSV`, 'success');

        } catch (error) {
            console.error('Error exporting entities:', error);
            UIUtils.showToast('Failed to export entities', 'error');
        }
    }
}
