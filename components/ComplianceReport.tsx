'use client';

import { useState } from 'react';
import type { CISComplianceReport, CISFinding, CISStatus } from '@/types/analysis';

const STATUS_STYLES: Record<CISStatus, string> = {
  PASS:           'bg-green-900/60 text-green-300 ring-1 ring-green-700',
  FAIL:           'bg-red-900/60 text-red-300 ring-1 ring-red-700',
  NOT_APPLICABLE: 'bg-gray-800 text-gray-400 ring-1 ring-gray-600',
};

const STATUS_LABEL: Record<CISStatus, string> = {
  PASS:           'PASS',
  FAIL:           'FAIL',
  NOT_APPLICABLE: 'N/A',
};

function StatusBadge({ status }: { status: CISStatus }) {
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${STATUS_STYLES[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      className="absolute right-2 top-2 rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-400 hover:bg-gray-700 hover:text-gray-200"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function FindingCard({ finding }: { finding: CISFinding }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={finding.status} />
        <span className="font-mono text-xs text-indigo-300">{finding.controlId}</span>
        <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
          {finding.section}
        </span>
      </div>
      <p className="mt-2 text-sm font-medium text-gray-200">{finding.controlTitle}</p>
      <p className="mt-1 text-xs text-gray-400">{finding.description}</p>
      {finding.affectedResources.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {finding.affectedResources.map((r) => (
            <li key={r} className="font-mono text-xs text-gray-300">
              {r}
            </li>
          ))}
        </ul>
      )}
      {finding.remediationSnippet && (
        <>
          <button
            onClick={() => setOpen((o) => !o)}
            className="mt-2 text-xs text-indigo-400 hover:text-indigo-300"
          >
            {open ? '▲' : '▼'} Remediation
          </button>
          {open && (
            <div className="relative mt-2 rounded bg-gray-950 p-3">
              <pre className="whitespace-pre-wrap overflow-x-auto font-mono text-xs text-green-300">
                {finding.remediationSnippet}
              </pre>
              <CopyButton text={finding.remediationSnippet} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface Props {
  cisCompliance: CISComplianceReport;
}

export default function ComplianceReport({ cisCompliance }: Props) {
  const { findings, passCount, failCount, notApplicableCount, disclaimer } = cisCompliance;

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-white">CIS AWS Foundations Benchmark</h2>
        <span className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-400">
          {failCount} finding{failCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Summary pills */}
      {findings.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase bg-green-900/60 text-green-300 ring-1 ring-green-700">
            <span>{passCount}</span>
            <span>PASS</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase bg-red-900/60 text-red-300 ring-1 ring-red-700">
            <span>{failCount}</span>
            <span>FAIL</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase bg-gray-800 text-gray-400 ring-1 ring-gray-600">
            <span>{notApplicableCount}</span>
            <span>N/A</span>
          </span>
        </div>
      )}

      {/* Findings or empty state */}
      {findings.length === 0 ? (
        <p className="rounded-lg border border-gray-700 bg-gray-800/30 px-4 py-5 text-center text-sm text-gray-400">
          No applicable AWS resources detected in this plan.
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
