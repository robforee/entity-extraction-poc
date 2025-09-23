#!/usr/bin/env node

import CloudLLMExtractor from '../src/extractors/cloud-llm-extractor.js';
import LocalLLMExtractor from '../src/extractors/local-llm-extractor.js';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';

/**
 * Accuracy evaluation framework for entity extraction
 * 
 * Tests both local and cloud extractors against ground truth data
 * and generates accuracy metrics.
 */
class AccuracyEvaluator {
    constructor() {
        this.cloudExtractor = new CloudLLMExtractor({ provider: 'openai' });
        this.localExtractor = new LocalLLMExtractor();
        this.testData = [];
        this.results = {
            cloud: { successes: 0, failures: 0, totalEntities: 0, correctEntities: 0 },
            local: { successes: 0, failures: 0, totalEntities: 0, correctEntities: 0 }
        };
    }

    async loadTestData() {
        const spinner = ora('Loading test data...').start();
        
        try {
            // Load sample conversations
            const conversationsPath = path.join(process.cwd(), 'data/input/sample-conversations.txt');
            const conversationsText = await fs.readFile(conversationsPath, 'utf8');
            
            // Parse conversations into test cases
            this.testData = this.parseConversations(conversationsText);
            
            spinner.succeed(`Loaded ${this.testData.length} test cases`);
            return this.testData;
        } catch (error) {
            spinner.fail(`Failed to load test data: ${error.message}`);
            
            // Create minimal test data if file doesn't exist
            this.testData = this.createMinimalTestData();
            spinner.warn(`Using minimal test data (${this.testData.length} cases)`);
            return this.testData;
        }
    }

    parseConversations(text) {
        const testCases = [];
        const sections = text.split(/## /);
        
        for (const section of sections) {
            if (section.trim().length === 0) continue;
            
            const lines = section.split('\n');
            const title = lines[0].trim();
            const content = lines.slice(1).join('\n').trim();
            
            if (content.length > 50) { // Only include substantial content
                testCases.push({
                    id: `test_${testCases.length + 1}`,
                    title,
                    text: content,
                    type: this.inferCommunicationType(title, content),
                    expectedEntities: this.generateExpectedEntities(content)
                });
            }
        }
        
        return testCases;
    }

    inferCommunicationType(title, content) {
        if (title.toLowerCase().includes('sms') || title.toLowerCase().includes('text')) {
            return 'sms';
        } else if (title.toLowerCase().includes('email')) {
            return 'email';
        } else if (title.toLowerCase().includes('meeting') || title.toLowerCase().includes('notes')) {
            return 'meeting_notes';
        }
        return 'sms'; // default
    }

    generateExpectedEntities(text) {
        // Simple heuristic-based expected entity generation
        // In a real scenario, this would be manually labeled ground truth
        const expected = {
            people: [],
            projects: [],
            decisions: [],
            timeline: [],
            costs: []
        };

        // Look for common names
        const nameMatches = text.match(/\b(Rob|Mike|Sarah|John|Mary|David|Lisa)\b/g) || [];
        for (const name of [...new Set(nameMatches)]) {
            expected.people.push({ name, confidence: 0.9 });
        }

        // Look for project-related terms
        const projectTerms = ['foundation', 'kitchen', 'bathroom', 'renovation', 'construction', 'plumbing', 'electrical'];
        for (const term of projectTerms) {
            if (text.toLowerCase().includes(term)) {
                expected.projects.push({ name: `${term} work`, confidence: 0.8 });
            }
        }

        // Look for costs
        const costMatches = text.match(/\$[\d,]+(?:\.\d{2})?/g) || [];
        for (const cost of costMatches) {
            const amount = parseFloat(cost.replace(/[$,]/g, ''));
            expected.costs.push({ amount, currency: 'USD', confidence: 0.9 });
        }

        // Look for timeline references
        const timeMatches = text.match(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|today|tomorrow|yesterday|next week|3 weeks?|2 days?)\b/gi) || [];
        for (const time of [...new Set(timeMatches.map(t => t.toLowerCase()))]) {
            expected.timeline.push({ event: 'scheduled event', date: time, confidence: 0.7 });
        }

        return expected;
    }

