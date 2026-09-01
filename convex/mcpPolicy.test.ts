import { describe, expect, it } from "vitest";
import {
  buildMcpRecordId,
  MCP_MAX_REASON_LENGTH,
  validateMcpExcuseInput,
} from "./mcpPolicy";

const validInput = {
  requestId: "123e4567-e89b-42d3-a456-426614174000",
  childIds: ["child-1", "child-2"],
  fromDate: Date.UTC(2026, 8, 1),
  toDate: Date.UTC(2026, 8, 30),
  reason: "Nemoc",
} as const;

describe("MCP excuse policy", () => {
  it("accepts a unique selection and stable request ID", () => {
    expect(validateMcpExcuseInput(validInput)).toEqual(["child-1", "child-2"]);
    expect(buildMcpRecordId("excuse", validInput.requestId, 1)).toBe(
      "id_mcp_excuse_123e4567e89b42d3a456426614174000_1",
    );
  });

  it("rejects duplicate children and ranges longer than 30 days", () => {
    expect(() =>
      validateMcpExcuseInput({ ...validInput, childIds: ["child-1", "child-1"] }),
    ).toThrow("Invalid MCP child selection");
    expect(() =>
      validateMcpExcuseInput({
        ...validInput,
        toDate: validInput.fromDate + 31 * 24 * 60 * 60 * 1000,
      }),
    ).toThrow("Invalid MCP date range");
  });

  it("rejects unbounded text", () => {
    expect(() =>
      validateMcpExcuseInput({
        ...validInput,
        reason: "x".repeat(MCP_MAX_REASON_LENGTH + 1),
      }),
    ).toThrow("MCP excuse reason is too long");
  });
});
