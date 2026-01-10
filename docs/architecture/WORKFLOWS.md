# Operational Workflows

This document specifies the step-by-step procedures for common inventory operations. Each workflow includes the happy path, error handling, and edge cases.

---

## Workflow 1: Receiving Inventory from Supplier

### Actors
- **Warehouse Staff**: Initiates receipt
- **Inventory Manager**: Verifies and finalizes

### Trigger
Physical delivery arrives at warehouse

### Steps

```
┌─────────────────────────────────────────────────────────────────┐
│                    RECEIVING WORKFLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. INITIATION (Warehouse Staff)                                 │
│     ├─ Scan or enter PO number                                   │
│     ├─ System displays expected items                            │
│     ├─ For each line item:                                       │
│     │   ├─ Enter received quantity                               │
│     │   ├─ Scan/enter lot number (if lot-tracked)                │
│     │   ├─ Enter expiration date (if expiration-tracked)         │
│     │   └─ Note any damage or discrepancy                        │
│     ├─ Capture delivery receipt photo                            │
│     └─ Submit for verification                                   │
│                                                                  │
│  2. VERIFICATION (Inventory Manager)                             │
│     ├─ Review submitted receipt                                  │
│     ├─ Verify quantities match PO (or document variance)         │
│     ├─ Verify lot/expiration data                                │
│     ├─ If variance:                                              │
│     │   ├─ Document reason                                       │
│     │   └─ Create supplier communication record                  │
│     └─ Approve receipt                                           │
│                                                                  │
│  3. FINALIZATION (System)                                        │
│     ├─ Create Receive events for each line item                  │
│     ├─ Update inventory state                                    │
│     ├─ Link events to PO                                         │
│     ├─ Notify relevant parties                                   │
│     └─ Update reorder status if applicable                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Captured

```typescript
interface ReceiveWorkflow {
  purchaseOrderNumber: string;
  supplier: string;
  deliveryDate: Date;
  receivedBy: PersonID;
  verifiedBy: PersonID;

  lines: ReceiveLine[];

  deliveryReceiptPhoto?: Attachment;
  notes?: string;
}

interface ReceiveLine {
  product: ProductID;
  expectedQuantity: Quantity;
  receivedQuantity: Quantity;
  lotNumber?: string;
  expirationDate?: Date;
  condition: 'good' | 'damaged' | 'partial';
  varianceReason?: string;
  location: LocationID;          // Where to put it
}
```

### Edge Cases

| Situation | Handling |
|-----------|----------|
| Received more than ordered | Accept and note overage; supplier billing follow-up |
| Received less than ordered | Accept partial; create backorder follow-up |
| Wrong product received | Reject and document; do not enter into inventory |
| Damaged product | Enter into Quarantine location; create supplier claim |
| Missing lot number | Block receipt for lot-tracked products |
| Expired upon receipt | Reject; do not enter into inventory |

---

## Workflow 2: Issuing Product at Service Site

### Actors
- **Technician**: Performs service and records usage

### Trigger
Technician uses product during customer service

### Steps

```
┌─────────────────────────────────────────────────────────────────┐
│                    ISSUE WORKFLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. PRE-ISSUE VALIDATION (happens on selection)                  │
│     ├─ Verify product is in tech's assigned location             │
│     ├─ Verify sufficient quantity available                      │
│     ├─ Verify product status is Active                           │
│     ├─ Verify product not expired                                │
│     ├─ Verify product not recalled                               │
│     └─ If restricted-use: verify tech has certification          │
│                                                                  │
│  2. USAGE RECORDING (Technician)                                 │
│     ├─ Select product from available inventory                   │
│     ├─ Enter quantity used                                       │
│     ├─ Select lot (if multiple lots available)                   │
│     ├─ Link to service order (for billing)                       │
│     └─ Submit (works offline)                                    │
│                                                                  │
│  3. EVENT CREATION (System)                                      │
│     ├─ Create Issue event                                        │
│     ├─ Set fromLocation = tech's location                        │
│     ├─ Set toLocation = service site (transient)                 │
│     ├─ Record offline context if applicable                      │
│     └─ Queue for sync if offline                                 │
│                                                                  │
│  4. POST-ISSUE (System)                                          │
│     ├─ Update local inventory view                               │
│     ├─ Check reorder thresholds                                  │
│     ├─ Generate alerts if low stock                              │
│     └─ Sync when connectivity available                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Validation Rules

