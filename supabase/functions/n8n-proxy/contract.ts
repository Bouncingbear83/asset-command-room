import { z } from "npm:zod@3";
const WebhookSchema = z.object({ endpoint: z.enum(["stellar-earnings-prep", "stellar-layer-scan", "stellar-vault-search"]), body: z.record(z.unknown()) }).strict();
export const ApplyBodySchema = z.object({
  tracker_id: z.string().uuid().optional(),
  op: z.enum(["accept", "edit", "placed", "apply_all"]).default("accept"),
  edit: z.object({
    band: z.enum(["CONFIRM", "AMBER", "RED", "KILL"]).optional(),
    override_reason: z.string().max(500).optional(),
    aj_line: z.string().max(1000).optional(),
    review_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    limit: z.number().positive().optional(),
    shares: z.number().positive().optional(),
  }).strict().optional(),
  ids: z.array(z.string().uuid()).min(1).max(50).optional(),
  dry_run: z.boolean().optional(),
}).strict().refine((b) => b.op === "apply_all" ? !!b.ids : !!b.tracker_id, { message: "tracker_id (or ids for apply_all) required" });
const ApplySchema = z.object({ endpoint: z.literal("apply-tracker"), body: ApplyBodySchema }).strict();
export const RequestSchema = z.union([WebhookSchema, ApplySchema]);
