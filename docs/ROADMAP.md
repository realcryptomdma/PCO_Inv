# Implementation Roadmap

This document provides a detailed technical roadmap for implementing the PCO Inventory System. Each phase includes specific deliverables, technical decisions, and acceptance criteria.

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                IMPLEMENTATION PHASES                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Phase 1          Phase 2          Phase 3          Phase 4                     │
│  FOUNDATION       OFFLINE          COMPLIANCE       SCALE                        │
│  ─────────────    ─────────────    ─────────────    ─────────────               │
│  • Data Layer     • Local Store    • Lot Tracking   • Barcode Scan              │
│  • Event System   • Sync Engine    • Expiration     • Photo/Sig                 │
│  • Core API       • Conflict UI    • Counts         • Performance               │
│  • Basic UI       • Notifications  • Disputes       • Dashboard                 │
│  • Auth           • Multi-Loc      • Reports        • Export                    │
│                                                                                  │
│  ████████████     ████████████     ████████████     ████████████                │
│   8-12 weeks       6-8 weeks        6-8 weeks        4-6 weeks                  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Foundation (MVP)

### 1.1 Objectives

- Establish event-sourced data architecture
- Implement core domain models
- Build functional request/approval workflow
- Deliver basic mobile UI for all roles

### 1.2 Technical Stack Decisions

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Mobile App | React Native (Expo) | Cross-platform, large ecosystem, offline path |
| State Management | Zustand + React Query | Simple, works well with async/offline |
| Backend | Node.js + Fastify | Fast, TypeScript native, good tooling |
| Database | PostgreSQL | Event sourcing friendly, JSONB for flexibility |
| API | REST + OpenAPI | Simple, well-understood, good tooling |
| Auth | Auth0 / Clerk | Managed auth, social login, device management |

### 1.3 Deliverables

#### D1.1: Project Setup

```
/packages
  /api           # Backend service
  /mobile        # React Native app
  /shared        # Shared types and utilities
  /web           # Admin dashboard (later)
```

**Tasks:**
- [ ] Monorepo setup (pnpm workspaces)
- [ ] TypeScript configuration
- [ ] ESLint + Prettier configuration
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Development environment documentation

#### D1.2: Data Layer

**Schema:**

