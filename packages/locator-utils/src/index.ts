/**
 * @qa-platform/locator-utils
 *
 * Locator generation (content script side) and locator resolution (Playwright side).
 */

export { generateLocator, describeLocator } from './generator.js';
export type { DomElementSnapshot } from './generator.js';

export { resolveLocator, getLocator } from './resolver.js';
export type { ResolveOptions, ResolveResult } from './resolver.js';

export { isSensitiveField, maskIfSensitive, MASKED_VALUE } from './sensitive.js';
export type { SensitivityCheckInput } from './sensitive.js';
