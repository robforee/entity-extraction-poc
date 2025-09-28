# Universal Knowledge System - Features

## Quick Command Signatures

```bash
# Load documents for analysis
npm run test:load-docs ./your-documents
npm run test:load-docs ./email-exports
npm run test:load-docs ./research-papers

# Launch visualization
npm run viz:start                    # Opens http://localhost:3000
npm run viz:export                   # Export concept maps

# Clear data store for fresh testing
npm run test:clear-data              # Complete data store reset
npm run clean                        # Clear output and logs only

# Test multi-domain extraction
npm run test:universal               # Test across all knowledge domains
npm run test:temporal                # Test concept evolution tracking
npm run test:visualization           # Test topic explorer components

# API usage analysis and optimization
npm run analyze:api-usage            # Full API usage analysis and billing reconciliation
npm run test:claude-routing          # Test Claude provider routing
npm run demo:enhanced-tracking       # Demo enhanced request tracking capabilities
```

## Quick Command Signatures

### Request/Response Analysis
```bash
# View API usage with request IDs
npm run analyze:api-usage

# Look up specific request by ID (from API usage report)
npm run request:lookup -- --id <request-id>
# Example: npm run request:lookup -- --id req_1758507413608_pebxohjqc

# Look up request by time
npm run request:lookup -- --time "MM/DD HH:MM:SS"
# Example: npm run request:lookup -- --time "09/21 21:16:53"

# Show recent requests with full details
npm run request:lookup -- --recent 5
```

### Domain Management
```bash
# List all domains and their stats
npm run domain:list

# Query entities in specific domain
npm run query:entities --domain cybersec

# Query relationships between entities
npm run query:relationships --domain cybersec

# Process new documents with cost control
npm run process:domain -- --domain cybersec --limit 3 /path/to/docs
```

## System Architecture
- **Node.js application** with Express.js web server for visualization
- **Multi-provider LLM integration** supporting OpenAI, Anthropic, OpenRouter, Ollama
- **Domain-agnostic entity extraction** across construction, human development, economics, politics, science, technology, cybersecurity
- **Temporal intelligence storage** with JSON-based concept versioning
- **Interactive browser widget** on port 3000 for concept exploration

## Universal Entity Extraction
- **Multi-domain processing** - Extract concepts from any knowledge domain
- **Temporal concept tracking** - Version concepts and track evolution over time
- **Relationship mapping** - Identify connections between concepts across domains
- **Decision pattern analysis** - Extract decision-making patterns and rationale
- **Vocabulary synthesis** - LLM-assisted discovery of better terms for emerging concepts
- **Cross-domain intelligence** - Connect insights across diverse knowledge areas

## Topic Explorer Visualization
- **Multi-cluster display** - Organize concepts in meaningful groups (family, business, research, science, assets, annual)
- **Interactive relationship exploration** - Click-to-explore concept connections
- **Dynamic grouping engine** - Custom grouping requests ("show me groups based on my assets")
- **Temporal timeline visualization** - Show how concepts evolve over time
- **Real-time updates** - WebSocket connections for live data refresh
- **Export capabilities** - Save concept maps and insights

## Knowledge Archaeology
- **Historical pattern analysis** - Extract wisdom from entire communication history
- **Conceptual evolution tracking** - See how understanding develops over months/years
- **Thinking pattern recognition** - Identify personal decision-making styles
- **Intuition analysis** - Track where hunches and explorations lead
- **Emergent concept detection** - Identify ideas you're developing but haven't fully articulated
- **Cross-temporal insights** - Connect past insights to current thinking

## Multi-Source Integration
- **Email stream processing** - Primary source for temporal intelligence
- **Document analysis** - Process research papers, notes, articles
- **Chat/SMS integration** - Enhance existing communication processing
- **Feed processing** - Blog posts, RSS feeds, web research
- **Bulk document loading** - Rapid processing of document collections
- **Source attribution** - Track where concepts and insights originated

## API Usage Tracking & Cost Optimization
- **Enhanced request tracking** - Capture call stack, reasoning, and metadata for every API call
- **Multi-provider billing reconciliation** - Track requests across OpenAI, Anthropic, OpenRouter, Ollama
- **Local model cost analysis** - Identify requests that could use local models for cost savings
- **Call stack debugging** - See exactly where in code each API call originates
- **Request reasoning tracking** - Understand why each model/provider was selected
- **Cost savings analysis** - Calculate potential savings with local model usage
- **Detailed request logging** - Export comprehensive usage reports for billing analysis