```sql
-- Events (append-only)
CREATE TABLE inventory_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  product_id UUID NOT NULL REFERENCES products(id),
  quantity JSONB NOT NULL,  -- {value: number, unit: string}
  from_location_id UUID REFERENCES locations(id),
  to_location_id UUID REFERENCES locations(id),

  performed_by UUID NOT NULL REFERENCES users(id),
  authorized_by UUID REFERENCES users(id),

  reason VARCHAR(50) NOT NULL,
  notes TEXT,

  source_request_id UUID REFERENCES requests(id),
  source_event_id UUID REFERENCES inventory_events(id),

  metadata JSONB DEFAULT '{}'
);

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  epa_number VARCHAR(50),
  category_id UUID REFERENCES product_categories(id),
  type_id UUID REFERENCES product_types(id),
  base_unit VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  restricted_use BOOLEAN NOT NULL DEFAULT false,
  cost DECIMAL(10,2),
  par_level INTEGER,
  reorder_point INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Locations
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  parent_id UUID REFERENCES locations(id),
  responsible_party_id UUID REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id VARCHAR(255) UNIQUE,  -- From auth provider
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role_id UUID NOT NULL REFERENCES roles(id),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Requests
CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number VARCHAR(20) UNIQUE NOT NULL,  -- REQ-001
  type VARCHAR(20) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending_approval',

  requested_by UUID NOT NULL REFERENCES users(id),
  for_user_id UUID NOT NULL REFERENCES users(id),
  warehouse_id UUID NOT NULL REFERENCES locations(id),

  items JSONB NOT NULL,
  extra_fields JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Tasks:**
- [ ] Database schema implementation
- [ ] Migrations setup (Prisma or Drizzle)
- [ ] Event store implementation
- [ ] Inventory computation function
- [ ] Database seeding scripts

#### D1.3: API Layer

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | /products | List products (filtered) |
| GET | /products/:id | Get product detail |
| POST | /products | Create product (admin) |
| PATCH | /products/:id | Update product (admin) |
| GET | /locations | List locations |
| GET | /locations/:id/inventory | Get inventory at location |
| GET | /requests | List requests (filtered by role) |
| POST | /requests | Create request |
| POST | /requests/:id/approve | Approve request |
| POST | /requests/:id/deny | Deny request |
| POST | /requests/:id/fulfill | Mark fulfilled |
| POST | /requests/:id/pickup | Mark picked up |
| POST | /requests/:id/acknowledge | Acknowledge receipt |
| GET | /users/me | Current user profile |
| GET | /events | Event history (admin) |

**Tasks:**
- [ ] API route structure
- [ ] Request validation (Zod)
- [ ] Error handling middleware
- [ ] Authentication middleware
- [ ] Authorization middleware
- [ ] OpenAPI documentation
- [ ] API tests

#### D1.4: Mobile App

**Screens:**

| Screen | Components |
|--------|------------|
| Login | Auth flow, biometric |
| Home (Tech) | Dashboard, quick actions |
| Home (Warehouse) | Pending queue, quick issue |
| Home (Manager) | KPIs, pending approvals |
| Home (Admin) | System overview |
| Products | Search, filter, list |
| Product Detail | Info, inventory, actions |
| Request Create | Cart flow |
| Request Review | Summary, submit |
| Requests List | Filtered by role |
| Request Detail | Actions by status |
| Settings | Profile, preferences |

**Tasks:**
- [ ] Navigation structure (React Navigation)
- [ ] Theme system (light/dark)
- [ ] Component library (per Design System)
- [ ] Screen implementations
- [ ] API integration (React Query)
- [ ] Form handling (React Hook Form)
- [ ] Error boundaries

#### D1.5: Authentication

**Tasks:**
- [ ] Auth provider setup
- [ ] Login flow
- [ ] Token management
- [ ] Role extraction from token
- [ ] Session persistence
- [ ] Logout handling

### 1.4 Acceptance Criteria

- [ ] User can log in and see role-appropriate home screen
- [ ] User can browse products and view details
- [ ] Technician can create a request
- [ ] Manager can approve/deny requests
- [ ] Warehouse can fulfill requests
- [ ] Technician can acknowledge receipt
- [ ] All actions create audit events
- [ ] Request status flow works correctly

---

## Phase 2: Offline & Multi-Location

### 2.1 Objectives

- Enable full offline operation for field technicians
- Implement robust sync with conflict handling
- Support multiple warehouse locations
- Add push notifications

### 2.2 Deliverables

#### D2.1: Local Storage Layer

```typescript
// Local database structure (IndexedDB via Dexie.js)
interface LocalDatabase {
  // Cached server data
  products: Product[];
  locations: Location[];
  users: User[];

  // Local state
  pendingEvents: PendingEvent[];
  localInventoryCache: InventorySnapshot[];

  // Sync metadata
  syncState: {
    lastSuccessfulSync: Timestamp;
    serverStateHash: string;
    sequenceNumber: number;
  };
}
```

**Tasks:**
- [ ] IndexedDB setup (Dexie.js)
- [ ] Data schema for local storage
- [ ] Cache invalidation strategy
- [ ] Storage size management
- [ ] Encryption at rest

#### D2.2: Offline Event Queue

**Tasks:**
- [ ] Event creation while offline
- [ ] Sequence number generation
- [ ] Queue persistence
- [ ] Queue UI indicator
- [ ] Queue management (retry, clear)

#### D2.3: Sync Engine

```typescript
interface SyncEngine {
  // Trigger sync (manual or automatic)
  sync(): Promise<SyncResult>;

  // Upload pending events
  uploadPending(): Promise<UploadResult>;

  // Download server changes
  downloadChanges(since: Timestamp): Promise<Event[]>;

