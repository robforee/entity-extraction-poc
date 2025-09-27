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

        UIUtils.showToast(`Network loaded: ${nodeArray.length} entities, ${validLinks.length} relationships`, 'success');
    }

    static getCategoryColor(category) {
        const colorMap = {
            'vulnerability': '#e74c3c',
            'threat': '#c0392b',
            'tool': '#3498db',
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
        
        return colorMap[category?.toLowerCase()] || colorMap.default;
    }
}
