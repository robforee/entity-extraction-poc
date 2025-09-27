/**
 * UI Utilities Module - Common UI functions and helpers
 */
class UIUtils {
    static showLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.style.display = 'flex';
    }

    static hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    static showToast(message, type = 'info', duration = 5000) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-message">${message}</span>
                <button class="toast-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;

        container.appendChild(toast);

        // Auto-remove after duration
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, duration);

        // Add click to dismiss
        toast.addEventListener('click', () => toast.remove());
    }

    static closeModal() {
        document.getElementById('entity-modal').style.display = 'none';
    }

    static capitalizeWords(str) {
        return str.replace(/\b\w/g, l => l.toUpperCase());
    }

    static formatDate(dateString) {
        if (!dateString) return 'Unknown';
        return new Date(dateString).toLocaleDateString();
    }

    static formatConfidence(confidence) {
        return `${(confidence * 100).toFixed(1)}%`;
    }

    static truncateText(text, maxLength = 100) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    static generateColorPalette(count) {
        const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#34495e', '#e67e22', '#95a5a6', '#f1c40f', '#8e44ad', '#2c3e50', '#27ae60', '#d35400', '#7f8c8d', '#c0392b', '#16a085', '#2980b9', '#8e44ad', '#f39c12', '#e74c3c', '#27ae60', '#3498db', '#e67e22', '#9b59b6', '#1abc9c', '#34495e', '#95a5a6', '#f1c40f', '#2c3e50', '#d35400', '#7f8c8d', '#c0392b', '#16a085', '#2980b9'];
        return Array.from({length: count}, (_, i) => colors[i % colors.length]);
    }

    static getDocumentName(source) {
        return source ? source.split('/').pop().replace(/\.(md|txt|json)$/, '') : 'Unknown Document';
    }

    static populateDomainSelector(app) {
        const domainSelect = document.getElementById('domain-select');
        if (!domainSelect) return;
        
        if (app.data.domains && app.data.domains.domains) {
            // Clear existing options
            domainSelect.innerHTML = '';
            
            app.data.domains.domains.forEach(domain => {
                const option = document.createElement('option');
                option.value = domain.name;
                
                // Add emoji and entity count
                let emoji = '📁';
                if (domain.name === 'cybersec') emoji = '🔒';
                else if (domain.name === 'construction') emoji = '🏗️';
                else if (domain.name === 'misc') emoji = '📁';
                
                option.textContent = `${emoji} ${domain.name.charAt(0).toUpperCase() + domain.name.slice(1)} (${domain.entityCount})`;
                
                if (domain.name === app.data.domains.current) {
                    option.selected = true;
                }
                
                domainSelect.appendChild(option);
            });
        }
    }

    static populateFilterOptions(app) {
        const categoryFilter = document.getElementById('category-filter');
        const searchCategory = document.getElementById('search-category');
        
        if (categoryFilter) {
            categoryFilter.innerHTML = '<option value="">All Categories</option>';
        }
        
        if (searchCategory) {
            searchCategory.innerHTML = '<option value="">All Categories</option>';
        }
        
        Object.keys(app.data.categories).forEach(category => {
            if (categoryFilter) {
                const option1 = new Option(UIUtils.capitalizeWords(category), category);
                categoryFilter.add(option1);
            }
            
            if (searchCategory) {
                const option2 = new Option(UIUtils.capitalizeWords(category), category);
                searchCategory.add(option2);
            }
        });
    }
}
