import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { getWorkosUserId, verifyMcpToken } from "@/lib/mcp/auth";
import { getMcpResourceOrigin } from "@/lib/mcp/config";
import {
  createMcpExcuse,
  excusePreviewInputSchema,
  getMcpParentProfile,
  McpParentError,
  previewMcpExcuse,
} from "@/lib/mcp/parent-excuses";

export const runtime = "nodejs";

const oauthMeta = {
  securitySchemes: [{ type: "oauth2", scopes: ["openid"] }],
} as const;

const childSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  gender: z.enum(["MALE", "FEMALE"]).nullable(),
});

const toolError = (error: unknown) => {
  const message =
    error instanceof McpParentError
      ? error.message
      : "Požadavek se nepodařilo bezpečně zpracovat. Zkuste to prosím znovu.";
  if (!(error instanceof McpParentError)) {
    console.error("Unexpected MCP tool error", error);
  }
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true as const,
  };
};

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "list_my_children",
      {
        title: "List my children",
        description:
          "List only the children the authenticated Habitat parent may submit excuses for. Use this before asking the parent to choose a child. Surnames are intentionally not returned.",
        inputSchema: z.object({}),
        outputSchema: z.object({ children: z.array(childSchema) }),
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
        _meta: oauthMeta,
      },
      async (_input, context) => {
        try {
          const profile = await getMcpParentProfile(
            getWorkosUserId(context.http?.authInfo),
          );
          const output = { children: profile.children };
          return {
            content: [{ type: "text", text: JSON.stringify(output) }],
            structuredContent: output,
          };
        } catch (error) {
          return toolError(error);
        }
      },
    );

    server.registerTool(
      "preview_excuse",
      {
        title: "Preview an excuse",
        description:
          "Validate a proposed Habitat attendance excuse and show the exact children, dates, reason, and affected school-day count. This does not create an excuse. Always show this preview to the parent and ask for explicit confirmation before calling create_excuse.",
        inputSchema: excusePreviewInputSchema,
        outputSchema: z.object({
          confirmationToken: z.string(),
          confirmationExpiresAt: z.string(),
          children: z.array(childSchema),
          fromDate: z.string(),
          toDate: z.string(),
          reason: z.string().nullable(),
          schoolDayCount: z.number().int().nonnegative(),
          confirmationRequired: z.literal(true),
        }),
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
        _meta: oauthMeta,
      },
      async (input, context) => {
        try {
          const output = await previewMcpExcuse(
            getWorkosUserId(context.http?.authInfo),
            input,
          );
          const names = output.children.map((child) => child.firstName).join(", ");
          return {
            content: [
              {
                type: "text",
                text: `Náhled omluvenky pro ${names}: ${output.fromDate} až ${output.toDate}, důvod: ${output.reason ?? "neuveden"}. Před uložením vyžádejte výslovné potvrzení rodiče.`,
              },
            ],
            structuredContent: output,
          };
        } catch (error) {
          return toolError(error);
        }
      },
    );

    server.registerTool(
      "create_excuse",
      {
        title: "Create an excuse",
        description:
          "Create the exact Habitat excuse represented by a fresh preview token. Call only after the parent explicitly confirms the preview. Reusing the same token is safe and returns the original result instead of creating duplicates.",
        inputSchema: z.object({
          confirmationToken: z.string().min(1).max(4096),
        }),
        outputSchema: z.object({
          replayed: z.boolean(),
          excuses: z.array(
            z.object({
              id: z.string(),
              childId: z.string(),
              fromDate: z.string(),
              toDate: z.string(),
            }),
          ),
          summary: z.object({
            schoolDayCount: z.number().int().nonnegative(),
            lateDayCount: z.number().int().nonnegative(),
            onTimeDayCount: z.number().int().nonnegative(),
            automaticallyApprovedDayCount: z.number().int().nonnegative(),
          }),
        }),
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
        _meta: {
          ...oauthMeta,
          "openai/toolInvocation/invoking": "Ukládám omluvenku…",
          "openai/toolInvocation/invoked": "Omluvenka byla uložena",
        },
      },
      async ({ confirmationToken }, context) => {
        try {
          const output = await createMcpExcuse(
            getWorkosUserId(context.http?.authInfo),
            confirmationToken,
          );
          return {
            content: [
              {
                type: "text",
                text: output.replayed
                  ? "Omluvenka už byla uložena dříve; vracím původní výsledek."
                  : "Omluvenka byla bezpečně uložena.",
              },
            ],
            structuredContent: output,
          };
        } catch (error) {
          return toolError(error);
        }
      },
    );
  },
  {
    serverInfo: { name: "habitat-parent-excuses", version: "0.1.0" },
    instructions:
      "Use only for the authenticated parent's own children. Preview every excuse and obtain explicit parent confirmation before creating it.",
    maxSubscriptions: 0,
  },
);

let authenticatedHandler: ReturnType<typeof withMcpAuth> | undefined;

const getAuthenticatedHandler = (): ReturnType<typeof withMcpAuth> => {
  authenticatedHandler ??= withMcpAuth(handler, verifyMcpToken, {
    required: true,
    requiredScopes: ["openid"],
    resourceUrl: getMcpResourceOrigin(),
  });
  return authenticatedHandler;
};

export async function GET(request: Request): Promise<Response> {
  return await getAuthenticatedHandler()(request);
}

export async function POST(request: Request): Promise<Response> {
  return await getAuthenticatedHandler()(request);
}
