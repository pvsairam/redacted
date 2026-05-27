/**
 * Content Script
 *
 * Runs in the context of every web page (document_idle).
 *
 * Responsibilities:
 * - Listen for DOM events (click, input, change, keydown)
 * - Generate locators for interacted elements
 * - Mask sensitive field values before sending
 * - Detect URL changes
 * - Inject/remove the floating recording overlay
 * - Send recorded steps to background service worker
 *
 * Privacy:
 * - Passwords, tokens, and other sensitive fields are NEVER sent.
 * - Sensitive detection happens before any data leaves the content script.
 * - Hidden fields are completely ignored.
 */

import type { RecordedStep, ActionType } from '@qa-platform/shared';

// ─── Inline sensitive field detection ─────────────────────────────────────────
// (Inlined to avoid bundling Node.js-only Playwright dependencies)

const SENSITIVE_NAME_PATTERNS = [
  /password/i, /passwd/i, /secret/i, /token/i, /api.?key/i,
  /auth/i, /credential/i, /otp/i, /pin\b/i, /ssn/i,
  /credit.?card/i, /cvv/i, /cvc/i, /card.?num/i,
];

const SENSITIVE_AUTOCOMPLETE = new Set([
  'current-password', 'new-password', 'cc-number', 'cc-csc',
  'cc-exp', 'cc-exp-month', 'cc-exp-year',
]);

function isSensitiveField(opts: {
  inputType?: string;
  name?: string;
  ariaLabel?: string;
  labelText?: string;
  placeholder?: string;
  autocomplete?: string;
}): boolean {
  if (opts.inputType === 'password') return true;
  if (opts.autocomplete && SENSITIVE_AUTOCOMPLETE.has(opts.autocomplete)) return true;
  const candidates = [opts.name, opts.ariaLabel, opts.labelText, opts.placeholder]
    .filter(Boolean) as string[];
  return candidates.some((c) => SENSITIVE_NAME_PATTERNS.some((p) => p.test(c)));
}

// ─── Inline locator generation ─────────────────────────────────────────────────

/**
 * Heuristic: an ID looks generated/dynamic if it:
 * - contains only digits
 * - contains a long hex string (UUID-like)
 * - looks like a React/framework-generated ID
 */
function isStableId(id: string): boolean {
  if (!id || id.trim() === '') return false;
  if (/^\d+$/.test(id)) return false;
  if (/[0-9a-f]{12,}/i.test(id)) return false;
  if (id.length > 20 && /[0-9]/.test(id)) return false;
  if (/^:r[0-9a-z]+:$/.test(id)) return false;
  return true;
}

/**
 * Generates a highly specific structural CSS path for an element.
 */
function getCssPath(el: Element): string {
  if (el.id && isStableId(el.id)) return `#${el.id}`;
  if (el === document.body) return 'body';
  
  let path = [];
  let curr: Element | null = el;
  while (curr && curr !== document.body) {
    let selector = curr.tagName.toLowerCase();
    if (curr.id && isStableId(curr.id)) {
      selector = `#${curr.id}`;
      path.unshift(selector);
      break;
    } else {
      let nth = 1;
      let sibling = curr.previousElementSibling;
      while (sibling) {
        if (sibling.tagName === curr.tagName) nth++;
        sibling = sibling.previousElementSibling;
      }
      if (nth > 1) selector += `:nth-of-type(${nth})`;
    }
    path.unshift(selector);
    curr = curr.parentElement;
  }
  return path.join(' > ');
}

function generateLocator(snapshot: {
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
  dataAttributes?: Record<string, string>;
  cssPath?: string;
}) {
  type Strategy = 'aria-label' | 'role' | 'label' | 'placeholder' | 'text' | 'data-testid' | 'name' | 'id' | 'css' | 'xpath';
  type LocatorEntry = { strategy: Strategy; value: string; name?: string };

  const primary: LocatorEntry =
    snapshot.ariaLabel
      ? { strategy: 'aria-label', value: snapshot.ariaLabel }
    : snapshot.labelText
      ? { strategy: 'label', value: snapshot.labelText }
    : snapshot.dataTestId
      ? { strategy: 'data-testid', value: snapshot.dataTestId }
    : snapshot.placeholder
      ? { strategy: 'placeholder', value: snapshot.placeholder }
    : snapshot.name
      ? { strategy: 'name', value: snapshot.name }
    : snapshot.text
      ? { strategy: 'text', value: snapshot.text }
    : snapshot.cssPath
      ? { strategy: 'css', value: snapshot.cssPath }
    : { strategy: 'css', value: snapshot.tagName };

  const fallbacks: LocatorEntry[] = [];
  if (snapshot.id && isStableId(snapshot.id)) fallbacks.push({ strategy: 'id', value: snapshot.id });
  if (snapshot.name && primary.strategy !== 'name')
    fallbacks.push({ strategy: 'name', value: snapshot.name });
  
  if (snapshot.cssPath) fallbacks.push({ strategy: 'css', value: snapshot.cssPath });
  else fallbacks.push({ strategy: 'css', value: snapshot.tagName });

  return { primary, fallbacks };
}

