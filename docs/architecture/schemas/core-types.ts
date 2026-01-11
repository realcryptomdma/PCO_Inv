/**
 * PCO Inventory System - Core Type Definitions
 *
 * These types define the foundational data structures for the inventory
 * accountability system. They enforce the system's invariants at the type level.
 */

// =============================================================================
// IDENTIFIERS
// =============================================================================

/** Branded types for type-safe IDs */
type Brand<K, T> = K & { __brand: T };

export type ProductID = Brand<string, 'ProductID'>;
export type LocationID = Brand<string, 'LocationID'>;
export type PersonID = Brand<string, 'PersonID'>;
export type EventID = Brand<string, 'EventID'>;
export type RequestID = Brand<string, 'RequestID'>;
export type DisputeID = Brand<string, 'DisputeID'>;
export type RoleID = Brand<string, 'RoleID'>;
export type DeviceID = Brand<string, 'DeviceID'>;

export type Timestamp = Brand<string, 'ISO8601Timestamp'>;

// =============================================================================
// UNITS AND QUANTITIES
// =============================================================================

/**
 * INVARIANT: Units are explicit. No quantity exists without a unit.
 */

export type LiquidUnit = 'oz' | 'ml' | 'gal' | 'L' | 'qt' | 'pt';
export type WeightUnit = 'lb' | 'kg' | 'g' | 'oz_wt';
export type CountUnit = 'each' | 'box' | 'case' | 'pallet' | 'bag' | 'pack';
export type LengthUnit = 'ft' | 'm' | 'yd' | 'roll';

export type UnitCode = LiquidUnit | WeightUnit | CountUnit | LengthUnit;

/**
 * A quantity with explicit units. This is the ONLY valid way to express
 * amounts in the system. Raw numbers without units are prohibited.
 */
export interface Quantity {
  readonly value: number;
  readonly unit: UnitCode;
}

/**
 * Defines how a packaging unit relates to the base unit.
 * Example: A "case" of Termidor might contain 12 bottles of 32oz each.
 */
export interface PackagingUnit {
  readonly unitCode: UnitCode;
  readonly displayName: string;
  readonly baseUnitEquivalent: number; // How many base units in one of these
  readonly isDefault: boolean; // Default unit for this product
}

// =============================================================================
// PRODUCTS
// =============================================================================

export type ProductCategory = 'chemical' | 'equipment' | 'consumable' | 'vehicle_part';

export type ProductStatus = 'active' | 'deprecated' | 'recalled' | 'discontinued';

/**
 * A product is a tracked inventory type. Products are immutable definitions;
 * changes create new versions or superseding products.
 */
export interface Product {
  readonly id: ProductID;
  readonly sku: string; // Unique, immutable after creation
  readonly name: string;
  readonly description?: string;
  readonly category: ProductCategory;

  // Unit system
  readonly baseUnit: UnitCode;
  readonly packagingUnits: PackagingUnit[];

  // Lifecycle
  readonly status: ProductStatus;
  readonly supersededBy?: ProductID; // If deprecated, what replaces it

  // Regulatory
  readonly epaRegistration?: string;
  readonly sdsRequired: boolean;
  readonly restrictedUse: boolean; // Requires certified applicator
  readonly expirationTracked: boolean;

  // Inventory thresholds
  readonly reorderPoint?: Quantity;
  readonly minimumOnHand?: Quantity;
  readonly maximumOnHand?: Quantity;

  // Metadata
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly createdBy: PersonID;
}

// =============================================================================
// LOCATIONS
// =============================================================================

export type LocationType =
  | 'warehouse' // Central storage facility
  | 'vehicle' // Mobile stock in company vehicle
  | 'technician_stock' // Personal inventory held by technician
  | 'service_site' // Customer location (transient)
  | 'quarantine' // Damaged/suspect items
  | 'disposal'; // End-of-life terminal location

export type LocationStatus = 'active' | 'inactive' | 'decommissioned';

/**
 * A location is any place where inventory can exist.
 *
 * INVARIANT: Every unit of inventory belongs to exactly one location at any time.
 */
export interface Location {
  readonly id: LocationID;
  readonly type: LocationType;
  readonly name: string;
  readonly code?: string; // Short code for quick reference

