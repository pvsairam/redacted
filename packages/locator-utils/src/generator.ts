/**
 * Locator Generator
 *
 * Generates a LocatorObject from a DOM element snapshot (captured in the
 * browser extension content script).
 *
 * Priority order (most stable → least stable):
 * 1. aria-label
 * 2. role + accessible name
 * 3. label text (via htmlFor or wrapping label)
 * 4. placeholder
 * 5. visible text content
 * 6. data-testid or other stable data-* attributes
 * 7. name attribute
 * 8. stable ID (not generated/dynamic looking)
 * 9. relative CSS selector
 * 10. relative XPath (last resort only)
 */

import type { LocatorEntry, LocatorObject, LocatorStrategyType } from '@qa-platform/shared';

export interface DomElementSnapshot {
  tagName: string;
  id?: string;
  name?: string;
  type?: string;
  role?: string;
  ariaLabel?: string;
  placeholder?: string;
  text?: string;
  labelText?: string;
  dataTestId?: string;
  /** Other stable data-* attributes */
  dataAttributes?: Record<string, string>;
  /** CSS path relative to nearest stable ancestor */
  cssPath?: string;
  /** XPath relative to nearest stable ancestor */
  xpathPath?: string;
  /** autocomplete attribute */
  autocomplete?: string;
  /** value attribute */
  value?: string;
}

/**
 * Heuristic: an ID looks generated/dynamic if it:
 * - contains only digits
 * - contains a long hex string (UUID-like)
 * - looks like a React/framework-generated ID
 */
function isStableId(id: string): boolean {
  if (!id || id.trim() === '') return false;
  // Pure digits → likely auto-generated index
  if (/^\d+$/.test(id)) return false;
  // Long hex/UUID patterns (>12 chars of hex)
  if (/[0-9a-f]{12,}/i.test(id)) return false;
  // Short random-looking IDs (contains numbers mixed with letters of total >16 chars)
  if (id.length > 20 && /[0-9]/.test(id)) return false;
  // React-specific patterns
  if (/^:r[0-9a-z]+:$/.test(id)) return false;
  return true;
}

/**
 * Returns a clean text value (trimmed, collapsed whitespace).
 */
function cleanText(text: string | undefined): string | null {
  if (!text) return null;
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Generates the primary + fallback locator strategies for a DOM element.
 */
export function generateLocator(el: DomElementSnapshot): LocatorObject {
  const candidates: LocatorEntry[] = [];

  // 1. aria-label (most stable semantic identifier)
  const ariaLabel = cleanText(el.ariaLabel);
  if (ariaLabel) {
    candidates.push({ strategy: 'aria-label', value: ariaLabel });
  }

  // 2. role + accessible name (via aria-label or text)
  const role = el.role?.toLowerCase();
  const accessibleName = ariaLabel ?? cleanText(el.text);
  if (role && accessibleName) {
    candidates.push({ strategy: 'role', value: role, name: accessibleName });
  }

  // 3. label text (associated label element)
  const labelText = cleanText(el.labelText);
  if (labelText) {
    candidates.push({ strategy: 'label', value: labelText });
  }

  // 4. placeholder
  const placeholder = cleanText(el.placeholder);
  if (placeholder) {
    candidates.push({ strategy: 'placeholder', value: placeholder });
  }

  // 5. visible text (for buttons, links, etc.)
  const text = cleanText(el.text);
  const isTextualElement = ['button', 'a', 'label', 'span', 'h1', 'h2', 'h3', 'li'].includes(
    el.tagName.toLowerCase(),
  );
  if (text && isTextualElement && text.length <= 80) {
    candidates.push({ strategy: 'text', value: text });
  }

  // 6. data-testid (or other stable data-* attributes)
  if (el.dataTestId) {
    candidates.push({ strategy: 'data-testid', value: el.dataTestId });
  } else if (el.dataAttributes) {
    // Look for other stable data-* attributes (data-qa, data-cy, data-id)
    const stableDataAttrs = ['data-qa', 'data-cy', 'data-id', 'data-automation-id'];
    for (const attr of stableDataAttrs) {
      const attrKey = attr.replace('data-', '');
      if (el.dataAttributes[attrKey]) {
        candidates.push({ strategy: 'data-testid', value: el.dataAttributes[attrKey]! });
        break;
      }
    }
  }

  // 7. name attribute (for inputs, selects, textareas)
  if (el.name && ['input', 'select', 'textarea', 'button'].includes(el.tagName.toLowerCase())) {
    candidates.push({ strategy: 'name', value: el.name });
  }

  // 8. stable ID only
  if (el.id && isStableId(el.id)) {
    candidates.push({ strategy: 'id', value: el.id });
  }

  // 9. CSS selector (relative)
  if (el.cssPath) {
    candidates.push({ strategy: 'css', value: el.cssPath });
  }

  // 10. XPath (last resort)
  if (el.xpathPath) {
    candidates.push({ strategy: 'xpath', value: el.xpathPath });
  }

  // We need at least one candidate — if somehow nothing was found,
  // fall back to a tag-based CSS selector
  if (candidates.length === 0) {
    if (el.cssPath) {
      candidates.push({ strategy: 'css', value: el.cssPath });
    } else {
      candidates.push({ strategy: 'css', value: el.tagName.toLowerCase() });
    }
  }

  const [primary, ...fallbacks] = candidates as [LocatorEntry, ...LocatorEntry[]];

  return { primary, fallbacks };
}

/**
 * Returns a human-readable description of a locator for logging.
 */
export function describeLocator(locator: LocatorEntry): string {
  const strategyMap: Record<LocatorStrategyType, string> = {
    'aria-label': `aria-label="${locator.value}"`,
    role: `role="${locator.value}"${locator.name ? ` name="${locator.name}"` : ''}`,
    label: `label="${locator.value}"`,
    placeholder: `placeholder="${locator.value}"`,
    text: `text="${locator.value}"`,
    'data-testid': `data-testid="${locator.value}"`,
    name: `name="${locator.value}"`,
    id: `id="${locator.value}"`,
    css: `css="${locator.value}"`,
    xpath: `xpath="${locator.value}"`,
  };
  return strategyMap[locator.strategy] ?? `${locator.strategy}="${locator.value}"`;
}
