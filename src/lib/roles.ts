import type { Role } from "@prisma/client";

export function resolveRole(email: string, storedRole: Role, verified: boolean, ownerEmail?: string, adminEmail?: string): Role {
  const normalizedEmail = email.trim().toLowerCase();
  const owner = ownerEmail?.trim().toLowerCase();
  const admin = adminEmail?.trim().toLowerCase();
  if (owner && normalizedEmail === owner) return "OWNER";
  if (verified && admin && normalizedEmail === admin) return "STAFF";
  return owner && storedRole === "OWNER" ? "CUSTOMER" : storedRole;
}