#!/usr/bin/env node

import { LLMClient } from '../src/utils/llm-client.js';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

console.log(chalk.blue.bold('🚀 Entity Extraction PoC - Environment Setup\n'));

async function checkOllamaStatus() {
    const spinner = ora('Checking Ollama status...').start();
    
    try {
        // Check if Ollama is running
        const response = await fetch('http://localhost:11434/api/tags');
        if (response.ok) {
            const data = await response.json();
            const models = data.models || [];
            
            if (models.length === 0) {
                spinner.warn('Ollama is running but no models installed');
                console.log(chalk.yellow('📥 To install Llama 3.1 8B model, run:'));
                console.log(chalk.cyan('   docker exec -it <ollama-container> ollama pull llama3.1:8b'));
                return false;
            } else {
                const modelNames = models.map(m => m.name).join(', ');
                spinner.succeed(`Ollama is running with models: ${modelNames}`);
                return true;
            }
        } else {
            throw new Error('Ollama API not responding');
        }
    } catch (error) {
        spinner.fail('Ollama is not running');
        console.log(chalk.yellow('🐳 To start Ollama with Docker:'));
        console.log(chalk.cyan('   docker run -d -p 11434:11434 --name ollama ollama/ollama'));
        console.log(chalk.cyan('   docker exec -it ollama ollama pull llama3.1:8b'));
        return false;
    }
}

async function checkDirectoryStructure() {
    const spinner = ora('Checking directory structure...').start();
    
    const requiredDirs = [
        'src/extractors',
        'src/diffmem', 
        'src/pipeline',
        'src/utils',
        'data/input',
        'data/output',
        'data/ground-truth',
        'data/mock-diffmem',
        'evaluation',
        'config',
        'prompts/entity-extraction',
        'logs'
    ];

    try {
        for (const dir of requiredDirs) {
            await fs.ensureDir(dir);
        }
        spinner.succeed('Directory structure created');
        return true;
    } catch (error) {
        spinner.fail(`Failed to create directories: ${error.message}`);
        return false;
    }
}

async function testLLMConnectivity() {
    const spinner = ora('Testing LLM connectivity...').start();
    
    try {
        const client = new LLMClient();
        spinner.stop();
        
        const results = await client.testConnectivity();
        
        const workingProviders = Object.entries(results)
            .filter(([_, result]) => result.success)
            .map(([provider, _]) => provider);
            
        if (workingProviders.length === 0) {
            console.log(chalk.red('\n❌ No LLM providers are working!'));
            console.log(chalk.yellow('\n🔧 Setup Instructions:'));
            console.log(chalk.cyan('1. For OpenAI: Add your API key to .env file'));
            console.log(chalk.cyan('2. For OpenRouter: Sign up at https://openrouter.ai and add API key'));
            console.log(chalk.cyan('3. For Anthropic: Sign up at https://console.anthropic.com and add API key'));
            console.log(chalk.cyan('4. For Ollama: Start Docker container and pull model'));
            return false;
        } else {
            console.log(chalk.green(`\n✅ ${workingProviders.length} LLM provider(s) working: ${workingProviders.join(', ')}`));
            return true;
        }
    } catch (error) {
        spinner.fail(`LLM connectivity test failed: ${error.message}`);
        return false;
    }
}

