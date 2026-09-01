import { getWorkOSAuthKitIssuer } from "@/lib/mcp/config";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Cache-Control": "public, max-age=3600",
};

export async function GET(): Promise<Response> {
  const response = await fetch(
    `${getWorkOSAuthKitIssuer()}/.well-known/oauth-authorization-server`,
    { headers: { Accept: "application/json" }, next: { revalidate: 3600 } },
  );
  if (!response.ok) {
    return Response.json(
      { error: "authorization_server_metadata_unavailable" },
      { status: 502, headers: corsHeaders },
    );
  }
  return new Response(await response.text(), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 200, headers: corsHeaders });
}
