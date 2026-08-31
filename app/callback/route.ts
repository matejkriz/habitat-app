import { handleAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";
import { getWorkOSBaseUrl } from "@/lib/workos-url";

export const GET = handleAuth({
  returnPathname: "/",
  baseURL: getWorkOSBaseUrl(),
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
