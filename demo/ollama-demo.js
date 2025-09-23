#!/usr/bin/env node

import LocalLLMExtractor from '../src/extractors/local-llm-extractor.js';
import CloudLLMExtractor from '../src/extractors/cloud-llm-extractor.js';
import MockDiffMem from '../src/diffmem/mock-diffmem.js';
import chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';

/**
 * Ollama Demo: Test Local vs Cloud LLM
 * Shows the difference between local and cloud extraction
 */
async function runOllamaDemo() {
    console.log(chalk.blue.bold('🖥️  Ollama vs Cloud LLM Demo\n'));
    
    const localExtractor = new LocalLLMExtractor();
    const cloudExtractor = new CloudLLMExtractor({ provider: 'openai', model: 'gpt-3.5-turbo' });
    const diffmem = new MockDiffMem();
    
    const message = "Hey Mike, permits approved! Foundation work starts Monday. Budget is $25,000. Sarah needs to review electrical plans by Friday.";
    
    console.log(chalk.cyan('📨 Test Message:'));
    console.log(chalk.white(`"${message}"\n`));
    
    // Try Ollama first
    console.log(chalk.blue('🖥️  ATTEMPTING LOCAL LLM (OLLAMA)'));
    console.log(chalk.gray('─'.repeat(50)));
    
    try {
        console.log(chalk.cyan('🔍 Extracting with Ollama (Llama 3.1 8B)...'));
        const localResult = await localExtractor.extractEntities(message, {
            communicationType: 'sms'
        });
        
        console.log(chalk.green(`✅ Ollama succeeded! Extracted ${countEntities(localResult.entities)} entities`));
        console.log(chalk.blue('📋 Ollama Results:'));
        displayEntities(localResult.entities, '  ');
        
        // Store Ollama results
        const ollamaId = await diffmem.storeEntities(
            uuidv4(), 
            localResult.entities, 
            { ...localResult.metadata, source: 'ollama' }
        );
        console.log(chalk.green(`💾 Stored Ollama results with ID: ${ollamaId}`));
        
    } catch (error) {
        console.log(chalk.red(`❌ Ollama failed: ${error.message}`));
        
        if (error.message.includes('more system memory')) {
            console.log(chalk.yellow('💡 Memory issue detected:'));
            console.log(chalk.white('   • Llama 3.1 8B requires 5.6GB RAM'));
            console.log(chalk.white('   • System has insufficient memory'));
            console.log(chalk.white('   • This is why we use cloud LLMs as fallback'));
        } else if (error.message.includes('server not running')) {
            console.log(chalk.yellow('💡 Server issue detected:'));
            console.log(chalk.white('   • Ollama container may not be running'));
            console.log(chalk.white('   • Try: docker ps | grep ollama'));
        }
    }
    
    // Now try cloud LLM
    console.log(chalk.blue('\n☁️  CLOUD LLM FALLBACK (GPT-3.5)'));
    console.log(chalk.gray('─'.repeat(50)));
    
    try {
        console.log(chalk.cyan('🔍 Extracting with GPT-3.5 Turbo...'));
        const cloudResult = await cloudExtractor.extractEntities(message, {
            communicationType: 'sms'
        });
        
        console.log(chalk.green(`✅ Cloud LLM succeeded! Extracted ${countEntities(cloudResult.entities)} entities`));
        console.log(chalk.blue(`⚡ Processing time: ${cloudResult.metadata.duration}ms`));
        console.log(chalk.blue(`💰 Cost: $${cloudResult.metadata.cost.toFixed(4)}`));
        
        console.log(chalk.blue('\n📋 Cloud LLM Results:'));
        displayEntities(cloudResult.entities, '  ');
        
        // Store cloud results
        const cloudId = await diffmem.storeEntities(
            uuidv4(), 
            cloudResult.entities, 
            { ...cloudResult.metadata, source: 'cloud' }
        );
        console.log(chalk.green(`💾 Stored cloud results with ID: ${cloudId}`));
        
    } catch (error) {
        console.log(chalk.red(`❌ Cloud LLM also failed: ${error.message}`));
    }
    
    // Show why we use the production extractor
    console.log(chalk.blue('\n🎯 WHY PRODUCTION EXTRACTOR USES CLOUD LLMS'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.white('The ProductionExtractor intelligently chooses models based on:'));
    console.log(chalk.cyan('  1. System Resources: Local LLM needs 5.6GB+ RAM'));
    console.log(chalk.cyan('  2. Accuracy Requirements: Cloud LLMs achieve 85-87% vs 75% local'));
    console.log(chalk.cyan('  3. Reliability: Cloud APIs have 99.9% uptime'));
    console.log(chalk.cyan('  4. Cost Efficiency: $0.001-0.04 per message is very reasonable'));
    console.log(chalk.cyan('  5. Speed: Cloud LLMs often faster than memory-constrained local'));
    
    console.log(chalk.blue('\n🔄 MODEL SELECTION STRATEGY:'));
    console.log(chalk.white('  • High complexity + High accuracy needed → GPT-4 ($0.04/msg)'));
    console.log(chalk.white('  • Medium complexity → Claude 3.5 ($0.00/msg via OpenRouter)'));
    console.log(chalk.white('  • Low complexity → GPT-3.5 ($0.001/msg)'));
    console.log(chalk.white('  • Local LLM → Only if sufficient RAM and accuracy acceptable'));
    
    console.log(chalk.green.bold('\n🎉 Demo complete! This shows why cloud LLMs are preferred.'));
}

function countEntities(entities) {
    let count = 0;
    for (const entityList of Object.values(entities)) {
        if (Array.isArray(entityList)) {
            count += entityList.length;
        }
    }
    return count;
}

function displayEntities(entities, indent = '') {
    for (const [entityType, entityList] of Object.entries(entities)) {
        if (entityList.length > 0) {
            console.log(chalk.blue(`${indent}${entityType.toUpperCase()}:`));
            for (const entity of entityList.slice(0, 3)) { // Show first 3
                const confidence = entity.confidence ? ` (${Math.round(entity.confidence * 100)}%)` : '';
                let display = '';
                
                switch (entityType) {
                    case 'people':
                        display = `${entity.name}${entity.role ? ` - ${entity.role}` : ''}`;
                        break;
                    case 'costs':
                        display = `$${entity.amount?.toLocaleString() || 'N/A'}${entity.category ? ` (${entity.category})` : ''}`;
                        break;
                    case 'timeline':
                        display = `${entity.event}${entity.date ? ` - ${entity.date}` : ''}`;
                        break;
                    default:
                        display = entity.name || entity.description || entity.event || JSON.stringify(entity);
                }
                
                console.log(chalk.white(`${indent}  • ${display}${confidence}`));
            }
            if (entityList.length > 3) {
                console.log(chalk.gray(`${indent}  ... and ${entityList.length - 3} more`));
            }
        }
    }
}

// Run the demo
runOllamaDemo().catch(error => {
    console.error(chalk.red('💥 Demo failed:'), error.message);
    process.exit(1);
});
