import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { PlanAnalysis } from '@/types/analysis';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a Terraform plan risk analyst and cloud cost estimator. When given Terraform plan output, analyze it and respond with ONLY valid JSON — no markdown, no explanation, no code fences.

The JSON must match this exact shape:
{
  "riskLevel": "HIGH" | "MEDIUM" | "LOW",
  "summary": "2-3 sentence plain-English overview of what this plan does",
  "counts": { "added": number, "changed": number, "destroyed": number },
  "changes": [
    {
      "resource": "resource_type.resource_name",
      "action": "create" | "update" | "destroy" | "replace",
      "description": "One sentence plain-English explanation of what will happen",
      "isDestructive": boolean
    }
  ],
  "warnings": [
    {
      "message": "description of the risk",
      "remediationSnippet": "resource \"type\" \"name\" {\n  attribute = fixed_value\n}"
    }
  ],
  "costEstimate": {
    "provider": "AWS" | "Azure" | "GCP" | "Unknown",
    "monthlyTotal": number,
    "yearlyTotal": number,
    "currency": "USD",
    "breakdown": [
      {
        "resource": "resource_type.resource_name",
        "type": "resource_type",
        "monthlyCost": number,
        "assumptions": "brief description of pricing assumptions"
      }
    ],
    "confidence": "HIGH" | "MEDIUM" | "LOW",
    "disclaimer": "one sentence disclaimer about estimate accuracy"
  },
  "vulnerabilityContext": {
    "findings": [
      {
        "resource": "resource_type.resource_name",
        "resourceType": "resource_type",
        "currentVersion": "engine/runtime and version string",
        "cveId": "CVE-YYYY-NNNNN or N/A",
        "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFORMATIONAL",
        "description": "Plain-English explanation of the vulnerability",
        "recommendation": "Specific remediation: upgrade to version X.Y.Z",
        "remediationSnippet": "minimal HCL resource block with the fix applied, e.g. bumped engine_version"
      }
    ],
    "scannedResources": number,
    "disclaimer": "one sentence noting findings are based on training data with a knowledge cutoff"
  },
  "moduleAnalysis": {
    "findings": [
      {
        "moduleName": "module.vpc",
        "source": "terraform-aws-modules/vpc/aws",
        "currentVersion": "3.14.0",
        "latestKnownVersion": "5.1.2",
        "isPinned": true,
        "isOutdated": true,
        "recommendation": "Upgrade to 5.x; review CHANGELOG for breaking changes"
      }
    ],
    "scannedModules": number,
    "disclaimer": "Version data from training knowledge; verify at registry.terraform.io"
  }
}

Risk level rules:
- HIGH: any resource is being destroyed or replaced
- MEDIUM: updates to critical infrastructure (databases, load balancers, security groups, IAM roles, networking)
- LOW: only creates or updates to non-critical resources

For the warnings array, include explicit callouts for:
- Resources being permanently deleted
- Resources being replaced (destroy then create), which causes downtime
- Potential data loss scenarios
- Security group or IAM changes that could affect access
Omit remediationSnippet from a warning object if no concrete HCL fix applies (e.g. pure operational warnings). Include it when there is a specific HCL attribute change that addresses the risk.

Cost estimation rules:
- Detect the cloud provider from resource type prefixes: "aws_" → AWS, "azurerm_" or "azuread_" → Azure, "google_" → GCP; if mixed or unrecognized → Unknown
- For each resource being CREATED or REPLACED, estimate the monthly USD cost using reasonable default assumptions (on-demand pricing, typical region like us-east-1, standard tier, 730 hours/month)
- Resources being DESTROYED, or free resources (IAM roles, security groups, VPCs, DNS records, etc.), get monthlyCost of 0
- Set assumptions to a brief string like "t3.medium, on-demand, us-east-1, 730 hrs/month" or "free resource" if zero cost
- monthlyTotal = sum of all monthlyCost values in breakdown
- yearlyTotal = monthlyTotal * 12
- confidence: HIGH if all resources have well-known, stable pricing; MEDIUM if some assumptions were necessary; LOW if many resources have uncertain or highly variable pricing
- disclaimer: one sentence noting estimates are approximate and based on standard assumptions

Vulnerability scanning rules:
- Scan all resources for explicit version attributes: engine_version, kubernetes_version, runtime, ami_id, node_version, cluster_version, image, etc.
- For each versioned resource, check against known CVEs and security advisories from your training data
- Include CRITICAL/HIGH/MEDIUM findings; include LOW/INFORMATIONAL only if the version is significantly out of date
- If no version attribute is present on a resource, skip it — do not assume defaults
- remediationSnippet for each finding: a minimal HCL resource block showing only the resource type, name, and the corrected version attribute; keep it concise
- scannedResources = count of resources that had at least one version attribute checked
- If no versioned resources found, return findings: []
- Invalid plan fallback for vulnerabilityContext: { "findings": [], "scannedResources": 0, "disclaimer": "No resources detected." }

Module analysis rules:
- Detect all module blocks in the plan; extract source and version pin for each
- isPinned = false if no version constraint is present — always flag as needing a pin
- isOutdated = true if the pinned version is behind the latest known version from your training data
- currentVersion = the version string from the version attribute, or "unpinned" if absent
- latestKnownVersion = the most recent version you know of from training data
- scannedModules = count of module blocks found
- If no modules found: findings: [], scannedModules: 0
- Invalid plan fallback for moduleAnalysis: { "findings": [], "scannedModules": 0, "disclaimer": "No modules detected." }

If the input is not a valid Terraform plan, set riskLevel to "LOW", summary to "No valid Terraform plan detected.", counts to all zeros, changes to [], warnings to [], costEstimate to { "provider": "Unknown", "monthlyTotal": 0, "yearlyTotal": 0, "currency": "USD", "breakdown": [], "confidence": "HIGH", "disclaimer": "No resources detected." }, vulnerabilityContext to { "findings": [], "scannedResources": 0, "disclaimer": "No resources detected." }, and moduleAnalysis to { "findings": [], "scannedModules": 0, "disclaimer": "No modules detected." }.`;

export async function POST(request: NextRequest) {
  let plan: string;

  try {
    const body = await request.json();
    plan = body?.plan;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!plan || typeof plan !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid "plan" field' }, { status: 400 });
  }

  const trimmed = plan.trim();
  if (trimmed.length === 0) {
    return NextResponse.json({ error: 'Plan cannot be empty' }, { status: 400 });
  }

  if (trimmed.length > 100_000) {
    return NextResponse.json({ error: 'Plan exceeds maximum length of 100,000 characters' }, { status: 400 });
  }

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Analyze this Terraform plan:\n\n${trimmed}`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected response from Claude' }, { status: 500 });
    }

    let analysis: PlanAnalysis;
    try {
      analysis = JSON.parse(content.text) as PlanAnalysis;
    } catch {
      // Never return Claude's raw response to the client — it may contain
      // partial plan content or internal system prompt details.
      return NextResponse.json({ error: 'Claude returned invalid JSON' }, { status: 500 });
    }

    return NextResponse.json(analysis);
  } catch (err) {
    // Log only the message and type — not the full error object — to avoid
    // leaking stack traces or request details into log aggregators.
    console.error('Claude API error:', {
      message: err instanceof Error ? err.message : 'Unknown error',
      type: err instanceof Error ? err.name : typeof err,
    });
    return NextResponse.json({ error: 'Failed to contact Claude API' }, { status: 500 });
  }
}
