import assert from 'node:assert/strict';
import test from 'node:test';

import { AgentJobName, parseAgentJobPayload } from './queue';

test('parseAgentJobPayload accepts valid deploy payloads', () => {
  const payload = parseAgentJobPayload(AgentJobName.DeployTeam, {
    organizationId: '11111111-1111-4111-8111-111111111111',
    teamId: '22222222-2222-4222-8222-222222222222',
    deploymentId: '33333333-3333-4333-8333-333333333333',
    requestedByUserId: '44444444-4444-4444-8444-444444444444'
  });

  assert.equal(payload.deploymentId, '33333333-3333-4333-8333-333333333333');
});

test('parseAgentJobPayload rejects invalid publish payloads', () => {
  assert.throws(() =>
    parseAgentJobPayload(AgentJobName.PublishArtifact, {
      organizationId: '11111111-1111-4111-8111-111111111111',
      artifactId: 'not-a-uuid',
      teamId: '22222222-2222-4222-8222-222222222222'
    })
  );
});
