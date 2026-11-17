import { describe, expect, it } from "vitest";
import { resolveRole } from "../../src/lib/roles";

describe("configured roles", () => {
  it("grants staff access only to the verified configured admin", () => {
    expect(resolveRole("ADMIN@example.com", "CUSTOMER", true, "owner@example.com", "admin@example.com")).toBe("STAFF");
    expect(resolveRole("admin@example.com", "CUSTOMER", false, "owner@example.com", "admin@example.com")).toBe("CUSTOMER");
    expect(resolveRole("admin@example.com", "CUSTOMER", true, "owner@example.com", undefined)).toBe("CUSTOMER");
  });

  it("preserves owner and independently assigned staff roles", () => {
    expect(resolveRole("owner@example.com", "CUSTOMER", true, "owner@example.com", "owner@example.com")).toBe("OWNER");
    expect(resolveRole("staff@example.com", "STAFF", true, "owner@example.com", "admin@example.com")).toBe("STAFF");
    expect(resolveRole("other@example.com", "OWNER", true, "owner@example.com", "admin@example.com")).toBe("CUSTOMER");
  });
});