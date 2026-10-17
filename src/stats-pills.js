/**
 * Composer-dock statistics pills with subagent rollup.
 *
 * This component displaces the shipped `ui-chat` `stats` entry (same slot, id
 * and order), so it reproduces that entry's two pills — time/activity and
 * token usage — and extends the usage pill:
 *
 *  - the pill label reports the session TOTAL (main agent + every subagent it
 *    called), not just the main agent;
 *  - its dialog itemizes usage by billing bucket, by subagent (with label,
 *    mode, run state and share), and by model for the loaded turns.
 *
 * Styling reuses the shipped design tokens (`--dsw-*`) so the pill and dialog
 * are indistinguishable from the built-in ones, and the extra sections follow
 * the same type scale.
 */

import React from 'react'
import { createPortal } from 'react-dom'
import {
  collectTokenFacts,
  billedInput,
  cacheHitPercent,
} from './token-aggregator.cjs'

const { createElement: h, useState, useMemo, useRef, useEffect, useCallback } = React

/** Dialog placement constants, matching the shipped stat dialog. */
const PANEL_GAP = 8
const PANEL_MARGIN = 12

/** Stable empty node list, so a guarded read keeps one reference across renders. */
const NO_NODES = Object.freeze([])

/** First measure pass: laid out but invisible, so the clamp can read real size. */
const MEASURE_STYLE = { visibility: 'hidden', left: 0, top: 0 }

const CSS = `
.tkb-root{box-sizing:border-box;min-width:0;max-width:100%;font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px);line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));justify-content:center;gap:12px;display:flex}
.tkb-anchor{min-width:0;display:inline-flex}
.tkb-pill{box-sizing:border-box;max-width:100%;color:var(--dsw-alias-label-tertiary);font:inherit;font-variant-numeric:tabular-nums;line-height:inherit;white-space:nowrap;background:0 0;border:none;border-radius:999px;align-items:center;gap:6px;padding:1px 8px;display:inline-flex}
.tkb-pill svg{flex:none;width:14px;height:14px}
button.tkb-pill{cursor:pointer}
button.tkb-pill:hover,button.tkb-pill[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
.tkb-label{text-overflow:ellipsis;min-width:0;overflow:hidden}
.tkb-sep{color:var(--dsw-alias-separator-primary);margin:0 6px}
.tkb-panel{z-index:1100;box-sizing:border-box;border-radius:var(--dsw-radius-lg);background:var(--dsw-specific-menu);width:max-content;min-width:min(320px,100vw - 24px);max-width:min(440px,100vw - 24px);backdrop-filter:var(--dsw-menu-backdrop-filter);box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-secondary);cursor:default;border:0;padding:16px;font-size:12px;line-height:18px;position:fixed}
.tkb-title{color:var(--dsw-alias-label-primary);justify-content:space-between;gap:16px;margin-bottom:8px;font-weight:500;display:flex}
.tkb-titleRule{border-top:.5px solid var(--dsw-alias-border-l2);margin-bottom:10px}
.tkb-titleValue{font-variant-numeric:tabular-nums}
.tkb-titleLabel{align-items:center;gap:6px;min-width:0;display:inline-flex}
.tkb-titleLabel svg{flex:none;width:14px;height:14px}
.tkb-details{color:var(--dsw-alias-label-tertiary);grid-template-columns:minmax(76px,auto) minmax(0,1fr);gap:6px 16px;margin:0;display:grid}
.tkb-details dt,.tkb-details dd{min-width:0;margin:0}
.tkb-details dd{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;text-align:right}
.tkb-route{overflow-wrap:anywhere}
.tkb-section{margin-top:12px}
.tkb-sectionLabel{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;letter-spacing:.02em;margin-bottom:6px;display:flex;align-items:center;gap:6px}
.tkb-sectionNote{color:var(--dsw-alias-label-caption);font-size:11px;font-weight:400;margin-left:auto}
.tkb-split{border-radius:999px;background:var(--dsw-alias-interactive-bg-hover);height:6px;margin:2px 0 10px;display:flex;overflow:hidden}
.tkb-splitMain{background:var(--dsw-alias-brand-primary);height:100%}
.tkb-splitSub{background:var(--dsw-alias-state-success-primary);height:100%}
.tkb-splitLegend{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;justify-content:space-between;gap:8px;margin-bottom:8px;display:flex}
.tkb-summary{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;margin-bottom:6px}
.tkb-empty{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
`

