# PCO_Inv

Production-grade chemical and equipment tracking system designed for Pest Control Operators.

## Overview

PCO_Inv is a **field-first inventory accountability system** that replaces informal tracking with a durable operational record. The system is designed to survive:

- Human error
- Poor connectivity
- Staff turnover
- Audits
- Time

## Core Design Principles

### 1. Inventory is History
Current inventory levels are derived from recorded events, never stored directly. Every change is explainable retroactively through the event log.

### 2. Every Unit Exists Somewhere
Nothing is "in limbo." Every item always belongs to a location or person. No implicit states.

### 3. Authority is Contextual
- Initiation ≠ Finalization
- Possession ≠ Ownership
- Visibility ≠ Permission

### 4. Offline Actions are First-Class
Offline operation is expected, not an error state. Deferred actions preserve intent and order. Recovery never creates ambiguity.

### 5. Units are Explicit
All quantities include units. Conversions are intentional and auditable. No implicit assumptions about quantity meaning.

## Documentation

### Architecture

- **[System Architecture](docs/architecture/SYSTEM_ARCHITECTURE.md)** - Complete system design covering domains, data models, and behaviors
- **[Invariants](docs/architecture/INVARIANTS.md)** - Inviolable system rules with verification procedures
- **[Offline Architecture](docs/architecture/OFFLINE_ARCHITECTURE.md)** - Detailed offline-first design and conflict resolution
- **[Workflows](docs/architecture/WORKFLOWS.md)** - Operational procedures for common tasks

### Schemas

- **[Core Types](docs/architecture/schemas/core-types.ts)** - TypeScript type definitions for all entities

## Key Domains

| Domain | Description |
|--------|-------------|
| **Products** | Tracked inventory types with lifecycle states, units, and regulatory requirements |
| **Locations** | Physical or logical places where inventory exists (warehouses, vehicles, technician stock) |
| **Events** | Immutable records of inventory changes (receives, transfers, issues, adjustments) |
| **Custody** | Chain of accountability tracking who is responsible for inventory |
| **Requests** | Approval workflows for controlled operations |
| **Disputes** | Resolution process for discrepancies between expected and actual inventory |

## Event-Sourced Model

All inventory changes are captured as events:

```
Receive → Transfer → Issue → Return → Dispose
              ↓
         Adjust (corrections)
              ↓
         Convert (unit changes)
```

Current inventory is computed by replaying events, enabling:
- Perfect audit trails
- Point-in-time queries ("What did we have last Tuesday?")
- No lost updates from concurrent modifications

## Offline Capabilities

The system is designed for field technicians working in areas with poor connectivity:

- **Local event queue** - Actions queue until sync
- **Sequence numbers** - Maintain order within device
- **Conflict detection** - Identify competing changes
- **Explicit resolution** - No silent data loss

## Compliance

Built for regulatory requirements:
- Chain of custody for restricted-use chemicals
- EPA reporting for regulated products
- Complete audit trails
- Configurable retention periods

## Status

**Phase: Architecture Definition**

The system architecture has been fully designed. Implementation pending.

---

*For questions or contributions, see the architecture documentation.*
