'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Download, Loader2, Info } from 'lucide-react';
import { listReports, getReportDownloadUrl } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import Link from 'next/link';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ReportsPage() {
  const { data: reports, isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: listReports,
  });

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Reports"
        description="DOCX reports generated from completed test runs."
      />

      <div className="px-8 py-6 space-y-4">
        <div className="card p-4 flex items-start gap-3 text-sm">
          <Info size={14} className="text-info flex-shrink-0 mt-0.5" />
          <div className="text-graphite-50">
            Reports are generated from completed replay runs. Open a test run and click{' '}
            <span className="font-semibold text-chalk">Generate Report</span> to create a DOCX.
          </div>
        </div>

        {isLoading ? (
          <div className="card overflow-hidden">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="px-4 py-4 border-b border-graphite-400 last:border-0 animate-pulse flex gap-4">
                <div className="h-4 bg-graphite-600 rounded w-48" />
                <div className="h-4 bg-graphite-600 rounded w-24 ml-auto" />
              </div>
            ))}
          </div>
        ) : !reports || reports.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={<FileText size={20} />}
              title="No reports yet"
              description="Generate your first report from a completed replay run."
              action={
                <Link href="/tests" className="btn-secondary px-4 py-2 text-sm">
                  View Test Cases
                </Link>
              }
            />
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-graphite-400">
                  <th className="text-left px-4 py-3 text-label">Test Case</th>
                  <th className="text-left px-4 py-3 text-label">Filename</th>
                  <th className="text-left px-4 py-3 text-label">Generated</th>
                  <th className="text-left px-4 py-3 text-label">Run</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {reports.map((report, i) => (
                  <tr
                    key={report.id}
                    className={`border-b border-graphite-400 hover:bg-graphite-700 transition-colors ${i === reports.length - 1 ? 'border-0' : ''}`}
                  >
                    <td className="px-4 py-3 font-medium text-chalk">{report.testCaseName}</td>
                    <td className="px-4 py-3">
                      <code className="code-text">{report.filename}</code>
                    </td>
                    <td className="px-4 py-3 text-graphite-100">{formatDate(report.generatedAt)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/runs/${report.runId}`}
                        className="text-xs text-graphite-100 hover:text-chalk"
                      >
                        View run →
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={getReportDownloadUrl(report.id)}
                        download={report.filename}
                        className="btn-secondary px-3 py-1.5 text-xs inline-flex items-center gap-1.5"
                      >
                        <Download size={11} />
                        Download
                      </a>
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