  // Conflict handling
  resolveConflict(conflict: Conflict, strategy: Resolution): Promise<void>;

  // Status
  getStatus(): SyncStatus;
  onStatusChange(callback: (status: SyncStatus) => void): Unsubscribe;
}
```

**Tasks:**
- [ ] Sync protocol implementation
- [ ] Conflict detection
- [ ] Conflict resolution UI
- [ ] Retry with exponential backoff
- [ ] Partial sync recovery
- [ ] Sync status indicator

#### D2.4: Multi-Location Inventory

**Tasks:**
- [ ] Location hierarchy support
- [ ] Per-location inventory queries
- [ ] Location-scoped permissions
- [ ] Transfer between locations
- [ ] Vehicle assignment to users

#### D2.5: Push Notifications

**Tasks:**
- [ ] Push notification service (Firebase/OneSignal)
- [ ] Notification types definition
- [ ] Notification preferences
- [ ] In-app notification center
- [ ] Background sync triggers

### 2.3 Acceptance Criteria

- [ ] App works fully offline for 72+ hours
- [ ] Events sync correctly when online
- [ ] Conflicts are detected and surfaced to user
- [ ] User can resolve conflicts via UI
- [ ] Inventory shows per-location breakdown
- [ ] Push notifications received for relevant events

---

## Phase 3: Compliance & Reconciliation

### 3.1 Objectives

- Add lot and expiration tracking
- Implement physical count workflow
- Build dispute resolution system
- Generate compliance reports

### 3.2 Deliverables

#### D3.1: Lot Tracking

```typescript
interface LotInfo {
  lotNumber: string;
  expirationDate: Date | null;
  receivedAt: Timestamp;
  quantity: Quantity;
}

