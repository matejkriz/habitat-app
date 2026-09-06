export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      version: process.env.NEXT_PUBLIC_APP_VERSION,
      commitSha: process.env.NEXT_PUBLIC_APP_COMMIT_SHA,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
      },
    },
  );
}