// ─── State ────────────────────────────────────────────────────────────────────

let isRecording = false;
let isPaused = false;
let lastClickTime = 0;
let lastClickTarget: Element | null = null;
let overlayRoot: HTMLElement | null = null;
let lastUrl = window.location.href;

// ─── Locator utilities ────────────────────────────────────────────────────────

function getElementSnapshot(el: Element) {
  const input = el as HTMLInputElement;
  const tagName = el.tagName.toLowerCase();
  const inputType = input.type?.toLowerCase();

  // Get associated label text
  let labelText: string | undefined;
  if (input.id) {
    const label = document.querySelector<HTMLLabelElement>(`label[for="${input.id}"]`);
    labelText = label?.textContent?.trim();
  }
  if (!labelText) {
    const parentLabel = el.closest('label');
    labelText = parentLabel?.textContent?.replace(input.value ?? '', '').trim();
  }

  const sensitivityInput = {
    inputType,
    name: input.name,
    ariaLabel: el.getAttribute('aria-label') ?? undefined,
    labelText,
    placeholder: input.placeholder,
    autocomplete: input.autocomplete,
  };

  // Use innerText to exclude script/style tag contents, falling back to textContent
  const elementText = ((el as HTMLElement).innerText ?? el.textContent ?? '').trim();

  const isSensitive = isSensitiveField(sensitivityInput);
  const rawValue = input.value ?? elementText;
  
  // Determine if this is a username/email field
  const isUsernameField = (() => {
    const candidates = [input.name, el.getAttribute('aria-label'), labelText, input.placeholder]
      .filter(Boolean)
      .map((s) => s!.toLowerCase());
    return candidates.some((c) => /user.?name|email|login|user.?id|account/i.test(c));
  })();

  // Always template credentials: passwords use {{PASSWORD}}, usernames use {{USERNAME}}
  // This prevents raw credentials from being stored in the DB and ensures replay
  // always uses the environment's configured credentials (never stale recorded values).
  const maskedValue = isSensitive
    ? '{{PASSWORD}}'
    : isUsernameField
      ? '{{USERNAME}}'
      : rawValue;

  // Build DOM snapshot for locator generator
  const dataAttributes: Record<string, string> = {};
  for (const attr of el.attributes) {
    if (attr.name.startsWith('data-') && attr.name !== 'data-testid') {
      const key = attr.name.replace('data-', '');
      dataAttributes[key] = attr.value;
    }
  }

  const snapshot = {
    tagName,
    id: el.id || undefined,
    name: input.name || undefined,
    type: inputType,
    role: el.getAttribute('role') ?? el.tagName.toLowerCase(),
    ariaLabel: el.getAttribute('aria-label') ?? undefined,
    placeholder: input.placeholder || undefined,
    text: elementText.substring(0, 100) || undefined,
    labelText,
    dataTestId: el.getAttribute('data-testid') ?? undefined,
    dataAttributes,
    cssPath: getCssPath(el),
  };

  const locator = generateLocator(snapshot);

  return {
    element: {
      tagName,
      text: elementText.substring(0, 100) || null,
      role: el.getAttribute('role') ?? null,
      ariaLabel: el.getAttribute('aria-label') ?? null,
      placeholder: input.placeholder || null,
      label: labelText ?? null,
      isSensitive,
      value: maskedValue,
    },
    locator,
    isSensitive,
    maskedValue,
  };
}

function buildStep(
  action: ActionType,
  el: Element,
  extra?: Partial<RecordedStep>,
): Omit<RecordedStep, 'id' | 'stepNumber'> {
  const { element, locator } = getElementSnapshot(el);

  return {
    action,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    pageTitle: document.title,
    title: `${action.charAt(0).toUpperCase() + action.slice(1)} ${element.text ?? element.role ?? el.tagName}`,
    description: `${action} on ${element.ariaLabel ?? element.text ?? el.tagName}`,
    element,
    locator,
    ...extra,
  };
}

