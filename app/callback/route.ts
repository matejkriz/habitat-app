import { handleAuth } from "@workos-inc/authkit-nextjs";
import { decodeJwt } from "jose";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isDevPersonaEmail, isDevPersonaModeAllowed } from "@/lib/dev-persona";
import { getWorkOSBaseUrl } from "@/lib/workos-url";

export const GET = handleAuth({
  returnPathname: "/",
  baseURL: getWorkOSBaseUrl(),
  onSuccess: async ({ user, accessToken }) => {
    if (isDevPersonaModeAllowed() && isDevPersonaEmail(user.email)) return;

    try {
      const { sid } = decodeJwt(accessToken);
      if (typeof sid !== "string" || !sid) {
        throw new Error("WorkOS session ID is missing");
      }

      await db.notifications.enqueueUnassignedParentLogin({
        workosUserId: user.id,
        email: user.email,
        loginId: sid,
      });
    } catch (error) {
      console.error("Failed to enqueue unassigned parent login notification:", error);
    }
  },
  onError: ({ error, request }) => {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : undefined;

    if (code === "missing_pkce_cookie") {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.json(
      {
        error: {
          message: "Something went wrong",
          description:
            "Couldn't sign in. If you are not sure what happened, please contact your organization admin.",
        },
      },
      { status: 500 },
    );
  },
});
