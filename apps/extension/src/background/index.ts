/**
 * Background Service Worker
 *
 * Responsibilities:
 * - Manages recording state machine (idle → recording → paused → stopped)
 * - Routes messages between popup, content script, and overlay
 * - Communicates with backend API to save recordings
 * - Tracks which tab is being recorded
 *
 * State machine:
 *   idle ──[start]──► recording ──[pause]──► paused ──[resume]──► recording
 *                         └──[stop]──► idle
 *                                 └──[stop]──► idle
 */

import type { RecordedStep, SaveRecordingRequest } from '@qa-platform/shared';

const BACKEND_URL = 'http://localhost:3001';

// ─── Recording state ──────────────────────────────────────────────────────────

type RecordingState = 'idle' | 'recording' | 'paused';

interface State {
  recordingState: RecordingState;
  activeTabId: number | null;
  steps: RecordedStep[];
  testName: string;
  stepCounter: number;
  startedAt: string | null;
  backendConnected: boolean;
  recordVideo: boolean;
  takeScreenshots: boolean;
  headless: boolean;
  saveTraces: boolean;
}

let state: State = {
  recordingState: 'idle',
  activeTabId: null,
  steps: [],
  testName: '',
  stepCounter: 0,
  startedAt: null,
  backendConnected: false,
  recordVideo: false,
  takeScreenshots: true,
  headless: false,
  saveTraces: true,
};

// ─── Backend health check ─────────────────────────────────────────────────────

async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

// Check health on startup and every 30 seconds
async function updateBackendStatus(): Promise<void> {
  state.backendConnected = await checkBackendHealth();
  broadcastToPopup({ type: 'STATE_UPDATE', payload: getPublicState() });
}

setInterval(() => void updateBackendStatus(), 30000);
void updateBackendStatus();

// Load persistent toggles
chrome.storage.local.get(['recordVideo', 'takeScreenshots', 'headless', 'saveTraces'], (res) => {
  if (res.recordVideo !== undefined) state.recordVideo = res.recordVideo;
  if (res.takeScreenshots !== undefined) state.takeScreenshots = res.takeScreenshots;
  if (res.headless !== undefined) state.headless = res.headless;
  if (res.saveTraces !== undefined) state.saveTraces = res.saveTraces;
});

// ─── State helpers ────────────────────────────────────────────────────────────

function getPublicState() {
  return {
    recordingState: state.recordingState,
    stepCount: state.steps.length,
    testName: state.testName,
    startedAt: state.startedAt,
    backendConnected: state.backendConnected,
    activeTabId: state.activeTabId,
    recordVideo: state.recordVideo,
    takeScreenshots: state.takeScreenshots,
    headless: state.headless,
    saveTraces: state.saveTraces,
  };
}

function broadcastToPopup(message: unknown): void {
  // Send to popup via chrome.runtime
  chrome.runtime.sendMessage(message).catch(() => {
    // Popup may not be open — silently ignore
  });
}

function broadcastToContentScript(tabId: number, message: unknown): void {
  chrome.tabs.sendMessage(tabId, message).catch(() => {
    // Tab may have navigated — silently ignore
  });
}

// ─── Recording actions ────────────────────────────────────────────────────────

async function startRecording(tabId: number, testName: string, toggles: { recordVideo: boolean; takeScreenshots: boolean; headless: boolean; saveTraces: boolean; }): Promise<void> {
  // Re-check backend connectivity before starting
  const connected = await checkBackendHealth();
  if (!connected) {
    state.backendConnected = false;
    broadcastToPopup({
      type: 'ERROR',
      payload: { message: 'Cannot start recording: backend is not connected. Start the server on port 3001.' },
    });
    return;
  }

  state = {
    ...state,
    recordingState: 'recording',
    activeTabId: tabId,
    steps: [],
    testName: testName || 'Untitled Test',
    stepCounter: 0,
    startedAt: new Date().toISOString(),
    backendConnected: true,
    recordVideo: toggles.recordVideo,
    takeScreenshots: toggles.takeScreenshots,
    headless: toggles.headless,
    saveTraces: toggles.saveTraces,
  };

  // Inject overlay into active tab
  broadcastToContentScript(tabId, { type: 'START_RECORDING', payload: { testName: state.testName } });
  broadcastToPopup({ type: 'STATE_UPDATE', payload: getPublicState() });

  console.info('[Background] Recording started for tab', tabId);
}

