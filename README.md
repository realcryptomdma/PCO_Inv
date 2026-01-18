# PCO_Inv

Production-grade chemical and equipment tracking system designed for Pest Control Operators.

---

## Overview

PCO_Inv is a **field-first inventory accountability system** that replaces informal tracking with a durable operational record. The system is designed to survive:

- Human error
- Poor connectivity
- Staff turnover
- Audits
- Time

---

## Quick Links

| Document | Description |
|----------|-------------|
| [Product Requirements](docs/PRD.md) | Complete PRD with features and acceptance criteria |
| [Implementation Roadmap](docs/ROADMAP.md) | Phased technical implementation plan |
| [System Architecture](docs/architecture/SYSTEM_ARCHITECTURE.md) | Domain models, data flows, and behaviors |
| [Invariants](docs/architecture/INVARIANTS.md) | Inviolable system rules |
| [Offline Architecture](docs/architecture/OFFLINE_ARCHITECTURE.md) | Offline-first design and sync |
| [Workflows](docs/architecture/WORKFLOWS.md) | Operational procedures |
| [UI Design System](docs/design/UI_DESIGN_SYSTEM.md) | Visual language and components |
| [Prototype Analysis](docs/analysis/PROTOTYPE_ANALYSIS.md) | Extracted patterns from reference UI |
| [Type Definitions](docs/architecture/schemas/core-types.ts) | TypeScript interfaces |

---

## Core Principles

### The Five Laws

These rules are **ABSOLUTE** and must never be violated:

#### 1. Inventory is History

```
Current inventory = Σ(all events)
```

- Inventory levels are **derived from events**, never stored directly
- No direct editing of quantities—all changes are events
- Every change must be explainable retroactively

#### 2. Every Unit Exists Somewhere

- Nothing is "in limbo" or "in transit"
- Every item belongs to exactly one location at any time
- Transfers are atomic—instantaneous from the system's perspective

#### 3. Authority is Contextual

