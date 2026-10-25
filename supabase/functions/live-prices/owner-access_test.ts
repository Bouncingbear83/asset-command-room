import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { appCorsHeaders, isOwnerEmail, ownerOrIngest } from "../_shared/owner-access.ts";

Deno.test("only the owner email is allowed", () => {
  assertEquals(isOwnerEmail("bertbroadhead@gmail.com"), true);
  assertEquals(isOwnerEmail("other@gmail.com"), false);
  assertEquals(isOwnerEmail(null), false);
});
Deno.test("only app origins receive CORS permission", () => {
  assertEquals(appCorsHeaders(new Request("https://example.com", { headers: { Origin: "https://asset-command-room.lovable.app" } }))["Access-Control-Allow-Origin"], "https://asset-command-room.lovable.app");
  assertEquals(appCorsHeaders(new Request("https://example.com", { headers: { Origin: "https://attacker.example" } }))["Access-Control-Allow-Origin"], undefined);
});
Deno.test("missing credentials cannot access market functions", async () => {
  assertEquals(await ownerOrIngest(new Request("https://example.com")), false);
});