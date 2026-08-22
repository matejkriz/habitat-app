import { handleAuth } from "@workos-inc/authkit-nextjs";
import { getWorkOSBaseUrl } from "@/lib/workos-url";

export const GET = handleAuth({
  returnPathname: "/",
  baseURL: getWorkOSBaseUrl(),
});
