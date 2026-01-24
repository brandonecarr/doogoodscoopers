import type { UserRole } from "./supabase/types";

// Permission definitions
export type Permission =
  // Client management
  | "clients:read"
  | "clients:write"
  | "clients:delete"
  // Location management
  | "locations:read"
  | "locations:write"
  // Dog management
  | "dogs:read"
  | "dogs:write"
  // Subscription management
  | "subscriptions:read"
  | "subscriptions:write"
  | "subscriptions:cancel"
  // Job management
  | "jobs:read"
  | "jobs:write"
  | "jobs:assign"
  | "jobs:complete"
  // Route management
  | "routes:read"
  | "routes:write"
  // Shift management
  | "shifts:read"
  | "shifts:write"
  | "shifts:clock"
  // Invoice management
  | "invoices:read"
  | "invoices:write"
  | "invoices:void"
  // Payment management
  | "payments:read"
  | "payments:process"
  | "payments:refund"
  // Lead management
  | "leads:read"
  | "leads:write"
  // Staff management
  | "staff:read"
  | "staff:write"
  | "staff:delete"
  // Pricing management
  | "pricing:read"
  | "pricing:write"
  // Settings
  | "settings:read"
  | "settings:write"
  // Notifications
  | "notifications:read"
  | "notifications:write"
  | "notifications:send"
  // Reports
  | "reports:read"
  | "reports:export"
  // Marketing
  | "marketing:read"
  | "marketing:write"
  // Gift certificates
  | "gift_certificates:read"
  | "gift_certificates:write"
  // Referrals
  | "referrals:read"
  | "referrals:write";

// Role permission mappings
const rolePermissions: Record<UserRole, Permission[]> = {
  OWNER: [
    // Full access to everything
    "clients:read", "clients:write", "clients:delete",
    "locations:read", "locations:write",
    "dogs:read", "dogs:write",
    "subscriptions:read", "subscriptions:write", "subscriptions:cancel",
    "jobs:read", "jobs:write", "jobs:assign", "jobs:complete",
    "routes:read", "routes:write",
    "shifts:read", "shifts:write", "shifts:clock",
    "invoices:read", "invoices:write", "invoices:void",
    "payments:read", "payments:process", "payments:refund",
    "leads:read", "leads:write",
    "staff:read", "staff:write", "staff:delete",
    "pricing:read", "pricing:write",
    "settings:read", "settings:write",
    "notifications:read", "notifications:write", "notifications:send",
    "reports:read", "reports:export",
    "marketing:read", "marketing:write",
    "gift_certificates:read", "gift_certificates:write",
    "referrals:read", "referrals:write",
  ],
  MANAGER: [
    // Near-full access except critical settings
    "clients:read", "clients:write",
    "locations:read", "locations:write",
    "dogs:read", "dogs:write",
    "subscriptions:read", "subscriptions:write", "subscriptions:cancel",
    "jobs:read", "jobs:write", "jobs:assign", "jobs:complete",
    "routes:read", "routes:write",
    "shifts:read", "shifts:write", "shifts:clock",
    "invoices:read", "invoices:write",
    "payments:read", "payments:process",
    "leads:read", "leads:write",
    "staff:read", "staff:write",
    "pricing:read",
    "settings:read",
    "notifications:read", "notifications:write", "notifications:send",
    "reports:read", "reports:export",
    "marketing:read", "marketing:write",
    "gift_certificates:read", "gift_certificates:write",
    "referrals:read", "referrals:write",
  ],
  OFFICE: [
    // Office operations
    "clients:read", "clients:write",
    "locations:read", "locations:write",
    "dogs:read", "dogs:write",
    "subscriptions:read", "subscriptions:write",
    "jobs:read", "jobs:write", "jobs:assign",
    "routes:read", "routes:write",
    "shifts:read",
    "invoices:read", "invoices:write",
    "payments:read", "payments:process",
    "leads:read", "leads:write",
    "staff:read",
    "pricing:read",
    "notifications:read", "notifications:send",
    "reports:read",
    "gift_certificates:read", "gift_certificates:write",
    "referrals:read", "referrals:write",
  ],
  CREW_LEAD: [
    // Field operations with some management
    "clients:read",
    "locations:read",
    "dogs:read",
    "subscriptions:read",
    "jobs:read", "jobs:write", "jobs:complete",
    "routes:read",
    "shifts:read", "shifts:write", "shifts:clock",
    "notifications:read",
  ],
  FIELD_TECH: [
    // Basic field operations
    "clients:read",
    "locations:read",
    "dogs:read",
    "jobs:read", "jobs:complete",
    "routes:read",
    "shifts:read", "shifts:clock",
  ],
  ACCOUNTANT: [
    // Financial access only
    "clients:read",
    "subscriptions:read",
    "invoices:read", "invoices:write", "invoices:void",
    "payments:read", "payments:process", "payments:refund",
    "pricing:read",
    "reports:read", "reports:export",
    "gift_certificates:read",
  ],
  CLIENT: [
    // Self-service only (client portal)
    // Clients can only see their own data via RLS
    "clients:read",
    "locations:read",
    "dogs:read",
    "subscriptions:read",
    "jobs:read",
    "invoices:read",
    "payments:read",
    "referrals:read", "referrals:write",
    "gift_certificates:read",
  ],
};

