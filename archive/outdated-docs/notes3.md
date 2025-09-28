# Entity Management System - User Experience Guide

## What You Can See and Do with Entities

This guide explains what you'll experience when working with entities in different scenarios, written in plain language.

---

## 1. Viewing Entities in the Network Visualization

### What You'll See
- **Entity Nodes**: Circles representing different entities (people, tools, locations, etc.)
- **Relationship Lines**: Connections between entities showing how they relate
- **Entity Labels**: Names or descriptions of each entity
- **Color Coding**: Different colors for different entity types (SIEM tools, people, locations)

### Current State (After Phase 1-4 Implementation)
- **SIEM Entities**: You'll see about 7-12 SIEM nodes instead of 40+ duplicates
- **SOC Analyst Entities**: About 5-24 analyst nodes (still being consolidated)
- **Relationship Network**: Lines connecting related entities (who manages what, what's located where)

### What You Can Do
- **Click on Nodes**: See detailed information about each entity
- **Hover for Details**: Quick preview of entity information
- **Zoom and Pan**: Navigate around the network to explore connections
- **Filter by Type**: Show only certain types of entities (people, tools, locations)

---

## 2. Entity Consolidation and Merging

### The Problem You're Solving
Instead of seeing:
- "SIEM System at Building A"
- "SIEM tool in datacenter"  
- "Security Information and Event Management platform"
- "Company SIEM solution"

### What You'll See After Consolidation
- **Single SIEM Entity**: One consolidated "SIEM Platform" node
- **Aggregated Information**: Combined details from all the duplicates
- **Cleaner Network**: Fewer nodes, clearer relationships
- **Accurate Counts**: Proper representation of actual unique entities

### What You Can Do
- **Auto-Merge**: Let the system automatically combine similar entities
- **Manual Review**: Approve or reject merge suggestions
- **Undo Merges**: Split entities back apart if they were incorrectly combined
- **Set Merge Rules**: Define how aggressive the consolidation should be

---

## 3. Natural Language Queries (Phase 3 Capability)

### What You Can Ask
Instead of navigating menus, you can ask questions like:
- *"Show me all SIEM systems and who manages them"*
- *"What security tools are located in Building A?"*
- *"Who are the SOC analysts working on incident response?"*
- *"What's the relationship between John and the firewall systems?"*

### What You'll Get Back
- **Direct Answers**: Plain English responses to your questions
- **Visual Updates**: The network view updates to highlight relevant entities
- **Context**: Understanding of relationships and connections
- **Action Suggestions**: Recommendations for next steps

---

## 4. Real-Time Conversations (Phase 4 API)

### Scenario: Project Management
**You**: *"I'm at John's office, add a $30 charge for network cables"*

**System Response**: 
- Identifies John's location and current project
- Creates a charge entry with proper context
- Updates project budget and timeline
- Shows related entities (John, office location, network project)

### What You'll Experience
- **Context Awareness**: System remembers where you are and what project you're working on
- **Smart Suggestions**: Recommendations based on current context
- **Automatic Updates**: Entity relationships update as you work
- **Conversation Flow**: Natural back-and-forth like talking to a knowledgeable assistant

---

## 5. Different Entity Types and What They Mean

### People Entities
- **What You'll See**: Names, roles, contact information
- **Relationships**: Who reports to whom, who works on what projects
- **Actions**: Assign tasks, track responsibilities, contact information

### Tool/System Entities (like SIEM)
- **What You'll See**: System names, versions, capabilities
- **Relationships**: Who manages them, where they're located, what they monitor
- **Actions**: Track maintenance, assign ownership, monitor status

### Location Entities
- **What You'll See**: Building names, room numbers, addresses
- **Relationships**: What's located there, who works there
- **Actions**: Track assets, plan visits, manage access

### Project Entities
- **What You'll See**: Project names, timelines, budgets
- **Relationships**: Who's involved, what resources are needed
- **Actions**: Track progress, manage costs, assign tasks

---

## 6. Entity Hierarchy and Categories

### Generic vs Specific Entities

**Generic Entity**: "Door Installation"
- Contains general knowledge about door installation
- Pricing guidelines, best practices, common issues

**Specific Instance**: "Door at 123 Main St, Room 201"
- Specific door at a specific location
- Actual measurements, installation date, cost

### What You Can Do
- **Browse Categories**: See all doors, all SIEM systems, all analysts
- **Drill Down**: Go from general category to specific instances
- **Cross-Reference**: See how generic knowledge applies to specific situations
- **Learn Patterns**: Understand common relationships and practices

---

## 7. Practical Scenarios

### Scenario A: Security Audit
**What You'll See**:
- All SIEM systems in your organization (consolidated view)
- Who manages each system
- What they monitor
- Where they're located

**What You Can Do**:
- Ask: *"Show me all security monitoring tools and their managers"*
- Click on any SIEM to see its details and relationships
- Generate reports on security coverage
- Identify gaps or redundancies

### Scenario B: Staff Management
**What You'll See**:
- All SOC analysts (consolidated, not 24 duplicates)
- Their skills and certifications
- What systems they manage
- Their current assignments

**What You Can Do**:
- Ask: *"Who can help with firewall configuration?"*
- Assign new responsibilities
- Track training and certifications
- Plan staffing for projects

### Scenario C: Asset Management
**What You'll See**:
- Physical and logical assets
- Where they're located
- Who's responsible for them
- Their relationships to projects and people

**What You Can Do**:
- Ask: *"What equipment is in Building A?"*
- Track maintenance schedules
- Plan equipment moves
- Manage warranties and contracts

---

## 8. The Big Picture: From Chaos to Clarity

### Before the System
- Scattered information in different systems
- Duplicate entries everywhere
- Hard to find who knows what
- Manual searching through documents
- Unclear relationships between things

### After Implementation (What You Get)
- **Single Source of Truth**: One place to find entity information
- **Clean Data**: Duplicates merged, relationships clear
- **Natural Interface**: Ask questions in plain English
- **Context Awareness**: System understands your current situation
- **Actionable Intelligence**: Not just data, but insights and suggestions

### Your Daily Experience
Instead of spending time searching and cross-referencing, you can:
- Ask questions and get immediate answers
- See visual representations of complex relationships
- Make decisions based on complete, accurate information
- Focus on your actual work instead of information management

---

## 9. Future Possibilities

As the system learns and grows, you'll be able to:
- **Predictive Insights**: "Based on patterns, you might need to replace this SIEM system soon"
- **Automated Workflows**: "I've automatically assigned the firewall maintenance to the available SOC analyst"
- **Intelligent Recommendations**: "Since you're at this location, here are the relevant ongoing projects"
- **Cross-Domain Intelligence**: Understanding connections between security, facilities, and projects

The goal is to make entity management invisible - you just work naturally, and the system handles the complexity behind the scenes.