```typescript
interface IssueValidation {
  validate(request: IssueRequest): ValidationResult {
    const errors: ValidationError[] = [];

    // Check availability
    const available = getAvailableQuantity(
      request.product,
      request.fromLocation
    );
    if (available < request.quantity.value) {
      errors.push({
        code: 'INSUFFICIENT_INVENTORY',
        message: `Only ${available} available, requested ${request.quantity.value}`
      });
    }

    // Check product status
    const product = getProduct(request.product);
    if (product.status !== 'active') {
      errors.push({
        code: 'PRODUCT_NOT_ACTIVE',
        message: `Product is ${product.status}`
      });
    }

    // Check expiration
    if (product.expirationTracked) {
      const lot = getLot(request.product, request.lotNumber);
      if (lot?.expirationDate && lot.expirationDate < today()) {
        errors.push({
          code: 'PRODUCT_EXPIRED',
          message: `Lot ${request.lotNumber} expired on ${lot.expirationDate}`
        });
      }
    }

    // Check certification
    if (product.restrictedUse) {
      const tech = getPerson(request.performedBy);
      if (!hasValidCertification(tech, 'restricted_use_applicator')) {
        errors.push({
          code: 'CERTIFICATION_REQUIRED',
          message: 'Restricted-use product requires certified applicator'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
```

### Edge Cases

| Situation | Handling |
|-----------|----------|
| Insufficient inventory (offline) | Allow with warning; conflict resolved at sync |
| Multiple lots available | Show FIFO recommendation; tech can override |
| Product expires today | Allow with warning; document acknowledgment |
| No service order linked | Allow; flag for billing follow-up |
| Emergency use without cert | Allow with emergency override; escalate for review |

---

## Workflow 3: Vehicle Stock Transfer

### Actors
- **Technician**: Requests and receives stock
- **Warehouse Staff**: Prepares order
- **Inventory Manager**: Approves large transfers

### Trigger
Technician needs to restock vehicle

### Steps

