import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAgentExecutionPrompt, getLatestAssistantReply } from './gateway';

test('buildAgentExecutionPrompt includes run and agent context', () => {
  const prompt = buildAgentExecutionPrompt({
    teamName: 'Acme team',
    desiredOutcome: 'Ship faster',
    reason: 'scheduled',
    runObjective: 'Prepare the next actions',
    runtimeControlUrl: 'https://e2b.example.com/live',
    workspaceBriefPath: '/home/user/Desktop/openclaw-team-brief.html',
    teamRoster: [
      {
        name: 'Operations supervisor',
        role: 'SUPERVISOR',
        sessionKey: 'agent:main:supervisor'
      }
    ],
    agentName: 'Supervisor',
    agentRole: 'SUPERVISOR',
    agentGoal: 'Coordinate the team',
    systemPrompt: 'Act as the supervisor'
  });

  assert.match(prompt, /Team: Acme team/);
  assert.match(prompt, /Run reason: scheduled/);
  assert.match(prompt, /Agent: Supervisor/);
  assert.match(prompt, /Runtime live view: https:\/\/e2b\.example\.com\/live/);
  assert.match(prompt, /Team roster: Operations supervisor/);
  assert.match(prompt, /Reply with the concrete next actions/);
});

test('getLatestAssistantReply returns the newest assistant response', () => {
  const reply = getLatestAssistantReply([
    {
      id: '1',
      role: 'assistant',
      content: 'First answer'
    },
    {
      id: '2',
      role: 'user',
      content: 'Thanks'
    },
    {
      id: '3',
      role: 'assistant',
      content: 'Latest answer'
    }
  ]);

  assert.equal(reply, 'Latest answer');
});
