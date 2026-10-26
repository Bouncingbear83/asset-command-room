import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { RequestSchema } from "./contract.ts";
for (const endpoint of ["stellar-earnings-prep", "stellar-layer-scan", "stellar-vault-search"]) Deno.test(`accepts ${endpoint}`, () => assertEquals(RequestSchema.safeParse({ endpoint, body: {} }).success, true));
Deno.test("unknown webhook rejected", () => assertEquals(RequestSchema.safeParse({ endpoint: "other", body: {} }).success, false));
Deno.test("object body required", () => assertEquals(RequestSchema.safeParse({ endpoint: "stellar-vault-search", body: "text" }).success, false));