```
┌─────────────────────────────────────────────────────────────────┐
│                VEHICLE RESTOCK WORKFLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. REQUEST (Technician)                                         │
│     ├─ View current vehicle inventory                            │
│     ├─ System suggests items below reorder point                 │
│     ├─ Tech selects items and quantities                         │
│     ├─ Submit restock request                                    │
│     └─ If under threshold: auto-approved                         │
│                                                                  │
│  2. APPROVAL (if required)                                       │
│     ├─ Request routes to approver based on:                      │
│     │   ├─ Total value                                           │
│     │   ├─ Contains restricted products                          │
│     │   └─ Cross-branch transfer                                 │
│     ├─ Approver reviews and decides                              │
│     └─ Tech notified of outcome                                  │
│                                                                  │
│  3. PREPARATION (Warehouse Staff)                                │
│     ├─ View approved requests queue                              │
│     ├─ Pick items from warehouse                                 │
│     ├─ Stage for pickup                                          │
│     └─ Mark as ready                                             │
│                                                                  │
│  4. PICKUP (Technician)                                          │
│     ├─ Arrive at warehouse                                       │
│     ├─ Verify items match request                                │
│     ├─ Confirm receipt (signature)                               │
│     └─ Transfer events created                                   │
│                                                                  │
│  5. RECONCILIATION (System)                                      │
│     ├─ Update warehouse inventory (decrease)                     │
│     ├─ Update vehicle inventory (increase)                       │
│     ├─ Link events to original request                           │
│     └─ Close request                                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Approval Matrix

```typescript
const TRANSFER_APPROVAL_RULES = [
  {
    condition: (req) => getTotalValue(req) > 500,
    requiredApprover: 'branch_manager'
  },
  {
    condition: (req) => hasRestrictedProducts(req),
    requiredApprover: 'inventory_manager'
  },
  {
    condition: (req) => isCrossBranch(req),
    requiredApprovers: ['source_branch_manager', 'dest_branch_manager']
  },
  {
    condition: (req) => req.items.length > 20,
    requiredApprover: 'inventory_manager'
  }
];
```

---

## Workflow 4: Physical Inventory Count

### Actors
- **Counter**: Performs physical count
- **Witness**: Verifies count (for high-value)
- **Inventory Manager**: Reviews and approves adjustments

### Trigger
Scheduled count or investigation

### Steps

```
┌─────────────────────────────────────────────────────────────────┐
│                PHYSICAL COUNT WORKFLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. INITIATION                                                   │
│     ├─ Manager schedules count for location                      │
│     ├─ System generates count sheet (expected quantities)        │
│     ├─ Location optionally frozen (no issues during count)       │
│     └─ Counter assigned                                          │
│                                                                  │
│  2. COUNTING (Counter)                                           │
│     ├─ For each product in location:                             │
│     │   ├─ Physically count units                                │
│     │   ├─ Record quantity found                                 │
│     │   ├─ Note lot numbers if tracked                           │
│     │   └─ Note condition issues                                 │
│     ├─ Record products found but not expected (unknown items)    │
│     └─ Submit count                                              │
│                                                                  │
│  3. WITNESSING (if required)                                     │
│     ├─ Witness reviews count                                     │
│     ├─ Spot-checks selected items                                │
│     └─ Co-signs count submission                                 │
│                                                                  │
│  4. VARIANCE ANALYSIS (System)                                   │
│     ├─ Compare counted vs expected                               │
│     ├─ Categorize variances:                                     │
│     │   ├─ Minor (<5%): Auto-approve adjustment                  │
│     │   ├─ Moderate (5-10%): Route to manager                    │
│     │   └─ Major (>10% or high-value): Create dispute            │
│     └─ Generate variance report                                  │
│                                                                  │
│  5. RESOLUTION (Inventory Manager)                               │
│     ├─ Review variance report                                    │
│     ├─ For each significant variance:                            │
│     │   ├─ Investigate cause                                     │
│     │   ├─ Document explanation                                  │
│     │   └─ Approve or escalate                                   │
│     └─ Authorize adjustments                                     │
│                                                                  │
│  6. FINALIZATION (System)                                        │
│     ├─ Create Count event                                        │
│     ├─ Create Adjust events for each variance                    │
│     ├─ Link all events to count record                           │
│     ├─ Unfreeze location                                         │
│     └─ Archive count documentation                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Variance Categorization

```typescript
interface VarianceRule {
  threshold: number;              // Percentage
  valueThreshold?: number;        // Dollar amount
  handling: 'auto_adjust' | 'manager_review' | 'dispute';
}

const VARIANCE_RULES: VarianceRule[] = [
  { threshold: 5, handling: 'auto_adjust' },
  { threshold: 10, handling: 'manager_review' },
  { threshold: Infinity, handling: 'dispute' },
  { threshold: 0, valueThreshold: 100, handling: 'manager_review' },
  { threshold: 0, valueThreshold: 500, handling: 'dispute' }
];

function categorizeVariance(
  expected: Quantity,
  actual: Quantity,
  unitValue: number
): VarianceRule {
  const variance = Math.abs(actual.value - expected.value);
  const variancePercent = (variance / expected.value) * 100;
  const varianceValue = variance * unitValue;

  return VARIANCE_RULES.find(rule =>
    variancePercent <= rule.threshold ||
    (rule.valueThreshold && varianceValue >= rule.valueThreshold)
  )!;
}
```

---

## Workflow 5: Product Recall Response

### Actors
- **Compliance Officer**: Initiates recall
- **Inventory Manager**: Coordinates quarantine
- **Technicians**: Return affected product
- **All**: Notified of recall

### Trigger
EPA/manufacturer recall notice

### Steps

