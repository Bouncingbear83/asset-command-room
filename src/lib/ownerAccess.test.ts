import { describe, expect, it } from "vitest";
import { isOwnerEmail } from "./ownerAccess";

describe("owner access", () => {
  it("allows only Bert's email, case-insensitively", () => {
    expect(isOwnerEmail("bertbroadhead@gmail.com")).toBe(true);
    expect(isOwnerEmail("BertBroadhead@gmail.com")).toBe(true);
    expect(isOwnerEmail("other@gmail.com")).toBe(false);
    expect(isOwnerEmail(undefined)).toBe(false);
  });
});