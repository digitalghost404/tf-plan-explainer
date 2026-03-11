import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { PlanAnalysis } from '@/types/analysis';

const client = new Anthropic();

// ── Prompt A: core analysis ───────────────────────────────────────────────────
// Handles: riskLevel, summary, counts, changes, warnings, costEstimate, moduleAnalysis

const SYSTEM_PROMPT_CORE = `You are a Terraform plan risk analyst and cloud cost estimator. When given Terraform plan output, analyze it and respond with ONLY valid JSON — no markdown, no explanation, no code fences.

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

Module analysis rules:
- Detect all module blocks in the plan; extract source and version pin for each
- isPinned = false if no version constraint is present — always flag as needing a pin
- isOutdated = true if the pinned version is behind the latest known version from your training data
- currentVersion = the version string from the version attribute, or "unpinned" if absent
- latestKnownVersion = the most recent version you know of from training data
- scannedModules = count of module blocks found
- If no modules found: findings: [], scannedModules: 0
- Invalid plan fallback for moduleAnalysis: { "findings": [], "scannedModules": 0, "disclaimer": "No modules detected." }

If the input is not a valid Terraform plan, return: { "riskLevel": "LOW", "summary": "No valid Terraform plan detected.", "counts": { "added": 0, "changed": 0, "destroyed": 0 }, "changes": [], "warnings": [], "costEstimate": { "provider": "Unknown", "monthlyTotal": 0, "yearlyTotal": 0, "currency": "USD", "breakdown": [], "confidence": "HIGH", "disclaimer": "No resources detected." }, "moduleAnalysis": { "findings": [], "scannedModules": 0, "disclaimer": "No modules detected." } }`;

// ── Prompt B: security analysis ───────────────────────────────────────────────
// Handles: vulnerabilityContext, cisCompliance