  // Hierarchy
  readonly parentLocation?: LocationID;

  // Accountability
  readonly responsibleParty?: PersonID; // Who answers for this inventory

  // Constraints
  readonly acceptsProductCategories?: ProductCategory[]; // null = all
  readonly acceptsProducts?: ProductID[]; // Specific product allowlist
  readonly denyProducts?: ProductID[]; // Specific product blocklist

  // State
  readonly status: LocationStatus;

  // Metadata
  readonly address?: Address;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export interface Address {
  readonly line1: string;
  readonly line2?: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly country: string;
  readonly coordinates?: {
    readonly latitude: number;
    readonly longitude: number;
  };
}

// =============================================================================
// PERSONS AND ROLES
// =============================================================================

export type PersonStatus = 'active' | 'suspended' | 'terminated';

export type CertificationType =
  | 'restricted_use_applicator'
  | 'hazmat_handler'
  | 'dot_transport'
  | 'structural_pest'
  | 'termite_control';

export interface Certification {
  readonly type: CertificationType;
  readonly licenseNumber: string;
  readonly issuingAuthority: string;
  readonly issuedAt: Timestamp;
  readonly expiresAt: Timestamp;
  readonly state?: string; // For state-specific certifications
}

export interface Person {
  readonly id: PersonID;
  readonly employeeId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone?: string;

  readonly roles: RoleID[];
  readonly certifications: Certification[];
  readonly assignedLocations: LocationID[]; // Locations they can operate from

  readonly status: PersonStatus;
  readonly terminatedAt?: Timestamp;

  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

// =============================================================================
// ROLES AND PERMISSIONS
// =============================================================================

export type ActionType =
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
  | 'approve'
  | 'deny'
  | 'create_request'
  | 'view_inventory'
  | 'view_reports'
  | 'manage_products'
  | 'manage_locations'
  | 'manage_persons'
  | 'manage_roles';

export type ConditionType =
  | 'max_quantity' // Cannot exceed this quantity per action
  | 'max_daily_quantity' // Cannot exceed this quantity per day
  | 'location_scope' // Only applies to specific locations
  | 'product_scope' // Only applies to specific products
  | 'requires_certification' // Must have specific certification
  | 'requires_witness' // Another person must witness
  | 'time_window' // Only during certain hours
  | 'requires_approval'; // Action must be approved

export interface PermissionCondition {
  readonly type: ConditionType;
  readonly parameters: Record<string, unknown>;
}

export interface Permission {
  readonly action: ActionType;
  readonly conditions: PermissionCondition[];
}

export interface Role {
  readonly id: RoleID;
  readonly name: string;
  readonly description: string;
  readonly permissions: Permission[];
  readonly inheritsFrom?: RoleID[]; // Role hierarchy
  readonly isSystemRole: boolean; // Cannot be deleted
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

// =============================================================================
// INVENTORY EVENTS
// =============================================================================

/**
 * INVARIANT: Inventory is history. Current levels are derived from events.
 * Events are immutable. Corrections create new events, not mutations.
 */

export type EventType =
  | 'receive' // Initial entry from supplier
  | 'transfer' // Movement between locations
  | 'issue' // Used at service site
  | 'return' // Returned from service site
  | 'consume' // Destroyed/used (non-billable)
  | 'adjust' // Correction with explanation
  | 'convert' // Unit conversion
  | 'quarantine' // Moved to quarantine
  | 'dispose' // End of life
  | 'count'; // Physical count verification

export type ReasonCode =
  // Normal operations
  | 'standard_issue'
  | 'restock'
  | 'customer_return'
  | 'vehicle_transfer'
  | 'unit_conversion'
  // Adjustments
  | 'count_variance'
  | 'correction'
  | 'data_entry_error'
  // Losses
  | 'damaged'
  | 'expired'
  | 'spillage'
  | 'theft'
  | 'lost'
  // Compliance
  | 'recall_compliance'
  | 'regulatory_disposal'
  // Special
  | 'emergency_override'
  | 'conflict_resolution'
  | 'system_migration';

/**
 * Context for events that originated while the device was offline.
 * Critical for conflict detection and resolution.
 */
export interface OfflineContext {
  readonly deviceId: DeviceID;
  readonly sequenceNumber: number; // Monotonic per device
  readonly deviceTimestamp: Timestamp; // Device clock at action time
  readonly lastKnownServerStateHash: string; // For conflict detection
  readonly syncedAt?: Timestamp; // When server received it
  readonly syncStatus: 'pending' | 'synced' | 'conflicted' | 'failed';
  readonly conflictResolution?: ConflictResolution;
}

export interface ConflictResolution {
  readonly resolvedBy: PersonID;
  readonly resolvedAt: Timestamp;
  readonly strategy: 'accept' | 'reject' | 'merge' | 'manual';
  readonly notes: string;
  readonly compensatingEventId?: EventID;
}

export interface Attachment {
  readonly id: string;
  readonly type: 'image' | 'document' | 'signature';
  readonly filename: string;
  readonly mimeType: string;
  readonly url: string; // Secure URL to attachment
  readonly capturedAt: Timestamp;
  readonly capturedBy: PersonID;
}

/**
 * The core event type. Every change to inventory is recorded as an event.
 */
export interface InventoryEvent {
  readonly id: EventID;
  readonly eventType: EventType;

