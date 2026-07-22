import React, { useCallback, useEffect, useMemo, useReducer } from "react";
import { Pressable, Text, View, type PressableStateCallbackType } from "react-native";
import { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { useTranslation } from "react-i18next";
import { Check, CircleAlert, History } from "lucide-react-native";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
import { AdaptiveModalSheet, type SheetHeader } from "@/components/adaptive-modal-sheet";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { ChatHistoryContextAttachment } from "@/attachments/types";
import { getChatHistorySourceKey } from "@/attachments/chat-history-identity";
import { getProviderIcon } from "@/components/provider-icons";
import { useAgentHistory, type AgentHistoryUnavailableHost } from "@/hooks/use-agent-history";
import { useProviderSessionHistory } from "@/hooks/use-provider-session-history";
import { getHostRuntimeStore } from "@/runtime/host-runtime";
import { useHostFeatureMap } from "@/runtime/host-features";
import { formatTimeAgo } from "@/utils/time";
import {
  buildTranscriptSourceGroups,
  INITIAL_TRANSCRIPT_PICKER_STATE,
  MAX_TRANSCRIPT_ATTACHMENTS,
  reduceTranscriptPickerState,
  selectTranscriptUnavailableHosts,
  type TranscriptDestination,
  type TranscriptSourceGroupKind,
} from "@/components/add-transcripts-sheet-view-model";
import { exportSelectedTranscripts } from "@/components/add-transcripts-export";
import {
  getTranscriptSourceExportAvailability,
  getTranscriptExportSourceKey,
  getTranscriptExportSourceLastActivity,
  getTranscriptExportSourceProvider,
  getTranscriptExportSourceServerId,
  getTranscriptExportSourceServerLabel,
  getTranscriptExportSourceTitle,
  getTranscriptExportSourceWorkspaceLabel,
  type TranscriptExportSource,
  type TranscriptSourceExportAvailability,
} from "@/components/transcript-source";
import { ICON_SIZE, type Theme } from "@/styles/theme";
import { useIsCompactFormFactor } from "@/constants/layout";
import { isNative } from "@/constants/platform";

const ThemedCheck = withUnistyles(Check);
const ThemedCircleAlert = withUnistyles(CircleAlert);
const ThemedHistory = withUnistyles(History);
const ThemedLoadingSpinner = withUnistyles(LoadingSpinner);
const TRANSCRIPT_SHEET_SNAP_POINTS = ["72%", "92%"];
const mutedColorMapping = (theme: Theme) => ({ color: theme.colors.foregroundMuted });
const destructiveColorMapping = (theme: Theme) => ({ color: theme.colors.destructive });
const accentForegroundColorMapping = (theme: Theme) => ({ color: theme.colors.accentForeground });

interface DynamicProviderIconProps {
  provider: string;
  size: number;
  color?: string;
}

function DynamicProviderIcon({ provider, size, color = "" }: DynamicProviderIconProps) {
  const Icon = getProviderIcon(provider);
  return <Icon size={size} color={color} />;
}

const ThemedDynamicProviderIcon = withUnistyles(DynamicProviderIcon);

interface AddTranscriptsSheetProps {
  visible: boolean;
  destination: TranscriptDestination;
  existingAttachments: readonly ChatHistoryContextAttachment[];
  onClose: () => void;
  onAddTranscript: (attachment: ChatHistoryContextAttachment) => void;
}

function sourceGroupLabel(
  kind: TranscriptSourceGroupKind | "provider_session",
  t: ReturnType<typeof useTranslation>["t"],
): string {
  if (kind === "workspace") {
    return t("addTranscripts.groups.thisWorkspace");
  }
  if (kind === "project") {
    return t("addTranscripts.groups.otherWorkspaces");
  }
  if (kind === "repository") {
    return t("addTranscripts.groups.sameRepository");
  }
  if (kind === "provider_session") {
    return t("addTranscripts.groups.externalSessions");
  }
  return t("addTranscripts.groups.otherProjects");
}

function buildSourceMeta(source: TranscriptExportSource): string {
  const parts = [
    getTranscriptExportSourceProvider(source),
    getTranscriptExportSourceWorkspaceLabel(source),
  ];
  const serverLabel = getTranscriptExportSourceServerLabel(source);
  if (serverLabel.trim()) {
    parts.push(serverLabel);
  }
  return parts.join(" · ");
}

function TranscriptProviderIcon({ provider }: { provider: string }) {
  return (
    <ThemedDynamicProviderIcon
      provider={provider}
      size={ICON_SIZE.md}
      uniProps={mutedColorMapping}
    />
  );
}

function TranscriptSourceRow({
  source,
  selected,
  disabled,
  availability,
  error,
  onToggle,
}: {
  source: TranscriptExportSource;
  selected: boolean;
  disabled: boolean;
  availability: TranscriptSourceExportAvailability;
  error: string | null;
  onToggle: (source: TranscriptExportSource) => void;
}) {
  const { t } = useTranslation();
  const toggleSource = onToggle;
  const title = getTranscriptExportSourceTitle(source);
  let availabilityNotice: string | null = null;
  if (availability === "host_upgrade_required") {
    availabilityNotice = t("addTranscripts.status.updateHost");
  } else if (availability === "source_unavailable") {
    availabilityNotice = t("addTranscripts.status.providerSessionUnavailable");
  }
  let statusNotice: string | null = null;
  if (error) {
    statusNotice = error;
  } else if (availabilityNotice) {
    statusNotice = availabilityNotice;
  } else if (source.kind === "paseo_agent" && source.agent.status === "running") {
    statusNotice = t("addTranscripts.status.runningSnapshot");
  }
  const accessibilityLabel = [title, buildSourceMeta(source), statusNotice]
    .filter((value): value is string => Boolean(value))
    .join(". ");
  const accessibilityState = useMemo(() => ({ checked: selected, disabled }), [disabled, selected]);
  const pressableStyle = useCallback(
    ({ pressed, hovered = false }: PressableStateCallbackType & { hovered?: boolean }) => [
      styles.row,
      (Boolean(hovered) || selected) && styles.rowHovered,
      pressed && styles.rowPressed,
      disabled && styles.rowDisabled,
    ],
    [disabled, selected],
  );
  const selectionControlStyle = useMemo(
    () => [styles.selectionControl, selected && styles.selectionControlSelected],
    [selected],
  );
  const handlePress = useCallback(() => {
    toggleSource(source);
  }, [source, toggleSource]);

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      aria-checked={selected}
      disabled={disabled}
      onPress={handlePress}
      style={pressableStyle}
      testID={
        source.kind === "paseo_agent"
          ? `add-transcripts-source-${source.agent.serverId}-${source.agent.id}`
          : `add-transcripts-provider-session-${source.session.serverId}-${encodeURIComponent(source.session.providerId)}-${encodeURIComponent(source.session.providerHandleId)}`
      }
    >
      <View style={selectionControlStyle}>
        {selected ? <ThemedCheck size={12} uniProps={accentForegroundColorMapping} /> : null}
      </View>
      <View style={styles.rowIconWrap}>
        <TranscriptProviderIcon provider={getTranscriptExportSourceProvider(source)} />
      </View>
      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.rowTime}>
            {formatTimeAgo(getTranscriptExportSourceLastActivity(source))}
          </Text>
        </View>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {buildSourceMeta(source)}
        </Text>
        {availabilityNotice ? <Text style={styles.rowNotice}>{availabilityNotice}</Text> : null}
        {!availabilityNotice &&
        source.kind === "paseo_agent" &&
        source.agent.status === "running" ? (
          <Text style={styles.rowNotice}>{t("addTranscripts.status.runningSnapshot")}</Text>
        ) : null}
        {error ? (
          <Text style={styles.rowError} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function SelectionStatus({
  isLoading,
  isError,
  hasSources,
  hasAnySources,
  hasQuery,
  hasUnavailableHosts,
  onRefresh,
}: {
  isLoading: boolean;
  isError: boolean;
  hasSources: boolean;
  hasAnySources: boolean;
  hasQuery: boolean;
  hasUnavailableHosts: boolean;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  if (isLoading) {
    return (
      <View style={styles.statusRow} testID="add-transcripts-loading">
        <ThemedLoadingSpinner size={ICON_SIZE.md} uniProps={mutedColorMapping} />
        <Text style={styles.statusText}>{t("addTranscripts.status.loading")}</Text>
      </View>
    );
  }
  if (isError) {
    return (
      <View style={styles.statusRow} testID="add-transcripts-error">
        <ThemedCircleAlert size={ICON_SIZE.md} uniProps={destructiveColorMapping} />
        <Text style={styles.errorText}>{t("addTranscripts.status.failedToLoad")}</Text>
        <Button size="xs" variant="ghost" onPress={onRefresh}>
          {t("common.actions.retry")}
        </Button>
      </View>
    );
  }
  if (!hasSources && !hasUnavailableHosts) {
    return (
      <View style={styles.emptyState} testID="add-transcripts-empty">
        <ThemedHistory size={ICON_SIZE.lg} uniProps={mutedColorMapping} strokeWidth={1.5} />
        <Text style={styles.emptyStateTitle}>
          {hasAnySources && hasQuery
            ? t("addTranscripts.status.noMatches")
            : t("addTranscripts.status.noTranscripts")}
        </Text>
      </View>
    );
  }
  return null;
}

type TranscriptDisplayGroupKind = TranscriptSourceGroupKind | "provider_session";

interface TranscriptDisplayGroup {
  kind: TranscriptDisplayGroupKind;
  sources: readonly TranscriptExportSource[];
}

function doesTranscriptSourceMatchQuery(
  source: TranscriptExportSource,
  normalizedQuery: string,
): boolean {
  if (!normalizedQuery) {
    return true;
  }
  const searchableValues = [
    getTranscriptExportSourceTitle(source),
    getTranscriptExportSourceProvider(source),
    getTranscriptExportSourceWorkspaceLabel(source),
    getTranscriptExportSourceServerLabel(source),
  ];
  for (const value of searchableValues) {
    if (value.toLocaleLowerCase().includes(normalizedQuery)) {
      return true;
    }
  }
  return false;
}

function filterTranscriptDisplayGroups(
  groups: readonly TranscriptDisplayGroup[],
  query: string,
): TranscriptDisplayGroup[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredGroups: TranscriptDisplayGroup[] = [];
  for (const group of groups) {
    const sources: TranscriptExportSource[] = [];
    for (const source of group.sources) {
      if (doesTranscriptSourceMatchQuery(source, normalizedQuery)) {
        sources.push(source);
      }
    }
    if (sources.length > 0) {
      filteredGroups.push({ kind: group.kind, sources });
    }
  }
  return filteredGroups;
}

type TranscriptListItem =
  | { kind: "group"; key: string; groupKind: TranscriptDisplayGroupKind }
  | { kind: "source"; key: string; source: TranscriptExportSource };

function TranscriptPickerList({
  groups,
  selection,
  errorsBySource,
  sourceExportAvailability,
  isAdding,
  onToggleSource,
  virtualized,
  header,
  footer,
}: {
  groups: readonly TranscriptDisplayGroup[];
  selection: readonly string[];
  errorsBySource: Readonly<Record<string, string>>;
  sourceExportAvailability: ReadonlyMap<string, TranscriptSourceExportAvailability>;
  isAdding: boolean;
  onToggleSource: (source: TranscriptExportSource) => void;
  virtualized: boolean;
  header: React.ReactNode;
  footer: React.ReactNode;
}) {
  const { t } = useTranslation();
  const items = useMemo<TranscriptListItem[]>(
    () =>
      groups.flatMap((group) => [
        { kind: "group" as const, key: `group:${group.kind}`, groupKind: group.kind },
        ...group.sources.map((source) => ({
          kind: "source" as const,
          key: getTranscriptExportSourceKey(source),
          source,
        })),
      ]),
    [groups],
  );
  const renderSource = useCallback(
    (source: TranscriptExportSource) => {
      const key = getTranscriptExportSourceKey(source);
      const availability = sourceExportAvailability.get(key) ?? "host_upgrade_required";
      const unavailable = availability !== "available";
      return (
        <TranscriptSourceRow
          source={source}
          selected={selection.includes(key)}
          disabled={isAdding || (unavailable && !selection.includes(key))}
          availability={availability}
          error={errorsBySource[key] ?? null}
          onToggle={onToggleSource}
        />
      );
    },
    [errorsBySource, isAdding, onToggleSource, selection, sourceExportAvailability],
  );
  const renderItem = useCallback(
    ({ item }: { item: TranscriptListItem }) =>
      item.kind === "group" ? (
        <Text style={styles.virtualizedGroupTitle}>{sourceGroupLabel(item.groupKind, t)}</Text>
      ) : (
        renderSource(item.source)
      ),
    [renderSource, t],
  );
  const keyExtractor = useCallback((item: TranscriptListItem) => item.key, []);
  const listHeaderComponent = useMemo(
    () => <View style={styles.listHeader}>{header}</View>,
    [header],
  );
  const listFooterComponent = useMemo(
    () => <View style={styles.listFooter}>{footer}</View>,
    [footer],
  );

  if (virtualized) {
    return (
      <BottomSheetFlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        style={styles.virtualizedList}
        contentContainerStyle={styles.virtualizedListContent}
        ListHeaderComponent={listHeaderComponent}
        ListFooterComponent={listFooterComponent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        initialNumToRender={18}
        maxToRenderPerBatch={16}
        windowSize={7}
      />
    );
  }

  return (
    <>
      {header}
      <View style={styles.list}>
        {groups.map((group) => (
          <View key={group.kind} style={styles.group}>
            <Text style={styles.groupTitle}>{sourceGroupLabel(group.kind, t)}</Text>
            {group.sources.map((source) => (
              <View key={getTranscriptExportSourceKey(source)}>{renderSource(source)}</View>
            ))}
          </View>
        ))}
      </View>
      {footer}
    </>
  );
}

function UnavailableHostsNotice({
  hosts,
  onRefresh,
}: {
  hosts: readonly AgentHistoryUnavailableHost[];
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  if (hosts.length === 0) {
    return null;
  }
  const canRetry = hosts.some((host) => host.reason === "history_failed");

  return (
    <Alert
      variant="warning"
      description={t("addTranscripts.status.hostsUnavailable", {
        hosts: hosts.map((host) => host.serverLabel).join(", "),
      })}
      testID="add-transcripts-unavailable-hosts"
    >
      {canRetry ? (
        <Button size="sm" variant="outline" onPress={onRefresh}>
          {t("common.actions.retry")}
        </Button>
      ) : null}
    </Alert>
  );
}

export function AddTranscriptsSheet({
  visible,
  destination,
  existingAttachments,
  onClose,
  onAddTranscript,
}: AddTranscriptsSheetProps) {
  const { t } = useTranslation();
  const useVirtualizedList = useIsCompactFormFactor() && isNative;
  const history = useAgentHistory({ enabled: visible });
  const providerSessionHistory = useProviderSessionHistory({ enabled: visible });
  const [pickerState, dispatchPicker] = useReducer(
    reduceTranscriptPickerState,
    INITIAL_TRANSCRIPT_PICKER_STATE,
  );
  const { query, selection, errorsBySource, selectionError, isAdding, searchResetKey } =
    pickerState;

  const agentGroups = useMemo(
    () => buildTranscriptSourceGroups({ agents: history.agents, destination, query: "" }),
    [destination, history.agents],
  );
  const allGroups = useMemo<TranscriptDisplayGroup[]>(
    () => [
      ...agentGroups.map((group) => ({
        kind: group.kind,
        sources: group.agents.map((agent) => ({ kind: "paseo_agent" as const, agent })),
      })),
      ...(providerSessionHistory.entries.length > 0
        ? [
            {
              kind: "provider_session" as const,
              sources: providerSessionHistory.entries.map((session) => ({
                kind: "provider_session" as const,
                session,
              })),
            },
          ]
        : []),
    ],
    [agentGroups, providerSessionHistory.entries],
  );
  const groups = useMemo(() => filterTranscriptDisplayGroups(allGroups, query), [allGroups, query]);
  const agentSourceServerIds = useMemo(
    () => [...new Set(history.agents.map((agent) => agent.serverId))],
    [history.agents],
  );
  const providerSessionSourceServerIds = useMemo(
    () => [...new Set(providerSessionHistory.entries.map((session) => session.serverId))],
    [providerSessionHistory.entries],
  );
  const agentSupportsTranscriptExport = useHostFeatureMap(
    agentSourceServerIds,
    "agentTranscriptExport",
  );
  const providerSessionSupportsTranscriptExport = useHostFeatureMap(
    providerSessionSourceServerIds,
    "providerSessionTranscriptExport",
  );
  const sourceExportAvailability = useMemo(() => {
    const availabilityBySourceKey = new Map<string, TranscriptSourceExportAvailability>();
    for (const group of allGroups) {
      for (const source of group.sources) {
        const serverId = getTranscriptExportSourceServerId(source);
        const hostSupportsTranscriptExport =
          source.kind === "paseo_agent"
            ? agentSupportsTranscriptExport.get(serverId)
            : providerSessionSupportsTranscriptExport.get(serverId);
        availabilityBySourceKey.set(
          getTranscriptExportSourceKey(source),
          getTranscriptSourceExportAvailability(source, hostSupportsTranscriptExport),
        );
      }
    }
    return availabilityBySourceKey;
  }, [agentSupportsTranscriptExport, allGroups, providerSessionSupportsTranscriptExport]);
  const unavailableHosts = useMemo(() => {
    const mergedByServerId = new Map(
      history.unavailableHosts.map((host) => [host.serverId, host] as const),
    );
    for (const host of providerSessionHistory.unavailableHosts) {
      if (!mergedByServerId.has(host.serverId)) {
        mergedByServerId.set(host.serverId, host);
      }
    }
    return selectTranscriptUnavailableHosts({
      hosts: [...mergedByServerId.values()],
      destinationServerId: destination.serverId,
    });
  }, [destination.serverId, history.unavailableHosts, providerSessionHistory.unavailableHosts]);
  const sourcesByKey = useMemo(() => {
    const entries = allGroups.flatMap((group) => group.sources);
    return new Map(entries.map((source) => [getTranscriptExportSourceKey(source), source]));
  }, [allGroups]);
  const existingSourceKeys = useMemo(
    () =>
      new Set(existingAttachments.map((attachment) => getChatHistorySourceKey(attachment.source))),
    [existingAttachments],
  );
  const selectedSources = useMemo(
    () =>
      selection.flatMap((key) => {
        const source = sourcesByKey.get(key);
        return source ? [source] : [];
      }),
    [selection, sourcesByKey],
  );

  useEffect(() => {
    if (!visible && !isAdding) {
      dispatchPicker({ type: "reset" });
    }
  }, [isAdding, visible]);

  const handleClose = useCallback(() => {
    if (!isAdding) {
      onClose();
    }
  }, [isAdding, onClose]);

  const handleToggleSource = useCallback(
    (source: TranscriptExportSource) => {
      dispatchPicker({
        type: "toggle_source",
        key: getTranscriptExportSourceKey(source),
        existingSourceKeys,
        maximumError: t("addTranscripts.status.maximumSelected", {
          count: MAX_TRANSCRIPT_ATTACHMENTS,
        }),
      });
    },
    [existingSourceKeys, t],
  );

  const handleSearchChange = useCallback((value: string) => {
    dispatchPicker({ type: "set_query", query: value });
  }, []);

  const header = useMemo<SheetHeader>(
    () => ({
      title: t("addTranscripts.title"),
      subtitle: <Text style={styles.headerSubtitle}>{t("addTranscripts.subtitle")}</Text>,
      search: {
        onChange: handleSearchChange,
        resetKey: searchResetKey,
        placeholder: t("addTranscripts.searchPlaceholder"),
        testID: "add-transcripts-search",
      },
    }),
    [handleSearchChange, searchResetKey, t],
  );

  const handleAdd = useCallback(async () => {
    if (selectedSources.length === 0 || isAdding) {
      return;
    }
    dispatchPicker({ type: "start_add" });
    const runtime = getHostRuntimeStore();
    const result = await exportSelectedTranscripts({
      sources: selectedSources,
      existingAttachments,
      getClient: (serverId) => runtime.getClient(serverId),
      messages: {
        updateHost: t("addTranscripts.status.updateHost"),
        unavailable: t("addTranscripts.status.unavailable"),
        exportFailed: t("addTranscripts.status.exportFailed"),
        totalTooLarge: t("addTranscripts.status.totalTooLarge"),
        maximumSelected: t("addTranscripts.status.maximumSelected", {
          count: MAX_TRANSCRIPT_ATTACHMENTS,
        }),
        attachmentTitle: (title) => t("addTranscripts.attachmentTitle", { title }),
      },
    });
    for (const attachment of result.attachments) {
      onAddTranscript(attachment);
    }

    dispatchPicker({
      type: "finish_add",
      errorsBySource: result.errorsBySource,
      successfulKeys: result.successfulKeys,
    });
    if (Object.keys(result.errorsBySource).length === 0) {
      onClose();
    }
  }, [existingAttachments, isAdding, onAddTranscript, onClose, selectedSources, t]);

  const handleAddPress = useCallback(() => {
    void handleAdd();
  }, [handleAdd]);
  const refreshAgentHistory = history.refreshAll;
  const refreshProviderSessionHistory = providerSessionHistory.refresh;
  const handleRefresh = useCallback(() => {
    void Promise.all([refreshAgentHistory(), refreshProviderSessionHistory()]);
  }, [refreshAgentHistory, refreshProviderSessionHistory]);

  const hasSources = groups.length > 0;
  const listHeader = useMemo(
    () => (
      <>
        <Alert
          variant="info"
          description={t("addTranscripts.status.transcriptOnlyDisclosure")}
          testID="add-transcripts-transcript-only-disclosure"
        />
        <UnavailableHostsNotice hosts={unavailableHosts} onRefresh={handleRefresh} />
        <SelectionStatus
          isLoading={history.isInitialLoad || providerSessionHistory.isInitialLoad}
          isError={history.isError || providerSessionHistory.isError}
          hasSources={hasSources}
          hasAnySources={allGroups.length > 0}
          hasQuery={query.trim().length > 0}
          hasUnavailableHosts={unavailableHosts.length > 0}
          onRefresh={handleRefresh}
        />
        {selectionError ? (
          <Text style={styles.selectionError} accessibilityLiveRegion="polite">
            {selectionError}
          </Text>
        ) : null}
      </>
    ),
    [
      allGroups.length,
      handleRefresh,
      hasSources,
      history.isError,
      history.isInitialLoad,
      providerSessionHistory.isError,
      providerSessionHistory.isInitialLoad,
      query,
      selectionError,
      t,
      unavailableHosts,
    ],
  );
  const listFooter = useMemo(
    () =>
      history.hasMore ? (
        <View style={styles.loadMoreRow}>
          <Button
            size="sm"
            variant="ghost"
            onPress={history.loadMore}
            loading={history.isLoadingMore}
            disabled={history.isLoadingMore}
          >
            {t("addTranscripts.actions.loadMore")}
          </Button>
        </View>
      ) : null,
    [history.hasMore, history.isLoadingMore, history.loadMore, t],
  );
  const footer = useMemo(
    () => (
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {t("addTranscripts.selection.count", { count: selectedSources.length })}
        </Text>
        <Button
          variant="default"
          onPress={handleAddPress}
          disabled={selectedSources.length === 0 || isAdding}
          loading={isAdding}
          testID="add-transcripts-confirm"
        >
          {isAdding ? t("addTranscripts.actions.adding") : t("addTranscripts.actions.add")}
        </Button>
      </View>
    ),
    [handleAddPress, isAdding, selectedSources.length, t],
  );

  return (
    <AdaptiveModalSheet
      visible={visible}
      onClose={handleClose}
      dismissible={!isAdding}
      header={header}
      footer={footer}
      testID="add-transcripts-sheet"
      desktopMaxWidth={600}
      snapPoints={TRANSCRIPT_SHEET_SNAP_POINTS}
      scrollable={!useVirtualizedList}
    >
      <TranscriptPickerList
        groups={groups}
        selection={selection}
        errorsBySource={errorsBySource}
        sourceExportAvailability={sourceExportAvailability}
        isAdding={isAdding}
        onToggleSource={handleToggleSource}
        virtualized={useVirtualizedList}
        header={listHeader}
        footer={listFooter}
      />
    </AdaptiveModalSheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  headerSubtitle: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
    marginTop: theme.spacing[1],
  },
  list: {
    gap: theme.spacing[4],
  },
  virtualizedList: {
    flex: 1,
  },
  virtualizedListContent: {
    paddingBottom: theme.spacing[6],
  },
  listHeader: {
    gap: theme.spacing[4],
  },
  listFooter: {
    paddingTop: theme.spacing[2],
  },
  group: {
    gap: theme.spacing[1],
  },
  groupTitle: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: theme.spacing[2],
  },
  virtualizedGroupTitle: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: theme.spacing[2],
    paddingTop: theme.spacing[4],
    paddingBottom: theme.spacing[1],
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing[2],
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[2],
    marginHorizontal: -theme.spacing[2],
    borderRadius: theme.borderRadius.lg,
  },
  rowHovered: {
    backgroundColor: theme.colors.surface1,
  },
  rowPressed: {
    backgroundColor: theme.colors.surface2,
  },
  rowDisabled: {
    opacity: theme.opacity[50],
  },
  selectionControl: {
    width: 18,
    height: 18,
    marginTop: 2,
    borderWidth: theme.borderWidth[1],
    borderRadius: theme.borderRadius.sm,
    borderColor: theme.colors.foregroundMuted,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  selectionControlSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accent,
  },
  rowIconWrap: {
    width: theme.iconSize.md,
    paddingTop: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  rowContent: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing[1],
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: theme.spacing[2],
  },
  rowTitle: {
    flex: 1,
    minWidth: 0,
    color: theme.colors.foreground,
    fontSize: theme.fontSize.base,
  },
  rowTime: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.xs,
  },
  rowMeta: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
  },
  rowNotice: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.xs,
  },
  rowError: {
    color: theme.colors.destructive,
    fontSize: theme.fontSize.xs,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    paddingVertical: theme.spacing[2],
  },
  statusText: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
  },
  errorText: {
    flex: 1,
    color: theme.colors.destructive,
    fontSize: theme.fontSize.sm,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing[2],
    paddingVertical: theme.spacing[8],
    paddingHorizontal: theme.spacing[4],
  },
  emptyStateTitle: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
  },
  selectionError: {
    color: theme.colors.destructive,
    fontSize: theme.fontSize.sm,
    marginBottom: theme.spacing[2],
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing[3],
  },
  footerText: {
    flex: 1,
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
  },
  loadMoreRow: {
    alignItems: "center",
    paddingTop: theme.spacing[4],
  },
}));
