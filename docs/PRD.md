# Product Requirements Document (PRD)

## PCO Inventory Accountability System

**Version:** 1.0
**Status:** Draft
**Owner:** Product Architecture Team
**Last Updated:** 2026-01-18

---

## 1. Executive Summary

### 1.1 Problem Statement

Pest control operators (PCOs) lack a reliable system to track chemical and equipment inventory across field operations. Current challenges include:

- **Lost accountability**: No clear chain of custody for regulated chemicals
- **Offline blind spots**: Field technicians work without connectivity but need to record usage
- **Audit failures**: Inability to reconstruct "what was where when"
- **Informal processes**: Spreadsheets and paper logs that don't survive staff turnover
- **Regulatory risk**: EPA requires accurate records for restricted-use pesticides

### 1.2 Solution Overview

A **mobile-first, offline-capable inventory accountability system** that:

1. Records all inventory changes as immutable events
2. Maintains custody chains from receipt to application
3. Works fully offline with deterministic sync
4. Provides complete audit trails for regulatory compliance
5. Supports configurable multi-step request/approval workflows

### 1.3 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Audit pass rate | 100% | No unexplainable inventory discrepancies |
| Offline operation time | 72+ hours | System functions without sync |
| Time to onboard new user | < 15 minutes | From account creation to first request |
| Inventory accuracy | > 99% | Physical count vs system within 1% |
| System availability | 99.9% | Uptime excluding planned maintenance |

---

## 2. User Personas

### 2.1 Technician (Primary User)

**Profile:**
- Works in the field 8-10 hours/day
- Often in basements, attics, rural areas (poor connectivity)
- Uses smartphone (Android/iOS) as primary device
- Limited technical sophistication
- High time pressure between service calls

**Goals:**
- Quickly record product usage at each job
- Request restocks before running out
- Know what's in their vehicle inventory
- Avoid paperwork that slows them down

**Pain Points:**
- "I forget to log what I used until end of day"
- "The app doesn't work when I'm in a basement"
- "I don't know what's actually in my truck"

### 2.2 Warehouse Staff

**Profile:**
- Based at branch location
- Manages physical inventory
- Processes restock requests
- Receives shipments from suppliers

**Goals:**
- See all pending requests in queue
- Fulfill requests efficiently (batch preparation)
- Know when stock is running low
- Track what goes out to which tech

**Pain Points:**
- "Requests come in from everywhere, hard to prioritize"
- "Techs show up expecting stuff I don't have"
- "I find out we're out of stock when someone needs it"

### 2.3 Branch Manager

**Profile:**
- Oversees 5-15 technicians
- Responsible for branch P&L
- Needs visibility into operations
- Handles regulatory compliance

**Goals:**
- Approve controlled substance requests
- Monitor inventory costs
- Ensure compliance with EPA requirements
- Handle discrepancies and disputes

**Pain Points:**
- "I don't know our true inventory value"
- "Compliance audits are stressful scrambles"
- "I can't see what techs are using in real-time"

### 2.4 Administrator

**Profile:**
- IT or operations leader
- Configures system for company needs
- Manages users and permissions
- Handles multi-location setup

**Goals:**
- Configure workflows for company processes
- Manage user access appropriately
- Set up new locations and products
- Ensure system reflects business rules

---

## 3. Feature Requirements

### 3.1 Core Features (MVP)

#### F1: Event-Sourced Inventory

**Description:** All inventory changes recorded as immutable events.

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| F1.1 | Every inventory change creates an event (no direct edits) | P0 |
| F1.2 | Events record: what, where, who, when (claimed + recorded), why | P0 |
| F1.3 | Current inventory is computed by replaying events | P0 |
| F1.4 | Historical queries return accurate point-in-time state | P0 |
| F1.5 | Corrections create new events referencing original | P0 |

**Acceptance Criteria:**
- [ ] Inventory level query returns same result whether computed fresh or from cache
- [ ] Historical query "inventory on date X" is accurate to event-level precision
- [ ] No UPDATE or DELETE operations exist on event table

