import type { GatewayTranscriptEntry } from '@workspace/agents';

export function getLatestAssistantReply(
  entries: GatewayTranscriptEntry[]
): string | undefined {
  const latestAssistantEntry = [...entries]
    .reverse()
    .find(
      (entry) => entry.role === 'assistant' && entry.content.trim().length > 0
    );

  return latestAssistantEntry?.content.trim();
}

export function buildAgentExecutionPrompt(args: {
  teamName: string;
  desiredOutcome?: string | null;
  reason: string;
  runObjective?: string | null;
  agentName: string;
  agentRole: string;
  agentGoal?: string | null;
  systemPrompt?: string | null;
}): string {
  return [
    `Team: ${args.teamName}`,
    `Run reason: ${args.reason}`,
    `Desired outcome: ${args.desiredOutcome ?? 'No desired outcome provided.'}`,
    `Run objective: ${args.runObjective ?? 'No explicit run objective provided.'}`,
    `Agent: ${args.agentName}`,
    `Role: ${args.agentRole}`,
    `Goal: ${args.agentGoal ?? 'No explicit goal provided.'}`,
    `System prompt: ${args.systemPrompt ?? 'No explicit system prompt provided.'}`,
    'Reply with the concrete next actions you will take, the current status, and any blockers that need escalation.'
  ].join('\n');
}
