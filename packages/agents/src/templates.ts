import { AgentRole, AgentTeamTemplate } from '@workspace/database';

export type AgentBlueprint = {
  name: string;
  role: AgentRole;
  goal: string;
  systemPrompt: string;
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
  agents: AgentBlueprint[];
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

export function createTikTokMarketingBlueprint(
  organizationName: string
): AgentTeamBlueprint {
  const brandName = organizationName.trim() || 'Your brand';

  return {
    template: AgentTeamTemplate.TIKTOK_MARKETING,
    name: `${brandName} TikTok team`,
    description:
      'Plan, produce, review, and publish short-form TikTok campaigns with approval checkpoints.',
    desiredOutcome:
      'Grow the TikTok channel with repeatable content experiments, stronger creative iteration loops, and API-first publishing.',
    cadenceCron: '0 */6 * * *',
    approvalPolicy: {
      requireApprovalForPublish: true,
      requireApprovalForCredentialChanges: true,
      requireApprovalForSpendAboveUsd: 50,
      requireApprovalForFirstTimeLogins: true
    },
    skillPack: {
      managedSkills: [
        'research-trending-topics',
        'generate-short-form-script',
        'assemble-video-brief',
        'review-publish-readiness'
      ],
      memoryStrategy: 'rolling-summary'
    },
    promptPack: {
      supervisor:
        'You supervise the full TikTok funnel. Use APIs first, ask for approval when required, and only use browser automation for unsupported last-mile steps.',
      operators: [
        'Research what is performing now for the brand and save reusable insights to memory.',
        'Produce scripts, hooks, caption options, and publishing recommendations tailored to the current campaign.'
      ]
    },
    agents: [
      {
        name: 'Campaign supervisor',
        role: AgentRole.SUPERVISOR,
        goal:
          'Coordinate the full workflow, keep operators aligned, and escalate for human approval only when policy requires it.',
        systemPrompt:
          'Act as the supervising operator. Maintain goals, check outputs, and keep the team shipping consistently.'
      },
      {
        name: 'Trend researcher',
        role: AgentRole.RESEARCHER,
        goal:
          'Discover timely trends, competitor patterns, and audience hooks that can improve the next TikTok campaign.',
        systemPrompt:
          'Synthesize research into concise, reusable learnings with clear evidence and confidence levels.'
      },
      {
        name: 'Creative producer',
        role: AgentRole.CREATOR,
        goal:
          'Turn research into scripts, shot lists, captions, and asset briefs that a downstream publishing flow can execute.',
        systemPrompt:
          'Produce creator-ready deliverables optimized for short-form performance and experimentation.'
      },
      {
        name: 'Compliance reviewer',
        role: AgentRole.REVIEWER,
        goal:
          'Review drafts for brand fit, disclosure requirements, platform risks, and approval policy before anything is published.',
        systemPrompt:
          'Review outputs critically and prefer explicit approval requests over unsafe autonomous actions.'
      },
      {
        name: 'Channel publisher',
        role: AgentRole.PUBLISHER,
        goal:
          'Publish final artifacts through official APIs when available, or last-mile browser automation when necessary.',
        systemPrompt:
          'Prefer API-first publishing and keep a complete log of what was uploaded, where, and under which approval.'
      }
    ]
  };
}

export function createGenericOperationsBlueprint(
  organizationName: string
): AgentTeamBlueprint {
  const brandName = organizationName.trim() || 'Your organization';

  return {
    template: AgentTeamTemplate.GENERIC_OPERATIONS,
    name: `${brandName} ops team`,
    description:
      'A flexible supervisor-led team for recurring operations, research, and approvals.',
    desiredOutcome:
      'Keep operational work moving with clear supervision, durable memory, and explicit approval gates for risky actions.',
    cadenceCron: '0 */12 * * *',
    approvalPolicy: {
      requireApprovalForPublish: true,
      requireApprovalForCredentialChanges: true,
      requireApprovalForSpendAboveUsd: 100,
      requireApprovalForFirstTimeLogins: true
    },
    skillPack: {
      managedSkills: [
        'triage-incoming-work',
        'summarize-progress',
        'escalate-for-approval'
      ],
      memoryStrategy: 'rolling-summary'
    },
    promptPack: {
      supervisor:
        'Coordinate the team, keep work items moving, and escalate for approval when policies require it.',
      operators: [
        'Break work into clear next actions with strong written context.',
        'Record what worked, what failed, and what the next run should change.'
      ]
    },
    agents: [
      {
        name: 'Operations supervisor',
        role: AgentRole.SUPERVISOR,
        goal:
          'Supervise the full workflow, route work to the right specialist, and maintain a reliable execution loop.',
        systemPrompt:
          'You are the supervising operator. Prefer reliable, auditable execution and clear escalation paths.'
      },
      {
        name: 'Operations researcher',
        role: AgentRole.RESEARCHER,
        goal:
          'Gather external context, summarize tradeoffs, and keep the team informed with grounded evidence.',
        systemPrompt:
          'Research thoroughly and produce concise, high-signal summaries that the supervisor can act on.'
      },
      {
        name: 'Operations reviewer',
        role: AgentRole.REVIEWER,
        goal:
          'Review outputs for quality, safety, and approval requirements before downstream actions are taken.',
        systemPrompt:
          'Challenge assumptions, check policy fit, and document what should be improved next.'
      }
    ]
  };
}
