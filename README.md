# Terraform Plan Explainer

A web app that translates raw `terraform plan` output into a plain-English risk summary and cloud cost estimate, powered by Claude. Paste your plan, get back a risk level, a per-resource breakdown, explicit warnings about anything destructive, and an estimated monthly/yearly cost — in seconds.

---

## Why this exists

`terraform plan` output is precise, but it's not designed for quick human review. A busy engineer staring at 200 lines of diff symbols (`+`, `~`, `-`) before a production deploy can easily miss a `-/+` replace action that will cause 30 seconds of downtime, or a `-` destroy on a database that was never meant to be deleted.

This tool acts as a second set of eyes. It sends your plan to Claude with a structured prompt that forces a consistent risk analysis and returns a JSON payload your UI can render in a clear, scannable format. The goal is not to replace careful review — it's to surface the things that most need careful review, immediately.

---

## What it produces

For every plan you submit, the app returns:

| Output | Description |
|---|---|
| **Risk badge** | `HIGH` / `MEDIUM` / `LOW` with color coding |
| **Plain-English summary** | 2–3 sentences describing what the plan does overall |
| **Resource counts** | How many resources are being added, changed, and destroyed |
| **Warnings box** | Explicit callouts for destroys, replacements, data loss, or security changes |
| **Per-resource breakdown** | Every changed resource listed with its action type and a one-sentence explanation |
| **Cost estimate** | Monthly and yearly USD cost totals, per-resource breakdown with pricing assumptions, confidence level, and provider detection (AWS / Azure / GCP) |

### Risk level logic

| Level | Trigger |
|---|---|
| `HIGH` | Any resource is being **destroyed** or **replaced** (destroy + recreate) |
| `MEDIUM` | Updates to critical infrastructure: databases, load balancers, security groups, IAM roles, or networking resources |
| `LOW` | Only creates, or updates to non-critical resources |

### Cost estimate confidence logic

Confidence reflects how certain Claude is about the cost figures, not the risk of the plan itself.

| Level | Meaning |
|---|---|
| `HIGH` | All resources in the plan have well-known, stable list pricing (e.g. standard EC2 instance types, RDS instances, S3 buckets) and no unusual configuration that would make pricing ambiguous |
| `MEDIUM` | At least some resources required assumptions — for example, an instance type was not specified, a managed service has usage-based pricing that varies by workload, or a resource spans multiple tiers |
| `LOW` | Many resources have uncertain or highly variable pricing, the plan contains resource types with little publicly documented pricing, or the configuration is too sparse to make a reliable estimate |

Costs are only estimated for resources being **created** or **replaced**. Resources being **destroyed** or that are inherently free (IAM roles, security groups, VPCs, route tables, etc.) are listed with a cost of `$0.00`. All figures assume on-demand pricing in a standard region (e.g. `us-east-1`) unless the plan specifies otherwise.

---

## Tech stack

- **[Next.js 16](https://nextjs.org/)** — App Router, React Server Components, API routes
- **[TypeScript](https://www.typescriptlang.org/)** — end-to-end type safety, shared types between API and UI
- **[Tailwind CSS](https://tailwindcss.com/)** — utility-first styling, dark theme
- **[@anthropic-ai/sdk](https://github.com/anthropic-ai/sdk-python)** — official Anthropic SDK for Node.js
- **Claude claude-sonnet-4-6** — the model used for plan analysis

---

## Project structure

```
tf-plan-explainer/
├── app/
│   ├── layout.tsx              # Root layout: metadata, dark background
│   ├── globals.css             # Tailwind directives
│   ├── page.tsx                # Main page: state management, input + results
│   └── api/
│       └── explain/
│           └── route.ts        # POST /api/explain → validates input → calls Claude → returns JSON
├── components/
│   ├── PlanInput.tsx           # Textarea, character counter, submit button, Ctrl+Enter shortcut
│   ├── RiskSummary.tsx         # Risk badge, counts grid, warnings box, per-resource change list
│   └── CostEstimate.tsx        # Provider badge, monthly/yearly totals, per-resource cost breakdown
├── types/
│   └── analysis.ts             # Shared TypeScript types (PlanAnalysis, CostEstimate, ResourceCost, ...)
├── .env.local.example          # Environment variable template
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

---

## How it works

### 1. User pastes a plan (`app/page.tsx`)

The main page is a client component that holds three pieces of state: the raw plan text, the parsed analysis result, and loading/error status. On submit it POSTs `{ plan: string }` to `/api/explain`.

### 2. API route validates and forwards to Claude (`app/api/explain/route.ts`)

The route handler:
1. Parses the request body and rejects anything missing or over 100,000 characters
2. Sends the plan to Claude claude-sonnet-4-6 with a tightly scoped system prompt
3. Parses Claude's response as JSON
4. Returns the `PlanAnalysis` object, or a structured error

### 3. Claude analyzes the plan

The system prompt instructs Claude to:
- Identify every resource change and classify its action (`create`, `update`, `destroy`, `replace`)
- Count resources by action type
- Determine the risk level using the rules above
- Write a 2–3 sentence plain-English overview
- Write a one-sentence explanation for each changed resource
- Populate the warnings array with anything that could cause data loss, downtime, or security exposure
- Estimate monthly USD costs for each resource being created or replaced, and return a `costEstimate` block alongside the risk analysis

Claude is explicitly told to return **only raw JSON** — no markdown, no code fences, no prose — so the response can be fed directly into `JSON.parse()`.

### 4. UI renders the result

**`components/RiskSummary.tsx`** renders the risk analysis:
- A color-coded risk badge (red / yellow / green)
- Three count cards (added / changed / destroyed)
- A red warning box if any warnings were generated
- A row per resource change, with an action icon (`+` / `~` / `-` / `±`), the resource name, the plain-English description, and a "destructive" tag where applicable

**`components/CostEstimate.tsx`** renders the cost estimate below the risk summary:
- A color-coded provider badge (orange = AWS, blue = Azure, red = GCP, gray = Unknown) with a confidence pill (HIGH / MEDIUM / LOW)
- Two large cards showing the monthly and yearly USD totals
- A breakdown table with one row per resource: name, type, estimated monthly cost, and the pricing assumptions used
- A disclaimer noting that estimates are approximate

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

If you don't have a real plan handy, you can use this minimal example to verify a `HIGH` risk result:

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

`types/analysis.ts` defines the contract between the API route and the UI components. Both import from this file directly, so any shape change is caught at compile time.

```ts
export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type CloudProvider = 'AWS' | 'Azure' | 'GCP' | 'Unknown';

export interface ResourceChange {
  resource: string;       // e.g. "aws_instance.web"
  action: 'create' | 'update' | 'destroy' | 'replace';
  description: string;   // plain-English explanation
  isDestructive: boolean;
}

export interface ResourceCost {
  resource: string;      // e.g. "aws_instance.web_server"
  type: string;          // e.g. "aws_instance"
  monthlyCost: number;   // USD; 0 if free or being destroyed
  assumptions: string;   // e.g. "t3.medium, on-demand, us-east-1, 730 hrs/month"
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
```

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key. Never commit this value. |

---

## Security notes

- The API key is read server-side only (Next.js API route). It is never exposed to the browser.
- Plan text is validated server-side for type and length before being forwarded to Claude.
- No plan data is stored — every request is stateless.
