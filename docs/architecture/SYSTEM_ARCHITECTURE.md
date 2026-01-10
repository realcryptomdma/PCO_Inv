# PCO Inventory System Architecture

## System Identity

A **field-first inventory accountability system** for pest control operations. This system replaces informal tracking with a durable operational record that survives human error, poor connectivity, staff turnover, audits, and time.

---

## Part 1: Domain Analysis

### 1.1 Products Domain

**What is a Product?**

A Product is a tracked inventory type with defined characteristics:

```
Product {
  id: UUID
  sku: string (unique, immutable after creation)
  name: string
  category: ChemicalType | Equipment | Consumable | Vehicle

  // Unit system - CRITICAL for correctness
  baseUnit: Unit                    // oz, ml, each, ft, etc.
  packagingUnits: PackagingUnit[]   // bottle(32oz), case(12 bottles), etc.

  // Lifecycle state
  status: Active | Deprecated | Recalled | Discontinued

  // Regulatory
  epaRegistration?: string          // for regulated chemicals
  sdsRequired: boolean
  restrictedUse: boolean            // requires certified applicator

  // Thresholds
  reorderPoint?: Quantity
  minimumOnHand?: Quantity
  expirationTracked: boolean
}
```

**Product Lifecycle States:**

```
┌──────────┐     ┌────────────┐     ┌──────────────┐
│  Active  │────▶│ Deprecated │────▶│ Discontinued │
└──────────┘     └────────────┘     └──────────────┘
      │                                     ▲
      │          ┌──────────┐               │
      └─────────▶│ Recalled │───────────────┘
                 └──────────┘
```

**Invariant:** A product cannot be issued if status ≠ Active. Deprecated products can be used until depleted but not restocked.

**Edge Case - Product Rename:** If a product name changes (reformulation, rebranding), do we create a new product or update the existing one?

**Resolution:** Create a new product. The old product becomes Deprecated with a `supersededBy` reference. This preserves audit trails where the old name matters.

---

### 1.2 Locations Domain

**What is a Location?**

A Location is any place where inventory can exist:

```
Location {
  id: UUID
  type: Warehouse | Vehicle | ServiceSite | TechnicianStock | Quarantine | Disposal
  name: string
  parentLocation?: LocationID       // hierarchical containment

  // Accountability
  responsibleParty?: PersonID       // who is accountable for this location

  // Constraints
  acceptsProducts: ProductID[] | All
  capacityLimit?: Quantity

  // State
  status: Active | Inactive | Decommissioned
}
```

**Location Types and Their Semantics:**

| Type | Description | Responsible Party | Accepts From | Issues To |
|------|-------------|-------------------|--------------|-----------|
| Warehouse | Central storage | Inventory Manager | Suppliers, Returns | Vehicles, Techs |
| Vehicle | Mobile stock | Assigned Technician | Warehouse | ServiceSites, TechStock |
| TechnicianStock | Personal inventory | Technician | Vehicle, Warehouse | ServiceSites |
| ServiceSite | Customer location | N/A (transient) | Vehicle, TechStock | Consumption only |
| Quarantine | Damaged/suspect items | Inventory Manager | Any | Disposal, Return |
| Disposal | End of life | Inventory Manager | Quarantine | None (terminal) |

**Invariant:** Every unit of inventory belongs to exactly one location at any point in time. There is no "in transit" limbo - transfers are atomic from the system's perspective.

**Edge Case - Vehicle Reassignment:** Technician A's vehicle is reassigned to Technician B. What happens to inventory?

**Resolution:** Vehicle inventory transfers with the vehicle (Location.responsibleParty changes). A mandatory reconciliation event must be recorded where outgoing tech confirms counts and incoming tech acknowledges receipt. Discrepancies create dispute events.

---

### 1.3 Custody Domain

**Custody vs. Location**

These are distinct concepts that are often conflated:

- **Location**: Where something physically is
- **Custody**: Who is accountable for it

A technician may have custody of items in their vehicle (Location) even though they don't own them (the company does). Custody determines who must answer for discrepancies.

```
CustodyChain {
  productInstance: InventoryID
  custodian: PersonID
  location: LocationID
  since: Timestamp

  // Optional for lot-tracked items
  lotNumber?: string
  expirationDate?: Date
}
```

