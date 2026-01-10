# Offline-First Architecture

This document specifies how the PCO Inventory System handles offline operations. Offline is not an error state—it is an **expected operating condition** for field technicians.

---

## Design Philosophy

### Offline is Normal

Technicians work in basements, rural areas, and inside metal buildings. Connectivity cannot be assumed. The system must:

1. **Allow all critical operations offline** - Issue, return, count, transfer
2. **Preserve user intent** - What the user meant to do must be recoverable
3. **Resolve conflicts deterministically** - No silent data loss
4. **Maintain audit integrity** - Offline events are first-class events

### Truth Has Multiple Sources

In a distributed system, there is no single "current truth" during partitions:

- **Server state**: What the server knows
- **Device state**: What each device knows
- **Physical reality**: What actually exists

The system reconciles these through explicit events and conflict resolution, never through silent override.

---

## Data Model for Offline

### Device Registration

```typescript
interface Device {
  id: DeviceID;
  userId: PersonID;
  name: string;                    // "John's iPhone"
  registeredAt: Timestamp;
  lastSyncAt: Timestamp;
  status: 'active' | 'suspended' | 'revoked';

  // For security
  publicKey: string;              // Device signs events
  revokedAt?: Timestamp;
  revokedReason?: string;
}
```

### Local Event Queue

Each device maintains a queue of pending events:

```typescript
interface LocalEventQueue {
  deviceId: DeviceID;
  events: PendingEvent[];

  // Sync state
  lastSuccessfulSync: Timestamp;
  lastAttemptedSync: Timestamp;
  syncFailures: number;
}

interface PendingEvent {
  localId: UUID;                  // Generated client-side
  serverId?: EventID;             // Assigned on successful sync
  event: InventoryEvent;
  status: 'queued' | 'syncing' | 'synced' | 'conflicted' | 'failed';

  // Retry tracking
  attempts: number;
  lastAttempt?: Timestamp;
  lastError?: string;

  // Conflict handling
  conflictDetails?: ConflictDetails;
}
```

### Offline Context

Every event created offline includes provenance information:

```typescript
interface OfflineContext {
  // Device identification
  deviceId: DeviceID;

  // Ordering within device
  sequenceNumber: number;         // Monotonic counter

  // Timing (for conflict detection)
  deviceTimestamp: Timestamp;     // Device clock at creation
  claimedOccurredAt: Timestamp;   // User-provided "when did this happen"

  // State at creation (for conflict detection)
  lastKnownServerStateHash: string;
  localInventorySnapshotHash: string;

  // Sync outcome
  syncedAt?: Timestamp;           // When server accepted it
  syncStatus: 'pending' | 'synced' | 'conflicted' | 'failed';
}
```

---

## Sequence Numbers

### Purpose

Sequence numbers establish total ordering for events from a single device, independent of clock accuracy.

### Properties

1. **Monotonically increasing** per device
2. **Gap-free** (1, 2, 3... never 1, 3, 4)
3. **Persistent** across app restarts
4. **Never reused** on a device

### Implementation

```typescript
class SequenceNumberGenerator {
  private current: number;
  private deviceId: DeviceID;

  constructor(deviceId: DeviceID) {
    this.deviceId = deviceId;
    this.current = this.loadFromStorage() ?? 0;
  }

  next(): number {
    this.current++;
    this.persistToStorage(this.current);
    return this.current;
  }

  private persistToStorage(value: number): void {
    // Must be durable before returning
    localStorage.setItem(`seq_${this.deviceId}`, value.toString());
  }
}
```

### Server Validation

Server rejects events that violate sequence ordering:

```typescript
function validateSequence(event: InventoryEvent): ValidationResult {
  const ctx = event.offlineContext;
  if (!ctx) return { valid: true }; // Online event

  const lastSeq = getLastSequenceFor(ctx.deviceId);

  if (ctx.sequenceNumber <= lastSeq) {
    return {
      valid: false,
      error: 'DUPLICATE_OR_REPLAY',
      message: `Expected sequence > ${lastSeq}, got ${ctx.sequenceNumber}`
    };
  }

  if (ctx.sequenceNumber !== lastSeq + 1) {
    return {
      valid: false,
      error: 'SEQUENCE_GAP',
      message: `Expected sequence ${lastSeq + 1}, got ${ctx.sequenceNumber}`
    };
  }

  return { valid: true };
}
```

