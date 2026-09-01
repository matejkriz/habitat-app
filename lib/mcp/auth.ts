import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { getMcpResourceUrl, getWorkOSAuthKitIssuer } from "./config";

const jwksByIssuer = new Map<
  string,
  ReturnType<typeof createRemoteJWKSet>
>();

const getJwks = (issuer: string): ReturnType<typeof createRemoteJWKSet> => {
  const existing = jwksByIssuer.get(issuer);
  if (existing) return existing;
  const jwks = createRemoteJWKSet(new URL(`${issuer}/oauth2/jwks`));
  jwksByIssuer.set(issuer, jwks);
  return jwks;
};

const readScopes = (payload: JWTPayload): string[] => {
  if (typeof payload.scope === "string") {
    return payload.scope.split(" ").filter(Boolean);
  }
  if (Array.isArray(payload.scope)) {
    return payload.scope.filter((scope): scope is string => typeof scope === "string");
  }
  return [];
};

export const toMcpAuthInfo = (
  token: string,
  payload: JWTPayload,
  resourceUrl: string,
): AuthInfo => {
  if (!payload.sub) throw new Error("Access token has no subject");
  if (typeof payload.exp !== "number") {
    throw new Error("Access token has no expiration");
  }
  const clientId =
    typeof payload.client_id === "string"
      ? payload.client_id
      : typeof payload.azp === "string"
        ? payload.azp
        : "dynamic-mcp-client";

  return {
    token,
    clientId,
    scopes: readScopes(payload),
    expiresAt: payload.exp,
    resource: new URL(resourceUrl),
    extra: { workosUserId: payload.sub },
  };
};

export const verifyMcpToken = async (
  _request: Request,
  token?: string,
): Promise<AuthInfo | undefined> => {
  if (!token) return undefined;
  const issuer = getWorkOSAuthKitIssuer();
  const resourceUrl = getMcpResourceUrl();
  const { payload } = await jwtVerify(token, getJwks(issuer), {
    issuer,
    audience: resourceUrl,
    algorithms: ["RS256"],
  });
  return toMcpAuthInfo(token, payload, resourceUrl);
};

export const getWorkosUserId = (authInfo: AuthInfo | undefined): string => {
  const value = authInfo?.extra?.workosUserId;
  if (typeof value !== "string" || !value) {
    throw new Error("Authenticated WorkOS user is missing");
  }
  return value;
};
