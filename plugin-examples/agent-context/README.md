# Agent context plugin example

This plugin adds **Attach agent transcript** to the composer attachment menu. Search for an
existing agent across the app's connected Paseo hosts, then select it to add a durable transcript
snapshot to the draft. The snapshot remains usable after the source agent changes, the plugin is
removed, or the source host disconnects.

The client reads each connected host through its authenticated Paseo SDK connection. The generic attachment-source UI owns the
picker, pill, draft persistence, and submission; this plugin adds no composer-specific UI or
protocol fields. It marks the snapshot as chat history so Paseo places it before the new user
instruction.

Install it on Paseo 0.9.1 or newer:

```bash
paseo plugin add getpaseo/paseo:plugin-examples/agent-context
```

Turn on **Enable plugins** under **Settings → Plugins** before installing. Paseo plugins are trusted,
unsandboxed code; review a plugin and its updates before enabling it.

The plugin lists non-archived, top-level agents from every connected host. It captures
snapshots only after you enter a search, then includes user and assistant messages plus fixed
tool-kind markers. Reasoning, tool inputs and outputs, provider tool names, and subagent logs are
excluded. Each snapshot is limited to 128 KiB and keeps the most recent context when the retained
timeline is larger. Results show their source host, and the selected attachment keeps that identity
in its text.

Opening the picker does not read agent history. Enter a specific query before Paseo asks matching
agents for snapshots. Selecting a result puts that readable snapshot in the destination draft;
sending the prompt transfers it to the destination agent. On current 0.9 daemons, timeline retrieval
can hydrate an inactive retained provider session; it does not start a turn.

Install the plugin on the destination host. It does not need to be installed on source hosts because
the app already has authenticated connections to them.
