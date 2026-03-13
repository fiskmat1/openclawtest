import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AgentDeploymentStatus,
  AgentRunStatus,
  AgentRuntimeProvider,
  AgentRuntimeStatus
} from '@workspace/database';

import {
  createKiloClawProviderClient,
  createTikTokPublisherClient
} from './provider-clients';

test('Kilo client maps provider responses into sync results', async () => {
  const originalBaseUrl = process.env.AGENTS_KILO_API_BASE_URL;
  const originalFetch = globalThis.fetch;

  process.env.AGENTS_KILO_API_BASE_URL = 'https://kilo.example.com';
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        id: 'dep_123',
        runtimeId: 'rt_123',
        status: AgentDeploymentStatus.READY,
        runtimeStatus: AgentRuntimeStatus.READY,
        controlUrl: 'https://console.example.com/runtime',
        region: 'eu-west-1'
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )) as typeof fetch;

  try {
    const client = createKiloClawProviderClient();
    const result = await client.createRuntime({
      organizationId: '11111111-1111-1111-1111-111111111111',
      teamId: '22222222-2222-2222-2222-222222222222',
      teamSlug: 'acme-team',
      teamName: 'Acme team',
      preferredRegion: 'eu-west-1'
    });

    assert.equal(result.provider, AgentRuntimeProvider.KILOCLAW);
    assert.equal(result.deploymentStatus, AgentDeploymentStatus.READY);
    assert.equal(result.runtimeStatus, AgentRuntimeStatus.READY);
    assert.equal(result.controlUrl, 'https://console.example.com/runtime');
  } finally {
    process.env.AGENTS_KILO_API_BASE_URL = originalBaseUrl;
    globalThis.fetch = originalFetch;
  }
});

test('TikTok publisher maps asynchronous publish responses', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        data: {
          publish_id: 'pub_123',
          upload_url: 'https://uploads.example.com/pub_123'
        }
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )) as typeof fetch;

  try {
    const publisher = createTikTokPublisherClient();
    const result = await publisher.publishVideo({
      accessToken: 'token',
      title: 'Test publish',
      videoUrl: 'https://cdn.example.com/video.mp4',
      source: 'PULL_FROM_URL',
      directPost: false
    });

    assert.equal(result.publishId, 'pub_123');
    assert.equal(result.status, AgentRunStatus.RUNNING);
    assert.equal(result.uploadUrl, 'https://uploads.example.com/pub_123');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
