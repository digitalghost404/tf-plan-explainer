# Terraform Plan Explainer

A web app that translates raw `terraform plan` output into a plain-English risk summary, cost estimate, vulnerability report, module analysis, and CIS compliance audit — powered by Claude. Paste your plan, get back a full security and operations briefing in seconds.

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

The **Download Report** button generates a PDF containing all analysis sections: risk level, resource counts, warnings, resource changes table, cost breakdown, vulnerability findings, module analysis, and the full CIS compliance table with color-coded PASS/FAIL/N/A cells.

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
│           └── route.ts            # POST /api/explain → two parallel Claude calls → merged JSON
├── components/
│   ├── PlanInput.tsx               # Textarea, character counter, submit button, Ctrl+Enter shortcut
│   ├── RiskSummary.tsx             # Risk badge, counts grid, warnings, per-resource change list
│   ├── VulnerabilityReport.tsx     # CVE findings with severity badges and collapsible HCL snippets
│   ├── ModuleReport.tsx            # Module version pin status and update recommendations
│   ├── ComplianceReport.tsx        # CIS AWS Foundations Benchmark findings with PASS/FAIL/N/A badges
│   ├── CostEstimate.tsx            # Provider badge, monthly/yearly totals, per-resource cost table
│   └── DownloadReportButton.tsx    # Triggers client-side PDF generation
├── lib/
│   └── generatePdfReport.ts        # Full PDF report: all sections, autoTable, color-coded cells
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

### 2. API route runs two parallel Claude calls (`app/api/explain/route.ts`)

The route handler:
1. Parses the request body and rejects anything missing or over **200,000 characters**
2. Fires **two Claude requests simultaneously** using `Promise.all`:
   - **Core call** — risk level, summary, counts, changes, warnings, cost estimate, module analysis
   - **Security call** — vulnerability context, CIS compliance (11 controls)
3. Parses both responses as JSON and merges them into a single `PlanAnalysis` object
4. Returns the merged result, or a structured error

Running the calls in parallel means total latency equals the slower of the two calls — not their sum. The security call (vulnerabilities + 11 CIS controls) is typically the bottleneck; splitting it from the core analysis roughly halves end-to-end response time.

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

Both prompts instruct Claude to return **only raw JSON** — no markdown, no code fences, no prose — so responses can be fed directly into `JSON.parse()`.

### 4. UI renders the result

Results are rendered in order below the input:

1. **`RiskSummary`** — risk badge, count cards, warnings box, per-resource change list
2. **`VulnerabilityReport`** — CVE findings grouped by severity, each with a collapsible `▼ Remediation` HCL block
3. **`ModuleReport`** — module findings with UNPINNED / OUTDATED / OK badges and version comparison
4. **`ComplianceReport`** — CIS findings with PASS / FAIL / N/A badges, summary pill counts, affected resources, and collapsible `▼ Remediation` HCL blocks for failures
5. **`CostEstimate`** — provider badge, monthly/yearly totals, per-resource cost breakdown table

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

For a comprehensive test that exercises all analysis sections (risk, cost, vulnerabilities, modules, and all 11 CIS controls), use a plan that includes: an RDS instance with `storage_encrypted = false` and an old `engine_version`, a security group with `0.0.0.0/0` on port 22, an S3 bucket without encryption/versioning/logging, an EBS volume with `encrypted = false`, a CloudTrail with `is_multi_region_trail = false`, an `aws_iam_user_policy_attachment`, an `aws_vpc` without a corresponding `aws_flow_log`, an `aws_default_security_group` with open rules, an EKS cluster with an old `kubernetes_version`, a Lambda with an EOL runtime, and module blocks with outdated or unpinned versions.

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
