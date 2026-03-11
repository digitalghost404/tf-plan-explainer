'use client';

import { useState } from 'react';
import type { PlanAnalysis } from '@/types/analysis';

interface DownloadReportButtonProps {
  analysis: PlanAnalysis;
}

export default function DownloadReportButton({ analysis }: DownloadReportButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    if (loading) return;
    setLoading(true);
    try {
      const { generatePdfReport } = await import('@/lib/generatePdfReport');
      await generatePdfReport(analysis);
    } catch (err) {
      console.error('Failed to generate PDF report:', err);
      alert('Failed to generate PDF report. Please check the console for more details.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-lg border border-indigo-700 bg-indigo-900/50 px-4 py-2 text-sm font-medium text-indigo-300 transition-colors hover:bg-indigo-800/60 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? (
        <>
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Generating…
        </>
      ) : (
        <>
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          Download Report
        </>
      )}
    </button>
  );
}
