import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

/**
 * Permanent deletion of a MANAGER account and everything it owns.
 *
 * App Store guideline 5.1.1(v) is explicit: an app that supports account
 * creation must offer account deletion *within the app*. Pointing the user at
 * an email address or a web form does not satisfy it. The driver side already
 * had this (`connect-driver` action `delete-driver`); this is its counterpart
 * for the accounts created by the manager portal.
 *
 * WHO CAN CALL IT: only the account holder. The caller's own JWT is verified
 * and everything deleted is scoped to that user id, or to the connection
 * codes that user owns. There is no "delete someone else" shape to this
 * function — the target is never taken from the request body.
 *
 * WHAT DELETION MEANS HERE: the auth user is removed last, and only after the
 * rows are gone. Some tables cascade from `auth.users` already (profiles,
 * stations, notification_tokens); the explicit passes below cover the tables
 * that key on a connection code or a plain user column instead, which no
 * cascade can reach.
 *
 * WHAT SURVIVES, deliberately: nothing of the manager's. Drivers connected to
 * this account are unauthenticated identities belonging to the fleet, and
 * their rows are keyed by the manager's connection code, so they go too —
 * which is the honest reading of "delete my data", since that driver data was
 * only ever collected on this manager's behalf.
 *
 * Deploy with:  npx supabase functions deploy delete-account
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, details?: unknown) => {
  console.log(`[DELETE-ACCOUNT] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

/** Tables keyed by one of the manager's connection codes. */
const BY_ADMIN_CODE = [
  "driver_expenses",
  "driver_reports",
  "driver_alerts",
  "driver_location_history",
  "driver_locations",
  "sos_events",
  "tasks",
  "drivers",
  "emergency_contacts",
] as const;

/** Tables keyed directly by the manager's auth user id, with the column name. */
const BY_USER_COLUMN: ReadonlyArray<readonly [table: string, column: string]> = [
  ["admin_subscriptions", "user_id"],
  ["push_subscriptions", "user_id"],
  ["notification_tokens", "user_id"],
  ["temp_track_sessions", "owner_user_id"],
  ["geofences", "created_by"],
  ["driver_connections", "admin_user_id"],
  ["user_roles", "user_id"],
  ["devices", "user_id"],
  ["profiles", "id"],
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized. Please sign in first." }, 401);
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token || token === "undefined" || token === "null") {
      return json({ error: "Unauthorized. Please sign in first." }, 401);
    }

    // The identity comes from the verified token, never from the request body.
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) {
      return json({ error: "Unauthorized. Please sign in first." }, 401);
    }

    log("Deleting account", { userId: user.id });

    // Connection codes this manager owns. Everything driver-side hangs off
    // these rather than off the user id.
    const { data: deviceRows } = await admin
      .from("devices")
      .select("connection_code")
      .eq("user_id", user.id);

    const adminCodes = [
      ...new Set(
        (deviceRows ?? [])
          .map((d: { connection_code: string | null }) => d.connection_code)
          .filter((c): c is string => Boolean(c))
      ),
    ];

    // Best-effort per table: one failure (a table absent from this project,
    // a stricter policy) must not strand the account half-deleted. Anything
    // that fails is reported back rather than silently swallowed.
    const results: Record<string, string> = {};

    const runDelete = async (table: string, column: string, values: string[] | string) => {
      const key = `${table}.${column}`;
      try {
        const query = admin.from(table).delete();
        const { error } = Array.isArray(values)
          ? await query.in(column, values)
          : await query.eq(column, values);
        results[key] = error ? `error: ${error.message}` : "ok";
        if (error) console.warn(`[DELETE-ACCOUNT] ${key} failed:`, error.message);
      } catch (err) {
        results[key] = `error: ${String(err)}`;
      }
    };

    if (adminCodes.length > 0) {
      for (const table of BY_ADMIN_CODE) {
        await runDelete(table, "admin_code", adminCodes);
      }
    }

    for (const [table, column] of BY_USER_COLUMN) {
      await runDelete(table, column, user.id);
    }

    // The auth user goes last: while it exists the account can still be
    // signed into, so removing it is what actually ends the account. Rows
    // that cascade from auth.users go with it.
    const { error: authErr } = await admin.auth.admin.deleteUser(user.id);
    if (authErr) {
      log("Auth user delete failed", { error: authErr.message });
      return json(
        {
          error: "Could not finish deleting your account. Please contact support.",
          details: authErr.message,
          partial: results,
        },
        500
      );
    }

    log("Account deleted", { userId: user.id, codes: adminCodes.length });
    return json({ success: true, deleted: results });
  } catch (err) {
    console.error("[DELETE-ACCOUNT] Unhandled error:", err);
    return json({ error: "Could not delete your account. Please try again." }, 500);
  }
});