**Invariant:** Custody can only transfer through explicit events (Receipt, Transfer, Issue, Return). Custody cannot be inferred or defaulted.

---

### 1.4 Events Domain (The Heart of the System)

**Inventory is History**

Current inventory levels are NEVER stored directly. They are computed from the complete sequence of events.

```
InventoryEvent {
  id: UUID
  eventType: EventType
  timestamp: Timestamp              // when event occurred (claimed)
  recordedAt: Timestamp             // when system recorded it

  // What changed
  product: ProductID
  quantity: Quantity
  fromLocation?: LocationID
  toLocation?: LocationID

  // Who did it
  initiatedBy: PersonID
  authorizedBy?: PersonID           // if different from initiator

  // Why
  reason: ReasonCode
  notes?: string

  // Provenance
  sourceEvent?: EventID             // for corrections, what are we fixing?
  offlineOrigin?: OfflineContext    // if created offline

  // Verification
  witnessedBy?: PersonID            // for high-value or regulated items
  attachments?: Attachment[]        // photos, signatures, receipts
}
```

**Event Types:**

| Event Type | From | To | Description |
|------------|------|-----|-------------|
| Receive | (external) | Location | Initial entry into system |
| Transfer | Location A | Location B | Movement between locations |
| Issue | Location | ServiceSite | Used at customer location |
| Consume | Location | (void) | Destroyed/used up (non-billable) |
| Adjust | Location | Location | Correction with explanation |
| Return | ServiceSite | Location | Unused product returned |
| Dispose | Location | Disposal | End of life |
| Convert | Location | Location | Unit conversion (1 case → 12 bottles) |
| Quarantine | Location | Quarantine | Suspect product isolated |
| Count | Location | Location | Physical count verification |

**Invariant - Conservation of Mass:** For any closed time window:
```
Starting Inventory
  + Receives
  - Issues
  - Consumes
  - Disposals
  +/- Transfers (net)
  +/- Adjustments
  = Ending Inventory
```

Any violation indicates a system bug or data corruption.

---

### 1.5 Requests and Approvals Domain

Not all actions are immediate. Some require authorization:

```
Request {
  id: UUID
  type: TransferRequest | OrderRequest | AdjustmentRequest | DisposalRequest
  status: Pending | Approved | Denied | Expired | Cancelled

  requestedBy: PersonID
  requestedAt: Timestamp

  // What is being requested
  items: RequestLineItem[]
  justification: string

  // Approval chain
  approvals: ApprovalRecord[]
  requiredApprovals: ApprovalRequirement[]

  // Outcome
  resultingEvent?: EventID          // links to actual event if approved
  denialReason?: string
  expiresAt?: Timestamp
}

ApprovalRecord {
  approver: PersonID
  decision: Approved | Denied
  decidedAt: Timestamp
  notes?: string

  // For offline approvals
  offlineContext?: OfflineContext
}
```

**Approval Triggers:**

| Condition | Requires Approval From |
|-----------|------------------------|
| Quantity > threshold | Manager |
| Restricted-use product | Certified Applicator + Manager |
| Adjustment (any) | Inventory Manager |
| Cross-branch transfer | Both branch managers |
| Disposal of regulated chemical | Compliance Officer |

**Edge Case - Approval While Offline:** Technician requests emergency restock while manager is offline.

**Resolution:** Request enters `Pending` state with `offlineContext.emergencyOverride = true`. Technician can proceed with a self-authorization that creates a provisional event. When connectivity resumes, manager receives urgent review notification. If denied post-facto, a corrective adjustment is required, and the incident is logged.

---

### 1.6 Disputes Domain

Reality and records diverge. The system must handle this gracefully:

```
Dispute {
  id: UUID
  type: QuantityMismatch | MissingItem | DamagedItem | UnauthorizedAction | DataError

  raisedBy: PersonID
  raisedAt: Timestamp

  // Context
  relatedEvent?: EventID
  relatedLocation: LocationID
  relatedProduct: ProductID

  // The discrepancy
  expectedQuantity?: Quantity
  actualQuantity?: Quantity
  description: string
  evidence?: Attachment[]

  // Resolution
  status: Open | UnderInvestigation | Resolved | Escalated
  assignedTo?: PersonID
  resolution?: DisputeResolution
}

DisputeResolution {
  resolvedBy: PersonID
  resolvedAt: Timestamp

  outcome: Confirmed | Corrected | WriteOff | Recovered
  correctiveEvents: EventID[]      // adjustments made
  rootCause?: string
  preventiveMeasures?: string
}
```

