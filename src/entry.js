/**
 * Plugin entry: registers the locale dictionaries and displaces the shipped
 * `conversation.composer.dock` statistics cells.
 *
 * DSH splits the composer statistics differently by version:
 *
 *  - `0.2.0-rc.2` had ONE cell, id `stats`, holding both pills.
 *  - `0.2.1-rc.2` registers TWO cells, id `activity` (order 0) and id `usage`
 *    (order 1), each holding one pill.
 *
 * A registration is matched to the shipped row by (slot, id, priority): the
 * lowest priority for a given id renders, so reusing the shipped id at a
 * strictly lower priority REPLACES that control. Registering an id the shipped
 * bundle does not use ADDS a control instead — which is exactly how the old
 * single `stats` row surfaced as duplicate pills once the dock split in two.
 *
 * This entry therefore mirrors the CURRENT shipped rows one for one, so the
 * plugin replaces both controls whichever way the bundle is composed.
 */

import React from 'react'
import { ActivityStats, UsageStats } from './stats-pills.js'
import { zh, en } from './__locale.js'

const { createElement: h } = React

/** Locale namespace owned by this plugin. */
export const NS = 'chat-token-breakdown'

/**
 * Services the Client half needs from its Cordis context.
 *
 * Only the two services this module certainly uses are declared. Every other
 * service — `configForms` in particular — is read defensively, because an
 * undeclared service access throws on the restricted context and an
 * unresolvable declared name leaves the entry pending.
 */
export const inject = ['slots', 'locale']

/** Dock slot the shipped statistics controls live in. */
const SLOT = 'conversation.composer.dock'

/**
 * The shipped cells this plugin displaces, in dock order.
 *
 * Both ids and both orders mirror the shipped `ui-chat` rows exactly:
 * `activity` at order 0 (turn/step counts and speed) and `usage` at order 1
 * (token total and cache hit).
 */
const CELLS = [
  { id: 'activity', order: 0, Component: ActivityStats },
  { id: 'usage', order: 1, Component: UsageStats },
]

/**
 * Priority strictly below the shipped rows' 0.
 *
 * A list slot REJECTS a second registration that reuses an id at the same
 * priority: `register` throws "already has an entry with id … register at a
 * different priority to shadow it (lowest renders)". The shipped `ui-chat` rows
 * occupy these cells at the default priority 0, so a replacement must sit below
 * them. A dynamic plugin is granted a lower priority automatically; this one
 * passes it explicitly so the replacement works whichever way the bundle is
 * composed.
 */
const CELL_PRIORITY = -1

/** Config namespace the shipped statistics preference lives in. */
const SETTINGS_NAMESPACE = 'ui-chat'

/**
 * Read the `ui-chat` settings scope, or null when it cannot be reached.
 *
 * The restricted Client context THROWS on a service that was not declared in
 * `inject` — it does not return undefined — so every access is guarded. A
 * plugin cannot safely declare another package's service either, because an
 * unresolvable name leaves the whole entry pending instead of active. This is
 * therefore best-effort: when the scope is unreachable the pill stays in its
 * detailed form, which is the form this plugin exists to provide.
 * @param ctx - Client root context.
 * @returns the settings scope or null.
 */
function readSettings(ctx) {
  let configForms
  try {
    configForms = typeof ctx.get === 'function' ? ctx.get('configForms') : undefined
  } catch {
    configForms = undefined
  }
  if (configForms === undefined || configForms === null) return null
  if (typeof configForms.get !== 'function') return null
  try {
    const settings = configForms.get(SETTINGS_NAMESPACE)
    return settings === undefined ? null : settings
  } catch {
    return null
  }
}

/**
 * Build the `compact` / `detailed` mode hook from the `ui-chat` settings scope.
 *
 * The shipped pill receives this preference through its own injected hook,
 * which a plugin cannot borrow; reading the same config scope keeps the
 * preference honoured. An unavailable scope falls back to `detailed`.
 * @param settings - `ui-chat` config scope, or null.
 * @returns a React hook returning the current mode.
 */
export function createModeHook(settings) {
  const read = () => {
    if (settings === null || typeof settings.getSnapshot !== 'function') return 'detailed'
    const snapshot = settings.getSnapshot()
    const value = snapshot === null || snapshot === undefined ? undefined : snapshot.value?.performanceUsage
    return value === 'compact' || value === 'detailed' ? value : 'detailed'
  }
  if (settings === null || typeof settings.subscribe !== 'function') {
    return function useMode() { return read() }
  }
  const subscribe = (listener) => settings.subscribe(listener)
  return function useMode() {
    return React.useSyncExternalStore(subscribe, read, read)
  }
}

/**
 * Mount the replacement statistics controls.
 *
 * Every step is guarded and logged: a plugin that throws during activation
 * takes the whole client entry down with it, so the real cause must reach the
 * console (and therefore the crash log) instead of surfacing as an opaque
 * "entry did not activate".
 *
 * Both cells are registered from ONE `slots.inject` generator, exactly as the
 * shipped `ui-chat` row does, so they share one disposal scope and cannot
 * half-mount: if either registration is rejected the whole generator unwinds.
 *
 * @param ctx - Client root context.
 */
export function apply(ctx) {
  try {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'token-breakdown-stats: dictionaries')
    const useMode = createModeHook(readSettings(ctx))

    ctx.slots.inject(SLOT, function* () {
      for (const { id, order, Component } of CELLS) {
        yield ctx.slots.register({
          name: SLOT,
          id,
          order,
          priority: CELL_PRIORITY,
          locale: NS,
        }, (props) => h(Component, { ...props, useMode }))
      }
    })
  } catch (error) {
    console.error('[token-breakdown-stats] apply failed:', error)
    throw error
  }
}
