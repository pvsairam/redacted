'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Loader2, Save, CheckCircle } from 'lucide-react';
import { getSettings, updateSettings } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import type { PlatformSettings } from '@qa-platform/shared';

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-8 py-4 border-b border-graphite-400 last:border-0">
      <div className="flex-1">
        <div className="text-sm font-medium text-chalk">{label}</div>
        {description && (
          <div className="text-xs text-graphite-100 mt-0.5 max-w-sm">{description}</div>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 rounded-full border transition-colors duration-200 ${
        checked
          ? 'bg-success border-success-muted'
          : 'bg-graphite-600 border-graphite-400'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-chalk transition-transform duration-200 ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  const [form, setForm] = useState<Partial<PlatformSettings>>({});

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const mutation = useMutation({
    mutationFn: (s: Partial<PlatformSettings>) => updateSettings(s),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const set = <K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <div className="px-8 py-8 flex items-center gap-2 text-graphite-100 text-sm">
        <Loader2 size={14} className="animate-spin" />
        Loading settings...
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Settings" description="Configure replay behavior and report preferences.">
        <button
          id="save-settings-btn"
          onClick={() => mutation.mutate(form)}
          disabled={mutation.isPending}
          className="btn-primary px-4 py-2 text-sm"
        >
          {mutation.isPending ? (
            <Loader2 size={13} className="animate-spin" />
          ) : saved ? (
            <CheckCircle size={13} />
          ) : (
            <Save size={13} />
          )}
          {saved ? 'Saved' : 'Save Settings'}
        </button>
      </PageHeader>

      <div className="px-8 py-6 max-w-2xl space-y-8">
        {/* Browser */}
        <section>
          <h2 className="text-sm font-semibold text-chalk mb-1">Browser</h2>
          <p className="text-xs text-graphite-100 mb-4">Settings for replay execution.</p>
          <div className="card px-4">
            <SettingRow label="Browser" description="Browser engine to use for replay.">
              <select
                id="browser-select"
                value={form.browser ?? 'chromium'}
                onChange={(e) => set('browser', e.target.value as PlatformSettings['browser'])}
                className="input-base w-36"
              >
                <option value="chromium">Chromium</option>
                <option value="firefox">Firefox</option>
                <option value="webkit">WebKit</option>
              </select>
            </SettingRow>
            <SettingRow label="Headless Mode" description="Run browser without a visible window.">
              <Toggle
                id="headless-toggle"
                checked={form.headless ?? true}
                onChange={(v) => set('headless', v)}
              />
            </SettingRow>
            <SettingRow label="Step Timeout" description="Max time to wait for each element (ms).">
              <input
                id="timeout-input"
                type="number"
                value={form.stepTimeoutMs ?? 10000}
                min={1000}
                max={60000}
                step={1000}
                onChange={(e) => set('stepTimeoutMs', parseInt(e.target.value, 10))}
                className="input-base w-28 text-right"
              />
            </SettingRow>
            <SettingRow label="Viewport Width" description="Browser window width in pixels.">
              <input
                id="viewport-width-input"
                type="number"
                value={form.viewportWidth ?? 1280}
                min={800}
                max={2560}
                step={80}
                onChange={(e) => set('viewportWidth', parseInt(e.target.value, 10))}
                className="input-base w-28 text-right"
              />
            </SettingRow>
            <SettingRow label="Viewport Height" description="Browser window height in pixels.">
              <input
                id="viewport-height-input"
                type="number"
                value={form.viewportHeight ?? 720}
                min={600}
                max={1440}
                step={80}
                onChange={(e) => set('viewportHeight', parseInt(e.target.value, 10))}
                className="input-base w-28 text-right"
              />
            </SettingRow>
          </div>
        </section>

        {/* Capture */}
        <section>
          <h2 className="text-sm font-semibold text-chalk mb-1">Capture</h2>
          <p className="text-xs text-graphite-100 mb-4">Control what artifacts are saved during replay.</p>
          <div className="card px-4">
            <SettingRow label="Capture Screenshots" description="Take a screenshot after each step.">
              <Toggle
                id="screenshots-toggle"
                checked={form.captureScreenshots ?? true}
                onChange={(v) => set('captureScreenshots', v)}
              />
            </SettingRow>
            <SettingRow label="Record Video" description="Record a video of the full replay session.">
              <Toggle
                id="video-toggle"
                checked={form.recordVideo ?? true}
                onChange={(v) => set('recordVideo', v)}
              />
            </SettingRow>
            <SettingRow
              label="Save Playwright Traces"
              description="Save trace.zip files for debugging in Playwright Trace Viewer."
            >
              <Toggle
                id="traces-toggle"
                checked={form.saveTraces ?? false}
                onChange={(v) => set('saveTraces', v)}
              />
            </SettingRow>
          </div>
        </section>

        {/* Reports */}
        <section>
          <h2 className="text-sm font-semibold text-chalk mb-1">Reports</h2>
          <p className="text-xs text-graphite-100 mb-4">Metadata included in DOCX report headers.</p>
          <div className="card px-4">
            <SettingRow label="Author Name" description="Name shown in the report footer.">
              <input
                id="author-input"
                type="text"
                value={form.reportAuthor ?? ''}
                onChange={(e) => set('reportAuthor', e.target.value)}
                placeholder="Automation Team"
                className="input-base w-48"
              />
            </SettingRow>
            <SettingRow label="Company Name" description="Company name in the report header.">
              <input
                id="company-input"
                type="text"
                value={form.reportCompany ?? ''}
                onChange={(e) => set('reportCompany', e.target.value)}
                placeholder="Acme Corp"
                className="input-base w-48"
              />
            </SettingRow>
          </div>
        </section>

        {mutation.error && (
          <div className="text-danger text-sm">
            Failed to save: {String(mutation.error)}
          </div>
        )}
      </div>
    </div>
  );
}
