/**
 * Network Visualization Module - D3.js network graph functionality
 */
class NetworkVisualization {
    static async renderNetwork(app) {
        try {
            app.showLoading();
            
            // Load both relationships and categories data
            const [relationshipsResponse, categoriesResponse] = await Promise.all([
                fetch(`${app.apiBaseUrl}/api/relationships`),
                fetch(`${app.apiBaseUrl}/api/entities/categories`)
            ]);
            
            const data = await relationshipsResponse.json();
            const categoriesData = await categoriesResponse.json();
            
            // Store categories data for color mapping
            app.data.categories = categoriesData;
            
            console.log('Network data received:', data);
            console.log('Categories data received:', categoriesData);
            
            if (!data.success || !data.nodes || (!data.links && !data.relationships)) {
                console.log('No relationships data or invalid format:', data);
                UIUtils.showToast('No network data available', 'warning');
                return;
            }

            // Handle both 'links' and 'relationships' properties
            const rawLinks = data.links || data.relationships || [];
            
            // Filter out invalid relationships
            const validLinks = rawLinks.filter(link => 
                link && link.source && link.target && 
                typeof link.source === 'string' && typeof link.target === 'string'
            );
            
            app.data.relationships = validLinks;
            app.data.networkNodes = data.nodes;
            
            console.log('Sample node:', data.nodes[0]);
            console.log('Sample relationship:', validLinks[0]);
            
            console.log(`Filtered ${rawLinks.length - validLinks.length} invalid relationships`);
            
            if (app.data.relationships.length === 0) {
                UIUtils.showToast('No relationships found in data', 'info');
                return;
            }

            NetworkVisualization.createNetworkVisualization(app);
            
        } catch (error) {
            console.error('Error loading network data:', error);
            UIUtils.showToast('Failed to load network data', 'error');
        } finally {
            app.hideLoading();
        }
    }

    static createNetworkVisualization(app) {
        const container = document.getElementById('network-container');
        if (!container) return;

        // Clear existing visualization
        container.innerHTML = '';

        const width = container.clientWidth || 800;
        const height = container.clientHeight || 600;

        // Create SVG
        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const g = svg.append('g');

        // Prepare data
        const nodeArray = app.data.networkNodes || [];
        const linkArray = app.data.relationships || [];

        // Create node and link maps for quick lookup
        const nodeMap = new Map();
        nodeArray.forEach(node => nodeMap.set(node.id, node));

        // Filter links to only include those with valid nodes
        const validLinks = linkArray.filter(link => 
            nodeMap.has(link.source) && nodeMap.has(link.target)
        );

        console.log(`Using ${nodeArray.length} nodes and ${validLinks.length} links`);
        
        // Log color mapping for debugging
        const categories = [...new Set(nodeArray.map(n => n.category))];
        console.log('Category color mapping:');
        categories.forEach(cat => {
            console.log(`${cat}: ${NetworkVisualization.getCategoryColor(cat)}`);
        });

        // Create force simulation optimized for clustering with better spacing
        const simulation = d3.forceSimulation(nodeArray)
            .force('link', d3.forceLink(validLinks)
                .id(d => d.id)
                .distance(d => {
                    // Vary link distance based on relationship strength
                    const strength = d.strength || 0.5;
                    return 50 + (1 - strength) * 100; // 50-150px range
                })
                .strength(0.3)
            )
            .force('charge', d3.forceManyBody()
                .strength(d => {
                    // Stronger repulsion for nodes with more connections
                    const connections = validLinks.filter(l => l.source.id === d.id || l.target.id === d.id).length;
                    return -200 - (connections * 20); // More connected nodes repel more
                })
            )
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide()
                .radius(d => {
                    // Collision radius based on confidence and connections
                    const connections = validLinks.filter(l => l.source.id === d.id || l.target.id === d.id).length;
                    return 15 + Math.sqrt(connections) * 3 + (d.confidence || 0.5) * 10;
                })
                .strength(0.8)
            );

