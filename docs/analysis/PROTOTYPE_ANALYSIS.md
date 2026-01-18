# Prototype Analysis Report

This document provides a comprehensive extraction of design patterns, workflows, and system elements from the reference prototype (`InventoryApp.jsx`).

---

## Executive Summary

The prototype is a **mobile-first React application** demonstrating a pest control inventory request/fulfillment system. It provides a functional UI mockup with:

- 4 distinct user roles with different capabilities
- Configurable multi-step workflow engine
- Dark/light theme support
- Role-specific dashboards and navigation
- CRUD operations for products, categories, users, and roles

**Critical Finding:** The prototype is a UI demonstration only—it lacks the event-sourced architecture, offline support, and audit capabilities required by the system architecture. This document bridges the gap.

---

## Part 1: Extracted Data Models

### 1.1 Product Model

```typescript
interface PrototypeProduct {
  sku: string;                    // Unique identifier (auto-generated: "1991001")
  name: string;                   // Display name
  epaNumber: string;              // EPA registration or "N/A"
  category: string;               // Reference to category ID
  type: string;                   // Reference to type ID

  // Stock tracking (SIMPLIFIED - not event-sourced)
  initial: number;                // Current stock level
  inStock: boolean;               // Availability flag

  // Units
  baseType: 'COUNT' | 'MASS';     // Measurement basis
  trackingUnit: string;           // Storage unit ("each", "oz")
  checkoutUnit: string;           // Dispensing unit

  // Inventory management
  cost: number;                   // Unit cost (USD)
  parLevel: number;               // Target stock level
  reorderPoint: number;           // Reorder trigger threshold
}
```

**Sample Products from Prototype:**

| SKU | Name | EPA # | Category | Type | Stock | Unit | Cost |
|-----|------|-------|----------|------|-------|------|------|
| 1991001 | ADVANCE GRANULAR CARPENTER ANT BAIT | 499-370 | ant-bait | granule | 1 | each | $24.50 |
| 1991026 | CONTRAC BLOX | 12455-86 | rodent-bait | block | 49632 | oz | $125.00 |
| 1991163 | TERMIDOR HE | 7969-329 | termiticide | concentrate | 4 | each | $185.00 |

### 1.2 Product Categories

```typescript
interface PrototypeCategory {
  id: string;           // Slug ID ("ant-bait")
  name: string;         // Display name ("Ant Bait")
  icon: IconType;       // Visual identifier
  color: ColorType;     // Badge/accent color
}
```

**Defined Categories:**

| ID | Name | Icon | Color | Use Case |
|----|------|------|-------|----------|
| ant-bait | Ant Bait | bug | amber | Ant control products |
| roach-bait | Roach Bait | bug | orange | Cockroach control |
| rodent-bait | Rodent Bait | circle | gray | Rodent control |
| repellent | Repellent | wind | blue | Barrier treatments |
| non-repellent | Non-Repellent | zap | purple | Transfer effect products |
| termiticide | Termiticide | flame | red | Termite control (regulated) |
| igr | IGR | leaf | green | Insect growth regulators |
| general | General Pest | bug | slate | Multi-purpose products |

### 1.3 Product Types (Formulations)

| ID | Name | Description |
|----|------|-------------|
| aerosol | Aerosol | Pressurized spray cans |
| block | Block | Solid bait blocks |
| concentrate | Concentrate | Dilutable liquids |
| dust | Dust | Powder formulations |
| gel | Gel | Gel baits |
| granule | Granule | Granular baits |
| foam | Foam | Expanding foam |
| station | Station | Bait stations |
| liquid | Liquid | Ready-to-use liquids |
| trap | Trap | Mechanical traps |

### 1.4 Location Model

```typescript
interface PrototypeLocation {
  id: string;              // "wh-001"
  name: string;            // "Main Street Warehouse"
  displayName: string;     // "Metro Guard" (user-friendly)
  isDefault: boolean;      // Primary warehouse flag
}
```

### 1.5 User Model

```typescript
interface PrototypeUser {
  id: string;                      // "user-001"
  name: string;                    // "John Smith"
  role: RoleID;                    // "tech" | "warehouse" | "manager" | "admin"

  // Role-specific fields
  vehicle?: string;                // For technicians: "Vehicle #247"
  assignedWarehouse?: string;      // For technicians: single location
  assignedWarehouses?: string[];   // For warehouse/manager: multiple locations
}
```

### 1.6 Request Model