function pauseRecording(): void {
  if (state.recordingState !== 'recording') return;
  state.recordingState = 'paused';
  if (state.activeTabId) {
    broadcastToContentScript(state.activeTabId, { type: 'PAUSE_RECORDING' });
  }
  broadcastToPopup({ type: 'STATE_UPDATE', payload: getPublicState() });
}

function resumeRecording(): void {
  if (state.recordingState !== 'paused') return;
  state.recordingState = 'recording';
  if (state.activeTabId) {
    broadcastToContentScript(state.activeTabId, { type: 'RESUME_RECORDING' });
  }
  broadcastToPopup({ type: 'STATE_UPDATE', payload: getPublicState() });
}

async function stopAndSaveRecording(testName?: string): Promise<void> {
  if (state.recordingState === 'idle') return;

  const finalName = testName || state.testName || 'Untitled Test';
  const stepsToSave = [...state.steps];

  // Notify content script to remove overlay
  if (state.activeTabId) {
    broadcastToContentScript(state.activeTabId, { type: 'STOP_RECORDING' });
  }

  // Reset state before async operation
  state = {
    ...state,
    recordingState: 'idle',
    activeTabId: null,
    steps: [],
    stepCounter: 0,
    startedAt: null,
  };

  broadcastToPopup({ type: 'STATE_UPDATE', payload: getPublicState() });

  if (stepsToSave.length === 0) {
    broadcastToPopup({ type: 'SAVE_RESULT', payload: { success: false, message: 'No steps were recorded.' } });
    return;
  }

  // Save to backend
  try {
    const targetUrl = stepsToSave[0]?.url ?? '';
    const body: SaveRecordingRequest = {
      name: finalName,
      targetUrl,
      steps: stepsToSave,
      recordVideo: state.recordVideo,
      takeScreenshots: state.takeScreenshots,
      headless: state.headless,
      saveTraces: state.saveTraces,
    };

    const res = await fetch(`${BACKEND_URL}/api/test-cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`API returned ${res.status}: ${await res.text()}`);
    }

    const data = await res.json() as { success: boolean; data: { id: string; name: string } };
    broadcastToPopup({
      type: 'SAVE_RESULT',
      payload: {
        success: true,
        message: `"${finalName}" saved with ${stepsToSave.length} steps.`,
        testCaseId: data.data.id,
      },
    });
    console.info('[Background] Recording saved:', data.data.id);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[Background] Failed to save recording:', errorMsg);
    broadcastToPopup({
      type: 'SAVE_RESULT',
      payload: { success: false, message: `Failed to save: ${errorMsg}` },
    });
  }
}

function addStep(step: Omit<RecordedStep, 'id' | 'stepNumber'>): void {
  if (state.recordingState !== 'recording') return;

  state.stepCounter += 1;
  const fullStep: RecordedStep = {
    ...step,
    id: `step_${String(state.stepCounter).padStart(3, '0')}`,
    stepNumber: state.stepCounter,
  };

  state.steps.push(fullStep);
  broadcastToPopup({ type: 'STATE_UPDATE', payload: getPublicState() });

  // Notify overlay of new step count
  if (state.activeTabId) {
    broadcastToContentScript(state.activeTabId, {
      type: 'STEP_ADDED',
      payload: { stepCount: state.steps.length },
    });
  }
}

// ─── Message handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  const msg = message as { type: string; payload?: unknown };

  switch (msg.type) {
    case 'GET_STATE': {
      sendResponse({ success: true, data: getPublicState() });
      return false;
    }

    case 'START_RECORDING': {
      const payload = msg.payload as { tabId: number; testName: string; recordVideo: boolean; takeScreenshots: boolean; headless: boolean; saveTraces: boolean; };
      void startRecording(payload.tabId, payload.testName, { 
        recordVideo: payload.recordVideo, 
        takeScreenshots: payload.takeScreenshots, 
        headless: payload.headless,
        saveTraces: payload.saveTraces,
      }).then(() => {
        sendResponse({ success: true });
      });
      return true; // async
    }

    case 'UPDATE_TOGGLES': {
      const payload = msg.payload as Partial<State>;
      state = { ...state, ...payload };
      chrome.storage.local.set(payload);
      return false;
    }

    case 'PAUSE_RECORDING': {
      pauseRecording();
      sendResponse({ success: true });
      return false;
    }

    case 'RESUME_RECORDING': {
      resumeRecording();
      sendResponse({ success: true });
      return false;
    }

    case 'STOP_RECORDING': {
      const payload = msg.payload as { testName?: string } | undefined;
      void stopAndSaveRecording(payload?.testName).then(() => {
        sendResponse({ success: true });
      });
      return true; // async
    }

    case 'STEP_RECORDED': {
      const step = msg.payload as Omit<RecordedStep, 'id' | 'stepNumber'>;
      addStep(step);
      sendResponse({ success: true });
      return false;
    }

    case 'CHECK_HEALTH': {
      void checkBackendHealth().then((connected) => {
        state.backendConnected = connected;
        sendResponse({ success: true, connected });
      });
      return true; // async
    }

    case 'CONTENT_SCRIPT_READY': {
      const isTargetTab = state.activeTabId === sender.tab?.id;
      if (isTargetTab && state.recordingState !== 'idle') {
        const currentUrl = sender.tab?.url;
        const lastStepUrl = state.steps.length > 0 ? state.steps[state.steps.length - 1]?.url : null;
        
        // If the URL changed (e.g. they typed in address bar or opened a link in new tab), record a navigate step
        if (currentUrl && currentUrl !== lastStepUrl && !currentUrl.startsWith('chrome://')) {
          addStep({
            action: 'navigate',
            timestamp: new Date().toISOString(),
            url: currentUrl,
            pageTitle: sender.tab?.title || currentUrl,
            title: `Navigate to ${sender.tab?.title || currentUrl}`,
            description: `Navigated to ${currentUrl}`,
            element: { tagName: 'window', text: currentUrl, role: null, ariaLabel: null, placeholder: null, label: null, isSensitive: false },
            locator: { primary: { strategy: 'css', value: 'body' }, fallbacks: [] },
          });
        }

        sendResponse({
          isRecording: true,
          isPaused: state.recordingState === 'paused',
          stepCount: state.steps.length,
          testName: state.testName,
        });
      } else {
        sendResponse({ isRecording: false });
      }
      return false;
    }
  }

  return false;
});

// ─── Tab change detection ─────────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  if (state.recordingState === 'recording' && state.activeTabId !== tabId) {
    // Stop overlay on the old tab
    if (state.activeTabId) {
      broadcastToContentScript(state.activeTabId, { type: 'STOP_RECORDING' });
    }
    
    // Move recording to the new tab
    state.activeTabId = tabId;
    
    // Inject overlay on the new tab if it's a valid url
    const tab = await chrome.tabs.get(tabId);
    if (tab && tab.url && !tab.url.startsWith('chrome://')) {
      broadcastToContentScript(tabId, { type: 'START_RECORDING', payload: { testName: state.testName } });
      
      // If the new tab is already fully loaded and has a different URL, record it
      const currentUrl = tab.url;
      const lastStepUrl = state.steps.length > 0 ? state.steps[state.steps.length - 1]?.url : null;
      if (currentUrl !== lastStepUrl) {
        addStep({
          action: 'navigate',
          timestamp: new Date().toISOString(),
          url: currentUrl,
          pageTitle: tab.title || currentUrl,
          title: `Switch tab to ${tab.title || currentUrl}`,
          description: `Navigated to ${currentUrl}`,
          element: { tagName: 'window', text: currentUrl, role: null, ariaLabel: null, placeholder: null, label: null, isSensitive: false },
          locator: { primary: { strategy: 'css', value: 'body' }, fallbacks: [] },
        });
      }
    }
  }
});

console.info('[Background] QA Platform extension service worker started.');
