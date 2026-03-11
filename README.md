# Terraform Plan Explainer

A web app that translates raw `terraform plan` output into a plain-English risk summary, cost estimate, vulnerability report, Kubernetes security audit, reserved-instance savings analysis, module analysis, and CIS compliance audit — powered by Claude. Paste your plan, get back a full security and operations briefing in seconds.

---

## Why this exists

`terraform plan` output is precise, but it's not designed for quick human review. A busy engineer staring at 200 lines of diff symbols (`+`, `~`, `-`) before a production deploy can easily miss a `-/+` replace action that will cause 30 seconds of downtime, or a `-` destroy on a database that was never meant to be deleted.

This tool acts as a second set of eyes. It sends your plan to Claude with structured prompts that force a consistent analysis and return a JSON payload your UI can render in a clear, scannable format. The goal is not to replace careful review — it's to surface the things that most need careful review, immediately.

---

## What it produces

For every plan you submit, the app returns:

| Output | Description |
|---|---|
| **Risk badge** | `HIGH` / `MEDIUM` / `LOW` with color coding |
| **Plain-English summary** | 2–3 sentences describing what the plan does overall |
| **Resource counts** | How many resources are being added, changed, and destroyed |
| **Warnings** | Explicit callouts for destroys, replacements, data loss, or security changes, with HCL remediation snippets where applicable |
| **Per-resource breakdown** | Every changed resource listed with its action type and a one-sentence explanation |
| **Cost estimate** | Monthly and yearly USD totals, per-resource breakdown with pricing assumptions, confidence level, and provider detection (AWS / Azure / GCP) |
| **Vulnerability report** | CVE findings for any versioned resources (RDS engine versions, EKS Kubernetes versions, Lambda runtimes, etc.) with severity ratings and HCL remediation snippets |
| **Kubernetes deep analysis** | Security audit of all Kubernetes, Helm, and managed-cluster resources — deprecated API versions, insecure pod security contexts, missing network policies, dangerous RBAC bindings, and risky Helm release options |
| **Savings plan recommendations** | Reserved-instance pricing comparison for every eligible resource being created or replaced — 1-year and 3-year monthly costs, savings deltas, and percentage badges |
| **Module analysis** | Version pin status and update recommendations for every Terraform module block |
| **CIS compliance** | PASS / FAIL / N/A for 11 CIS AWS Foundations Benchmark v1.4 controls |
| **PDF export** | One-click download of the full analysis as a formatted PDF report |

---

## Analysis sections

### Risk level

| Level | Trigger |
|---|---|
| `HIGH` | Any resource is being **destroyed** or **replaced** (destroy + recreate) |
| `MEDIUM` | Updates to critical infrastructure: databases, load balancers, security groups, IAM roles, or networking resources |
| `LOW` | Only creates, or updates to non-critical resources |

### Cost estimate

Costs are only estimated for resources being **created** or **replaced**. Resources being **destroyed** or that are inherently free (IAM roles, security groups, VPCs, route tables, etc.) are listed at `$0.00`. All figures assume on-demand pricing in a standard region (e.g. `us-east-1`) unless the plan specifies otherwise.

| Confidence | Meaning |
|---|---|
| `HIGH` | All resources have well-known, stable list pricing |
| `MEDIUM` | Some resources required assumptions (unspecified instance type, usage-based pricing, etc.) |
| `LOW` | Many resources have uncertain or highly variable pricing |

### Vulnerability context

Scans all resources for explicit version attributes (`engine_version`, `kubernetes_version`, `runtime`, `ami_id`, etc.) and checks them against known CVEs and security advisories. Only CRITICAL, HIGH, and MEDIUM findings are included by default; LOW/INFORMATIONAL findings appear only for significantly out-of-date versions. Each finding includes a minimal HCL remediation snippet showing the corrected version attribute.

### Kubernetes deep analysis

Scans all Kubernetes, Helm, and managed-cluster resources for security issues across five check types:

