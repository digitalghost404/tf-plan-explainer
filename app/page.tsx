'use client';

import { useState } from 'react';
import PlanInput from '@/components/PlanInput';
import RiskSummary from '@/components/RiskSummary';
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

    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? `Server error: ${res.status}`);
        return;
      }

      setAnalysis(data as PlanAnalysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error — is the dev server running?');
    } finally {
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
        <section>
          <RiskSummary analysis={analysis} />
        </section>
      )}
    </main>
  );
}
