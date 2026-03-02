'use client';

import type { PlanAnalysis, ResourceChange, RiskLevel } from '@/types/analysis';

interface RiskSummaryProps {
  analysis: PlanAnalysis;
}

export default function RiskSummary({ analysis }: RiskSummaryProps) {
  const { riskLevel, summary, counts, changes, warnings } = analysis;

  return (
    <div className="flex flex-col gap-6">
      {/* Header: risk badge + summary */}
      <div className="flex flex-col gap-3 rounded-lg border border-gray-700 bg-gray-900 p-5">
        <div className="flex items-center gap-3">
          <RiskBadge level={riskLevel} />
          <h2 className="text-base font-semibold text-gray-100">Risk Analysis</h2>
        </div>
        <p className="text-sm leading-relaxed text-gray-300">{summary}</p>
      </div>

      {/* Counts row */}
      <CountsRow counts={counts} />

      {/* Warnings */}
      {warnings.length > 0 && <WarningsBox warnings={warnings} />}

      {/* Changes list */}
      {changes.length > 0 && <ChangesList changes={changes} />}
    </div>
  );
}

function RiskBadge({ level }: { level: RiskLevel }) {
  const styles: Record<RiskLevel, string> = {
    HIGH: 'bg-red-900/60 text-red-300 ring-red-700',
    MEDIUM: 'bg-yellow-900/60 text-yellow-300 ring-yellow-700',
    LOW: 'bg-green-900/60 text-green-300 ring-green-700',
  };

  const icons: Record<RiskLevel, string> = {
    HIGH: '🔴',
    MEDIUM: '🟡',
    LOW: '🟢',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ring-1 ${styles[level]}`}
    >
      <span aria-hidden="true">{icons[level]}</span>
      {level} RISK
    </span>
  );
}

function CountsRow({ counts }: { counts: PlanAnalysis['counts'] }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <CountCard label="Added" value={counts.added} color="text-green-400" />
      <CountCard label="Changed" value={counts.changed} color="text-yellow-400" />
      <CountCard label="Destroyed" value={counts.destroyed} color="text-red-400" />
    </div>
  );
}

function CountCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-gray-700 bg-gray-900 py-4">
      <span className={`text-3xl font-bold ${color}`}>{value}</span>
      <span className="mt-1 text-xs text-gray-400">{label}</span>
    </div>
  );
}

function WarningsBox({ warnings }: { warnings: string[] }) {
  return (
    <div className="rounded-lg border border-red-800 bg-red-950/50 p-4">
      <div className="mb-2 flex items-center gap-2">
        <svg
          className="h-5 w-5 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
        <h3 className="text-sm font-semibold text-red-300">Warnings</h3>
      </div>
      <ul className="flex flex-col gap-1.5">
        {warnings.map((w, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-red-200">
            <span className="mt-0.5 shrink-0 text-red-400">•</span>
            {w}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChangesList({ changes }: { changes: ResourceChange[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Resource Changes</h3>
      <div className="flex flex-col gap-2">
        {changes.map((change, i) => (
          <ChangeRow key={i} change={change} />
        ))}
      </div>
    </div>
  );
}

const ACTION_STYLES: Record<ResourceChange['action'], { label: string; badge: string; icon: string }> = {
  create: { label: 'create', badge: 'bg-green-900/50 text-green-300 ring-green-800', icon: '+' },
  update: { label: 'update', badge: 'bg-yellow-900/50 text-yellow-300 ring-yellow-800', icon: '~' },
  destroy: { label: 'destroy', badge: 'bg-red-900/50 text-red-300 ring-red-800', icon: '-' },
  replace: { label: 'replace', badge: 'bg-orange-900/50 text-orange-300 ring-orange-800', icon: '±' },
};

function ChangeRow({ change }: { change: ResourceChange }) {
  const style = ACTION_STYLES[change.action];

  return (
    <div className="flex items-start gap-3 rounded-lg border border-gray-800 bg-gray-900/60 px-4 py-3">
      <span
        className={`mt-0.5 shrink-0 rounded px-2 py-0.5 font-mono text-xs font-bold ring-1 ${style.badge}`}
        title={style.label}
      >
        {style.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-sm font-medium text-gray-100 break-all">{change.resource}</p>
        <p className="mt-0.5 text-sm text-gray-400">{change.description}</p>
      </div>
      {change.isDestructive && (
        <span className="shrink-0 rounded bg-red-900/40 px-1.5 py-0.5 text-xs font-medium text-red-400 ring-1 ring-red-800">
          destructive
        </span>
      )}
    </div>
  );
}
