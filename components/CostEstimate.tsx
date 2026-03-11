'use client';

import type { CostEstimate as CostEstimateType, CloudProvider, ResourceCost } from '@/types/analysis';

interface CostEstimateProps {
  estimate: CostEstimateType;
}

export default function CostEstimate({ estimate }: CostEstimateProps) {
  const { provider, monthlyTotal, yearlyTotal, breakdown, confidence, disclaimer } = estimate;

  return (
    <div className="flex flex-col gap-6">
      {/* Header: provider badge + confidence */}
      <div className="flex flex-col gap-3 rounded-lg border border-gray-700 bg-gray-900 p-5">
        <div className="flex items-center gap-3">
          <ProviderBadge provider={provider} />
          <h2 className="text-base font-semibold text-gray-100">Cost Estimate</h2>
          <ConfidenceBadge confidence={confidence} />
        </div>
      </div>

      {/* Cost totals row */}
      <div className="grid grid-cols-2 gap-3">
        <CostCard label="Monthly Estimate" amount={monthlyTotal} />
        <CostCard label="Yearly Estimate" amount={yearlyTotal} />
      </div>

      {/* Breakdown table */}
      {breakdown.length > 0 && <BreakdownTable breakdown={breakdown} />}

      {/* Disclaimer */}
      <p className="text-xs italic text-gray-500">{disclaimer}</p>
    </div>
  );
}

function ProviderBadge({ provider }: { provider: CloudProvider }) {
  const styles: Record<CloudProvider, string> = {
    AWS: 'bg-orange-900/60 text-orange-300 ring-orange-700',
    Azure: 'bg-blue-900/60 text-blue-300 ring-blue-700',
    GCP: 'bg-red-900/60 text-red-300 ring-red-700',
    Unknown: 'bg-gray-800 text-gray-400 ring-gray-600',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ring-1 ${styles[provider]}`}
    >
      {provider}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: CostEstimateType['confidence'] }) {
  const styles: Record<CostEstimateType['confidence'], string> = {
    HIGH: 'bg-green-900/60 text-green-300 ring-green-700',
    MEDIUM: 'bg-yellow-900/60 text-yellow-300 ring-yellow-700',
    LOW: 'bg-red-900/60 text-red-300 ring-red-700',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${styles[confidence]}`}
    >
      {confidence} confidence
    </span>
  );
}

function CostCard({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-gray-700 bg-gray-900 py-5">
      <span className="text-2xl font-bold text-indigo-300">${amount.toFixed(2)}</span>
      <span className="mt-1 text-xs text-gray-400">{label}</span>
    </div>
  );
}

function BreakdownTable({ breakdown }: { breakdown: ResourceCost[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Cost Breakdown</h3>
      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 bg-gray-800/60">
              <th className="px-4 py-2.5 text-left font-medium text-gray-400">Resource</th>
              <th className="px-4 py-2.5 text-left font-medium text-gray-400">Type</th>
              <th className="px-4 py-2.5 text-right font-medium text-gray-400">Est. Monthly Cost</th>
              <th className="px-4 py-2.5 text-left font-medium text-gray-400">Assumptions</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((row, i) => (
              <BreakdownRow key={i} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BreakdownRow({ row }: { row: ResourceCost }) {
  const isFree = row.monthlyCost === 0;

  return (
    <tr className="border-b border-gray-800 last:border-0 hover:bg-gray-800/40">
      <td className="px-4 py-2.5 font-mono text-xs text-gray-100 break-all">{row.resource}</td>
      <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{row.type}</td>
      <td className="px-4 py-2.5 text-right">
        {isFree ? (
          <span className="text-gray-500">$0.00 / free</span>
        ) : (
          <span className="font-medium text-indigo-300">${row.monthlyCost.toFixed(2)}</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-xs text-gray-400">{row.assumptions}</td>
    </tr>
  );
}