---

## Sync Protocol

### Sync Phases

```
┌─────────────────────────────────────────────────────┐
│                    SYNC PROCESS                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  1. PRE-SYNC                                         │
│     ├─ Check connectivity                            │
│     ├─ Acquire sync lock (prevent concurrent syncs)  │
│     └─ Snapshot current queue                        │
│                                                      │
│  2. UPLOAD PHASE                                     │
│     ├─ For each pending event (in sequence order):   │
│     │   ├─ Send to server                            │
│     │   ├─ Await acknowledgment                      │
│     │   ├─ Handle success/conflict/failure           │
│     │   └─ Update local status                       │
│     └─ Stop on first conflict (must resolve first)   │
│                                                      │
│  3. DOWNLOAD PHASE                                   │
│     ├─ Fetch events since lastSyncTimestamp          │
│     ├─ Apply to local state                          │
│     └─ Update lastSyncTimestamp                      │
│                                                      │
│  4. POST-SYNC                                        │
│     ├─ Release sync lock                             │
│     ├─ Notify UI of changes                          │
│     └─ Schedule next sync                            │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Upload Protocol

```typescript
async function uploadPendingEvents(queue: LocalEventQueue): Promise<SyncResult> {
  const results: EventSyncResult[] = [];

  // Process in sequence order
  const sorted = queue.events
    .filter(e => e.status === 'queued')
    .sort((a, b) => a.event.offlineContext!.sequenceNumber -
                    b.event.offlineContext!.sequenceNumber);

  for (const pending of sorted) {
    pending.status = 'syncing';
    pending.attempts++;
    pending.lastAttempt = now();

    try {
      const response = await server.submitEvent(pending.event);

      if (response.status === 'accepted') {
        pending.status = 'synced';
        pending.serverId = response.eventId;
        pending.event.offlineContext!.syncedAt = now();
        results.push({ localId: pending.localId, success: true });
      }
      else if (response.status === 'conflict') {
        pending.status = 'conflicted';
        pending.conflictDetails = response.conflictDetails;
        results.push({
          localId: pending.localId,
          success: false,
          conflict: response.conflictDetails
        });
        // Stop processing - conflict must be resolved
        break;
      }
      else if (response.status === 'rejected') {
        pending.status = 'failed';
        pending.lastError = response.reason;
        results.push({
          localId: pending.localId,
          success: false,
          error: response.reason
        });
        // Continue with next event
      }
    } catch (error) {
      // Network error - leave as queued for retry
      pending.status = 'queued';
      pending.lastError = error.message;
      // Stop on network error
      break;
    }
  }

  return { results };
}
```

### Download Protocol

```typescript
async function downloadServerEvents(since: Timestamp): Promise<void> {
  const events = await server.getEvents({
    since,
    forLocations: getAssignedLocations(),
    limit: 1000
  });

  for (const event of events) {
    // Skip our own events (already in local state)
    if (event.offlineContext?.deviceId === thisDeviceId) {
      continue;
    }

    // Apply to local state
    applyEventToLocalState(event);

    // Check for conflicts with pending events
    detectLocalConflicts(event);
  }

  updateLastSyncTimestamp(events[events.length - 1]?.recordedAt ?? since);
}
```

---

## Conflict Detection and Resolution

### Conflict Types

#### Type 1: Insufficient Inventory

Two devices both issue from the same stock while offline.

```
Server state: Location A has 10 units

Device 1 (offline): Issues 8 units → believes 2 remain
Device 2 (offline): Issues 7 units → believes 3 remain

