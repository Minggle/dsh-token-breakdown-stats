/**
 * Token-usage aggregation for the composer-dock stats pill.
 *
 * Every figure comes from the durable session projections the shipped client
 * already serves, so paging and compaction cannot change any of them:
 *
 *  - `tokenUsage` (per session): the four disjoint provider billing buckets.
 *  - `subagentCatalog` (per parent session): direct children in parent event
 *    order, with mode and optional label.
 *  - `SessionSummary.projectionValues`: the same projections plus the
 *    subagent identity (`label`) and timing, addressed by session id.
 *  - `turn-tail` chat nodes: per-turn exact usage with `routes`
 *    (provider/model), used ONLY for model attribution because the visible
 *    node window is paged.
 *
 * This module is pure: it takes plain snapshots and returns plain facts, so
 * it runs unchanged under Node for tests.
 */

/** Zeroed four-bucket usage. */
const EMPTY_USAGE = Object.freeze({
  uncachedInputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  outputTokens: 0,
})

/** Deepest descendant walk; deeper trees are still counted through the fold below. */
const DEFAULT_MAX_DEPTH = 8

/**
 * Whether a value is a usable non-negative token count.
 * @param value - candidate.
 * @returns true for finite non-negative numbers.
 */
function isCount(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/**
 * Coerce anything into the four-bucket shape, dropping unusable buckets.
 * @param usage - candidate usage object.
 * @returns a normalized usage object.
 */
function normalizeUsage(usage) {
  if (usage === null || typeof usage !== 'object') return { ...EMPTY_USAGE }
  const pick = (key) => (isCount(usage[key]) ? usage[key] : 0)
  return {
    uncachedInputTokens: pick('uncachedInputTokens'),
    cacheReadTokens: pick('cacheReadTokens'),
    cacheWriteTokens: pick('cacheWriteTokens'),
    outputTokens: pick('outputTokens'),
  }
}

/**
 * Sum the three disjoint prompt-side billing buckets.
 * @param usage - normalized usage.
 * @returns billed prompt tokens.
 */
function billedInput(usage) {
  return usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
}

/**
 * Sum all four buckets.
 * @param usage - normalized usage.
 * @returns total tokens.
 */
function usageTotal(usage) {
  return billedInput(usage) + usage.outputTokens
}

/**
 * Add two usage objects bucket-wise.
 * @param left - first usage.
 * @param right - second usage.
 * @returns the summed usage.
 */
function addUsage(left, right) {
  const a = normalizeUsage(left)
  const b = normalizeUsage(right)
  return {
    uncachedInputTokens: a.uncachedInputTokens + b.uncachedInputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
    outputTokens: a.outputTokens + b.outputTokens,
  }
}

/**
 * Round a cache-read ratio to exact percentage units, ties rounded up.
 * @param cacheReadTokens - exact prompt tokens served from cache.
 * @param denominator - exact billed prompt tokens.
 * @param decimalPlaces - 0 or 1.
 * @returns percentage units at the requested precision.
 */
function roundedPercentUnits(cacheReadTokens, denominator, decimalPlaces) {
  const unitsPerPercent = decimalPlaces === 0 ? 1 : 10
  const scale = unitsPerPercent * 100
  const doubledScale = scale * 2
  const denominatorQuotient = Math.floor(denominator / doubledScale)
  const denominatorRemainder = denominator % doubledScale
  let lower = 0
  let upper = scale
  while (lower < upper) {
    const candidate = Math.floor((lower + upper + 1) / 2)
    const factor = candidate * 2 - 1
    const threshold = factor * denominatorQuotient
      + Math.ceil((factor * denominatorRemainder) / doubledScale)
    if (cacheReadTokens >= threshold) lower = candidate
    else upper = candidate - 1
  }
  return lower
}

/**
 * Render percentage units as display text.
 * @param units - percentage units.
 * @param decimalPlaces - 0 or 1.
 * @returns display string.
 */
function displayPercentUnits(units, decimalPlaces) {
  if (decimalPlaces === 0) return String(units)
  const whole = Math.floor(units / 10)
  const tenths = units % 10
  return tenths === 0 ? String(whole) : `${whole}.${tenths}`
}

/**
 * Display-ready cache-hit share, never rounding a partial hit up to 100.
 *
 * Mirrors the shipped `formatCacheHitPercent`: a full hit renders as 100, no
 * billed input renders as null, and a partial hit that would round to 100
 * gains decimal places until it stays honest.
 * @param cacheReadTokens - exact cached prompt tokens.
 * @param promptTokens - exact billed prompt tokens.
 * @returns percentage text, or null when there was no billed input.
 */
function cacheHitPercent(cacheReadTokens, promptTokens) {
  if (!isCount(cacheReadTokens) || !isCount(promptTokens) || promptTokens === 0) return null
  const missedInputTokens = promptTokens - cacheReadTokens
  if (missedInputTokens === 0) return '100'

  const roundedUnits = roundedPercentUnits(cacheReadTokens, promptTokens, 0)
  if (roundedUnits < 100) return displayPercentUnits(roundedUnits, 0)

  let distinguishingPlaces = 1
  let scaledDoubleGap = missedInputTokens * 200
  const denominatorTens = Math.floor(promptTokens / 10)
  while (scaledDoubleGap <= denominatorTens) {
    scaledDoubleGap *= 10
    distinguishingPlaces += 1
  }
  const denominatorOnes = promptTokens % 10
  let roundedLoss = 5
  for (let loss = 1; loss < 5; loss += 1) {
    const factor = loss * 2 + 1
    const threshold = factor * denominatorTens + Math.floor((factor * denominatorOnes) / 10)
    if (scaledDoubleGap <= threshold) {
      roundedLoss = loss
      break
    }
  }
  return `99.${'9'.repeat(distinguishingPlaces - 1)}${10 - roundedLoss}`
}

/**
 * Whether a usage object carries any billed activity.
 * @param usage - candidate usage.
 * @returns true when any bucket is non-zero.
 */
function hasActivity(usage) {
  if (usage === null || usage === undefined) return false
  return isCount(usage.uncachedInputTokens) || isCount(usage.cacheReadTokens)
    || isCount(usage.cacheWriteTokens) || isCount(usage.outputTokens)
    ? usageTotal(normalizeUsage(usage)) > 0
    : false
}

/**
 * Read the per-turn usage attached to one `turn-tail` chat node.
 * @param node - a chat snapshot node.
 * @returns normalized usage plus routes, or null when the node carries none.
 */
function turnTailUsage(node) {
  if (node === null || node === undefined) return null
  const kind = node.kind
  if (kind !== 'turn-tail') return null
  const data = node.data
  if (data === null || data === undefined) return null
  const usage = data.tokenUsage
  if (usage === null || usage === undefined || typeof usage !== 'object') return null
  const routes = Array.isArray(usage.routes)
    ? usage.routes
      .filter(route => route !== null && typeof route === 'object'
        && typeof route.provider === 'string' && route.provider.length > 0
        && typeof route.model === 'string' && route.model.length > 0)
      .map(route => ({ provider: route.provider, model: route.model }))
    : []
  return { usage: normalizeUsage(usage), routes }
}

/**
 * Fold `turn-tail` nodes into per-model attribution.
 *
 * `turn-tail` is the ONLY route source in this version. The chat target's
 * assistant nodes carry no `providerMetadata` — the trajectory target's nodes
 * do, but that is a different snapshot — and `turn-tail` rows deliberately make
 * no contribution to `legacy.nodes`, so the caller must read the keyed node
 * store (`snapshot.nodes.values()`), not the legacy slice.
 *
 * Only loaded turns contribute, so the result is an attribution of what the
 * window can prove — never a substitute for the durable session total.
 * @param nodes - materialized chat nodes.
 * @returns distinct routes in first-seen order, each with its folded usage.
 */
function collectRoutes(nodes) {
  const byKey = new Map()
  if (!Array.isArray(nodes)) return []
  for (const node of nodes) {
    const folded = turnTailUsage(node)
    if (folded === null) continue
    for (const route of folded.routes) {
      const key = `${route.provider}\u0000${route.model}`
      const existing = byKey.get(key)
      if (existing === undefined) {
        byKey.set(key, { provider: route.provider, model: route.model, usage: folded.usage, total: usageTotal(folded.usage) })
      } else {
        existing.usage = addUsage(existing.usage, folded.usage)
        existing.total = usageTotal(existing.usage)
      }
    }
  }
  return [...byKey.values()]
}

/**
 * Read one session's usage from either the projection snapshot or its summary.
 * @param projections - projectionsBySession snapshot.
 * @param summaries - byId snapshot.
 * @param sessionId - session to read.
 * @returns normalized usage, or null when nothing is known yet.
 */
function usageFor(projections, summaries, sessionId) {
  const fromSummary = summaries?.[sessionId]?.projectionValues?.tokenUsage
  if (fromSummary !== null && fromSummary !== undefined && typeof fromSummary === 'object') {
    return normalizeUsage(fromSummary)
  }
  const fromProjection = projections?.[sessionId]?.values?.tokenUsage
  if (fromProjection !== null && fromProjection !== undefined && typeof fromProjection === 'object') {
    return normalizeUsage(fromProjection)
  }
  return null
}

/**
 * Read one session's durable subagent label.
 * @param summaries - byId snapshot.
 * @param sessionId - session to read.
 * @returns the label, or undefined.
 */
function labelFor(summaries, sessionId) {
  const label = summaries?.[sessionId]?.projectionValues?.subagent?.label
  return typeof label === 'string' && label.length > 0 ? label : undefined
}

/**
 * Read one session's running state from either source.
 * @param statuses - session status map.
 * @param summaries - byId snapshot.
 * @param sessionId - session to read.
 * @returns true when the session is running.
 */
function runningFor(statuses, summaries, sessionId) {
  const fromStatus = statuses?.get?.(sessionId)?.running
  if (typeof fromStatus === 'boolean') return fromStatus
  const fromSummary = summaries?.[sessionId]?.running
  return fromSummary === true
}

/** Human-readable subagent mode label key suffix. */
const MODE_KEYS = {
  'one-shot': 'oneShot',
  continuable: 'continuable',
  external: 'external',
  unknown: 'unknown',
}

/**
 * Walk the subagent tree breadth-first, collecting every descendant the
 * loaded projections can prove.
 *
 * A child whose own catalog has not been loaded simply has no grandchildren
 * here; nothing is invented. Sessions are deduplicated by id, so a session
 * reachable through two parents is counted once, at its shallowest depth.
 * @param input - snapshots plus the root session id.
 * @returns the discovered descendants in discovery order.
 */
function collectDescendants(input) {
  const { sessionId, projections, summaries, statuses, maxDepth } = input
  const seen = new Set([sessionId])
  const found = []
  let frontier = [sessionId]
  for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth += 1) {
    const next = []
    for (const parentId of frontier) {
      const entries = projections?.[parentId]?.values?.subagentCatalog
      if (!Array.isArray(entries)) continue
      for (const entry of entries) {
        if (entry === null || typeof entry !== 'object') continue
        const id = entry.id
        if (typeof id !== 'string' || id.length === 0 || seen.has(id)) continue
        seen.add(id)
        const mode = typeof entry.mode === 'string' ? entry.mode : 'unknown'
        found.push({
          id,
          label: labelFor(summaries, id) ?? (typeof entry.label === 'string' && entry.label.length > 0 ? entry.label : id),
          mode,
          modeKey: MODE_KEYS[mode] ?? 'unknown',
          running: runningFor(statuses, summaries, id),
          depth,
          usage: usageFor(projections, summaries, id),
        })
        next.push(id)
      }
    }
    frontier = next
  }
  return found
}

