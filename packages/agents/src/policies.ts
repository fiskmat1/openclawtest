export type ApprovalPolicy = {
  requireApprovalForPublish: boolean;
  requireApprovalForCredentialChanges: boolean;
  requireApprovalForSpendAboveUsd: number;
  requireApprovalForFirstTimeLogins: boolean;
};

export const defaultApprovalPolicy: ApprovalPolicy = {
  requireApprovalForPublish: true,
  requireApprovalForCredentialChanges: true,
  requireApprovalForSpendAboveUsd: 50,
  requireApprovalForFirstTimeLogins: true
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function normalizeApprovalPolicy(value: unknown): ApprovalPolicy {
  if (!isRecord(value)) {
    return defaultApprovalPolicy;
  }

  return {
    requireApprovalForPublish:
      typeof value.requireApprovalForPublish === 'boolean'
        ? value.requireApprovalForPublish
        : defaultApprovalPolicy.requireApprovalForPublish,
    requireApprovalForCredentialChanges:
      typeof value.requireApprovalForCredentialChanges === 'boolean'
        ? value.requireApprovalForCredentialChanges
        : defaultApprovalPolicy.requireApprovalForCredentialChanges,
    requireApprovalForSpendAboveUsd:
      typeof value.requireApprovalForSpendAboveUsd === 'number'
        ? value.requireApprovalForSpendAboveUsd
        : defaultApprovalPolicy.requireApprovalForSpendAboveUsd,
    requireApprovalForFirstTimeLogins:
      typeof value.requireApprovalForFirstTimeLogins === 'boolean'
        ? value.requireApprovalForFirstTimeLogins
        : defaultApprovalPolicy.requireApprovalForFirstTimeLogins
  };
}
