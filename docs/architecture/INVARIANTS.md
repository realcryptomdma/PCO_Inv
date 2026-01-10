# System Invariants

This document enumerates the **inviolable rules** of the PCO Inventory System. These are not guidelines or preferences—they are structural requirements that the system must enforce at all times.

A violation of any invariant indicates a **system bug** or **data corruption** requiring immediate investigation.

---

## Category 1: Data Integrity Invariants

### INV-001: Inventory Derived From Events

**Statement:** Current inventory quantities are computed from the complete sequence of events, never stored directly.

**Enforcement:**
- No `inventory_levels` or `current_stock` table exists
- All queries for "current inventory" call the event reducer
- Any discrepancy between two computations triggers alert

**Verification:**
```sql
-- This query should return zero rows in a healthy system
SELECT * FROM inventory_snapshots
WHERE computed_quantity != replay_quantity;
```

**Failure Mode:** If violated, inventory reports become unreliable. Historical queries may contradict current state.

---

### INV-002: Single Location Per Unit

**Statement:** Every unit of inventory belongs to exactly one location at any moment in time.

**Enforcement:**
- Transfer events are atomic (no "in transit" state)
- Event processor rejects events that would create location ambiguity
- Location sums must equal total system inventory

**Verification:**
```typescript
function verifyLocationInvariant(asOf: Timestamp): boolean {
  const totalByLocation = locations
    .map(loc => getInventoryAt(loc, asOf))
    .reduce((a, b) => a + b, 0);

  const totalInSystem = getTotalSystemInventory(asOf);

  return totalByLocation === totalInSystem;
}
```

**Failure Mode:** If violated, the same unit appears in multiple places. Audits fail. Accountability is impossible.

---

### INV-003: Event Immutability

**Statement:** Once recorded, an event cannot be modified or deleted. Corrections create new events.

**Enforcement:**
- Event table has no UPDATE or DELETE permissions
- API has no event modification endpoints
- Corrections require `sourceEvent` reference to original

**Verification:**
```sql
-- Audit log should show zero modifications
SELECT * FROM event_audit_log
WHERE action IN ('UPDATE', 'DELETE');
```

**Failure Mode:** If violated, audit trails become unreliable. "What happened on date X" becomes unanswerable.

---

### INV-004: Conservation of Mass

**Statement:** For any closed time period, inventory changes must balance.

**Formula:**
```
StartingInventory
  + Receives
  - Issues
  - Consumes
  - Disposals
  +/- Transfers (net zero across all locations)
  +/- Adjustments (explicit, with reason)
  = EndingInventory
```

**Enforcement:**
- Event processor validates balance after each event
- Daily reconciliation job checks conservation
- Imbalance creates automatic dispute

**Verification:**
```typescript
function verifyConservation(
  product: ProductID,
  from: Timestamp,
  to: Timestamp
): VarianceReport {
  const start = getQuantity(product, from);
  const end = getQuantity(product, to);

  const receives = sumEvents('receive', product, from, to);
  const issues = sumEvents('issue', product, from, to);
  const consumes = sumEvents('consume', product, from, to);
  const disposals = sumEvents('dispose', product, from, to);
  const adjustments = sumEvents('adjust', product, from, to);

  const expected = start + receives - issues - consumes - disposals + adjustments;

  return {
    balanced: expected === end,
    variance: end - expected
  };
}
```

**Failure Mode:** If violated, inventory is appearing from nowhere or disappearing without trace. System is untrustworthy.

---

### INV-005: Units Are Explicit

**Statement:** Every quantity in the system has an explicit unit. No bare numbers.

**Enforcement:**
- `Quantity` type requires both `value` and `unit` fields
- API rejects payloads with unitless quantities
- Database schema enforces non-null unit columns

**Verification:**
```typescript
// This should not compile
const qty = { value: 5 }; // Error: missing 'unit'

// This is valid
const qty: Quantity = { value: 5, unit: 'oz' };
```