/**
 * Fold every known fact about one session's token usage into display rows.
 * @param input - snapshots plus the root session id.
 * @returns main agent facts, descendant facts, and the combined total.
 */
function collectTokenFacts(input) {
  const {
    sessionId,
    projections = {},
    summaries = {},
    statuses,
    mainUsage,
    nodes,
    maxDepth = DEFAULT_MAX_DEPTH,
  } = input ?? {}

  const main = normalizeUsage(mainUsage)
  const children = collectDescendants({ sessionId, projections, summaries, statuses, maxDepth })

  let subagentUsage = { ...EMPTY_USAGE }
  for (const child of children) {
    if (child.usage !== null) subagentUsage = addUsage(subagentUsage, child.usage)
  }
  const total = addUsage(main, subagentUsage)
  const routes = collectRoutes(nodes)

  const withUsage = children.filter(child => child.usage !== null)
  return {
    main: {
      usage: main,
      total: usageTotal(main),
      routes,
    },
    children,
    subagentUsage,
    subagentTotal: usageTotal(subagentUsage),
    total,
    totalTokens: usageTotal(total),
    discovered: children.length,
    withUsage: withUsage.length,
    hasSubagents: children.length > 0,
    hasAnyUsage: usageTotal(total) > 0,
    mainShare: usageTotal(total) === 0 ? 0 : usageTotal(main) / usageTotal(total),
    subagentShare: usageTotal(total) === 0 ? 0 : usageTotal(subagentUsage) / usageTotal(total),
  }
}

module.exports = {
  EMPTY_USAGE,
  DEFAULT_MAX_DEPTH,
  isCount,
  normalizeUsage,
  billedInput,
  usageTotal,
  addUsage,
  cacheHitPercent,
  hasActivity,
  collectRoutes,
  collectDescendants,
  collectTokenFacts,
}
