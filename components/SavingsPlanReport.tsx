'use client';

import type { SavingsPlanReport as SavingsPlanReportType, SavingsOpportunity } from '@/types/analysis';

interface Props {
  savingsPlanReport: SavingsPlanReportType;
}

function SavingsPercentBadge({ percent }: { percent: number }) {
  const style =
    percent >= 50
      ? 'bg-emerald-900/60 text-emerald-300 ring-1 ring-emerald-700'
      : percent >= 30
      ? 'bg-green-900/60 text-green-300 ring-1 ring-green-700'
      : 'bg-gray-800 text-gray-400 ring-1 ring-gray-600';

  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold ${style}`}>
      {percent.toFixed(1)}%
    </span>
  );
}

function SummaryCard({ label, amount, colorClass }: { label: string; amount: number; colorClass: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-gray-700 bg-gray-800/50 py-5">
      <span className={`text-2xl font-bold ${colorClass}`}>${amount.toFixed(2)}</span>
      <span className="mt-1 text-xs text-gray-400">{label}</span>
    </div>
  );
}

function OpportunityRow({ row }: { row: SavingsOpportunity }) {
  return (
    <tr className="border-b border-gray-800 last:border-0 hover:bg-gray-800/40">
      <td className="px-4 py-2.5 font-mono text-xs text-gray-100 break-all">{row.resource}</td>
      <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{row.instanceType}</td>
      <td className="px-4 py-2.5 text-right text-xs text-gray-300">${row.onDemandMonthly.toFixed(2)}</td>
      <td className="px-4 py-2.5 text-right text-xs text-green-400">${row.reserved1yrMonthly.toFixed(2)}</td>
      <td className="px-4 py-2.5 text-right">
        <div className="flex items-center justify-end gap-1.5">
          <span className="text-xs text-green-400">${row.savingsMonthly1yr.toFixed(2)}</span>
          <SavingsPercentBadge percent={row.savingsPercent1yr} />
        </div>
      </td>
      <td className="px-4 py-2.5 text-right text-xs text-emerald-400">${row.reserved3yrMonthly.toFixed(2)}</td>
      <td className="px-4 py-2.5 text-right">
        <div className="flex items-center justify-end gap-1.5">
          <span className="text-xs text-emerald-400">${row.savingsMonthly3yr.toFixed(2)}</span>
          <SavingsPercentBadge percent={row.savingsPercent3yr} />
        </div>
      </td>
    </tr>
  );
}

export default function SavingsPlanReport({ savingsPlanReport }: Props) {
  const { opportunities, totalOnDemandMonthly, totalSavingsMonthly1yr, totalSavingsMonthly3yr, disclaimer } = savingsPlanReport;

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-white">Savings Plan Recommendations</h2>
        <span className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-400">
          {opportunities.length} eligible resource{opportunities.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Summary cards */}
      {opportunities.length > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          <SummaryCard label="On-Demand / mo" amount={totalOnDemandMonthly} colorClass="text-gray-200" />
          <SummaryCard label="1yr Savings / mo" amount={totalSavingsMonthly1yr} colorClass="text-green-400" />
          <SummaryCard label="3yr Savings / mo" amount={totalSavingsMonthly3yr} colorClass="text-emerald-400" />
        </div>
      )}

      {/* Comparison table or empty state */}
      {opportunities.length === 0 ? (
        <p className="rounded-lg border border-gray-700 bg-gray-800/30 px-4 py-5 text-center text-sm text-gray-400">
          No eligible reserved-pricing resources (EC2, RDS, ElastiCache, etc.) detected in this plan.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-800/60">
                <th className="px-4 py-2.5 text-left font-medium text-gray-400">Resource</th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-400">Instance Type</th>
                <th className="px-4 py-2.5 text-right font-medium text-gray-400">On-Demand / mo</th>
                <th className="px-4 py-2.5 text-right font-medium text-gray-400">1yr Reserved</th>
                <th className="px-4 py-2.5 text-right font-medium text-gray-400">1yr Savings</th>
                <th className="px-4 py-2.5 text-right font-medium text-gray-400">3yr Reserved</th>
                <th className="px-4 py-2.5 text-right font-medium text-gray-400">3yr Savings</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((row, i) => (
                <OpportunityRow key={i} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Disclaimer */}
      <p className="mt-4 text-xs italic text-gray-500">{disclaimer}</p>
    </div>
  );
}
