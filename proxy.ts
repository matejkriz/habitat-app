import { authkitProxy } from "@workos-inc/authkit-nextjs";
import { UNAUTHENTICATED_PATHS } from "@/lib/auth-routes";
import { getWorkOSBaseUrl } from "@/lib/workos-url";

export default authkitProxy({
  redirectUri: `${getWorkOSBaseUrl()}/callback`,
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: [...UNAUTHENTICATED_PATHS],
  },
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
