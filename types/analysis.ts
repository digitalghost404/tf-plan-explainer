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

export interface PlanAnalysis {
  riskLevel: RiskLevel;
  summary: string;
  counts: { added: number; changed: number; destroyed: number };
  changes: ResourceChange[];
  warnings: string[];
  costEstimate: CostEstimate;
}