| Check Type | Severity | What's flagged |
|---|---|---|
| `DEPRECATED_API` | HIGH | `extensions/v1beta1` (removed 1.16), `batch/v1beta1` (removed 1.25), `networking.k8s.io/v1beta1` (removed 1.22), `policy/v1beta1` PodSecurityPolicy (removed 1.25) |
| `POD_SECURITY` | HIGH | `privileged = true`, `allow_privilege_escalation = true`, `SYS_ADMIN`/`NET_RAW` capabilities, `host_network`/`host_pid = true` |
| `POD_SECURITY` | MEDIUM | `run_as_user = 0`, `run_as_non_root = false`, `NET_ADMIN`/`SYS_PTRACE`/`DAC_OVERRIDE` capabilities |
| `POD_SECURITY` | LOW | Missing `read_only_root_filesystem = true` |
| `NETWORK_POLICY` | MEDIUM | Namespace without a corresponding `kubernetes_network_policy` |
| `RBAC` | HIGH | `cluster_role_binding` with `cluster-admin` bound to a non-`system:` subject |
| `HELM_CONFIG` | HIGH | `force_update = true` or `recreate_pods = true` |
| `HELM_CONFIG` | MEDIUM | `atomic = false` combined with `wait = false` |

Each finding shows dual severity + check-type badges, the affected resource, a description, a recommendation, and a collapsible `▼ Remediation` HCL snippet where a concrete fix exists.

Scanned resource types: `kubernetes_deployment`, `kubernetes_daemonset`, `kubernetes_statefulset`, `kubernetes_pod`, `kubernetes_job`, `kubernetes_cronjob`, `kubernetes_network_policy`, `kubernetes_cluster_role_binding`, `kubernetes_role_binding`, `helm_release`, `aws_eks_cluster`, `azurerm_kubernetes_cluster`, `google_container_cluster`, `aws_eks_node_group`.

### Savings plan recommendations

For every eligible resource being **created** or **replaced**, computes the monthly cost difference between on-demand and 1-year / 3-year no-upfront reserved pricing. Savings percentage badges are color-scaled: gray (<30%), green (30–50%), emerald (≥50%).

Eligible resource types: `aws_instance`, `aws_db_instance`, `aws_elasticache_cluster`, `aws_elasticache_replication_group`, `aws_redshift_cluster`, `aws_opensearch_domain`, `azurerm_virtual_machine/*`, `azurerm_sql_database`, `google_compute_instance`, `google_sql_database_instance`.

Approximate discount rates used (no-upfront reserved):

| Provider / Service | 1-year | 3-year |
|---|---|---|
| AWS EC2 | ~38% | ~57% |
| AWS RDS | ~35% | ~55% |
| AWS ElastiCache / Redshift / OpenSearch | ~38% | ~55% |
| Azure VM / SQL | ~37% | ~52% |
| GCP Compute / SQL | ~37% | ~55% |

### Module analysis

Detects all `module` blocks and evaluates each one:
- **Unpinned** — no `version` constraint present (always flagged)
- **Outdated** — pinned version is behind the latest known version
- **OK** — pinned and up to date

### CIS AWS Foundations Benchmark v1.4

Evaluates 11 controls across four sections. Each control returns `PASS`, `FAIL`, or `NOT_APPLICABLE` based solely on configuration visible in the plan. `FAIL` findings include a collapsible HCL remediation snippet where a concrete attribute change resolves the violation.

| Control | Title | Section |
|---|---|---|
| CIS 1.16 | IAM policies not attached directly to users | IAM |
| CIS 2.1.1 | S3 server-side encryption enabled | Storage |
| CIS 2.1.2 | S3 bucket versioning enabled | Storage |
| CIS 2.1.4 | S3 bucket access logging enabled | Storage |
| CIS 2.2.1 | EBS volumes encrypted | Storage |
| CIS 2.3.1 | RDS encryption at rest (`storage_encrypted = true`) | Storage |
| CIS 2.3.2 | RDS auto minor version upgrade enabled | Storage |
| CIS 3.1 | CloudTrail enabled in all regions | Logging |
| CIS 5.2 | No security groups allow 0.0.0.0/0 on port 22 or 3389 | Networking |
| CIS 5.3 | VPC flow logging enabled | Networking |
| CIS 5.4 | Default security group restricts all traffic | Networking |

### PDF export

The **Download Report** button generates a PDF containing all analysis sections in order: risk level, resource counts, warnings, resource changes table, cost breakdown, vulnerability findings, module analysis, CIS compliance table, Kubernetes deep analysis, savings plan recommendations, and a final disclaimer. Severity and status cells are color-coded throughout.

---

## Tech stack