    createMinimalTestData() {
        return [
            {
                id: 'test_1',
                title: 'Foundation Discussion',
                text: 'Hey Mike, when can we start the foundation work? The permits came through yesterday.',
                type: 'sms',
                expectedEntities: {
                    people: [{ name: 'Mike', confidence: 0.95 }],
                    projects: [{ name: 'foundation work', confidence: 0.90 }],
                    decisions: [{ type: 'approval', description: 'permits approved', confidence: 0.85 }],
                    timeline: [{ event: 'start foundation work', status: 'planned', confidence: 0.80 }],
                    costs: []
                }
            },
            {
                id: 'test_2',
                title: 'Budget Discussion',
                text: 'The kitchen renovation is $15K over budget. Custom cabinets are $8,000 over.',
                type: 'email',
                expectedEntities: {
                    people: [],
                    projects: [{ name: 'kitchen renovation', confidence: 0.95 }],
                    costs: [
                        { amount: 15000, type: 'overrun', confidence: 0.95 },
                        { amount: 8000, category: 'custom cabinets', confidence: 0.90 }
                    ],
                    timeline: [],
                    decisions: []
                }
            }
        ];
    }

    async runAccuracyTests() {
        console.log(chalk.blue.bold('\n🎯 Running Entity Extraction Accuracy Tests\n'));
        
        await this.loadTestData();
        
        if (this.testData.length === 0) {
            console.log(chalk.red('❌ No test data available'));
            return;
        }

        // Test cloud extractor
        console.log(chalk.blue('☁️  Testing Cloud LLM Extractor...'));
        await this.testExtractor('cloud', this.cloudExtractor);
        
        // Test local extractor (if available)
        console.log(chalk.blue('🖥️  Testing Local LLM Extractor...'));
        try {
            await this.testExtractor('local', this.localExtractor);
        } catch (error) {
            console.log(chalk.yellow(`⚠️  Local extractor unavailable: ${error.message}`));
            this.results.local = { error: error.message };
        }

        // Generate report
        this.generateReport();
    }

    async testExtractor(type, extractor) {
        const results = this.results[type];
        
        for (const testCase of this.testData) {
            const spinner = ora(`Processing ${testCase.id}...`).start();
            
            try {
                const extracted = await extractor.extractEntities(testCase.text, {
                    communicationType: testCase.type
                });
                
                const accuracy = this.calculateAccuracy(testCase.expectedEntities, extracted.entities);
                
                results.successes++;
                results.totalEntities += this.countEntities(testCase.expectedEntities);
                results.correctEntities += accuracy.correctEntities;
                
                spinner.succeed(`${testCase.id}: ${(accuracy.precision * 100).toFixed(1)}% precision`);
                
            } catch (error) {
                results.failures++;
                spinner.fail(`${testCase.id}: ${error.message}`);
            }
        }
    }

    calculateAccuracy(expected, extracted) {
        let correctEntities = 0;
        let totalExpected = 0;
        let totalExtracted = 0;

        // Compare each entity type
        for (const [entityType, expectedList] of Object.entries(expected)) {
            if (!Array.isArray(expectedList)) continue;
            
            const extractedList = extracted[entityType] || [];
            totalExpected += expectedList.length;
            totalExtracted += extractedList.length;

            // Simple matching based on key fields
            for (const expectedEntity of expectedList) {
                const match = extractedList.find(e => this.entitiesMatch(expectedEntity, e, entityType));
                if (match) {
                    correctEntities++;
                }
            }
        }

        const precision = totalExtracted > 0 ? correctEntities / totalExtracted : 0;
        const recall = totalExpected > 0 ? correctEntities / totalExpected : 0;
        const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

        return {
            correctEntities,
            totalExpected,
            totalExtracted,
            precision,
            recall,
            f1
        };
    }

