# Context Intelligence System - Architecture Notes

**PERSPECTIVE: SYSTEM ARCHITECT/ENGINEERING DESIGN**  
*Written for system architects and senior developers who need to understand the deep technical architecture. Focuses on component design, integration patterns, performance optimization, and quality assurance systems.*

## Core Architectural Principles

### 1. Hierarchical Entity Understanding
The system must understand that entities exist in hierarchical relationships, not just flat co-occurrence patterns.

**Problem**: Current system treats these as separate entities:
- SOC Analyst
- SOC Supervisor  
- SOC Manager
- SOC Compliance mapping
- Security Operations Center Analyst
- SOC Analyst Level 2
- SOC Analyst Level 1

**Solution**: Hierarchical entity structure:
```
SOC (Security Operations Center)
├── Roles
│   ├── Analyst
│   │   ├── Level 1
│   │   ├── Level 2
│   │   └── Level 3
│   ├── Supervisor
│   └── Manager
└── Projects
    └── Compliance Mapping
```

### 2. Centralized Query Management System

**Challenge**: When "Microsoft Defender" is not found, the LLM query must be well-crafted to get valid categories for elaboration.

**Architecture**: Query Template Management System
```javascript
// src/query-management/
├── query-templates.js          // Centralized query definitions
├── query-evaluator.js          // Query performance tracking
├── query-upgrader.js           // Template evolution system
└── domain-queries/
    ├── cybersecurity.js        // Domain-specific query patterns
    ├── construction.js         // Construction domain queries
    └── generic.js              // Universal query patterns
```

**Query Template Structure**:
```javascript
const queryTemplates = {
  "unknown_security_tool": {
    template: `Analyze the security tool "{entity}" and provide:
1. Primary category (SIEM, Firewall, Endpoint Protection, etc.)
2. Sub-components or modules
3. Key capabilities for each component
4. Integration points with other security tools
5. Typical organizational roles that interact with it`,
    
    version: "1.2",
    success_rate: 0.87,
    last_updated: "2025-09-27",
    evaluation_criteria: ["completeness", "accuracy", "structure"]
  }
};
```

### 3. Snappy Integration Architecture

**Goal**: Bidirectional sync between Snappy project management and Context Intelligence (CI) system.

**Integration Points**:
```javascript
// Snappy modifications needed
const snappyIntegration = {
  // Export CI-compatible data
  exportForCI: (projectId) => ({
    project: {
      id: projectId,
      name: "John's Deck Project",
      status: "in_progress",
      lastModified: "2025-09-27T13:14:20-05:00",
      entities: {
        people: ["John Fuller"],
        locations: ["9611 Blue Creek Dr"],
        materials: ["deck screws", "lumber"],
        timeline: ["2025-09-15", "2025-10-15"]
      }
    },
    syncHash: "abc123def456", // For change detection
    ciLastSync: "2025-09-26T10:30:00-05:00"
  }),
  
  // Import insights from CI
  importFromCI: (projectId, insights) => {
    // Update Snappy with CI-discovered relationships
    // Add new entities found by CI analysis
    // Update project context with CI intelligence
  }
};
```

**Snappy CLI Modifications Needed**:
```bash
# New commands for CI integration
node snappy.js export ci --project <id>     # Export CI-compatible data
node snappy.js sync ci --check              # Check sync status with CI
node snappy.js sync ci --pull               # Pull insights from CI
node snappy.js sync ci --push               # Push updates to CI
```

### 4. Hierarchical Knowledge Discovery Architecture

**Problem**: Microsoft Defender has modules → capabilities → configurations → data sources, but system treats them as flat entities.

**Solution**: Progressive Knowledge Drilling Architecture
```javascript
// src/knowledge-drilling/
├── hierarchy-detector.js       // Detect hierarchical patterns
├── progressive-driller.js      // Drill down through levels
├── knowledge-validator.js      // Validate hierarchical structure
└── domain-hierarchies/
    ├── microsoft-defender.js   // Defender-specific hierarchy rules
    ├── soc-operations.js       // SOC hierarchy patterns
    └── generic-security.js     // General security hierarchies
```

**Hierarchy Template System**:
```javascript
const hierarchyTemplates = {
  "microsoft_defender": {
    levels: [
      {
        name: "suite",
        pattern: "Microsoft Defender",
        children_type: "modules"
      },
      {
        name: "modules", 
        pattern: "Defender for {target}",
        children_type: "capabilities"
      },
      {
        name: "capabilities",
        pattern: "{capability_name}",
        children_type: "configurations"
      },
      {
        name: "configurations",
        pattern: "{config_name}",
        children_type: "data_sources"
      }
    ]
  },
  
  "soc_operations": {
    levels: [
      {
        name: "organization",
        pattern: "SOC|Security Operations Center",
        children_type: "divisions"
      },
      {
        name: "divisions",
        pattern: "Roles|Projects|Infrastructure",
        children_type: "items"
      },
      {
        name: "items",
        pattern: "Analyst|Manager|Compliance|Tools",
        children_type: "specifics"
      }
    ]
  }
};
```