**Invariant:** Disputes cannot be "closed" without either a corrective event or an explicit write-off with authorization.

---

## Part 2: Foundational Invariants

These are the laws that the system must never violate:

### Invariant 1: Inventory is Derived, Never Stored

```typescript
function getInventory(location: LocationID, asOf: Timestamp): InventoryState {
  return events
    .filter(e => e.timestamp <= asOf)
    .filter(e => affects(e, location))
    .reduce(applyEvent, emptyInventory())
}
```

There is no `inventory_levels` table that gets updated. There is only the event log.

**Consequence:** "Editing" inventory means creating an Adjustment event with a reason.

**Consequence:** Historical queries are trivially correct - just replay to that timestamp.

**Consequence:** Concurrent modifications don't cause lost updates - events are append-only.

### Invariant 2: Single Location at Any Time

Every unit of inventory belongs to exactly one location at every moment.

```
∀ unit u, ∀ time t: |{location l : contains(l, u, t)}| = 1
```

**Implementation:** Transfer events are atomic. There is no "in transit" state. The event records both `fromLocation` and `toLocation`, and the transfer happens at a single logical instant.

**Edge Case - Physical Transit:** A shipment takes 3 days to arrive. Where is it during transit?

**Resolution:** The sending location retains custody until the receiving location acknowledges receipt. This models real-world accountability correctly - if it's lost in transit, the sender is responsible until handoff is confirmed.

### Invariant 3: Events Are Immutable

Once recorded, an event cannot be changed. Corrections are new events that reference the original.

```typescript
// WRONG
event.quantity = newQuantity
save(event)

// RIGHT
createEvent({
  type: 'Adjust',
  sourceEvent: event.id,
  reason: 'Correction: original count was incorrect',
  quantity: delta
})
```

**Consequence:** The complete audit trail is preserved, including mistakes.

### Invariant 4: Units Are Explicit

No implicit assumptions about what a quantity means.

```typescript
// WRONG
{ productId: 'TERMIDOR', quantity: 5 }  // 5 what?

// RIGHT
{ productId: 'TERMIDOR', quantity: { value: 5, unit: 'bottle_32oz' } }
```

**Conversion Events:** When units change (opening a case into individual bottles), this is an explicit Convert event:

```
Convert {
  fromQuantity: { value: 1, unit: 'case' }
  toQuantity: { value: 12, unit: 'bottle_32oz' }
  location: LocationID
  // Conversion must net to zero in base units
}
```

### Invariant 5: Offline Actions Preserve Intent

Actions taken offline must:
1. Record the claimed timestamp (when user says it happened)
2. Record the device timestamp (device clock at action time)
3. Record the sync timestamp (when server received it)
4. Maintain causal ordering within a single device
5. Handle conflicts through explicit resolution, not silent override

---

## Part 3: Offline-First Architecture

### 3.1 Offline Reality Model

Offline is not an error state. It's an expected operating condition.

```
OfflineContext {
  deviceId: DeviceID
  sequenceNumber: number            // monotonic per device
  claimedTimestamp: Timestamp       // user-provided
  deviceTimestamp: Timestamp        // device clock
  syncedAt?: Timestamp              // when server received

  // Conflict detection
  lastKnownServerState: StateHash
  deviceStateAtAction: StateHash
}
```

### 3.2 Event Ordering

Events from a single device have a total order (sequenceNumber).
Events from different devices may conflict.

**Ordering Rules:**
1. Within device: sequenceNumber determines order
2. Across devices: claimedTimestamp is advisory, not authoritative
3. Conflicts: Server assigns final order, losers get conflict events

### 3.3 Conflict Types and Resolution

**Type 1: Double Issue**
Two techs both issue the same lot while offline.

Detection: Sum of claimed quantities > available at last sync point.
Resolution:
1. First-synced event wins
2. Second event becomes `FailedIssue` with reason `InsufficientInventory`
3. Second tech receives notification with explanation
4. If product was actually used (too late to return), create adjustment with reason `ConflictResolution`