// Check if a role has a specific permission
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

// Check if a role has any of the specified permissions
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

// Check if a role has all of the specified permissions
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

// Get all permissions for a role
export function getPermissions(role: UserRole): Permission[] {
  return rolePermissions[role] ?? [];
}

// Check if role is a staff role (not CLIENT)
export function isStaffRole(role: UserRole): boolean {
  return role !== "CLIENT";
}

// Check if role has management capabilities
export function isManagementRole(role: UserRole): boolean {
  return role === "OWNER" || role === "MANAGER";
}

// Check if role can access office portal
export function canAccessOfficePortal(role: UserRole): boolean {
  return ["OWNER", "MANAGER", "OFFICE", "CREW_LEAD", "ACCOUNTANT"].includes(role);
}

// Check if role can access field portal
export function canAccessFieldPortal(role: UserRole): boolean {
  return ["OWNER", "MANAGER", "CREW_LEAD", "FIELD_TECH"].includes(role);
}

// Check if role can access client portal
export function canAccessClientPortal(role: UserRole): boolean {
  return role === "CLIENT" || role === "OWNER";
}

// Role hierarchy for comparison (higher number = more permissions)
const roleHierarchy: Record<UserRole, number> = {
  OWNER: 100,
  MANAGER: 80,
  OFFICE: 60,
  CREW_LEAD: 50,
  ACCOUNTANT: 40,
  FIELD_TECH: 30,
  CLIENT: 10,
};

// Check if roleA is higher or equal in hierarchy to roleB
export function isRoleAtLeast(roleA: UserRole, roleB: UserRole): boolean {
  return roleHierarchy[roleA] >= roleHierarchy[roleB];
}

// Get display name for role
export function getRoleDisplayName(role: UserRole): string {
  const names: Record<UserRole, string> = {
    OWNER: "Owner",
    MANAGER: "Manager",
    OFFICE: "Office Staff",
    CREW_LEAD: "Crew Lead",
    FIELD_TECH: "Field Technician",
    ACCOUNTANT: "Accountant",
    CLIENT: "Client",
  };
  return names[role] ?? role;
}

// Get role color for UI
export function getRoleColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    OWNER: "text-purple-600 bg-purple-100",
    MANAGER: "text-blue-600 bg-blue-100",
    OFFICE: "text-teal-600 bg-teal-100",
    CREW_LEAD: "text-orange-600 bg-orange-100",
    FIELD_TECH: "text-green-600 bg-green-100",
    ACCOUNTANT: "text-gray-600 bg-gray-100",
    CLIENT: "text-navy-600 bg-navy-100",
  };
  return colors[role] ?? "text-gray-600 bg-gray-100";
}