```typescript
interface PrototypeRequest {
  id: string;                      // "REQ-001"
  status: RequestStatus;

  // Line items
  items: RequestItem[];
  totalItems: number;
  totalValue: number;

  // Parties
  requestedBy: string;             // Name of requester
  forTech: string;                 // Name of recipient technician
  forTechId: string;               // ID of recipient

  // Location
  warehouseId: string;             // Source warehouse ID
  fromWarehouse: string;           // Source warehouse display name

  // Timestamps
  createdAt: string;               // Formatted date string
  approvedAt?: string;

  // Approval
  approvedBy?: string;

  // Category-specific fields
  extraFields?: {
    customerName?: string;
    customerId?: string;
    workTicket?: string;
  };
}

interface RequestItem {
  sku: string;
  name: string;
  quantity: number;
  unit: string;
  cost: number;
  category: string;
}
```

---

## Part 2: Role & Permission System

### 2.1 Permission Definitions

```typescript
const availablePermissions = [
  // Products
  { id: 'view_products', name: 'View Products', category: 'Products' },
  { id: 'edit_products', name: 'Edit Products', category: 'Products' },

  // Inventory
  { id: 'view_inventory', name: 'View Inventory Levels', category: 'Inventory' },

  // Financial
  { id: 'view_cost', name: 'View Cost Information', category: 'Financial' },

  // Requests
  { id: 'create_requests', name: 'Create Requests', category: 'Requests' },
  { id: 'approve_requests', name: 'Approve Requests', category: 'Requests' },
  { id: 'fulfill_requests', name: 'Fulfill Requests', category: 'Requests' },
  { id: 'view_all_requests', name: 'View All Requests', category: 'Requests' },

  // Administration
  { id: 'manage_users', name: 'Manage Users', category: 'Administration' },
  { id: 'manage_settings', name: 'Manage Settings', category: 'Administration' },
  { id: 'manage_locations', name: 'Manage Locations', category: 'Administration' },
];
```

### 2.2 Role Definitions

| Role | Icon | Color | System | Permissions |
|------|------|-------|--------|-------------|
| Technician | truck | emerald | Yes | view_products, view_inventory, create_requests |
| Warehouse | warehouse | blue | Yes | view_products, view_inventory, view_all_requests, fulfill_requests |
| Manager | users | purple | Yes | view_products, edit_products, view_inventory, view_cost, create_requests, approve_requests, view_all_requests, manage_locations |
| Admin | shield | slate | Yes | ALL permissions |

### 2.3 Permission Matrix

| Capability | Tech | Warehouse | Manager | Admin |
|------------|:----:|:---------:|:-------:|:-----:|
| View products | ✓ | ✓ | ✓ | ✓ |
| Edit products | | | ✓ | ✓ |
| View inventory levels | ✓ | ✓ | ✓ | ✓ |
| View cost info | | | ✓ | ✓ |
| Create requests | ✓ | | ✓ | ✓ |
| Approve requests | | | ✓ | ✓ |
| Fulfill requests | | ✓ | | ✓ |
| View all requests | | ✓ | ✓ | ✓ |
| Manage users | | | | ✓ |
| Manage settings | | | | ✓ |
| Manage locations | | | ✓ | ✓ |

### 2.4 Visibility Rules

**Request Visibility:**
```typescript
function getVisibleRequests(currentUser, currentRole) {
  if (currentRole === 'admin') return allRequests;

  if (currentRole === 'manager' || currentRole === 'warehouse') {
    // See requests from assigned warehouses
    return requests.filter(r =>
      currentUser.assignedWarehouses.includes(r.warehouseId)
    );
  }

  if (currentRole === 'tech') {
    // See only own requests
    return requests.filter(r => r.forTechId === currentUser.id);
  }
}
```

**Technician Visibility (for issuing):**
```typescript
function getVisibleTechs(currentUser, currentRole) {
  if (currentRole === 'admin') return allTechs;

  if (currentRole === 'manager' || currentRole === 'warehouse') {
    // See techs in assigned warehouses
    return techs.filter(t =>
      currentUser.assignedWarehouses.includes(t.assignedWarehouse)
    );
  }
}
```

---

## Part 3: Workflow System

### 3.1 Workflow Steps

The system supports a configurable 4-step workflow:

```
┌──────────────┐    ┌─────────────┐    ┌────────────────┐    ┌────────────────┐
│   Approval   │───▶│ Fulfillment │───▶│    Pickup      │───▶│ Acknowledgment │
│  (Manager)   │    │ (Warehouse) │    │ (Technician)   │    │  (Technician)  │
└──────────────┘    └─────────────┘    └────────────────┘    └────────────────┘
```

