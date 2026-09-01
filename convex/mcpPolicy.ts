const DAY_MS = 24 * 60 * 60 * 1000;

export const MCP_MAX_CHILDREN = 10;
export const MCP_MAX_REASON_LENGTH = 500;
export const MCP_WRITE_LIMIT_PER_HOUR = 10;

export function validateMcpExcuseInput(input: {
  readonly requestId: string;
  readonly childIds: ReadonlyArray<string>;
  readonly fromDate: number;
  readonly toDate: number;
  readonly reason: string | null;
}): string[] {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestId)) {
    throw new Error("Invalid MCP request ID");
  }

  const childIds = [...new Set(input.childIds.filter(Boolean))];
  if (childIds.length === 0 || childIds.length !== input.childIds.length) {
    throw new Error("Invalid MCP child selection");
  }
  if (childIds.length > MCP_MAX_CHILDREN) {
    throw new Error("Too many children selected");
  }
  if (!Number.isFinite(input.fromDate) || !Number.isFinite(input.toDate)) {
    throw new Error("Invalid MCP date range");
  }
  if (input.toDate < input.fromDate || input.toDate - input.fromDate > 30 * DAY_MS) {
    throw new Error("Invalid MCP date range");
  }
  if (input.reason !== null && input.reason.length > MCP_MAX_REASON_LENGTH) {
    throw new Error("MCP excuse reason is too long");
  }

  return childIds;
}

export function buildMcpRecordId(
  kind: "excuse" | "audit",
  requestId: string,
  index: number,
): string {
  return `id_mcp_${kind}_${requestId.replaceAll("-", "")}_${index}`;
}
