# dsh-token-breakdown-stats

[![dsh-plugin](https://img.shields.io/badge/dsh-plugin-247bbf)](https://github.com/topics/dsh-plugin)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-%3E%3D0.2.1--rc.2-4d6bfe)](https://github.com/deepseek-ai/deepseek-harness)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

English | [涓枃](README.zh.md)

A [dsh](https://github.com/deepseek-ai/deepseek-harness) plugin (`dsh-plugin`
topic) that replaces the composer-dock statistics pill so a session's token
total covers the **main agent plus every subagent it called**, with a
click-open breakdown by billing bucket, by subagent, and by model.

## Summary

The composer-dock statistics pill in a dsh session reports only the **main
agent's** token usage. When that agent delegates to subagents, every token the
subagents spend is invisible in the session footer.

This plugin replaces that pill so the footer reports the **session total 鈥?
main agent plus every subagent it called** 鈥?and its click-open dialog
itemizes the usage by billing bucket, by subagent, and by model.

## What changes

| | shipped pill | this plugin |
|---|---|---|
| Pill label | main-agent total + cache hit | **session total** (main + subagents) + cache hit + subagent count |
| Dialog | four billing buckets | buckets, main/subagent split, subagent aggregate, per-model rows |
| Time/activity pill | turns, steps, speed, timings | unchanged (reproduced) |

Subagents are reported as an **aggregate** everywhere: the pill shows how many
there were, and the dialog folds them into one block (count, how many are still
running, share of the session, and the summed buckets). No per-subagent rows 鈥?
a session can spawn dozens, and the per-child detail already lives in the
subagent catalog in the session header.

The dialog shows:

- **鎬荤敤閲?* 鈥?the four disjoint billing buckets (uncached input, cache read,
  cache write, output) plus cache hit, over the whole session tree.
- **涓?Agent** 鈥?the provider/model routes observed in the loaded turns, and
  that session's own buckets.
- **瀛?Agent锛圢锛?* 鈥?one aggregate block: how many were discovered, how many
  are still running, their share of the session total, and the folded buckets.
- **鎸夋ā鍨?* 鈥?per provider/model totals folded from the loaded turns.
- A friendly note when the session has not called any subagent yet.

## How it works

The composer statistics dock changed shape in DSH `0.2.1-rc.2`, so the plugin
mirrors whichever rows the shipped `ui-chat` bundle registers:

| DSH | Shipped `conversation.composer.dock` rows | This plugin registers |
|---|---|---|
| `0.2.0-rc.2` | one cell, id `stats`, order 0 | (single-cell form, `StatsPills`) |
| `0.2.1-rc.2` | `activity` order 0 **and** `usage` order 1 | `activity` order 0 **and** `usage` order 1 |

A list slot matches a registration to a shipped row by **id + priority**: the
lowest priority for a given id renders, so reusing the shipped id at a strictly
lower `priority` **replaces** that control. Registering an id the shipped bundle
does not use **adds** a control instead 鈥?which is exactly how the old single
`stats` row surfaced as duplicated pills once the dock split in two.

Both of this plugin's cells therefore pass `priority: -1`, strictly below the
shipped rows' default 0, and each renders exactly one pill:

- `activity` 鈫?turn/step counts with whole-session speed
- `usage` 鈫?session token total covering every subagent

They are registered from one `slots.inject` generator, exactly as the shipped
row does, so they share a disposal scope and cannot half-mount.

Every figure rides durable projections, so paging and compaction cannot change
them:

- `tokenUsage` 鈥?the four disjoint provider billing buckets per session.
- `subagentCatalog` 鈥?direct children of a session, in parent event order,
  with mode and optional label.
- `SessionSummary.projectionValues` 鈥?the same projections plus the subagent
  identity (`label`) and timing, addressed by session id.
- `ChatSnapshot.nodes.values()` 鈥?the keyed store of every materialized Chat
  Node. `turn-tail` rows deliberately make no contribution to `legacy.nodes`,
  so this is the only place the per-turn `routes` (provider/model) can be read
  from; the legacy slice still feeds the step-count fold.

The `compact` / `detailed` preference is read from the same `ui-chat` config
scope the shipped pill uses; `compact` keeps the plain speed and cache-hit
readings without dialogs.

## Known limitations

- **Per-subagent model attribution is unavailable.** The client-side
  `tokenUsage` projection carries only the four buckets 鈥?no route 鈥?so a
  subagent's row shows its total, not its model. Model attribution covers the
  main session's loaded turns.
- **Descendants are a best-effort walk.** `subagentCatalog` is the direct
  children of a session; grandchildren appear only once their own catalog has
  been loaded (the same rule the shipped subagent catalog follows). Nothing is
  invented for unloaded levels.
- **Model attribution covers loaded turns.** `turn-tail` rows exist only for
  closed turns inside the loaded window, so on a long, paged session the model
  row and the by-model section can lag the durable totals. In this version the
  chat target's assistant nodes carry no `providerMetadata`, so there is no
  second source to fall back on 鈥?the row shows the session's models only once
  at least one closed turn is loaded.
- **Compact mode** keeps the shipped behavior (speed and cache hit only).

## Install

The bundle is a plain directory 鈥?no build step is required, because
`client.js` is committed. Install it into a profile from a local clone:

```powershell
git clone https://github.com/Minggle/dsh-token-breakdown-stats.git
```

Then, in a dsh session, install the bundle with `plugin_manager`:

```
plugin_manager  action: install_bundle
               target: <absolute path to the cloned directory>
```

The inserted row id is `token-breakdown-stats`. Restart the app (or let the
live patch reload apply it) and the pill in the composer dock is replaced.

To rebuild `client.js` from `src/` after editing the sources:

```powershell
node build.mjs
```

## Verify

```powershell
node src/smoke.test.cjs
```

The smoke test loads the built `client.js` through a mocked
`window.__ModuleLoader__` and a minimal React runtime, then asserts the
rollup math, the pill label, the dialog sections, Escape dismissal, compact
mode, and locale parity.

## Files

- `index.js` 鈥?Host half (no Host row is needed).
- `client.js` 鈥?generated browser artifact (do not edit).
- `src/entry.js` 鈥?slot registration and mode hook.
- `src/stats-pills.js` 鈥?the two dock cells (`ActivityStats`, `UsageStats`), the
  legacy combined `StatsPills`, and the breakdown dialog.
- `src/token-aggregator.cjs` 鈥?pure aggregation and route folding.
- `src/smoke.test.cjs` 鈥?Node smoke test.
- `locale/{en,zh}.json` 鈥?dictionaries (single source of truth).
- `icon.svg` 鈥?original artwork.
- `build.mjs` 鈥?inlines `src/` into `client.js`.

## Requirements

- DeepSeek Harness `>= 0.2.1-rc.2` (the plugin reads `ChatSnapshot.nodes`,
  `SessionSummary.projectionValues`, and matches the split
  `conversation.composer.dock` rows `activity` and `usage`). On
  `0.2.0-rc.2` the dock still had the single `stats` cell, which this plugin
  no longer targets.
- A desktop or web profile; the Web GUI renders the pills.

## Install incident (2026-10-15)

An early build of this plugin made the desktop app fail web boot with
`1 entry did not activate: @deepseek-ai/dsh-client-ui-chat: failed`. The
bundle was removed and the profile restored from the backup the app itself
wrote (`cordis.patch.yml.bak-*`), so no user data was lost.

The root causes are recorded here because both are easy to reintroduce:

1. **A list slot rejects a same-id, same-priority registration.** The shipped
   `ui-chat` row occupies `conversation.composer.dock` id `stats` at priority
   0; a replacement must pass a strictly lower `priority` (this plugin uses
   `-1`). The slot's `register` throws
   `already has an entry with id "stats" at priority 0 鈥?register at a
   different priority to shadow it (lowest renders)`, and because the plugin's
   inject callback runs inside the dock owner's fiber, the failure is reported
   against that owner rather than the plugin.
2. **A restricted Client context throws on an undeclared service.** Reading
   `ctx.configForms` without declaring `configForms` in the entry's `inject`
   raises `cannot get property "configForms" without inject`. The plugin now
   declares only `['slots', 'locale']` and reads everything else defensively.

Two smoke-test mocks reproduce both failure modes so a regression fails the
test instead of a boot: the context throws on undeclared service access, and
the slot service rejects a duplicate cell at the same priority.

## Duplicate-pill regression (DSH 0.2.1-rc.2, 2026-10-17)

Upgrading to DSH `0.2.1-rc.2` made every statistic appear **twice**. The cause
was a dock re-shape, not a slot-rule change: `ui-chat` split its single
`stats` cell into `activity` (order 0) and `usage` (order 1). The plugin still
registered only `stats`, which then matched no shipped row 鈥?so it **added** a
third control instead of replacing one, and the two shipped pills rendered
underneath it.

The plugin now registers `activity` and `usage` one-for-one, each rendering a
single pill (`ActivityStats` / `UsageStats`), while `entry.js` keeps them in one
`slots.inject` generator so they mount and unmount together.

Two guards keep it from recurring:

- The smoke test models the **split** dock, so registering an id the dock does
  not use fails the test instead of silently adding a control, and it asserts
  each cell renders exactly one pill (rendering both from both cells would
  duplicate the whole block).
- A `0.2.1-rc.2` fixture replays both registration sets through the **real**
  shipped `SlotCore` and asserts 2 rendered controls after the fix versus 3
  before it.

## License

[MIT](LICENSE)