**Type 2: Stale Transfer**
Tech transfers product from vehicle, but vehicle was already emptied by sync from warehouse.

Detection: `fromLocation` quantity insufficient at replay time.
Resolution:
1. Event becomes `FailedTransfer`
2. Investigation required: where did the product actually go?
3. Creates Dispute automatically

**Type 3: Approval Race**
Request approved by manager while tech was offline, but tech cancelled request while offline.

Detection: Both approval and cancellation exist.
Resolution:
1. If product already moved: cancellation fails, notify tech
2. If product not yet moved: cancellation wins (more recent intent)

### 3.4 Offline Action Queues

```
OfflineActionQueue {
  deviceId: DeviceID
  actions: PendingAction[]

  // Metadata
  lastSuccessfulSync: Timestamp
  pendingCount: number
}

PendingAction {
  localId: UUID                     // generated offline
  action: InventoryEvent | Request | Approval
  status: Queued | Syncing | Synced | Conflicted | Failed

  // Retry handling
  syncAttempts: number
  lastError?: string
}
```

**Recovery Guarantee:** No user action is silently dropped. Every action either:
1. Succeeds and creates a server event
2. Fails with a recorded reason and user notification
3. Conflicts and requires resolution

---

## Part 4: Role and Permission Model

### 4.1 Role Definitions

```
Role {
  id: RoleID
  name: string
  permissions: Permission[]
  constraints: Constraint[]
}
```

**Core Roles:**

| Role | Description | Typical Permissions |
|------|-------------|---------------------|
| Technician | Field operator | Issue, Return, Count (own vehicle) |
| Senior Technician | Experienced field | + Transfer (from warehouse) |
| Branch Manager | Location authority | + Approve, Adjust, Transfer (any) |
| Inventory Manager | Central oversight | + Receive, Dispose, All Adjusts |
| Compliance Officer | Regulatory | + Override, Audit, Recall |
| Administrator | System config | + Role management, Location setup |

### 4.2 Permission Model

Permissions are not just "can do X". They're "can do X under conditions Y".

```
Permission {
  action: ActionType
  resource: ResourcePattern          // which products, locations
  conditions: Condition[]            // quantity limits, time windows
}

Condition {
  type: MaxQuantity | TimeWindow | LocationScope | ProductCategory | RequiresWitness
  parameters: any
}
```

**Examples:**

```typescript
// Technician can issue any product from their assigned vehicle, up to 10 units
{
  action: 'Issue',
  resource: { location: '${assignedVehicle}', product: '*' },
  conditions: [{ type: 'MaxQuantity', parameters: { max: 10 } }]
}

// Only certified applicators can issue restricted-use products
{
  action: 'Issue',
  resource: { product: { restrictedUse: true } },
  conditions: [{ type: 'RequiresCertification', parameters: { type: 'RestrictedUse' } }]
}
```

### 4.3 Authority Separation

**Principle: Initiation ≠ Finalization**

| Action | Initiator | Finalizer |
|--------|-----------|-----------|
| Receive (from supplier) | Warehouse staff | Inventory Manager |
| Large transfer | Technician | Branch Manager |
| Adjustment | Anyone | Inventory Manager |
| Disposal | Technician | Compliance Officer |
| Write-off | Branch Manager | Finance + Compliance |

**Implementation:** Two-phase actions:

```
TwoPhaseAction {
  phase: Initiated | AwaitingFinalization | Finalized | Rejected
  initiatedBy: PersonID
  initiatedAt: Timestamp

  finalizedBy?: PersonID
  finalizedAt?: Timestamp

  // If not finalized within window, escalate
  escalationDeadline: Timestamp
}
```

---

## Part 5: Historical Reconstruction

### 5.1 Point-in-Time Queries

The event-sourced model enables powerful historical queries:

```typescript
// What did we have last Tuesday?
getInventory(location, parseDate('last Tuesday'))

// What was issued to customer X over the past year?
events
  .filter(e => e.type === 'Issue')
  .filter(e => e.serviceSite?.customerId === X)
  .filter(e => e.timestamp > oneYearAgo)
  .groupBy(e => e.product)
  .sum(e => e.quantity)

// Who had custody of lot #12345 on March 15?
getCustodyChain(lot: '12345', asOf: 'March 15')
```

