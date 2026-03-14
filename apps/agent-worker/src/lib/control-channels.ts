import {
  createTelegramBotClient,
  decryptSecret,
  type GatewayTranscriptEntry
} from '@workspace/agents';
import {
  AgentControlChannelStatus,
  AgentControlChannelType,
  ProviderConnectionStatus,
  ProviderConnectionType
} from '@workspace/database';
import { prisma } from '@workspace/database/client';
import { MonitoringProvider } from '@workspace/monitoring/provider';

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function formatTranscriptReply(
  entries: GatewayTranscriptEntry[]
): string | undefined {
  const assistantMessages = entries
    .filter((entry) => entry.role === 'assistant')
    .map((entry) => entry.content.trim())
    .filter((entry) => entry.length > 0);

  if (assistantMessages.length === 0) {
    return undefined;
  }

  return assistantMessages.at(-1);
}

async function sendTelegramMessage(args: {
  channelId: string;
  text: string;
}): Promise<void> {
  const channel = await prisma.agentControlChannel.findFirst({
    where: {
      id: args.channelId,
      type: AgentControlChannelType.TELEGRAM,
      status: AgentControlChannelStatus.ACTIVE,
      providerConnection: {
        type: ProviderConnectionType.TELEGRAM,
        status: ProviderConnectionStatus.CONNECTED
      }
    },
    include: {
      providerConnection: {
        select: {
          encryptedAccessToken: true
        }
      }
    }
  });

  if (!channel?.providerConnection.encryptedAccessToken) {
    return;
  }

  try {
    const accessToken = await decryptSecret(
      channel.providerConnection.encryptedAccessToken
    );

    await createTelegramBotClient().sendMessage({
      accessToken,
      chatId: channel.externalChannelId,
      text: args.text,
      ...(channel.externalThreadId
        ? {
            threadId: channel.externalThreadId
          }
        : {})
    });

    await prisma.agentControlChannel.update({
      where: {
        id: channel.id
      },
      data: {
        lastOutboundAt: new Date()
      }
    });
  } catch (error) {
    MonitoringProvider.captureError(error);
  }
}

export async function notifyControlChannel(args: {
  channelId: string;
  text: string;
}): Promise<void> {
  await sendTelegramMessage(args);
}

export async function notifyTeamControlChannels(args: {
  teamId: string;
  text: string;
}): Promise<void> {
  const channels = await prisma.agentControlChannel.findMany({
    where: {
      teamId: args.teamId,
      type: AgentControlChannelType.TELEGRAM,
      status: AgentControlChannelStatus.ACTIVE
    },
    select: {
      id: true
    }
  });

  for (const channel of channels) {
    await sendTelegramMessage({
      channelId: channel.id,
      text: args.text
    });
  }
}

export async function markControlChannelInbound(
  channelId: string
): Promise<void> {
  await prisma.agentControlChannel.update({
    where: {
      id: channelId
    },
    data: {
      lastInboundAt: new Date()
    }
  });
}

export async function notifyControlChannelWithTranscript(args: {
  channelId: string;
  entries: GatewayTranscriptEntry[];
}): Promise<void> {
  const text = formatTranscriptReply(args.entries);

  if (!text) {
    return;
  }

  await sendTelegramMessage({
    channelId: args.channelId,
    text
  });
}

export function getTelegramChannelBindingPayload(input: {
  teamId: string;
  chatId: string;
  threadId?: string;
  messageId?: string;
  fromUserId?: string;
  teamName: string;
}): Record<string, unknown> {
  return {
    source: 'telegram',
    teamId: input.teamId,
    chatId: input.chatId,
    threadId: input.threadId,
    messageId: input.messageId,
    fromUserId: input.fromUserId,
    teamName: input.teamName
  };
}

export function parseTelegramMetadataChannelId(
  metadata: unknown
): string | undefined {
  const record = toRecord(metadata);
  const value = record.chatId;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
