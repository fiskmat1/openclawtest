# Hetzner OpenClaw Control Plane

This directory bootstraps a shared OpenClaw gateway on Hetzner Cloud.

## What It Provisions

- One Hetzner Cloud server for the shared OpenClaw control plane
- A private network and firewall for the node
- Docker and Docker Compose via cloud-init
- Caddy for automatic HTTPS termination
- An OpenClaw service container wired behind Caddy

## Inputs

Set these Terraform variables before applying:

- `hcloud_token`
- `ssh_public_key`
- `server_type`
- `location`
- `openclaw_image`
- `openclaw_host`
- `openclaw_environment`

Optional variables:

- `labels`
- `enable_ipv6`
- `create_volume`
- `volume_size_gb`

## Example

```bash
terraform init
terraform apply \
  -var="hcloud_token=$HCLOUD_TOKEN" \
  -var="ssh_public_key=$(cat ~/.ssh/id_ed25519.pub)" \
  -var='openclaw_host=openclaw.example.com' \
  -var='openclaw_environment={
    OPENCLAW_PORT = "8080"
    OPENCLAW_SHARED_PASSWORD = "replace-me"
  }'
```

## Outputs

- `openclaw_public_ipv4`
- `openclaw_public_ipv6`
- `openclaw_control_url`
- `openclaw_rpc_endpoint`

## Notes

- This is designed as a shared multi-tenant control plane for the app, not one deployment per customer.
- The app should store the resulting RPC endpoint in the OpenClaw provider connection metadata as `rpcEndpoint`.
- Use the E2B provider connection for per-team desktop runtime provisioning; this Hetzner slice only hosts the shared gateway.
