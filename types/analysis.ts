export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ResourceChange {
  resource: string;
  action: 'create' | 'update' | 'destroy' | 'replace';
  description: string;
  isDestructive: boolean;
}

export type CloudProvider = 'AWS' | 'Azure' | 'GCP' | 'Unknown';

export interface ResourceCost {
  resource: string;
  type: string;
  monthlyCost: number;
  assumptions: string;
}

export interface CostEstimate {
  provider: CloudProvider;
  monthlyTotal: number;
  yearlyTotal: number;
  currency: 'USD';
  breakdown: ResourceCost[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  disclaimer: string;
}

export type VulnerabilitySeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';

export interface VulnerabilityFinding {
  resource: string;
  resourceType: string;
  currentVersion: string;
  cveId: string;
  severity: VulnerabilitySeverity;
  description: string;
  recommendation: string;
  remediationSnippet: string;
}

export interface VulnerabilityContext {
  findings: VulnerabilityFinding[];
  scannedResources: number;
  disclaimer: string;
}

export interface Warning {
  message: string;
  remediationSnippet?: string;
}

export interface ModuleFinding {
  moduleName: string;
  source: string;
  currentVersion: string;
  latestKnownVersion: string;
  isPinned: boolean;
  isOutdated: boolean;
  recommendation: string;
}

export interface ModuleAnalysis {
  findings: ModuleFinding[];
  scannedModules: number;
  disclaimer: string;
}

export type CISStatus = 'PASS' | 'FAIL' | 'NOT_APPLICABLE';

export interface CISFinding {
  controlId: string;
  controlTitle: string;
  section: string;
  status: CISStatus;
  affectedResources: string[];
  description: string;
  remediationSnippet?: string;
}

export interface CISComplianceReport {
  findings: CISFinding[];
  passCount: number;
  failCount: number;
  notApplicableCount: number;
  disclaimer: string;
}

export type KubernetesSeverity = 'HIGH' | 'MEDIUM' | 'LOW';
export type KubernetesCheckType = 'DEPRECATED_API' | 'POD_SECURITY' | 'NETWORK_POLICY' | 'RBAC' | 'HELM_CONFIG';

export interface KubernetesFinding {
  resource: string;
  resourceType: string;
  checkType: KubernetesCheckType;
  severity: KubernetesSeverity;
  description: string;
  recommendation: string;
  remediationSnippet?: string;
}

export interface KubernetesAnalysis {
  findings: KubernetesFinding[];
  scannedResources: number;
  disclaimer: string;
}

export interface SavingsOpportunity {
  resource: string;
  resourceType: string;
  instanceType: string;
  onDemandMonthly: number;
  reserved1yrMonthly: number;
  reserved3yrMonthly: number;
  savingsMonthly1yr: number;
  savingsPercent1yr: number;
  savingsMonthly3yr: number;
  savingsPercent3yr: number;
}

export interface SavingsPlanReport {
  opportunities: SavingsOpportunity[];
  totalOnDemandMonthly: number;
  totalSavingsMonthly1yr: number;
  totalSavingsMonthly3yr: number;
  disclaimer: string;
}

export interface PlanAnalysis {
  riskLevel: RiskLevel;
  summary: string;
  counts: { added: number; changed: number; destroyed: number };
  changes: ResourceChange[];
  warnings: Warning[];
  costEstimate: CostEstimate;
  vulnerabilityContext: VulnerabilityContext;
  moduleAnalysis: ModuleAnalysis;
  cisCompliance: CISComplianceReport;
  kubernetesAnalysis: KubernetesAnalysis;
  savingsPlanReport: SavingsPlanReport;
}
