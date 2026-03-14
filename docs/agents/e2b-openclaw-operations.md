# OpenAI E2B OpenClaw Operations

## Shared Control Plane

- OpenClaw is expected to run as one shared multi-tenant gateway on Hetzner.
- The Terraform bootstrap for that control plane lives in `tooling/infra/hetzner/openclaw`.
- Save the resulting RPC endpoint in the dashboard OpenClaw integration metadata as `rpcEndpoint`.

## Required Integrations

Each organization should connect:

- `OpenAI`: store the API key as the access token; this is the primary computer-use supervisor
- `E2B`: store the API key as the access token
- `OpenClaw`: store the RPC endpoint in metadata, and an access token or shared password if the gateway requires auth
- `Telegram` optional: store the bot token as the access token; the webhook secret is generated automatically if omitted

## Auto Deployment

- Teams auto-deploy as soon as an organization has active `OpenAI`, `E2B`, and `OpenClaw` integrations.
- Manual deploys are still available from the Teams tab and use `E2B` by default.
- Runtime `controlUrl` now points to the E2B live view.
- The runtime metadata persists the last OpenAI response ID so the supervisor can resume long-lived loops efficiently.

## Telegram Control Channels

- Add a Telegram integration in the dashboard.
- If `NEXT_PUBLIC_DASHBOARD_URL` or `metadata.webhookBaseUrl` is set, the app registers the Telegram webhook automatically.
- In the target chat, send `/bind <team-slug>` to attach the chat to a team.
- Send `/unbind` to pause the binding.
- Available operator commands include `/pause`, `/resume`, `/status`, `/summary`, `/approve [approval-id]`, and `/reject [approval-id]`.

## Worker Responsibilities

- Provision E2B desktops and store the sandbox ID in `AgentRuntime.externalRuntimeId`.
- Reconcile runtime health and keep the E2B live-view URL in `AgentRuntime.controlUrl`.
- Create or attach OpenClaw sessions for each agent and persist the session key in `Agent.providerSessionId`.
- Run the OpenAI computer-use supervisor on the E2B desktop, persist supervisor state, and feed its directives into the OpenClaw specialist mesh.
- Route inbound Telegram messages into the live supervisor loop and relay operator-facing replies back to the bound chat.
- Keep a durable heartbeat, recovery, and publish-status polling loop alive through `pg-boss`.

## Failure Recovery

- If deployment fails, inspect the worker logs and the latest deployment row in the dashboard.
- If OpenClaw is reachable but sessions are missing, trigger a manual run or reconcile job; the worker will recreate sessions.
- If Telegram stops receiving updates, re-save the Telegram integration after confirming the public dashboard URL is correct.
- If the supervisor starts waiting for confirmation, resolve the pending approval from the dashboard or the bound Telegram chat before the next autonomous tick continues.
