'use client';

import { useState } from 'react';
import PlanInput from '@/components/PlanInput';
import RiskSummary from '@/components/RiskSummary';
import CostEstimate from '@/components/CostEstimate';
import type { PlanAnalysis } from '@/types/analysis';

export default function Home() {
  const [plan, setPlan] = useState('');
  const [analysis, setAnalysis] = useState<PlanAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!plan.trim() || loading) return;

    setLoading(true);
    setError(null);
    setAnalysis(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);

    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
        signal: controller.signal,
      });

      if (!res.ok) {
        let message = `Server error: ${res.status}`;
        try {
          const data = await res.json();
          message = data?.error ?? message;
        } catch {
          // Response wasn't JSON — use the HTTP status message
        }
        setError(message);
        return;
      }

      const data = await res.json();
      setAnalysis(data as PlanAnalysis);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Request timed out — the server took too long to respond.');
      } else {
        setError(err instanceof Error ? err.message : 'Network error — is the dev server running?');
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      {/* Page header */}
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Terraform Plan Explainer
        </h1>
        <p className="mt-2 text-gray-400">
          Paste your <code className="rounded bg-gray-800 px-1.5 py-0.5 font-mono text-sm text-indigo-300">terraform plan</code> output and get a plain-English risk summary.
        </p>
      </div>

      {/* Input section */}
      <section className="mb-8">
        <PlanInput
          plan={plan}
          onChange={setPlan}
          onSubmit={handleSubmit}
          loading={loading}
        />
      </section>

      {/* Error banner */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-800 bg-red-950/60 px-4 py-3 text-sm text-red-300">
          <span className="font-semibold">Error: </span>{error}
        </div>
      )}

      {/* Results */}
      {analysis && (
        <section className="flex flex-col gap-8">
          <RiskSummary analysis={analysis} />
          <CostEstimate estimate={analysis.costEstimate} />
        </section>
      )}
    </main>
  );
}
