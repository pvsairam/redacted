/**
 * Locator Resolver
 *
 * Resolves a LocatorObject into a Playwright Locator at replay time.
 * Tries the primary strategy first, then each fallback in order.
 *
 * This is the bridge between recorded locator data and live Playwright execution.
 */

import type { LocatorEntry, LocatorObject } from '@qa-platform/shared';
import type { Page, Locator } from '@playwright/test';
import { describeLocator } from './generator.js';

/**
 * Converts a LocatorEntry into a Playwright Locator on the given page.
 */
function entryToPlaywrightLocator(page: Page, entry: LocatorEntry): Locator {
  switch (entry.strategy) {
    case 'aria-label':
      return page.getByLabel(entry.value, { exact: false });

    case 'role':
      return page.getByRole(
        entry.value as Parameters<Page['getByRole']>[0],
        entry.name ? { name: entry.name } : undefined,
      );

    case 'label':
      return page.getByLabel(entry.value, { exact: false });

    case 'placeholder':
      return page.getByPlaceholder(entry.value, { exact: false });

    case 'text':
      return page.getByText(entry.value, { exact: false });

    case 'data-testid':
      return page.getByTestId(entry.value);

    case 'name':
      return page.locator(`[name="${entry.value}"]`);

    case 'id':
      // Simple ID escape: prefix numbers, escape special CSS chars
      return page.locator(`#${entry.value.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\\\$1')}`);

    case 'css': {
      // Sanitize CSS selectors containing colons in ID segments (e.g. Oracle ADF '#pt1:atklc1').
      // A colon in a CSS ID selector is treated as a pseudo-class separator, causing
      // a SyntaxError. We escape each colon that appears after a '#word' segment.
      const sanitized = entry.value.replace(/(#[^\s[>.+~,:(]+):(\w)/g, '$1\\:$2');
      return page.locator(sanitized);
    }

    case 'xpath':
      return page.locator(`xpath=${entry.value}`);

    default:
      // Exhaustive check — TypeScript will catch unknown strategies at compile time
      throw new Error(`Unknown locator strategy: ${String(entry.strategy)}`);
  }
}

export interface ResolveOptions {
  /** Timeout in ms to check if each candidate is visible */
  checkTimeoutMs?: number;
}

export interface ResolveResult {
  locator: Locator;
  /** The entry that succeeded */
  matchedEntry: LocatorEntry;
  /** Number of fallbacks tried before finding a match */
  fallbacksTriedCount: number;
}

/**
 * Resolves a LocatorObject to a live Playwright Locator.
 *
 * Strategy:
 * 1. Try primary locator — if visible within checkTimeoutMs, use it.
 * 2. For each fallback in order: try the same visibility check.
 * 3. If no locator resolves, throw a descriptive error.
 *
 * This does NOT throw on the primary failing — it gracefully degrades.
 */
export async function resolveLocator(
  page: Page,
  locatorObj: LocatorObject,
  options: ResolveOptions = {},
): Promise<ResolveResult> {
  const { checkTimeoutMs = 2000 } = options;

  const allEntries: LocatorEntry[] = [locatorObj.primary, ...locatorObj.fallbacks];

  let lastError: Error | null = null;

  for (let i = 0; i < allEntries.length; i++) {
    const entry = allEntries[i]!;
    try {
      const locator = entryToPlaywrightLocator(page, entry);
      // Quick visibility check — if visible within checkTimeoutMs, this is our match
      await locator.waitFor({ state: 'visible', timeout: checkTimeoutMs });
      return {
        locator,
        matchedEntry: entry,
        fallbacksTriedCount: i,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // If the error is a SyntaxError (invalid CSS selector like Oracle ADF IDs with colons),
      // skip this locator immediately — no point retrying an invalid selector string.
      if (lastError.message.includes('SyntaxError') || lastError.message.includes('is not a valid selector')) {
        // Skip silently — already captured as lastError
        continue;
      }
      // Continue to next fallback
      continue;
    }
  }

  // All strategies failed — build a clear, actionable error message
  const primaryDesc = describeLocator(locatorObj.primary);
  const fallbackDescs = locatorObj.fallbacks.map(describeLocator).join(', ');
  const message = [
    `Could not find element using any of the recorded locator strategies.`,
    `  Primary: ${primaryDesc}`,
    fallbackDescs ? `  Fallbacks tried: ${fallbackDescs}` : '',
    `  Ensure the page has loaded and the element is visible.`,
    `  Last error: ${lastError?.message ?? 'unknown'}`,
  ]
    .filter(Boolean)
    .join('\n');

  throw new Error(message);
}

/**
 * Returns a Playwright Locator without checking visibility.
 * Use this when you only need the locator reference (e.g., for assertions).
 */
export function getLocator(page: Page, locatorObj: LocatorObject): Locator {
  return entryToPlaywrightLocator(page, locatorObj.primary);
}
