export type AgentsOverviewDto = {
  teamCount: number;
  activeTeamCount: number;
  runtimeReadyCount: number;
  pendingApprovalCount: number;
  connectedIntegrationCount: number;
  latestRun?: {
    id: string;
    title: string;
    teamName: string;
    status: string;
    createdAt: Date;
  };
  latestDeployment?: {
    id: string;
    teamName: string;
    status: string;
    createdAt: Date;
  };
};
