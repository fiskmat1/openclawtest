import assert from 'node:assert/strict';
import test from 'node:test';
import { Sandbox } from '@e2b/desktop';

import {
  AgentDeploymentStatus,
  AgentRunStatus,
  AgentRuntimeProvider,
  AgentRuntimeStatus
} from '@workspace/database';

import {
  createE2BDesktopProviderClient,
  createKiloClawProviderClient,
  createTelegramBotClient,
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

test('E2B client provisions desktop runtimes with live view URLs', async () => {
  const sandboxClass = Sandbox as unknown as {
    create: typeof Sandbox.create;
  };
  const originalCreate = sandboxClass.create;
  const originalE2BApiKey = process.env.AGENTS_E2B_API_KEY;
  const originalKiloBaseUrl = process.env.AGENTS_KILO_API_BASE_URL;
  const originalOpenClawRpcEndpoint = process.env.AGENTS_OPENCLAW_RPC_ENDPOINT;

  process.env.AGENTS_E2B_API_KEY = 'test_e2b_key';
  process.env.AGENTS_KILO_API_BASE_URL = 'https://kilo.example.com';
  process.env.AGENTS_OPENCLAW_RPC_ENDPOINT = 'https://openclaw.example.com/rpc';

  sandboxClass.create = (async () =>
    ({
      sandboxId: 'sandbox_123',
      stream: {
        start: async () => undefined,
        getAuthKey: () => 'auth_key',
        getUrl: () => 'https://e2b.example.com/live?sandbox=sandbox_123'
      }
    }) as never) as typeof Sandbox.create;

  try {
    const client = createE2BDesktopProviderClient();
    const result = await client.createRuntime({
      organizationId: '11111111-1111-1111-1111-111111111111',
      teamId: '22222222-2222-2222-2222-222222222222',
      teamSlug: 'acme-team',
      teamName: 'Acme team',
      preferredRegion: 'eu-central'
    });

    assert.equal(result.provider, AgentRuntimeProvider.E2B);
    assert.equal(result.deploymentStatus, AgentDeploymentStatus.READY);
    assert.equal(result.runtimeStatus, AgentRuntimeStatus.READY);
    assert.equal(
      result.controlUrl,
      'https://e2b.example.com/live?sandbox=sandbox_123'
    );
    assert.equal(result.externalRuntimeId, 'sandbox_123');
  } finally {
    sandboxClass.create = originalCreate;
    process.env.AGENTS_E2B_API_KEY = originalE2BApiKey;
    process.env.AGENTS_KILO_API_BASE_URL = originalKiloBaseUrl;
    process.env.AGENTS_OPENCLAW_RPC_ENDPOINT = originalOpenClawRpcEndpoint;
  }
});

test('Telegram bot client posts messages to Telegram API', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input, init) => {
    assert.equal(
      String(input),
      'https://api.telegram.org/bottoken/sendMessage'
    );
    assert.equal(init?.method, 'POST');

    return new Response(
      JSON.stringify({
        ok: true,
        result: {
          message_id: 42
        }
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }) as typeof fetch;

  try {
    const client = createTelegramBotClient();
    const result = await client.sendMessage({
      accessToken: 'token',
      chatId: '-100123',
      text: 'hello world'
    });

    assert.equal(result.ok, true);
    assert.equal(result.messageId, '42');
  } finally {
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
