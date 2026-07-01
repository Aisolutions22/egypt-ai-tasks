import { createFileRoute } from "@tanstack/react-router";

const DEPLOYMENT_MARKER = "drive-debug-2026-07-01T18:20:00Z-v2";

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
    sha256_12: await fingerprint(v),
  };
}

function describeToken(v: string | undefined) {
  if (!v) return { present: false as const };
  const firstIdx = v.indexOf("1//");
  const secondIdx = firstIdx >= 0 ? v.indexOf("1//", firstIdx + 1) : -1;
  let nonPrintable = 0;
  for (let i = 0; i < v.length; i++) {
    const c = v.charCodeAt(i);
    if ((c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) || c === 0x7f) {
      nonPrintable++;
    }
  }
  const newlineCount = (v.match(/[\r\n]/g) || []).length;
  return {
    present: true as const,
    startsWith4: v.slice(0, 4),
    endsWith4: v.slice(-4),
    length: v.length,
    newlineCount,
    hasWhitespace: /\s/.test(v),
    hasDoubleQuote: v.includes('"'),
    hasSingleQuote: v.includes("'"),
    beginsWith_1SlashSlash: v.startsWith("1//"),
    containsAnother_1SlashSlash: secondIdx !== -1,
    looksLikeBase64: /^[A-Za-z0-9+/=]+$/.test(v),
    hasNonPrintable: nonPrintable > 0,
    nonPrintableCount: nonPrintable,
  };
}

export const Route = createFileRoute("/api/public/drive-env-diag")({
  server: {
    handlers: {
      GET: async () => {
        const names = [
          "GOOGLE_OAUTH_CLIENT_ID",
          "GOOGLE_OAUTH_CLIENT_SECRET",
          "GOOGLE_OAUTH_REFRESH_TOKEN",
          "GOOGLE_DRIVE_FOLDER_ID",
        ];
        const secrets = await Promise.all(names.map(inspect));
        const refreshTokenDetails = describeToken(process.env.GOOGLE_OAUTH_REFRESH_TOKEN);
        return new Response(
          JSON.stringify({
            deploymentMarker: DEPLOYMENT_MARKER,
            timestamp: new Date().toISOString(),
            secrets,
            refreshTokenDetails,
          }),
          { headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
