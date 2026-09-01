import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandler,
} from "mcp-handler";
import { getMcpResourceUrl, getWorkOSAuthKitIssuer } from "@/lib/mcp/config";

export const dynamic = "force-dynamic";

export function GET(request: Request): Response {
  return protectedResourceHandler({
    authServerUrls: [getWorkOSAuthKitIssuer()],
    resourceUrl: getMcpResourceUrl(),
  })(request);
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
