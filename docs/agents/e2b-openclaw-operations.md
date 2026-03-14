# E2B OpenClaw Operations

## Shared Control Plane

- OpenClaw is expected to run as one shared multi-tenant gateway on Hetzner.
- The Terraform bootstrap for that control plane lives in `tooling/infra/hetzner/openclaw`.
- Save the resulting RPC endpoint in the dashboard OpenClaw integration metadata as `rpcEndpoint`.

## Required Integrations

Each organization should connect:

- `E2B`: store the API key as the access token
- `OpenClaw`: store the RPC endpoint in metadata, and an access token or shared password if the gateway requires auth
- `Telegram` optional: store the bot token as the access token; the webhook secret is generated automatically if omitted

## Auto Deployment

- Teams auto-deploy as soon as an organization has both an active `E2B` integration and OpenClaw connectivity.
- Manual deploys are still available from the Teams tab and use `E2B` by default.
- Runtime `controlUrl` now points to the E2B live view.

## Telegram Control Channels

- Add a Telegram integration in the dashboard.
- If `NEXT_PUBLIC_DASHBOARD_URL` or `metadata.webhookBaseUrl` is set, the app registers the Telegram webhook automatically.
- In the target chat, send `/bind <team-slug>` to attach the chat to a team.
- Send `/unbind` to pause the binding.

## Worker Responsibilities

- Provision E2B desktops and store the sandbox ID in `AgentRuntime.externalRuntimeId`.
- Reconcile runtime health and keep the E2B live-view URL in `AgentRuntime.controlUrl`.
- Create or attach OpenClaw sessions for each agent and persist the session key in `Agent.providerSessionId`.
- Route inbound Telegram messages to the supervisor session and relay assistant replies back to the bound chat.

## Failure Recovery

- If deployment fails, inspect the worker logs and the latest deployment row in the dashboard.
- If OpenClaw is reachable but sessions are missing, trigger a manual run or reconcile job; the worker will recreate sessions.
- If Telegram stops receiving updates, re-save the Telegram integration after confirming the public dashboard URL is correct.
