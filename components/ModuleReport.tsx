'use client';

import type { ModuleAnalysis, ModuleFinding } from '@/types/analysis';

function StatusBadge({ isPinned, isOutdated }: { isPinned: boolean; isOutdated: boolean }) {
  if (!isPinned) {
    return (
      <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide bg-red-900/60 text-red-300 ring-1 ring-red-700">
        UNPINNED
      </span>
    );
  }
  if (isOutdated) {
    return (
      <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide bg-orange-900/60 text-orange-300 ring-1 ring-orange-700">
        OUTDATED
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide bg-green-900/60 text-green-300 ring-1 ring-green-700">
      OK
    </span>
  );
}

function FindingCard({ finding }: { finding: ModuleFinding }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge isPinned={finding.isPinned} isOutdated={finding.isOutdated} />
        <span className="font-mono text-xs text-gray-300">{finding.moduleName}</span>
        <span className="text-xs text-gray-500">·</span>
        <span className="text-xs text-gray-400">{finding.source}</span>
      </div>
      <div className="mt-2 text-xs text-gray-400">
        <span className="font-medium text-gray-300">Version:</span>{' '}
        <span className="font-mono">{finding.currentVersion}</span>
        {finding.isPinned && (
          <>
            <span className="mx-1.5 text-gray-600">→</span>
            <span className="font-mono text-green-400">{finding.latestKnownVersion}</span>
            <span className="ml-1 text-gray-500">(latest known)</span>
          </>
        )}
      </div>
      <p className="mt-1.5 text-xs text-gray-500">
        <span className="font-medium text-gray-400">Recommendation:</span> {finding.recommendation}
      </p>
    </div>
  );
}

interface Props {
  moduleAnalysis: ModuleAnalysis;
}

export default function ModuleReport({ moduleAnalysis }: Props) {
  const { findings, scannedModules, disclaimer } = moduleAnalysis;

  const outdatedCount = findings.filter((f) => f.isOutdated).length;
  const unpinnedCount = findings.filter((f) => !f.isPinned).length;

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-white">Module Analysis</h2>
        <span className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-400">
          {scannedModules} module{scannedModules !== 1 ? 's' : ''} scanned
        </span>
      </div>

      {/* Summary pills */}
      {findings.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {outdatedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase bg-orange-900/60 text-orange-300 ring-1 ring-orange-700">
              <span>{outdatedCount}</span>
              <span>outdated</span>
            </span>
          )}
          {unpinnedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase bg-red-900/60 text-red-300 ring-1 ring-red-700">
              <span>{unpinnedCount}</span>
              <span>unpinned</span>
            </span>
          )}
        </div>
      )}

      {/* Findings or empty state */}
      {findings.length === 0 ? (
        <p className="rounded-lg border border-gray-700 bg-gray-800/30 px-4 py-5 text-center text-sm text-gray-400">
          No module blocks detected in this plan.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {findings.map((f, i) => (
            <FindingCard key={i} finding={f} />
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <p className="mt-4 text-xs italic text-gray-500">{disclaimer}</p>
    </div>
  );
}
