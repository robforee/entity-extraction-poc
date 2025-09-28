# Universal Entity Types & Schema Definitions

## 🎯 **Purpose**
This document defines the universal entity types that the system will extract from communications across all knowledge domains. These domain-agnostic entities form the foundation of temporal intelligence and cross-domain insights.

## 🌍 **Universal Entity Categories**

### **1. Concepts**
Abstract ideas, theories, principles, or mental constructs across any domain.

```javascript
{
  "type": "concept",
  "id": "communication_preferences_2025",
  "name": "communication preferences",
  "domain": "human_development",
  "definition": "preferred methods and styles of information exchange",
  "evolution": [
    {
      "date": "2023-01",
      "understanding": "prefer email for formal communication",
      "confidence": 0.6,
      "source": "email_thread_jan_2023"
    },
    {
      "date": "2024-06", 
      "understanding": "email plus structured chat for different contexts",
      "confidence": 0.8,
      "source": "slack_discussion_june_2024"
    },
    {
      "date": "2025-09",
      "understanding": "contextual multi-modal communication based on content type",
      "confidence": 0.9,
      "source": "current_conversation"
    }
  ],
  "related_concepts": ["information_architecture", "user_experience", "decision_making"],
  "confidence": 0.9
}
```

### **2. Relationships**
Connections between concepts, people, ideas, or entities across domains.

```javascript
{
  "type": "relationship",
  "id": "cybersecurity_economics_policy_2024",
  "name": "cybersecurity threats impact economic policy",
  "relationship_type": "causal_influence",
  "source_concept": "cybersecurity_threats",
  "target_concept": "economic_policy_decisions",
  "strength": 0.8,
  "evidence": [
    {
      "date": "2024-03",
      "source": "email_discussion_security_budget",
      "description": "discussed how security breaches affect budget allocations"
    },
    {
      "date": "2024-08", 
      "source": "blog_post_cyber_economics",
      "description": "analyzed correlation between cyber incidents and policy changes"
    }
  ],
  "domains": ["cybersecurity", "economics", "politics"],
  "evolution": [
    {
      "date": "2024-01",
      "understanding": "weak connection between security and economics",
      "confidence": 0.4
    },
    {
      "date": "2024-08",
      "understanding": "strong causal relationship with policy implications",
      "confidence": 0.8
    }
  ]
}
```

### **3. Decisions**
Important choices made across any domain with rationale and implementation details.

```javascript
{
  "type": "decision",
  "id": "knowledge_system_architecture_2025",
  "title": "Universal Knowledge System Architecture Decision",
  "decision_date": "2025-09-20",
  "domain": "technology",
  "context": "building personal temporal intelligence system",
  "decision_makers": ["user"],
  "final_choice": {
    "approach": "domain_agnostic_entity_extraction",
    "storage": "temporal_json_with_concept_versioning",
    "intelligence": "cross_domain_pattern_recognition"
  },
  "alternatives_considered": [
    {
      "option": "construction_specific_system",
      "rejected_reason": "too_narrow_for_universal_knowledge_needs"
    },
    {
      "option": "traditional_database_approach", 
      "rejected_reason": "lacks_temporal_intelligence_capabilities"
    }
  ],
  "rationale": "Need system that tracks conceptual evolution across all knowledge domains",
  "implementation": {
    "phase_1": "universal_foundation",
    "phase_2": "intelligence_layer", 
    "phase_3": "universal_integration"
  },
  "impact": {
    "personal_knowledge": "transformative",
    "decision_making": "enhanced_cross_domain_insights",
    "learning": "temporal_concept_tracking"
  }
}
```

### **4. Schedule/Timeline Entities**
Time-sensitive events, deliveries, milestones, and deadlines.