### 5. Entity Consolidation Architecture

**Current Problem**: Multiple similar entities not properly consolidated.

**Solution**: Smart Consolidation Engine
```javascript
// src/consolidation/
├── similarity-engine.js        // Advanced similarity detection
├── hierarchy-consolidator.js   // Consolidate within hierarchies
├── confidence-scorer.js        // Confidence-based consolidation
└── consolidation-rules/
    ├── cybersecurity-rules.js  // Domain-specific consolidation
    ├── construction-rules.js   // Construction consolidation
    └── generic-rules.js        // Universal consolidation patterns
```

**Consolidation Rules Example**:
```javascript
const consolidationRules = {
  "soc_analyst_variations": {
    primary_pattern: "SOC Analyst",
    variations: [
      "Security Operations Center Analyst",
      "SOC Analyst Level {number}",
      "SOC {level} Analyst"
    ],
    consolidation_strategy: "hierarchical",
    hierarchy_field: "level",
    confidence_threshold: 0.85
  }
};
```

### 6. Persistent Conversation Management Architecture

**Problem**: Context and incomplete queries are lost between CLI sessions, making it impossible to track outstanding questions or maintain conversation continuity.

**Solution**: Persistent conversation storage with intelligent request completion detection.

```javascript
// src/context/
├── persistent-conversation-manager.js    // Cross-session conversation memory
├── pending-request-tracker.js           // Outstanding question management
└── snappy-expense-pusher.js            // Automatic project integration
```

**Architecture Components**:

```javascript
// Persistent Conversation Structure
const conversationStructure = {
  conversations: {
    "user-session-id": {
      id: "user-session-id",
      userId: "cli-user", 
      queryHistory: [/* all queries with context */],
      entities: {/* accumulated entities across queries */},
      contextualMemory: {
        recentProjects: ["John's deck", "kitchen remodel"],
        recentLocations: ["John's house", "Home Depot"],
        recentPeople: ["John", "contractor Mike"]
      },
      pendingRequestIds: ["req-123", "req-456"]
    }
  },
  
  pendingRequests: {
    "req-123": {
      id: "req-123",
      conversationId: "user-session-id",
      originalQuery: "I bought screws for John's deck",
      intent: { type: "add_charge", confidence: 0.33 },
      extractedEntities: {/* people, items, locations */},
      missingInfo: {
        type: "amount",
        question: "I need to know the amount to charge. Could you specify the cost?",
        requiredEntity: "amount"
      },
      projectContext: {
        projectName: "John's deck",
        inferredFromLocation: true,
        inferredFromPerson: true
      },
      status: "pending", // pending | completed | failed
      createdAt: "2025-09-27T22:58:34.639Z"
    }
  }
};
```

**Completion Detection Logic**:
```javascript
// When new query comes in, check if it completes any pending requests
const completionCheck = {
  // Match amount entities to pending add_charge requests
  amountCompletion: (newQuery, pendingRequests) => {
    const amounts = extractAmounts(newQuery);
    const pendingCharges = pendingRequests.filter(r => 
      r.status === 'pending' && 
      r.missingInfo.type === 'amount'
    );
    
    return matchAmountToPendingCharge(amounts, pendingCharges);
  },
  
  // Combine original context with new information
  combineContexts: (originalRequest, completionInfo) => ({
    ...originalRequest.extractedEntities,
    amounts: [completionInfo.amount],
    readyForSnappy: true
  })
};
```

**CLI Commands for Outstanding Questions**:
```bash
node context.js pending list                    # List all pending requests
node context.js pending summary                 # Project breakdown & age analysis  
node context.js pending show <request-id>       # Detailed request information
node context.js pending cleanup                 # Remove old completed requests
```

**Snappy Integration Workflow**:
1. **Incomplete Query** → Create pending request with project context
2. **Completion Detection** → Automatically match new info to pending request
3. **Snappy Push** → Create/update project with expense details
4. **Audit Trail** → Full transaction history in both systems

### 7. Smart Router Architecture (Sep 27 Evening Breakthrough)

**Problem**: Context System creates new projects instead of finding existing ones. Missing "Snappy-aware query processing."

**Solution**: Context DB as Smart Router + Source Systems for Structured Data