- **Initiation ≠ Finalization** (who starts isn't who approves)
- **Possession ≠ Ownership** (holding doesn't mean owning)
- **Visibility ≠ Permission** (seeing doesn't mean acting)

#### 4. Offline Actions are First-Class

- Offline is **expected**, not an error state
- Deferred actions preserve intent and order
- Recovery never creates ambiguity—conflicts are explicit

#### 5. Units are Explicit

- All quantities include units: `{ value: 5, unit: 'oz' }`
- No bare numbers without context
- Conversions are intentional and auditable

---

## Architecture Rules

### Data Rules

| Rule | Enforcement |
|------|-------------|
| Events are append-only | No UPDATE/DELETE on event table |
| IDs are UUIDs | No sequential integers for entities |
| Timestamps are dual | Both `occurredAt` (claimed) and `recordedAt` (actual) |
| Foreign keys are enforced | Database-level referential integrity |
| Soft deletes only | Status fields, never physical deletion |

### API Rules

| Rule | Enforcement |
|------|-------------|
| REST with OpenAPI spec | All endpoints documented |
| Idempotent operations | Client-generated UUIDs for creates |
| Permission checks server-side | Never trust client assertions |
| Pagination required | Max 100 items per request |
| Rate limiting | Per-user and per-endpoint limits |

### Mobile Rules

| Rule | Enforcement |
|------|-------------|
| Offline-first | All reads from local cache |
| Optimistic updates | Immediate UI feedback, sync later |
| Sequence numbers | Monotonic per device for ordering |
| Explicit sync status | User always knows sync state |
| Conflict resolution UI | Never auto-merge conflicts |

---

## UI/UX Rules

### Design Mandates

1. **Mobile-first**: Design for 375px, enhance up
2. **Thumb zone**: Primary actions in bottom 40% of screen
3. **Glanceable**: Key info visible without scrolling
4. **Role-appropriate**: Only show what user can act on
5. **Dark mode**: Full support, not an afterthought

### Component Rules

| Component | Rule |
|-----------|------|
| Buttons | Min 44px touch target, full-width on mobile |
| Cards | 12px border radius, consistent padding |
| Modals | Slide from bottom, max 90vh height |
| Toasts | Top position, auto-dismiss 3s, swipe to dismiss |
| Forms | Labels above inputs, inline validation |

### Color Rules

| Usage | Light | Dark |
|-------|-------|------|
| Primary action | emerald-600 | emerald-500 |
| Destructive | red-600 | red-500 |
| Background | gray-50 | gray-900 |
| Card | white | gray-800 |
| Border | gray-200 | gray-700 |

### Status Colors (Consistent Everywhere)

| Status | Badge Color |
|--------|-------------|
| Pending | amber |
| Approved | blue |
| Denied | red |
| Ready | emerald |
| Awaiting | purple |
| Complete | gray |

---

## Permission System

### Roles

| Role | Scope | Key Permissions |
|------|-------|-----------------|
| Technician | Own requests | view_products, create_requests |
| Warehouse | Assigned locations | fulfill_requests, view_all_requests |
| Manager | Assigned locations | approve_requests, view_cost, edit_products |
| Admin | Global | All permissions |

### Permission Categories

| Category | Permissions |
|----------|-------------|
| Products | view_products, edit_products |
| Inventory | view_inventory |
| Financial | view_cost |
| Requests | create_requests, approve_requests, fulfill_requests, view_all_requests |
| Administration | manage_users, manage_settings, manage_locations |

### Visibility Rules

```
Technician sees: Own requests only
Warehouse sees:  Requests from assigned warehouses
Manager sees:    Requests from assigned warehouses + costs
Admin sees:      Everything
```

---

## Workflow System

### Request Flow

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  Approval   │ → │ Fulfillment │ → │   Pickup    │ → │   Ack       │
│  (Manager)  │   │ (Warehouse) │   │   (Tech)    │   │  (Tech)     │
└─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘
     ↓ Skip?           ↓ Skip?           ↓ Skip?           ↓ Skip?
```

Each step is independently configurable.

### Workflow Presets

| Preset | Steps Enabled |
|--------|---------------|
| Full | Approval → Fulfillment → Pickup → Acknowledgment |
| In-Person | Approval only |
| Self-Service | Acknowledgment only |

---

## Event Types

| Event | From | To | Description |
|-------|------|-----|-------------|
| receive | — | Location | Entry from supplier |
| transfer | Location A | Location B | Internal movement |
| issue | Location | ServiceSite | Used at customer |
| return | ServiceSite | Location | Unused returned |
| consume | Location | — | Used up (internal) |
| adjust | Location | Location | Correction |
| convert | Location | Location | Unit change |
| quarantine | Location | Quarantine | Suspect isolated |
| dispose | Location | Disposal | End of life |
| count | Location | Location | Physical verification |

---

## Coding Standards

### TypeScript

```typescript
// ✓ DO: Use branded types for IDs
type ProductID = Brand<string, 'ProductID'>;

// ✗ DON'T: Use plain strings for IDs
const productId: string = '...';

// ✓ DO: Explicit quantities
interface Quantity {
  value: number;
  unit: UnitCode;
}

// ✗ DON'T: Bare numbers
const quantity: number = 5;

// ✓ DO: Discriminated unions for events
type InventoryEvent =
  | ReceiveEvent
  | TransferEvent
  | IssueEvent;

// ✗ DON'T: Giant union types with optional fields
```

### React

```typescript
// ✓ DO: Compound component pattern
<Card>
  <Card.Header>Title</Card.Header>
  <Card.Body>Content</Card.Body>
</Card>

// ✗ DON'T: Prop soup
<Card
  title="Title"
  showHeader={true}
  headerVariant="large"
  content="Content"
  ...
/>

// ✓ DO: Custom hooks for logic
const { inventory, loading, error } = useLocationInventory(locationId);

// ✗ DON'T: Logic in components
const [inventory, setInventory] = useState([]);
useEffect(() => { fetchInventory().then(setInventory) }, []);
```

### API

```typescript
// ✓ DO: Consistent response shape
interface ApiResponse<T> {
  data: T;
  meta?: {
    pagination?: Pagination;
  };
}

// ✓ DO: Consistent error shape
interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

// ✓ DO: Use HTTP status codes correctly
// 200 = Success
// 201 = Created
// 400 = Bad Request (validation)
// 401 = Unauthorized
// 403 = Forbidden
// 404 = Not Found
// 409 = Conflict
// 500 = Server Error
```

---

## File Structure

```
/docs
  /analysis          # Prototype analysis
  /architecture      # System design
    /schemas         # TypeScript definitions
  /design            # UI/UX specifications
  PRD.md             # Product requirements
  ROADMAP.md         # Implementation plan

/packages            # (future)
  /api               # Backend service
  /mobile            # React Native app
  /shared            # Shared types
  /web               # Admin dashboard
```

---

## Development Workflow

### Branch Naming

```
feature/ABC-123-short-description
bugfix/ABC-123-short-description
hotfix/ABC-123-short-description
```

### Commit Messages

```
type(scope): description

- feat: New feature
- fix: Bug fix
- docs: Documentation
- style: Formatting
- refactor: Code restructure
- test: Tests
- chore: Maintenance
```

### PR Requirements

- [ ] Linked to issue/ticket
- [ ] Tests pass
- [ ] No new linting errors
- [ ] Documentation updated
- [ ] Screenshots for UI changes

---

## Testing Requirements

| Layer | Coverage Target | Tools |
|-------|-----------------|-------|
| Unit | 80%+ | Jest, Testing Library |
| Integration | Key flows | Supertest |
| E2E | Critical paths | Detox (mobile), Playwright (web) |
| Manual | New features | QA checklist |

### Required Test Scenarios

- [ ] Happy path for each workflow
- [ ] Offline operation for 72 hours
- [ ] Conflict detection and resolution
- [ ] Permission denial for each role
- [ ] Expiration blocking
- [ ] Concurrent operations

---

## Deployment

### Environments

| Environment | Purpose | URL Pattern |
|-------------|---------|-------------|
| Development | Local dev | localhost:* |
| Staging | Pre-production | staging.pco-inv.* |
| Production | Live | app.pco-inv.* |

### Release Checklist

- [ ] All tests pass
- [ ] Database migrations tested
- [ ] API backwards compatible
- [ ] Mobile app version bumped
- [ ] Release notes prepared
- [ ] Rollback plan documented

---

## Security Requirements

| Requirement | Implementation |
|-------------|----------------|
| Authentication | OAuth 2.0 / OIDC |
| Authorization | RBAC, server-enforced |
| Data at rest | AES-256 encryption |
| Data in transit | TLS 1.3 |
| Secrets | Environment variables, never in code |
| Audit logging | All actions with user/timestamp |

---

## Compliance

### EPA Requirements (for restricted-use pesticides)

- [ ] Applicator certification recorded
- [ ] Application location recorded
- [ ] Quantity applied recorded
- [ ] Date and time recorded
- [ ] Records retained 3+ years

### Data Retention

| Data Type | Retention |
|-----------|-----------|
| Inventory events | 7 years |
| Restricted-use events | 10 years |
| Access logs | 2 years |
| Disputes | 7 years or resolution + 3 years |

---

## Contributing

1. Read this README completely
2. Review relevant architecture docs
3. Follow coding standards
4. Write tests
5. Update documentation
6. Submit PR with description

---

## Support

- Issues: [GitHub Issues](https://github.com/realcryptomdma/PCO_Inv/issues)
- Documentation: See `/docs` folder

---

## Status

**Phase: Architecture Definition**

The system architecture and product requirements have been fully documented. Implementation begins with Phase 1 (Foundation).

---

*Last Updated: 2026-01-18*