**Failure Mode:** If violated, 5 could mean 5 ounces, 5 gallons, or 5 cases. Inventory counts become meaningless.

---

### INV-006: Non-Negative Inventory

**Statement:** Computed inventory at any location can never be negative.

**Enforcement:**
- Event processor rejects events that would create negative inventory
- Exception: Adjustments with reason `correction` can create temporary negative while fixing errors
- Negative inventory triggers immediate investigation

**Verification:**
```typescript
function checkNonNegative(location: LocationID, asOf: Timestamp): boolean {
  const inventory = getInventoryAt(location, asOf);
  return inventory.items.every(item => item.quantity.value >= 0);
}
```

**Failure Mode:** Negative inventory means we've recorded more usage than we ever had. Either theft, data error, or bug.

---

## Category 2: Authority Invariants

### INV-101: Action Authority Required

**Statement:** Every action requires explicit authorization from someone with appropriate permissions.

**Enforcement:**
- `performedBy` field is always required
- Permission check runs before event creation
- Unauthorized actions are rejected with audit log entry

**Verification:**
```typescript
function hasAuthority(
  person: PersonID,
  action: ActionType,
  context: ActionContext
): boolean {
  const permissions = getEffectivePermissions(person);
  return permissions.some(p =>
    p.action === action &&
    p.conditions.every(c => evaluateCondition(c, context))
  );
}
```

**Failure Mode:** Without authority tracking, accountability is impossible. "Who approved this?" has no answer.

---

### INV-102: Separation of Initiation and Finalization

**Statement:** For controlled actions, the initiator cannot also be the finalizer.

**Controlled Actions:**
- Adjustments over threshold
- Disposals of regulated chemicals
- Write-offs
- Large transfers

**Enforcement:**
- Two-phase commit for controlled actions
- System rejects finalization by initiator
- Emergency overrides create audit trail

**Verification:**
```sql
SELECT * FROM events
WHERE requires_finalization = true
AND initiated_by = finalized_by
AND emergency_override = false;
-- Should return zero rows
```

**Failure Mode:** Single person can create and approve fraudulent transactions.

---

### INV-103: Certification Requirements

**Statement:** Restricted-use products can only be handled by certified personnel.

**Enforcement:**
- Product marked `restrictedUse: true`
- Issue/transfer events check certifications
- Expired certifications treated as no certification

**Verification:**
```typescript
function canHandleRestrictedProduct(
  person: PersonID,
  product: ProductID
): boolean {
  if (!product.restrictedUse) return true;

  const certs = getPerson(person).certifications;
  return certs.some(c =>
    c.type === 'restricted_use_applicator' &&
    c.expiresAt > now()
  );
}
```

**Failure Mode:** Uncertified handling of restricted chemicals violates EPA regulations. Legal liability.

---

### INV-104: Custody Chain Continuity

**Statement:** Custody can only transfer through explicit events. No implicit custody changes.

**Enforcement:**
- Every custody transfer is an event (Transfer, Issue, Return)
- Location responsible party changes require acknowledgment event
- Custody queries trace back through event chain

**Verification:**
```typescript
function getCustodyHistory(
  product: ProductID,
  lot: string,
  asOf: Timestamp
): CustodyRecord[] {
  return events
    .filter(e => e.product === product && e.lotNumber === lot)
    .filter(e => e.occurredAt <= asOf)
    .map(e => ({
      from: e.fromLocation,
      to: e.toLocation,
      transferredBy: e.performedBy,
      at: e.occurredAt
    }));
}
```

**Failure Mode:** Gaps in custody chain mean "we don't know who had it." Audit failure.

---

## Category 3: Temporal Invariants

### INV-201: Event Ordering Preservation

**Statement:** Events must maintain causal order. An event cannot depend on a future event.

**Enforcement:**
- Events reference only past events in `sourceEvent`
- Event processor validates temporal ordering
- Offline events use sequence numbers for local ordering