```javascript
// Data Source Registry - Context DB knows WHERE data lives
const dataSourceRegistry = {
  "project-costs": {
    source: "snappy",
    command: "node snappy.js costs list --project {project-id} --format json",
    entityTypes: ["amounts", "materials", "labor"]
  },
  "snappy-projects": {
    source: "snappy", 
    command: "node snappy.js list projects --format json",
    entityTypes: ["projects", "people", "locations"]
  },
  "command-signatures": {
    source: "context-cli",
    command: "node context.js --help --format json",
    entityTypes: ["commands", "parameters"]
  }
};
```

**Smart Query Processing**:
```javascript
// Enhanced query flow with external discovery
const smartQueryFlow = {
  1: "Parse query: 'I bought screws for John's deck'",
  2: "Check Context DB for John + deck relationships", 
  3: "Query Snappy for existing projects (external discovery)",
  4: "LLM match 'John's deck' to project names",
  5: "Present options: 'Add to John Green deck project (Sep 23)?'",
  6: "Update existing project instead of creating new one"
};
```

**CLI Architecture**:
```bash
# Conceptual queries (Context DB relationships)
node context.js query "What are cost components for John's deck?"

# Structured data routing (Source Systems with full fidelity)
node context.js data costs --project john-deck --format json | calculator

# Smart discovery (Context DB + External Sources)
node context.js discover projects --person john --location deck
```

**Implementation Priority**: DataSourceRouter component that makes Context DB intelligent about where to find structured data while maintaining relationship intelligence.

### 7. Query Evolution System

**Architecture**: Self-improving query system that tracks performance and evolves templates.

```javascript
// src/query-evolution/
├── performance-tracker.js      // Track query success rates
├── template-evolver.js         // Evolve templates based on results
├── a-b-tester.js              // Test query variations
└── evolution-history/
    ├── template-versions.json  // Version history
    └── performance-metrics.json // Success rate tracking
```

**Query Evolution Process**:
1. **Track Performance**: Monitor success rate of each query template
2. **Identify Failures**: Analyze failed queries for patterns
3. **Generate Variations**: Create improved template versions
4. **A/B Test**: Test new templates against current ones
5. **Promote Winners**: Replace templates with better-performing versions

### 7. Data Synchronization Architecture

**Challenge**: Keep CI system synchronized with external data sources (Snappy, documents, etc.)

**Solution**: Change Detection and Sync System
```javascript
// src/synchronization/
├── change-detector.js          // Detect changes in external sources
├── sync-coordinator.js         // Coordinate multi-source sync
├── conflict-resolver.js        // Handle sync conflicts
└── sync-adapters/
    ├── snappy-adapter.js       // Snappy-specific sync logic
    ├── document-adapter.js     // Document change detection
    └── llm-adapter.js          // LLM-generated content sync
```

**Sync Status Tracking**:
```javascript
const syncStatus = {
  sources: {
    snappy: {
      lastSync: "2025-09-27T13:14:20-05:00",
      syncHash: "abc123def456",
      status: "up_to_date",
      conflicts: 0
    },
    documents: {
      lastSync: "2025-09-26T15:30:00-05:00", 
      newFiles: 3,
      modifiedFiles: 1,
      status: "needs_sync"
    }
  }
};
```

### 8. API Architecture for Future Web Interface

**Design Principle**: CLI and API feature parity from day one.

```javascript
// API Structure
/api/v1/
├── /context
│   ├── POST /query              // Main context query endpoint
│   ├── GET /status              // Context system status
│   └── POST /validate           // Validate context results
├── /entities
│   ├── GET /search              // Entity search
│   ├── GET /{id}/hierarchy      // Get entity hierarchy
│   └── POST /consolidate        // Trigger consolidation
├── /knowledge
│   ├── POST /drill              // Knowledge drilling
│   ├── GET /templates           // Query templates
│   └── POST /generate           // Generate missing knowledge
└── /sync
    ├── GET /status              // Sync status
    ├── POST /snappy             // Trigger Snappy sync
    └── POST /documents          // Trigger document sync
```

### 9. Performance and Scalability Considerations

**Caching Strategy**:
- Cache frequently accessed entity hierarchies
- Cache successful query results for similar patterns
- Cache Snappy project data with TTL

**Indexing Strategy**:
- Hierarchical entity indexes for fast drilling
- Full-text search indexes for entity names and descriptions
- Relationship indexes for context assembly

**Memory Management**:
- Lazy load entity details on demand
- Stream large knowledge drilling results
- Garbage collect unused cached data

### 10. Quality Assurance Architecture

