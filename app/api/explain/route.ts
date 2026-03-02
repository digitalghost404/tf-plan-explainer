import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { PlanAnalysis } from '@/types/analysis';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a Terraform plan risk analyst. When given Terraform plan output, analyze it and respond with ONLY valid JSON — no markdown, no explanation, no code fences.

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
  "warnings": ["string describing any data loss or service disruption risk"]
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

If the input is not a valid Terraform plan, set riskLevel to "LOW", summary to "No valid Terraform plan detected.", counts to all zeros, changes to [], and warnings to [].`;

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
      max_tokens: 4096,
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
      return NextResponse.json(
        { error: 'Claude returned invalid JSON', raw: content.text },
        { status: 500 }
      );
    }

    return NextResponse.json(analysis);
  } catch (err) {
    console.error('Claude API error:', err);
    return NextResponse.json({ error: 'Failed to contact Claude API' }, { status: 500 });
  }
}
