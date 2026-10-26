import { z } from "npm:zod@3";
export const RequestSchema = z.object({ endpoint: z.enum(["stellar-earnings-prep", "stellar-layer-scan", "stellar-vault-search"]), body: z.record(z.unknown()) }).strict();
