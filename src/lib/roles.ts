import type { UserRole } from "@/types"

export const roleLabels: Record<UserRole, string> = {
  super_admin: "Super admin",
  owner: "Owner",
  manager: "Manager",
  seller: "Seller",
  admin: "Admin",
  gestionnaire: "Gestionnaire",
  vendeur: "Vendeur",
  client: "Client",
}

export const assignableRoles: UserRole[] = [
  "super_admin",
  "owner",
  "manager",
  "seller",
  "admin",
  "gestionnaire",
  "vendeur",
  "client",
]

export function getAssignableRolesForActor(role: UserRole): UserRole[] {
  if (role === "super_admin") {
    return assignableRoles
  }

  if (role === "owner" || role === "admin") {
    return assignableRoles.filter((entry) => entry !== "super_admin")
  }

  return []
}

export function normalizeRole(role: unknown): UserRole {
  switch (role) {
    case "super_admin":
    case "owner":
    case "manager":
    case "seller":
    case "admin":
    case "gestionnaire":
    case "vendeur":
    case "client":
      return role
    default:
      return "vendeur"
  }
}

export function isClientRole(role: UserRole) {
  return role === "client"
}

export function isStaffRole(role: UserRole) {
  return role !== "client"
}

export function canManageCatalog(role: UserRole) {
  return ["super_admin", "owner", "manager", "admin", "gestionnaire"].includes(role)
}

export function canManageSales(role: UserRole) {
  return isStaffRole(role)
}

export function canManageDebts(role: UserRole) {
  return ["super_admin", "owner", "manager", "admin", "gestionnaire"].includes(role)
}

export function canManageUsers(role: UserRole) {
  return ["super_admin", "owner", "admin"].includes(role)
}

export function canReadUsersCollection(role: UserRole) {
  return ["super_admin", "owner", "manager", "admin", "gestionnaire"].includes(role)
}

export function isProtectedAdminRole(role: UserRole) {
  return ["super_admin", "owner", "admin"].includes(role)
}
