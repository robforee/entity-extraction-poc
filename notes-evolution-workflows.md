# Context Intelligence System - Workflow Vignettes

**PERSPECTIVE: OPERATIONAL WORKFLOWS**  
*Command sequences that demonstrate 100% system functionality without preamble or descriptions. Each vignette shows a complete workflow from data initialization to complex query resolution across construction and cybersecurity domains.*

alias context='node ~/analyst-server/entity-extraction-poc/context.js'
alias snappy='node ~/analyst-server/snappy/snappy.js'
## Vignette 1: "Fresh Start Discovery" - Initialize and Discover Existing Projects

```bash
# Clear context databases
# Initialize Smart Router with existing Snappy projects

context clear --domain construction --confirm  # clear construction database
context query "What projects does John have?"  # test contex retrieval from snappy
context sync snappy --pull --all-projects      # drill down into snappy and get everything
context query "Is Richards dryer duct project complete?"  # test contex retrieval from snappy

# Verify the raw data coming from the snappy.js source before syncing


context data projects --format json

context clear --domain cybersec --confirm



# Discover John's projects
context discover projects --person john
context query "What projects does John have?"

# Test Smart Router breakthrough
context query "I bought screws for John's deck"
```

## Vignette 2: "Project Context Assembly" - Build Complete Project Understanding

```bash
# Get detailed project context
context show project 20250923-43-john-green-deck --format json
context data costs --project 20250923-43-john-green-deck

# Query project relationships
context query "What materials are needed for John's deck project?"
context query "Who is working on the deck repair?"

# Add contextual information
context query "I'm at John's house, the deck needs more stain"
context query "Add $45 charge for deck stain"
```

## Vignette 3: "Expense Tracking Flow" - Complete Expense Management

```bash
# Start incomplete expense
context query "I bought materials at Home Depot"

# Check pending requests
context pending list
context pending summary

# Complete the expense
context query "The cost was $127.50 for lumber and screws"

# Verify Snappy integration
context sync snappy --check-status
node snappy.js show project 20250923-43-john-green-deck --format json
```

## Vignette 4: "Cybersecurity Knowledge Discovery" - Microsoft Defender Deep Dive

```bash
# Initialize cybersecurity knowledge
context generate knowledge "Microsoft Defender"
context drill "Microsoft Defender" --depth 3

# Query Defender capabilities
context query "What are Microsoft Defender modules?"
context query "How does Defender for Endpoint work?"

# Explore relationships
context entities relationships "Microsoft Defender"
context query "What security tools integrate with Defender?"
```

## Vignette 5: "SOC Operations Hierarchy" - Build Cybersecurity Org Structure

```bash
# Build SOC hierarchy
context entities hierarchy "SOC Analyst Level 2"
context generate knowledge "Security Operations Center"

# Query SOC structure
context query "What roles exist in a SOC?"
context query "Who manages SOC analysts?"

# Consolidate variations
context entities consolidate "SOC Analyst" --show-variations
context consolidate apply --domain cybersec --confidence-threshold 0.85
```

## Vignette 6: "Cross-Domain Intelligence" - Connect Construction and Security

```bash
# Query across domains
context query "What security tools does John use for his business?"
context query "How do I secure project management systems?"

# Generate cross-domain knowledge
context generate knowledge "Construction Project Security"
context drill "Project Management Security" --depth 2

# Explore connections
context discover relationships --entity "John" --domain both
```

## Vignette 7: "Progressive Knowledge Drilling" - Deep Technical Exploration

```bash
# Start with high-level concept
context query "What is network segmentation?"

# Drill progressively deeper
context drill "Network Segmentation" --depth 1
context drill "Network Segmentation" --depth 2
context drill "Network Segmentation" --depth 3

# Query specific implementations
context query "How does Palo Alto implement network segmentation?"
context query "What are VLAN segmentation best practices?"
```

## Vignette 8: "Template Evolution Testing" - Query Performance Optimization

```bash
# Test query templates
context queries list-templates --domain cybersec
context queries test-template "unknown_security_tool" --entity "Cisco ASA"

# Evaluate performance
context queries evaluate-performance --template "unknown_security_tool"
context queries performance-report --timeframe "last-week"

# Generate improved variants
context evolution generate-variants --template "unknown_security_tool" --count 3
context evolution a-b-test --template1 "v1.2" --template2 "v1.3"
```

## Vignette 9: "Relationship Validation Pipeline" - Quality Assurance

```bash
# Extract relationships from documents
context relationships extract --document ./docs/siem-config.md
context relationships extract --document ./snappy/projects/20250923-43-john-green-deck/bid.md

# Validate relationship quality
context relationships validate --domain cybersec
context relationships validate --domain construction

# Run comprehensive validation
context validate all --domain cybersec
context validate hierarchy-accuracy --target-threshold 0.85
context validate consolidation-accuracy --target-threshold 0.90
```

## Vignette 10: "API Integration Testing" - Production Readiness

```bash
# Start API server
context api start --port 3000 &

# Test API endpoints
curl -X POST http://localhost:3000/api/query -H "Content-Type: application/json" -d '{"query": "I bought screws for Johns deck"}'
curl -X POST http://localhost:3000/api/data/projects -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:3000/api/discover/projects -H "Content-Type: application/json" -d '{"person": "John"}'

# Validate API performance
context api performance-test --endpoint "/api/query" --concurrent 5
context api test-parity --endpoint "/api/query"
```

