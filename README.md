# Terminus Core

> **v0.0.1** — Decentralized Agent Execution Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Terminus is a **decentralized agent execution and orchestration platform** where agents are represented by NFTs (ERC-8004) as identity and ownership, while their execution happens off-chain on user-operated nodes.

## 🌐 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Control Plane                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  WebSocket  │  │    Node     │  │    Orchestrator     │  │
│  │   Server    │──│   Registry  │──│    & Dispatcher     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │ WebSocket (Outbound from Nodes)
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   ┌────────────┐   ┌────────────┐   ┌────────────┐
   │   Node 1   │   │   Node 2   │   │   Node N   │
   │  (User PC) │   │  (User PC) │   │  (User PC) │
   └────────────┘   └────────────┘   └────────────┘
```

## 📦 Packages

| Package | Description |
|---------|-------------|
| `@terminus/protocol` | Shared message types and schemas |
| `@terminus/config` | Platform-wide configuration |
| `@terminus/control-plane` | Backend orchestration server |
| `@terminus/agent-node` | Lightweight agent runtime |

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/terminus-core/terminus-core.git
cd terminus-core

# Install dependencies (from workspace root)
pnpm install

# Build shared packages
pnpm --filter @terminus/protocol build
pnpm --filter @terminus/config build

# Run control plane
pnpm --filter @terminus/control-plane dev

# Run agent node (separate terminal)
pnpm --filter @terminus/agent-node dev
```

## 📡 Protocol Messages

| Message | Direction | Description |
|---------|-----------|-------------|
| `AUTH` | Node → Backend | Node authentication with capabilities |
| `AUTH_ACK` | Backend → Node | Authentication confirmation |
| `HEARTBEAT` | Node → Backend | Periodic alive signal with metrics |
| `JOB_ASSIGN` | Backend → Node | Assign work to a node |
| `JOB_RESULT` | Node → Backend | Return execution result |

## 🔒 Security Model

- **Nodes are untrusted**: All validation happens in the Control Plane
- **Outbound connections only**: Nodes connect to backend, not vice versa
- **No peer-to-peer**: All agent-to-agent communication routes through Control Plane
- **Sandbox execution**: Agent code runs in isolated VM contexts

## 🛣️ Roadmap

- [x] WebSocket handshake & heartbeat
- [ ] Sandboxed job execution
- [ ] HTTP job trigger API
- [ ] NFT-based agent identity (ERC-8004)
- [ ] x402 payment integration
- [ ] Agent state management

## 📄 License

MIT © Terminus Core