  // Timing - critical for audits and conflict resolution
  readonly occurredAt: Timestamp; // When it happened (claimed)
  readonly recordedAt: Timestamp; // When system recorded it

  // What changed
  readonly product: ProductID;
  readonly quantity: Quantity;
  readonly lotNumber?: string;
  readonly expirationDate?: string; // ISO date

  // Where
  readonly fromLocation?: LocationID; // null for Receive
  readonly toLocation?: LocationID; // null for Consume/Dispose

  // Who - critical for accountability
  readonly performedBy: PersonID; // Who did it
  readonly authorizedBy?: PersonID; // Who approved (if different)
  readonly witnessedBy?: PersonID; // Who witnessed (for high-value)

  // Why
  readonly reason: ReasonCode;
  readonly notes?: string;

  // Relationships
  readonly sourceRequest?: RequestID; // If from approved request
  readonly sourceEvent?: EventID; // For corrections
  readonly relatedServiceOrder?: string; // For billing linkage

  // Offline handling
  readonly offlineContext?: OfflineContext;

  // Evidence
  readonly attachments?: Attachment[];
}

// =============================================================================
// REQUESTS AND APPROVALS
// =============================================================================

export type RequestType = 'transfer' | 'adjustment' | 'disposal' | 'order' | 'return';

export type RequestStatus =
  | 'draft' // Not yet submitted
  | 'pending' // Awaiting approval
  | 'approved' // All approvals received
  | 'partially_approved' // Some approvals received
  | 'denied' // Rejected
  | 'expired' // Timed out
  | 'cancelled' // Withdrawn by requester
  | 'executed'; // Resulting events created

export type RequestPriority = 'standard' | 'urgent' | 'emergency';

export interface RequestItem {
  readonly product: ProductID;
  readonly quantity: Quantity;
  readonly fromLocation?: LocationID;
  readonly toLocation?: LocationID;
  readonly lotNumber?: string;
}

export interface ApprovalStep {
  readonly order: number;
  readonly requiredRole?: RoleID;
  readonly requiredPerson?: PersonID; // If specific person required
  readonly decision?: 'approved' | 'denied';
  readonly decidedBy?: PersonID;
  readonly decidedAt?: Timestamp;
  readonly notes?: string;
  readonly offlineContext?: OfflineContext;
}

export interface Request {
  readonly id: RequestID;
  readonly type: RequestType;
  readonly status: RequestStatus;
  readonly priority: RequestPriority;

  readonly requestedBy: PersonID;
  readonly requestedAt: Timestamp;

  readonly items: RequestItem[];
  readonly justification: string;

  // Approval workflow
  readonly approvalChain: ApprovalStep[];
  readonly currentStep: number;

  // Outcome
  readonly resultingEvents: EventID[];
  readonly denialReason?: string;

  // Deadlines
  readonly expiresAt?: Timestamp;
  readonly escalatesAt?: Timestamp;
  readonly escalatedTo?: PersonID;