async function createSampleData() {
    const spinner = ora('Creating sample data files...').start();
    
    try {
        // Create sample construction conversations
        const sampleConversations = `# Sample Construction Project Communications

## SMS Thread 1: Project Timeline Discussion
**Participants:** Rob (Owner), Mike (Contractor), Sarah (Architect)

Rob: Hey Mike, when can we start the foundation work? The permits came through yesterday.

Mike: Great news! I can start Monday if the weather holds. Need to coordinate with the concrete supplier first.

Sarah: Before you start, can we review the foundation plans one more time? I made some adjustments to the drainage system.

Rob: Sure, let's meet Friday at 2pm on site. Mike, does that work for you?

Mike: Perfect. I'll bring the updated timeline. We're looking at 3 weeks for foundation if everything goes smooth.

## Email Thread 1: Budget Discussion
**From:** rob@example.com
**To:** mike@contractor.com, sarah@architect.com
**Subject:** Budget Review - Kitchen Renovation

Hi team,

I've been reviewing the budget and we're about $15K over on the kitchen renovation. Here are the main overruns:

- Custom cabinets: $8,000 over budget
- Appliance upgrades: $5,000 over budget  
- Electrical work: $2,000 over budget

Can we discuss alternatives? I'm flexible on the appliances but really want to keep the custom cabinets.

Let me know your thoughts.

Rob

## Meeting Notes 1: Weekly Progress Review
**Date:** March 15, 2024
**Attendees:** Rob Foree (Owner), Mike Johnson (Contractor), Sarah Chen (Architect)

**Agenda Items:**
1. Foundation progress - 80% complete, on schedule
2. Plumbing rough-in - delayed 3 days due to permit issue
3. Electrical - inspector coming Thursday
4. Material deliveries - windows delayed 1 week

**Decisions Made:**
- Move electrical inspection to Friday to accommodate inspector schedule
- Order backup window supplier for faster delivery
- Approve change order #3 for additional outlet in master bedroom ($450)

**Action Items:**
- Mike: Follow up with window supplier by EOD
- Sarah: Submit revised electrical plans to city
- Rob: Approve material selections for bathroom tiles

**Next Meeting:** March 22, 2024 at 10am on-site`;

        await fs.writeFile('data/input/sample-conversations.txt', sampleConversations);

        // Create sample entity extraction examples
        const sampleEntities = {
            "conversations": [
                {
                    "id": "conv_001",
                    "text": "Hey Mike, when can we start the foundation work? The permits came through yesterday.",
                    "entities": {
                        "people": [
                            {"name": "Mike", "role": "contractor", "confidence": 0.95}
                        ],
                        "projects": [
                            {"name": "foundation work", "type": "construction_phase", "confidence": 0.90}
                        ],
                        "decisions": [
                            {"type": "permit_approval", "status": "approved", "date": "yesterday", "confidence": 0.85}
                        ],
                        "timeline": [
                            {"event": "start foundation work", "status": "planned", "confidence": 0.80}
                        ]
                    }
                }
            ]
        };

        await fs.writeJson('data/ground-truth/sample-entities.json', sampleEntities, { spaces: 2 });

        spinner.succeed('Sample data files created');
        return true;
    } catch (error) {
        spinner.fail(`Failed to create sample data: ${error.message}`);
        return false;
    }
}

async function checkEnvironmentFile() {
    const spinner = ora('Checking environment configuration...').start();
    
    try {
        const envExists = await fs.pathExists('.env');
        if (!envExists) {
            await fs.copy('.env.example', '.env');
            spinner.warn('Created .env from .env.example - please configure API keys');
            return false;
        }

        // Check for placeholder values
        const envContent = await fs.readFile('.env', 'utf8');
        const hasPlaceholders = envContent.includes('your_') || envContent.includes('_here');
        
        if (hasPlaceholders) {
            spinner.warn('Environment file contains placeholder values - please configure API keys');
            return false;
        }

        spinner.succeed('Environment file configured');
        return true;
    } catch (error) {
        spinner.fail(`Environment check failed: ${error.message}`);
        return false;
    }
}

async function main() {
    console.log(chalk.blue('Running environment setup checks...\n'));
    
    const checks = [
        { name: 'Directory Structure', fn: checkDirectoryStructure },
        { name: 'Environment File', fn: checkEnvironmentFile },
        { name: 'Sample Data', fn: createSampleData },
        { name: 'Ollama Status', fn: checkOllamaStatus },
        { name: 'LLM Connectivity', fn: testLLMConnectivity }
    ];

    const results = {};
    
    for (const check of checks) {
        results[check.name] = await check.fn();
    }

    console.log('\n' + chalk.blue.bold('📊 Setup Summary:'));
    console.log('='.repeat(50));
    
    let allPassed = true;
    for (const [name, passed] of Object.entries(results)) {
        const status = passed ? chalk.green('✅ PASS') : chalk.red('❌ FAIL');
        console.log(`${status} ${name}`);
        if (!passed) allPassed = false;
    }

    console.log('='.repeat(50));
    
    if (allPassed) {
        console.log(chalk.green.bold('\n🎉 Environment setup complete! Ready to start development.'));
        console.log(chalk.blue('\n📋 Next steps:'));
        console.log(chalk.cyan('   npm run test:extraction  # Test entity extraction'));
        console.log(chalk.cyan('   npm run dev              # Start development mode'));
    } else {
        console.log(chalk.yellow.bold('\n⚠️  Environment setup incomplete.'));
        console.log(chalk.blue('\n🔧 Required actions:'));
        
        if (!results['Environment File']) {
            console.log(chalk.cyan('   1. Configure API keys in .env file'));
        }
        if (!results['Ollama Status']) {
            console.log(chalk.cyan('   2. Start Ollama Docker container'));
        }
        if (!results['LLM Connectivity']) {
            console.log(chalk.cyan('   3. Verify at least one LLM provider is working'));
        }
    }

    console.log(chalk.blue('\n📚 For detailed setup instructions, see README.md'));
    
    process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
    console.error(chalk.red('💥 Setup failed:'), error.message);
    process.exit(1);
});
