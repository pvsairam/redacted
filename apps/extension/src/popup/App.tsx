import React, { useState, useEffect, useCallback } from 'react';

type RecordingState = 'idle' | 'recording' | 'paused';

interface PopupState {
  recordingState: RecordingState;
  stepCount: number;
  testName: string;
  backendConnected: boolean;
  activeTabId: number | null;
  recordVideo: boolean;
  takeScreenshots: boolean;
  headless: boolean;
  saveTraces: boolean;
}

interface SaveResult {
  success: boolean;
  message: string;
  testCaseId?: string;
}

const WEB_APP_URL = 'http://localhost:3000';

// ─── Design tokens ────────────────────────────────────────────────────────────

const tokens = {
  bg: '#0a0a0a',
  surface: '#111111',
  surfaceHover: '#161616',
  border: '#2a2a2a',
  borderHover: '#333333',
  textPrimary: '#f5f5f5',
  textSecondary: '#9ca3af',
  textMuted: '#6b7280',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  accent: '#e5e7eb',
};

// ─── Styles ───────────────────────────────────────────────────────────────────

interface Styles {
  root: React.CSSProperties;
  header: React.CSSProperties;
  logoTile: React.CSSProperties;
  connectionPill: (connected: boolean) => React.CSSProperties;
  dot: (connected: boolean) => React.CSSProperties;
  body: React.CSSProperties;
  section: React.CSSProperties;
  label: React.CSSProperties;
  input: React.CSSProperties;
  readyCard: React.CSSProperties;
  recordingIndicator: React.CSSProperties;
  stepBadge: React.CSSProperties;
  btnRow: React.CSSProperties;
  btn: (variant: 'primary' | 'secondary' | 'danger' | 'ghost') => React.CSSProperties;
  messageBox: (type: 'success' | 'error' | 'warning') => React.CSSProperties;
  footer: React.CSSProperties;
  link: React.CSSProperties;
}