## Rapid Testing Framework
- **Data store management** - Complete clearing and reloading capabilities
- **Bulk document processing** - Load entire document collections at once
- **Iterative analysis cycles** - Clear, load, analyze, visualize, repeat
- **Performance monitoring** - Track extraction accuracy and processing time
- **Validation tools** - Test concept clustering and relationship accuracy

## Current Workflow
1. **Documents loaded** → Bulk processing via `npm run test:load-docs`
2. **Universal extraction** → Multi-domain entity and concept identification
3. **Temporal tracking** → Concept evolution and relationship mapping
4. **API usage tracking** → Enhanced request logging with call stack and reasoning
5. **Visualization generation** → Multi-cluster concept display
6. **Interactive exploration** → Browser-based concept and relationship exploration
7. **Pattern analysis** → Thinking and decision-making pattern recognition
8. **Cost optimization** → Local model savings analysis and billing reconciliation

---

## Development Phases

### Phase 1: Universal Foundation (Current)
- **Multi-domain entity extraction** - Remove construction constraints, enable any knowledge domain
- **Temporal concept tracking** - Track how vocabulary and understanding evolve over time
- **Email stream integration** - Process primary communication source for temporal intelligence
- **Vocabulary synthesis** - LLM-assisted discovery of better terms for emerging concepts
- **Topic explorer visualization** - Multi-cluster concept display with interactive exploration
- **API usage tracking** - Enhanced request monitoring with cost optimization analysis

### Phase 2: Intelligence Layer
- **Pattern recognition** - Identify unique thinking and decision-making patterns
- **Cross-domain mapping** - Connect insights across diverse knowledge areas
- **Knowledge archaeology** - Extract wisdom from entire communication history
- **Intuition analysis** - Track where hunches and explorations lead

### Phase 3: Universal Integration
- **Multi-source pipeline** - Email, chat, documents, feeds, web research
- **Temporal queries** - "How has my thinking about X evolved over time?"
- **Predictive insights** - "Based on patterns, you might be interested in..."
- **Decision archaeology** - Understand personal choice patterns and reasoning evolution

## Visualization Capabilities

### Multi-Cluster Organization
- **Family clusters**: Family members, relationships, traditions, memories
- **Business clusters**: Projects, clients, finances, skills
- **Research clusters**: Topics, sources, insights, questions
- **Science clusters**: Fields, concepts, experiments, theories
- **Assets clusters**: Properties, investments, valuables, tools
- **Annual clusters**: Yearly goals, traditions, reviews, planning

### Interactive Features
- **Concept node exploration** - Click concepts to see relationships
- **Relationship line visualization** - Curved lines showing connection strength
- **Temporal evolution display** - Timeline showing concept development
- **Custom grouping interface** - Natural language grouping requests
- **Export and sharing** - Save concept maps and insights

## Success Metrics

### Technical Performance
- **Multi-domain extraction accuracy**: >80% across all knowledge domains
- **Temporal tracking capability**: Show concept evolution over time periods
- **Email processing efficiency**: Handle full email history without data loss
- **Vocabulary synthesis quality**: Generate meaningful term suggestions
- **Visualization responsiveness**: Interactive exploration under 2 seconds
- **API tracking accuracy**: 100% request capture with call stack and reasoning
- **Cost optimization potential**: Identify local model savings opportunities

### Intelligence Validation
- **Pattern recognition accuracy**: Identify personal thinking patterns
- **Cross-domain insight quality**: Connect ideas across different knowledge areas
- **Knowledge archaeology value**: Extract valuable insights from historical data
- **Predictive insight relevance**: Provide meaningful future direction suggestions

## Integration Potential

### Communication Systems Enhancement
- **SMS/Chat intelligence** - Add temporal intelligence to existing message processing
- **Email archaeology** - Extract insights from years of email communications
- **Document intelligence** - Analyze research papers, notes, and articles
- **Cross-source synthesis** - Connect insights across all communication channels

### Personal Knowledge Management
- **Decision support** - Historical pattern analysis for better choices
- **Learning acceleration** - Track conceptual development and knowledge gaps
- **Intuition validation** - See where hunches and explorations have led
- **Vocabulary development** - Articulate emerging concepts with better terminology

**This Universal Knowledge System transforms personal communications into temporal intelligence - understanding not just what you know, but how you learn and where your intuition is leading.** 🧠