**Verification:**
```sql
SELECT * FROM events e
JOIN events source ON e.source_event = source.id
WHERE e.occurred_at < source.occurred_at;
-- Should return zero rows
```

**Failure Mode:** Circular dependencies make state computation impossible.

---

### INV-202: Recorded vs Occurred Timestamp Tracking

**Statement:** Every event tracks both when it occurred and when it was recorded.

**Fields:**
- `occurredAt`: When the action happened (claimed)
- `recordedAt`: When the server received it (system-generated)

**Enforcement:**
- `recordedAt` is server-assigned, never client-provided
- Large discrepancy (>24h) requires approval
- Both timestamps are immutable

**Verification:**
```sql
SELECT * FROM events
WHERE recorded_at < occurred_at;
-- These require investigation (backdated events)
```

**Failure Mode:** Without dual timestamps, distinguishing legitimate offline events from fraudulent backdating is impossible.

---

### INV-203: Offline Sequence Preservation

**Statement:** Events from a single device maintain strict ordering via sequence numbers.

**Enforcement:**
- Device generates monotonically increasing sequence numbers
- Server rejects out-of-order events from same device
- Gaps in sequence numbers trigger investigation

**Verification:**
```sql
SELECT device_id, sequence_number, lead(sequence_number) OVER (
  PARTITION BY device_id ORDER BY sequence_number
) as next_seq
FROM events
WHERE offline_context IS NOT NULL
HAVING next_seq IS NOT NULL AND next_seq != sequence_number + 1;
-- Should return zero rows (no gaps)
```

**Failure Mode:** Out-of-order events could allow manipulation of business logic.

---

## Category 4: Operational Invariants

### INV-301: Product Lifecycle Enforcement

**Statement:** Products in non-Active state cannot be issued.

**States and Allowed Actions:**
| State | Receive | Issue | Transfer | Dispose |
|-------|---------|-------|----------|---------|
| Active | ✓ | ✓ | ✓ | ✓ |
| Deprecated | ✗ | ✓ | ✓ | ✓ |
| Recalled | ✗ | ✗ | ✗ | ✓ |
| Discontinued | ✗ | ✗ | ✗ | ✓ |

**Enforcement:**
- Event processor checks product status before accepting events
- Status changes broadcast to all offline devices at sync

**Failure Mode:** Recalled products issued to customers. Regulatory violation, customer harm.

---

### INV-302: Location Status Enforcement

**Statement:** Decommissioned locations cannot receive inventory.

**Enforcement:**
- Transfer to decommissioned location rejected
- Decommissioning requires zero inventory
- Active inventory at inactive location generates alert

**Verification:**
```typescript
function canDecommission(location: LocationID): boolean {
  const inventory = getInventoryAt(location, now());
  return inventory.items.length === 0;
}
```

**Failure Mode:** Inventory stuck at non-existent location. Lost and unaccountable.

---

### INV-303: Expiration Enforcement

**Statement:** Expired products cannot be issued (can be disposed).

**Enforcement:**
- Issue event checks expiration date if `expirationTracked: true`
- 30-day warning for approaching expiration
- Expired products auto-flagged for disposal

**Verification:**
```sql
SELECT * FROM events
WHERE event_type = 'issue'
AND product_id IN (SELECT id FROM products WHERE expiration_tracked = true)
AND (expiration_date IS NULL OR expiration_date < occurred_at);
-- Should return zero rows
```

**Failure Mode:** Expired chemicals applied at customer site. Effectiveness issues, liability.

---

### INV-304: Dispute Closure Requirements

**Statement:** Disputes cannot close without resolution or explicit write-off.

**Enforcement:**
- Dispute status cannot change to `resolved` without `resolution` object
- Write-offs require authorization above threshold
- Unresolved disputes block location reconciliation

**Verification:**
```sql
SELECT * FROM disputes
WHERE status = 'resolved'
AND resolution IS NULL;
-- Should return zero rows
```