#### F2: Offline-First Operation

**Description:** System works fully offline with reliable sync.

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| F2.1 | All critical operations work without connectivity | P0 |
| F2.2 | Offline events queue locally with sequence numbers | P0 |
| F2.3 | Sync uploads events in order, handles conflicts | P0 |
| F2.4 | Conflicts require explicit resolution, never silent | P0 |
| F2.5 | Sync status visible to user at all times | P1 |
| F2.6 | Support 72+ hours of offline operation | P0 |

**Acceptance Criteria:**
- [ ] User can complete full request flow while offline
- [ ] Airplane mode for 72 hours, all events sync correctly when online
- [ ] Conflicting events surface for resolution, not auto-merged

#### F3: Product Catalog

**Description:** Manage pest control products with regulatory metadata.

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| F3.1 | Products have: SKU, name, EPA#, category, type, units | P0 |
| F3.2 | Categories are customizable (icon, color, rules) | P1 |
| F3.3 | Products can be Active, Deprecated, Recalled, Discontinued | P0 |
| F3.4 | Restricted-use products flagged and require certification | P0 |
| F3.5 | Lot and expiration tracking for regulated products | P0 |
| F3.6 | Par levels and reorder points per product | P1 |

**Acceptance Criteria:**
- [ ] EPA number validated format and displayed prominently
- [ ] Recalled product cannot be issued under any circumstances
- [ ] Expired product issues blocked with override audit trail

#### F4: Location Management

**Description:** Track inventory at warehouses, vehicles, and service sites.

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| F4.1 | Location types: Warehouse, Vehicle, TechStock, ServiceSite, Quarantine, Disposal | P0 |
| F4.2 | Each unit of inventory belongs to exactly one location | P0 |
| F4.3 | Locations have responsible party (accountability) | P0 |
| F4.4 | Vehicle assignments tracked with technician | P1 |
| F4.5 | Inventory visible per-location, not just totals | P0 |

**Acceptance Criteria:**
- [ ] Sum of all location inventories equals total system inventory
- [ ] Query "where is product X" returns all locations with quantities

#### F5: Request/Approval Workflow

**Description:** Configurable multi-step process for inventory movements.

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| F5.1 | Workflow steps: Approval → Fulfillment → Pickup → Acknowledgment | P0 |
| F5.2 | Each step can be enabled/disabled | P0 |
| F5.3 | Workflow presets for common patterns | P1 |
| F5.4 | Category-specific rules (e.g., termiticide requires customer info) | P1 |
| F5.5 | Requests expire after configurable time | P2 |
| F5.6 | Denial requires reason | P0 |

**Acceptance Criteria:**
- [ ] Request advances through only enabled steps
- [ ] Terminated request shows complete audit trail
- [ ] Manager can approve/deny from mobile while offline

#### F6: Role-Based Access Control

**Description:** Permission system controlling what users can see and do.

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| F6.1 | Roles: Technician, Warehouse, Manager, Admin | P0 |
| F6.2 | Permissions: granular (view_products, edit_products, etc.) | P0 |
| F6.3 | Permissions assigned to roles, roles assigned to users | P0 |
| F6.4 | Custom roles can be created | P1 |
| F6.5 | Warehouse assignment limits visibility scope | P0 |
| F6.6 | Cost visibility controlled separately from inventory | P1 |

**Acceptance Criteria:**
- [ ] Tech cannot see cost information unless explicitly permitted
- [ ] Warehouse staff can only see requests from assigned locations
- [ ] Admin can create new role with subset of permissions

### 3.2 Extended Features (Post-MVP)

#### F7: Physical Count / Reconciliation

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| F7.1 | Initiate count for location with expected quantities | P1 |
| F7.2 | Record physical quantities, calculate variance | P1 |
| F7.3 | Variance thresholds trigger different handling | P1 |
| F7.4 | Count creates adjustment events automatically | P1 |

