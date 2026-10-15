/**
 * Smoke test for the built plugin artifact.
 *
 * Loads bundle/client.js exactly the way the browser does — through
 * `window.__ModuleLoader__.load` with a module-table `require` — against a
 * minimal React runtime, then:
 *
 *  1. asserts the aggregator math on fixtures (no subagents, one level,
 *     grandchildren, missing usage, route dedup);
 *  2. renders the dock row and asserts the pill label carries the TOTAL;
 *  3. opens the usage dialog and asserts the itemized sections.
 *
 * Run: node bundle/src/smoke.test.cjs
 */

'use strict'

const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const BUNDLE_DIR = path.join(__dirname, '..')
const CLIENT = path.join(BUNDLE_DIR, 'client.js')

/* ------------------------------------------------------------------ *
 * Minimal React runtime: elements plus the hooks the component uses.
 * ------------------------------------------------------------------ */

const Fragment = Symbol('react.fragment')

function createElement(type, props, ...children) {
  const flat = []
  const push = (child) => {
    if (Array.isArray(child)) { child.forEach(push); return }
    if (child === null || child === undefined || child === false || child === true) return
    flat.push(child)
  }
  children.forEach(push)
  const normalized = {}
  for (const [key, value] of Object.entries(props ?? {})) {
    if (key === 'key' || key === 'ref') continue
    normalized[key] = value
  }
  // Real React also exposes children through props; StatPanel reads them there.
  normalized.children = flat
  return { $$typeof: 'element', type, props: normalized, children: flat }
}

const hooks = []
let hookIndex = 0
let currentInstance = null
let renderScheduled = false

function beginInstance() {
  hookIndex = 0
}

function nextHook() {
  const instance = currentInstance
  if (instance.hooks.length <= hookIndex) instance.hooks.push({})
  return instance.hooks[hookIndex++]
}

function useState(initial) {
  const hook = nextHook()
  if (!('value' in hook)) hook.value = typeof initial === 'function' ? initial() : initial
  const setValue = (next) => {
    const value = typeof next === 'function' ? next(hook.value) : next
    if (value === hook.value) return
    hook.value = value
    renderScheduled = true
  }
  return [hook.value, setValue]
}

function useRef(initial) {
  const hook = nextHook()
  if (!('ref' in hook)) hook.ref = { current: initial }
  return hook.ref
}

function useMemo(factory, deps) {
  const hook = nextHook()
  const changed = !hook.deps || !deps || hook.deps.length !== deps.length
    || hook.deps.some((value, index) => value !== deps[index])
  if (changed) {
    hook.value = factory()
    hook.deps = deps
  }
  return hook.value
}

function useEffect(effect, deps) {
  const hook = nextHook()
  const changed = !hook.deps || !deps || hook.deps.length !== deps.length
    || hook.deps.some((value, index) => value !== deps[index])
  if (changed) {
    hook.deps = deps
    hook.effect = effect
    touched.get(currentInstance)?.push(hook)
  }
}

function useSyncExternalStore(subscribe, getSnapshot) {
  const hook = nextHook()
  // Real React re-reads the snapshot on every render; mirror that so a settings
  // change is visible without remounting.
  hook.value = getSnapshot()
  if (!('subscribed' in hook)) {
    hook.subscribed = true
    subscribe(() => { hook.value = getSnapshot(); renderScheduled = true })
  }
  return hook.value
}

const React = {
  createElement,
  Fragment,
  useState,
  useRef,
  useMemo,
  useEffect,
  useSyncExternalStore,
  useCallback: (fn) => fn,
}

/** Render a function component until it stops scheduling work. */
const instances = new Map()
const touched = new Map()

function getInstance(path) {
  let instance = instances.get(path)
  if (instance === undefined) {
    instance = { hooks: [], pending: [] }
    instances.set(path, instance)
  }
  if (!touched.has(instance)) touched.set(instance, [])
  return instance
}

function renderTree(element, props, path) {
  if (element === null || element === undefined || typeof element !== 'object') return element
  if (Array.isArray(element)) {
    return element.flatMap((child, index) => {
      const rendered = renderTree(child, props, `${path}[${index}]`)
      return rendered === null || rendered === undefined ? [] : [rendered]
    })
  }
  if (typeof element.type === 'function') {
    const instance = getInstance(path)
    currentInstance = instance
    hookIndex = 0
    const output = element.type({ ...element.props, ...props })
    return renderTree(output, props, `${path}>out`)
  }
  const children = (element.children ?? []).flatMap((child, index) => {
    const rendered = renderTree(child, props, `${path}.${index}`)
    return rendered === null || rendered === undefined ? [] : [rendered]
  })
  return { ...element, children }
}

