/**
 * Documents Module - Document management functionality
 */
class Documents {
    static renderDocuments(app) {
        console.log('Rendering documents view');
        Documents.renderDocumentsList(app);
        Documents.setupEventListeners(app);
    }

    static renderDocumentsList(app) {
        const container = document.getElementById('documents-list');
        if (!container) {
            console.warn('Documents list container not found');
            return;
        }

        if (!Array.isArray(app.data.documents) || app.data.documents.length === 0) {
            container.innerHTML = '<p class="placeholder">No documents available</p>';
            return;
        }

        // Sort documents by timestamp (newest first)
        const sortedDocuments = [...app.data.documents].sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );

        container.innerHTML = sortedDocuments.map(doc => `
            <div class="document-card" data-document-id="${doc.id}">
                <div class="document-header">
                    <h4 class="document-title">${UIUtils.getDocumentName(doc.source)}</h4>
                    <span class="document-type">${doc.documentType || 'Unknown'}</span>
                </div>
                <div class="document-details">
                    <div class="document-stats">
                        <span class="stat-item">
                            <strong>Entities:</strong> ${doc.entityCount || 0}
                        </span>
                        <span class="stat-item">
                            <strong>Added:</strong> ${UIUtils.formatDate(doc.timestamp)}
                        </span>
                    </div>
                    <div class="document-path">
                        <small>${doc.source}</small>
                    </div>
                    ${doc.categories && doc.categories.length > 0 ? `
                        <div class="document-categories">
                            <strong>Categories:</strong>
                            ${doc.categories.map(cat => `<span class="category-tag">${UIUtils.capitalizeWords(cat)}</span>`).join('')}
                        </div>
                    ` : ''}
                </div>
                <div class="document-actions">
                    <button onclick="Documents.viewDocumentDetails('${doc.id}')" class="btn btn-sm btn-primary">
                        👁️ View Details
                    </button>
                    <button onclick="Documents.viewDocumentEntities('${doc.id}')" class="btn btn-sm btn-secondary">
                        🎯 View Entities
                    </button>
                    <button onclick="Documents.downloadDocument('${doc.id}')" class="btn btn-sm btn-outline-primary">
                        📥 Download
                    </button>
                </div>
            </div>
        `).join('');

