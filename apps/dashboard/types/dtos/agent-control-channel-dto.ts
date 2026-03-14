import type {
  AgentControlChannelStatus,
  AgentControlChannelType
} from '@workspace/database';

export type AgentControlChannelDto = {
  id: string;
  name: string;
  type: AgentControlChannelType;
  status: AgentControlChannelStatus;
  teamName: string;
  providerConnectionName: string;
  externalChannelId: string;
  externalThreadId?: string;
  runtimeName?: string;
  lastInboundAt?: Date;
  lastOutboundAt?: Date;
};
