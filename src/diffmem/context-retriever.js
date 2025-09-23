import MockDiffMem from './mock-diffmem.js';
import { LLMClient } from '../utils/llm-client.js';
import chalk from 'chalk';

/**
 * Context Retriever
 * 
 * Retrieves and assembles relevant context from stored entities
 * for generating intelligent responses to construction project queries.
 */
export class ContextRetriever {
    constructor(options = {}) {
        this.diffmem = new MockDiffMem(options);
        this.llmClient = new LLMClient();
        this.maxContextTokens = options.maxContextTokens || 4000;
        this.maxEntities = options.maxEntities || 15;
        this.contextModel = options.contextModel || process.env.CONTEXT_GENERATION_MODEL || 'gpt-3.5-turbo';
    }

    /**
     * Retrieve context for a query with intelligent ranking and summarization
     */
    async retrieveContext(query, options = {}) {
        const {
            conversationId = null,
            includeHistory = true,
            maxAge = 30, // days
            minConfidence = 0.6,
            prioritizeRecent = true
        } = options;

        console.log(chalk.blue(`🧠 Retrieving context for: "${query}"`));

        // Step 1: Get relevant entities from DiffMem
        const entities = await this.diffmem.getContext(query, {
            maxEntities: this.maxEntities,
            maxAge,
            minConfidence
        });

        // Step 2: Include conversation history if requested
        let conversationContext = null;
        if (includeHistory && conversationId) {
            conversationContext = await this.getConversationHistory(conversationId);
        }

        // Step 3: Rank and filter entities by relevance
        const rankedEntities = this.rankEntitiesByRelevance(entities.entities, query);

        // Step 4: Generate structured context
        const structuredContext = await this.generateStructuredContext(
            rankedEntities,
            query,
            conversationContext
        );

        // Step 5: Create context summary for LLM consumption
        const contextSummary = await this.generateContextSummary(structuredContext, query);

        console.log(chalk.green(`✅ Context retrieved: ${rankedEntities.length} entities, ${contextSummary.length} chars`));

        return {
            query,
            entities: rankedEntities,
            conversationContext,
            structuredContext,
            summary: contextSummary,
            metadata: {
                entityCount: rankedEntities.length,
                hasConversationHistory: !!conversationContext,
                contextLength: contextSummary.length,
                retrievedAt: new Date().toISOString(),
                confidence: this.calculateOverallConfidence(rankedEntities)
            }
        };
    }

