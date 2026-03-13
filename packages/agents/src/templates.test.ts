import assert from 'node:assert/strict';
import test from 'node:test';

import { AgentRole, AgentTeamTemplate } from '@workspace/database';

import {
  createGenericOperationsBlueprint,
  createTeamSlug,
  createTikTokMarketingBlueprint
} from './templates';

test('createTeamSlug normalizes unsafe names', () => {
  assert.equal(createTeamSlug('  Team With Spaces & Symbols!  '), 'team-with-spaces-symbols');
  assert.equal(createTeamSlug(''), 'agent-team');
});

test('TikTok blueprint includes publishing workflow roles', () => {
  const blueprint = createTikTokMarketingBlueprint('Acme');

  assert.equal(blueprint.template, AgentTeamTemplate.TIKTOK_MARKETING);
  assert.equal(blueprint.approvalPolicy.requireApprovalForPublish, true);
  assert.equal(
    blueprint.agents.some((agent) => agent.role === AgentRole.PUBLISHER),
    true
  );
  assert.equal(
    blueprint.agents.some((agent) => agent.role === AgentRole.SUPERVISOR),
    true
  );
});

test('generic operations blueprint is supervisor-led', () => {
  const blueprint = createGenericOperationsBlueprint('Acme');

  assert.equal(blueprint.template, AgentTeamTemplate.GENERIC_OPERATIONS);
  assert.equal(blueprint.cadenceCron, '0 */12 * * *');
  assert.equal(blueprint.agents[0]?.role, AgentRole.SUPERVISOR);
});