// Events now include lot info
interface InventoryEvent {
  // ... existing fields
  lotNumber?: string;
  expirationDate?: Date;
}
```

**Tasks:**
- [ ] Lot fields on events
- [ ] Lot selection during issue
- [ ] FIFO recommendation
- [ ] Expiration warnings (30/7/0 days)
- [ ] Expiration blocking

#### D3.2: Restricted-Use Handling

**Tasks:**
- [ ] Certification tracking on users
- [ ] Certification validation on issue
- [ ] Override workflow with audit
- [ ] Certification expiration alerts
- [ ] Restricted product reports

#### D3.3: Physical Count Workflow

**Screens:**
- Count initiation (select location)
- Count entry (product by product)
- Variance review
- Adjustment authorization

**Tasks:**
- [ ] Count initiation API
- [ ] Expected quantities generation
- [ ] Count entry UI
- [ ] Variance calculation
- [ ] Auto-adjustment for minor variance
- [ ] Manager approval for major variance
- [ ] Count history

#### D3.4: Dispute Resolution

**Tasks:**
- [ ] Dispute creation from variance
- [ ] Dispute creation from conflicts
- [ ] Investigation assignment
- [ ] Resolution options (correct, write-off, dismiss)
- [ ] Write-off authorization
- [ ] Dispute history

#### D3.5: Compliance Reports

**Reports:**
- Chain of custody (for any lot)
- Restricted-use application log
- Inventory valuation
- Adjustment/variance summary
- Expiration report

**Tasks:**
- [ ] Report generation engine
- [ ] PDF export
- [ ] CSV export
- [ ] Report scheduling
- [ ] Email delivery

### 3.3 Acceptance Criteria

- [ ] Lot numbers tracked from receipt to disposal
- [ ] Expired products blocked from issue
- [ ] Physical count can be completed end-to-end
- [ ] Disputes can be raised and resolved
- [ ] Chain of custody report is accurate
- [ ] Mock audit passes with system data

---

## Phase 4: Polish & Scale

### 4.1 Objectives

- Add productivity features (scanning, photos)
- Optimize performance
- Build admin dashboard
- Prepare for scale

### 4.2 Deliverables

#### D4.1: Barcode Scanning

**Tasks:**
- [ ] Camera permission handling
- [ ] Barcode scanning library
- [ ] Product lookup by barcode
- [ ] Batch scanning mode
- [ ] Barcode generation for labels

#### D4.2: Photo Attachments

**Tasks:**
- [ ] Camera integration
- [ ] Photo compression
- [ ] Upload to cloud storage
- [ ] Attachment linking to events
- [ ] Gallery view in detail screens

#### D4.3: Signature Capture

**Tasks:**
- [ ] Signature pad component
- [ ] Signature storage
- [ ] Signature on acknowledgment
- [ ] Signature verification

#### D4.4: Performance Optimization

**Tasks:**
- [ ] List virtualization
- [ ] Image lazy loading
- [ ] Query caching optimization
- [ ] Bundle size reduction
- [ ] Startup time optimization
- [ ] Memory leak fixes

#### D4.5: Admin Dashboard (Web)

**Screens:**
- System overview
- User management
- Product management
- Location management
- Configuration
- Audit log viewer
- Reports

**Tasks:**
- [ ] Next.js web app setup
- [ ] Dashboard components
- [ ] Data visualization (charts)
- [ ] Admin-specific API routes
- [ ] Role management UI
- [ ] System configuration UI

#### D4.6: Data Export

**Tasks:**
- [ ] Full data export (JSON)
- [ ] Filtered export (date range, location)
- [ ] Scheduled exports
- [ ] Export encryption
- [ ] Export audit logging

### 4.3 Acceptance Criteria

- [ ] Barcode scanning works reliably
- [ ] Photos attach to events correctly
- [ ] Signature captured on acknowledgment
- [ ] App performs well on mid-range devices
- [ ] Admin dashboard is functional
- [ ] Data export works for full history

---

## Technical Decisions Register

| Decision | Options Considered | Choice | Rationale |
|----------|-------------------|--------|-----------|
| Mobile Framework | React Native, Flutter, PWA | React Native (Expo) | Team expertise, offline path clear |
| State Management | Redux, Zustand, Jotai | Zustand | Simple, good React Query integration |
| Offline Storage | AsyncStorage, MMKV, IndexedDB | IndexedDB (Dexie) | Structured queries, good capacity |
| Backend | Node.js, Go, Python | Node.js (Fastify) | TypeScript, fast, good ecosystem |
| Database | PostgreSQL, MongoDB, Supabase | PostgreSQL | ACID, event sourcing friendly |
| Auth | Auth0, Clerk, Supabase Auth | Clerk | Good mobile SDK, device management |
| Push Notifications | Firebase, OneSignal | Firebase | Integration with React Native |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Offline sync complexity | High | High | Extensive testing, conflict UI early |
| Performance on old devices | Medium | Medium | Progressive loading, lite mode |
| Adoption resistance | Medium | High | User testing, iterative improvement |
| Regulatory interpretation | Low | High | Compliance review before Phase 3 |
| Data migration from existing | Medium | Medium | Import tooling, validation checks |

---

## Team Structure

| Role | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|------|---------|---------|---------|---------|
| Mobile Developer | 2 | 2 | 1 | 1 |
| Backend Developer | 1 | 1 | 1 | 1 |
| UI/UX Designer | 0.5 | 0.5 | 0.5 | 0.5 |
| QA Engineer | 0.5 | 1 | 1 | 1 |
| Product Manager | 0.5 | 0.5 | 0.5 | 0.5 |

---

## Success Metrics by Phase

| Phase | Key Metric | Target |
|-------|------------|--------|
| 1 | End-to-end request completion | 100% success |
| 2 | Offline operation duration | 72+ hours |
| 2 | Sync success rate | > 99% |
| 3 | Inventory accuracy | > 99% |
| 3 | Audit readiness | Pass mock audit |
| 4 | App performance score | > 90 Lighthouse |
| 4 | User satisfaction | > 4.0/5.0 |

---

*Document Version: 1.0*
*Last Updated: 2026-01-18*
