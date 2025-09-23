#!/usr/bin/env node

import { RequestTracker } from '../src/utils/request-tracker.js';
import chalk from 'chalk';

/**
 * Request Lookup CLI Tool
 * 
 * Look up specific API requests by time or ID to see prompt/response details
 */
class RequestLookup {
    constructor() {
        this.tracker = new RequestTracker();
    }

    async init() {
        await this.tracker.loadExistingRequests();
    }

    async lookupByTime(timeStr) {
        console.log(chalk.blue.bold(`🔍 Looking up request at: ${timeStr}`));
        
        const request = this.tracker.findRequestByTime(timeStr);
        this.tracker.printRequestDetails(request);
    }

    async lookupById(requestId) {
        console.log(chalk.blue.bold(`🔍 Looking up request ID: ${requestId}`));
        console.log(chalk.gray(`Total requests loaded: ${this.tracker.requests.length}`));
        
        if (this.tracker.requests.length > 0) {
            const lastRequest = this.tracker.requests[this.tracker.requests.length - 1];
            console.log(chalk.gray(`Last request ID: ${lastRequest.id}`));
        }
        
        const request = this.tracker.requests.find(req => 
            req.id === requestId || req.id.includes(requestId)
        );
        this.tracker.printRequestDetails(request);
    }

    async listRecent(limit = 10) {
        console.log(chalk.blue.bold(`📋 Recent ${limit} requests:`));
        this.tracker.printDetailedRequestLog(limit);
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log(chalk.blue.bold('Request Lookup CLI'));
        console.log(chalk.white('\nUsage: node request-lookup.js [options]'));
        console.log(chalk.white('\nOptions:'));
        console.log(chalk.white('  --time "MM/DD HH:MM:SS"  Look up request by time'));
        console.log(chalk.white('  --id <request-id>        Look up request by ID'));
        console.log(chalk.white('  --recent [limit]         Show recent requests (default: 10)'));
        console.log(chalk.white('  --help, -h               Show this help'));
        console.log(chalk.white('\nExamples:'));
        console.log(chalk.gray('  node request-lookup.js --time "09/21 21:04:16"'));
        console.log(chalk.gray('  node request-lookup.js --id req_1758505797550'));
        console.log(chalk.gray('  node request-lookup.js --recent 5'));
        return;
    }
    
    const lookup = new RequestLookup();
    await lookup.init(); // Initialize and load requests
    
    // Parse arguments
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--time':
                const timeStr = args[++i];
                if (timeStr) {
                    await lookup.lookupByTime(timeStr);
                } else {
                    console.error(chalk.red('❌ Time string required'));
                }
                return;
                
            case '--id':
                const requestId = args[++i];
                if (requestId) {
                    await lookup.lookupById(requestId);
                } else {
                    console.error(chalk.red('❌ Request ID required'));
                }
                return;
                
            case '--recent':
                const limit = parseInt(args[i + 1]) || 10;
                if (!isNaN(parseInt(args[i + 1]))) i++; // Skip the number if provided
                await lookup.listRecent(limit);
                return;
        }
    }
    
    // Default action - show recent requests
    await lookup.listRecent();
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default RequestLookup;
