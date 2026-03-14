import { AgentRole, AgentTeamTemplate } from '@workspace/database';

export type AgentAutonomyLevel =
  | 'supervised'
  | 'guarded-autonomous'
  | 'autonomous';

export type AgentBlueprint = {
  name: string;
  role: AgentRole;
  goal: string;
  systemPrompt: string;
};

export type AgentTeamSpec = {
  mission: string;
  operatingDomains: string[];
  autonomyLevel: AgentAutonomyLevel;
  telegramEnabled: boolean;
  browserEnabled: boolean;
  accountTargets: string[];
  allowedDomains: string[];
  operatorInstructions?: string;
  requestedRoles: string[];
};

export type AgentTeamBlueprint = {
  template: AgentTeamTemplate;
  name: string;
  description: string;
  desiredOutcome: string;
  cadenceCron: string;
  approvalPolicy: {
    requireApprovalForPublish: boolean;
    requireApprovalForCredentialChanges: boolean;
    requireApprovalForSpendAboveUsd: number;
    requireApprovalForFirstTimeLogins: boolean;
  };
  skillPack: {
    managedSkills: string[];
    memoryStrategy: 'rolling-summary' | 'event-sourced';
  };
  promptPack: {
    supervisor: string;
    operators: string[];
  };
  supervisorConfig: {
    provider: 'openai-computer';
    model: 'gpt-5.4';
    keepAlive: boolean;
    maxTurnsPerTick: number;
    browserEnabled: boolean;
    telegramControlEnabled: boolean;
    allowedDomains: string[];
  };
  teamSpec: AgentTeamSpec;
  agents: AgentBlueprint[];
};

export type PlanAgentTeamInput = {
  organizationName: string;
  name: string;
  template?: AgentTeamTemplate;
  description?: string;
  desiredOutcome?: string;
  mission?: string;
  cadenceCron?: string;
  autonomyLevel?: AgentAutonomyLevel;
  operatingDomains?: string[];
  requestedRoles?: string[];
  telegramEnabled?: boolean;
  browserEnabled?: boolean;
  accountTargets?: string[];
  allowedDomains?: string[];
  operatorInstructions?: string;
};