#### F8: Dispute Resolution

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| F8.1 | Disputes raised for discrepancies | P1 |
| F8.2 | Investigation workflow with assignment | P2 |
| F8.3 | Resolution requires corrective action or write-off | P1 |
| F8.4 | Write-offs require authorization | P1 |

#### F9: Reporting & Analytics

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| F9.1 | Chain of custody report for any lot | P1 |
| F9.2 | Usage report by tech/customer/date | P1 |
| F9.3 | Inventory valuation report | P2 |
| F9.4 | Variance/adjustment report | P2 |
| F9.5 | Expiration report | P1 |

#### F10: Integrations

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| F10.1 | Barcode/QR scanning for products | P1 |
| F10.2 | Photo capture for evidence | P1 |
| F10.3 | Signature capture for acknowledgments | P2 |
| F10.4 | Webhook notifications for events | P2 |
| F10.5 | API for external system integration | P2 |

---

## 4. User Interface Requirements

### 4.1 Design Principles

1. **Thumb-Friendly**: Primary actions reachable by thumb in one hand
2. **Glanceable**: Key information visible without scrolling
3. **Error-Resistant**: Confirmation for destructive actions
4. **Offline-Aware**: Always show sync status
5. **Role-Appropriate**: Show only relevant features

### 4.2 Screen Requirements

#### Home / Dashboard

| Requirement | Tech | Warehouse | Manager | Admin |
|-------------|:----:|:---------:|:-------:|:-----:|
| Pending action count | ✓ | ✓ | ✓ | ✓ |
| Quick request button | ✓ | ✓ | ✓ | |
| Low stock alerts | | ✓ | ✓ | ✓ |
| KPI summary cards | | | ✓ | ✓ |
| System status | | | | ✓ |

#### Product Browsing

- Search by name, SKU, EPA#
- Filter by category, type, stock status
- Sort by name, stock level, recent use
- Grid and list views
- Quick add to cart

#### Request Flow

1. **Browse**: Select products, set quantities
2. **Review**: See cart summary, total value (if permitted)
3. **Details**: Select recipient (if issuing), fill required fields
4. **Confirm**: Submit request

#### Request Management

- List of requests with status badges
- Filter by status, date, requester
- Tap for detail view
- Action buttons based on status and role

#### Settings (Admin)

- Display preferences (theme)
- Workflow configuration
- Category/type management
- Role/permission management
- User management

### 4.3 Interaction Patterns

| Pattern | Implementation |
|---------|----------------|
| Confirmation | Modal dialog with cancel/confirm |
| Toast feedback | Top banner, auto-dismiss 3s |
| Loading states | Skeleton screens preferred |
| Empty states | Illustration + action prompt |
| Error states | Inline message + retry option |
| Pull to refresh | Standard platform pattern |

---

## 5. Technical Requirements

### 5.1 Platform Requirements

| Platform | Requirement |
|----------|-------------|
| Mobile | iOS 15+, Android 10+ |
| Browser | Chrome 90+, Safari 15+, Firefox 90+ |
| Screen | 320px minimum width |
| Offline | IndexedDB for local storage |

### 5.2 Performance Requirements

| Metric | Target |
|--------|--------|
| Initial load | < 3 seconds on 4G |
| Screen transition | < 300ms |
| Search results | < 500ms |
| Sync (100 events) | < 10 seconds |
| Offline storage | Support 10,000+ events |

### 5.3 Security Requirements

| Requirement | Description |
|-------------|-------------|
| Authentication | OAuth 2.0 / OIDC |
| Authorization | Role-based, server-enforced |
| Data at rest | Encrypted local storage |
| Data in transit | TLS 1.3 |
| Session management | Token refresh, device revocation |
| Audit logging | All actions logged with user/timestamp |

### 5.4 Data Requirements

| Requirement | Description |
|-------------|-------------|
| Event retention | 7 years minimum (regulatory) |
| Restricted-use events | 10 years (EPA) |
| Backup frequency | Daily with point-in-time recovery |
| Data export | CSV/JSON export capability |

