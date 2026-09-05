import { authkitProxy } from "@workos-inc/authkit-nextjs";
import type { NextFetchEvent, NextRequest } from "next/server";
import { UNAUTHENTICATED_PATHS } from "@/lib/auth-routes";
import { formatServerTiming } from "@/lib/server-timing";
import { getWorkOSBaseUrl } from "@/lib/workos-url";

const authkitHandler = authkitProxy({
  redirectUri: `${getWorkOSBaseUrl()}/callback`,
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: [...UNAUTHENTICATED_PATHS],
  },
});

export default async function proxy(
  request: NextRequest,
  event: NextFetchEvent,
) {
  const startedAt = performance.now();
  const response = await authkitHandler(request, event);

  if (response) {
    try {
      response.headers.append(
        "Server-Timing",
        formatServerTiming("authkit", performance.now() - startedAt),
      );
    } catch {
      // Timing headers must not interfere with authentication responses.
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