function slugSegment(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function createTeamSlug(name: string): string {
  const candidate = slugSegment(name);
  return candidate.length > 0 ? candidate : 'agent-team';
}

function inferTemplate(input: PlanAgentTeamInput): AgentTeamTemplate {
  if (input.template) {
    return input.template;
  }

  const haystack = [
    input.name,
    input.description,
    input.desiredOutcome,
    input.mission,
    ...(input.operatingDomains ?? []),
    ...(input.requestedRoles ?? [])
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return /tiktok|ugc|short-form|creator|campaign/.test(haystack)
    ? AgentTeamTemplate.TIKTOK_MARKETING
    : AgentTeamTemplate.GENERIC_OPERATIONS;
}

function toSentence(input: string | undefined, fallback: string): string {
  const normalized = input?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

function buildApprovalPolicy(
  autonomyLevel: AgentAutonomyLevel,
  template: AgentTeamTemplate
) {
  const spendThreshold =
    template === AgentTeamTemplate.TIKTOK_MARKETING ? 50 : 100;

  if (autonomyLevel === 'autonomous') {
    return {
      requireApprovalForPublish: true,
      requireApprovalForCredentialChanges: true,
      requireApprovalForSpendAboveUsd: spendThreshold,
      requireApprovalForFirstTimeLogins: true
    };
  }

  if (autonomyLevel === 'guarded-autonomous') {
    return {
      requireApprovalForPublish: true,
      requireApprovalForCredentialChanges: true,
      requireApprovalForSpendAboveUsd: spendThreshold / 2,
      requireApprovalForFirstTimeLogins: true
    };
  }

  return {
    requireApprovalForPublish: true,
    requireApprovalForCredentialChanges: true,
    requireApprovalForSpendAboveUsd: 0,
    requireApprovalForFirstTimeLogins: true
  };
}

function titleCase(input: string): string {
  return input
    .split(/[\s_-]+/)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
    .join(' ');
}

function inferRoleFromHint(hint: string): AgentRole {
  const normalized = hint.toLowerCase();

  if (normalized.includes('supervisor') || normalized.includes('manager')) {
    return AgentRole.SUPERVISOR;
  }
  if (
    normalized.includes('research') ||
    normalized.includes('analyst') ||
    normalized.includes('intel')
  ) {
    return AgentRole.RESEARCHER;
  }
  if (
    normalized.includes('publish') ||
    normalized.includes('distribution') ||
    normalized.includes('post')
  ) {
    return AgentRole.PUBLISHER;
  }
  if (
    normalized.includes('review') ||
    normalized.includes('qa') ||
    normalized.includes('compliance') ||
    normalized.includes('approve')
  ) {
    return AgentRole.REVIEWER;
  }

  return AgentRole.CREATOR;
}

function getRoleDefaults(role: AgentRole, domainLabel: string): AgentBlueprint {
  switch (role) {
    case AgentRole.SUPERVISOR:
      return {
        name: `${domainLabel} supervisor`,
        role,
        goal:
          'Coordinate the full workflow, keep specialist agents aligned, and escalate only when policy requires it.',
        systemPrompt:
          'You are the supervising operator. Keep a tight running plan, route work to the correct specialist, and preserve a clean audit trail.'
      };
    case AgentRole.RESEARCHER:
      return {
        name: `${domainLabel} researcher`,
        role,
        goal:
          'Gather the latest context, summarize tradeoffs, and produce concise findings that unblock the rest of the team.',
        systemPrompt:
          'Research thoroughly, ground claims in evidence, and return concise, reusable notes for future runs.'
      };
    case AgentRole.REVIEWER:
      return {
        name: `${domainLabel} reviewer`,
        role,
        goal:
          'Review outputs for quality, safety, and policy fit before downstream actions are taken.',
        systemPrompt:
          'Review critically, call out hidden risks, and prefer explicit escalation over ambiguous autonomous actions.'
      };
    case AgentRole.PUBLISHER:
      return {
        name: `${domainLabel} publisher`,
        role,
        goal:
          'Ship approved outputs through official APIs first and use browser automation only for unsupported last-mile work.',
        systemPrompt:
          'Prefer API-first execution, maintain precise action logs, and respect approval boundaries.'
      };
    default:
      return {
        name: `${domainLabel} operator`,
        role,
        goal:
          'Turn plans into concrete deliverables the rest of the team can review, publish, or reuse.',
        systemPrompt:
          'Produce concise, execution-ready deliverables and make your assumptions explicit.'
      };
  }
}

function buildAgents(input: {
  template: AgentTeamTemplate;
  requestedRoles: string[];
  operatingDomains: string[];
}): AgentBlueprint[] {
  const domainLabel =
    input.template === AgentTeamTemplate.TIKTOK_MARKETING
      ? 'Campaign'
      : input.operatingDomains[0]
        ? titleCase(input.operatingDomains[0])
        : 'Operations';

  const inferredAgents = input.requestedRoles.map((hint) => {
    const role = inferRoleFromHint(hint);
    const defaults = getRoleDefaults(role, domainLabel);

    return {
      ...defaults,
      name:
        hint.length > 0 && hint.length <= 120
          ? titleCase(hint)
          : defaults.name
    };
  });

  const seedAgents =
    inferredAgents.length > 0
      ? inferredAgents
      : input.template === AgentTeamTemplate.TIKTOK_MARKETING
        ? [
            getRoleDefaults(AgentRole.SUPERVISOR, 'Campaign'),
            {
              ...getRoleDefaults(AgentRole.RESEARCHER, 'Trend'),
              name: 'Trend researcher'
            },
            {
              ...getRoleDefaults(AgentRole.CREATOR, 'Creative'),
              name: 'Creative producer'
            },
            {
              ...getRoleDefaults(AgentRole.REVIEWER, 'Compliance'),
              name: 'Compliance reviewer'
            },
            {
              ...getRoleDefaults(AgentRole.PUBLISHER, 'Channel'),
              name: 'Channel publisher'
            }
          ]
        : [
            getRoleDefaults(AgentRole.SUPERVISOR, domainLabel),
            getRoleDefaults(AgentRole.RESEARCHER, domainLabel),
            getRoleDefaults(AgentRole.CREATOR, domainLabel),
            getRoleDefaults(AgentRole.REVIEWER, domainLabel)
          ];

  const seenRoles = new Set(seedAgents.map((agent) => agent.role));
  if (!seenRoles.has(AgentRole.SUPERVISOR)) {
    seedAgents.unshift(getRoleDefaults(AgentRole.SUPERVISOR, domainLabel));
  }
  if (!seenRoles.has(AgentRole.REVIEWER)) {
    seedAgents.push(getRoleDefaults(AgentRole.REVIEWER, domainLabel));
  }

  return seedAgents;
}

function buildManagedSkills(spec: AgentTeamSpec, template: AgentTeamTemplate) {
  const domainSkills = spec.operatingDomains.flatMap((domain) => {
    const slug = slugSegment(domain).replace(/-/g, '_');
    return slug.length > 0
      ? [`monitor_${slug}`, `summarize_${slug}`, `improve_${slug}`]
      : [];
  });

  const baseSkills =
    template === AgentTeamTemplate.TIKTOK_MARKETING
      ? [
          'research-trending-topics',
          'generate-short-form-script',
          'review-publish-readiness',
          'publish-short-form-content'
        ]
      : [
          'triage-incoming-work',
          'capture-memory-updates',
          'prepare-operator-summary',
          'escalate-for-approval'
        ];

  return [...new Set([...baseSkills, ...domainSkills])];
}

export function planAgentTeamBlueprint(
  input: PlanAgentTeamInput
): AgentTeamBlueprint {
  const organizationName = input.organizationName.trim() || 'Your organization';
  const template = inferTemplate(input);
  const operatingDomains = [...new Set(input.operatingDomains ?? [])];
  const requestedRoles = [...new Set(input.requestedRoles ?? [])];
  const autonomyLevel = input.autonomyLevel ?? 'guarded-autonomous';
  const teamSpec: AgentTeamSpec = {
    mission: toSentence(
      input.mission,
      'Operate continuously, coordinate specialist agents, and make progress toward the desired outcome.'
    ),
    operatingDomains,
    autonomyLevel,
    telegramEnabled: input.telegramEnabled ?? true,
    browserEnabled: input.browserEnabled ?? true,
    accountTargets: [...new Set(input.accountTargets ?? [])],
    allowedDomains: [...new Set(input.allowedDomains ?? [])],
    operatorInstructions: input.operatorInstructions?.trim() || undefined,
    requestedRoles
  };

  const desiredOutcome = toSentence(
    input.desiredOutcome,
    template === AgentTeamTemplate.TIKTOK_MARKETING
      ? 'Grow the content operation with repeatable campaign experiments, stronger creative iteration, and approval-safe publishing.'
      : 'Keep the operation moving continuously with strong memory, specialist coordination, and explicit approval gates for risky actions.'
  );

  const description = toSentence(
    input.description,
    template === AgentTeamTemplate.TIKTOK_MARKETING
      ? 'A 24/7 campaign team that researches, creates, reviews, and publishes through OpenClaw specialists managed by an OpenAI computer-use supervisor.'
      : 'A 24/7 operations team that plans, researches, executes, reviews, and escalates work through OpenClaw specialists managed by an OpenAI computer-use supervisor.'
  );

  const cadenceCron =
    input.cadenceCron?.trim() ||
    (template === AgentTeamTemplate.TIKTOK_MARKETING
      ? '0 */6 * * *'
      : '0 */4 * * *');
  const agents = buildAgents({
    template,
    requestedRoles,
    operatingDomains
  });
  const domainSummary =
    operatingDomains.length > 0
      ? operatingDomains.join(', ')
      : template === AgentTeamTemplate.TIKTOK_MARKETING
        ? 'TikTok campaign operations'
        : 'general operations';

  return {
    template,
    name: input.name.trim() || `${organizationName} agent team`,
    description,
    desiredOutcome,
    cadenceCron,
    approvalPolicy: buildApprovalPolicy(autonomyLevel, template),
    skillPack: {
      managedSkills: buildManagedSkills(teamSpec, template),
      memoryStrategy: 'rolling-summary'
    },
    promptPack: {
      supervisor: [
        'You are the always-on supervisor for this agent team.',
        `Mission: ${teamSpec.mission}`,
        `Desired outcome: ${desiredOutcome}`,
        `Operating domains: ${domainSummary}`,
        `Autonomy level: ${teamSpec.autonomyLevel}`,
        `Telegram control enabled: ${teamSpec.telegramEnabled ? 'yes' : 'no'}`,
        `Browser automation enabled: ${teamSpec.browserEnabled ? 'yes' : 'no'}`,
        teamSpec.allowedDomains.length > 0
          ? `Allowed domains: ${teamSpec.allowedDomains.join(', ')}`
          : 'Allowed domains: follow organization policy and avoid leaving the task domain.',
        'Coordinate the OpenClaw specialist sessions, use API-first actions when available, and use E2B desktop automation for the last mile.',
        teamSpec.operatorInstructions
          ? `Operator instructions: ${teamSpec.operatorInstructions}`
          : 'Operator instructions: maintain clean transcripts, update memory aggressively, and ask for approval only at the point of risk.'
      ].join('\n'),
      operators: [
        'Stay tightly aligned with the team mission and return concrete updates the supervisor can act on.',
        'Persist durable notes, blockers, and reusable learnings so future runs can resume without losing context.'
      ]
    },
    supervisorConfig: {
      provider: 'openai-computer',
      model: 'gpt-5.4',
      keepAlive: true,
      maxTurnsPerTick: autonomyLevel === 'supervised' ? 4 : 8,
      browserEnabled: teamSpec.browserEnabled,
      telegramControlEnabled: teamSpec.telegramEnabled,
      allowedDomains: teamSpec.allowedDomains
    },
    teamSpec,
    agents
  };
}

export function createTikTokMarketingBlueprint(
  organizationName: string
): AgentTeamBlueprint {
  return planAgentTeamBlueprint({
    organizationName,
    name: `${organizationName.trim() || 'Your brand'} TikTok team`,
    template: AgentTeamTemplate.TIKTOK_MARKETING,
    mission:
      'Run a continuous short-form content operation that researches trends, creates campaign assets, reviews risk, and publishes safely.',
    operatingDomains: ['tiktok', 'short-form video', 'campaign ops'],
    requestedRoles: [
      'campaign supervisor',
      'trend researcher',
      'creative producer',
      'compliance reviewer',
      'channel publisher'
    ],
    autonomyLevel: 'guarded-autonomous',
    telegramEnabled: true,
    browserEnabled: true,
    cadenceCron: '0 */6 * * *'
  });
}

export function createGenericOperationsBlueprint(
  organizationName: string
): AgentTeamBlueprint {
  return planAgentTeamBlueprint({
    organizationName,
    name: `${organizationName.trim() || 'Your organization'} ops team`,
    template: AgentTeamTemplate.GENERIC_OPERATIONS,
    mission:
      'Operate continuously across recurring operational workflows, maintain memory, and escalate only when policy or ambiguity requires it.',
    operatingDomains: ['operations'],
    requestedRoles: [
      'operations supervisor',
      'operations researcher',
      'operations creator',
      'operations reviewer'
    ],
    autonomyLevel: 'guarded-autonomous',
    telegramEnabled: true,
    browserEnabled: true,
    cadenceCron: '0 */4 * * *'
  });
}