  readonly offlineContext?: OfflineContext;
}

// =============================================================================
// DISPUTES
// =============================================================================

export type DisputeType =
  | 'quantity_mismatch' // Expected vs actual don't match
  | 'missing_item' // Item should exist but doesn't
  | 'damaged_item' // Item exists but is damaged
  | 'unauthorized_action' // Action taken without proper authority
  | 'data_error' // System data is incorrect
  | 'conflict_unresolved'; // Offline conflict couldn't be auto-resolved

export type DisputeStatus =
  | 'open' // Just created
  | 'investigating' // Being looked into
  | 'pending_resolution' // Investigation complete, awaiting action
  | 'resolved' // Closed with resolution
  | 'escalated'; // Needs higher authority

export type DisputeOutcome =
  | 'confirmed' // Discrepancy was real
  | 'corrected' // System error fixed
  | 'write_off' // Loss accepted
  | 'recovered' // Missing item found
  | 'dismissed'; // No actual issue

export interface DisputeResolution {
  readonly outcome: DisputeOutcome;
  readonly resolvedBy: PersonID;
  readonly resolvedAt: Timestamp;

  readonly correctiveEvents: EventID[];
  readonly writeOffAmount?: Quantity;
  readonly writeOffApprovedBy?: PersonID;

  readonly rootCause?: string;
  readonly preventiveMeasures?: string;
}

export interface Dispute {
  readonly id: DisputeID;
  readonly type: DisputeType;
  readonly status: DisputeStatus;

  readonly raisedBy: PersonID;
  readonly raisedAt: Timestamp;

  // Context
  readonly relatedEvents: EventID[];
  readonly relatedLocation: LocationID;
  readonly relatedProduct: ProductID;

  // The problem
  readonly expectedQuantity?: Quantity;
  readonly actualQuantity?: Quantity;
  readonly description: string;
  readonly evidence: Attachment[];

  // Investigation
  readonly assignedTo?: PersonID;
  readonly assignedAt?: Timestamp;
  readonly investigationNotes?: string;
  readonly investigationDeadline?: Timestamp;

  // Resolution
  readonly resolution?: DisputeResolution;
}

// =============================================================================
// PHYSICAL COUNTS
// =============================================================================

export interface CountLine {
  readonly product: ProductID;
  readonly lotNumber?: string;
  readonly systemQuantity: Quantity; // What we expected
  readonly physicalQuantity: Quantity; // What we found
  readonly varianceExplanation?: string;
  readonly resultingAdjustment?: EventID;
}

export interface PhysicalCount {
  readonly id: string;
  readonly location: LocationID;
  readonly countedBy: PersonID;
  readonly witnessedBy?: PersonID;

  readonly startedAt: Timestamp;
  readonly completedAt?: Timestamp;

  readonly lines: CountLine[];

  readonly status: 'in_progress' | 'completed' | 'cancelled';
  readonly resultingCountEvent?: EventID;
}

// =============================================================================
// COMPUTED INVENTORY STATE
// =============================================================================

/**
 * This is NOT stored - it's computed from events.
 * Represents inventory at a point in time.
 */
export interface InventoryState {
  readonly asOf: Timestamp;
  readonly location: LocationID;
  readonly items: InventoryItem[];
}

export interface InventoryItem {
  readonly product: ProductID;
  readonly quantity: Quantity;
  readonly lots: LotDetail[];
}

export interface LotDetail {
  readonly lotNumber: string;
  readonly quantity: Quantity;
  readonly expirationDate?: string;
  readonly receivedAt: Timestamp;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * For event replay and state computation
 */
export type EventReducer = (state: InventoryState, event: InventoryEvent) => InventoryState;

/**
 * Result of attempting to apply an event
 */
export type EventApplicationResult =
  | { success: true; newState: InventoryState }
  | { success: false; error: EventApplicationError };

export interface EventApplicationError {
  readonly code:
    | 'INSUFFICIENT_INVENTORY'
    | 'INVALID_LOCATION'
    | 'INVALID_PRODUCT'
    | 'UNAUTHORIZED'
    | 'EXPIRED_PRODUCT'
    | 'RECALLED_PRODUCT'
    | 'DUPLICATE_EVENT'
    | 'CONFLICT';
  readonly message: string;
  readonly details?: Record<string, unknown>;
}
