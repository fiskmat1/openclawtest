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
  runtimeControlUrl?: string | null;
  workspaceBriefPath?: string | null;
  teamRoster?: Array<{
    name: string;
    role: string;
    sessionKey?: string;
  }>;
}): string {
  const rosterLine =
    args.teamRoster && args.teamRoster.length > 0
      ? args.teamRoster
          .map(
            (member) =>
              `${member.name} (${member.role})${member.sessionKey ? ` [${member.sessionKey}]` : ''}`
          )
          .join('; ')
      : 'No team roster provided.';

  return [
    `Team: ${args.teamName}`,
    `Run reason: ${args.reason}`,
    `Desired outcome: ${args.desiredOutcome ?? 'No desired outcome provided.'}`,
    `Run objective: ${args.runObjective ?? 'No explicit run objective provided.'}`,
    `Runtime live view: ${args.runtimeControlUrl ?? 'Unavailable'}`,
    `Desktop briefing file: ${args.workspaceBriefPath ?? 'Unavailable'}`,
    `Team roster: ${rosterLine}`,
    `Agent: ${args.agentName}`,
    `Role: ${args.agentRole}`,
    `Goal: ${args.agentGoal ?? 'No explicit goal provided.'}`,
    `System prompt: ${args.systemPrompt ?? 'No explicit system prompt provided.'}`,
    args.agentRole === 'SUPERVISOR'
      ? 'You are the supervisor. Use the roster above to coordinate the other OpenClaw sessions, keep the team aligned with the desired outcome, and surface blockers clearly.'
      : 'Work as a specialist under the supervisor, stay tightly aligned with the desired outcome, and return concise updates the supervisor can act on.',
    'Reply with the concrete next actions you will take, the current status, and any blockers that need escalation.'
  ].join('\n');
}