### 5.2 Regulatory Reporting

For audits, the system can produce:

1. **Chain of Custody Report**: For any lot, complete history from receipt to current location or disposal
2. **Usage Report**: All applications by technician, date, customer, product
3. **Variance Report**: All adjustments with reasons, sorted by magnitude
4. **Expiration Report**: Products nearing or past expiration
5. **Restricted Use Log**: All restricted-use product movements with certifying applicator

### 5.3 Reconciliation

Physical counts create Count events that may trigger Adjustment events:

```
CountEvent {
  location: LocationID
  countedBy: PersonID
  witnessedBy?: PersonID           // required for high-value

  lines: CountLine[]
}

CountLine {
  product: ProductID
  systemQuantity: Quantity          // what we expected
  physicalQuantity: Quantity        // what we found

  // If different, what happened?
  varianceExplanation?: string
  resultingAdjustment?: EventID
}
```

**Invariant:** Counts cannot be "ignored". A count with variance either:
1. Creates an adjustment with explanation
2. Creates a dispute for investigation
3. Is explicitly approved as-is by authorized person (still creates adjustment)

---

## Part 6: Edge Cases and Failure Modes

### 6.1 Clock Skew

**Problem:** Device clocks can be wrong. A technician's phone clock is 3 hours behind.

**Mitigation:**
1. Record both device timestamp and server timestamp
2. Warn users when device clock differs significantly from server
3. Use sequence numbers for ordering, not timestamps
4. Never trust claimedTimestamp for conflict resolution

### 6.2 Partial Sync

**Problem:** Device syncs 50 of 100 pending actions, then loses connection.

**Mitigation:**
1. Each action syncs independently
2. Server acknowledges each action individually
3. Device only removes from queue after acknowledgment
4. Resumable sync - never re-send already-acknowledged actions

### 6.3 Device Loss/Theft

**Problem:** Technician's device is stolen with pending offline actions.

**Mitigation:**
1. Device can be remotely invalidated
2. Pending actions from invalidated device are quarantined, not applied
3. Recovery requires manager review of quarantined actions
4. Inventory in technician's custody enters dispute status

### 6.4 Duplicate Events

**Problem:** Due to retry logic, same event is submitted twice.

**Mitigation:**
1. Client generates UUID before submission
2. Server enforces UUID uniqueness
3. Duplicate submission returns success (idempotent) but doesn't create second event

### 6.5 Backdated Events

**Problem:** Technician submits event claiming it happened yesterday.

**Mitigation:**
1. Always record both claimedTimestamp and recordedAt
2. Large discrepancies (>24h) require manager approval
3. Backdated events cannot precede a completed reconciliation
4. Reports clearly distinguish claimed vs. recorded times

### 6.6 Negative Inventory

**Problem:** Due to sync timing, computed inventory goes negative.

**Mitigation:**
1. Negative inventory is a system error, not valid state
2. When detected: halt processing, alert operators
3. Create CompensatingEvent to prevent further corruption
4. Root cause investigation required before resuming

### 6.7 Product Recall

**Problem:** EPA issues recall on a product already distributed.

**Procedure:**
1. Product status → Recalled
2. System generates QuarantineRequest for all locations holding product
3. Dashboard shows real-time recall compliance
4. All lots of recalled product are traced (who received, where is it now)
5. Blocking: Cannot issue recalled product under any circumstance

### 6.8 Employee Termination

**Problem:** Technician is terminated. They have inventory in their custody.

**Procedure:**
1. Account disabled immediately
2. All pending offline actions quarantined for review
3. Mandatory custody transfer event required
4. Physical reconciliation required before custody accepted
5. Any unrecovered inventory → Dispute with termination context

---

## Part 7: Data Model Schemas

### 7.1 Core Entities

