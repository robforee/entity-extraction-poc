# Advanced Entity Management & Visualization System

## 🎯 **Purpose**
Sophisticated multi-domain knowledge management system with hierarchical entity relationships, intelligent merging, and dynamic perspective views for construction, cybersecurity, and other domains.

## 🏗️ **Entity Hierarchy System**

### **Three-Tier Entity Model**
```javascript
// Entity designation types
const ENTITY_TYPES = {
  GENERIC: 'generic',        // "SIEM", "doors", "project management"
  PRODUCT: 'product',        // "Splunk SIEM", "Andersen Windows"  
  INSTANCE: 'instance'       // "Splunk at DataCenter-A", "Door-Room201-Building5"
};

// Entity schema with hierarchy support
const EntitySchema = {
  id: String,
  name: String,
  category: String,
  designation: ENTITY_TYPES,
  confidence: Number,
  parentId: String,          // Links to parent entity
  children: [String],        // Array of child entity IDs
  relationships: [{
    targetId: String,
    type: String,            // 'requires', 'uses', 'implements', 'located_at'
    strength: Number,
    temporal: Boolean        // 'precedes', 'depends_on', 'scheduled_for'
  }],
  metadata: {
    source: String,
    extractionDate: Date,
    lastUpdated: Date,
    mergeHistory: [String]   // Track merged entity IDs
  }
};
```

## 🔄 **Smart Entity Merging System**

### **Phase 1: Auto-Merge Engine**
```javascript
// src/merging/auto-merger.js
class AutoMerger {
  constructor() {
    this.mergeRules = new Map();
    this.confidenceThreshold = 0.9;
  }

  async findMergeCandidates(entities) {
    const candidates = [];
    
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const similarity = this.calculateSimilarity(entities[i], entities[j]);
        
        if (similarity.score > this.confidenceThreshold) {
          candidates.push({
            primary: entities[i],
            secondary: entities[j],
            similarity,
            autoMergeable: this.isAutoMergeable(entities[i], entities[j])
          });
        }
      }
    }
    
    return candidates;
  }

  calculateSimilarity(entity1, entity2) {
    return {
      nameMatch: this.calculateNameSimilarity(entity1.name, entity2.name),
      categoryMatch: entity1.category === entity2.category,
      designationMatch: entity1.designation === entity2.designation,
      contextSimilarity: this.calculateContextSimilarity(entity1, entity2),
      score: 0 // Weighted combination
    };
  }

  isAutoMergeable(entity1, entity2) {
    // Auto-merge rules based on designation and confidence
    return entity1.designation === entity2.designation &&
           entity1.category === entity2.category &&
           Math.abs(entity1.confidence - entity2.confidence) < 0.1;
  }
}
```

### **Phase 2: User-Guided Merge Interface**
```javascript
// web/js/merge-interface.js
class MergeInterface {
  constructor() {
    this.pendingMerges = [];
    this.mergeHistory = [];
  }

  showMergeCandidate(candidate) {
    return `
      <div class="merge-candidate">
        <div class="entity-comparison">
          <div class="entity-card primary">
            <h3>${candidate.primary.name}</h3>
            <p>Category: ${candidate.primary.category}</p>
            <p>Confidence: ${candidate.primary.confidence}</p>
            <p>Relationships: ${candidate.primary.relationships.length}</p>
          </div>
          <div class="merge-controls">
            <button onclick="mergEntities('${candidate.primary.id}', '${candidate.secondary.id}')">
              Merge →
            </button>
            <button onclick="rejectMerge('${candidate.primary.id}', '${candidate.secondary.id}')">
              Keep Separate
            </button>
          </div>
          <div class="entity-card secondary">
            <h3>${candidate.secondary.name}</h3>
            <p>Category: ${candidate.secondary.category}</p>
            <p>Confidence: ${candidate.secondary.confidence}</p>
            <p>Relationships: ${candidate.secondary.relationships.length}</p>
          </div>
        </div>
        <div class="merge-preview">
          <h4>Merge Result Preview:</h4>
          <p>Combined relationships: ${this.previewMergedRelationships(candidate)}</p>
          <p>Confidence score: ${this.calculateMergedConfidence(candidate)}</p>
        </div>
      </div>
    `;
  }
}
```

## 🎯 **Dynamic Perspective Views**

### **Phase 3: Selectable View Builder**
```javascript
// web/js/view-builder.js
class ViewBuilder {
  constructor() {
    this.availableViews = new Map();
    this.customViews = new Map();
  }

  createPerspectiveView(config) {
    const viewTypes = {
      'solution-centric': this.createSolutionCentricView,
      'project-centric': this.createProjectCentricView,
      'vendor-centric': this.createVendorCentricView,
      'location-centric': this.createLocationCentricView,
      'temporal-centric': this.createTemporalCentricView,
      'hierarchical': this.createHierarchicalView
    };

    return viewTypes[config.type](config);
  }

  createSolutionCentricView(config) {
    // SIEM → vendors → instances → materials
    return {
      centerEntity: config.solutionId,
      layout: 'radial',
      layers: [
        { type: 'product', radius: 150, label: 'Vendor Products' },
        { type: 'instance', radius: 300, label: 'Implementations' },
        { type: 'material', radius: 450, label: 'Required Materials' }
      ],
      relationships: ['implements', 'requires', 'uses']
    };
  }

  createProjectCentricView(config) {
    // Construction project → all related materials/vendors/people
    return {
      centerEntity: config.projectId,
      layout: 'clustered',
      clusters: [
        { type: 'people', position: 'top-left', label: 'Project Team' },
        { type: 'materials', position: 'top-right', label: 'Materials' },
        { type: 'vendors', position: 'bottom-left', label: 'Vendors' },
        { type: 'timeline', position: 'bottom-right', label: 'Schedule' }
      ],
      relationships: ['assigned_to', 'requires', 'supplies', 'scheduled_for']
    };
  }
}
```