function flushEffects() {
  for (const [instance, queued] of touched) {
    for (const hook of queued) {
      if (typeof hook.cleanup === 'function') hook.cleanup()
      hook.cleanup = hook.effect()
    }
    instance.pending = []
  }
  touched.clear()
}

/** Render (or re-render) the whole tree, flushing effects and state updates. */
function rerender(element, props) {
  renderScheduled = false
  const tree = renderTree(element, props, 'root')
  flushEffects()
  if (renderScheduled) return rerender(element, props)
  return tree
}

/* ------------------------------------------------------------------ *
 * Minimal DOM so dialog effects can attach listeners.
 * ------------------------------------------------------------------ */

const listeners = new Map()
global.document = {
  body: {},
  addEventListener: (type, handler) => {
    if (!listeners.has(type)) listeners.set(type, new Set())
    listeners.get(type).add(handler)
  },
  removeEventListener: (type, handler) => {
    listeners.get(type)?.delete(handler)
  },
}
global.window = {
  innerWidth: 1280,
  innerHeight: 860,
  addEventListener: () => {},
  removeEventListener: () => {},
}

/* ------------------------------------------------------------------ *
 * Load the built artifact the way the browser does.
 * ------------------------------------------------------------------ */

let registration = null
global.window.__ModuleLoader__ = {
  load: (entry) => { registration = entry },
}
const browserModules = new Map([['react', React], ['react-dom', { createPortal: (node) => node }]])
const artifact = fs.readFileSync(CLIENT, 'utf8')
// eslint-disable-next-line no-new-func
new Function('window', 'document', artifact)(global.window, global.document)
assert.ok(registration !== null, 'client.js must register a module')
assert.strictEqual(registration.id, '@local/token-breakdown-stats')

const mod = registration.factory((name) => {
  if (!browserModules.has(name)) throw new Error(`unexpected module request: ${name}`)
  return browserModules.get(name)
})

assert.ok(typeof mod.apply === 'function', 'entry must export apply()')
assert.deepStrictEqual(mod.inject, ['slots', 'locale'], 'entry must export its service inject list')

/* ------------------------------------------------------------------ *
 * Fixtures.
 * ------------------------------------------------------------------ */

const zh = JSON.parse(fs.readFileSync(path.join(BUNDLE_DIR, 'locale', 'zh.json'), 'utf8'))
const en = JSON.parse(fs.readFileSync(path.join(BUNDLE_DIR, 'locale', 'en.json'), 'utf8'))

function translate(dict) {
  return (key, params) => {
    const template = dict[key]
    assert.ok(template !== undefined, `missing locale key: ${key}`)
    return String(template).replace(/\{(\w+)\}/g, (_m, name) => String(params?.[name] ?? ''))
  }
}

const ROOT = 'root-1'
const CHILD_A = 'child-a'
const CHILD_B = 'child-b'
const GRANDCHILD = 'grandchild-1'

function projectionSnapshot(values) {
  return { state: 'ready', values, error: null }
}

function baseState() {
  return {
    projections: {
      [ROOT]: projectionSnapshot({
        subagentCatalog: [
          { id: CHILD_A, createdAt: 1, mode: 'one-shot', label: '检索资料' },
          { id: CHILD_B, createdAt: 2, mode: 'continuable' },
        ],
      }),
      [CHILD_A]: projectionSnapshot({
        subagentCatalog: [{ id: GRANDCHILD, createdAt: 3, mode: 'one-shot' }],
      }),
    },
    summaries: {
      [CHILD_A]: {
        running: false,
        projectionValues: {
          tokenUsage: { uncachedInputTokens: 1_000, cacheReadTokens: 4_000, cacheWriteTokens: 500, outputTokens: 500 },
          subagent: { label: '检索资料' },
        },
      },
      [CHILD_B]: {
        running: true,
        projectionValues: {
          tokenUsage: { uncachedInputTokens: 200, cacheReadTokens: 800, cacheWriteTokens: 0, outputTokens: 100 },
        },
      },
      [GRANDCHILD]: {
        running: false,
        projectionValues: {
          tokenUsage: { uncachedInputTokens: 50, cacheReadTokens: 150, cacheWriteTokens: 0, outputTokens: 25 },
          subagent: { label: '孙任务' },
        },
      },
    },
    statuses: new Map([[CHILD_B, { running: true }]]),
  }
}

