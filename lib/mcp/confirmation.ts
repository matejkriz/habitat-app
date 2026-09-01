import { randomUUID } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import { getMcpConfirmationSecret, getMcpResourceUrl } from "./config";

const confirmationPayloadSchema = z.object({
  sub: z.string().min(1),
  jti: z.string().uuid(),
  childIds: z.array(z.string().min(1)).min(1).max(10),
  fromDate: z.string(),
  toDate: z.string(),
  reason: z.string().max(500).nullable(),
});

export type ExcuseConfirmation = z.infer<typeof confirmationPayloadSchema>;

const getConfirmationIssuer = (): string => `${getMcpResourceUrl()}#confirmation`;

export const createExcuseConfirmation = async (input: {
  readonly workosUserId: string;
  readonly childIds: ReadonlyArray<string>;
  readonly fromDate: string;
  readonly toDate: string;
  readonly reason: string | null;
}): Promise<{ token: string; expiresAt: string }> => {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 10 * 60;
  const token = await new SignJWT({
    childIds: [...input.childIds],
    fromDate: input.fromDate,
    toDate: input.toDate,
    reason: input.reason,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(getConfirmationIssuer())
    .setAudience(getMcpResourceUrl())
    .setSubject(input.workosUserId)
    .setJti(randomUUID())
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(getMcpConfirmationSecret());

  return { token, expiresAt: new Date(expiresAt * 1000).toISOString() };
};

export const verifyExcuseConfirmation = async (
  token: string,
  workosUserId: string,
): Promise<ExcuseConfirmation> => {
  const { payload } = await jwtVerify(token, getMcpConfirmationSecret(), {
    algorithms: ["HS256"],
    issuer: getConfirmationIssuer(),
    audience: getMcpResourceUrl(),
    subject: workosUserId,
  });
  return confirmationPayloadSchema.parse(payload);
};
