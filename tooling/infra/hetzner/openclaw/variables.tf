variable "hcloud_token" {
  description = "Hetzner Cloud API token."
  type        = string
  sensitive   = true
}

variable "name" {
  description = "Base name for the OpenClaw control plane resources."
  type        = string
  default     = "openclaw-control-plane"
}

variable "image" {
  description = "Hetzner Cloud server image."
  type        = string
  default     = "ubuntu-24.04"
}

variable "server_type" {
  description = "Hetzner Cloud server type."
  type        = string
  default     = "cpx21"
}

variable "location" {
  description = "Hetzner Cloud location."
  type        = string
  default     = "nbg1"
}

variable "enable_ipv6" {
  description = "Whether to enable IPv6 for the instance."
  type        = bool
  default     = true
}

variable "ssh_public_key" {
  description = "Operator SSH public key."
  type        = string
}

variable "ssh_allowed_ips" {
  description = "CIDR blocks allowed to SSH into the server."
  type        = list(string)
  default     = ["0.0.0.0/0", "::/0"]
}

variable "labels" {
  description = "Labels applied to Hetzner resources."
  type        = map(string)
  default = {
    managed-by = "terraform"
    stack      = "openclaw"
  }
}

variable "network_cidr" {
  description = "Private network CIDR for the OpenClaw node."
  type        = string
  default     = "10.80.0.0/16"
}

variable "subnet_cidr" {
  description = "Private subnet CIDR for the OpenClaw node."
  type        = string
  default     = "10.80.1.0/24"
}

variable "network_zone" {
  description = "Hetzner network zone."
  type        = string
  default     = "eu-central"
}

variable "private_ip" {
  description = "Private IP assigned to the OpenClaw node."
  type        = string
  default     = "10.80.1.10"
}

variable "compose_path" {
  description = "Path on the server where Compose assets are written."
  type        = string
  default     = "/opt/openclaw"
}

variable "openclaw_host" {
  description = "Public DNS host used by Caddy for OpenClaw."
  type        = string
}

variable "openclaw_port" {
  description = "Internal port exposed by the OpenClaw container."
  type        = number
  default     = 8080
}

variable "openclaw_image" {
  description = "Docker image for the OpenClaw gateway."
  type        = string
}

variable "openclaw_environment" {
  description = "Environment variables injected into the OpenClaw container."
  type        = map(string)
  default     = {}
  sensitive   = true
}
