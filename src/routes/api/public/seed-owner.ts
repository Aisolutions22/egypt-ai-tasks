import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";

/**
 * One-shot seed of the initial Owner account.
 * Requires ?token=<SEED_OWNER_TOKEN> matching the server-side secret.
 */
export const Route = createFileRoute("/api/public/seed-owner")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const expected = process.env.SEED_OWNER_TOKEN;
        const provided = new URL(request.url).searchParams.get("token") ?? "";
        if (!expected) {
          return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
        }
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
        }


        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) {
          return Response.json({ ok: false, error: "Server not configured" }, { status: 500 });
        }
        const admin = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        // Already an owner?
        const { data: existing } = await admin
          .from("profiles")
          .select("id")
          .eq("role", "owner")
          .limit(1);
        if (existing && existing.length > 0) {
          return Response.json({ ok: true, message: "Owner already exists." });
        }

        const email = "admin@aitasks.com";
        const password = "Admin@2024";

        // Try to find user; otherwise create
        let userId: string | null = null;
        const { data: list } = await admin.auth.admin.listUsers();
        const found = list?.users.find((u) => u.email?.toLowerCase() === email);
        if (found) {
          userId = found.id;
        } else {
          const { data: created, error } = await admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
          });
          if (error || !created.user) {
            return Response.json({ ok: false, error: error?.message ?? "createUser failed" }, { status: 500 });
          }
          userId = created.user.id;
        }

        const { error: pErr } = await admin.from("profiles").insert({
          user_id: userId,
          full_name: "المالك",
          role: "owner",
          color: "#FF6B2B",
        });
        if (pErr && !pErr.message.includes("duplicate")) {
          return Response.json({ ok: false, error: pErr.message }, { status: 500 });
        }

        return Response.json({
          ok: true,
          email,
          password,
          message: "Owner created. You can now log in.",
        });
      },
    },
  },
});
