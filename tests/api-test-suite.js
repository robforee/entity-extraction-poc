#!/usr/bin/env node

/**
 * Comprehensive API Test Suite for Universal Knowledge System
 * Tests all endpoints that serve the UI
 */

import { strict as assert } from 'assert';
import fetch from 'node-fetch';
import chalk from 'chalk';

class APITestSuite {
    constructor(baseUrl = 'http://localhost:3000') {
        this.baseUrl = baseUrl;
        this.testResults = [];
        this.totalTests = 0;
        this.passedTests = 0;
        this.failedTests = 0;
    }

    async runAllTests() {
        console.log(chalk.blue('🧪 Universal Knowledge System - API Test Suite'));
        console.log(chalk.blue('=' .repeat(60)));
        console.log();

        // Test categories
        await this.testHealthAndSystem();
        await this.testEntityEndpoints();
        await this.testRelationshipEndpoints();
        await this.testDocumentEndpoints();
        await this.testDomainEndpoints();
        await this.testMergingEndpoints();
        await this.testMergeHistoryEndpoints();
        await this.testExportEndpoints();

        this.printSummary();
        return this.failedTests === 0;
    }

    async test(name, testFn) {
        this.totalTests++;
        try {
            console.log(chalk.gray(`  Testing: ${name}`));
            await testFn();
            this.passedTests++;
            console.log(chalk.green(`  ✅ ${name}`));
            this.testResults.push({ name, status: 'PASS' });
        } catch (error) {
            this.failedTests++;
            console.log(chalk.red(`  ❌ ${name}: ${error.message}`));
            this.testResults.push({ name, status: 'FAIL', error: error.message });
        }
    }

    async request(method, endpoint, body = null) {
        const url = `${this.baseUrl}${endpoint}`;
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        
        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        const data = await response.json();
        
        return { response, data, status: response.status };
    }

    // Health and System Tests
    async testHealthAndSystem() {
        console.log(chalk.yellow('\n🏥 Health & System Tests'));
        
        await this.test('Health Check', async () => {
            const { data, status } = await this.request('GET', '/api/health');
            assert.equal(status, 200);
            assert.equal(data.status, 'healthy');
            assert(data.timestamp);
            assert(typeof data.connectedClients === 'number');
        });

        await this.test('Schema Endpoints', async () => {
            const { data, status } = await this.request('GET', '/api/schemas');
            assert.equal(status, 200);
            // Should return schema information
        });
    }

    // Entity Endpoints Tests
    async testEntityEndpoints() {
        console.log(chalk.yellow('\n👥 Entity Endpoints Tests'));

        await this.test('Get Entities', async () => {
            const { data, status } = await this.request('GET', '/api/entities');
            assert.equal(status, 200);
            assert(Array.isArray(data.entities));
            assert(data.pagination);
            assert(typeof data.pagination.total === 'number');
        });

        await this.test('Get Entities with Filters', async () => {
            const { data, status } = await this.request('GET', '/api/entities?page=0&limit=5&category=people');
            assert.equal(status, 200);
            assert(Array.isArray(data.entities));
            assert(data.entities.length <= 5);
        });

        await this.test('Get Entity Stats', async () => {
            const { data, status } = await this.request('GET', '/api/entities/stats');
            assert.equal(status, 200);
            assert(typeof data.total === 'number');
            assert(data.byCategory);
            assert(data.byConfidence);
        });

        await this.test('Get Entity Categories', async () => {
            const { data, status } = await this.request('GET', '/api/entities/categories');
            assert.equal(status, 200);
            assert(typeof data === 'object');
            // Should return category counts
        });
    }

    // Relationship Tests
    async testRelationshipEndpoints() {
        console.log(chalk.yellow('\n🕸️ Relationship Tests'));

        await this.test('Get Relationships', async () => {
            const { data, status } = await this.request('GET', '/api/relationships');
            assert.equal(status, 200);
            assert(data.success);
            assert(Array.isArray(data.nodes));
            assert(Array.isArray(data.relationships));
            
            // Validate node structure
            if (data.nodes.length > 0) {
                const node = data.nodes[0];
                assert(node.id);
                assert(node.name);
                assert(node.category);
            }
            
            // Validate relationship structure
            if (data.relationships.length > 0) {
                const rel = data.relationships[0];
                assert(rel.source);
                assert(rel.target);
                assert(rel.type);
            }
        });
    }

    // Document Tests
    async testDocumentEndpoints() {
        console.log(chalk.yellow('\n📄 Document Tests'));

        await this.test('Get Documents', async () => {
            const { data, status } = await this.request('GET', '/api/documents');
            assert.equal(status, 200);
            assert(Array.isArray(data.documents));
            assert(data.pagination);
        });

        // Test document details if documents exist
        await this.test('Get Document Details', async () => {
            const { data: docsData } = await this.request('GET', '/api/documents');
            if (docsData.documents && docsData.documents.length > 0) {
                const docId = docsData.documents[0].id;
                const { data, status } = await this.request('GET', `/api/documents/${docId}`);
                assert.equal(status, 200);
                assert(data.document);
            } else {
                console.log(chalk.gray('    Skipped: No documents available'));
            }
        });
    }