```javascript
{
  "type": "schedule_event",
  "id": "lumber_delivery_sept_22",
  "title": "Deck Lumber Delivery",
  "event_type": "delivery",
  "project": "deck_construction",
  "date": "2025-09-22",
  "time_window": {
    "start": "08:00",
    "end": "12:00",
    "timezone": "CST"
  },
  "participants": [
    {"person": "rob_foree", "role": "recipient", "required": true},
    {"person": "mike_abc", "role": "contractor", "required": false}
  ],
  "details": {
    "supplier": "Home Depot Pro",
    "contact": "(512) 555-0199",
    "items": [
      {"item": "2x10 pressure-treated joists", "quantity": 16},
      {"item": "5/4 oak decking boards", "quantity": 24}
    ],
    "delivery_location": "backyard_gate",
    "special_instructions": "Rob will be present"
  },
  "dependencies": [
    {"event": "foundation_prep", "status": "completed"},
    {"event": "permit_approval", "status": "completed"}
  ],
  "weather_considerations": {
    "forecast": "20% chance rain",
    "impact": "delivery_can_proceed_unless_heavy_rain"
  }
}
```

### **5. Vendor/Contractor Entities**
External parties providing services or materials.

```javascript
{
  "type": "vendor",
  "id": "abc_construction",
  "name": "ABC Construction",
  "type": "general_contractor",
  "contact": {
    "primary_contact": "Mike Johnson",
    "phone": "(512) 555-0123",
    "email": "mike@abcconstruction.com",
    "address": "123 Builder St, Austin, TX"
  },
  "specialties": ["residential_renovation", "flooring", "electrical"],
  "current_projects": ["master_bedroom_renovation", "deck_construction"],
  "communication_preferences": {
    "preferred_method": "phone",
    "response_time": "2_hours",
    "working_hours": "07:00-18:00 CST"
  },
  "performance_history": {
    "reliability_rating": 4.8,
    "on_time_delivery": 0.95,
    "quality_rating": 4.7,
    "previous_projects": [
      {"project": "kitchen_renovation_2024", "outcome": "excellent"},
      {"project": "bathroom_remodel_2023", "outcome": "excellent"}
    ]
  },
  "financial": {
    "payment_terms": "net_30",
    "insurance": "verified",
    "license": "TX-12345",
    "bonded": true
  }
}
```

### **6. Material/Resource Entities**
Physical materials, tools, and resources used in projects.

```javascript
{
  "type": "material",
  "id": "oak_decking_boards_sept_2025",
  "name": "Oak Decking Boards",
  "project": "deck_construction",
  "category": "lumber",
  "specifications": {
    "material": "oak",
    "dimensions": "5/4 x 6 x 12",
    "grade": "premium",
    "treatment": "none"
  },
  "quantity": {
    "ordered": 24,
    "unit": "boards",
    "coverage": "240_sq_ft"
  },
  "supplier": {
    "vendor": "home_depot_pro",
    "order_number": "HD-2025-9876",
    "order_date": "2025-09-15"
  },
  "delivery": {
    "scheduled_date": "2025-09-22",
    "delivery_window": "08:00-12:00",
    "status": "confirmed"
  },
  "cost": {
    "unit_price": 45.00,
    "total_cost": 1080.00,
    "currency": "USD"
  },
  "usage": {
    "installation_date": "2025-09-25",
    "installer": "mike_abc",
    "location": "back_deck"
  }
}
```

### **7. Communication/Message Entities**
Important communications that need to be preserved and referenced.

```javascript
{
  "type": "communication",
  "id": "sms_lumber_confirmation_sept_19",
  "communication_type": "sms",
  "date": "2025-09-19T14:30:00-05:00",
  "participants": [
    {"person": "home_depot_supplier", "role": "sender"},
    {"person": "rob_foree", "role": "recipient"}
  ],
  "subject": "Lumber Delivery Confirmation",
  "content": "Delivery confirmed Tuesday 8 AM for oak decking boards",
  "project": "deck_construction",
  "related_entities": [
    {"type": "schedule_event", "id": "lumber_delivery_sept_22"},
    {"type": "material", "id": "oak_decking_boards_sept_2025"}
  ],
  "action_items": [
    {"action": "be_present_for_delivery", "assignee": "rob_foree", "due": "2025-09-22T08:00"}
  ],
  "importance": "high",
  "archived": false
}
```