```
┌─────────────────────────────────────────────────────────────────┐
│                    RECALL WORKFLOW                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. RECALL INITIATION (Compliance Officer)                       │
│     ├─ Enter recall details (product, lots, reason)              │
│     ├─ Set recall severity (voluntary/mandatory)                 │
│     ├─ Upload official recall notice                             │
│     └─ Activate recall                                           │
│                                                                  │
│  2. SYSTEM RESPONSE (Immediate)                                  │
│     ├─ Product status → Recalled                                 │
│     ├─ Block all Issue events for this product                   │
│     ├─ Generate location report (where is it?)                   │
│     ├─ Push notification to all users                            │
│     └─ Create quarantine requests for all locations              │
│                                                                  │
│  3. QUARANTINE (Each Location)                                   │
│     ├─ Location responsible party notified                       │
│     ├─ Physically segregate affected product                     │
│     ├─ Record quarantine event                                   │
│     ├─ Photograph affected inventory                             │
│     └─ Confirm quarantine complete                               │
│                                                                  │
│  4. TRACKING (Compliance Officer)                                │
│     ├─ Dashboard shows recall compliance by location             │
│     ├─ Follow up on non-compliant locations                      │
│     ├─ Document all actions taken                                │
│     └─ Prepare regulatory report                                 │
│                                                                  │
│  5. DISPOSITION (Compliance Officer)                             │
│     ├─ Receive disposal instructions from manufacturer           │
│     ├─ For each quarantined lot:                                 │
│     │   ├─ Dispose per instructions                              │
│     │   ├─ Record disposal event                                 │
│     │   └─ Capture disposal documentation                        │
│     └─ Close recall                                              │
│                                                                  │
│  6. REPORTING (System)                                           │
│     ├─ Generate complete chain of custody                        │
│     ├─ Document all affected customers (if issued)               │
│     ├─ Calculate financial impact                                │
│     └─ Archive for regulatory retention                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Recall Dashboard

```typescript
interface RecallDashboard {
  recall: RecallInfo;

  // Aggregate metrics
  totalQuantityAffected: Quantity;
  quantityQuarantined: Quantity;
  quantityDisposed: Quantity;
  quantityUnaccounted: Quantity;

  // By location
  locationStatus: LocationRecallStatus[];

  // Timeline
  events: RecallEvent[];

  // Compliance
  compliancePercentage: number;
  nonCompliantLocations: LocationID[];
  daysActive: number;
}

interface LocationRecallStatus {
  location: LocationID;
  responsibleParty: PersonID;
  expectedQuantity: Quantity;
  quarantinedQuantity: Quantity;
  status: 'pending' | 'quarantined' | 'disposed' | 'non_compliant';
  lastAction: Timestamp;
}
```

---

## Workflow 6: Employee Termination - Inventory Handoff

### Actors
- **HR/Admin**: Initiates termination
- **Terminating Employee**: Hands over inventory
- **Receiving Party**: Accepts custody
- **Inventory Manager**: Resolves discrepancies

### Trigger
Employee termination (voluntary or involuntary)

### Steps

```
┌─────────────────────────────────────────────────────────────────┐
│                TERMINATION HANDOFF WORKFLOW                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. INITIATION (HR/Admin)                                        │
│     ├─ Mark employee as terminating                              │
│     ├─ Set last working day                                      │
│     ├─ System identifies inventory in custody                    │
│     └─ Assign receiving party                                    │
│                                                                  │
│  2. PREPARATION (System)                                         │
│     ├─ Block new issues to terminating employee                  │
│     ├─ Generate custody report                                   │
│     ├─ Schedule handoff meeting                                  │
│     └─ Notify all parties                                        │
│                                                                  │
│  3. PHYSICAL HANDOFF                                             │
│     ├─ Both parties present                                      │
│     ├─ Complete physical count of:                               │
│     │   ├─ Vehicle inventory                                     │
│     │   ├─ Personal stock                                        │
│     │   └─ Equipment                                             │
│     ├─ Document condition of items                               │
│     ├─ Note any missing items                                    │
│     └─ Both parties sign acknowledgment                          │
│                                                                  │
│  4. RECONCILIATION                                               │
│     ├─ Compare physical to expected                              │
│     ├─ For variances:                                            │
│     │   ├─ Minor: Auto-adjust with 'termination_handoff' reason  │
│     │   └─ Significant: Create dispute                           │
│     └─ Create Transfer events for all items                      │
│                                                                  │
│  5. FINALIZATION                                                 │
│     ├─ Update location responsible parties                       │
│     ├─ Deactivate employee account                               │
│     ├─ Revoke device access                                      │
│     ├─ Quarantine any pending offline events                     │
│     └─ Archive employee record                                   │
│                                                                  │
│  6. POST-TERMINATION (if disputes)                               │
│     ├─ Investigate missing items                                 │
│     ├─ Coordinate with HR on recovery                            │
│     ├─ Document outcome                                          │
│     └─ Close disputes                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Handoff Documentation

