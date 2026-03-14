import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';

import {
  createTelegramBotClient,
} from '@workspace/agents/provider-clients';
import { decryptSecret } from '@workspace/agents/encryption';
import { sendAgentJob } from '@workspace/agents/boss';
import { AgentJobName } from '@workspace/agents/queue';
import {
  AgentControlChannelStatus,
  AgentControlChannelType,
  AgentRuntimeStatus,
  ProviderConnectionType
} from '@workspace/database';
import { prisma } from '@workspace/database/client';

type RouteContext = {
  params: Promise<{
    connectionId: string;
  }>;
};

type TelegramMessage = {
  chatId: string;
  threadId?: string;
  messageId?: string;
  text?: string;
  fromUserId?: string;
  fromUsername?: string;
  chatTitle?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function matchesSecret(expected: string, supplied: string | null): boolean {
  if (!supplied) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);

  return (
    expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}

function extractTelegramMessage(
  payload: Record<string, unknown>
): TelegramMessage | null {
  const message = toRecord(payload.message ?? payload.edited_message);
  const chat = toRecord(message.chat);
  const from = toRecord(message.from);
  const chatId =
    typeof chat.id === 'number' || typeof chat.id === 'string'
      ? String(chat.id)
      : undefined;

  if (!chatId) {
    return null;
  }

  return {
    chatId,
    threadId:
      typeof message.message_thread_id === 'number'
        ? String(message.message_thread_id)
        : undefined,
    messageId:
      typeof message.message_id === 'number'
        ? String(message.message_id)
        : undefined,
    text: typeof message.text === 'string' ? message.text.trim() : undefined,
    fromUserId:
      typeof from.id === 'number' || typeof from.id === 'string'
        ? String(from.id)
        : undefined,
    fromUsername: typeof from.username === 'string' ? from.username : undefined,
    chatTitle:
      typeof chat.title === 'string'
        ? chat.title
        : typeof chat.username === 'string'
          ? chat.username
          : undefined
  };
}

function parseBindSlug(text?: string): string | undefined {
  if (!text) {
    return undefined;
  }

  if (text.startsWith('/bind ')) {
    return text.slice('/bind '.length).trim().toLowerCase();
  }

  if (text.startsWith('/start ')) {
    const token = text.slice('/start '.length).trim().toLowerCase();
    return token.startsWith('bind_') ? token.slice('bind_'.length) : undefined;
  }

  return undefined;
}

function isUnbindCommand(text?: string): boolean {
  return text?.trim().toLowerCase() === '/unbind';
}

async function sendTelegramText(args: {
  accessToken?: string | null;
  chatId: string;
  threadId?: string;
  text: string;
}): Promise<void> {
  if (!args.accessToken) {
    return;
  }

  await createTelegramBotClient().sendMessage({
    accessToken: args.accessToken,
    chatId: args.chatId,
    text: args.text,
    ...(args.threadId
      ? {
          threadId: args.threadId
        }
      : {})
  });
}

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { connectionId } = await context.params;
  const connection = await prisma.providerConnection.findFirst({
    where: {
      id: connectionId,
      type: ProviderConnectionType.TELEGRAM
    },
    select: {
      id: true,
      organizationId: true,
      encryptedAccessToken: true,
      encryptedSecret: true
    }
  });

  if (!connection?.encryptedSecret) {
    return NextResponse.json(
      { error: 'Integration not found' },
      { status: 404 }
    );
  }

  const suppliedSecret = request.headers.get('x-telegram-bot-api-secret-token');
  const expectedSecret = await decryptSecret(connection.encryptedSecret);

  if (!matchesSecret(expectedSecret, suppliedSecret)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const payload = isRecord(body) ? body : {};
  const message = extractTelegramMessage(payload);

  if (!message) {
    return NextResponse.json({ accepted: true });
  }

  const accessToken = connection.encryptedAccessToken
    ? await decryptSecret(connection.encryptedAccessToken)
    : null;
  const bindSlug = parseBindSlug(message.text);

  if (bindSlug) {
    const team = await prisma.agentTeam.findFirst({
      where: {
        organizationId: connection.organizationId,
        slug: bindSlug
      },
      select: {
        id: true,
        name: true,
        runtimes: {
          where: {
            status: AgentRuntimeStatus.READY
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1,
          select: {
            id: true
          }
        }
      }
    });

    if (!team) {
      await sendTelegramText({
        accessToken,
        chatId: message.chatId,
        threadId: message.threadId,
        text: `No team found for slug "${bindSlug}".`
      });

      return NextResponse.json({ accepted: true });
    }

    const existingChannel = await prisma.agentControlChannel.findFirst({
      where: {
        providerConnectionId: connection.id,
        externalChannelId: message.chatId,
        externalThreadId: message.threadId ?? null
      },
      select: {
        id: true
      }
    });

    if (existingChannel) {
      await prisma.agentControlChannel.update({
        where: {
          id: existingChannel.id
        },
        data: {
          teamId: team.id,
          runtimeId: team.runtimes[0]?.id ?? null,
          status: AgentControlChannelStatus.ACTIVE,
          name: `${team.name} Telegram`,
          externalUserId: message.fromUserId ?? null,
          lastInboundAt: new Date(),
          metadata: {
            chatTitle: message.chatTitle,
            fromUsername: message.fromUsername
          }
        }
      });
    } else {
      await prisma.agentControlChannel.create({
        data: {
          organizationId: connection.organizationId,
          teamId: team.id,
          runtimeId: team.runtimes[0]?.id ?? null,
          providerConnectionId: connection.id,
          type: AgentControlChannelType.TELEGRAM,
          status: AgentControlChannelStatus.ACTIVE,
          name: `${team.name} Telegram`,
          externalChannelId: message.chatId,
          externalThreadId: message.threadId ?? null,
          externalUserId: message.fromUserId ?? null,
          lastInboundAt: new Date(),
          metadata: {
            chatTitle: message.chatTitle,
            fromUsername: message.fromUsername
          }
        }
      });
    }

    await sendTelegramText({
      accessToken,
      chatId: message.chatId,
      threadId: message.threadId,
      text: `Bound this chat to ${team.name}. Future messages will be routed to the team.`
    });

    return NextResponse.json({ accepted: true, bound: true });
  }

  if (isUnbindCommand(message.text)) {
    const existingChannel = await prisma.agentControlChannel.findFirst({
      where: {
        providerConnectionId: connection.id,
        externalChannelId: message.chatId,
        externalThreadId: message.threadId ?? null
      },
      select: {
        id: true
      }
    });

    if (existingChannel) {
      await prisma.agentControlChannel.update({
        where: {
          id: existingChannel.id
        },
        data: {
          status: AgentControlChannelStatus.PAUSED
        }
      });
    }

    await sendTelegramText({
      accessToken,
      chatId: message.chatId,
      threadId: message.threadId,
      text: 'This chat is no longer bound to an agent team.'
    });

    return NextResponse.json({ accepted: true, bound: false });
  }

  const channel = await prisma.agentControlChannel.findFirst({
    where: {
      providerConnectionId: connection.id,
      externalChannelId: message.chatId,
      externalThreadId: message.threadId ?? null,
      status: AgentControlChannelStatus.ACTIVE
    },
    include: {
      team: {
        select: {
          name: true,
          runtimes: {
            where: {
              status: AgentRuntimeStatus.READY
            },
            orderBy: {
              createdAt: 'desc'
            },
            take: 1,
            select: {
              id: true
            }
          }
        }
      }
    }
  });

  if (!channel) {
    await sendTelegramText({
      accessToken,
      chatId: message.chatId,
      threadId: message.threadId,
      text: 'This chat is not bound to a team yet. Use /bind <team-slug> first.'
    });

    return NextResponse.json({ accepted: true, bound: false });
  }

  const runtimeId =
    channel.team.runtimes[0]?.id ?? channel.runtimeId ?? undefined;

  if (runtimeId && runtimeId !== channel.runtimeId) {
    await prisma.agentControlChannel.update({
      where: {
        id: channel.id
      },
      data: {
        runtimeId
      }
    });
  }

  await sendAgentJob(AgentJobName.ProcessProviderWebhook, {
    provider: 'telegram',
    organizationId: connection.organizationId,
    teamId: channel.teamId,
    runtimeId,
    providerConnectionId: connection.id,
    channelId: channel.id,
    payload: {
      text: message.text,
      chatId: message.chatId,
      threadId: message.threadId,
      messageId: message.messageId,
      fromUserId: message.fromUserId,
      fromUsername: message.fromUsername,
      chatTitle: message.chatTitle
    }
  });

  return NextResponse.json({ accepted: true, queued: true });
}
