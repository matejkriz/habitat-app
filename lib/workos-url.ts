export function getWorkOSBaseUrl(
  redirectUri = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI,
  portlessUrl = process.env.PORTLESS_URL,
  vercelBranchUrl = process.env.VERCEL_BRANCH_URL,
  vercelUrl = process.env.VERCEL_URL,
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
  if (url.protocol !== "https:") {
    throw new Error("The public WorkOS URL must use HTTPS.");
  }

  return url.origin;
}
