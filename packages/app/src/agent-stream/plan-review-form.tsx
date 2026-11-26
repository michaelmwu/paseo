import { useCallback, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native-unistyles";
import type { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import type { AgentPlanReviewAction } from "@getpaseo/protocol/messages";
import { Button } from "@/components/ui/button";
import { EditingTextInput } from "@/components/ui/text-input";
import type { PendingPermission } from "@/types/shared";

export const planReviewLabelKey = {
  request_changes: "agentStream.permission.requestChanges",
  implement_with_notes: "agentStream.permission.implementWithNotes",
} as const;

export function PlanReviewForm({
  action,
  permission,
  client,
  isAwaitingReview,
  onClose,
}: {
  action: AgentPlanReviewAction;
  permission: PendingPermission;
  client: DaemonClient | null;
  isAwaitingReview: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);
  const label = t(planReviewLabelKey[action]);
  const placeholder = t(
    action === "request_changes"
      ? "agentStream.permission.revisionPlaceholder"
      : "agentStream.permission.implementationNotesPlaceholder",
  );
  const stale = !isAwaitingReview && !isSubmitting;
  const errorText = error ?? (stale ? t("agentStream.permission.stalePlan") : null);

  const submit = useCallback(async () => {
    if (submitting.current || !client || !isAwaitingReview || !text.trim()) return;
    submitting.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      await client.reviewAgentPlan({
        agentId: permission.agentId,
        permissionRequestId: permission.request.id,
        action,
        text,
      });
      onClose();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : t("agentStream.permission.planReviewFailed"),
      );
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  }, [action, client, isAwaitingReview, onClose, permission, t, text]);

  return (
    <View style={styles.form}>
      <EditingTextInput
        accessibilityLabel={placeholder}
        autoFocus
        multiline
        editable={!isSubmitting}
        placeholder={placeholder}
        onChangeText={setText}
        style={styles.input}
        testID="plan-review-input"
      />
      {errorText ? (
        <Text accessibilityRole="alert" style={styles.error} testID="plan-review-error">
          {errorText}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button size="sm" variant="ghost" onPress={onClose} disabled={isSubmitting}>
          {t("common.actions.cancel")}
        </Button>
        <Button
          size="sm"
          variant="default"
          onPress={submit}
          loading={isSubmitting}
          disabled={isSubmitting || stale || !client || !text.trim()}
          testID="plan-review-submit"
        >
          {label}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  form: {
    gap: theme.spacing[2],
  },
  input: {
    minHeight: 88,
    maxHeight: 192,
    padding: theme.spacing[2],
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.spacing[2],
    backgroundColor: theme.colors.surface2,
    color: theme.colors.foreground,
    fontSize: theme.fontSize.base,
    textAlignVertical: "top",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: theme.spacing[2],
  },
  error: {
    color: theme.colors.destructive,
    fontSize: theme.fontSize.sm,
  },
}));
