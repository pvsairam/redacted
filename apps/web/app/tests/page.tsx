'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  FlaskConical,
  Search,
  ChevronRight,
  Clock,
  Hash,
} from 'lucide-react';
import { getTestCases } from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

function formatDate(iso: string | null): string {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function TestsPage() {
  const [search, setSearch] = useState('');

  const { data: testCases, isLoading, error } = useQuery({
    queryKey: ['test-cases'],
    queryFn: getTestCases,
  });

  const filtered = testCases?.filter((tc) =>
    tc.name.toLowerCase().includes(search.toLowerCase()) ||
    tc.targetUrl.toLowerCase().includes(search.toLowerCase()),
  ) ?? [];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Test Cases"
        description="All recorded browser workflows ready to replay."
      >
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite-100" />
          <input
            id="test-search"
            type="text"
            placeholder="Search tests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base pl-8 w-48"
          />
        </div>
      </PageHeader>

      <div className="px-8 py-6">
        {isLoading ? (
          <div className="card overflow-hidden">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="px-4 py-4 border-b border-graphite-400 last:border-0 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="h-4 bg-graphite-600 rounded w-48" />
                  <div className="h-4 bg-graphite-600 rounded w-20 ml-auto" />
                  <div className="h-5 bg-graphite-600 rounded w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="card p-6 text-danger text-sm">
            Failed to load test cases. Is the backend running?
          </div>
        ) : filtered.length === 0 ? (
          <div className="card">
            {testCases?.length === 0 ? (
              <EmptyState
                icon={<FlaskConical size={20} />}
                title="No test cases yet"
                description="Install the browser extension and record your first workflow to get started."
                action={
                  <a
                    href="http://localhost:3001/api/health"
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary px-4 py-2 text-sm"
                  >
                    Check Extension Setup
                  </a>
                }
              />
            ) : (
              <EmptyState
                icon={<Search size={20} />}
                title="No results"
                description={`No test cases match "${search}".`}
              />
            )}
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-graphite-400">
                  <th className="text-left px-4 py-3 text-label">Test Name</th>
                  <th className="text-left px-4 py-3 text-label">Target URL</th>
                  <th className="text-left px-4 py-3 text-label">
                    <span className="flex items-center gap-1"><Hash size={11} /> Steps</span>
                  </th>
                  <th className="text-left px-4 py-3 text-label">Last Run</th>
                  <th className="text-left px-4 py-3 text-label">
                    <span className="flex items-center gap-1"><Clock size={11} /> Updated</span>
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((tc, i) => (
                  <tr
                    key={tc.id}
                    className={`border-b border-graphite-400 hover:bg-graphite-700 transition-colors cursor-pointer ${i === filtered.length - 1 ? 'border-0' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <Link href={`/tests/${tc.id}`} className="font-medium text-chalk hover:underline">
                        {tc.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="code-text max-w-[200px] truncate block">{tc.targetUrl}</span>
                    </td>
                    <td className="px-4 py-3 text-graphite-100 tabular-nums">{tc.stepCount}</td>
                    <td className="px-4 py-3">
                      {tc.lastRunStatus ? (
                        <StatusBadge status={tc.lastRunStatus} />
                      ) : (
                        <span className="text-graphite-100 text-xs">Never</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-graphite-100">{formatDate(tc.updatedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/tests/${tc.id}`}
                        className="text-graphite-100 hover:text-chalk transition-colors"
                      >
                        <ChevronRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
