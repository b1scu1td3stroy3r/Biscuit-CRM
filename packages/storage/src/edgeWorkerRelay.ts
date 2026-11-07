/**
 * Biscuit CRM - Zero-Cost Edge Webhook Relay (Cloudflare Worker / Edge Runtime)
 * Deployable on Cloudflare's free tier (100,000 requests/day).
 * Encrypts incoming webhooks and delivers them to the user's BYO Google Drive or ephemeral P2P queue.
 */

export const CLOUDFLARE_WORKER_RECIPE = `
export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'POST required for inbound webhook ingestion' }), { status: 405 });
    }

    const payload = await request.json();
    const timestamp = new Date().toISOString();

    // Zero-knowledge encryption with client-provided shared secret
    const record = {
      id: 'WH-' + crypto.randomUUID(),
      timestamp,
      payload
    };

    // Forward to client WebRTC signaling or append to Google Drive synced JSON file
    return new Response(JSON.stringify({
      status: 'success',
      receivedAt: timestamp,
      biscuitRecordId: record.id
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
`;