### **8. Location Entities**
Physical spaces and areas where work is being performed.

```javascript
{
  "type": "location",
  "id": "master_bedroom",
  "name": "Master Bedroom",
  "location_type": "interior_room",
  "address": "123 Main St, Austin, TX",
  "dimensions": {
    "length": 14,
    "width": 12,
    "height": 9,
    "unit": "feet"
  },
  "current_projects": ["master_bedroom_renovation"],
  "access_requirements": {
    "entry_method": "main_hallway",
    "restrictions": "remove_furniture_first",
    "safety_considerations": ["dust_protection", "ventilation"]
  },
  "utilities": {
    "electrical": "110v_outlets_available",
    "plumbing": "none",
    "hvac": "central_air_vent"
  },
  "current_condition": {
    "flooring": "subfloor_exposed",
    "walls": "primed_ready_for_paint",
    "ceiling": "completed"
  }
}
```

## 🔗 **Entity Relationships**

### **Relationship Types**
- **owns**: Person owns Project
- **works_on**: Person works on Project
- **supplies**: Vendor supplies Material
- **uses**: Project uses Material
- **located_at**: Project located at Location
- **decides**: Person decides Decision
- **affects**: Decision affects Project
- **scheduled_for**: Event scheduled for Project
- **depends_on**: Event depends on Event

### **Relationship Schema**
```javascript
{
  "relationship": {
    "type": "works_on",
    "source": {"type": "person", "id": "mike_abc"},
    "target": {"type": "project", "id": "master_bedroom_renovation"},
    "properties": {
      "role": "general_contractor",
      "start_date": "2025-08-15",
      "responsibility": "overall_execution"
    }
  }
}
```

## 📊 **Universal Entity Extraction Priorities**

### **Phase 1 (Critical - Universal Foundation)**
1. **Concepts** - What ideas are being discussed across domains?
2. **Relationships** - How do concepts connect across knowledge areas?
3. **Decisions** - What choices are being made and why?
4. **Patterns** - What thinking and decision-making patterns emerge?

### **Phase 2 (Important - Intelligence Layer)**
5. **Questions** - What are you exploring or uncertain about?
6. **Intuitions** - What hunches or emerging thoughts are developing?
7. **Vocabulary** - What new terms or definitions are evolving?
8. **Temporal Markers** - How do concepts change over time?

### **Phase 3 (Advanced - Cross-Domain Intelligence)**
9. **Cross-Domain Connections** - How do insights bridge different knowledge areas?
10. **Predictive Patterns** - What directions is your thinking heading?

## 🎯 **Universal Extraction Success Criteria**

### **Minimum Viable**
- Extract Concepts, Relationships, Decisions, Patterns with >80% accuracy across domains
- Identify basic connections between concepts across knowledge areas
- Handle terminology from construction, human development, economics, politics, science, technology, cybersecurity

### **Target Goals**
- Extract all universal entity types with >90% accuracy
- Capture complex cross-domain relationships and temporal evolution
- Track vocabulary development and concept refinement over time

### **Stretch Goals**
- Extract implicit concepts and emerging ideas from context
- Predict conceptual development directions based on patterns
- Synthesize better vocabulary for ideas you're "groping for"

## 🔧 **Implementation Notes**

### **Entity ID Generation**
- Use descriptive, human-readable IDs
- Include date/project context where relevant
- Ensure uniqueness across all entity types

### **Validation Rules**
- Required fields must be present
- Dates must be valid and properly formatted
- Relationships must reference existing entities
- Numeric values must be within reasonable ranges

### **Storage Considerations**
- Entities should be stored in separate files by type
- Large entities may need pagination
- Relationships stored separately from entities
- Version history maintained for entity changes

**These universal entity types provide the structured foundation for temporal intelligence across all knowledge domains, enabling personal knowledge archaeology and conceptual evolution tracking.** 🧠