Reality: 15 units "issued" from 10
```

**Detection:**

```typescript
function detectInsufficientInventory(event: IssueEvent): ConflictDetails | null {
  const available = getServerInventoryAt(
    event.fromLocation,
    event.product,
    event.offlineContext.lastKnownServerStateHash
  );

  // Replay all events since that hash
  const currentAvailable = replayTo(available, now());

  if (currentAvailable < event.quantity.value) {
    return {
      type: 'INSUFFICIENT_INVENTORY',
      requested: event.quantity,
      available: { value: currentAvailable, unit: event.quantity.unit },
      conflictingEvents: getEventsSince(event.offlineContext.lastKnownServerStateHash)
    };
  }
  return null;
}
```

**Resolution Options:**

1. **Reject second event** - First synced wins
2. **Partial fulfillment** - Accept what's available
3. **Backorder** - Create request for remaining
4. **Adjustment** - If product was actually used, create adjustment

#### Type 2: Request State Race

Request approved by manager while tech cancelled while offline.

```
Request state: Pending

Manager (offline): Approves request
Tech (offline): Cancels request

Which wins?
```

**Resolution Rules:**

1. If product already moved: Cancellation fails (can't unmove)
2. If product not moved: More recent timestamp wins
3. Tie: Approval wins (bias toward action)

#### Type 3: Location State Change

Inventory transferred from location that no longer accepts transfers.

```
Location A: Active

Admin (online): Marks Location A inactive
Tech (offline): Transfers to Location A
```

**Resolution:**

Event rejected. Tech must choose new destination. Original event marked `failed` with reason.

### Resolution Workflow

```
┌────────────────────────────────────────────────────────────┐
│                  CONFLICT RESOLUTION                        │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  1. CONFLICT DETECTED                                       │
│     └─ Event enters 'conflicted' status                     │
│                                                             │
│  2. USER NOTIFIED                                           │
│     ├─ Push notification if available                       │
│     ├─ Banner in app                                        │
│     └─ Email if user hasn't acknowledged in 24h             │
│                                                             │
│  3. RESOLUTION OPTIONS PRESENTED                            │
│     ├─ Accept: Use server state, discard local              │
│     ├─ Retry: Attempt with current state                    │
│     ├─ Modify: Adjust event and resubmit                    │
│     └─ Escalate: Send to manager for decision               │
│                                                             │
│  4. RESOLUTION RECORDED                                     │
│     ├─ Create resolution record                             │
│     ├─ Create compensating event if needed                  │
│     └─ Clear conflict status                                │
│                                                             │
│  5. SYNC RESUMES                                            │
│     └─ Next queued event can now process                    │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### Manager Resolution Interface

For conflicts tech cannot resolve:

```typescript
interface ConflictResolutionScreen {
  conflict: ConflictDetails;
  localEvent: InventoryEvent;
  serverState: InventoryState;

  options: {
    acceptServer: {
      description: "Discard local event, accept server state";
      consequence: string;
    };
    acceptLocal: {
      description: "Force local event (creates adjustment)";
      consequence: string;
      requiresApproval: boolean;
    };
    merge: {
      description: "Partially apply local event";
      suggestedQuantity: Quantity;
    };
    investigate: {
      description: "Create dispute for investigation";
    };
  };
}
```

---

## Offline Capabilities Matrix

| Action | Offline Capable | Notes |
|--------|-----------------|-------|
| Issue product | ✓ | Subject to local inventory view |
| Return product | ✓ | |
| Transfer (own locations) | ✓ | |
| Physical count | ✓ | |
| View inventory | ✓ | May be stale |
| Create request | ✓ | Will sync when online |
| Approve request | ✓ | Provisional until sync |
| Deny request | ✓ | |
| Receive from supplier | ✗ | Requires verification |
| Create product | ✗ | Central function |
| Modify product | ✗ | Central function |
| Modify locations | ✗ | Central function |
| User management | ✗ | Central function |
| Generate reports | Partial | Cached data only |

---

## Local Storage Strategy

### What's Stored Locally