const SYSTEM_PROMPT_SECURITY = `You are a Terraform plan security analyst. When given Terraform plan output, analyze it and respond with ONLY valid JSON — no markdown, no explanation, no code fences.

The JSON must match this exact shape:
{
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
  "cisCompliance": {
    "findings": [
      {
        "controlId": "CIS 5.2",
        "controlTitle": "Ensure no security groups allow ingress from 0.0.0.0/0 to port 22",
        "section": "Networking",
        "status": "FAIL" | "PASS" | "NOT_APPLICABLE",
        "affectedResources": ["aws_security_group.old_db"],
        "description": "one sentence describing what was found",
        "remediationSnippet": "optional HCL block — FAIL findings only"
      }
    ],
    "passCount": number,
    "failCount": number,
    "notApplicableCount": number,
    "disclaimer": "Based on CIS AWS Foundations Benchmark v1.4; evaluates only configuration visible in the plan"
  }
}

Vulnerability scanning rules:
- Scan all resources for explicit version attributes: engine_version, kubernetes_version, runtime, ami_id, node_version, cluster_version, image, etc.
- For each versioned resource, check against known CVEs and security advisories from your training data
- Include CRITICAL/HIGH/MEDIUM findings; include LOW/INFORMATIONAL only if the version is significantly out of date
- If no version attribute is present on a resource, skip it — do not assume defaults
- remediationSnippet for each finding: a minimal HCL resource block showing only the resource type, name, and the corrected version attribute; keep it concise
- scannedResources = count of resources that had at least one version attribute checked
- If no versioned resources found, return findings: []
- Invalid plan fallback for vulnerabilityContext: { "findings": [], "scannedResources": 0, "disclaimer": "No resources detected." }

CIS AWS Foundations Benchmark v1.4 compliance rules:
Evaluate exactly these 11 controls and emit one finding per control:
  CIS 1.16 (IAM, "Ensure IAM policies are not attached directly to users"): FAIL if any aws_iam_user_policy or aws_iam_user_policy_attachment resource is present; PASS if IAM users exist but no direct policy attachments; NOT_APPLICABLE if no IAM user resources.
  CIS 2.1.1 (Storage, "Ensure S3 bucket has server-side encryption enabled"): FAIL if any aws_s3_bucket lacks server_side_encryption_configuration or an aws_s3_bucket_server_side_encryption_configuration resource; PASS if all S3 buckets have it; NOT_APPLICABLE if no S3 resources.
  CIS 2.1.2 (Storage, "Ensure S3 bucket versioning is enabled"): FAIL if any aws_s3_bucket lacks versioning { enabled = true } or no aws_s3_bucket_versioning with status = "Enabled"; PASS if all have versioning; NOT_APPLICABLE if no S3 resources.
  CIS 2.1.4 (Storage, "Ensure S3 bucket access logging is enabled"): FAIL if any aws_s3_bucket lacks a logging block or no aws_s3_bucket_logging resource; PASS if all have logging; NOT_APPLICABLE if no S3 resources.
  CIS 2.2.1 (Storage, "Ensure EBS volumes are encrypted"): FAIL if any aws_ebs_volume has encrypted = false or omits encrypted; PASS if all are encrypted = true; NOT_APPLICABLE if no EBS volume resources.
  CIS 2.3.1 (Storage, "Ensure RDS instances have encryption at rest enabled"): FAIL if any aws_db_instance has storage_encrypted = false or omits it; PASS if storage_encrypted = true on all; NOT_APPLICABLE if no RDS resources.
  CIS 2.3.2 (Storage, "Ensure RDS instances have auto minor version upgrade enabled"): FAIL if any aws_db_instance has auto_minor_version_upgrade = false; PASS if true/absent (default true); NOT_APPLICABLE if no RDS resources.
  CIS 3.1 (Logging, "Ensure CloudTrail is enabled in all regions"): FAIL if any aws_cloudtrail lacks is_multi_region_trail = true; PASS if present and multi-region; NOT_APPLICABLE if no CloudTrail resources.
  CIS 5.2 (Networking, "Ensure no security groups allow ingress from 0.0.0.0/0 to port 22 or 3389"): FAIL if any aws_security_group ingress rule allows cidr_blocks containing 0.0.0.0/0 or ipv6_cidr_blocks containing ::/0 on port 22 or 3389; PASS if no such rule exists; NOT_APPLICABLE if no security group resources.
  CIS 5.3 (Networking, "Ensure VPC flow logging is enabled"): FAIL if any aws_vpc exists without a corresponding aws_flow_log; PASS if all VPCs have flow logs; NOT_APPLICABLE if no VPC resources.
  CIS 5.4 (Networking, "Ensure the default security group of every VPC restricts all traffic"): FAIL if any aws_default_security_group allows any ingress or egress rules; PASS if it has empty ingress/egress; NOT_APPLICABLE if no default security group resources.
- status rules: PASS = resource config satisfies the control; FAIL = explicit violation visible in plan; NOT_APPLICABLE = no relevant resource types present
- passCount + failCount + notApplicableCount must equal exactly 11
- affectedResources: list resource identifiers for FAIL/PASS; empty array for NOT_APPLICABLE
- remediationSnippet: include only for FAIL findings where a concrete HCL attribute change resolves the violation; omit otherwise
- Invalid plan fallback for cisCompliance: { "findings": [], "passCount": 0, "failCount": 0, "notApplicableCount": 0, "disclaimer": "No applicable resources detected." }

If the input is not a valid Terraform plan, return: { "vulnerabilityContext": { "findings": [], "scannedResources": 0, "disclaimer": "No resources detected." }, "cisCompliance": { "findings": [], "passCount": 0, "failCount": 0, "notApplicableCount": 0, "disclaimer": "No applicable resources detected." } }`;

// ── Prompt C: Kubernetes deep analysis ────────────────────────────────────────
// Handles: kubernetesAnalysis

