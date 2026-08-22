import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { getWorkOSBaseUrl } from "@/lib/workos-url";

export async function GET(): Promise<never> {
  const signInUrl = await getSignInUrl({
    returnTo: "/",
    redirectUri: `${getWorkOSBaseUrl()}/callback`,
  });
  redirect(signInUrl);
}