```typescript
interface LocalStorage {
  // Identity
  deviceRegistration: Device;
  currentUser: Person;

  // Event queue
  pendingEvents: PendingEvent[];

  // Cached server state
  inventorySnapshot: {
    asOf: Timestamp;
    locations: Map<LocationID, InventoryState>;
  };

  // Reference data
  products: Product[];               // All active products
  locations: Location[];             // Assigned locations
  persons: Person[];                 // For approval workflows

  // Sync metadata
  lastSuccessfulSync: Timestamp;
  serverStateHash: string;
}
```

### Storage Size Management

```typescript
const STORAGE_LIMITS = {
  maxPendingEvents: 500,             // Prevent unbounded growth
  maxCachedProducts: 10000,
  maxInventoryHistory: 30,           // Days of snapshots
  maxAttachmentSize: 5 * 1024 * 1024 // 5MB per attachment
};

function enforceStorageLimits(): void {
  // Archive old pending events that failed
  archiveOldFailedEvents(30); // 30 days

  // Trim inventory history
  trimInventorySnapshots(STORAGE_LIMITS.maxInventoryHistory);

  // Compress attachments if over limit
  compressLargeAttachments();
}
```

---

## Network Resilience

### Retry Strategy

```typescript
const RETRY_CONFIG = {
  maxAttempts: 4,
  backoffMs: [2000, 4000, 8000, 16000], // Exponential
  jitterMs: 1000,                        // Random jitter

  // When to retry
  retryableErrors: [
    'NETWORK_ERROR',
    'TIMEOUT',
    'SERVER_UNAVAILABLE',
    '502', '503', '504'
  ],

  // When NOT to retry
  terminalErrors: [
    'UNAUTHORIZED',
    'FORBIDDEN',
    'VALIDATION_ERROR',
    'CONFLICT'  // Requires user resolution
  ]
};

async function withRetry<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  for (let attempt = 0; attempt < RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (isTerminalError(error)) {
        throw error;
      }

      if (attempt < RETRY_CONFIG.maxAttempts - 1) {
        const delay = RETRY_CONFIG.backoffMs[attempt] +
                      Math.random() * RETRY_CONFIG.jitterMs;
        await sleep(delay);
      }
    }
  }
  throw new Error(`${context} failed after ${RETRY_CONFIG.maxAttempts} attempts`);
}
```

### Connectivity Detection

```typescript
interface ConnectivityState {
  isOnline: boolean;
  latencyMs: number;
  lastChecked: Timestamp;
  serverReachable: boolean;
}

async function checkConnectivity(): Promise<ConnectivityState> {
  const start = Date.now();

  try {
    await fetch('/api/health', { timeout: 5000 });
    return {
      isOnline: true,
      latencyMs: Date.now() - start,
      lastChecked: now(),
      serverReachable: true
    };
  } catch {
    return {
      isOnline: navigator.onLine,
      latencyMs: -1,
      lastChecked: now(),
      serverReachable: false
    };
  }
}
```

---

## Security Considerations

### Device Authentication

```typescript
interface DeviceAuthentication {
  // Device registers with server, receives keypair
  register(): Promise<{ deviceId: DeviceID; privateKey: string }>;

  // Events signed with device key
  signEvent(event: InventoryEvent): SignedEvent;

  // Server verifies signature
  verifySignature(event: SignedEvent): boolean;
}
```

### Device Revocation

If a device is lost or stolen:

```typescript
async function revokeDevice(deviceId: DeviceID, reason: string): Promise<void> {
  // Mark device as revoked
  await server.revokeDevice(deviceId, reason);

  // Quarantine all pending events from this device
  await quarantinePendingEvents(deviceId);

  // Notify user on other devices
  await notifyUser(device.userId, {
    type: 'DEVICE_REVOKED',
    deviceId,
    reason
  });

  // Create dispute for inventory in device's custody
  const custody = await getCustodyForDevice(deviceId);
  for (const item of custody) {
    await createDispute({
      type: 'device_revocation',
      relatedProduct: item.product,
      relatedLocation: item.location,
      description: `Device ${deviceId} revoked: ${reason}`
    });
  }
}
```

### Event Tampering Prevention

