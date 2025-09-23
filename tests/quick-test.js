#!/usr/bin/env node

/**
 * Quick Test - Fast endpoint validation
 */

import chalk from 'chalk';

const BASE_URL = 'http://localhost:3000';

const ENDPOINTS = [
    'GET /api/health',
    'GET /api/entities',
    'GET /api/entities/stats', 
    'GET /api/entities/categories',
    'GET /api/relationships',
    'GET /api/documents',
    'GET /api/domains',
    'GET /api/domains/current',
    'GET /api/merging/candidates',
    'GET /api/merging/statistics'
];

async function quickTest() {
    console.log(chalk.blue('⚡ Quick API Test'));
    console.log(chalk.blue('=' .repeat(40)));
    
    let passed = 0;
    let failed = 0;
    
    for (const endpoint of ENDPOINTS) {
        const [method, path] = endpoint.split(' ');
        try {
            const response = await fetch(`${BASE_URL}${path}`);
            const status = response.status;
            
            if (status === 200) {
                console.log(chalk.green(`✅ ${endpoint} (${status})`));
                passed++;
            } else {
                console.log(chalk.yellow(`⚠️  ${endpoint} (${status})`));
                failed++;
            }
        } catch (error) {
            console.log(chalk.red(`❌ ${endpoint} (ERROR: ${error.message})`));
            failed++;
        }
    }
    
    console.log(chalk.blue('\n' + '=' .repeat(40)));
    console.log(`Results: ${chalk.green(passed + ' passed')}, ${chalk.red(failed + ' failed')}`);
    
    return failed === 0;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const success = await quickTest();
    process.exit(success ? 0 : 1);
}

export default quickTest;
