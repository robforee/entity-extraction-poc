notes-entities.md

SOC Analysts - auto resolve plural

SOC Analyst Level 1
SOC Analyst Level 2
SOC Analyst Level 3

SOC - Analyst 1, Analyst 2, Analyst 3

SIEM
SIEM Architecture
SIEM - Architecture

Security Officer 
    vs Security Engineer 
    vs Security Manager (valid difference)

Incident Responder
    vs Incident Response Manager

merging document name
    never, it's a title


Entity Relationship Types (Cybersec Focus)
Spatial Relationships:

located_at: Firewall → 214-office
deployed_in: SIEM → Corporate Network
Functional Relationships:

uses: SOC Analyst → Splunk
implements: Network → Firewall Rules
manages: Security Engineer → SIEM Configuration
integrates_with: Firewall → SIEM
monitors: SIEM → Network Traffic
alerts_to: SIEM → SOC Analyst
Temporal Relationships:

configured_on: Firewall Config → 2025-09-10
last_updated: Project Status → 2025-09-23
active_during: John's Deck Project → 2025-09-15 to 2025-10-15
Ownership/Responsibility:

belongs_to: 214-office → User
assigned_to: John's Project → User
responsible_for: User → Firewall Management