/**
 * Materialized chat nodes as `ChatSnapshot.nodes.values()` returns them: the
 * keyed store holds every Chat Node, including `turn-tail` rows.
 */
function nodesFixture() {
  return [
    {
      kind: 'assistant-step',
      turn: 1,
      step: 1,
      data: {
        status: 'settled',
        turn: 1,
        step: 1,
        blocks: [],
        time: 2_500,
        usage: { outputTokens: 120 },
        finalNode: {
          kind: 'assistant', seq: 10, time: 2_500, turn: 1, step: 1, blocks: [],
          usage: { outputTokens: 120 },
          timing: { stepStartTime: 0, firstTokenTime: 500, completedTime: 2_500 },
        },
      },
    },
    {
      kind: 'turn-tail',
      data: {
        tokenUsage: {
          uncachedInputTokens: 10_000,
          outputTokens: 2_000,
          totalTokens: 42_000,
          cacheReadTokens: 30_000,
          routes: [{ provider: 'magpie-responses', model: 'group/auto-step-5-preview' }],
        },
      },
    },
    {
      kind: 'turn-tail',
      data: {
        tokenUsage: {
          uncachedInputTokens: 5_000,
          outputTokens: 1_000,
          totalTokens: 21_000,
          cacheReadTokens: 15_000,
          routes: [
            { provider: 'magpie-responses', model: 'group/auto-step-5-preview' },
            { provider: 'other', model: 'small' },
          ],
        },
      },
    },
  ]
}

const MAIN_USAGE = { uncachedInputTokens: 20_000, cacheReadTokens: 60_000, cacheWriteTokens: 2_000, outputTokens: 5_000 }

/* ------------------------------------------------------------------ *
 * 1. Aggregator math.
 * ------------------------------------------------------------------ */

const aggregator = require('./token-aggregator.cjs')

{
  const facts = aggregator.collectTokenFacts({
    sessionId: ROOT,
    projections: baseState().projections,
    summaries: baseState().summaries,
    statuses: baseState().statuses,
    mainUsage: MAIN_USAGE,
    nodes: nodesFixture(),
  })

  // main: 20000 + 60000 + 2000 + 5000 = 87000
  assert.strictEqual(facts.main.total, 87_000, 'main total')
  // children: a=6000, b=1100, grandchild=225
  assert.strictEqual(facts.discovered, 3, 'three descendants discovered')
  assert.strictEqual(facts.subagentTotal, 7_325, 'subagent total')
  assert.strictEqual(facts.totalTokens, 94_325, 'grand total')
  assert.strictEqual(facts.hasSubagents, true)
  assert.ok(facts.mainShare > 0.9 && facts.mainShare < 0.93, 'main share')

  const [childA, childB, grandchild] = facts.children
  assert.strictEqual(childA.label, '检索资料', 'label from subagent identity')
  assert.strictEqual(childA.mode, 'one-shot')
  assert.strictEqual(childB.label, CHILD_B, 'label falls back to id')
  assert.strictEqual(childB.mode, 'continuable')
  assert.strictEqual(childB.running, true, 'running from status map')
  assert.strictEqual(grandchild.depth, 2, 'grandchild depth')
  assert.strictEqual(grandchild.label, '孙任务')

  // Two distinct routes, the repeated one folding both turn-tails (42k + 21k).
  const routes = facts.main.routes
  assert.strictEqual(routes.length, 2, 'routes deduplicated')
  const step = routes.find(r => r.model === 'group/auto-step-5-preview')
  assert.strictEqual(step.total, 63_000, 'folded route total')
}