function sendStep(step: Omit<RecordedStep, 'id' | 'stepNumber'>): void {
  chrome.runtime.sendMessage({ type: 'STEP_RECORDED', payload: step }).catch((err: unknown) => {
    console.error('[Content] Failed to send step:', err);
  });
}

// ─── Input Debouncing ─────────────────────────────────────────────────────────

let inputDebounceTimer: number | null = null;
let pendingInputStep: Omit<RecordedStep, 'id' | 'stepNumber'> | null = null;

function flushPendingInput(): void {
  if (pendingInputStep) {
    if (inputDebounceTimer) {
      window.clearTimeout(inputDebounceTimer);
      inputDebounceTimer = null;
    }
    sendStep(pendingInputStep);
    pendingInputStep = null;
  }
}

// ─── Event handlers ───────────────────────────────────────────────────────────

function handleClick(e: MouseEvent): void {
  flushPendingInput();
  if (!isRecording || isPaused) return;

  let target = e.target as Element | null;
  if (!target || target === overlayRoot || overlayRoot?.contains(target)) return;

  // Traverse up to find the closest interactive element (handles clicks on images/icons inside links)
  const interactiveTags = ['a', 'button', 'input', 'select', 'textarea', 'label'];
  let interactiveTarget: Element | null = null;
  let curr: Element | null = target;
  
  while (curr && curr !== document.body) {
    const tag = curr.tagName.toLowerCase();
    if (interactiveTags.includes(tag) || curr.getAttribute('role')) {
      interactiveTarget = curr;
      break;
    }
    curr = curr.parentElement;
  }

  // If no interactive element found, maybe it's a JS-handled div/span/img
  if (!interactiveTarget) {
    const tag = target.tagName.toLowerCase();
    if (!['div', 'span', 'li', 'tr', 'td', 'img', 'svg', 'path'].includes(tag)) return;
    interactiveTarget = target;
  }

  const tag = interactiveTarget.tagName.toLowerCase();
  
  // Ignore text inputs — those are captured separately via 'change'/'input' events
  if (tag === 'input' && interactiveTarget.getAttribute('type') === 'text') return;
  if (tag === 'textarea') return;

  const now = Date.now();
  if (interactiveTarget === lastClickTarget && now - lastClickTime < 500) {
    return; // Ignore duplicate click on same element within 500ms
  }
  lastClickTime = now;
  lastClickTarget = interactiveTarget;

  const step = buildStep('click', interactiveTarget);
  sendStep(step);
}

function handleInput(e: Event): void {
  if (!isRecording || isPaused) return;
  const target = e.target as HTMLInputElement;
  if (!target) return;

  const tag = target.tagName.toLowerCase();
  if (tag !== 'input' && tag !== 'textarea') return;

  // Skip password and hidden inputs entirely (privacy)
  const inputType = target.type?.toLowerCase();
  if (inputType === 'hidden') return;

  const { element, locator, maskedValue } = getElementSnapshot(target);
  const value = maskedValue;

  const step: Omit<RecordedStep, 'id' | 'stepNumber'> = {
    action: 'fill',
    timestamp: new Date().toISOString(),
    url: window.location.href,
    pageTitle: document.title,
    title: `Fill ${element.ariaLabel ?? element.placeholder ?? element.label ?? 'input'}`,
    description: `Typed "${value}" into ${element.ariaLabel ?? element.placeholder ?? 'input'}`,
    element: { ...element, value },
    locator,
    value,
  };
  
  pendingInputStep = step;
  if (inputDebounceTimer) window.clearTimeout(inputDebounceTimer);
  inputDebounceTimer = window.setTimeout(flushPendingInput, 1000);
}

