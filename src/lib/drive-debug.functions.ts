import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEPLOYMENT_MARKER = "drive-debug-2026-07-01T18:00:00Z-v1";

async function fingerprint(v: string): Promise<string> {
  const buf = new TextEncoder().encode(v);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 12);
}

async function inspect(name: string) {
  const v = process.env[name];
  if (!v) return { name, present: false as const };
  return {
    name,
    present: true as const,
    length: v.length,
    first4: v.slice(0, 4),
    last4: v.slice(-4),
    sha256_12: await fingerprint(v),
  };
}

export const driveEnvDiag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const names = [
      "GOOGLE_OAUTH_CLIENT_ID",
      "GOOGLE_OAUTH_CLIENT_SECRET",
      "GOOGLE_OAUTH_REFRESH_TOKEN",
      "GOOGLE_DRIVE_FOLDER_ID",
    ];
    const secrets = await Promise.all(names.map(inspect));
    return {
      deploymentMarker: DEPLOYMENT_MARKER,
      timestamp: new Date().toISOString(),
      secrets,
    };
  });
