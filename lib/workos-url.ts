export function getWorkOSBaseUrl(
  redirectUri = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI,
  portlessUrl = process.env.PORTLESS_URL,
  vercelBranchUrl = process.env.VERCEL_BRANCH_URL,
  vercelUrl = process.env.VERCEL_URL,
  localE2E = process.env.E2E_LOCAL,
): string {
  const vercelHostname = vercelBranchUrl || vercelUrl;
  const publicUrl =
    portlessUrl ||
    redirectUri ||
    (vercelHostname ? `https://${vercelHostname}` : undefined);
  if (!publicUrl) {
    throw new Error(
      "PORTLESS_URL, NEXT_PUBLIC_WORKOS_REDIRECT_URI, VERCEL_BRANCH_URL, or VERCEL_URL must be configured.",
    );
  }

  const url = new URL(publicUrl);
  const isLoopback = ["127.0.0.1", "localhost", "[::1]"].includes(
    url.hostname,
  );
  if (url.protocol === "http:" && localE2E === "true" && !isLoopback) {
    throw new Error("The local E2E WorkOS URL must use a loopback hostname.");
  }
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && localE2E === "true" && isLoopback)
  ) {
    throw new Error("The public WorkOS URL must use HTTPS.");
  }

  return url.origin;
}
