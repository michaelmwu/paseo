import React, { act, useCallback, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { within } from "@testing-library/dom";
import { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import type { AgentPlanReviewAction } from "@getpaseo/protocol/messages";
import { i18n } from "@/i18n/i18next";
import { PlanReviewForm } from "./plan-review-form";

void i18n;
let root: Root;
let container: HTMLDivElement;
let client: DaemonClient;
const permission = {
  key: "agent:proposal",
  agentId: "agent",
  request: {
    id: "proposal",
    provider: "codex" as const,
    kind: "plan" as const,
    name: "CodexPlanApproval",
    input: { plan: "Preserve the original text." },
  },
};

beforeEach(() => {
  vi.stubGlobal("React", React);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  client = new DaemonClient({
    url: "ws://unused-test-transport",
    clientId: "plan-form",
    reconnect: { enabled: false },
  });
});
afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  await client.close();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mount({ compact = false, awaiting = true, initialDraft = "" } = {}) {
  const closed = vi.fn();
  const success = vi.fn();
  function Harness() {
    const [draft, setDraft] = useState(initialDraft);
    const [visible, setVisible] = useState(true);
    const [action, setAction] = useState<AgentPlanReviewAction>("request_changes");
    const reopen = useCallback(() => {
      setAction("implement_with_notes");
      setVisible(true);
    }, []);
    const close = useCallback(() => {
      closed();
      setVisible(false);
    }, []);
    return (
      <>
        <button type="button" onClick={reopen}>
          Reopen with implementation notes
        </button>
        {visible ? (
          <PlanReviewForm
            permission={permission}
            client={client}
            isAwaitingReview={awaiting}
            isCompact={compact}
            primaryAction={action}
            draft={draft}
            onChangeDraft={setDraft}
            onClose={close}
            onSubmitSuccess={success}
          />
        ) : null}
      </>
    );
  }
  act(() => root.render(<Harness />));
  return { closed, success };
}

test.each([false, true])(
  "preserves a shared draft across failure, cancel and action choice (compact=%s)",
  async (compact) => {
    const review = vi
      .spyOn(client, "reviewAgentPlan")
      .mockRejectedValueOnce(new Error("Try again with your notes."))
      .mockResolvedValueOnce(undefined);
    const { closed, success } = mount({ compact });
    const input = page.getByTestId("plan-review-input");
    const changes = page.getByTestId("plan-review-submit-changes");
    const implementation = page.getByTestId("plan-review-submit-implementation");
    await expect.element(changes).toBeDisabled();
    await expect.element(implementation).toBeDisabled();
    await input.fill("   ");
    await expect.element(changes).toBeDisabled();
    await input.fill("Keep all existing lines.");
    await changes.click();
    await expect
      .element(page.getByTestId("plan-review-error"))
      .toHaveTextContent("Try again with your notes.");
    await expect.element(input).toHaveValue("Keep all existing lines.");
    expect(success).not.toHaveBeenCalled();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(closed).toHaveBeenCalledOnce();
    expect(within(container).queryByTestId("plan-review-input")).toBeNull();
    await page.getByRole("button", { name: "Reopen with implementation notes" }).click();
    await expect.element(input).toHaveValue("Keep all existing lines.");
    await implementation.click();
    await expect.poll(() => success.mock.calls.length).toBe(1);
    expect(review.mock.calls).toEqual([
      [
        {
          agentId: "agent",
          permissionRequestId: "proposal",
          action: "request_changes",
          text: "Keep all existing lines.",
        },
      ],
      [
        {
          agentId: "agent",
          permissionRequestId: "proposal",
          action: "implement_with_notes",
          text: "Keep all existing lines.",
        },
      ],
    ]);
  },
);

test("a pending review disables editing, duplicate submission and cancel", async () => {
  let finish!: () => void;
  const review = vi.spyOn(client, "reviewAgentPlan").mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const { success } = mount({ initialDraft: "Apply these notes." });
  await page.getByTestId("plan-review-submit-implementation").click();
  await expect.element(page.getByTestId("plan-review-submit-changes")).toBeDisabled();
  await expect.element(page.getByTestId("plan-review-input")).toHaveAttribute("readonly");
  await expect.element(page.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
  expect(review).toHaveBeenCalledOnce();
  finish();
  await expect.poll(() => success.mock.calls.length).toBe(1);
});

test("a stale proposal retains notes and blocks submission", async () => {
  const review = vi.spyOn(client, "reviewAgentPlan");
  mount({ awaiting: false, initialDraft: "Do not lose these notes." });
  await expect
    .element(page.getByTestId("plan-review-error"))
    .toHaveTextContent(i18n.t("agentStream.permission.stalePlan"));
  await expect
    .element(page.getByTestId("plan-review-input"))
    .toHaveValue("Do not lose these notes.");
  await expect.element(page.getByTestId("plan-review-submit-implementation")).toBeDisabled();
  expect(review).not.toHaveBeenCalled();
});
