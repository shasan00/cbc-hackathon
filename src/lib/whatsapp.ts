/**
 * Kapso WhatsApp client helpers.
 *
 * Required env vars:
 *   KAPSO_API_BASE_URL   e.g. https://api.kapso.ai
 *   KAPSO_API_KEY        get from Kapso dashboard → API Keys
 *   WHATSAPP_PHONE_NUMBER_ID  597907523413541  (sandbox)
 */

const BASE = process.env.KAPSO_API_BASE_URL!.replace(/\/+$/, "");
const API_KEY = process.env.KAPSO_API_KEY!;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;
const GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? "v24.0";

function metaUrl(path: string) {
  return `${BASE}/meta/whatsapp/${GRAPH_VERSION}/${path}`;
}

function headers() {
  return {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY,
  };
}

/** Send a plain text message. */
export async function sendText(to: string, body: string) {
  return fetch(metaUrl(`${PHONE_NUMBER_ID}/messages`), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });
}

/**
 * Send a health-coach nudge with ✅ / ⏭️ / 🔄 quick-reply buttons.
 *
 * @param questId  Used as the button ID prefix so the webhook can resolve which quest.
 */
export async function sendNudge(
  to: string,
  opts: {
    questId: string;
    headline: string;  // e.g. "Flight to Austin in 2h — here's your plan:"
    advice: string;    // Claude's recommendation, ≤1024 chars
  }
) {
  const { questId, headline, advice } = opts;

  return fetch(metaUrl(`${PHONE_NUMBER_ID}/messages`), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        header: { type: "text", text: headline },
        body: { text: advice },
        action: {
          buttons: [
            { type: "reply", reply: { id: `done:${questId}`, title: "✅ Done" } },
            { type: "reply", reply: { id: `skip:${questId}`, title: "⏭️ Skip" } },
            { type: "reply", reply: { id: `later:${questId}`, title: "🔄 Later" } },
          ],
        },
      },
    }),
  });
}

// ── Inbound payload types ────────────────────────────────────────────────────

export type WaMessage =
  | { type: "text"; from: string; text: string; msgId: string }
  | { type: "button_reply"; from: string; buttonId: string; buttonTitle: string; msgId: string }
  | { type: "other"; from: string; msgId: string };

/**
 * Parse a raw Kapso webhook body into a normalised WaMessage (or null if not a message event).
 *
 * Supports two formats:
 *  - Kapso v2 (kind=kapso): { message: { id, type, from, text?, interactive? }, ... }
 *  - Meta passthrough (kind=meta): { entry: [{ changes: [{ value: { messages: [...] } }] }] }
 *
 * The `from` field is normalised to digits-only (strips leading +) to match
 * the wa_id format stored by POST /api/whatsapp/connect.
 */
export function parseWebhookMessage(body: unknown): WaMessage | null {
  try {
    const b = body as any;

    // ── Kapso v2 format ──────────────────────────────────────────────────────
    if (b?.message) {
      const msg = b.message;
      const from: string = String(msg.from ?? "").replace(/^\+/, "");
      const msgId: string = msg.id ?? "";

      if (msg.type === "text") {
        return { type: "text", from, text: msg.text?.body ?? "", msgId };
      }
      if (msg.type === "interactive") {
        const reply = msg.interactive?.button_reply;
        if (reply) {
          return { type: "button_reply", from, buttonId: reply.id, buttonTitle: reply.title, msgId };
        }
      }
      return { type: "other", from, msgId };
    }

    // ── Meta passthrough format (production / kind=meta) ─────────────────────
    const msg = b?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return null;

    const from: string = String(msg.from ?? "").replace(/^\+/, "");
    const msgId: string = msg.id ?? "";

    if (msg.type === "text") {
      return { type: "text", from, text: msg.text?.body ?? "", msgId };
    }
    if (msg.type === "interactive") {
      const reply = msg.interactive?.button_reply;
      if (reply) {
        return { type: "button_reply", from, buttonId: reply.id, buttonTitle: reply.title, msgId };
      }
    }
    return { type: "other", from, msgId };
  } catch {
    return null;
  }
}
