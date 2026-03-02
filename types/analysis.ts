export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ResourceChange {
  resource: string;
  action: 'create' | 'update' | 'destroy' | 'replace';
  description: string;
  isDestructive: boolean;
}

export interface PlanAnalysis {
  riskLevel: RiskLevel;
  summary: string;
  counts: { added: number; changed: number; destroyed: number };
  changes: ResourceChange[];
  warnings: string[];
}