```typescript
interface SignedEvent extends InventoryEvent {
  signature: string;              // Ed25519 signature
  signedFields: string[];         // Which fields were signed
  devicePublicKey: string;        // For verification
}

function createSignedEvent(event: InventoryEvent, privateKey: string): SignedEvent {
  const signedFields = [
    'eventType', 'product', 'quantity', 'fromLocation', 'toLocation',
    'performedBy', 'occurredAt', 'offlineContext.sequenceNumber'
  ];

  const payload = signedFields.map(f => getNestedValue(event, f)).join('|');
  const signature = sign(payload, privateKey);

  return {
    ...event,
    signature,
    signedFields,
    devicePublicKey: derivePublicKey(privateKey)
  };
}
```

---

## Testing Offline Scenarios

### Scenario: Extended Offline Period

```gherkin
Scenario: Technician works offline for 3 days
  Given tech is assigned to rural service area
  And tech has 100 units of Product A in vehicle
  And tech goes offline

  When tech issues 20 units on Day 1
  And tech issues 30 units on Day 2
  And tech issues 25 units on Day 3
  And tech returns online

  Then all 3 days of events sync successfully
  And events maintain correct sequence order
  And total inventory is reduced by 75 units
  And all events have accurate claimed timestamps
```

### Scenario: Conflict During Sync

```gherkin
Scenario: Two techs issue same product while offline
  Given Tech A and Tech B both have access to Vehicle X
  And Vehicle X has 50 units of Product A
  And both techs go offline simultaneously

  When Tech A issues 30 units
  And Tech B issues 35 units
  And Tech A syncs first (successfully)
  And Tech B attempts to sync

  Then Tech B receives conflict notification
  And Tech B's event is marked 'conflicted'
  And Tech B is shown resolution options
  And system does not auto-resolve (requires human)
```

### Scenario: Device Loss

```gherkin
Scenario: Technician loses device with pending events
  Given tech has 5 pending events on device
  And device is reported lost

  When admin revokes device

  Then all pending events are quarantined
  And inventory in tech's custody enters dispute
  And tech is notified via email
  And manager receives review queue item
```

---

## Monitoring and Alerting

### Offline Metrics

```typescript
interface OfflineMetrics {
  // Queue health
  pendingEventsCount: number;
  oldestPendingEventAge: Duration;
  conflictedEventsCount: number;

  // Sync health
  lastSuccessfulSync: Timestamp;
  syncFailureRate: number;        // Last 24h
  averageSyncLatency: Duration;

  // Device health
  devicesOfflineOver24h: number;
  devicesWithLargeQueues: number; // >100 pending
}
```

### Alert Conditions

| Condition | Severity | Action |
|-----------|----------|--------|
| Device offline >24h | Warning | Notify manager |
| Device offline >72h | Critical | Investigate |
| Pending queue >100 events | Warning | Prompt sync |
| Pending queue >500 events | Critical | Force sync or archive |
| Unresolved conflict >24h | Warning | Escalate |
| Unresolved conflict >7d | Critical | Manager notification |
| Sync failures >10 consecutive | Critical | Check network/server |

---

## Recovery Procedures

### Procedure: Mass Offline Recovery

When network restored after extended outage:

1. **Triage** - Sort devices by queue size and last sync
2. **Stagger** - Don't sync all devices simultaneously
3. **Prioritize** - High-value/regulated items first
4. **Monitor** - Watch for conflict spike
5. **Support** - Prepare help desk for resolution questions

### Procedure: Corrupted Local Storage

If device storage is corrupted:

1. **Preserve** - Export what's readable
2. **Report** - Log corruption details
3. **Reset** - Clear local storage
4. **Re-sync** - Full download from server
5. **Reconcile** - Compare preserved data with server state
6. **Investigate** - Determine if events were lost

### Procedure: Clock Skew Discovery

If device clock was significantly wrong:

1. **Identify** - Find events with implausible timestamps
2. **Flag** - Mark affected events for review
3. **Assess** - Determine if ordering is affected
4. **Correct** - Use sequence numbers as source of truth
5. **Adjust** - Create correction events if needed

---

*Document Version: 1.0*
*Last Updated: 2026-01-10*