        // Create links
        const link = g.append('g')
            .attr('class', 'links')
            .selectAll('line')
            .data(validLinks)
            .enter().append('line')
            .attr('class', 'link')
            .attr('stroke', '#999')
            .attr('stroke-opacity', d => Math.max(0.2, d.strength || 0.5))
            .attr('stroke-width', d => Math.max(1, (d.strength || 0.5) * 4));

        // Create nodes
        const node = g.append('g')
            .attr('class', 'nodes')
            .selectAll('circle')
            .data(nodeArray)
            .enter().append('circle')
            .attr('class', 'node')
            .attr('r', d => {
                const connections = validLinks.filter(l => l.source.id === d.id || l.target.id === d.id).length;
                return 8 + Math.sqrt(connections) * 2 + (d.confidence || 0.5) * 5;
            })
            .attr('fill', d => NetworkVisualization.getCategoryColor(d.category))
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));

        // Add labels
        const labels = g.append('g')
            .attr('class', 'labels')
            .selectAll('text')
            .data(nodeArray)
            .enter().append('text')
            .attr('class', 'node-label')
            .attr('dx', 12)
            .attr('dy', '.35em')
            .style('font-size', '12px')
            .style('fill', '#333')
            .text(d => d.name.length > 20 ? d.name.substring(0, 20) + '...' : d.name);

        // Add tooltips
        node.append('title')
            .text(d => `${d.name}\nCategory: ${d.category}\nConfidence: ${(d.confidence * 100).toFixed(0)}%`);

        // Add zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        svg.call(zoom);

        // Update positions on simulation tick
        simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);

            labels
                .attr('x', d => d.x)
                .attr('y', d => d.y);
        });

        // Drag functions
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

        // Store references
        app.networkSimulation = simulation;
        app.networkSvg = svg;

        // Update legend
        NetworkVisualization.updateLegend(app);

        // Initialize network controls
        NetworkVisualization.initializeControls(app);

        UIUtils.showToast(`Network loaded: ${nodeArray.length} entities, ${validLinks.length} relationships`, 'success');
    }

    static initializeControls(app) {
        // Initialize category filter
        const categoryFilter = document.getElementById('network-category-filter');
        if (categoryFilter) {
            // Populate category options
            const categories = new Set();
            if (app.data.networkNodes) {
                app.data.networkNodes.forEach(node => {
                    if (node.category) categories.add(node.category);
                });
            }

            // Clear existing options except "All Categories"
            categoryFilter.innerHTML = '<option value="">All Categories</option>';
            
            // Add category options
            Array.from(categories).sort().forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = UIUtils.capitalizeWords(category);
                categoryFilter.appendChild(option);
            });

            // Add change event listener
            categoryFilter.addEventListener('change', (e) => {
                NetworkVisualization.filterByCategory(app, e.target.value);
            });
        }

        // Initialize zoom center button
        const zoomCenterBtn = document.getElementById('zoom-center');
        if (zoomCenterBtn) {
            zoomCenterBtn.addEventListener('click', () => {
                NetworkVisualization.centerNetwork(app);
            });
        }

        // Initialize perspective buttons
        const siemPerspectiveBtn = document.getElementById('siem-perspective');
        if (siemPerspectiveBtn) {
            siemPerspectiveBtn.addEventListener('click', () => {
                NetworkVisualization.showSIEMPerspective(app);
            });
        }

        const entityPerspectiveBtn = document.getElementById('entity-perspective');
        if (entityPerspectiveBtn) {
            entityPerspectiveBtn.addEventListener('click', () => {
                NetworkVisualization.showEntityPerspective(app);
            });
        }

        // Initialize network sliders
        NetworkVisualization.initializeSliders(app);
    }

    static filterByCategory(app, selectedCategory) {
        if (!app.networkSvg) return;

        const nodes = app.networkSvg.selectAll('.node');
        const labels = app.networkSvg.selectAll('.node-label');
        const links = app.networkSvg.selectAll('.link');

        if (!selectedCategory) {
            // Show all nodes and links
            nodes.style('opacity', 1).style('pointer-events', 'all');
            labels.style('opacity', 1);
            links.style('opacity', 0.6);
        } else {
            // Filter nodes by category
            nodes.style('opacity', d => d.category === selectedCategory ? 1 : 0.1)
                 .style('pointer-events', d => d.category === selectedCategory ? 'all' : 'none');
            
            labels.style('opacity', d => d.category === selectedCategory ? 1 : 0.1);

            // Filter links - show only links between visible nodes
            links.style('opacity', d => {
                const sourceNode = app.data.networkNodes.find(n => n.id === d.source.id || n.id === d.source);
                const targetNode = app.data.networkNodes.find(n => n.id === d.target.id || n.id === d.target);
                return (sourceNode?.category === selectedCategory && targetNode?.category === selectedCategory) ? 0.6 : 0.1;
            });
        }

        UIUtils.showToast(`Filtered network by: ${selectedCategory || 'All Categories'}`, 'info');
    }

    static centerNetwork(app) {
        if (!app.networkSvg) return;

        const svg = d3.select('#network-svg');
        const g = svg.select('g');
        
        // Reset zoom and center
        const zoom = d3.zoom()
            .scaleExtent([0.1, 10])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        svg.call(zoom);
        svg.call(zoom.transform, d3.zoomIdentity);

        UIUtils.showToast('Network centered', 'info');
    }

    static showSIEMPerspective(app) {
        if (!app.networkSvg) return;

        // Focus on security-related categories
        const securityCategories = ['materials', 'issues', 'tasks'];
        const nodes = app.networkSvg.selectAll('.node');
        const labels = app.networkSvg.selectAll('.node-label');
        const links = app.networkSvg.selectAll('.link');

        // Highlight security-related nodes
        nodes.style('opacity', d => securityCategories.includes(d.category) ? 1 : 0.2)
             .style('stroke-width', d => securityCategories.includes(d.category) ? 3 : 2)
             .style('stroke', d => securityCategories.includes(d.category) ? '#e74c3c' : '#fff');

        labels.style('opacity', d => securityCategories.includes(d.category) ? 1 : 0.3)
              .style('font-weight', d => securityCategories.includes(d.category) ? 'bold' : 'normal');

        // Show links between security nodes
        links.style('opacity', d => {
            const sourceNode = app.data.networkNodes.find(n => n.id === d.source.id || n.id === d.source);
            const targetNode = app.data.networkNodes.find(n => n.id === d.target.id || n.id === d.target);
            const isSecurityLink = securityCategories.includes(sourceNode?.category) || securityCategories.includes(targetNode?.category);
            return isSecurityLink ? 0.8 : 0.1;
        });

        UIUtils.showToast('SIEM Perspective: Highlighting security-related entities', 'info');
    }

    static showEntityPerspective(app) {
        const searchInput = document.getElementById('entity-search');
        const searchTerm = searchInput?.value.trim().toLowerCase();
        
        if (!searchTerm) {
            UIUtils.showToast('Please enter an entity name to focus on', 'warning');
            return;
        }

        if (!app.networkSvg) return;

        const nodes = app.networkSvg.selectAll('.node');
        const labels = app.networkSvg.selectAll('.node-label');
        const links = app.networkSvg.selectAll('.link');

        // Find matching entities
        const matchingNodes = app.data.networkNodes.filter(node => 
            node.name.toLowerCase().includes(searchTerm)
        );

        if (matchingNodes.length === 0) {
            UIUtils.showToast(`No entities found matching "${searchTerm}"`, 'warning');
            return;
        }

        const matchingIds = new Set(matchingNodes.map(n => n.id));

        // Highlight matching nodes and their connections
        nodes.style('opacity', d => matchingIds.has(d.id) ? 1 : 0.2)
             .style('stroke-width', d => matchingIds.has(d.id) ? 4 : 2)
             .style('stroke', d => matchingIds.has(d.id) ? '#f39c12' : '#fff');

        labels.style('opacity', d => matchingIds.has(d.id) ? 1 : 0.3)
              .style('font-weight', d => matchingIds.has(d.id) ? 'bold' : 'normal');

        // Show links connected to matching entities
        links.style('opacity', d => {
            const sourceId = d.source.id || d.source;
            const targetId = d.target.id || d.target;
            return (matchingIds.has(sourceId) || matchingIds.has(targetId)) ? 0.8 : 0.1;
        });

        UIUtils.showToast(`Entity Perspective: Found ${matchingNodes.length} matching entities`, 'success');
    }

    static initializeSliders(app) {
        // Link Distance Slider
        const linkDistanceSlider = document.getElementById('cluster-distance');
        const linkDistanceValue = document.getElementById('cluster-distance-value');
        if (linkDistanceSlider && linkDistanceValue) {
            linkDistanceSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                linkDistanceValue.textContent = `${value}px`;
                if (app.networkSimulation) {
                    app.networkSimulation.force('link').distance(parseInt(value));
                    app.networkSimulation.alpha(0.3).restart();
                }
            });
        }

        // Cloud Separation Slider
        const cloudSeparationSlider = document.getElementById('inter-cluster-distance');
        const cloudSeparationValue = document.getElementById('inter-cluster-distance-value');
        if (cloudSeparationSlider && cloudSeparationValue) {
            cloudSeparationSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                cloudSeparationValue.textContent = value;
                if (app.networkSimulation) {
                    app.networkSimulation.force('charge').strength(-parseInt(value));
                    app.networkSimulation.alpha(0.3).restart();
                }
            });
        }

        // Entity Font Size Slider
        const entityFontSlider = document.getElementById('entity-font-size');
        const entityFontValue = document.getElementById('entity-font-size-value');
        if (entityFontSlider && entityFontValue) {
            entityFontSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                entityFontValue.textContent = `${value}px`;
                if (app.networkSvg) {
                    app.networkSvg.selectAll('.node-label')
                        .style('font-size', `${value}px`);
                }
            });
        }

        // Cluster Font Size Slider
        const clusterFontSlider = document.getElementById('cluster-font-size');
        const clusterFontValue = document.getElementById('cluster-font-size-value');
        if (clusterFontSlider && clusterFontValue) {
            clusterFontSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                clusterFontValue.textContent = `${value}px`;
                if (app.networkSvg) {
                    app.networkSvg.selectAll('.cluster-label')
                        .style('font-size', `${value}px`);
                }
            });
        }
    }

    static getCategoryColor(category) {
        const colorMap = {
            // Actual categories from the data
            'people': '#f39c12',        // Orange for people
            'projects': '#3498db',      // Blue for projects
            'locations': '#1abc9c',     // Teal for locations
            'materials': '#e74c3c',     // Red for materials/equipment
            'documents': '#9b59b6',     // Purple for documents
            'issues': '#e67e22',        // Orange-red for issues
            'tasks': '#27ae60',         // Green for tasks
            'decisions': '#f1c40f',     // Yellow for decisions
            'timeline': '#95a5a6',      // Gray for timeline
            
            // Legacy categories (in case they exist)
            'vulnerability': '#e74c3c',
            'threat': '#c0392b',
            'tool': '#34495e',
            'technique': '#9b59b6',
            'organization': '#2ecc71',
            'person': '#f39c12',
            'location': '#1abc9c',
            'technology': '#34495e',
            'malware': '#8e44ad',
            'attack': '#e67e22',
            'defense': '#27ae60',
            'protocol': '#2980b9',
            'standard': '#f1c40f',
            'framework': '#95a5a6',
            'default': '#7f8c8d'
        };
        
        const color = colorMap[category?.toLowerCase()] || colorMap.default;
        console.log(`Color mapping: ${category} -> ${color}`);
        return color;
    }

    static updateLegend(app) {
        const legendContainer = document.getElementById('legend-items');
        if (!legendContainer) {
            console.warn('Legend container not found');
            return;
        }

        // Get unique categories from the current network nodes
        const categories = new Set();
        if (app.data.networkNodes) {
            app.data.networkNodes.forEach(node => {
                if (node.category) {
                    categories.add(node.category);
                }
            });
        }

        // If no categories from nodes, use the categories data
        if (categories.size === 0 && app.data.categories) {
            Object.keys(app.data.categories).forEach(cat => categories.add(cat));
        }

        console.log('Legend categories:', Array.from(categories));
        console.log('Network nodes sample:', app.data.networkNodes?.slice(0, 3));

        // Create legend items
        const legendItems = Array.from(categories).sort().map(category => {
            const color = NetworkVisualization.getCategoryColor(category);
            const count = app.data.categories ? app.data.categories[category] || 0 : 0;
            
            return `
                <div class="legend-item" data-category="${category}" style="cursor: pointer;">
                    <div class="legend-color" style="background-color: ${color}"></div>
                    <span class="legend-label">${UIUtils.capitalizeWords(category)}</span>
                    <span class="legend-count">(${count})</span>
                </div>
            `;
        }).join('');

        legendContainer.innerHTML = legendItems;

        // Add click handlers to legend items
        legendContainer.querySelectorAll('.legend-item').forEach(item => {
            item.addEventListener('click', () => {
                const category = item.dataset.category;
                console.log(`Legend item clicked: ${category}`);
                NetworkVisualization.toggleCategoryVisibility(app, category, item);
            });
        });
    }

    static toggleCategoryVisibility(app, category, legendItem) {
        if (!app.networkSvg) {
            console.error('No network SVG found');
            return;
        }

        console.log(`Toggling category: ${category}`);
        console.log('Legend item:', legendItem);
        console.log('Network SVG:', app.networkSvg);

        // Check if category is currently hidden
        const isHidden = legendItem.classList.contains('category-hidden');
        console.log(`Category ${category} is currently hidden: ${isHidden}`);
        
        const nodes = app.networkSvg.selectAll('.node');
        const labels = app.networkSvg.selectAll('.node-label');
        const links = app.networkSvg.selectAll('.link');

        if (isHidden) {
            // Show the category
            legendItem.classList.remove('category-hidden');
            legendItem.style.opacity = '1';
            
            nodes.filter(d => d.category === category)
                 .style('opacity', 1)
                 .style('pointer-events', 'all');
                 
            labels.filter(d => d.category === category)
                  .style('opacity', 1);

            // Show relevant links
            links.style('opacity', d => {
                const sourceNode = app.data.networkNodes.find(n => n.id === d.source.id || n.id === d.source);
                const targetNode = app.data.networkNodes.find(n => n.id === d.target.id || n.id === d.target);
                
                // If both nodes are visible, show the link
                const sourceVisible = !document.querySelector(`[data-category="${sourceNode?.category}"]`)?.classList.contains('category-hidden');
                const targetVisible = !document.querySelector(`[data-category="${targetNode?.category}"]`)?.classList.contains('category-hidden');
                
                return (sourceVisible && targetVisible) ? 0.6 : 0.1;
            });

            UIUtils.showToast(`Showing ${UIUtils.capitalizeWords(category)} entities`, 'info');
        } else {
            // Hide the category
            legendItem.classList.add('category-hidden');
            legendItem.style.opacity = '0.5';
            
            nodes.filter(d => d.category === category)
                 .style('opacity', 0.1)
                 .style('pointer-events', 'none');
                 
            labels.filter(d => d.category === category)
                  .style('opacity', 0.1);

            // Update links visibility
            links.style('opacity', d => {
                const sourceNode = app.data.networkNodes.find(n => n.id === d.source.id || n.id === d.source);
                const targetNode = app.data.networkNodes.find(n => n.id === d.target.id || n.id === d.target);
                
                // If either node is hidden, dim the link
                const sourceVisible = !document.querySelector(`[data-category="${sourceNode?.category}"]`)?.classList.contains('category-hidden');
                const targetVisible = !document.querySelector(`[data-category="${targetNode?.category}"]`)?.classList.contains('category-hidden');
                
                return (sourceVisible && targetVisible) ? 0.6 : 0.1;
            });

            UIUtils.showToast(`Hiding ${UIUtils.capitalizeWords(category)} entities`, 'info');
        }
    }
}
