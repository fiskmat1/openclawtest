output "openclaw_public_ipv4" {
  description = "Public IPv4 address of the shared OpenClaw control plane."
  value       = hcloud_server.openclaw.ipv4_address
}

output "openclaw_public_ipv6" {
  description = "Public IPv6 address of the shared OpenClaw control plane."
  value       = hcloud_server.openclaw.ipv6_address
}

output "openclaw_private_ip" {
  description = "Private IP address of the OpenClaw server."
  value       = var.private_ip
}

output "openclaw_control_url" {
  description = "HTTPS URL for the OpenClaw gateway."
  value       = "https://${var.openclaw_host}"
}

output "openclaw_rpc_endpoint" {
  description = "RPC endpoint stored in the dashboard OpenClaw integration metadata."
  value       = "https://${var.openclaw_host}/rpc"
}