---

## 6. Constraints & Assumptions

### 6.1 Constraints

1. **Regulatory**: Must comply with EPA record-keeping requirements
2. **Connectivity**: Assume intermittent connectivity in the field
3. **Devices**: Must work on mid-range smartphones (not just flagships)
4. **Training**: Users have limited technical sophistication
5. **Data ownership**: All data owned by the customer, exportable

### 6.2 Assumptions

1. Users have smartphones with camera capability
2. Each technician is assigned to one primary warehouse
3. Products have unique SKUs within a company
4. EPA numbers follow standard format when provided
5. Internet available at warehouse locations

### 6.3 Out of Scope (v1)

- Multi-company tenancy
- Financial/billing integration
- Route optimization
- Customer-facing portal
- Automatic reordering
- Predictive analytics

---

## 7. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Poor adoption | Medium | High | Intuitive UI, minimal training required |
| Data loss (offline) | Low | Critical | Robust local storage, sync verification |
| Regulatory non-compliance | Low | Critical | Audit trail by design, compliance review |
| Sync conflicts | Medium | Medium | Deterministic resolution, user notification |
| Performance on old devices | Medium | Medium | Progressive enhancement, lite mode |

---

## 8. Release Phases

### Phase 1: Foundation (MVP)

**Duration:** 8-12 weeks

**Features:**
- Event-sourced inventory model
- Basic product catalog (no lot tracking)
- Single-location inventory
- Request workflow (full flow)
- 4 core roles with permissions
- Online-only operation (offline in Phase 2)
- React Native mobile app

**Exit Criteria:**
- [ ] Can complete end-to-end request flow
- [ ] Audit trail complete for all events
- [ ] 3 pilot users successfully using daily

### Phase 2: Offline & Multi-Location

**Duration:** 6-8 weeks

**Features:**
- Offline event queue
- Conflict detection and resolution
- Multi-location inventory tracking
- Vehicle assignments
- Sync status UI
- Push notifications

**Exit Criteria:**
- [ ] 72-hour offline operation verified
- [ ] Conflicts resolve correctly in all test scenarios
- [ ] Multi-location inventory accurate

### Phase 3: Compliance & Reconciliation

**Duration:** 6-8 weeks

**Features:**
- Lot and expiration tracking
- Restricted-use product handling
- Physical count workflow
- Dispute resolution
- Chain of custody reports
- EPA compliance reports

**Exit Criteria:**
- [ ] Mock audit passes
- [ ] Expiration blocking works correctly
- [ ] Lot traceability complete

### Phase 4: Polish & Scale

**Duration:** 4-6 weeks

**Features:**
- Barcode scanning
- Photo attachments
- Signature capture
- Performance optimization
- Admin dashboard
- Data export

**Exit Criteria:**
- [ ] Performance targets met
- [ ] Admin self-service complete
- [ ] Ready for general availability

---

## 9. Appendices

### A. Glossary

| Term | Definition |
|------|------------|
| Event | Immutable record of an inventory change |
| Custody | Accountability for inventory (who answers for it) |
| Location | Physical or logical place where inventory exists |
| Lot | Batch of product with shared characteristics |
| Par Level | Target inventory level to maintain |
| Reorder Point | Threshold triggering restock |
| Restricted-Use | Products requiring certified applicator |
| SKU | Stock Keeping Unit (unique product identifier) |

### B. Related Documents

- [System Architecture](architecture/SYSTEM_ARCHITECTURE.md)
- [Invariants Specification](architecture/INVARIANTS.md)
- [Offline Architecture](architecture/OFFLINE_ARCHITECTURE.md)
- [Workflows](architecture/WORKFLOWS.md)
- [UI Design System](design/UI_DESIGN_SYSTEM.md)
- [Prototype Analysis](analysis/PROTOTYPE_ANALYSIS.md)

---

*Document Status: Draft*
*Approval Required From: Product, Engineering, Compliance*