```typescript
// Identifiers
type UUID = string
type ProductID = UUID
type LocationID = UUID
type PersonID = UUID
type EventID = UUID
type RequestID = UUID

// Quantities are always explicit
interface Quantity {
  value: number
  unit: UnitCode
}

type UnitCode =
  | 'oz' | 'ml' | 'gal' | 'L'           // liquid
  | 'lb' | 'kg' | 'g' | 'oz_wt'          // weight
  | 'each' | 'box' | 'case' | 'pallet'   // count
  | 'ft' | 'm' | 'roll'                  // length

// Base entities
interface Product {
  id: ProductID
  sku: string
  name: string
  category: 'chemical' | 'equipment' | 'consumable' | 'vehicle'
  baseUnit: UnitCode
  packagingUnits: PackagingUnit[]
  status: 'active' | 'deprecated' | 'recalled' | 'discontinued'
  supersededBy?: ProductID
  epaRegistration?: string
  sdsRequired: boolean
  restrictedUse: boolean
  expirationTracked: boolean
  reorderPoint?: Quantity
  createdAt: Timestamp
  updatedAt: Timestamp
}

interface PackagingUnit {
  unitCode: UnitCode        // e.g., 'bottle_32oz'
  baseUnitEquivalent: number  // e.g., 32 (if baseUnit is 'oz')
}

interface Location {
  id: LocationID
  type: 'warehouse' | 'vehicle' | 'technician_stock' | 'service_site' | 'quarantine' | 'disposal'
  name: string
  parentLocation?: LocationID
  responsibleParty?: PersonID
  status: 'active' | 'inactive' | 'decommissioned'
  createdAt: Timestamp
  updatedAt: Timestamp
}

interface Person {
  id: PersonID
  employeeId: string
  name: string
  email: string
  roles: RoleID[]
  certifications: Certification[]
  assignedLocations: LocationID[]
  status: 'active' | 'suspended' | 'terminated'
  createdAt: Timestamp
  updatedAt: Timestamp
}

interface Certification {
  type: 'restricted_use_applicator' | 'hazmat' | 'dot_transport'
  issuedBy: string
  issuedAt: Timestamp
  expiresAt: Timestamp
  licenseNumber: string
}
```

### 7.2 Event Schema

```typescript
interface InventoryEvent {
  id: EventID
  eventType: EventType

  // Timing
  occurredAt: Timestamp         // when it happened (claimed or actual)
  recordedAt: Timestamp         // when system recorded it

  // What
  product: ProductID
  quantity: Quantity
  lotNumber?: string
  expirationDate?: Date

  // Where
  fromLocation?: LocationID     // null for Receive
  toLocation?: LocationID       // null for Consume/Dispose

  // Who
  performedBy: PersonID
  authorizedBy?: PersonID
  witnessedBy?: PersonID

  // Why
  reason: ReasonCode
  notes?: string

  // Relationships
  sourceRequest?: RequestID
  sourceEvent?: EventID         // for corrections
  relatedServiceOrder?: string  // for billing linkage

  // Offline provenance
  offlineContext?: OfflineContext

  // Attachments
  attachments?: Attachment[]
}

type EventType =
  | 'receive'
  | 'transfer'
  | 'issue'
  | 'return'
  | 'consume'
  | 'adjust'
  | 'convert'
  | 'quarantine'
  | 'dispose'
  | 'count'

type ReasonCode =
  | 'standard_issue'
  | 'restock'
  | 'customer_return'
  | 'damaged'
  | 'expired'
  | 'count_variance'
  | 'correction'
  | 'theft'
  | 'spillage'
  | 'recall_compliance'
  | 'unit_conversion'
  | 'vehicle_transfer'
  | 'emergency_override'

interface OfflineContext {
  deviceId: string
  sequenceNumber: number
  deviceTimestamp: Timestamp
  lastKnownServerState: string    // hash
  syncedAt?: Timestamp
  syncStatus: 'pending' | 'synced' | 'conflicted' | 'failed'
  conflictResolution?: ConflictResolution
}

interface ConflictResolution {
  resolvedBy: PersonID
  resolvedAt: Timestamp
  strategy: 'accept' | 'reject' | 'merge'
  notes: string
}
```

### 7.3 Request/Approval Schema