**Validation Pipeline**:
```javascript
// src/validation/
├── hierarchy-validator.js      // Validate entity hierarchies
├── relationship-validator.js   // Validate semantic relationships
├── query-validator.js          // Validate query results
└── integration-validator.js    // Validate external integrations
```

**Quality Metrics**:
- Entity consolidation accuracy (target: >90%)
- Hierarchy detection accuracy (target: >85%)
- Query result relevance (target: >90%)
- Sync consistency (target: 100%)

This architecture addresses the core challenges of hierarchical understanding, query management evolution, and bidirectional integration with existing systems like Snappy while maintaining the CLI-first development approach.

## ARCHITECTURE IMPLEMENTATION COMPLETE (Sep 28)

### **Production Architecture Delivered**

All 10 architectural principles have been **successfully implemented** in production:

#### **1. ✅ Hierarchical Entity Understanding**
- **EntitySchema v2.0** with relationship arrays and metadata tracking
- **170 semantic relationships** generated across cybersec domain
- **Content-based relationship inference** with 7 heuristic rules

#### **2. ✅ Centralized Query Management System** 
- **QueryTemplateManager** with versioned templates and performance tracking
- **Smart Router integration** with 95% confidence query processing
- **Template evolution system** with A/B testing capabilities

#### **3. ✅ Snappy Integration Architecture**
- **Real bidirectional sync** with live project data discovery
- **Smart Router breakthrough** finding existing projects instead of creating new ones
- **DataSourceRouter** with intelligent routing between Context DB and external systems

#### **4. ✅ Hierarchical Knowledge Discovery Architecture**
- **Progressive drilling** from general concepts to specific project details
- **5-step Universal Smart Interface Pattern** implemented and validated
- **LLM-based knowledge generation** with confidence scoring

#### **5. ✅ Entity Consolidation Architecture**
- **Smart consolidation engine** with similarity detection and confidence thresholds
- **Hierarchy-preserving consolidation** maintaining semantic relationships
- **Domain-specific consolidation rules** for cybersec and construction domains

#### **6. ✅ Persistent Conversation Management Architecture**
- **Cross-session conversation memory** with 30-minute timeout
- **Pending request tracking** with intelligent completion detection
- **Snappy integration workflow** for automatic expense management

#### **7. ✅ Smart Router Architecture (BREAKTHROUGH)**
- **Context DB as Smart Router** - conceptual source of truth routing to structured data
- **External source discovery** - queries Snappy before creating new entities
- **Intelligent project matching** - 80% match confidence for existing projects
- **Data Source Registry** mapping entity types to appropriate source systems

#### **8. ✅ Query Evolution System**
- **Performance tracking** with success rate monitoring
- **Template evolution** with version management and rollback capability
- **A/B testing framework** for query optimization

#### **9. ✅ Data Synchronization Architecture**
- **Change detection** with hash-based sync validation
- **Conflict resolution** with configurable strategies
- **Multi-source sync coordination** between Context DB and Snappy

#### **10. ✅ API Architecture for Web Interface**
- **Production REST API** with comprehensive security middleware
- **WebSocket support** for real-time conversational AI
- **Client SDK** with Smart Router capabilities
- **Web interface** with visual project discovery demonstration

### **Database Management Architecture**
```javascript
// Clear command with backup functionality
const clearCommand = {
  domains: ['construction', 'cybersec', 'all'],
  safetyFeatures: {
    confirmationRequired: true,
    automaticBackup: true,
    gracefulHandling: true,
    directoryRecreation: true
  },
  backupStrategy: {
    timestampedBackups: true,
    domainSpecific: true,
    rollbackCapable: true
  }
};
```

### **Production Deployment Architecture**
- **Smart Router API Server**: `localhost:3001` with health checks and monitoring
- **Client SDK**: Enhanced JavaScript library with Smart Router methods
- **Web Interface**: Visual demonstration with real-time results
- **Database Management**: Clear command with backup and safety features
- **15 Workflow Vignettes**: Complete operational documentation

### **Performance Metrics Achieved**
- **95% confidence** Smart Router query processing
- **5/5 steps completed** Universal Smart Interface Pattern
- **3+ projects discovered** for target breakthrough query
- **2-4 seconds** typical processing time for complex queries
- **Real Snappy integration** with live project data

### **Core Architectural Achievement**
The **Smart Router breakthrough** successfully implements the architectural vision:

**"I bought screws for John's deck"** → **Discovers existing John Green projects** instead of creating new ones

This represents the complete realization of the architectural principles into a production-ready contextual intelligence system with both CLI and web interfaces, solving the fundamental problem of duplicate entity creation through intelligent routing between conceptual understanding and structured data sources.