const SYSTEM_PROMPT_KUBERNETES = `You are a Kubernetes and Terraform security analyst. When given Terraform plan output, analyze it and respond with ONLY valid JSON — no markdown, no explanation, no code fences.

The JSON must match this exact shape:
{
  "kubernetesAnalysis": {
    "findings": [
      {
        "resource": "resource_type.resource_name",
        "resourceType": "resource_type",
        "checkType": "DEPRECATED_API" | "POD_SECURITY" | "NETWORK_POLICY" | "RBAC" | "HELM_CONFIG",
        "severity": "HIGH" | "MEDIUM" | "LOW",
        "description": "Plain-English explanation of the issue",
        "recommendation": "Specific remediation advice",
        "remediationSnippet": "minimal HCL resource block showing the fix (optional — omit if no concrete HCL change resolves it)"
      }
    ],
    "scannedResources": number,
    "disclaimer": "one sentence noting findings are based on training data with a knowledge cutoff"
  }
}

Scan ONLY these resource types (ignore all others):
kubernetes_deployment, kubernetes_daemonset, kubernetes_statefulset, kubernetes_pod, kubernetes_job, kubernetes_cronjob, kubernetes_network_policy, kubernetes_cluster_role_binding, kubernetes_role_binding, helm_release, aws_eks_cluster, azurerm_kubernetes_cluster, google_container_cluster, aws_eks_node_group.

scannedResources = count of resources from the above list present in the plan.

Check rules (emit one finding per violation):

DEPRECATED_API (HIGH):
- api_version = "extensions/v1beta1" → removed in Kubernetes 1.16
- api_version = "batch/v1beta1" → removed in Kubernetes 1.25
- api_version = "networking.k8s.io/v1beta1" → removed in Kubernetes 1.22
- api_version = "policy/v1beta1" for PodSecurityPolicy → removed in Kubernetes 1.25

POD_SECURITY HIGH: any container spec with privileged = true, allow_privilege_escalation = true, capabilities.add containing "SYS_ADMIN" or "NET_RAW", or host_network = true / host_pid = true
POD_SECURITY MEDIUM: run_as_non_root = false, run_as_user = 0, or capabilities.add containing "NET_ADMIN", "SYS_PTRACE", or "DAC_OVERRIDE"
POD_SECURITY LOW: missing read_only_root_filesystem = true on container security context

NETWORK_POLICY (MEDIUM): a kubernetes_namespace resource exists without a corresponding kubernetes_network_policy in the plan

RBAC (HIGH): a kubernetes_cluster_role_binding with role_ref.name = "cluster-admin" bound to a subject whose name does not start with "system:"

HELM_CONFIG HIGH: helm_release with force_update = true or recreate_pods = true
HELM_CONFIG MEDIUM: helm_release where both atomic = false and wait = false are set (explicit insecure combination)

Include remediationSnippet for all findings where a concrete HCL attribute change resolves the issue.

If no Kubernetes resources from the scan list are present, return: { "kubernetesAnalysis": { "findings": [], "scannedResources": 0, "disclaimer": "No Kubernetes resources detected." } }
If the input is not a valid Terraform plan, return the same empty fallback.`;

// ── Prompt D: savings plan recommendations ────────────────────────────────────
// Handles: savingsPlanReport