    // Domain Tests
    async testDomainEndpoints() {
        console.log(chalk.yellow('\n🌐 Domain Tests'));

        await this.test('Get Domains', async () => {
            const { data, status } = await this.request('GET', '/api/domains');
            assert.equal(status, 200);
            assert(Array.isArray(data));
            // Should have at least one domain
            assert(data.length > 0);
        });

        await this.test('Get Current Domain', async () => {
            const { data, status } = await this.request('GET', '/api/domains/current');
            assert.equal(status, 200);
            assert(data.domain);
        });

        await this.test('Switch Domain', async () => {
            const { data, status } = await this.request('POST', '/api/domains/switch', { domain: 'cybersec' });
            assert.equal(status, 200);
            assert(data.success);
        });
    }

    // Merging Tests
    async testMergingEndpoints() {
        console.log(chalk.yellow('\n🔄 Merging Tests'));

        await this.test('Get Merge Candidates', async () => {
            const { data, status } = await this.request('GET', '/api/merging/candidates');
            assert.equal(status, 200);
            assert(Array.isArray(data.candidates));
            assert(typeof data.total === 'number');
            assert(typeof data.autoMergeable === 'number');
        });

        await this.test('Get Merge Statistics', async () => {
            const { data, status } = await this.request('GET', '/api/merging/statistics');
            assert.equal(status, 200);
            // Should return merge statistics
        });

        await this.test('Manual Merge', async () => {
            const { data, status } = await this.request('POST', '/api/merging/manual-merge', {
                primaryId: 'test_1',
                secondaryId: 'test_2',
                action: 'merge'
            });
            assert.equal(status, 200);
            assert(data.success);
            assert(data.message);
        });

        await this.test('Preview Merge', async () => {
            const { data, status } = await this.request('POST', '/api/merging/preview-merge', {
                primaryId: 'test_1',
                secondaryId: 'test_2'
            });
            assert.equal(status, 200);
            assert(data.success);
            assert(data.preview);
        });

        await this.test('Reset Merged Pairs', async () => {
            const { data, status } = await this.request('POST', '/api/merging/reset');
            assert.equal(status, 200);
            assert(data.success);
            assert(typeof data.mergedPairsCount === 'number');
        });
    }

    // Merge History Tests
    async testMergeHistoryEndpoints() {
        console.log(chalk.yellow('\n📚 Merge History Tests'));

        await this.test('Get Merge History', async () => {
            const { data, status } = await this.request('GET', '/api/merging/history');
            assert.equal(status, 200);
            assert(Array.isArray(data.history));
            assert(data.pagination);
        });

        await this.test('Export Merge History', async () => {
            const { data, status } = await this.request('GET', '/api/merging/history/export');
            assert.equal(status, 200);
            // Should return export data
        });
    }

    // Export Tests
    async testExportEndpoints() {
        console.log(chalk.yellow('\n📤 Export Tests'));

        await this.test('Export Entities (JSON)', async () => {
            const { data, status } = await this.request('GET', '/api/export/entities?format=json');
            assert.equal(status, 200);
            assert(Array.isArray(data));
        });

        await this.test('Export Entities (CSV)', async () => {
            const { response, status } = await this.request('GET', '/api/export/entities?format=csv');
            assert.equal(status, 200);
            // CSV should be returned as text
        });
    }

    printSummary() {
        console.log();
        console.log(chalk.blue('=' .repeat(60)));
        console.log(chalk.blue('📊 Test Summary'));
        console.log(chalk.blue('=' .repeat(60)));
        
        console.log(`Total Tests: ${this.totalTests}`);
        console.log(chalk.green(`Passed: ${this.passedTests}`));
        console.log(chalk.red(`Failed: ${this.failedTests}`));
        console.log(`Success Rate: ${((this.passedTests / this.totalTests) * 100).toFixed(1)}%`);
        
        if (this.failedTests > 0) {
            console.log();
            console.log(chalk.red('❌ Failed Tests:'));
            this.testResults
                .filter(r => r.status === 'FAIL')
                .forEach(r => console.log(chalk.red(`  - ${r.name}: ${r.error}`)));
        }
        
        console.log();
        console.log(this.failedTests === 0 ? 
            chalk.green('🎉 All tests passed!') : 
            chalk.red('💥 Some tests failed!')
        );
    }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const suite = new APITestSuite();
    const success = await suite.runAllTests();
    process.exit(success ? 0 : 1);
}

export default APITestSuite;