**Failure Mode:** Discrepancies swept under rug. Inventory accuracy degrades over time.

---

### INV-305: Conversion Balance

**Statement:** Unit conversions must preserve total quantity in base units.

**Enforcement:**
- Convert events validate `fromQuantity` and `toQuantity` are equivalent in base units
- Conversion rates are defined per product, not entered per event

**Verification:**
```typescript
function validateConversion(event: ConvertEvent): boolean {
  const fromBase = toBaseUnits(event.fromQuantity, event.product);
  const toBase = toBaseUnits(event.toQuantity, event.product);
  return Math.abs(fromBase - toBase) < EPSILON;
}
```

**Failure Mode:** Opening a case creates more (or fewer) bottles than it should. Inventory inflation/deflation.

---

## Category 5: Conflict Resolution Invariants

### INV-401: No Silent Override

**Statement:** Offline conflicts must be explicitly resolved, never silently ignored.

**Enforcement:**
- Conflicting events marked with `syncStatus: 'conflicted'`
- Conflicts block affected inventory until resolved
- Resolution creates audit trail

**Verification:**
```sql
SELECT * FROM events
WHERE sync_status = 'conflicted'
AND conflict_resolution IS NULL
AND recorded_at < NOW() - INTERVAL '7 days';
-- Should return zero rows (old unresolved conflicts)
```

**Failure Mode:** Data is silently wrong. Users lose trust in system.

---

### INV-402: Conflict Resolution Authority

**Statement:** Conflicts can only be resolved by authorized personnel.

**Enforcement:**
- Conflict resolution requires manager or inventory manager role
- Original actors cannot resolve their own conflicts
- Resolution stored with resolver identity

**Failure Mode:** Users could "resolve" conflicts in their favor without oversight.

---

### INV-403: Pending Action Preservation

**Statement:** No offline action is silently dropped. Every action reaches a terminal state.

**Terminal States:**
- `synced`: Successfully recorded
- `conflicted`: Requires resolution
- `failed`: Rejected with reason (user notified)

**Enforcement:**
- Client maintains queue until acknowledgment
- Server acknowledges each action individually
- User notification on any non-success outcome

**Failure Mode:** User believes action succeeded but it didn't. Reality diverges from expectation.

---

## Invariant Verification Schedule

| Invariant | Verification Frequency | Method |
|-----------|------------------------|--------|
| INV-001 | On every read | Event replay |
| INV-002 | Hourly | Sum check |
| INV-003 | Continuous | Database triggers |
| INV-004 | Daily | Conservation check |
| INV-005 | On every write | Type system |
| INV-006 | On every event | Pre-commit check |
| INV-101 | On every action | Permission check |
| INV-102 | On finalization | Different-actor check |
| INV-103 | On restricted product action | Certification lookup |
| INV-104 | On demand | Chain trace |
| INV-201 | On event insert | Temporal validation |
| INV-202 | On event insert | Server timestamp assignment |
| INV-203 | On sync | Sequence validation |
| INV-301 | On product action | Status check |
| INV-302 | On location action | Status check |
| INV-303 | On issue | Expiration check |
| INV-304 | On dispute close | Resolution presence check |
| INV-305 | On convert | Balance validation |
| INV-401 | Hourly | Conflict scan |
| INV-402 | On resolution | Authority check |
| INV-403 | Continuous | Queue monitoring |

---

## Invariant Violation Response

When an invariant is violated:

1. **Immediate Actions**
   - Log violation with full context
   - Alert operations team
   - Block affected operations if necessary

2. **Investigation**
   - Determine root cause (bug, data corruption, attack)
   - Assess scope of impact
   - Document timeline

3. **Remediation**
   - Fix root cause
   - Create compensating events if needed
   - Verify invariant restored

4. **Post-Incident**
   - Update verification to catch similar issues
   - Consider additional safeguards
   - Document in incident database

---

*Document Version: 1.0*
*Last Updated: 2026-01-10*
*Review Schedule: Quarterly*
