'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Loader2, Plus, Save, Trash2, Edit } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

const API_URL = 'http://localhost:3001/api/environments';

async function fetchEnvironments() {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error('Failed to fetch environments');
  const json = await res.json();
  return json.data || json;
}

export default function EnvironmentsPage() {
  const queryClient = useQueryClient();
  const { data: environments = [], isLoading } = useQuery({
    queryKey: ['environments'],
    queryFn: fetchEnvironments,
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ 
    name: '', 
    baseUrl: '', 
    variables: '[\n  {\n    "key": "USERNAME",\n    "value": "secret_value",\n    "isSecret": true\n  }\n]' 
  });

  const createMutation = useMutation({
    mutationFn: async (newEnv: typeof form) => {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEnv),
      });
      if (!res.ok) throw new Error('Failed to create');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environments'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof form }) => {
      const res = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environments'] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environments'] });
    },
  });

  const resetForm = () => {
    setEditingId(null);
    setForm({ 
      name: '', 
      baseUrl: '', 
      variables: '[\n  {\n    "key": "USERNAME",\n    "value": "secret_value",\n    "isSecret": true\n  }\n]' 
    });
  };

  const handleEdit = (env: any) => {
    setEditingId(env.id);
    setForm({
      name: env.name,
      baseUrl: env.baseUrl || '',
      variables: typeof env.variables === 'string' ? env.variables : JSON.stringify(env.variables, null, 2),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsedVars = JSON.parse(form.variables);
      if (!Array.isArray(parsedVars)) {
        alert('Variables must be a JSON array of objects');
        return;
      }
      
      const payload = { ...form, variables: parsedVars };
      
      if (editingId) {
        updateMutation.mutate({ id: editingId, data: payload as any });
      } else {
        createMutation.mutate(payload as any);
      }
    } catch {
      alert('Variables must be valid JSON');
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Environments" description="Manage secure client credentials and base URLs." />

      <div className="px-8 py-6 max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Form Section */}
        <section>
          <div className="card p-6">
            <h2 className="text-sm font-semibold text-chalk mb-4">
              {editingId ? 'Edit Environment' : 'Add New Environment'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-graphite-100 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Oracle PDEMO"
                  className="input-base w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-graphite-100 mb-1">Base URL</label>
                <input
                  type="url"
                  value={form.baseUrl}
                  onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                  placeholder="https://..."
                  className="input-base w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-graphite-100 mb-1">
                  Variables (JSON Format)
                </label>
                <p className="text-2xs text-graphite-100 mb-2">
                  Keys will be injected automatically during replay when {"{{KEY}}"} is used. Passwords are AES encrypted at rest.
                </p>
                <textarea
                  required
                  value={form.variables}
                  onChange={(e) => setForm({ ...form, variables: e.target.value })}
                  className="input-base w-full font-mono text-sm h-32"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                {editingId && (
                  <button type="button" onClick={resetForm} className="btn-secondary px-4 py-2 text-sm">
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="btn-primary px-4 py-2 text-sm"
                >
                  <Save size={14} />
                  {editingId ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* List Section */}
        <section>
          <h2 className="text-sm font-semibold text-chalk mb-4">Saved Environments</h2>
          {isLoading ? (
            <div className="flex items-center gap-2 text-graphite-100 text-sm">
              <Loader2 size={14} className="animate-spin" />
              Loading...
            </div>
          ) : environments.length === 0 ? (
            <div className="text-sm text-graphite-100 border border-dashed border-graphite-400 p-8 rounded-lg text-center">
              No environments configured yet.
            </div>
          ) : (
            <div className="space-y-3">
              {environments.map((env: any) => (
                <div key={env.id} className="card p-4 flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-medium text-chalk">{env.name}</h3>
                    <p className="text-xs text-graphite-100 mt-1">{env.baseUrl}</p>
                    <div className="mt-2 text-2xs font-mono text-graphite-100 bg-graphite-800 p-2 rounded truncate max-w-xs whitespace-pre">
                      {typeof env.variables === 'string' ? env.variables : JSON.stringify(env.variables, null, 2)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(env)}
                      className="p-1.5 text-graphite-100 hover:text-chalk bg-graphite-700 hover:bg-graphite-600 rounded transition-colors"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this?')) {
                          deleteMutation.mutate(env.id);
                        }
                      }}
                      className="p-1.5 text-danger hover:bg-danger-muted rounded transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