Each step can be enabled or disabled independently.

### 3.2 Workflow Presets

| Preset | Approval | Fulfillment | Pickup | Acknowledgment | Use Case |
|--------|:--------:|:-----------:|:------:|:--------------:|----------|
| Full Workflow | ✓ | ✓ | ✓ | ✓ | Standard process with all checks |
| In-Person | ✓ | | | | Walk-in requests approved immediately |
| Self-Service | | | | ✓ | Trust-based with confirmation only |

### 3.3 Request Status Flow

```
                    ┌─────────────────┐
                    │ pending_approval │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              │
        ┌──────────┐   ┌─────────┐         │
        │ approved │   │ denied  │         │
        └────┬─────┘   └─────────┘         │
             │                             │
             ▼                             │ (if approval disabled)
    ┌─────────────────┐                    │
    │ ready_for_pickup │◄──────────────────┘
    └────────┬────────┘
             │
             ▼
┌────────────────────────┐
│ pending_acknowledgment │
└───────────┬────────────┘
            │
            ▼
      ┌───────────┐
      │ completed │
      └───────────┘
```

### 3.4 Status Progression Logic

```typescript
function getNextStatus(currentStatus, workflowSteps) {
  if (currentStatus === 'pending_approval') {
    if (!workflowSteps.fulfillment) {
      if (!workflowSteps.pickup) {
        if (!workflowSteps.acknowledgment) return 'completed';
        return 'pending_acknowledgment';
      }
      return 'ready_for_pickup';
    }
    return 'approved';
  }

  if (currentStatus === 'approved') {
    if (!workflowSteps.pickup) {
      if (!workflowSteps.acknowledgment) return 'completed';
      return 'pending_acknowledgment';
    }
    return 'ready_for_pickup';
  }

  if (currentStatus === 'ready_for_pickup') {
    if (!workflowSteps.acknowledgment) return 'completed';
    return 'pending_acknowledgment';
  }

  if (currentStatus === 'pending_acknowledgment') return 'completed';

  return currentStatus;
}
```

### 3.5 Action Authorization

| Status | Who Can Advance | Action |
|--------|-----------------|--------|
| pending_approval | Manager (approve_requests) | Approve or Deny |
| approved | Warehouse (fulfill_requests) | Mark Ready |
| ready_for_pickup | Assigned Technician only | Confirm Pickup |
| pending_acknowledgment | Assigned Technician only | Acknowledge Receipt |

### 3.6 Category-Based Required Fields

Certain categories (like `termiticide`) can require additional fields:

```typescript
interface CategoryRule {
  enabled: boolean;
  requiresCustomerName: boolean;
  requiresCustomerId: boolean;
  requiresWorkTicket: boolean;
}

// Default rules
const defaultCategoryRules = {
  'termiticide': {
    enabled: true,
    requiresCustomerName: true,
    requiresCustomerId: true,
    requiresWorkTicket: true
  }
};
```

---

## Part 4: UI/UX Patterns

### 4.1 Design System

**Color Palette:**

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| bg | bg-gray-50 | bg-gray-900 | Page background |
| bgCard | bg-white | bg-gray-800 | Card surfaces |
| bgHeader | bg-slate-700 | bg-gray-900 | App header |
| bgInput | bg-white | bg-gray-700 | Form inputs |
| border | border-gray-200 | border-gray-700 | Dividers/borders |
| text | text-gray-900 | text-white | Primary text |
| textMuted | text-gray-500 | text-gray-400 | Secondary text |
| textSecondary | text-gray-600 | text-gray-300 | Labels |

**Accent Colors:**

| Color | Usage |
|-------|-------|
| emerald-500/600 | Primary actions, success states, tech role |
| blue-500/600 | Info states, warehouse role |
| purple-500/600 | Manager role |
| slate-500/600 | Admin role, neutral actions |
| amber-500 | Warnings, pending states |
| red-500 | Errors, destructive actions, alerts |

**Status Badge Colors:**

| Status | Light BG | Light Text | Dark BG | Dark Text |
|--------|----------|------------|---------|-----------|
| pending_approval | amber-100 | amber-700 | amber-900 | amber-200 |
| approved | blue-100 | blue-700 | blue-900 | blue-200 |
| denied | red-100 | red-700 | red-900 | red-200 |
| ready_for_pickup | emerald-100 | emerald-700 | emerald-900 | emerald-200 |
| pending_acknowledgment | purple-100 | purple-700 | purple-900 | purple-200 |
| completed | gray-100 | gray-600 | gray-700 | gray-300 |

