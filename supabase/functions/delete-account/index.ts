import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

async function currentUser(req: Request) {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) throw new Error("Missing authorization token");
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) throw new Error("Invalid session");
  return data.user;
}

async function revokeGoogleToken(accessToken: string) {
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(accessToken)}`, { method: "POST" });
  } catch {
    // A transient revocation failure must not prevent deletion of the FlowOS account.
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const user = await currentUser(req);
    const { data: tokenRow } = await admin.schema("private").from("google_oauth_tokens").select("access_token").eq("user_id", user.id).maybeSingle();
    if (tokenRow?.access_token) await revokeGoogleToken(tokenRow.access_token as string);

    for (const table of ["commitments", "google_calendars", "google_connections", "google_task_lists"]) {
      const { error } = await admin.from(table).delete().eq("user_id", user.id);
      if (error) throw error;
    }
    for (const table of ["google_calendar_sync_state", "google_task_sync_state", "google_oauth_tokens"]) {
      const { error } = await admin.schema("private").from(table).delete().eq("user_id", user.id);
      if (error) throw error;
    }

    const { error: authError } = await admin.auth.admin.deleteUser(user.id);
    if (authError) throw authError;
    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