const styles: Styles = {
  root: {
    width: 320,
    minHeight: 380,
    background: tokens.bg,
    color: tokens.textPrimary,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    fontSize: 13,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '14px 16px',
    borderBottom: `1px solid ${tokens.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoTile: {
    width: 28,
    height: 28,
    borderRadius: 6,
    background: '#1a1a1a',
    border: `1px solid ${tokens.border}`,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '0 6px',
    overflow: 'hidden',
  },
  connectionPill: (connected: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    fontWeight: 500,
    padding: '4px 8px',
    borderRadius: 100,
    background: connected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
    color: connected ? tokens.success : tokens.danger,
    border: `1px solid ${connected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
  }),
  dot: (connected: boolean): React.CSSProperties => ({
    width: 5,
    height: 5,
    borderRadius: '50%',
    background: connected ? tokens.success : tokens.danger,
  }),
  body: {
    flex: 1,
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 12,
    color: tokens.textMuted,
    fontWeight: 500,
  },
  input: {
    background: tokens.surface,
    border: `1px solid ${tokens.border}`,
    borderRadius: 6,
    padding: '10px 12px',
    color: tokens.textPrimary,
    fontSize: 13,
    outline: 'none',
    width: '100%',
    transition: 'border-color 0.15s ease',
  },
  readyCard: {
    background: tokens.surface,
    border: `1px solid ${tokens.border}`,
    borderRadius: 8,
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  recordingIndicator: {
    background: tokens.surface,
    border: `1px solid ${tokens.border}`,
    borderRadius: 8,
    padding: '12px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  stepBadge: {
    background: '#1a1a1a',
    border: `1px solid ${tokens.border}`,
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 12,
    fontWeight: 500,
    color: tokens.textSecondary,
    fontVariantNumeric: 'tabular-nums',
  },
  btnRow: {
    display: 'flex',
    gap: 8,
  },
  btn: (variant: 'primary' | 'secondary' | 'danger' | 'ghost'): React.CSSProperties => {
    const map = {
      primary: { bg: tokens.textPrimary, color: tokens.bg, border: 'transparent' },
      secondary: { bg: tokens.surface, color: tokens.textSecondary, border: tokens.border },
      danger: { bg: '#2a1212', color: tokens.danger, border: '#4a1b1b' },
      ghost: { bg: 'transparent', color: tokens.textMuted, border: tokens.border },
    };
    const v = map[variant];
    return {
      flex: 1,
      background: v.bg,
      color: v.color,
      border: `1px solid ${v.border}`,
      borderRadius: 6,
      padding: '10px 14px',
      fontSize: 13,
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'all 0.15s ease',
      fontFamily: 'inherit',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    };
  },
  messageBox: (type: 'success' | 'error' | 'warning'): React.CSSProperties => {
    const colors = {
      success: { bg: '#0d1f12', border: '#1a3a1f', color: tokens.success },
      error: { bg: '#1c0e0e', border: '#3a1515', color: tokens.danger },
      warning: { bg: '#1c160a', border: '#3a2f10', color: tokens.warning },
    };
    const c = colors[type];
    return {
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: 6,
      padding: '12px',
      fontSize: 12,
      color: c.color,
      lineHeight: 1.5,
    };
  },
  footer: {
    padding: '12px 16px',
    borderTop: `1px solid ${tokens.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: {
    fontSize: 12,
    color: tokens.textMuted,
    textDecoration: 'none',
    cursor: 'pointer',
    transition: 'color 0.15s ease',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function App(): React.ReactElement {
  const [popupState, setPopupState] = useState<PopupState>({
    recordingState: 'idle',
    stepCount: 0,
    testName: '',
    backendConnected: false,
    activeTabId: null,
    recordVideo: false,
    takeScreenshots: true,
    headless: false,
    saveTraces: true,
  });
  const [localTestName, setLocalTestName] = useState('');
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load initial state from background
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response: { success: boolean; data: PopupState }) => {
      if (response?.success) {
        setPopupState(response.data);
        if (response.data.recordingState !== 'idle' && response.data.testName) {
          setLocalTestName(response.data.testName);
        }
      }
    });

    const listener = (message: unknown) => {
      const msg = message as { type: string; payload?: unknown };
      if (msg.type === 'STATE_UPDATE') {
        setPopupState(msg.payload as PopupState);
      } else if (msg.type === 'SAVE_RESULT') {
        setSaveResult(msg.payload as SaveResult);
        setIsLoading(false);
      } else if (msg.type === 'ERROR') {
        const err = msg.payload as { message: string };
        setSaveResult({ success: false, message: err.message });
        setIsLoading(false);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const handleStart = useCallback(() => {
    setSaveResult(null);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) return;
      setIsLoading(true);
      chrome.runtime.sendMessage(
        { 
          type: 'START_RECORDING', 
          payload: { 
            tabId: tab.id, 
            testName: localTestName || 'Untitled Test',
            recordVideo: popupState.recordVideo,
            takeScreenshots: popupState.takeScreenshots,
            headless: popupState.headless,
            saveTraces: popupState.saveTraces,
          } 
        },
        () => setIsLoading(false),
      );
    });
  }, [localTestName]);

  const handlePause = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'PAUSE_RECORDING' });
  }, []);

  const handleResume = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'RESUME_RECORDING' });
  }, []);

  const handleStop = useCallback(() => {
    setIsLoading(true);
    chrome.runtime.sendMessage({ type: 'STOP_RECORDING', payload: { testName: localTestName } });
  }, [localTestName]);

  const { recordingState, stepCount, backendConnected, recordVideo, takeScreenshots, headless, saveTraces } = popupState;

  const elapsedLabel = recordingState !== 'idle' ? `${stepCount} step${stepCount !== 1 ? 's' : ''}` : null;

  const handleToggle = (key: keyof PopupState) => {
    const newState = { ...popupState, [key]: !popupState[key] };
    setPopupState(newState);
    chrome.runtime.sendMessage({ type: 'UPDATE_TOGGLES', payload: { [key]: !popupState[key] } });
  };

  return (
    <div style={styles.root}>
      {/* Header */}
      <div style={styles.header}>
        {/* Pixelated Redaction Logo Mark */}
        <div style={{ width: 80, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.9 }}>
          <svg viewBox="0 0 100 30" style={{ width: '100%', height: '100%' }} xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="10" height="10" fill="#a3a3a3"/><rect x="10" y="0" width="10" height="10" fill="#e5e5e5"/><rect x="20" y="0" width="10" height="10" fill="#404040"/><rect x="30" y="0" width="10" height="10" fill="#d4d4d4"/><rect x="40" y="0" width="10" height="10" fill="#737373"/><rect x="50" y="0" width="10" height="10" fill="#a3a3a3"/><rect x="60" y="0" width="10" height="10" fill="#d4d4d4"/><rect x="70" y="0" width="10" height="10" fill="#525252"/><rect x="80" y="0" width="10" height="10" fill="#a3a3a3"/><rect x="90" y="0" width="10" height="10" fill="#e5e5e5"/>
            <rect x="0" y="10" width="10" height="10" fill="#d4d4d4"/><rect x="10" y="10" width="10" height="10" fill="#737373"/><rect x="20" y="10" width="10" height="10" fill="#e5e5e5"/><rect x="30" y="10" width="10" height="10" fill="#525252"/><rect x="40" y="10" width="10" height="10" fill="#262626"/><rect x="50" y="10" width="10" height="10" fill="#a3a3a3"/><rect x="60" y="10" width="10" height="10" fill="#e5e5e5"/><rect x="70" y="10" width="10" height="10" fill="#737373"/><rect x="80" y="10" width="10" height="10" fill="#404040"/><rect x="90" y="10" width="10" height="10" fill="#d4d4d4"/>
            <rect x="0" y="20" width="10" height="10" fill="#737373"/><rect x="10" y="20" width="10" height="10" fill="#d4d4d4"/><rect x="20" y="20" width="10" height="10" fill="#a3a3a3"/><rect x="30" y="20" width="10" height="10" fill="#e5e5e5"/><rect x="40" y="20" width="10" height="10" fill="#525252"/><rect x="50" y="20" width="10" height="10" fill="#262626"/><rect x="60" y="20" width="10" height="10" fill="#737373"/><rect x="70" y="20" width="10" height="10" fill="#d4d4d4"/><rect x="80" y="20" width="10" height="10" fill="#a3a3a3"/><rect x="90" y="20" width="10" height="10" fill="#404040"/>
          </svg>
        </div>
        <div style={styles.connectionPill(backendConnected)}>
          <div style={styles.dot(backendConnected)} />
          {backendConnected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      {/* Body */}
      <div style={styles.body}>

        {/* Save result message */}
        {saveResult && (
          <div style={styles.messageBox(saveResult.success ? 'success' : 'error')}>
            {saveResult.message}
            {saveResult.success && saveResult.testCaseId && (
              <div style={{ marginTop: 6 }}>
                <a
                  href={`${WEB_APP_URL}/tests/${saveResult.testCaseId}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: tokens.success, fontSize: 12, textDecoration: 'underline' }}
                >
                  View in dashboard →
                </a>
              </div>
            )}
          </div>
        )}

        {/* Backend disconnected warning */}
        {!backendConnected && (
          <div style={styles.messageBox('warning')}>
            Backend not connected. Start the server on port 3001.
          </div>
        )}

        {/* Idle state */}
        {recordingState === 'idle' && (
          <>
            <div style={styles.section}>
              <div style={styles.label}>Test name</div>
              <input
                id="test-name-input"
                style={styles.input}
                type="text"
                placeholder="Login flow, happy path"
                value={localTestName}
                onChange={(e) => setLocalTestName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStart()}
              />
            </div>

            <div style={{ ...styles.section, marginTop: 16 }}>
              <div style={styles.label}>Execution Settings</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <span style={{ fontSize: 13, color: tokens.textPrimary }}>Record Video Replay</span>
                  <input type="checkbox" checked={recordVideo} onChange={() => handleToggle('recordVideo')} style={{ cursor: 'pointer' }} />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <span style={{ fontSize: 13, color: tokens.textPrimary }}>Capture Screenshots</span>
                  <input type="checkbox" checked={takeScreenshots} onChange={() => handleToggle('takeScreenshots')} style={{ cursor: 'pointer' }} />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <span style={{ fontSize: 13, color: tokens.textPrimary }}>Save Playwright Trace</span>
                  <input type="checkbox" checked={saveTraces} onChange={() => handleToggle('saveTraces')} style={{ cursor: 'pointer' }} />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <span style={{ fontSize: 13, color: tokens.textPrimary }}>Visible Browser (Headless Off)</span>
                  <input type="checkbox" checked={!headless} onChange={() => handleToggle('headless')} style={{ cursor: 'pointer' }} />
                </label>
              </div>
            </div>

            <div style={{ ...styles.readyCard, marginTop: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: tokens.textPrimary }}>Ready to record</div>
              <div style={{ fontSize: 12, color: tokens.textMuted, lineHeight: 1.4, marginBottom: 8 }}>
                Capture clicks, inputs, and navigation from this tab.
              </div>
              <button
                id="start-recording-btn"
                style={styles.btn('primary')}
                onClick={handleStart}
                disabled={!backendConnected || isLoading}
              >
                <span style={{ fontSize: 16 }}>●</span>
                {isLoading ? 'Starting...' : 'Start recording'}
              </button>
            </div>
          </>
        )}

        {/* Recording / Paused state */}
        {recordingState !== 'idle' && (
          <>
            {/* Status */}
            <div style={styles.recordingIndicator}>
              <div style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: recordingState === 'recording' ? tokens.danger : tokens.warning,
                flexShrink: 0,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: tokens.textPrimary }}>
                  {recordingState === 'recording' ? 'Recording' : 'Paused'}
                </div>
                <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {localTestName || 'Untitled Test'}
                </div>
              </div>
              <div style={styles.stepBadge}>{elapsedLabel}</div>
            </div>

            {/* Controls */}
            <div style={styles.btnRow}>
              {recordingState === 'recording' ? (
                <button id="pause-btn" style={styles.btn('secondary')} onClick={handlePause}>
                  ⏸ Pause
                </button>
              ) : (
                <button id="resume-btn" style={styles.btn('secondary')} onClick={handleResume}>
                  ▶ Resume
                </button>
              )}
              <button
                id="stop-save-btn"
                style={styles.btn('danger')}
                onClick={handleStop}
                disabled={isLoading}
              >
                ■ Stop
              </button>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <a
          href={WEB_APP_URL}
          target="_blank"
          rel="noreferrer"
          style={styles.link}
        >
          Open Dashboard →
        </a>
      </div>
    </div>
  );
}