const SYSTEM_PROMPT_SAVINGS = `You are a cloud cost optimization analyst specializing in reserved pricing. When given Terraform plan output, analyze it and respond with ONLY valid JSON — no markdown, no explanation, no code fences.

The JSON must match this exact shape:
{
  "savingsPlanReport": {
    "opportunities": [
      {
        "resource": "resource_type.resource_name",
        "resourceType": "resource_type",
        "instanceType": "instance/tier string (e.g. t3.micro, db.t3.large)",
        "onDemandMonthly": number,
        "reserved1yrMonthly": number,
        "reserved3yrMonthly": number,
        "savingsMonthly1yr": number,
        "savingsPercent1yr": number,
        "savingsMonthly3yr": number,
        "savingsPercent3yr": number
      }
    ],
    "totalOnDemandMonthly": number,
    "totalSavingsMonthly1yr": number,
    "totalSavingsMonthly3yr": number,
    "disclaimer": "one sentence noting estimates use standard no-upfront reserved pricing and actual savings vary"
  }
}

Eligible resource types (CREATED or REPLACED actions only — skip UPDATED or DESTROYED):
aws_instance, aws_db_instance, aws_elasticache_cluster, aws_elasticache_replication_group, aws_redshift_cluster, aws_opensearch_domain, azurerm_virtual_machine, azurerm_linux_virtual_machine, azurerm_windows_virtual_machine, azurerm_sql_database, google_compute_instance, google_sql_database_instance.

Discount rates (no-upfront reserved vs on-demand):
- AWS EC2 (aws_instance): 1yr ~38%, 3yr ~57%
- AWS RDS (aws_db_instance): 1yr ~35%, 3yr ~55%
- AWS ElastiCache (aws_elasticache_cluster / aws_elasticache_replication_group): 1yr ~38%, 3yr ~55%
- AWS Redshift (aws_redshift_cluster): 1yr ~38%, 3yr ~55%
- AWS OpenSearch (aws_opensearch_domain): 1yr ~38%, 3yr ~55%
- Azure VM (azurerm_virtual_machine / azurerm_linux_virtual_machine / azurerm_windows_virtual_machine): 1yr ~37%, 3yr ~52%
- Azure SQL (azurerm_sql_database): 1yr ~37%, 3yr ~52%
- GCP Compute (google_compute_instance): 1yr ~37%, 3yr ~55%
- GCP SQL (google_sql_database_instance): 1yr ~37%, 3yr ~55%

Formulas:
- onDemandMonthly: estimate using on-demand pricing for the detected instance_type / node_type / machine_type (730 hrs/month, us-east-1 or equivalent default region, standard tier)
- reserved1yrMonthly = round(onDemandMonthly * (1 - rate1yr), 2)
- reserved3yrMonthly = round(onDemandMonthly * (1 - rate3yr), 2)
- savingsMonthly1yr = round(onDemandMonthly - reserved1yrMonthly, 2)
- savingsPercent1yr = round((savingsMonthly1yr / onDemandMonthly) * 100, 1)
- savingsMonthly3yr = round(onDemandMonthly - reserved3yrMonthly, 2)
- savingsPercent3yr = round((savingsMonthly3yr / onDemandMonthly) * 100, 1)
- totalOnDemandMonthly = sum of all onDemandMonthly
- totalSavingsMonthly1yr = sum of all savingsMonthly1yr
- totalSavingsMonthly3yr = sum of all savingsMonthly3yr

If no eligible resources are present (CREATED or REPLACED), return: { "savingsPlanReport": { "opportunities": [], "totalOnDemandMonthly": 0, "totalSavingsMonthly1yr": 0, "totalSavingsMonthly3yr": 0, "disclaimer": "No eligible reserved-pricing resources (EC2, RDS, ElastiCache, etc.) detected in this plan." } }
If the input is not a valid Terraform plan, return the same empty fallback.`;

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

  if (trimmed.length > 200_000) {
    return NextResponse.json({ error: 'Plan exceeds maximum length of 200,000 characters' }, { status: 400 });
  }

  const userMessage = `Analyze this Terraform plan:\n\n${trimmed}`;

  try {
    const [coreMessage, securityMessage, kubernetesMessage, savingsMessage] = await Promise.all([
      client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        system: SYSTEM_PROMPT_CORE,
        messages: [{ role: 'user', content: userMessage }],
      }),
      client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        system: SYSTEM_PROMPT_SECURITY,
        messages: [{ role: 'user', content: userMessage }],
      }),
      client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: SYSTEM_PROMPT_KUBERNETES,
        messages: [{ role: 'user', content: userMessage }],
      }),
      client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: SYSTEM_PROMPT_SAVINGS,
        messages: [{ role: 'user', content: userMessage }],
      }),
    ]);

    const coreContent = coreMessage.content[0];
    const securityContent = securityMessage.content[0];
    const kubernetesContent = kubernetesMessage.content[0];
    const savingsContent = savingsMessage.content[0];

    if (
      coreContent.type !== 'text' ||
      securityContent.type !== 'text' ||
      kubernetesContent.type !== 'text' ||
      savingsContent.type !== 'text'
    ) {
      return NextResponse.json({ error: 'Unexpected response from Claude' }, { status: 500 });
    }

    // Strip markdown fences Claude occasionally emits despite prompt instructions,
    // e.g. ```json\n{...}\n``` or plain ``` fences.
    function stripJson(raw: string): string {
      const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      return fenced ? fenced[1].trim() : raw.trim();
    }

    let analysis: PlanAnalysis;
    try {
      const core       = JSON.parse(stripJson(coreContent.text));
      const security   = JSON.parse(stripJson(securityContent.text));
      const kubernetes = JSON.parse(stripJson(kubernetesContent.text));
      const savings    = JSON.parse(stripJson(savingsContent.text));
      analysis = { ...core, ...security, ...kubernetes, ...savings } as PlanAnalysis;
    } catch (parseErr) {
      // Log which prompt failed to help diagnose future issues.
      console.error('JSON parse error from Claude response:', {
        message: parseErr instanceof Error ? parseErr.message : String(parseErr),
      });
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