{
  // REGRESSION: `turn-tail` makes no contribution to `legacy.nodes`, so a node
  // list built from the legacy slice yields NO routes even when turns closed.
  // This is why the component reads `snapshot.nodes.values()`.
  const legacyShaped = [
    { kind: 'assistant', seq: 1, turn: 1, step: 1, blocks: [], usage: {}, timing: {} },
    { kind: 'tool-result', seq: 2, time: 3_000, callTime: 2_000, content: [] },
  ]
  const facts = aggregator.collectTokenFacts({
    sessionId: ROOT,
    projections: {},
    summaries: {},
    statuses: new Map(),
    mainUsage: MAIN_USAGE,
    nodes: legacyShaped,
  })
  assert.strictEqual(facts.main.routes.length, 0, 'the legacy slice carries no turn-tail rows')

  // The same session read through the keyed store does carry them.
  const keyed = aggregator.collectTokenFacts({
    sessionId: ROOT,
    projections: {},
    summaries: {},
    statuses: new Map(),
    mainUsage: MAIN_USAGE,
    nodes: [...legacyShaped, ...nodesFixture().filter(node => node.kind === 'turn-tail')],
  })
  assert.strictEqual(keyed.main.routes.length, 2, 'the keyed store carries the turn-tail rows')
}

{
  // No subagents at all.
  const facts = aggregator.collectTokenFacts({
    sessionId: ROOT,
    projections: {},
    summaries: {},
    statuses: new Map(),
    mainUsage: MAIN_USAGE,
    nodes: [],
  })
  assert.strictEqual(facts.discovered, 0)
  assert.strictEqual(facts.subagentTotal, 0)
  assert.strictEqual(facts.totalTokens, 87_000)
  assert.strictEqual(facts.hasSubagents, false)
  assert.deepStrictEqual(facts.main.routes, [])
}

{
  // A child discovered but without any usage yet.
  const facts = aggregator.collectTokenFacts({
    sessionId: ROOT,
    projections: { [ROOT]: projectionSnapshot({ subagentCatalog: [{ id: 'fresh', createdAt: 1, mode: 'unknown' }] }) },
    summaries: {},
    statuses: new Map(),
    mainUsage: undefined,
    nodes: [],
  })
  assert.strictEqual(facts.discovered, 1)
  assert.strictEqual(facts.children[0].usage, null, 'unknown usage stays null')
  assert.strictEqual(facts.totalTokens, 0)
  assert.strictEqual(facts.hasAnyUsage, false)
}

{
  // Cache-hit percentages, including the never-round-to-100 rule.
  assert.strictEqual(aggregator.cacheHitPercent(0, 0), null)
  assert.strictEqual(aggregator.cacheHitPercent(50, 50), '100')
  assert.strictEqual(aggregator.cacheHitPercent(30_000, 42_000), '71')
  assert.strictEqual(aggregator.cacheHitPercent(999, 1_000), '99.9')
  assert.strictEqual(aggregator.cacheHitPercent(9_999, 10_000), '99.99')
  assert.strictEqual(aggregator.usageTotal({ uncachedInputTokens: 1, cacheReadTokens: 2, cacheWriteTokens: 3, outputTokens: 4 }), 10)
}

/* ------------------------------------------------------------------ *
 * 2 + 3. Render the dock row and open the dialog.
 * ------------------------------------------------------------------ */

// The entry module re-exports the component through its registration only, so
// reach it through the slot registration the same way the dock does.
let registered = null

/**
 * A faithful stand-in for the slot service's list-cell rule: a second
 * registration that reuses an id at the SAME priority throws, because the
 * shipped `ui-chat` row already occupies that cell. A permissive mock here is
 * what let that collision reach a real boot and take ui-chat down with it.
 */
const slotCells = [{ id: 'stats', priority: 0, registrant: 'ui-chat' }]
const slots = {
  register: (options, component) => {
    const priority = options.priority ?? 0
    if (options.id !== undefined) {
      const occupant = slotCells.find(cell => cell.id === options.id && cell.priority === priority)
      if (occupant !== undefined) {
        throw new Error(`list slot "${options.name}" already has an entry with id "${options.id}" at priority ${priority} (registered by ${occupant.registrant}) — register at a different priority to shadow it (lowest renders)`)
      }
      slotCells.push({ id: options.id, priority, registrant: 'token-breakdown-stats' })
    }
    registered = { options, component }
    return component
  },
  inject: (_slot, callback) => callback(),
}
const locale = {
  register: () => () => {},
}
const settings = {
  getSnapshot: () => ({ value: { performanceUsage: 'detailed' } }),
  subscribe: () => () => {},
}