/** Original gauge glyph for the time/activity pill. */
function GaugeIcon() {
  return h('svg', { viewBox: '0 0 20 20', fill: 'none', 'aria-hidden': true },
    h('path', {
      d: 'M3.5 14.5a7 7 0 1 1 13 0', stroke: 'currentColor', 'strokeWidth': 1.5, strokeLinecap: 'round',
    }),
    h('path', { d: 'M10 14.5 13.2 9.4', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }),
    h('circle', { cx: 10, cy: 14.6, r: 1.4, fill: 'currentColor' }),
  )
}

/** Original stacked-layer glyph for the token/usage pill. */
function LayersIcon() {
  return h('svg', { viewBox: '0 0 20 20', fill: 'none', 'aria-hidden': true },
    h('path', {
      d: 'M10 3 16.5 6 10 9 3.5 6 10 3Z', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round',
    }),
    h('path', {
      d: 'M3.5 10 10 13l6.5-3M3.5 13.8 10 16.8l6.5-3', stroke: 'currentColor', strokeWidth: 1.5,
      strokeLinejoin: 'round', strokeLinecap: 'round',
    }),
  )
}

/**
 * One assistant step's derivable latency readings (mirrors the shipped
 * `assistantStepReading`); null marks an unrecorded part.
 * @param node - a settled assistant node.
 * @returns per-part readings.
 */
function assistantStepReading(node) {
  const timing = node.timing
  const ttftMs = timing !== undefined && timing.stepStartTime !== null && timing.firstTokenTime !== null
    ? Math.max(0, timing.firstTokenTime - timing.stepStartTime)
    : null
  const decodeMs = timing !== undefined && timing.firstTokenTime !== null
    ? Math.max(0, timing.completedTime - timing.firstTokenTime)
    : null
  const usage = node.usage
  const outputTokens = usage !== null && typeof usage === 'object'
    && typeof usage.outputTokens === 'number'
    && Number.isFinite(usage.outputTokens) && usage.outputTokens >= 0
    ? usage.outputTokens
    : null
  return { ttftMs, decodeMs, outputTokens }
}

/**
 * Fold assistant and tool-result nodes into window-scoped display totals; the
 * fallback for assemblies without the `sessionStats` projection.
 * @param nodes - chat snapshot nodes.
 * @returns fallback counts and summed wall times.
 */
function deriveStats(nodes) {
  const turns = new Set()
  let steps = 0
  let llmMs = 0
  let toolMs = 0
  let ttftMs = 0
  let ttftSteps = 0
  let decodeMs = 0
  let decodeTokens = 0
  if (!Array.isArray(nodes)) return { turns: 0, steps: 0, llmMs: 0, toolMs: 0, ttftMs: 0, ttftSteps: 0, decodeMs: 0, decodeTokens: 0 }
  for (const node of nodes) {
    if (node.kind === 'tool-result') {
      if (node.callTime !== null && node.callTime !== undefined) toolMs += Math.max(0, node.time - node.callTime)
      continue
    }
    if (node.kind !== 'assistant') continue
    turns.add(node.turn)
    steps += 1
    if (node.timing !== undefined && node.timing.stepStartTime !== null) {
      llmMs += Math.max(0, node.timing.completedTime - node.timing.stepStartTime)
    }
    const reading = assistantStepReading(node)
    if (reading.ttftMs !== null) {
      ttftMs += reading.ttftMs
      ttftSteps += 1
    }
    if (reading.decodeMs !== null && reading.outputTokens !== null) {
      decodeMs += reading.decodeMs
      decodeTokens += reading.outputTokens
    }
  }
  return { turns: turns.size, steps, llmMs, toolMs, ttftMs, ttftSteps, decodeMs, decodeTokens }
}

/**
 * Compact token count: 517 / 12.2K / 517K / 1.2M.
 * @param value - non-negative token count.
 * @param t - locale seat.
 * @returns display string.
 */
function formatTokens(value, t) {
  const scaled = (candidate) => (candidate >= 100 ? String(Math.round(candidate)) : String(Math.round(candidate * 10) / 10))
  if (value < 1_000) return String(value)
  if (value < 1_000_000) return t('number.thousand', { value: scaled(value / 1_000) })
  return t('number.million', { value: scaled(value / 1_000_000) })
}