```typescript
interface Request {
  id: RequestID
  type: 'transfer' | 'adjustment' | 'disposal' | 'order'
  status: 'pending' | 'approved' | 'denied' | 'expired' | 'cancelled'

  requestedBy: PersonID
  requestedAt: Timestamp

  items: RequestItem[]
  justification: string
  priority: 'standard' | 'urgent' | 'emergency'

  // Approval workflow
  approvalChain: ApprovalStep[]
  currentStep: number

  // Outcome
  resultingEvents: EventID[]
  denialReason?: string

  // Deadlines
  expiresAt?: Timestamp
  escalatesAt?: Timestamp

  offlineContext?: OfflineContext
}

interface RequestItem {
  product: ProductID
  quantity: Quantity
  fromLocation?: LocationID
  toLocation?: LocationID
}

interface ApprovalStep {
  order: number
  requiredRole: RoleID
  requiredPerson?: PersonID     // specific person required

  decision?: 'approved' | 'denied'
  decidedBy?: PersonID
  decidedAt?: Timestamp
  notes?: string

  offlineContext?: OfflineContext
}
```

### 7.4 Dispute Schema

```typescript
interface Dispute {
  id: UUID
  type: 'quantity_mismatch' | 'missing_item' | 'damaged' | 'unauthorized' | 'data_error'
  status: 'open' | 'investigating' | 'resolved' | 'escalated'

  raisedBy: PersonID
  raisedAt: Timestamp

  // Context
  relatedEvents: EventID[]
  relatedLocation: LocationID
  relatedProduct: ProductID

  // The problem
  expectedQuantity?: Quantity
  actualQuantity?: Quantity
  description: string
  evidence: Attachment[]

  // Investigation
  assignedTo?: PersonID
  investigationNotes?: string

  // Resolution
  resolution?: DisputeResolution
}

interface DisputeResolution {
  outcome: 'confirmed' | 'corrected' | 'write_off' | 'recovered'
  resolvedBy: PersonID
  resolvedAt: Timestamp

  correctiveEvents: EventID[]
  writeOffAmount?: Quantity
  writeOffApprovedBy?: PersonID

  rootCause?: string
  preventiveMeasures?: string
}
```

---

## Part 8: System Behaviors

### 8.1 Receiving Inventory

```
1. Warehouse staff initiates Receive event
2. System validates:
   - Product exists and is Active
   - Destination location accepts this product
   - Quantity and units are valid
   - Lot/expiration captured if required
3. Event enters 'pending_verification' status
4. Inventory Manager verifies physical receipt
5. Event finalized, inventory appears in location
```

### 8.2 Issuing to Service Site

```
1. Technician selects product and quantity
2. System validates:
   - Product available in technician's location
   - Technician has permission for this product
   - Quantity within daily/per-issue limits
   - No regulatory blocks (not recalled, not expired)
3. If validation passes:
   - Event created immediately
   - Inventory deducted from technician's location
   - Can proceed offline if needed
4. If offline:
   - Local event created with sequence number
   - Synced when connectivity returns
   - Conflicts resolved as per rules
```

### 8.3 Physical Count Reconciliation

```
1. Manager initiates count for location
2. System generates count sheet (expected quantities)
3. Counter records physical quantities
4. For each variance:
   - Under 5%: Auto-create adjustment with 'count_variance' reason
   - 5-10%: Create adjustment requiring manager approval
   - Over 10% or high-value: Create dispute, block adjustment
5. Count event recorded regardless of variance
6. Adjustments link back to count event
```

### 8.4 Emergency Override

```
1. Technician at customer site needs product not in their stock
2. Technician initiates emergency transfer request
3. If online: Routed to manager for immediate decision
4. If offline:
   - Request recorded with emergency flag
   - Technician can self-authorize with acknowledgment
   - Creates provisional event marked 'emergency_override'
   - Manager receives high-priority review on sync
5. Post-facto review:
   - Manager approves: Event finalized
   - Manager denies: Corrective adjustment created, technician notified
   - Repeated emergency overrides trigger review
```

---

## Part 9: Audit and Compliance

### 9.1 What Gets Logged

Everything. But specifically:

- All inventory events (immutable)
- All request/approval decisions
- All login/logout and session activity
- All permission changes
- All role assignments
- All dispute lifecycle events
- All system configuration changes

### 9.2 Retention

| Data Type | Retention Period | Reason |
|-----------|------------------|--------|
| Inventory Events | 7 years | Regulatory |
| Restricted Use Events | 10 years | EPA requirement |
| Financial Events | 7 years | Tax/Audit |
| Access Logs | 2 years | Security |
| Disputes | 7 years or until resolved + 3 years | Liability |

