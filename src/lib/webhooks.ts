import { toast } from "sonner";

const N8N_BASE = "https://bertbroad83.app.n8n.cloud/webhook";
const N8N_KEY = "STELLAR";

export async function triggerWebhook(endpoint: string, body: object, successMsg: string) {
  try {
    await fetch(`${N8N_BASE}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-stellar-key": N8N_KEY,
      },
      body: JSON.stringify(body),
    });
    toast.success(successMsg);
  } catch (e: any) {
    toast.error(`Webhook failed: ${e.message}`);
  }
}