```typescript
interface TerminationHandoff {
  employee: PersonID;
  terminationDate: Date;
  receivingParty: PersonID;
  witness?: PersonID;

  handoffDate: Timestamp;
  handoffLocation: string;

  items: HandoffItem[];

  signatures: {
    departing: Attachment;
    receiving: Attachment;
    witness?: Attachment;
  };

  discrepancies: HandoffDiscrepancy[];
  resultingDisputes: DisputeID[];
}

interface HandoffItem {
  product: ProductID;
  expectedQuantity: Quantity;
  actualQuantity: Quantity;
  condition: 'good' | 'damaged' | 'missing';
  notes?: string;
  fromLocation: LocationID;
  toLocation: LocationID;
  resultingEvent: EventID;
}

interface HandoffDiscrepancy {
  product: ProductID;
  variance: Quantity;
  explanation?: string;
  action: 'adjusted' | 'disputed' | 'written_off';
}
```

---

## Workflow 7: Dispute Investigation

### Actors
- **Investigator**: Assigned to resolve
- **Witnesses**: Provide information
- **Inventory Manager**: Final authority
- **Finance**: For write-offs

### Trigger
Automatic (from variance) or manual (reported)

### Steps

```
┌─────────────────────────────────────────────────────────────────┐
│                DISPUTE INVESTIGATION WORKFLOW                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. TRIAGE                                                       │
│     ├─ Categorize dispute type                                   │
│     ├─ Assess severity and value                                 │
│     ├─ Assign investigator                                       │
│     └─ Set investigation deadline                                │
│                                                                  │
│  2. EVIDENCE GATHERING                                           │
│     ├─ Pull event history for affected items                     │
│     ├─ Identify last known good state                            │
│     ├─ List all persons who had access                           │
│     ├─ Check for related offline sync issues                     │
│     ├─ Review physical access logs (if applicable)               │
│     └─ Interview relevant parties                                │
│                                                                  │
│  3. ROOT CAUSE ANALYSIS                                          │
│     ├─ Determine most likely explanation:                        │
│     │   ├─ Data entry error                                      │
│     │   ├─ System bug                                            │
│     │   ├─ Process gap                                           │
│     │   ├─ Theft                                                 │
│     │   └─ Unexplained loss                                      │
│     └─ Document evidence and reasoning                           │
│                                                                  │
│  4. RESOLUTION RECOMMENDATION                                    │
│     ├─ Determine appropriate resolution:                         │
│     │   ├─ Correction (fix data)                                 │
│     │   ├─ Recovery (item found)                                 │
│     │   ├─ Write-off (accept loss)                               │
│     │   └─ Escalation (requires authority)                       │
│     └─ Prepare resolution package                                │
│                                                                  │
│  5. AUTHORIZATION                                                │
│     ├─ If correction: Inventory Manager approves                 │
│     ├─ If write-off < threshold: Manager approves                │
│     ├─ If write-off >= threshold: Finance + Compliance approves  │
│     └─ Record authorization                                      │
│                                                                  │
│  6. EXECUTION                                                    │
│     ├─ Create corrective events                                  │
│     ├─ Update inventory state                                    │
│     ├─ Close dispute                                             │
│     └─ Notify stakeholders                                       │
│                                                                  │
│  7. PREVENTION                                                   │
│     ├─ Document lessons learned                                  │
│     ├─ Recommend process improvements                            │
│     └─ Update procedures if needed                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Investigation Checklist

```typescript
interface InvestigationChecklist {
  // Evidence
  eventHistoryReviewed: boolean;
  lastGoodStateIdentified: boolean;
  accessLogReviewed: boolean;
  relatedTransactionsChecked: boolean;