/**
 * A faithful stand-in for the restricted Client context: reading a service
 * that was not declared in `inject` THROWS instead of returning undefined, and
 * `ctx.get` answers only for declared names. A permissive mock here is exactly
 * what let the `configForms` crash reach a real boot.
 * @param services - service name to value map.
 * @returns the context object.
 */
function restrictedCtx(services) {
  const handler = {
    get(target, prop) {
      if (typeof prop !== 'string') return target[prop]
      if (prop in services) return services[prop]
      if (prop === 'get' || prop === 'effect' || prop === 'on' || prop === 'provide') return target[prop]
      throw new Error(`cannot get property "${prop}" without inject`)
    },
    has: (_target, prop) => typeof prop === 'string' && (prop in services || prop === 'get' || prop === 'effect'),
  }
  const base = {
    get: (name) => (name in services ? services[name] : undefined),
    effect: (fn) => { fn(); return () => {} },
  }
  return new Proxy(base, handler)
}

const ctx = restrictedCtx({
  slots,
  locale,
  configForms: { get: () => settings },
})
mod.apply(ctx)

assert.ok(registered !== null, 'the plugin must register a dock cell')
assert.strictEqual(registered.options.name, 'conversation.composer.dock')
assert.strictEqual(registered.options.id, 'stats', 'must displace the shipped stats cell')
assert.strictEqual(registered.options.order, 0)
assert.ok(
  typeof registered.options.priority === 'number' && registered.options.priority < 0,
  `must sit below the shipped priority 0 to shadow it, got ${String(registered.options.priority)}`,
)

const chatSnapshot = {
  legacy: { nodes: [{ kind: 'assistant', seq: 1, turn: 1, step: 1, blocks: [], usage: { outputTokens: 120 }, timing: { stepStartTime: 0, firstTokenTime: 500, completedTime: 2_500 } }] },
  nodes: { values: () => nodesFixture() },
}
const dockProps = {
  useChat: (selector) => selector(chatSnapshot),
  useProjection: (key) => (key === 'tokenUsage' ? MAIN_USAGE : undefined),
  useSessions: (selector) => selector({
    projectionsBySession: baseState().projections,
    byId: baseState().summaries,
  }),
  useSessionStatus: (selector) => selector(baseState().statuses),
  sessionId: ROOT,
  t: translate(zh),
}

let tree = rerender(createElement(registered.component, dockProps))

function collect(node, predicate, out = []) {
  if (node === null || typeof node !== 'object') return out
  if (Array.isArray(node)) { node.forEach(child => collect(child, predicate, out)); return out }
  if (predicate(node)) out.push(node)
  ;(node.children ?? []).forEach(child => collect(child, predicate, out))
  return out
}

function textOf(node) {
  if (node === null || node === undefined) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (typeof node === 'object') return (node.children ?? []).map(textOf).join('')
  return ''
}

// The usage pill label must carry the grand total, not just the main agent.
const pillButtons = collect(tree, node => node.type === 'button' && node.props['aria-haspopup'] === 'dialog')
assert.strictEqual(pillButtons.length, 2, 'time pill and usage pill')
const usageButton = pillButtons[1]
assert.ok(textOf(usageButton).includes('94.3K'), `pill must show the grand total, got: ${textOf(usageButton)}`)
assert.ok(textOf(usageButton).includes('子 3'), 'pill must show the subagent COUNT')
assert.ok(!textOf(usageButton).includes('7.3K'), 'pill must not carry the subagent aggregate')
assert.ok(usageButton.props['aria-label'].includes('94,325'), 'aria label carries the exact total')
assert.ok(usageButton.props['aria-label'].includes('7,325'), 'aria label carries the subagent aggregate')
assert.ok(usageButton.props['aria-label'].includes('3 个'), 'aria label keeps the subagent count')

// Open the usage dialog.
usageButton.props.onClick()
tree = rerender(createElement(registered.component, dockProps))
const dialog = collect(tree, node => node.props?.role === 'dialog')
assert.strictEqual(dialog.length, 1, 'opening the pill opens exactly one dialog')

