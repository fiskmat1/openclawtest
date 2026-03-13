import { NextResponse, type NextRequest } from 'next/server';

import { AgentJobName, sendAgentJob } from '@workspace/agents';
import { keys as agentKeys } from '@workspace/agents/keys';

type RouteContext = {
  params: Promise<{
    provider: string;
  }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { provider } = await context.params;
  const webhookSecret = agentKeys().AGENTS_WEBHOOK_SECRET;
  const suppliedSecret = request.headers.get('x-agents-webhook-secret');

  if (webhookSecret && suppliedSecret !== webhookSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const searchOrganizationId = request.nextUrl.searchParams.get('organizationId');
  const searchTeamId = request.nextUrl.searchParams.get('teamId');
  const payload = isRecord(body) ? body : {};
  const organizationId =
    searchOrganizationId ??
    (typeof payload.organizationId === 'string' ? payload.organizationId : undefined);
  const teamId =
    searchTeamId ?? (typeof payload.teamId === 'string' ? payload.teamId : undefined);

  await sendAgentJob(AgentJobName.ProcessProviderWebhook, {
    provider,
    organizationId,
    teamId,
    payload
  });

  return NextResponse.json(
    {
      accepted: true
    },
    {
      status: 202
    }
  );
}