- **[Next.js 16](https://nextjs.org/)** — App Router, React Server Components, API routes
- **[TypeScript](https://www.typescriptlang.org/)** — end-to-end type safety, shared types between API and UI
- **[Tailwind CSS](https://tailwindcss.com/)** — utility-first styling, dark theme
- **[@anthropic-ai/sdk](https://github.com/anthropic-ai/sdk-python)** — official Anthropic SDK for Node.js
- **[jsPDF](https://github.com/parallax/jsPDF) + [jspdf-autotable](https://github.com/simonbengtsson/jsPDF-AutoTable)** — client-side PDF generation
- **claude-sonnet-4-6** — the model used for plan analysis

---

## Project structure

```
tf-plan-explainer/
├── app/
│   ├── layout.tsx                  # Root layout: metadata, dark background
│   ├── globals.css                 # Tailwind directives
│   ├── page.tsx                    # Main page: state management, input + results
│   └── api/
│       └── explain/
│           └── route.ts            # POST /api/explain → four parallel Claude calls → merged JSON
├── components/
│   ├── PlanInput.tsx               # Textarea, character counter, submit button, Ctrl+Enter shortcut
│   ├── RiskSummary.tsx             # Risk badge, counts grid, warnings, per-resource change list
│   ├── VulnerabilityReport.tsx     # CVE findings with severity badges and collapsible HCL snippets
│   ├── KubernetesReport.tsx        # K8s security findings with dual severity+check-type badges
│   ├── ModuleReport.tsx            # Module version pin status and update recommendations
│   ├── ComplianceReport.tsx        # CIS AWS Foundations Benchmark findings with PASS/FAIL/N/A badges
│   ├── CostEstimate.tsx            # Provider badge, monthly/yearly totals, per-resource cost table
│   ├── SavingsPlanReport.tsx       # Reserved-pricing comparison table with savings % badges
│   └── DownloadReportButton.tsx    # Triggers client-side PDF generation
├── lib/
│   └── generatePdfReport.ts        # Full PDF report: all 12 sections, autoTable, color-coded cells
├── types/
│   └── analysis.ts                 # Shared TypeScript types (PlanAnalysis and all sub-interfaces)
├── .env.local.example              # Environment variable template
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

---

## How it works

### 1. User pastes a plan (`app/page.tsx`)

The main page is a client component that holds three pieces of state: the raw plan text, the parsed analysis result, and loading/error status. On submit it POSTs `{ plan: string }` to `/api/explain`.

### 2. API route runs four parallel Claude calls (`app/api/explain/route.ts`)

The route handler:
1. Parses the request body and rejects anything missing or over **200,000 characters**
2. Fires **four Claude requests simultaneously** using `Promise.all`:
   - **Core call** (8 192 tokens) — risk level, summary, counts, changes, warnings, cost estimate, module analysis
   - **Security call** (8 192 tokens) — vulnerability context, CIS compliance (11 controls)
   - **Kubernetes call** (4 096 tokens) — Kubernetes/Helm/EKS security findings
   - **Savings call** (4 096 tokens) — reserved-instance pricing comparison
3. Strips any markdown fences Claude may emit, parses all four responses as JSON, and merges them into a single `PlanAnalysis` object
4. Returns the merged result, or a structured error

Running all calls in parallel means total latency equals the slowest single call — not their sum.

### 3. Claude analyzes the plan

**Core prompt** instructs Claude to:
- Identify every resource change and classify its action (`create`, `update`, `destroy`, `replace`)
- Determine the risk level and write a plain-English summary
- Populate the warnings array with anything that could cause data loss, downtime, or security exposure, including HCL remediation snippets where a concrete fix exists
- Estimate monthly USD costs for each resource being created or replaced
- Detect and evaluate all module blocks for version pinning and currency

**Security prompt** instructs Claude to:
- Scan every resource with an explicit version attribute for known CVEs
- Evaluate all 11 CIS AWS Foundations Benchmark v1.4 controls and return PASS / FAIL / NOT_APPLICABLE for each, with HCL remediation snippets for failures

**Kubernetes prompt** instructs Claude to:
- Scan all Kubernetes, Helm, and managed-cluster resource types
- Detect deprecated API versions, insecure pod security contexts, missing network policies, dangerous RBAC bindings, and risky Helm options
- Include `remediationSnippet` for every finding where a concrete HCL change resolves the issue

**Savings prompt** instructs Claude to:
- Identify all eligible resources being created or replaced
- Apply provider-specific no-upfront reserved discount rates to compute 1-year and 3-year monthly costs
- Return per-resource and aggregate savings deltas and percentages

All prompts instruct Claude to return **only raw JSON** — no markdown, no code fences, no prose. The API route additionally strips any stray markdown fences before parsing, as a defensive fallback.

### 4. UI renders the result

Results are rendered in order below the input:

1. **`RiskSummary`** — risk badge, count cards, warnings box, per-resource change list
2. **`VulnerabilityReport`** — CVE findings grouped by severity, each with a collapsible `▼ Remediation` HCL block
3. **`KubernetesReport`** — K8s/Helm findings with dual severity + check-type badges, severity summary pills, and collapsible `▼ Remediation` HCL blocks
4. **`ComplianceReport`** — CIS findings with PASS / FAIL / N/A badges, summary pill counts, affected resources, and collapsible `▼ Remediation` HCL blocks for failures
5. **`ModuleReport`** — module findings with UNPINNED / OUTDATED / OK badges and version comparison
6. **`CostEstimate`** — provider badge, monthly/yearly totals, per-resource cost breakdown table
7. **`SavingsPlanReport`** — on-demand vs. 1yr/3yr reserved summary cards, per-resource comparison table with color-scaled savings % badges

---

## Getting started

### Prerequisites

- **Node.js 18+** — install via [nvm](https://github.com/nvm-sh/nvm) or [nodejs.org](https://nodejs.org)
- An **Anthropic API key** — get one at [console.anthropic.com](https://console.anthropic.com)

### 1. Clone the repo

```bash
git clone https://github.com/your-username/tf-plan-explainer.git
cd tf-plan-explainer
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure your API key

```bash
cp .env.local.example .env.local
```

Open `.env.local` and replace the placeholder with your real key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

> `.env.local` is git-ignored and never committed. Never put your key in `.env.local.example` or anywhere else that gets checked in.

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Try it out

Paste the output of any `terraform plan` run into the textarea and click **Analyze Plan** (or press `Ctrl+Enter`).

For a minimal `HIGH` risk result:

```
Terraform used the selected providers to generate the following execution plan.

  # aws_instance.web will be destroyed
  - resource "aws_instance" "web" {
      - ami           = "ami-0c55b159cbfafe1f0" -> null
      - instance_type = "t2.micro" -> null
    }

  # aws_s3_bucket.assets will be created
  + resource "aws_s3_bucket" "assets" {
      + bucket = "my-app-assets"
    }

Plan: 1 to add, 0 to change, 1 to destroy.
```

For a comprehensive test that exercises all analysis sections, use a plan that includes: an EKS cluster with an old `kubernetes_version`, a `kubernetes_deployment` with `privileged = true`, a `helm_release` with `force_update = true`, a `kubernetes_namespace` without a network policy, a `kubernetes_cluster_role_binding` with `cluster-admin` for a non-system subject, an RDS instance with `storage_encrypted = false` and an old `engine_version`, a security group with `0.0.0.0/0` on port 22, an S3 bucket without encryption or versioning, an EBS volume with `encrypted = false`, a CloudTrail with `is_multi_region_trail = false`, an `aws_iam_user_policy`, an `aws_vpc` without a flow log, EC2 and RDS instances being created (for savings recommendations), and module blocks with outdated or unpinned versions.

---

## Available scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server at http://localhost:3000 |
| `npm run build` | Build for production |
| `npm run start` | Run the production build |
| `npm run lint` | Run ESLint |

---

## Shared types

`types/analysis.ts` defines the contract between the API route and all UI components. Both import from this file directly, so any shape change is caught at compile time.

Key types:

```ts
export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type CloudProvider = 'AWS' | 'Azure' | 'GCP' | 'Unknown';
export type VulnerabilitySeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
export type CISStatus = 'PASS' | 'FAIL' | 'NOT_APPLICABLE';
export type KubernetesSeverity = 'HIGH' | 'MEDIUM' | 'LOW';
export type KubernetesCheckType = 'DEPRECATED_API' | 'POD_SECURITY' | 'NETWORK_POLICY' | 'RBAC' | 'HELM_CONFIG';

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
```

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key. Never commit this value. |

---

## Security notes

- The API key is read server-side only (Next.js API route). It is never exposed to the browser.
- Plan text is validated server-side for type and length (max 200,000 characters) before being forwarded to Claude.
- No plan data is stored — every request is stateless.
- Claude's raw response is never forwarded to the client; only the parsed and validated `PlanAnalysis` JSON is returned.
