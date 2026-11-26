import { describe, expect, test } from "vitest";
import { SessionInboundMessageSchema, SessionOutboundMessageSchema } from "./messages.js";

describe("plan review messages", () => {
  const request = {
    type: "agent.plan.review.request",
    requestId: "request",
    agentId: "agent",
    permissionRequestId: "proposal",
    action: "request_changes",
    text: "Preserve existing lines.",
  };
  test.each(["request_changes", "implement_with_notes"])("accepts %s", (action) => {
    expect(SessionInboundMessageSchema.parse({ ...request, action })).toEqual({
      ...request,
      action,
    });
  });
  test.each(["approve", "", null])("rejects an unknown action %s", (action) => {
    expect(SessionInboundMessageSchema.safeParse({ ...request, action }).success).toBe(false);
  });
  test.each([null, "The plan has changed."])("accepts the correlated response %s", (error) => {
    const response = {
      type: "agent.plan.review.response",
      payload: { requestId: "request", agentId: "agent", error },
    };
    expect(SessionOutboundMessageSchema.parse(response)).toEqual(response);
  });
});