        // Update count
        const countElement = document.querySelector('.documents-count');
        if (countElement) {
            countElement.textContent = `${sortedDocuments.length} documents`;
        }
    }

    static setupEventListeners(app) {
        // Add any document-specific event listeners here
        console.log('Documents event listeners set up');
    }

    static async viewDocumentDetails(documentId) {
        try {
            const response = await fetch(`${window.app.apiBaseUrl}/api/documents/${documentId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const docDetails = await response.json();
            
            // Create modal
            const modal = document.createElement('div');
            modal.className = 'document-modal';
            modal.innerHTML = `
                <div class="modal-content large">
                    <div class="modal-header">
                        <h3>Document Details</h3>
                        <button onclick="this.closest('.document-modal').remove()" class="close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="document-detail-grid">
                            <div class="detail-item">
                                <strong>Name:</strong> ${UIUtils.getDocumentName(docDetails.source)}
                            </div>
                            <div class="detail-item">
                                <strong>Type:</strong> ${docDetails.documentType || 'Unknown'}
                            </div>
                            <div class="detail-item">
                                <strong>Entities:</strong> ${docDetails.entityCount || 0}
                            </div>
                            <div class="detail-item">
                                <strong>Added:</strong> ${UIUtils.formatDate(docDetails.timestamp)}
                            </div>
                            <div class="detail-item full-width">
                                <strong>Path:</strong> ${docDetails.source}
                            </div>
                            <div class="detail-item">
                                <strong>ID:</strong> ${docDetails.id}
                            </div>
                            ${docDetails.categories && docDetails.categories.length > 0 ? `
                                <div class="detail-item full-width">
                                    <strong>Categories:</strong>
                                    <div class="categories-list">
                                        ${docDetails.categories.map(cat => `<span class="category-tag">${UIUtils.capitalizeWords(cat)}</span>`).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button onclick="Documents.viewDocumentEntities('${documentId}')" class="btn btn-primary">View Entities</button>
                        <button onclick="this.closest('.document-modal').remove()" class="btn btn-secondary">Close</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

        } catch (error) {
            console.error('Error viewing document details:', error);
            UIUtils.showToast('Failed to load document details', 'error');
        }
    }

    static async viewDocumentEntities(documentId) {
        try {
            const response = await fetch(`${window.app.apiBaseUrl}/api/documents/${documentId}/entities`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            const entities = Array.isArray(data) ? data : (data.entities || []);
            
            if (!Array.isArray(entities) || entities.length === 0) {
                UIUtils.showToast('No entities found in this document', 'info');
                return;
            }

            // Create modal
            const modal = document.createElement('div');
            modal.className = 'document-entities-modal';
            modal.innerHTML = `
                <div class="modal-content large">
                    <div class="modal-header">
                        <h3>Document Entities (${entities.length} found)</h3>
                        <button onclick="this.closest('.document-entities-modal').remove()" class="close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="entities-list">
                            ${entities.map(entity => `
                                <div class="entity-item">
                                    <div class="entity-info">
                                        <h4>${entity.name}</h4>
                                        <p class="entity-category">${UIUtils.capitalizeWords(entity.category)}</p>
                                        <p class="entity-confidence">Confidence: ${UIUtils.formatConfidence(entity.confidence)}</p>
                                        ${entity.role ? `<p class="entity-role">Role: ${entity.role}</p>` : ''}
                                        ${entity.type ? `<p class="entity-type">Type: ${entity.type}</p>` : ''}
                                    </div>
                                    <div class="entity-actions">
                                        <button onclick="Entities.viewEntityDetails('${entity.id}')" class="btn btn-sm btn-primary">View Details</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button onclick="this.closest('.document-entities-modal').remove()" class="btn btn-secondary">Close</button>
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
            console.error('Error viewing document entities:', error);
            UIUtils.showToast('Failed to load document entities', 'error');
        }
    }

    static async downloadDocument(documentId) {
        try {
            // Find the document
            const docRecord = window.app.data.documents.find(d => d.id === documentId);
            if (!docRecord) {
                UIUtils.showToast('Document not found', 'error');
                return;
            }

            // For now, just show the document info as JSON
            // In a real implementation, this would download the actual file
            const docData = {
                id: docRecord.id,
                source: docRecord.source,
                timestamp: docRecord.timestamp,
                entityCount: docRecord.entityCount,
                categories: docRecord.categories,
                documentType: docRecord.documentType
            };

            const blob = new Blob([JSON.stringify(docData, null, 2)], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.download = `document_${documentId}_metadata.json`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            window.URL.revokeObjectURL(url);

            UIUtils.showToast('Document metadata downloaded', 'success');

        } catch (error) {
            console.error('Error downloading document:', error);
            UIUtils.showToast('Failed to download document', 'error');
        }
    }

    static async viewDocumentDetails(documentId) {
        try {
            // Find the document
            const docRecord = window.app.data.documents.find(d => d.id === documentId);
            if (!docRecord) {
                UIUtils.showToast('Document not found', 'error');
                return;
            }

            // Create modal with document details
            const modal = document.createElement('div');
            modal.className = 'document-details-modal';
            modal.innerHTML = `
                <div class="modal-content large">
                    <div class="modal-header">
                        <h3>📄 Document Details</h3>
                        <button onclick="this.closest('.document-details-modal').remove()" class="close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="document-details">
                            <div class="detail-section">
                                <h4>Basic Information</h4>
                                <p><strong>ID:</strong> ${docRecord.id}</p>
                                <p><strong>Source:</strong> ${docRecord.source}</p>
                                <p><strong>Type:</strong> ${docRecord.documentType || 'Unknown'}</p>
                                <p><strong>Timestamp:</strong> ${new Date(docRecord.timestamp).toLocaleString()}</p>
                            </div>
                            <div class="detail-section">
                                <h4>Statistics</h4>
                                <p><strong>Entity Count:</strong> ${docRecord.entityCount || 0}</p>
                                <p><strong>Categories:</strong> ${docRecord.categories ? docRecord.categories.join(', ') : 'None'}</p>
                            </div>
                            ${docRecord.content ? `
                                <div class="detail-section">
                                    <h4>Content Preview</h4>
                                    <div class="content-preview">
                                        ${docRecord.content.substring(0, 500)}${docRecord.content.length > 500 ? '...' : ''}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button onclick="this.closest('.document-details-modal').remove()" class="btn btn-secondary">Close</button>
                        <button onclick="Documents.viewDocumentEntities('${documentId}')" class="btn btn-primary">View Entities</button>
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
            console.error('Error viewing document details:', error);
            UIUtils.showToast('Failed to load document details', 'error');
        }
    }
}
