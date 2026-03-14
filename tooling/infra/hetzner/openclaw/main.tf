terraform {
  required_version = ">= 1.6.0"

  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.51"
    }
  }
}

provider "hcloud" {
  token = var.hcloud_token
}

locals {
  openclaw_environment = merge(
    {
      OPENCLAW_HOST = var.openclaw_host
      OPENCLAW_PORT = tostring(var.openclaw_port)
    },
    var.openclaw_environment
  )

  docker_compose = templatefile("${path.module}/templates/docker-compose.yaml.tftpl", {
    openclaw_image            = var.openclaw_image
    openclaw_port             = var.openclaw_port
    openclaw_environment_yaml = indent(6, yamlencode(local.openclaw_environment))
  })

  caddyfile = <<-EOT
  ${var.openclaw_host} {
    encode zstd gzip
    reverse_proxy openclaw:${var.openclaw_port}
  }
  EOT

  user_data = templatefile("${path.module}/templates/cloud-init.yaml.tftpl", {
    compose_path    = var.compose_path
    docker_compose  = local.docker_compose
    caddyfile       = local.caddyfile
  })
}

resource "hcloud_ssh_key" "operator" {
  name       = "${var.name}-operator"
  public_key = var.ssh_public_key
}

resource "hcloud_network" "openclaw" {
  name     = "${var.name}-network"
  ip_range = var.network_cidr
  labels   = var.labels
}

resource "hcloud_network_subnet" "openclaw" {
  type         = "cloud"
  network_id   = hcloud_network.openclaw.id
  network_zone = var.network_zone
  ip_range     = var.subnet_cidr
}

resource "hcloud_firewall" "openclaw" {
  name   = "${var.name}-firewall"
  labels = var.labels

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "22"
    source_ips = var.ssh_allowed_ips
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "80"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "443"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction       = "out"
    protocol        = "tcp"
    port            = "1-65535"
    destination_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction       = "out"
    protocol        = "udp"
    port            = "1-65535"
    destination_ips = ["0.0.0.0/0", "::/0"]
  }
}

resource "hcloud_server" "openclaw" {
  name        = var.name
  image       = var.image
  server_type = var.server_type
  location    = var.location
  labels      = var.labels
  user_data   = local.user_data

  ssh_keys = [hcloud_ssh_key.operator.id]

  public_net {
    ipv4_enabled = true
    ipv6_enabled = var.enable_ipv6
  }
}

resource "hcloud_server_network" "openclaw" {
  server_id  = hcloud_server.openclaw.id
  network_id = hcloud_network.openclaw.id
  ip         = var.private_ip
}

resource "hcloud_firewall_attachment" "openclaw" {
  firewall_id = hcloud_firewall.openclaw.id
  server_ids  = [hcloud_server.openclaw.id]
}
