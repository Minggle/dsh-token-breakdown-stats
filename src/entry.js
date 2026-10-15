/**
 * Plugin entry: registers the locale dictionaries and displaces the shipped
 * `conversation.composer.dock` `stats` entry.
 *
 * Registration mirrors the shipped `ui-chat` row exactly (same slot, same id,
 * same order) so this plugin REPLACES the built-in pill instead of adding a
 * second one. A dynamically installed plugin receives a lower priority, so
 * this row wins the cell.
 */

import React from 'react'
import { StatsPills } from './stats-pills.js'
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

/** Dock slot and cell this plugin displaces (identical to the shipped row). */
const SLOT = 'conversation.composer.dock'
const CELL_ID = 'stats'
const CELL_ORDER = 0

/**
 * Priority strictly below the shipped row's 0.
 *
 * A list slot REJECTS a second registration that reuses an id at the same
 * priority: `register` throws "already has an entry with id … register at a
 * different priority to shadow it (lowest renders)". The shipped `ui-chat` row
 * occupies this cell at priority 0, so a replacement must sit below it. A
 * dynamic plugin is granted a lower priority automatically; this one passes it
 * explicitly so the replacement works whichever way the bundle is composed.
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
 * Mount the replacement stats pill.
 *
 * Every step is guarded and logged: a plugin that throws during activation
 * takes the whole client entry down with it, so the real cause must reach the
 * console (and therefore the crash log) instead of surfacing as an opaque
 * "entry did not activate".
 * @param ctx - Client root context.
 */
export function apply(ctx) {
  try {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'token-breakdown-stats: dictionaries')
    const useMode = createModeHook(readSettings(ctx))

    ctx.slots.inject(SLOT, () => ctx.slots.register({
      name: SLOT,
      id: CELL_ID,
      order: CELL_ORDER,
      priority: CELL_PRIORITY,
      locale: NS,
    }, (props) => h(StatsPills, { ...props, useMode })))
  } catch (error) {
    console.error('[token-breakdown-stats] apply failed:', error)
    throw error
  }
}