/**
 * Exact integer token count with locale digit grouping.
 * @param value - token count.
 * @param t - locale seat.
 * @returns unrounded display string.
 */
function formatExactTokens(value, t) {
  const digits = String(value)
  const groups = []
  for (let end = digits.length; end > 0; end -= 3) groups.unshift(digits.slice(Math.max(0, end - 3), end))
  return groups.join(t('number.groupSeparator'))
}

/**
 * Compact duration: 45.2s under a minute, 2m42s from there on.
 * @param ms - duration in milliseconds.
 * @param t - locale seat.
 * @returns display string.
 */
function formatDuration(ms, t) {
  const s = ms / 1_000
  if (s < 60) return t('duration.compactSeconds', { seconds: Math.round(s * 10) / 10 })
  const whole = Math.round(s)
  return t('duration.compactMinutes', { minutes: Math.floor(whole / 60), seconds: whole % 60 })
}

/**
 * Integer-or-one-decimal percentage text for a 0..1 ratio.
 * @param ratio - share of a whole.
 * @returns percentage text.
 */
function formatPercent(ratio) {
  if (!Number.isFinite(ratio) || ratio <= 0) return '0'
  const percent = ratio * 100
  if (percent >= 100) return '100'
  const rounded = Math.round(percent * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

/** Exact count with the shipped `{count} tok` shape. */
function exactCount(value, t) {
  return t('message.turnUsage.count', { count: formatExactTokens(value, t) })
}

/**
 * Trigger-anchored dialog seat: open state, viewport-clamped placement,
 * outside-pointer and Escape dismissal.
 * @param controlled - optional external open state, letting sibling dialogs
 * share one exclusive slot.
 * @returns the seat.
 */
function useStatDialog(controlled) {
  const [ownOpen, setOwnOpen] = useState(false)
  const open = controlled === undefined ? ownOpen : controlled.open
  const setOpen = controlled === undefined ? setOwnOpen : controlled.setOpen
  const rootRef = useRef(null)
  const panelRef = useRef(null)
  const [pos, setPos] = useState(null)

  useEffect(() => {
    if (!open) {
      setPos(null)
      return undefined
    }
    const place = () => {
      const root = rootRef.current
      const panel = panelRef.current
      if (root === null || panel === null) return
      const trigger = root.getBoundingClientRect()
      const box = panel.getBoundingClientRect()
      let top = trigger.top - box.height - PANEL_GAP
      if (top < PANEL_MARGIN) {
        top = Math.min(trigger.bottom + PANEL_GAP, window.innerHeight - box.height - PANEL_MARGIN)
      }
      let left = trigger.left + trigger.width / 2 - box.width / 2
      left = Math.max(PANEL_MARGIN, Math.min(left, window.innerWidth - box.width - PANEL_MARGIN))
      setPos({ top: Math.max(PANEL_MARGIN, top), left })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown) }
  }, [open, setOpen])

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => {
      const root = rootRef.current
      const panel = panelRef.current
      const target = event.target
      if (root !== null && root.contains(target)) return
      if (panel !== null && panel.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => { document.removeEventListener('pointerdown', onPointerDown, true) }
  }, [open, setOpen])

  return { open, setOpen, rootRef, panelRef, pos }
}

/** One dialog shell shared by both pills. */
function StatPanel({ seat, title, icon, titleValue, children }) {
  return createPortal(
    h('div', {
      ref: seat.panelRef,
      className: 'tkb-panel',
      role: 'dialog',
      style: seat.pos ?? MEASURE_STYLE,
    },
      h('div', { className: 'tkb-title' },
        h('span', { className: 'tkb-titleLabel' }, icon, title),
        titleValue === undefined ? null : h('span', { className: 'tkb-titleValue' }, titleValue),
      ),
      h('div', { className: 'tkb-titleRule' }),
      children,
    ),
    document.body,
  )
}

/** A `dl` row pair. */
function Row({ label, value }) {
  return h(React.Fragment, null, h('dt', null, label), h('dd', null, value))
}

/** Turn/step counts with whole-session speed, opening the time dialog. */
function TimePill({ stats, t, dialog }) {
  const seat = useStatDialog(dialog)
  const speed = stats.decodeMs > 0
    ? t('message.tokensPerSecond', { tps: String(Math.round((stats.decodeTokens / (stats.decodeMs / 1_000)) * 10) / 10) })
    : null
  const counts = t('stats.counts', { turns: stats.turns, steps: stats.steps })
  const label = speed === null
    ? counts
    : h(React.Fragment, null, counts, h('span', { className: 'tkb-sep', 'aria-hidden': true }, '·'), speed)

  const timed = stats.llmMs > 0 || stats.toolMs > 0 || stats.ttftSteps > 0 || speed !== null
  const icon = h(GaugeIcon, null)

  if (!timed) {
    return h('span', { ref: seat.rootRef, className: 'tkb-anchor' },
      h('span', { className: 'tkb-pill' }, icon, h('span', { className: 'tkb-label' }, label)),
    )
  }
  return h('span', { ref: seat.rootRef, className: 'tkb-anchor' },
    h('button', {
      type: 'button',
      className: 'tkb-pill',
      'aria-haspopup': 'dialog',
      'aria-expanded': seat.open,
      'aria-label': counts,
      onClick: () => { seat.setOpen(!seat.open) },
    }, icon, h('span', { className: 'tkb-label' }, label)),
    seat.open && h(StatPanel, {
      seat,
      title: t('stats.dialog.title'),
      icon,
    },
      h('dl', { className: 'tkb-details' },
        stats.llmMs > 0 && h(Row, { label: t('stats.dialog.llmTime'), value: formatDuration(stats.llmMs, t) }),
        stats.toolMs > 0 && h(Row, { label: t('stats.dialog.toolTime'), value: formatDuration(stats.toolMs, t) }),
        stats.ttftSteps > 0 && h(Row, {
          label: t('stats.dialog.ttft'),
          value: formatDuration(stats.ttftMs / stats.ttftSteps, t),
        }),
        speed !== null && h(Row, { label: t('stats.dialog.speed'), value: speed }),
      ),
    ),
  )
}

/** The four billing buckets of one usage object. */
function BucketRows({ usage, t, includeCacheHit }) {
  const hit = cacheHitPercent(usage.cacheReadTokens, billedInput(usage))
  return h('dl', { className: 'tkb-details' },
    includeCacheHit && hit !== null && h(Row, { label: t('message.turnUsage.cacheHit'), value: `${hit}%` }),
    h(Row, { label: t('message.turnUsage.input'), value: exactCount(usage.uncachedInputTokens, t) }),
    h(Row, { label: t('message.turnUsage.cacheRead'), value: exactCount(usage.cacheReadTokens, t) }),
    usage.cacheWriteTokens !== 0 && h(Row, {
      label: t('message.turnUsage.cacheWrite'),
      value: exactCount(usage.cacheWriteTokens, t),
    }),
    h(Row, { label: t('message.turnUsage.output'), value: exactCount(usage.outputTokens, t) }),
  )
}

/** The itemized usage dialog: totals, main agent, the subagent aggregate, and by model. */
function BreakdownPanel({ seat, facts, t }) {
  const { main, children, total } = facts
  const totalHit = cacheHitPercent(total.cacheReadTokens, billedInput(total))
  const attributedRoutes = main.routes.filter(route => route.total !== null)
  const attributed = attributedRoutes.reduce((sum, route) => sum + route.total, 0)

  return h(StatPanel, {
    seat,
    title: t('stats.dialog.usageTitle'),
    icon: h(LayersIcon, null),
    titleValue: exactCount(facts.totalTokens, t),
  },
    // Overall split between the main agent and its subagents.
    facts.hasSubagents && facts.totalTokens > 0 && h('div', null,
      h('div', { className: 'tkb-split' },
        h('div', { className: 'tkb-splitMain', style: { width: `${formatPercent(facts.mainShare)}%` } }),
        h('div', { className: 'tkb-splitSub', style: { width: `${formatPercent(facts.subagentShare)}%` } }),
      ),
      h('div', { className: 'tkb-splitLegend' },
        h('span', null, t('tokenBreakdown.splitMain', { percent: formatPercent(facts.mainShare) })),
        h('span', null, t('tokenBreakdown.splitSubagents', { percent: formatPercent(facts.subagentShare) })),
      ),
    ),

    h('dl', { className: 'tkb-details' },
      totalHit !== null && h(Row, { label: t('message.turnUsage.cacheHit'), value: `${totalHit}%` }),
      h(Row, { label: t('message.turnUsage.input'), value: exactCount(total.uncachedInputTokens, t) }),
      h(Row, { label: t('message.turnUsage.cacheRead'), value: exactCount(total.cacheReadTokens, t) }),
      total.cacheWriteTokens !== 0 && h(Row, {
        label: t('message.turnUsage.cacheWrite'),
        value: exactCount(total.cacheWriteTokens, t),
      }),
      h(Row, { label: t('message.turnUsage.output'), value: exactCount(total.outputTokens, t) }),
    ),

    h('div', { className: 'tkb-section' },
      h('div', { className: 'tkb-sectionLabel' },
        t('tokenBreakdown.mainAgent'),
        h('span', { className: 'tkb-sectionNote' }, exactCount(main.total, t)),
      ),
      // Every route the loaded nodes name — assistant `providerMetadata` covers
      // turns that never closed, so this reads as "models this session used".
      main.routes.length > 0
        ? h('dl', { className: 'tkb-details' },
          h(Row, {
            label: t('message.turnUsage.model'),
            value: h('span', { className: 'tkb-route' },
              main.routes.map(route => `${route.provider}/${route.model}`).join('，')),
          }),
        )
        : h('div', { className: 'tkb-empty' }, t('tokenBreakdown.modelUnknown')),
      h(BucketRows, { usage: main.usage, t }),
    ),

    // Subagents are reported as ONE aggregate: count, how many are still
    // running, the share of the session, and the folded buckets. No per-child
    // rows — a session can spawn dozens, and the per-child detail belongs to
    // the subagent catalog in the session header.
    h('div', { className: 'tkb-section' },
      h('div', { className: 'tkb-sectionLabel' },
        t('tokenBreakdown.subagents', { count: children.length }),
        children.length > 0 && h('span', { className: 'tkb-sectionNote' }, exactCount(facts.subagentTotal, t)),
      ),
      children.length === 0
        ? h('div', { className: 'tkb-empty' }, t('tokenBreakdown.subagentsEmpty'))
        : h(React.Fragment, null,
          h('div', { className: 'tkb-summary' }, t('tokenBreakdown.subagentsSummary', {
            count: children.length,
            running: children.filter(child => child.running).length,
            percent: formatPercent(facts.totalTokens === 0 ? 0 : facts.subagentTotal / facts.totalTokens),
          })),
          h(BucketRows, { usage: facts.subagentUsage, t }),
        ),
    ),

    // Only routes whose turns actually closed carry attributable tokens, so the
    // by-model section lists those; a named-but-unattributed route still shows
    // in the main agent's model row above.
    attributedRoutes.length > 0 && h('div', { className: 'tkb-section' },
      h('div', { className: 'tkb-sectionLabel' },
        t('tokenBreakdown.byModel'),
        h('span', { className: 'tkb-sectionNote' }, t('tokenBreakdown.byModelNote')),
      ),
      h('dl', { className: 'tkb-details' },
        attributedRoutes.map(route => h(Row, {
          key: `${route.provider}\u0000${route.model}`,
          label: h('span', { className: 'tkb-route' }, `${route.provider}/${route.model}`),
          value: `${formatTokens(route.total, t)} tok${attributed > 0
            ? ` · ${formatPercent(route.total / attributed)}%`
            : ''}`,
        })),
      ),
    ),
  )
}

/**
 * Whole-log token total including every subagent, opening the breakdown dialog.
 */
function UsagePill({ facts, t, dialog }) {
  const seat = useStatDialog(dialog)
  if (!facts.hasAnyUsage) return null
  const hit = cacheHitPercent(facts.total.cacheReadTokens, billedInput(facts.total))
  const totalText = t('message.turnUsage.count', { count: formatTokens(facts.totalTokens, t) })
  const hitText = hit === null ? null : t('stats.cacheHit', { percent: hit })
  // The pill carries the subagent COUNT — a compact signal that the total
  // covers more than the main agent. The aggregate and the itemization both
  // live in the dialog.
  const subText = facts.hasSubagents
    ? t('tokenBreakdown.pillSubagents', { count: facts.discovered })
    : null
  const icon = h(LayersIcon, null)

  const label = h(React.Fragment, null,
    totalText,
    hitText !== null && h(React.Fragment, null,
      h('span', { className: 'tkb-sep', 'aria-hidden': true }, '·'),
      hitText,
    ),
    subText !== null && h(React.Fragment, null,
      h('span', { className: 'tkb-sep', 'aria-hidden': true }, '·'),
      subText,
    ),
  )

  // The accessible name keeps both figures: the count the pill shows and the
  // aggregate it does not.
  const aria = t('tokenBreakdown.pillAria', {
    total: exactCount(facts.totalTokens, t),
    subagent: exactCount(facts.subagentTotal, t),
    count: String(facts.discovered),
  })

  return h('span', { ref: seat.rootRef, className: 'tkb-anchor' },
    h('button', {
      type: 'button',
      className: 'tkb-pill',
      'aria-haspopup': 'dialog',
      'aria-expanded': seat.open,
      'aria-label': aria,
      onClick: () => { seat.setOpen(!seat.open) },
    }, icon, h('span', { className: 'tkb-label' }, label)),
    seat.open && h(BreakdownPanel, { seat, facts, t }),
  )
}

/**
 * The `compact` / `detailed` preference as a hook.
 *
 * @param props - slot props plus `useMode` from the plugin entry.
 * @returns a hook returning the current mode.
 */
function useModeOf(props) {
  return typeof props.useMode === 'function' ? props.useMode : () => 'detailed'
}

/**
 * Read the shared chat/session/usage sources both pills need.
 *
 * The shipped dock split into two cells (`activity` order 0 and `usage` order
 * 1), so each of this plugin's cells renders exactly ONE pill and reads only
 * what that pill needs. Both still share the same underlying snapshots.
 *
 * @param props - slot props.
 * @returns the render inputs for this cell.
 */
function useCellInputs(props) {
  const {
    useChat, useProjection, useSessions, useSessionStatus, sessionId, t,
  } = props
  const useMode = useModeOf(props)
  const mode = useMode()

  // Two different reads of the same chat snapshot, because they answer
  // different questions:
  //  - `legacy.nodes` is the finalized ConversationNode stream the shipped pill
  //    folds for its step counts. It deliberately contains NO `turn-tail` rows.
  //  - `nodes.values()` is the keyed store of every materialized Chat Node,
  //    which is where `turn-tail` (and therefore the per-turn `routes`) lives.
  // Neither read is guaranteed: an absent hook or field must degrade to "no
  // data", never throw during render.
  const readNodes = (selector) => (typeof useChat === 'function' ? useChat(selector) : selector({}))
  const settledNodes = readNodes((state) => state.legacy?.nodes ?? NO_NODES)
  const chatNodes = readNodes((state) => state.nodes?.values?.() ?? NO_NODES)

  const readProjection = (key) => (typeof useProjection === 'function' ? useProjection(key) : undefined)
  const usage = readProjection('tokenUsage')
  const projected = readProjection('sessionStats')

  const readSessions = (selector) => (typeof useSessions === 'function' ? useSessions(selector) : selector({}))
  const projections = readSessions((state) => state.projectionsBySession)
  const summaries = readSessions((state) => state.byId)
  const statuses = typeof useSessionStatus === 'function' ? useSessionStatus((value) => value) : undefined

  const stats = useMemo(() => projected ?? deriveStats(settledNodes), [projected, settledNodes])
  const facts = useMemo(() => collectTokenFacts({
    sessionId,
    projections,
    summaries,
    statuses,
    mainUsage: usage,
    nodes: chatNodes,
  }), [sessionId, projections, summaries, statuses, usage, chatNodes])

  return { mode, stats, facts, t }
}

/**
 * The `activity` dock cell: turn/step counts with whole-session speed.
 *
 * Replaces the shipped `conversation.composer.dock` `activity` cell (order 0).
 *
 * @param props - slot props plus `useMode` from the plugin entry.
 * @returns the dock cell, or null when there is nothing to report.
 */
export function ActivityStats(props) {
  const { mode, stats, t } = useCellInputs(props)
  const style = h('style', null, CSS)
  const speed = stats.decodeMs > 0
    ? t('message.tokensPerSecond', {
      tps: String(Math.round((stats.decodeTokens / (stats.decodeMs / 1_000)) * 10) / 10),
    })
    : null

  if (mode === 'compact') {
    if (speed === null) return null
    return h('div', { className: 'tkb-root' }, style,
      h('span', { className: 'tkb-anchor', 'data-composer-stat': 'activity' },
        h('span', { className: 'tkb-pill' }, h(GaugeIcon, null), h('span', { className: 'tkb-label' }, speed)),
      ),
    )
  }

  if (stats.steps === 0) return null
  return h('div', { className: 'tkb-root' }, style,
    h('span', { 'data-composer-stat': 'activity' },
      h(TimePill, { stats, t }),
    ),
  )
}

/**
 * The `usage` dock cell: session token total covering every subagent.
 *
 * Replaces the shipped `conversation.composer.dock` `usage` cell (order 1).
 *
 * @param props - slot props plus `useMode` from the plugin entry.
 * @returns the dock cell, or null when there is nothing to report.
 */
export function UsageStats(props) {
  const { mode, facts, t } = useCellInputs(props)
  const style = h('style', null, CSS)

  if (mode === 'compact') {
    const hit = facts.hasAnyUsage
      ? cacheHitPercent(facts.total.cacheReadTokens, billedInput(facts.total))
      : null
    if (hit === null) return null
    const hitText = t('stats.cacheHit', { percent: hit })
    return h('div', { className: 'tkb-root' }, style,
      h('span', { className: 'tkb-anchor', 'data-composer-stat': 'usage' },
        h('span', { className: 'tkb-pill' }, h(LayersIcon, null), h('span', { className: 'tkb-label' }, hitText)),
      ),
    )
  }

  if (!facts.hasAnyUsage) return null
  return h('div', { className: 'tkb-root' }, style,
    h('span', { 'data-composer-stat': 'usage' },
      h(UsagePill, { facts, t }),
    ),
  )
}

/**
 * Backwards-compatible single-cell renderer: both pills in one row.
 *
 * Shipped 0.2.0-rc.2 had one `stats` cell holding both pills; 0.2.1-rc.2 split
 * it into `activity` and `usage`. This component keeps the old combined shape
 * available for anyone still composing against the older dock, but the bundle
 * registers the two split cells.
 *
 * @param props - slot props plus `useMode` from the plugin entry.
 * @returns the combined dock row, or null when there is nothing to report.
 */
export function StatsPills(props) {
  const { mode, stats, facts, t } = useCellInputs(props)
  const style = h('style', null, CSS)
  const [openPill, setOpenPill] = useState(null)
  const timeDialog = useMemo(() => ({
    open: openPill === 'time',
    setOpen: (next) => { setOpenPill(next ? 'time' : null) },
  }), [openPill])
  const usageDialog = useMemo(() => ({
    open: openPill === 'usage',
    setOpen: (next) => { setOpenPill(next ? 'usage' : null) },
  }), [openPill])

  if (mode === 'compact') {
    const speed = stats.decodeMs > 0
      ? t('message.tokensPerSecond', {
        tps: String(Math.round((stats.decodeTokens / (stats.decodeMs / 1_000)) * 10) / 10),
      })
      : null
    const hit = facts.hasAnyUsage
      ? cacheHitPercent(facts.total.cacheReadTokens, billedInput(facts.total))
      : null
    const hitText = hit === null ? null : t('stats.cacheHit', { percent: hit })
    if (speed === null && hitText === null) return null
    return h('div', { className: 'tkb-root' }, style,
      speed !== null && h('span', { className: 'tkb-anchor' },
        h('span', { className: 'tkb-pill' }, h(GaugeIcon, null), h('span', { className: 'tkb-label' }, speed)),
      ),
      hitText !== null && h('span', { className: 'tkb-anchor' },
        h('span', { className: 'tkb-pill' }, h(LayersIcon, null), h('span', { className: 'tkb-label' }, hitText)),
      ),
    )
  }

  if (stats.steps === 0 && !facts.hasAnyUsage) return null
  return h('div', { className: 'tkb-root' }, style,
    stats.steps > 0 && h(TimePill, { stats, t, dialog: timeDialog }),
    h(UsagePill, { facts, t, dialog: usageDialog }),
  )
}

export default StatsPills