function handleChange(e: Event): void {
  flushPendingInput();
  if (!isRecording || isPaused) return;
  const target = e.target as HTMLSelectElement | HTMLInputElement;
  if (!target) return;

  const tag = target.tagName.toLowerCase();

  if (tag === 'select') {
    const sel = target as HTMLSelectElement;
    const { element, locator } = getElementSnapshot(sel);
    const step: Omit<RecordedStep, 'id' | 'stepNumber'> = {
      action: 'select',
      timestamp: new Date().toISOString(),
      url: window.location.href,
      pageTitle: document.title,
      title: `Select "${sel.options[sel.selectedIndex]?.text ?? sel.value}"`,
      description: `Selected option "${sel.options[sel.selectedIndex]?.text ?? sel.value}"`,
      element,
      locator,
      option: sel.value,
    };
    sendStep(step);
  }

  if (tag === 'input') {
    const inp = target as HTMLInputElement;
    const inputType = inp.type?.toLowerCase();
    if (inputType === 'checkbox') {
      const { element, locator } = getElementSnapshot(inp);
      const step: Omit<RecordedStep, 'id' | 'stepNumber'> = {
        action: inp.checked ? 'check' : 'uncheck',
        timestamp: new Date().toISOString(),
        url: window.location.href,
        pageTitle: document.title,
        title: `${inp.checked ? 'Check' : 'Uncheck'} ${element.ariaLabel ?? element.label ?? 'checkbox'}`,
        description: `${inp.checked ? 'Checked' : 'Unchecked'} ${element.label ?? 'checkbox'}`,
        element,
        locator,
      };
      sendStep(step);
    }
  }
}

function handleKeydown(e: KeyboardEvent): void {
  if (!['Enter', 'Tab'].includes(e.key)) return;
  flushPendingInput();
  if (!isRecording || isPaused) return;

  const target = e.target as Element;
  if (!target) return;

  const step: Omit<RecordedStep, 'id' | 'stepNumber'> = {
    action: 'press',
    timestamp: new Date().toISOString(),
    url: window.location.href,
    pageTitle: document.title,
    title: `Press ${e.key}`,
    description: `Pressed ${e.key}`,
    element: {
      tagName: target.tagName.toLowerCase(),
      text: null,
      role: null,
      ariaLabel: null,
      placeholder: null,
      label: null,
      isSensitive: false,
    },
    locator: {
      primary: { strategy: 'css', value: 'body' },
      fallbacks: [],
    },
    key: e.key,
  };
  sendStep(step);
}

// ─── URL change detection ─────────────────────────────────────────────────────

function checkUrlChange(): void {
  if (!isRecording || isPaused) return;
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    let normalizedUrl = currentUrl;
    try {
      const u = new URL(currentUrl);
      u.searchParams.delete('_afrLoop');
      u.searchParams.delete('_afrWindowMode');
      u.searchParams.delete('_afrWindowId');
      normalizedUrl = u.toString();
    } catch {}

    const step: Omit<RecordedStep, 'id' | 'stepNumber'> = {
      action: 'navigate',
      timestamp: new Date().toISOString(),
      url: normalizedUrl,
      pageTitle: document.title,
      title: `Navigate to ${document.title || normalizedUrl}`,
      description: `Navigated to ${normalizedUrl}`,
      element: {
        tagName: 'window',
        text: normalizedUrl,
        role: null,
        ariaLabel: null,
        placeholder: null,
        label: null,
        isSensitive: false,
      },
      locator: {
        primary: { strategy: 'css', value: 'body' },
        fallbacks: [],
      },
    };
    sendStep(step);
    lastUrl = currentUrl;
  }
}

setInterval(checkUrlChange, 1000);

// ─── Overlay management ───────────────────────────────────────────────────────