## Vignette 11: "Synchronization Workflow" - Multi-Source Data Management

```bash
# Check sync status across sources
context sync status --all-sources
context sync detect-changes --source snappy --since "2025-09-26"

# Perform bidirectional sync
context sync snappy --export-ci --project 20250923-43-john-green-deck
context sync snappy --pull-insights --project 20250923-43-john-green-deck

# Resolve conflicts
context sync resolve-conflicts --source snappy --strategy "ci-wins"
context validate sync-consistency --target-threshold 1.0
```

## Vignette 12: "Complete Intelligence Demonstration" - End-to-End Showcase

```bash
# Natural language project management
context query "I'm at John's house working on the deck"
context query "We need more screws and stain for the project"
context query "Add $85 charge for materials from Home Depot"

# Security analysis
context query "What endpoint protection does Microsoft Defender provide?"
context query "How do I configure Defender for construction business?"

# Cross-domain insights
context query "What are security risks for construction project management?"
context query "How do I protect customer project data?"

# Generate comprehensive reports
context report quality --domain construction --format json
context report quality --domain cybersec --format json
context report architecture-compliance --show-failures
```

## Vignette 13: "Smart Router Validation" - Architectural Breakthrough Testing

```bash
# Test Smart Router discovery vs creation
context query "I need to update John's bathroom project"
context query "Add materials to the kitchen remodel"
context query "Check status of the garage project"

# Validate external source integration
context discover projects --person "Richard Gonzales"
context data costs --project 20250910-43-richard-gonzales

# Test progressive drilling with external data
context drill "John Green Projects" --depth 2 --include-external
context connections show --entity "John Green" --include-snappy
```

## Vignette 14: "Performance and Scalability Testing" - System Limits

```bash
# Batch processing validation
context batch process --directory ./docs --domain cybersec --max-cost 5.00
context batch validate --check-relationships --confidence-threshold 0.8

# Concurrent query testing
context test concurrent --queries 10 --domain construction
context test concurrent --queries 10 --domain cybersec

# Memory and performance monitoring
context monitor start --duration 300
context query "Complex multi-domain analysis of John's security needs"
context monitor report --show-memory-usage
```

## Vignette 15: "Web Interface Navigation" - Smart Router GUI Workflow

### Step 1: Start the Smart Router API Server
```bash
# Terminal 1: Start the Smart Router API server
node test-smart-router-api.js
# Wait for: "✅ Server running on http://localhost:3001"
```

### Step 2: Open the Web Interface
```bash
# Open the Smart Router web interface
open web/smart-router-interface.html
# Or navigate to: file:///path/to/entity-extraction-poc/web/smart-router-interface.html
```

### Step 3: Navigate the Interface

**🎯 Test the Breakthrough Query:**
1. Click the **"🎯 Breakthrough Test"** button in the Quick Actions section
2. This auto-fills: "I bought screws for Johns deck" 
3. Watch the Smart Router discover existing John Green projects instead of creating new ones
4. Observe: 95% confidence, 3 projects found, 5/5 steps completed

**🔍 Discover John's Projects:**
1. Click the **"🔍 Discover Projects"** button
2. View all of John's projects with status badges and match confidence
3. See project types: Deck Demolition, Toilet Repair, Deck Repair, Combined projects

**📊 Get Structured Data:**
1. Click the **"📊 Get Project Data"** button  
2. View structured data routing results from Snappy integration
3. Check processing time and confidence metrics

**💰 Analyze Costs:**
1. Click the **"💰 Cost Analysis"** button
2. This queries: "What are the cost components for Johns deck?"
3. View cost analysis with project discovery and intelligent connections

**🔍 Custom Queries:**
1. Type in the query input field (examples):
   - "What materials are needed for the deck project?"
   - "I'm at John's house, add $45 for more lumber"
   - "Check status of Richard's dryer vent project"
2. Click **"🔍 Smart Query"** button
3. View comprehensive Smart Router results

### Step 4: Interpret Results

**Smart Router Processing Section:**
- **Steps Completed:** Should show 5/5 for full Universal Smart Interface Pattern
- **Confidence:** 95%+ indicates successful project discovery
- **Processing Time:** 2-4 seconds typical for complex queries

**Project Discoveries Section:**
- **Green badges:** Show number of projects found
- **Project cards:** Display project name, status, match confidence, creation date
- **Status badges:** Color-coded (green=completed, orange=in-progress, red=pending)

**Intelligent Connections Section:**
- **Entity connections:** Links between people, projects, materials
- **Temporal connections:** Time-based relationships and project timelines  
- **Spatial connections:** Location-based project relationships

**Smart Router Response:**
- **Breakthrough indicator:** Look for "discovered existing projects instead of creating new ones"
- **Project recommendations:** Suggestions for which existing project to use
- **Confidence scores:** Match percentages for project discovery

### Step 5: Validate Architectural Breakthrough

**Success Indicators:**
- ✅ Queries about "John's deck" find existing projects (not create new ones)
- ✅ Multiple John Green projects discovered with high match confidence
- ✅ Smart Router shows 5/5 steps completed consistently
- ✅ Processing includes both Context DB and external Snappy data
- ✅ Intelligent connections made between conceptual queries and structured data

**Error Indicators:**
- ❌ "Request failed" errors indicate API server not running
- ❌ 0% confidence or no projects found suggests Snappy integration issues
- ❌ Less than 5 steps completed indicates Smart Router processing problems
