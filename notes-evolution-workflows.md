# Context Intelligence System - Workflow Vignettes

**PERSPECTIVE: OPERATIONAL WORKFLOWS**  
*Command sequences that demonstrate 100% system functionality without preamble or descriptions. Each vignette shows a complete workflow from data initialization to complex query resolution across construction and cybersecurity domains.*

## Vignette 1: "Fresh Start Discovery" - Initialize and Discover Existing Projects

```bash
# Initialize Smart Router with existing Snappy projects
node context.js sync snappy --pull --all-projects
node context.js data projects --format json

# Discover John's projects
node context.js discover projects --person john
node context.js query "What projects does John have?"

# Test Smart Router breakthrough
node context.js query "I bought screws for John's deck"
```

## Vignette 2: "Project Context Assembly" - Build Complete Project Understanding

```bash
# Get detailed project context
node context.js show project 20250923-43-john-green-deck --format json
node context.js data costs --project 20250923-43-john-green-deck

# Query project relationships
node context.js query "What materials are needed for John's deck project?"
node context.js query "Who is working on the deck repair?"

# Add contextual information
node context.js query "I'm at John's house, the deck needs more stain"
node context.js query "Add $45 charge for deck stain"
```

## Vignette 3: "Expense Tracking Flow" - Complete Expense Management

```bash
# Start incomplete expense
node context.js query "I bought materials at Home Depot"

# Check pending requests
node context.js pending list
node context.js pending summary

# Complete the expense
node context.js query "The cost was $127.50 for lumber and screws"

# Verify Snappy integration
node context.js sync snappy --check-status
node snappy.js show project 20250923-43-john-green-deck --format json
```

## Vignette 4: "Cybersecurity Knowledge Discovery" - Microsoft Defender Deep Dive

```bash
# Initialize cybersecurity knowledge
node context.js generate knowledge "Microsoft Defender"
node context.js drill "Microsoft Defender" --depth 3

# Query Defender capabilities
node context.js query "What are Microsoft Defender modules?"
node context.js query "How does Defender for Endpoint work?"

# Explore relationships
node context.js entities relationships "Microsoft Defender"
node context.js query "What security tools integrate with Defender?"
```

## Vignette 5: "SOC Operations Hierarchy" - Build Cybersecurity Org Structure

```bash
# Build SOC hierarchy
node context.js entities hierarchy "SOC Analyst Level 2"
node context.js generate knowledge "Security Operations Center"

# Query SOC structure
node context.js query "What roles exist in a SOC?"
node context.js query "Who manages SOC analysts?"

# Consolidate variations
node context.js entities consolidate "SOC Analyst" --show-variations
node context.js consolidate apply --domain cybersec --confidence-threshold 0.85
```

## Vignette 6: "Cross-Domain Intelligence" - Connect Construction and Security

```bash
# Query across domains
node context.js query "What security tools does John use for his business?"
node context.js query "How do I secure project management systems?"

# Generate cross-domain knowledge
node context.js generate knowledge "Construction Project Security"
node context.js drill "Project Management Security" --depth 2

# Explore connections
node context.js discover relationships --entity "John" --domain both
```

## Vignette 7: "Progressive Knowledge Drilling" - Deep Technical Exploration

```bash
# Start with high-level concept
node context.js query "What is network segmentation?"

# Drill progressively deeper
node context.js drill "Network Segmentation" --depth 1
node context.js drill "Network Segmentation" --depth 2
node context.js drill "Network Segmentation" --depth 3

# Query specific implementations
node context.js query "How does Palo Alto implement network segmentation?"
node context.js query "What are VLAN segmentation best practices?"
```

## Vignette 8: "Template Evolution Testing" - Query Performance Optimization

```bash
# Test query templates
node context.js queries list-templates --domain cybersec
node context.js queries test-template "unknown_security_tool" --entity "Cisco ASA"

# Evaluate performance
node context.js queries evaluate-performance --template "unknown_security_tool"
node context.js queries performance-report --timeframe "last-week"

# Generate improved variants
node context.js evolution generate-variants --template "unknown_security_tool" --count 3
node context.js evolution a-b-test --template1 "v1.2" --template2 "v1.3"
```

## Vignette 9: "Relationship Validation Pipeline" - Quality Assurance

```bash
# Extract relationships from documents
node context.js relationships extract --document ./docs/siem-config.md
node context.js relationships extract --document ./snappy/projects/20250923-43-john-green-deck/bid.md

# Validate relationship quality
node context.js relationships validate --domain cybersec
node context.js relationships validate --domain construction

# Run comprehensive validation
node context.js validate all --domain cybersec
node context.js validate hierarchy-accuracy --target-threshold 0.85
node context.js validate consolidation-accuracy --target-threshold 0.90
```

## Vignette 10: "API Integration Testing" - Production Readiness

```bash
# Start API server
node context.js api start --port 3000 &

# Test API endpoints
curl -X POST http://localhost:3000/api/query -H "Content-Type: application/json" -d '{"query": "I bought screws for Johns deck"}'
curl -X POST http://localhost:3000/api/data/projects -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:3000/api/discover/projects -H "Content-Type: application/json" -d '{"person": "John"}'

# Validate API performance
node context.js api performance-test --endpoint "/api/query" --concurrent 5
node context.js api test-parity --endpoint "/api/query"
```

## Vignette 11: "Synchronization Workflow" - Multi-Source Data Management

```bash
# Check sync status across sources
node context.js sync status --all-sources
node context.js sync detect-changes --source snappy --since "2025-09-26"

# Perform bidirectional sync
node context.js sync snappy --export-ci --project 20250923-43-john-green-deck
node context.js sync snappy --pull-insights --project 20250923-43-john-green-deck

# Resolve conflicts
node context.js sync resolve-conflicts --source snappy --strategy "ci-wins"
node context.js validate sync-consistency --target-threshold 1.0
```

## Vignette 12: "Complete Intelligence Demonstration" - End-to-End Showcase

```bash
# Natural language project management
node context.js query "I'm at John's house working on the deck"
node context.js query "We need more screws and stain for the project"
node context.js query "Add $85 charge for materials from Home Depot"

# Security analysis
node context.js query "What endpoint protection does Microsoft Defender provide?"
node context.js query "How do I configure Defender for construction business?"

# Cross-domain insights
node context.js query "What are security risks for construction project management?"
node context.js query "How do I protect customer project data?"

# Generate comprehensive reports
node context.js report quality --domain construction --format json
node context.js report quality --domain cybersec --format json
node context.js report architecture-compliance --show-failures
```

## Vignette 13: "Smart Router Validation" - Architectural Breakthrough Testing

```bash
# Test Smart Router discovery vs creation
node context.js query "I need to update John's bathroom project"
node context.js query "Add materials to the kitchen remodel"
node context.js query "Check status of the garage project"

# Validate external source integration
node context.js discover projects --person "Richard Gonzales"
node context.js data costs --project 20250910-43-richard-gonzales

# Test progressive drilling with external data
node context.js drill "John Green Projects" --depth 2 --include-external
node context.js connections show --entity "John Green" --include-snappy
```

## Vignette 14: "Performance and Scalability Testing" - System Limits

```bash
# Batch processing validation
node context.js batch process --directory ./docs --domain cybersec --max-cost 5.00
node context.js batch validate --check-relationships --confidence-threshold 0.8

# Concurrent query testing
node context.js test concurrent --queries 10 --domain construction
node context.js test concurrent --queries 10 --domain cybersec

# Memory and performance monitoring
node context.js monitor start --duration 300
node context.js query "Complex multi-domain analysis of John's security needs"
node context.js monitor report --show-memory-usage
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