### **Phase 4: Interactive View Controls**
```html
<!-- web/views/view-selector.html -->
<div class="view-selector">
  <h3>🎯 Create Custom View</h3>
  
  <div class="view-config">
    <div class="center-entity-selector">
      <label>Center Entity:</label>
      <input type="text" id="entity-search" placeholder="Search for entity...">
      <div id="entity-suggestions"></div>
    </div>
    
    <div class="view-type-selector">
      <label>View Type:</label>
      <select id="view-type">
        <option value="solution-centric">Solution-Centric (Hub & Spoke)</option>
        <option value="project-centric">Project-Centric (Clustered)</option>
        <option value="vendor-centric">Vendor-Centric (Product Tree)</option>
        <option value="location-centric">Location-Centric (Spatial)</option>
        <option value="temporal-centric">Temporal-Centric (Timeline)</option>
        <option value="hierarchical">Hierarchical (Tree)</option>
      </select>
    </div>
    
    <div class="relationship-filters">
      <label>Include Relationships:</label>
      <div class="checkbox-group">
        <label><input type="checkbox" value="requires"> Requires</label>
        <label><input type="checkbox" value="uses"> Uses</label>
        <label><input type="checkbox" value="implements"> Implements</label>
        <label><input type="checkbox" value="located_at"> Located At</label>
        <label><input type="checkbox" value="assigned_to"> Assigned To</label>
        <label><input type="checkbox" value="precedes"> Precedes</label>
      </div>
    </div>
    
    <div class="depth-control">
      <label>Relationship Depth:</label>
      <input type="range" id="depth-slider" min="1" max="5" value="2">
      <span id="depth-value">2 hops</span>
    </div>
    
    <button onclick="generateCustomView()">Generate View</button>
    <button onclick="saveCustomView()">Save View</button>
  </div>
</div>
```

## 🔗 **Enhanced Relationship Discovery**

### **Phase 5: Semantic Relationship Extraction**
```javascript
// src/relationships/semantic-extractor.js
class SemanticRelationshipExtractor {
  constructor() {
    this.relationshipPatterns = {
      requires: [
        /(\w+)\s+requires?\s+(\w+)/gi,
        /(\w+)\s+needs?\s+(\w+)/gi,
        /(\w+)\s+depends?\s+on\s+(\w+)/gi
      ],
      uses: [
        /(\w+)\s+uses?\s+(\w+)/gi,
        /(\w+)\s+utilizes?\s+(\w+)/gi,
        /(\w+)\s+employs?\s+(\w+)/gi
      ],
      implements: [
        /(\w+)\s+implements?\s+(\w+)/gi,
        /(\w+)\s+provides?\s+(\w+)/gi,
        /(\w+)\s+supports?\s+(\w+)/gi
      ]
    };
  }

  extractRelationships(text, entities) {
    const relationships = [];
    
    Object.entries(this.relationshipPatterns).forEach(([type, patterns]) => {
      patterns.forEach(pattern => {
        const matches = [...text.matchAll(pattern)];
        matches.forEach(match => {
          const source = this.findEntityByName(match[1], entities);
          const target = this.findEntityByName(match[2], entities);
          
          if (source && target) {
            relationships.push({
              source: source.id,
              target: target.id,
              type,
              confidence: this.calculateRelationshipConfidence(match, text),
              context: this.extractContext(match, text)
            });
          }
        });
      });
    });
    
    return relationships;
  }
}
```

## 📋 **Implementation Plan**

### **Phase 1: Entity Hierarchy Foundation (Week 1-2)**
1. **Update entity schema** with designation types and parent/child relationships
2. **Implement auto-merger** with similarity scoring and merge rules
3. **Create merge candidate detection** system
4. **Add entity designation UI** for marking generic/product/instance types

### **Phase 2: User-Guided Merging (Week 3-4)**
1. **Build merge interface** with side-by-side entity comparison
2. **Implement merge preview** showing combined relationships and confidence
3. **Add merge history tracking** and undo functionality
4. **Create merge approval workflow** with batch processing

### **Phase 3: Dynamic View System (Week 5-6)**
1. **Implement view builder** with configurable layouts and relationships
2. **Create perspective view types** (solution-centric, project-centric, etc.)
3. **Add interactive view controls** with entity search and relationship filters
4. **Build view save/load system** for custom view libraries

### **Phase 4: Enhanced Relationships (Week 7-8)**
1. **Implement semantic relationship extraction** from document text
2. **Add hierarchical relationship support** (parent-child, part-of)
3. **Create temporal relationship tracking** (precedes, depends_on, scheduled_for)
4. **Build relationship validation** and confidence scoring

### **Phase 5: Advanced Features (Week 9-10)**
1. **Add multi-domain support** with domain-specific entity rules
2. **Implement relationship inference** (if A requires B and B requires C, then A indirectly requires C)
3. **Create entity lifecycle management** (creation, updates, deprecation)
4. **Add export/import capabilities** for entity hierarchies and custom views

### **Success Criteria**
- ✅ **Smart entity merging** reduces duplicate SIEM instances to logical hierarchy
- ✅ **SIEM-material relationships** clearly visible through solution-centric views
- ✅ **Construction project management** with materials/vendors/people clustering
- ✅ **Custom view creation** through intuitive UI without pre-configuration
- ✅ **Multi-domain support** handles cybersecurity and construction use cases
- ✅ **Relationship discovery** automatically extracts semantic connections from text

This system will transform the current basic network visualization into a sophisticated knowledge management platform capable of handling complex real-world project data with intelligent entity organization and flexible exploration capabilities.