### 9.3 Audit Queries

The system must support:

```typescript
// Regulatory audit: All restricted-use product applications
getEvents({
  productFilter: { restrictedUse: true },
  eventType: 'issue',
  dateRange: { from, to },
  includeChainOfCustody: true
})

// Financial audit: Inventory valuation at period end
getInventoryValuation({
  asOf: fiscalYearEnd,
  byLocation: true,
  includeInTransit: false
})

// Discrepancy audit: All adjustments over threshold
getEvents({
  eventType: 'adjust',
  quantityFilter: { greaterThan: threshold },
  dateRange: { from, to },
  includeResolution: true
})
```

---

## Part 10: Open Questions and Decisions Required

### 10.1 Lot Tracking Granularity

**Question:** Track lots at all times, or only for regulated products?

**Trade-off:**
- Full lot tracking: Better traceability, more data entry burden
- Selective lot tracking: Less overhead, gaps in some scenarios

**Recommendation:** Track lots for:
- All restricted-use chemicals (required by law)
- All products with expiration dates
- High-value equipment (>$500)

### 10.2 Multi-Tenancy

**Question:** Single company install, or SaaS multi-tenant?

**Implications:**
- Data isolation strategy
- Customization flexibility
- Deployment model
- Pricing model

**Recommendation:** Design for multi-tenant with strong isolation from day one. Easier to simplify later than to add isolation.

### 10.3 Integration Points

**Required integrations:**
- Accounting system (for valuation)
- Service management system (for service orders)
- Purchasing system (for reorders)
- Regulatory reporting (EPA, state agencies)

**API Strategy:** Event-based integration via webhooks + REST API for queries.

### 10.4 Mobile Platform

**Question:** Native mobile, PWA, or hybrid?

**Recommendation:** PWA with offline-first architecture. Critical operations must work completely offline.

### 10.5 Biometric/Photo Verification

**Question:** Require photo evidence for certain transactions?

**Use cases:**
- Receiving (proof of delivery)
- Counts (condition documentation)
- Disputes (evidence)
- Disposal (compliance documentation)

**Recommendation:** Optional photo attachment, required for disposals and disputes.

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| Base Unit | The smallest measurable unit for a product (oz, each, ft) |
| Custody | Accountability for inventory, independent of ownership |
| Event | An immutable record of something that happened |
| Finalization | Second-phase approval that makes an action permanent |
| Location | Any place where inventory can exist |
| Lot | A batch of product with shared characteristics (manufacture date, etc.) |
| Packaging Unit | A container with multiple base units (case of 12, pallet of 48) |
| Quarantine | A location for suspect inventory pending investigation |
| Reconciliation | Process of matching physical count to system records |
| Restricted Use | Products requiring special certification to apply |

## Appendix B: State Machines

### Product Status

```
        ┌────────┐
        │ Active │
        └───┬────┘
            │
    ┌───────┴────────┐
    │                │
    ▼                ▼
┌────────────┐  ┌──────────┐
│ Deprecated │  │ Recalled │
└─────┬──────┘  └────┬─────┘
      │              │
      └──────┬───────┘
             ▼
      ┌──────────────┐
      │ Discontinued │
      └──────────────┘
```

### Request Status

```
                ┌─────────┐
                │ Pending │
                └────┬────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
   ┌─────────┐  ┌────────┐  ┌───────────┐
   │ Approved│  │ Denied │  │ Cancelled │
   └─────────┘  └────────┘  └───────────┘
        │
        ▼
   ┌─────────┐
   │ Executed│
   └─────────┘
```

### Dispute Status

```
       ┌──────┐
       │ Open │
       └──┬───┘
          │
          ▼
   ┌──────────────┐
   │ Investigating│◄────────┐
   └──────┬───────┘         │
          │                 │
    ┌─────┴─────┐           │
    │           │           │
    ▼           ▼           │
┌────────┐  ┌───────────┐   │
│Resolved│  │ Escalated │───┘
└────────┘  └───────────┘
```

---

*Document Version: 1.0*
*Last Updated: 2026-01-10*
*Status: Architecture Definition*