### 4.2 Component Patterns

**Header Component:**
```
┌─────────────────────────────────────────────────┐
│ [Menu/Back]  Title                 [Actions] 🔔 │
└─────────────────────────────────────────────────┘
- Sticky position (top: 0, z-index: 10)
- Dark background (slate-700/gray-900)
- White text
- Optional back button or menu toggle
- Right side: action buttons + notification badge
- Theme toggle (sun/moon icon)
```

**Bottom Navigation:**
```
┌─────────────────────────────────────────────────┐
│  🏠 Home  |  🛒 Request  |  📋 Orders  |  ⚙️   │
└─────────────────────────────────────────────────┘
- Fixed position (bottom: 0)
- Role-specific items
- Badge counts on icons
- Active state highlighting
```

**Card Pattern:**
```
┌─────────────────────────────────────────────────┐
│ ┌────┐                                          │
│ │Icon│  Title                          Value    │
│ └────┘  Subtitle                       Unit     │
└─────────────────────────────────────────────────┘
- Rounded corners (rounded-xl)
- Border + optional background
- Icon in colored container
- Flexible content area
```

**Modal/Sheet Pattern:**
```
- Full-screen overlay (bg-black/50)
- Slide-up from bottom
- Rounded top corners (rounded-t-2xl)
- Sticky header with close button
- Scrollable content area
- Action buttons at bottom
```

**Form Controls:**

| Control | Pattern |
|---------|---------|
| Text Input | Full width, border, rounded-lg, padding 2.5 |
| Select | Same as text input with dropdown |
| Toggle | Custom ToggleLeft/ToggleRight icons, emerald when on |
| Quantity | Minus button + input + Plus button |
| Checkbox | Native with w-4 h-4 |

### 4.3 Screen Architecture

**Role-Specific Navigation:**

| Role | Nav Item 1 | Nav Item 2 | Nav Item 3 | Nav Item 4 |
|------|------------|------------|------------|------------|
| Tech | Home | Request | Orders | — |
| Warehouse | Home | Issue | Orders | — |
| Manager | Home | Issue | Orders | Products |
| Admin | Dashboard | Products | Locations | Settings |

**Screen Types:**

1. **Dashboard/Home** - KPI cards + quick actions
2. **List Screen** - Search + filters + scrollable list
3. **Detail Modal** - Full information view
4. **Editor Modal** - Form for create/edit
5. **Cart/Review** - Multi-step checkout flow

### 4.4 Interaction Patterns

**Confirmation Flow:**
```
1. User initiates destructive action
2. Overlay confirmation dialog appears
3. Dialog shows: Title, Message, Cancel, Confirm buttons
4. User confirms or cancels
5. Action executes with toast feedback
```

**Toast Notifications:**
```
- Fixed position (top: 1rem)
- Full width with padding
- Success: emerald background + checkmark
- Error: red background + X icon
- Auto-dismiss after 3 seconds
```

**Cart Flow:**
```
1. Browse products (search, filter)
2. Add items with quantity
3. Review cart
4. Select recipient (if not tech)
5. Fill required fields (category rules)
6. Submit request
```

---

## Part 5: Icon System

### 5.1 Lucide Icons Used

| Icon | Usage |
|------|-------|
| Package | Products |
| Clipboard | Requests/Orders |
| Check, X | Confirm/Cancel |
| ChevronLeft | Back navigation |
| Search | Search inputs |
| Plus, Minus | Quantity controls |
| User | User profile |
| Truck | Technician role |
| Menu | Navigation toggle |
| Home | Dashboard |
| Settings | Settings screen |
| Users | Manager role |
| Warehouse | Warehouse role |
| Shield | Admin role |
| CheckCircle, XCircle | Success/error |
| AlertCircle | Warnings |
| MapPin | Locations |
| Building | Warehouse buildings |
| Edit, Trash2 | CRUD actions |
| ShoppingCart | Cart/request |
| DollarSign | Financial info |
| ToggleLeft, ToggleRight | Toggle switches |
| FileWarning | EPA/regulatory |
| Lock | Permissions |

### 5.2 Custom SVG Icons

| Icon | Usage |
|------|-------|
| BugIcon | Pest products |
| LeafIcon | IGR products |
| WindIcon | Repellents |
| ZapIcon | Non-repellents |
| CircleIcon | Rodent products |
| FlameIcon | Termiticides |
| MoonIcon | Dark mode |
| SunIcon | Light mode |
| UserPlusIcon | Add user |

