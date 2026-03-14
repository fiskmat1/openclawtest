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
  createOpenClawGatewayClient,
  createOpenAIComputerUseSupervisorClient,
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

test('OpenClaw client uses tools invoke endpoint', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input, init) => {
    assert.equal(
      String(input),
      'http://127.0.0.1:18789/tools/invoke'
    );
    assert.equal(init?.method, 'POST');

    const body = JSON.parse(String(init?.body)) as {
      tool: string;
      args: Record<string, unknown>;
    };

    if (body.tool === 'sessions_list') {
      return new Response(
        JSON.stringify({
          ok: true,
          result: {
            details: {
              sessions: [
                {
                  key: 'agent:main:subagent:test',
                  displayName: 'Researcher'
                }
              ]
            }
          }
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    if (body.tool === 'sessions_spawn') {
      assert.equal(body.args.task, 'Follow the assigned goal.');
      assert.equal(body.args.label, 'Researcher');

      return new Response(
        JSON.stringify({
          ok: true,
          result: {
            details: {
              childSessionKey: 'agent:main:subagent:new'
            }
          }
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    if (body.tool === 'sessions_send') {
      assert.equal(body.args.sessionKey, 'agent:main:subagent:new');
      assert.equal(body.args.message, 'hello');
      assert.equal(body.args.timeoutSeconds, 2);

      return new Response(
        JSON.stringify({
          ok: true,
          result: {
            details: {
              status: 'accepted'
            }
          }
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    if (body.tool === 'sessions_history') {
      return new Response(
        JSON.stringify({
          ok: true,
          result: {
            details: {
              messages: [
                {
                  id: '1',
                  role: 'assistant',
                  content: [{ text: 'Hello back' }]
                },
                {
                  id: '2',
                  role: 'toolResult',
                  content: 'tool output'
                }
              ]
            }
          }
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    throw new Error(`Unexpected tool ${body.tool}`);
  }) as typeof fetch;

  try {
    const client = createOpenClawGatewayClient({
      endpoint: 'http://127.0.0.1:18789/rpc',
      authToken: 'token'
    });

    const sessions = await client.listSessions();
    assert.equal(sessions[0]?.title, 'Researcher');

    const session = await client.spawnSession({
      teamSlug: 'team',
      title: 'Researcher',
      prompt: 'Follow the assigned goal.'
    });
    assert.equal(session.key, 'agent:main:subagent:new');

    await client.sendMessage({
      sessionKey: session.key,
      message: 'hello',
      timeoutMs: 2000
    });

    const history = await client.getHistory(session.key);
    assert.deepEqual(history, [
      {
        id: '1',
        role: 'assistant',
        content: 'Hello back',
        createdAt: undefined,
        metadata: undefined
      },
      {
        id: '2',
        role: 'tool',
        content: 'tool output',
        createdAt: undefined,
        metadata: undefined
      }
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('OpenAI computer-use supervisor client normalizes response turns', async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.AGENTS_OPENAI_API_KEY;
  const originalModel = process.env.AGENTS_OPENAI_MODEL;
  const originalBaseUrl = process.env.AGENTS_OPENAI_BASE_URL;
  const originalKiloBaseUrl = process.env.AGENTS_KILO_API_BASE_URL;
  const originalOpenClawEndpoint = process.env.AGENTS_OPENCLAW_RPC_ENDPOINT;

  globalThis.fetch = (async (input, init) => {
    assert.equal(String(input), 'https://api.openai.com/v1/responses');
    assert.equal(init?.method, 'POST');

    const body = JSON.parse(String(init?.body)) as {
      model: string;
      tools: Array<{ type: string }>;
      input: Array<{
        role?: string;
        content?: Array<{
          type?: string;
          text?: string;
          image_url?: string;
        }>;
      }>;
    };

    assert.equal(body.model, 'gpt-5.4');
    assert.equal(body.tools[0]?.type, 'computer');
    assert.equal(body.input[0]?.content?.[0]?.type, 'input_text');
    assert.equal(body.input[0]?.content?.[1]?.type, 'input_image');
    assert.equal(body.input[0]?.content?.[1]?.image_url, 'data:image/png;base64,abc');

    return new Response(
      JSON.stringify({
        id: 'resp_123',
        output: [
          {
            type: 'computer_call',
            call_id: 'call_123',
            pending_safety_checks: [],
            actions: [
              {
                type: 'click',
                x: 10,
                y: 20,
                button: 'left'
              }
            ]
          },
          {
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'output_text',
                text: 'Opened the app.'
              }
            ]
          }
        ]
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
    process.env.AGENTS_OPENAI_API_KEY = 'test-openai-key';
    process.env.AGENTS_OPENAI_MODEL = 'gpt-5.4';
    process.env.AGENTS_OPENAI_BASE_URL = 'https://api.openai.com/v1';
    process.env.AGENTS_KILO_API_BASE_URL = 'https://kilo.example.com';
    process.env.AGENTS_OPENCLAW_RPC_ENDPOINT = 'https://openclaw.example.com/rpc';

    const client = createOpenAIComputerUseSupervisorClient();
    const result = await client.createTurn({
      task: 'Inspect the desktop.',
      systemPrompt: 'You supervise the runtime.',
      screenshotUrl: 'data:image/png;base64,abc'
    });

    assert.equal(result.responseId, 'resp_123');
    assert.equal(result.outputText, 'Opened the app.');
    assert.equal(result.turns[0]?.callId, 'call_123');
    assert.equal(result.turns[0]?.actions[0]?.type, 'click');
  } finally {
    globalThis.fetch = originalFetch;
    process.env.AGENTS_OPENAI_API_KEY = originalApiKey;
    process.env.AGENTS_OPENAI_MODEL = originalModel;
    process.env.AGENTS_OPENAI_BASE_URL = originalBaseUrl;
    process.env.AGENTS_KILO_API_BASE_URL = originalKiloBaseUrl;
    process.env.AGENTS_OPENCLAW_RPC_ENDPOINT = originalOpenClawEndpoint;
  }
});

test('OpenAI computer-use supervisor client sends screenshot on text-only continuation', async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.AGENTS_OPENAI_API_KEY;
  const originalModel = process.env.AGENTS_OPENAI_MODEL;
  const originalBaseUrl = process.env.AGENTS_OPENAI_BASE_URL;
  const originalKiloBaseUrl = process.env.AGENTS_KILO_API_BASE_URL;
  const originalOpenClawEndpoint = process.env.AGENTS_OPENCLAW_RPC_ENDPOINT;

  globalThis.fetch = (async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as {
      previous_response_id?: string;
      input: Array<{
        role?: string;
        content?: Array<{
          type?: string;
          text?: string;
          image_url?: string;
        }>;
      }>;
    };

    assert.equal(body.previous_response_id, undefined);
    assert.equal(body.input[0]?.role, 'user');
    assert.equal(body.input[0]?.content?.[0]?.type, 'input_text');
    assert.equal(body.input[0]?.content?.[1]?.type, 'input_image');
    assert.equal(body.input[0]?.content?.[1]?.image_url, 'data:image/png;base64,xyz');

    return new Response(
      JSON.stringify({
        id: 'resp_next',
        output: [
          {
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'output_text',
                text: 'Continuing from the refreshed screenshot.'
              }
            ]
          }
        ]
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
    process.env.AGENTS_OPENAI_API_KEY = 'test-openai-key';
    process.env.AGENTS_OPENAI_MODEL = 'gpt-5.4';
    process.env.AGENTS_OPENAI_BASE_URL = 'https://api.openai.com/v1';
    process.env.AGENTS_KILO_API_BASE_URL = 'https://kilo.example.com';
    process.env.AGENTS_OPENCLAW_RPC_ENDPOINT = 'https://openclaw.example.com/rpc';

    const client = createOpenAIComputerUseSupervisorClient();
    const result = await client.createTurn({
      task: 'Continue supervising the runtime.',
      systemPrompt: 'You supervise the runtime.',
      previousResponseId: 'resp_prev',
      screenshotUrl: 'data:image/png;base64,xyz'
    });

    assert.equal(result.responseId, 'resp_next');
    assert.equal(
      result.outputText,
      'Continuing from the refreshed screenshot.'
    );
    assert.equal(result.turns[0]?.actions.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.AGENTS_OPENAI_API_KEY = originalApiKey;
    process.env.AGENTS_OPENAI_MODEL = originalModel;
    process.env.AGENTS_OPENAI_BASE_URL = originalBaseUrl;
    process.env.AGENTS_KILO_API_BASE_URL = originalKiloBaseUrl;
    process.env.AGENTS_OPENCLAW_RPC_ENDPOINT = originalOpenClawEndpoint;
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