const body = textOf(dialog[0])
for (const fragment of [
  'Token 用量', '94,325', '主 Agent', '子 Agent（3）', '按模型',
  'magpie-responses/group/auto-step-5-preview', 'other/small',
  '共 3 个 · 运行中 1 个 · 占总量 7.8%',   // the subagent aggregate line
  '未缓存输入', '缓存读取', '输出',
]) {
  assert.ok(body.includes(fragment), `dialog must contain: ${fragment}`)
}
// The model row and the by-model section agree here, because both routes closed.
const byModelSection = body.slice(body.indexOf('按模型'))
assert.ok(byModelSection.includes('63K tok · 75%'), 'by-model must show the folded attributed total')
assert.ok(byModelSection.includes('21K tok · 25%'), 'by-model must show the second attributed total')
// Subagents are aggregated: no per-child labels, modes or depth markers.
for (const fragment of ['检索资料', '孙任务', 'child-b', '第 2 层', '可续聊', '一次性']) {
  assert.ok(!body.includes(fragment), `dialog must NOT itemize subagents: ${fragment}`)
}
assert.ok(!body.includes('本次会话还没有调用子 Agent'), 'subagents exist, so the empty note must be hidden')
// The aggregate buckets are the folded subagent usage: 1250 / 4950 / 500 / 625.
for (const fragment of ['1,250', '4,950', '500', '625']) {
  assert.ok(body.includes(fragment), `dialog must carry the folded subagent bucket: ${fragment}`)
}

// Escape closes it.
for (const handler of listeners.get('keydown') ?? []) handler({ key: 'Escape' })
tree = rerender(createElement(registered.component, dockProps))
assert.strictEqual(collect(tree, node => node.props?.role === 'dialog').length, 0, 'Escape closes the dialog')

/* ------------------------------------------------------------------ *
 * Restricted-context safety: an undeclared service must never throw.
 * ------------------------------------------------------------------ */
{
  // No configForms at all: the pill must still mount, in detailed form.
  const bare = restrictedCtx({ slots, locale })
  let bareRegistered = null
  const bareSlots = {
    register: (options, component) => { bareRegistered = { options, component }; return component },
    inject: (_slot, callback) => callback(),
  }
  const bareCtx = restrictedCtx({ slots: bareSlots, locale })
  mod.apply(bareCtx)
  assert.ok(bareRegistered !== null, 'the plugin must mount without configForms')
  const bareTree = rerender(createElement(bareRegistered.component, dockProps))
  assert.ok(textOf(bareTree).includes('94.3K'), 'the usage pill still reports the grand total')

  // configForms present but broken: same requirement.
  const brokenCtx = restrictedCtx({
    slots: bareSlots,
    locale,
    configForms: { get: () => { throw new Error('scope unavailable') } },
  })
  mod.apply(brokenCtx)
  assert.ok(bareRegistered !== null, 'a broken config scope must not break activation')
}

/* ------------------------------------------------------------------ *
 * Compact mode: plain readings, no dialog.
 * ------------------------------------------------------------------ */
{
  const compactSettings = {
    getSnapshot: () => ({ value: { performanceUsage: 'compact' } }),
    subscribe: () => () => {},
  }
  const compactSlots = {
    register: (options, component) => { registered = { options, component }; return component },
    inject: (_slot, callback) => callback(),
  }
  const compactCtx = restrictedCtx({
    slots: compactSlots,
    locale,
    configForms: { get: () => compactSettings },
  })
  mod.apply(compactCtx)
  const compactTree = rerender(createElement(registered.component, dockProps))
  const compactBody = textOf(compactTree)
  assert.ok(!compactBody.includes('主 Agent'), 'compact mode shows no dialog content')
  assert.ok(collect(compactTree, node => node.type === 'button').length === 0, 'compact mode has no buttons')
  assert.ok(compactBody.includes('tok/s'), 'compact mode keeps the speed reading')
}

/* ------------------------------------------------------------------ *
 * English dictionary parity.
 * ------------------------------------------------------------------ */
for (const key of Object.keys(zh)) {
  assert.ok(en[key] !== undefined, `en.json missing key: ${key}`)
}
for (const key of Object.keys(en)) {
  assert.ok(zh[key] !== undefined, `zh.json missing key: ${key}`)
}

console.log('smoke test OK')
console.log(`  modules registered: ${registration.id}`)
console.log(`  dock cell: ${registered.options.name}#${registered.options.id} (order ${registered.options.order})`)
