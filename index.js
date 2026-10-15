/**
 * Host half of the token-breakdown stats plugin.
 *
 * The whole feature lives in the Client half: it replaces the shipped
 * `conversation.composer.dock` `stats` entry, so no Host row, Service, or
 * Event is needed. This file exists because a bundle patch row must resolve
 * to a package with a loadable entry.
 */

/** Mount nothing on the Host side. */
export function apply() {}