    /**
     * Get conversation history for context
     */
    async getConversationHistory(conversationId, maxMessages = 10) {
        console.log(chalk.blue(`📜 Retrieving conversation history for ${conversationId}...`));

        try {
            const conversationEntities = await this.diffmem.getEntitiesByConversation(conversationId);
            
            if (conversationEntities.length === 0) {
                return null;
            }

            // Sort by timestamp and take most recent
            const recentEntities = conversationEntities
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, maxMessages);

            return {
                conversationId,
                messageCount: recentEntities.length,
                entities: recentEntities,
                timespan: this.calculateTimespan(recentEntities)
            };

        } catch (error) {
            console.warn(chalk.yellow(`⚠️  Could not retrieve conversation history: ${error.message}`));
            return null;
        }
    }

    /**
     * Rank entities by relevance to the query
     */
    rankEntitiesByRelevance(entities, query) {
        const queryTerms = query.toLowerCase().split(/\s+/);
        
        return entities.map(entityRecord => {
            let relevanceScore = 0;
            
            // Base confidence score
            relevanceScore += (entityRecord.metadata?.confidence || 0) * 10;
            
            // Text matching score
            const entityText = JSON.stringify(entityRecord.entities).toLowerCase();
            for (const term of queryTerms) {
                const matches = (entityText.match(new RegExp(term, 'g')) || []).length;
                relevanceScore += matches * 2;
            }
            
            // Entity type relevance
            const entityTypes = Object.keys(entityRecord.entities);
            for (const term of queryTerms) {
                if (entityTypes.some(type => type.includes(term) || term.includes(type.slice(0, -1)))) {
                    relevanceScore += 5;
                }
            }
            
            // Recency bonus
            const age = Date.now() - new Date(entityRecord.timestamp).getTime();
            const daysSinceCreation = age / (1000 * 60 * 60 * 24);
            relevanceScore += Math.max(0, 5 - daysSinceCreation * 0.1);
            
            return {
                ...entityRecord,
                relevanceScore
            };
        })
        .sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    /**
     * Generate structured context from entities
     */
    async generateStructuredContext(entities, query, conversationContext) {
        const context = {
            query,
            summary: {
                totalEntities: entities.length,
                entityTypes: {},
                keyFindings: []
            },
            people: new Map(),
            projects: new Map(),
            decisions: [],
            timeline: [],
            costs: [],
            issues: [],
            tasks: [],
            materials: [],
            locations: new Set(),
            documents: []
        };

        // Process entities
        for (const entityRecord of entities) {
            for (const [entityType, entityList] of Object.entries(entityRecord.entities)) {
                if (!context.summary.entityTypes[entityType]) {
                    context.summary.entityTypes[entityType] = 0;
                }
                context.summary.entityTypes[entityType] += entityList.length;

                // Process each entity type
                this.processEntitiesByType(context, entityType, entityList, entityRecord);
            }
        }

        // Convert Maps and Sets to Arrays for JSON serialization
        context.people = Array.from(context.people.entries()).map(([name, data]) => ({ name, ...data }));
        context.projects = Array.from(context.projects.entries()).map(([name, data]) => ({ name, ...data }));
        context.locations = Array.from(context.locations);

        // Add conversation context if available
        if (conversationContext) {
            context.conversationHistory = conversationContext;
        }

        // Generate key findings
        context.summary.keyFindings = this.extractKeyFindings(context);

        return context;
    }

    /**
     * Process entities by type and aggregate information
     */
    processEntitiesByType(context, entityType, entityList, entityRecord) {
        const timestamp = entityRecord.timestamp;
        const confidence = entityRecord.metadata?.confidence || 0;

        switch (entityType) {
            case 'people':
                for (const person of entityList) {
                    const name = person.name;
                    if (!context.people.has(name)) {
                        context.people.set(name, {
                            role: person.role,
                            company: person.company,
                            mentions: 0,
                            lastSeen: timestamp,
                            confidence: person.confidence || confidence
                        });
                    }
                    const existing = context.people.get(name);
                    existing.mentions++;
                    if (new Date(timestamp) > new Date(existing.lastSeen)) {
                        existing.lastSeen = timestamp;
                        if (person.role) existing.role = person.role;
                        if (person.company) existing.company = person.company;
                    }
                }
                break;

            case 'projects':
                for (const project of entityList) {
                    const name = project.name;
                    if (!context.projects.has(name)) {
                        context.projects.set(name, {
                            type: project.type,
                            phase: project.phase,
                            mentions: 0,
                            lastUpdated: timestamp,
                            confidence: project.confidence || confidence
                        });
                    }
                    const existing = context.projects.get(name);
                    existing.mentions++;
                    if (new Date(timestamp) > new Date(existing.lastUpdated)) {
                        existing.lastUpdated = timestamp;
                        if (project.phase) existing.phase = project.phase;
                        if (project.type) existing.type = project.type;
                    }
                }
                break;

            case 'decisions':
                context.decisions.push(...entityList.map(d => ({
                    ...d,
                    timestamp,
                    confidence: d.confidence || confidence
                })));
                break;

            case 'timeline':
                context.timeline.push(...entityList.map(t => ({
                    ...t,
                    timestamp,
                    confidence: t.confidence || confidence
                })));
                break;

            case 'costs':
                context.costs.push(...entityList.map(c => ({
                    ...c,
                    timestamp,
                    confidence: c.confidence || confidence
                })));
                break;

            case 'issues':
                context.issues.push(...entityList.map(i => ({
                    ...i,
                    timestamp,
                    confidence: i.confidence || confidence
                })));
                break;

            case 'tasks':
                context.tasks.push(...entityList.map(t => ({
                    ...t,
                    timestamp,
                    confidence: t.confidence || confidence
                })));
                break;

            case 'materials':
                context.materials.push(...entityList.map(m => ({
                    ...m,
                    timestamp,
                    confidence: m.confidence || confidence
                })));
                break;

            case 'locations':
                for (const location of entityList) {
                    if (location.name) {
                        context.locations.add(location.name);
                    }
                }
                break;

            case 'documents':
                context.documents.push(...entityList.map(d => ({
                    ...d,
                    timestamp,
                    confidence: d.confidence || confidence
                })));
                break;
        }
    }

    /**
     * Extract key findings from structured context
     */
    extractKeyFindings(context) {
        const findings = [];

        // Most mentioned people
        const topPeople = context.people
            .sort((a, b) => b.mentions - a.mentions)
            .slice(0, 3);
        if (topPeople.length > 0) {
            findings.push(`Key people: ${topPeople.map(p => p.name).join(', ')}`);
        }

        // Active projects
        if (context.projects.length > 0) {
            findings.push(`Active projects: ${context.projects.map(p => p.name).join(', ')}`);
        }

        // Recent decisions
        const recentDecisions = context.decisions
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 2);
        if (recentDecisions.length > 0) {
            findings.push(`Recent decisions: ${recentDecisions.map(d => d.description || d.type).join('; ')}`);
        }

        // Budget information
        const budgetItems = context.costs.filter(c => c.amount && c.amount > 1000);
        if (budgetItems.length > 0) {
            const totalAmount = budgetItems.reduce((sum, c) => sum + (c.amount || 0), 0);
            findings.push(`Budget items: $${totalAmount.toLocaleString()} total`);
        }

        // Active issues
        const activeIssues = context.issues.filter(i => i.status !== 'resolved' && i.status !== 'closed');
        if (activeIssues.length > 0) {
            findings.push(`Active issues: ${activeIssues.length} open`);
        }

        return findings;
    }

    /**
     * Generate context summary for LLM consumption
     */
    async generateContextSummary(structuredContext, query) {
        // Create a concise text summary
        let summary = `Context for "${query}":\n\n`;

        // Key findings
        if (structuredContext.summary.keyFindings.length > 0) {
            summary += `Key Information:\n${structuredContext.summary.keyFindings.map(f => `• ${f}`).join('\n')}\n\n`;
        }

        // People
        if (structuredContext.people.length > 0) {
            summary += `People:\n`;
            for (const person of structuredContext.people.slice(0, 5)) {
                summary += `• ${person.name}`;
                if (person.role) summary += ` (${person.role})`;
                if (person.company) summary += ` - ${person.company}`;
                summary += `\n`;
            }
            summary += '\n';
        }

        // Projects
        if (structuredContext.projects.length > 0) {
            summary += `Projects:\n`;
            for (const project of structuredContext.projects.slice(0, 3)) {
                summary += `• ${project.name}`;
                if (project.phase) summary += ` (${project.phase})`;
                summary += `\n`;
            }
            summary += '\n';
        }

        // Recent timeline items
        const recentTimeline = structuredContext.timeline
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 3);
        if (recentTimeline.length > 0) {
            summary += `Recent Timeline:\n`;
            for (const item of recentTimeline) {
                summary += `• ${item.event}`;
                if (item.status) summary += ` (${item.status})`;
                if (item.date) summary += ` - ${item.date}`;
                summary += `\n`;
            }
            summary += '\n';
        }

        // Issues
        const activeIssues = structuredContext.issues
            .filter(i => i.status !== 'resolved' && i.status !== 'closed')
            .slice(0, 2);
        if (activeIssues.length > 0) {
            summary += `Active Issues:\n`;
            for (const issue of activeIssues) {
                summary += `• ${issue.description}`;
                if (issue.severity) summary += ` (${issue.severity})`;
                summary += `\n`;
            }
            summary += '\n';
        }

        // Trim to max tokens (rough estimate: 4 chars per token)
        const maxChars = this.maxContextTokens * 4;
        if (summary.length > maxChars) {
            summary = summary.substring(0, maxChars) + '...\n\n[Context truncated due to length]';
        }

        return summary.trim();
    }

    /**
     * Calculate overall confidence of retrieved context
     */
    calculateOverallConfidence(entities) {
        if (entities.length === 0) return 0;

        const confidenceSum = entities.reduce((sum, entity) => {
            return sum + (entity.metadata?.confidence || 0);
        }, 0);

        return confidenceSum / entities.length;
    }

    /**
     * Calculate timespan of conversation history
     */
    calculateTimespan(entities) {
        if (entities.length === 0) return null;

        const timestamps = entities.map(e => new Date(e.timestamp));
        const earliest = new Date(Math.min(...timestamps));
        const latest = new Date(Math.max(...timestamps));

        return {
            earliest: earliest.toISOString(),
            latest: latest.toISOString(),
            durationDays: Math.ceil((latest - earliest) / (1000 * 60 * 60 * 24))
        };
    }

    /**
     * Test context retrieval with sample data
     */
    async test() {
        console.log(chalk.blue('🧪 Testing context retrieval system...'));

        try {
            // Store some test entities first
            const testEntities = {
                people: [
                    { name: 'Mike Johnson', role: 'contractor', confidence: 0.95 },
                    { name: 'Sarah Chen', role: 'architect', confidence: 0.90 }
                ],
                projects: [
                    { name: 'foundation work', type: 'construction', phase: 'planning', confidence: 0.85 }
                ],
                decisions: [
                    { type: 'approval', description: 'permits approved', date: 'yesterday', confidence: 0.90 }
                ],
                timeline: [
                    { event: 'start foundation', status: 'planned', date: 'Monday', confidence: 0.80 }
                ],
                costs: [
                    { amount: 15000, type: 'estimate', category: 'foundation', confidence: 0.85 }
                ]
            };

            const entityId = await this.diffmem.storeEntities('test-conversation', testEntities, {
                model: 'test-model',
                confidence: 0.87
            });

            // Test context retrieval
            const context = await this.retrieveContext('foundation work timeline');

            console.log(chalk.green('✅ Context retrieval test successful!'));
            console.log('Context summary:', context.summary);
            console.log('Entities found:', context.entities.length);

            return context;

        } catch (error) {
            console.error(chalk.red('❌ Context retrieval test failed:'), error.message);
            throw error;
        }
    }
}

export default ContextRetriever;
