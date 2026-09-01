const requireHttpsOrigin = (name: string, value: string | undefined): string => {
  if (!value) throw new Error(`${name} is not configured`);
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} must be a public HTTPS URL`);
  }
  return url.toString().replace(/\/$/, "");
};

export const getMcpResourceUrl = (): string =>
  requireHttpsOrigin("MCP_RESOURCE_URL", process.env.MCP_RESOURCE_URL);

export const getMcpResourceOrigin = (): string =>
  new URL(getMcpResourceUrl()).origin;

export const getWorkOSAuthKitIssuer = (): string => {
  const issuer = requireHttpsOrigin(
    "WORKOS_AUTHKIT_DOMAIN",
    process.env.WORKOS_AUTHKIT_DOMAIN,
  );
  if (new URL(issuer).pathname !== "/") {
    throw new Error("WORKOS_AUTHKIT_DOMAIN must be an HTTPS origin without a path");
  }
  return issuer;
};

export const getMcpConfirmationSecret = (): Uint8Array => {
  const secret = process.env.MCP_CONFIRMATION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("MCP_CONFIRMATION_SECRET must contain at least 32 characters");
  }
  return new TextEncoder().encode(secret);
};
