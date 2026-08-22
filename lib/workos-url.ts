export function getWorkOSBaseUrl(
  redirectUri = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI,
  portlessUrl = process.env.PORTLESS_URL,
): string {
  const publicUrl = portlessUrl || redirectUri;
  if (!publicUrl) {
    throw new Error(
      "PORTLESS_URL or NEXT_PUBLIC_WORKOS_REDIRECT_URI must be configured.",
    );
  }

  const url = new URL(publicUrl);
  if (url.protocol !== "https:") {
    throw new Error("The public WorkOS URL must use HTTPS.");
  }

  return url.origin;
}
