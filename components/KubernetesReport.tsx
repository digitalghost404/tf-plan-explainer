'use client';

import { useState } from 'react';
import type { KubernetesAnalysis, KubernetesFinding, KubernetesSeverity, KubernetesCheckType } from '@/types/analysis';

const SEVERITY_STYLES: Record<KubernetesSeverity, string> = {
  HIGH:   'bg-red-900/60 text-red-300 ring-1 ring-red-700',
  MEDIUM: 'bg-yellow-900/60 text-yellow-300 ring-1 ring-yellow-700',
  LOW:    'bg-blue-900/60 text-blue-300 ring-1 ring-blue-700',
};

const CHECK_TYPE_STYLES: Record<KubernetesCheckType, string> = {
  DEPRECATED_API:  'bg-purple-900/60 text-purple-300 ring-1 ring-purple-700',
  POD_SECURITY:    'bg-orange-900/60 text-orange-300 ring-1 ring-orange-700',
  NETWORK_POLICY:  'bg-sky-900/60 text-sky-300 ring-1 ring-sky-700',
  RBAC:            'bg-red-900/60 text-red-300 ring-1 ring-red-700',
  HELM_CONFIG:     'bg-indigo-900/60 text-indigo-300 ring-1 ring-indigo-700',
};

const SEVERITY_ORDER: KubernetesSeverity[] = ['HIGH', 'MEDIUM', 'LOW'];

function SeverityBadge({ severity }: { severity: KubernetesSeverity }) {
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${SEVERITY_STYLES[severity]}`}>
      {severity}
    </span>
  );
}

function CheckTypeBadge({ checkType }: { checkType: KubernetesCheckType }) {
  const label = checkType.replace(/_/g, ' ');
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${CHECK_TYPE_STYLES[checkType]}`}>
      {label}
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

function FindingCard({ finding }: { finding: KubernetesFinding }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={finding.severity} />
        <CheckTypeBadge checkType={finding.checkType} />
        <span className="font-mono text-xs text-gray-300">{finding.resource}</span>
        <span className="text-xs text-gray-500">·</span>
        <span className="rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-400">{finding.resourceType}</span>
      </div>
      <p className="mt-2 text-sm text-gray-300">{finding.description}</p>
      <p className="mt-1.5 text-xs text-gray-500">
        <span className="font-medium text-gray-400">Recommendation:</span> {finding.recommendation}
      </p>
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
  kubernetesAnalysis: KubernetesAnalysis;
}

export default function KubernetesReport({ kubernetesAnalysis }: Props) {
  const { findings, scannedResources, disclaimer } = kubernetesAnalysis;

  const counts = SEVERITY_ORDER.reduce<Partial<Record<KubernetesSeverity, number>>>((acc, s) => {
    const n = findings.filter((f) => f.severity === s).length;
    if (n > 0) acc[s] = n;
    return acc;
  }, {});

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-white">Kubernetes Deep Analysis</h2>
        <span className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-400">
          {findings.length} finding{findings.length !== 1 ? 's' : ''} · {scannedResources} resource{scannedResources !== 1 ? 's' : ''} scanned
        </span>
      </div>

      {/* Severity summary pills */}
      {findings.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {(Object.entries(counts) as [KubernetesSeverity, number][]).map(([sev, count]) => (
            <span key={sev} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase ${SEVERITY_STYLES[sev]}`}>
              <span>{count}</span>
              <span>{sev}</span>
            </span>
          ))}
        </div>
      )}

      {/* Findings or empty state */}
      {findings.length === 0 ? (
        <p className="rounded-lg border border-gray-700 bg-gray-800/30 px-4 py-5 text-center text-sm text-gray-400">
          No Kubernetes resources detected in this plan.
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
