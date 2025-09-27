/**
 * Dashboard Module - Dashboard view rendering and charts
 */
class Dashboard {
    static renderDashboard(app) {
        Dashboard.updateStats(app);
        Dashboard.renderCategoriesChart(app);
        Dashboard.renderRecentEntities(app);
        Dashboard.renderConfidenceChart(app);
    }

    static updateStats(app) {
        const stats = app.data.stats;
        document.getElementById('total-entities').textContent = stats.totalEntities || 0;
        document.getElementById('total-documents').textContent = stats.totalDocuments || 0;
        document.getElementById('total-categories').textContent = stats.totalCategories || Object.keys(app.data.categories).length || 0;
        const avgConfidence = Dashboard.calculateAverageConfidence(app);
        document.getElementById('avg-confidence').textContent = `${(avgConfidence * 100).toFixed(1)}%`;
    }

    static calculateAverageConfidence(app) {
        if (!Array.isArray(app.data.entities) || !app.data.entities.length) return 0;
        const sum = app.data.entities.reduce((acc, entity) => acc + (entity.confidence || 0), 0);
        return sum / app.data.entities.length;
    }

    static renderCategoriesChart(app) {
        try {
            const canvas = document.getElementById('categories-chart');
            if (!canvas) {
                console.warn('Categories chart canvas not found');
                return;
            }
            const ctx = canvas.getContext('2d');
            
            if (app.charts.categories) app.charts.categories.destroy();

        const categories = app.data.categories;
        const labels = Object.keys(categories);
        const data = Object.values(categories);
        const colors = UIUtils.generateColorPalette(labels.length);

        app.charts.categories = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels.map(label => UIUtils.capitalizeWords(label)),
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
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
        } catch (error) {
            console.error('Error rendering categories chart:', error);
        }
    }

    static renderRecentEntities(app) {
        const container = document.getElementById('recent-entities');
        if (!container) return;

        // Ensure entities is an array
        if (!Array.isArray(app.data.entities)) {
            console.warn('Entities data is not an array:', app.data.entities);
            container.innerHTML = '<p class="placeholder">No entities available</p>';
            return;
        }

        const recentEntities = app.data.entities
            .sort((a, b) => new Date(b.createdAt || b.timestamp || 0) - new Date(a.createdAt || a.timestamp || 0))
            .slice(0, 10);

        container.innerHTML = recentEntities.map(entity => `
            <div class="recent-entity-item">
                <div class="entity-info">
                    <h4>${entity.name}</h4>
                    <p class="entity-category">${UIUtils.capitalizeWords(entity.category)}</p>
                    <p class="entity-confidence">Confidence: ${UIUtils.formatConfidence(entity.confidence)}</p>
                </div>
                <div class="entity-meta">
                    <small class="entity-date">${UIUtils.formatDate(entity.createdAt)}</small>
                    <small class="entity-source">${UIUtils.getDocumentName(entity.metadata?.source)}</small>
                </div>
            </div>
        `).join('');
    }

    static renderConfidenceChart(app) {
        try {
            const canvas = document.getElementById('confidence-chart');
            if (!canvas) {
                console.warn('Confidence chart canvas not found');
                return;
            }
            const ctx = canvas.getContext('2d');
            
            if (app.charts.confidence) app.charts.confidence.destroy();

        // Create confidence distribution
        const confidenceBuckets = {
            'Very High (90-100%)': 0,
            'High (80-89%)': 0,
            'Medium (60-79%)': 0,
            'Low (40-59%)': 0,
            'Very Low (0-39%)': 0
        };

        if (Array.isArray(app.data.entities)) {
            app.data.entities.forEach(entity => {
                const confidence = (entity.confidence || 0) * 100;
                if (confidence >= 90) confidenceBuckets['Very High (90-100%)']++;
                else if (confidence >= 80) confidenceBuckets['High (80-89%)']++;
                else if (confidence >= 60) confidenceBuckets['Medium (60-79%)']++;
                else if (confidence >= 40) confidenceBuckets['Low (40-59%)']++;
                else confidenceBuckets['Very Low (0-39%)']++;
            });
        }

        app.charts.confidence = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(confidenceBuckets),
                datasets: [{
                    label: 'Number of Entities',
                    data: Object.values(confidenceBuckets),
                    backgroundColor: [
                        '#27ae60', // Very High - Green
                        '#2ecc71', // High - Light Green
                        '#f39c12', // Medium - Orange
                        '#e67e22', // Low - Dark Orange
                        '#e74c3c'  // Very Low - Red
                    ],
                    borderWidth: 1,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.parsed.y} entities`;
                            }
                        }
                    }
                }
            }
        });
        } catch (error) {
            console.error('Error rendering confidence chart:', error);
        }
    }
}