---

## Part 6: Settings Architecture

### 6.1 Settings Tabs

| Tab | Contents |
|-----|----------|
| Display | Dark mode toggle |
| Workflow | Workflow presets management |
| Categories | Product categories + types |
| Roles | Role definitions + permissions |
| Users | User management |

### 6.2 Configurable Elements

**System-Level (Admin only):**
- Dark mode default
- Show inventory to techs toggle
- Show cost to managers toggle
- Allow decimals toggle
- Active workflow preset
- Individual workflow steps

**Entity Management:**
- Categories: name, icon, color
- Types: name
- Roles: name, icon, color, permissions
- Users: name, role, vehicle, warehouse assignments
- Workflow presets: name, enabled steps

---

## Part 7: State Management

### 7.1 Application State

```typescript
// Core entities
const [products, setProducts] = useState(importedProducts);
const [users, setUsers] = useState(initialUsers);
const [locations, setLocations] = useState(initialLocations);
const [requests, setRequests] = useState([]);

// Configuration
const [roles, setRoles] = useState(initialRoles);
const [workflowPresets, setWorkflowPresets] = useState(initialWorkflowPresets);
const [productCategories, setProductCategories] = useState(initialCategories);
const [productTypes, setProductTypes] = useState(initialTypes);

// Settings
const [darkMode, setDarkMode] = useState(false);
const [showInventoryToTechs, setShowInventoryToTechs] = useState(true);
const [showCostToManagers, setShowCostToManagers] = useState(false);
const [workflowPreset, setWorkflowPreset] = useState('full');
const [workflowSteps, setWorkflowSteps] = useState({...});
const [categoryRules, setCategoryRules] = useState(defaultCategoryRules);

// Session
const [currentUserId, setCurrentUserId] = useState('user-007');
const [currentScreen, setCurrentScreen] = useState('home');
const [cart, setCart] = useState([]);
const [cartStep, setCartStep] = useState('browse');

// UI state
const [selectedRequest, setSelectedRequest] = useState(null);
const [selectedProduct, setSelectedProduct] = useState(null);
const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);
const [toast, setToast] = useState(null);
const [confirmDialog, setConfirmDialog] = useState(null);
```

### 7.2 Computed Values (useMemo)

```typescript
// Filtered products based on search/filters
const filteredProducts = useMemo(() => {...}, [products, productSearch, productFilter, categoryFilter]);

// Stock alerts
const lowStockProducts = useMemo(() => products.filter(p => p.initial > p.reorderPoint && p.initial <= p.parLevel * 0.5), [products]);
const reorderProducts = useMemo(() => products.filter(p => p.initial <= p.reorderPoint), [products]);

// Financial
const totalInventoryValue = useMemo(() => products.reduce((sum, p) => sum + (p.initial * (p.cost || 0)), 0), [products]);
const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + (item.quantity * (item.product.cost || 0)), 0), [cart]);
const cartItemCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
```

---

## Part 8: Identified Gaps

### 8.1 Critical Missing Features

| Feature | Prototype | Architecture Required |
|---------|-----------|----------------------|
| Event sourcing | ❌ Direct state | ✓ Immutable event log |
| Offline support | ❌ None | ✓ Local queue + sync |
| Audit trail | ❌ None | ✓ Complete history |
| Lot tracking | ❌ None | ✓ Batch + expiration |
| Multi-location inventory | ❌ Single total | ✓ Per-location levels |
| Custody chain | ❌ None | ✓ Explicit transfers |
| Physical counts | ❌ None | ✓ Reconciliation workflow |
| Disputes | ❌ None | ✓ Variance resolution |
| Unit conversion | ❌ None | ✓ Packaging units |

### 8.2 UI Gaps

| Feature | Prototype | Needed |
|---------|-----------|--------|
| Photo capture | ❌ | Attachments for events |
| Signature capture | ❌ | Acknowledgment proof |
| Barcode scanning | ❌ | Quick product lookup |
| Offline indicator | ❌ | Sync status display |
| Conflict resolution UI | ❌ | Merge/resolve interface |

### 8.3 Data Model Gaps

| Prototype Has | Architecture Requires |
|---------------|----------------------|
| Single stock number | Per-location inventory |
| No timestamps | occurredAt + recordedAt |
| No lot numbers | Lot tracking + expiration |
| No event IDs | Event chain linking |
| Name-based references | ID-based custody chain |

---

*Document Version: 1.0*
*Extracted from: InventoryApp.jsx*
*Analysis Date: 2026-01-18*
