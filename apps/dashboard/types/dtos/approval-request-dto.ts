import type {
  ApprovalRequestKind,
  ApprovalRequestStatus,
  ApprovalRiskLevel
} from '@workspace/database';

export type ApprovalRequestDto = {
  id: string;
  teamId: string;
  teamName: string;
  runId?: string;
  kind: ApprovalRequestKind;
  status: ApprovalRequestStatus;
  riskLevel: ApprovalRiskLevel;
  title: string;
  description?: string;
  decisionReason?: string;
  createdAt: Date;
  expiresAt?: Date;
  resolvedAt?: Date;
  requestedAction?: Record<string, unknown>;
};
