#!/usr/bin/env node

import express from 'express';
import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { MockDiffMem } from '../diffmem/mock-diffmem.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Simple Visualization Server for Universal Knowledge System
 * Serves extracted cybersecurity entities via web interface
 */
class VizServer {
    constructor(port = 3000) {
        this.port = port;
        this.app = express();
        this.diffmem = new MockDiffMem();
        
        this.setupRoutes();
    }

    setupRoutes() {
        this.app.use(express.json());
        
        // API endpoint to get entity statistics
        this.app.get('/api/stats', async (req, res) => {
            try {
                const entities = await this.diffmem.getAllEntities();
                const stats = this.calculateStats(entities);
                res.json(stats);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Simple HTML interface
        this.app.get('/', (req, res) => {
            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>UKS - Cybersecurity Corpus</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
                        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; }
                        h1 { color: #333; text-align: center; }
                        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
                        .stat-card { background: #667eea; color: white; padding: 20px; border-radius: 6px; text-align: center; }
                        .stat-number { font-size: 2em; font-weight: bold; }
                        .stat-label { margin-top: 10px; opacity: 0.9; }
                        .refresh-btn { background: #667eea; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>🧠 Universal Knowledge System</h1>
                        <h2>Cybersecurity Corpus Explorer</h2>
                        
                        <button class="refresh-btn" onclick="loadStats()">🔄 Refresh Stats</button>
                        
                        <div id="stats" class="stats">
                            <div class="stat-card">
                                <div class="stat-number" id="total-entities">-</div>
                                <div class="stat-label">Total Entities</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-number" id="total-documents">-</div>
                                <div class="stat-label">Documents</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-number" id="total-categories">-</div>
                                <div class="stat-label">Categories</div>
                            </div>
                        </div>
                        
                        <div id="categories"></div>
                    </div>
                    
                    <script>
                        async function loadStats() {
                            try {
                                const response = await fetch('/api/stats');
                                const stats = await response.json();
                                
                                document.getElementById('total-entities').textContent = stats.totalEntities;
                                document.getElementById('total-documents').textContent = stats.totalDocuments;
                                document.getElementById('total-categories').textContent = stats.totalCategories;
                                
                                // Show category breakdown
                                const categoriesHtml = Object.entries(stats.categories)
                                    .map(([cat, count]) => \`<p><strong>\${cat}:</strong> \${count} entities</p>\`)
                                    .join('');
                                document.getElementById('categories').innerHTML = '<h3>Entity Categories:</h3>' + categoriesHtml;
                                
                            } catch (error) {
                                alert('Error loading stats: ' + error.message);
                            }
                        }
                        
                        // Load stats on page load
                        loadStats();
                    </script>
                </body>
                </html>
            `);
        });
    }

    calculateStats(entities) {
        let totalEntities = 0;
        let totalDocuments = entities.length;
        const categories = {};
        
        for (const entitySet of entities) {
            if (entitySet.entities) {
                for (const [category, entityList] of Object.entries(entitySet.entities)) {
                    if (Array.isArray(entityList)) {
                        const count = entityList.length;
                        totalEntities += count;
                        categories[category] = (categories[category] || 0) + count;
                    }
                }
            }
        }
        
        return {
            totalEntities,
            totalDocuments,
            totalCategories: Object.keys(categories).length,
            categories
        };
    }

    start() {
        this.app.listen(this.port, () => {
            console.log(chalk.green.bold('🚀 Universal Knowledge System - Visualization Server'));
            console.log(chalk.cyan(`📊 Server running at: http://localhost:${this.port}`));
            console.log(chalk.white('🔍 Explore your cybersecurity knowledge corpus!'));
            console.log(chalk.gray('Press Ctrl+C to stop the server\n'));
        });
    }
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const server = new VizServer();
    server.start();
}

export default VizServer;