  // Interviews
  partiesIdentified: string[];
  partiesInterviewed: string[];
  statementsRecorded: boolean;

  // Analysis
  rootCauseIdentified: boolean;
  evidenceDocumented: boolean;
  preventiveMeasuresConsidered: boolean;

  // Resolution
  recommendationPrepared: boolean;
  authorizationObtained: boolean;
  correctiveActionsExecuted: boolean;
  stakeholdersNotified: boolean;
}
```

---

## Workflow 8: Emergency Override

### Actors
- **Technician**: Needs to act urgently
- **Manager**: Reviews after the fact
- **System**: Records everything

### Trigger
Urgent operational need without normal authorization

### Steps

```
┌─────────────────────────────────────────────────────────────────┐
│                EMERGENCY OVERRIDE WORKFLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. EMERGENCY DECLARATION (Technician)                           │
│     ├─ Acknowledge override warning                              │
│     ├─ Provide justification reason                              │
│     ├─ Capture photo documentation if possible                   │
│     └─ Proceed with action                                       │
│                                                                  │
│  2. EVENT CREATION (System)                                      │
│     ├─ Create event with emergency_override flag                 │
│     ├─ Record justification                                      │
│     ├─ Set high-priority review flag                             │
│     └─ Queue notification for sync                               │
│                                                                  │
│  3. NOTIFICATION (on sync)                                       │
│     ├─ Push notification to manager                              │
│     ├─ Email to inventory manager                                │
│     ├─ Add to emergency review queue                             │
│     └─ Set 24-hour review deadline                               │
│                                                                  │
│  4. REVIEW (Manager)                                             │
│     ├─ Review justification                                      │
│     ├─ Review context (service order, customer)                  │
│     ├─ Determine if override was appropriate                     │
│     └─ Decide: approve, correct, or escalate                     │
│                                                                  │
│  5. OUTCOME                                                      │
│     ├─ If approved:                                              │
│     │   ├─ Clear emergency flag                                  │
│     │   └─ Event stands as-is                                    │
│     ├─ If correction needed:                                     │
│     │   ├─ Create corrective adjustment                          │
│     │   └─ Notify technician                                     │
│     └─ If escalate:                                              │
│         ├─ Create dispute                                        │
│         └─ Assign investigation                                  │
│                                                                  │
│  6. PATTERN MONITORING (Ongoing)                                 │
│     ├─ Track emergency override frequency by user                │
│     ├─ Flag users with excessive overrides                       │
│     └─ Review for process improvement opportunities              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Emergency Override Rules

```typescript
const EMERGENCY_OVERRIDE_RULES = {
  // What can be overridden
  allowedOverrides: [
    'insufficient_inventory',       // Product desperately needed
    'missing_certification',        // Certified tech unavailable
    'quantity_limit_exceeded',      // Need more than usual
    'missing_approval'              // Approver unreachable
  ],

  // What can NEVER be overridden
  blockedOverrides: [
    'recalled_product',             // Safety critical
    'expired_product',              // Safety critical
    'terminated_user',              // Security critical
    'revoked_device'                // Security critical
  ],

  // Monitoring thresholds
  thresholds: {
    overridesPerDay: 2,             // Flag if exceeded
    overridesPerWeek: 5,            // Require manager meeting
    overridesPerMonth: 10           // Escalate to HR
  }
};
```

---

## Workflow Summary Matrix

| Workflow | Online Required | Approval Required | Creates Dispute |
|----------|-----------------|-------------------|-----------------|
| Receiving | Yes (finalize) | Yes (verify) | If variance |
| Issue | No | No (under limit) | If conflict |
| Transfer | No | Conditional | If conflict |
| Physical Count | No | For adjustments | If >10% variance |
| Recall | Yes (initiate) | No (compliance) | No |
| Termination | Yes | Yes | If missing items |
| Dispute Resolution | Yes | Yes | N/A |
| Emergency Override | No | Post-facto | If denied |

---

*Document Version: 1.0*
*Last Updated: 2026-01-10*
