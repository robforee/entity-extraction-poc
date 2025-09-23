#!/usr/bin/env node

/**
 * Test Runner - Runs API tests and UI functionality tests
 */

import APITestSuite from './api-test-suite.js';
import chalk from 'chalk';

async function runTests() {
    console.log(chalk.magenta('🚀 Universal Knowledge System - Test Runner'));
    console.log(chalk.magenta('=' .repeat(60)));
    
    // Check if server is running
    try {
        const response = await fetch('http://localhost:3000/api/health');
        if (!response.ok) {
            throw new Error('Server not responding');
        }
        console.log(chalk.green('✅ Server is running at http://localhost:3000'));
    } catch (error) {
        console.log(chalk.red('❌ Server is not running!'));
        console.log(chalk.yellow('Please start the server with: npm run viz:server'));
        process.exit(1);
    }
    
    // Run API tests
    console.log(chalk.cyan('\n🔧 Running API Tests...'));
    const apiSuite = new APITestSuite();
    const apiSuccess = await apiSuite.runAllTests();
    
    // Summary
    console.log(chalk.magenta('\n' + '=' .repeat(60)));
    console.log(chalk.magenta('🏁 Final Results'));
    console.log(chalk.magenta('=' .repeat(60)));
    
    if (apiSuccess) {
        console.log(chalk.green('🎉 All API tests passed!'));
        console.log(chalk.green('✅ System is ready for production'));
    } else {
        console.log(chalk.red('💥 Some tests failed!'));
        console.log(chalk.yellow('⚠️  Please fix failing tests before deployment'));
    }
    
    return apiSuccess;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const success = await runTests();
    process.exit(success ? 0 : 1);
}

export default runTests;