    entitiesMatch(expected, extracted, entityType) {
        switch (entityType) {
            case 'people':
                return expected.name && extracted.name && 
                       expected.name.toLowerCase().includes(extracted.name.toLowerCase()) ||
                       extracted.name.toLowerCase().includes(expected.name.toLowerCase());
            
            case 'projects':
                return expected.name && extracted.name &&
                       this.textSimilarity(expected.name, extracted.name) > 0.5;
            
            case 'costs':
                return expected.amount && extracted.amount &&
                       Math.abs(expected.amount - extracted.amount) < expected.amount * 0.1; // 10% tolerance
            
            case 'timeline':
                return expected.event && extracted.event &&
                       this.textSimilarity(expected.event, extracted.event) > 0.3;
            
            default:
                return false;
        }
    }

    textSimilarity(text1, text2) {
        if (!text1 || !text2) return 0;
        
        const words1 = text1.toLowerCase().split(/\s+/);
        const words2 = text2.toLowerCase().split(/\s+/);
        
        const intersection = words1.filter(word => words2.includes(word));
        const union = [...new Set([...words1, ...words2])];
        
        return intersection.length / union.length;
    }

    countEntities(entities) {
        let count = 0;
        for (const entityList of Object.values(entities)) {
            if (Array.isArray(entityList)) {
                count += entityList.length;
            }
        }
        return count;
    }

    generateReport() {
        console.log('\n' + chalk.blue.bold('📊 Accuracy Test Results'));
        console.log('='.repeat(60));

        for (const [type, results] of Object.entries(this.results)) {
            if (results.error) {
                console.log(chalk.red(`❌ ${type.toUpperCase()}: ${results.error}`));
                continue;
            }

            const totalTests = results.successes + results.failures;
            const successRate = totalTests > 0 ? (results.successes / totalTests) * 100 : 0;
            const entityAccuracy = results.totalEntities > 0 ? (results.correctEntities / results.totalEntities) * 100 : 0;

            console.log(chalk.blue(`\n${type.toUpperCase()} LLM EXTRACTOR:`));
            console.log(`  Tests Completed: ${results.successes}/${totalTests} (${successRate.toFixed(1)}%)`);
            console.log(`  Entity Accuracy: ${results.correctEntities}/${results.totalEntities} (${entityAccuracy.toFixed(1)}%)`);
            
            // Color-code the results
            if (entityAccuracy >= 85) {
                console.log(chalk.green(`  ✅ EXCELLENT: Exceeds target accuracy (>85%)`));
            } else if (entityAccuracy >= 75) {
                console.log(chalk.yellow(`  ⚠️  GOOD: Meets minimum accuracy (>75%)`));
            } else {
                console.log(chalk.red(`  ❌ POOR: Below minimum accuracy (<75%)`));
            }
        }

        console.log('\n' + chalk.blue.bold('📋 Recommendations:'));
        
        const cloudAccuracy = this.results.cloud.totalEntities > 0 ? 
            (this.results.cloud.correctEntities / this.results.cloud.totalEntities) * 100 : 0;
        
        if (cloudAccuracy >= 85) {
            console.log(chalk.green('✅ Cloud LLM meets accuracy requirements for production'));
        } else {
            console.log(chalk.yellow('⚠️  Consider prompt engineering improvements or larger models'));
        }

        if (this.results.local.error) {
            console.log(chalk.yellow('⚠️  Local LLM unavailable - consider cloud-only approach or more memory'));
        }

        console.log(chalk.cyan('\n💡 Next steps: Run performance tests with npm run test:performance'));
    }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const evaluator = new AccuracyEvaluator();
    evaluator.runAccuracyTests().catch(error => {
        console.error(chalk.red('💥 Evaluation failed:'), error.message);
        process.exit(1);
    });
}

export default AccuracyEvaluator;