function injectOverlay(): void {
  if (overlayRoot) return;

  overlayRoot = document.createElement('div');
  overlayRoot.id = 'qa-platform-overlay-root';
  overlayRoot.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 2147483647;
    pointer-events: none;
  `;
  document.body.appendChild(overlayRoot);

  // Inline overlay HTML (no React needed in content script context)
  const panel = document.createElement('div');
  panel.id = 'qa-overlay-panel';
  panel.setAttribute('data-qa-overlay', 'true');
  panel.style.cssText = `
    pointer-events: all;
    background: #111111;
    border: 1px solid #2a2a2a;
    border-radius: 10px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
    min-width: 220px;
    animation: qa-slide-in 0.2s ease-out;
    cursor: grab;
    user-select: none;
  `;

  panel.innerHTML = `
    <style>
      @keyframes qa-slide-in {
        from { opacity: 0; transform: translateY(-8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes qa-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
      #qa-overlay-panel * { box-sizing: border-box; }
      #qa-overlay-panel:active { cursor: grabbing; }
    </style>
    <div style="
      width: 8px; height: 8px;
      background: #ef4444;
      border-radius: 50%;
      animation: qa-pulse 1.2s ease infinite;
      flex-shrink: 0;
    "></div>
    <div style="flex: 1; min-width: 0;">
      <div style="color: #f5f5f5; font-size: 12px; font-weight: 600; letter-spacing: 0.01em;">Recording</div>
      <div id="qa-overlay-steps" style="color: #6b7280; font-size: 11px; margin-top: 1px;">0 steps</div>
    </div>
    <div style="display: flex; gap: 6px;">
      <button id="qa-overlay-pause" title="Pause" style="
        background: #1c1c1c; border: 1px solid #2a2a2a; border-radius: 5px;
        color: #9ca3af; width: 26px; height: 26px;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        font-size: 11px;
      ">⏸</button>
      <button id="qa-overlay-stop" title="Stop" style="
        background: #1c1c1c; border: 1px solid #2a2a2a; border-radius: 5px;
        color: #ef4444; width: 26px; height: 26px;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        font-size: 11px;
      ">■</button>
    </div>
  `;

  overlayRoot.appendChild(panel);

  // Drag and Drop logic
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  panel.addEventListener('mousedown', (e) => {
    // Don't drag if clicking buttons
    if ((e.target as HTMLElement).tagName === 'BUTTON') return;
    
    isDragging = true;
    const rect = overlayRoot!.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging || !overlayRoot) return;
    
    // Calculate new position
    let newX = e.clientX - offsetX;
    let newY = e.clientY - offsetY;
    
    // Constrain to viewport
    const maxX = window.innerWidth - panel.offsetWidth;
    const maxY = window.innerHeight - panel.offsetHeight;
    
    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));
    
    overlayRoot.style.left = `${newX}px`;
    overlayRoot.style.top = `${newY}px`;
    overlayRoot.style.right = 'auto'; // Clear right positioning
    overlayRoot.style.bottom = 'auto'; // Clear bottom positioning
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });

  document.getElementById('qa-overlay-pause')?.addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ type: isPaused ? 'RESUME_RECORDING' : 'PAUSE_RECORDING' }).catch(() => {});
  });

  document.getElementById('qa-overlay-stop')?.addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ type: 'STOP_RECORDING' }).catch(() => {});
  });
}

function updateOverlayStepCount(count: number): void {
  const el = document.getElementById('qa-overlay-steps');
  if (el) el.textContent = `${count} step${count === 1 ? '' : 's'}`;
}

function updateOverlayPauseState(paused: boolean): void {
  const btn = document.getElementById('qa-overlay-pause');
  const dot = overlayRoot?.querySelector<HTMLDivElement>('div[style*="qa-pulse"]');
  if (btn) btn.textContent = paused ? '▶' : '⏸';
  if (dot) dot.style.animationPlayState = paused ? 'paused' : 'running';
}

function removeOverlay(): void {
  overlayRoot?.remove();
  overlayRoot = null;
}

// ─── Event listener attachment ────────────────────────────────────────────────

function attachListeners(): void {
  document.addEventListener('click', handleClick, true);
  document.addEventListener('input', handleInput, true);
  document.addEventListener('change', handleChange, true);
  document.addEventListener('keydown', handleKeydown, true);
  window.addEventListener('beforeunload', flushPendingInput);
}

function detachListeners(): void {
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('input', handleInput, true);
  document.removeEventListener('change', handleChange, true);
  document.removeEventListener('keydown', handleKeydown, true);
  window.removeEventListener('beforeunload', flushPendingInput);
}

// ─── Message handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message: unknown) => {
  const msg = message as { type: string; payload?: unknown };

  switch (msg.type) {
    case 'START_RECORDING': {
      isRecording = true;
      isPaused = false;
      attachListeners();
      injectOverlay();
      break;
    }

    case 'PAUSE_RECORDING': {
      isPaused = true;
      updateOverlayPauseState(true);
      break;
    }

    case 'RESUME_RECORDING': {
      isPaused = false;
      updateOverlayPauseState(false);
      break;
    }

    case 'STOP_RECORDING': {
      flushPendingInput();
      isRecording = false;
      isPaused = false;
      detachListeners();
      removeOverlay();
      break;
    }

    case 'STEP_ADDED': {
      const payload = msg.payload as { stepCount: number };
      updateOverlayStepCount(payload.stepCount);
      break;
    }
  }
});

console.info('[Content] QA Platform content script loaded.');

// On load, ask background if we should be recording this tab
chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' }, (response: any) => {
  if (response?.isRecording) {
    console.info('[Content] Resuming recording session for this tab.');
    isRecording = true;
    isPaused = response.isPaused;
    attachListeners();
    injectOverlay();
    updateOverlayStepCount(response.stepCount);
    if (response.isPaused) {
      updateOverlayPauseState(true);
    }
  }
});
