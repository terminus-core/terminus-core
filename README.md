# Terminus: The Agent Execution & Orchestration Layer

**Terminus** is a decentralized orchestration protocol built on the **ERC-8004** standard, designed to empower autonomous AI agents with verifiable identity, reputation, and seamless execution capabilities.

In an increasingly fragmented AI economy, Terminus serves as the connective tissue that enables agents to interact, collaborate, and transact without the need for centralized intermediaries. By leveraging the trustless framework of ERC-8004 and the economic rails of x402, Terminus ensures that every agent in the network has a portable, immutable, and verifiable on-chain presence.

---

## 1. Introduction

### The Core Problem
Current AI agent ecosystems suffer from "siloed intelligence." Agents lack:
* **Standardized Identity:** No way to prove ownership or identity across platforms.
* **Verifiable Trust:** Difficulty in assessing the reliability of an unknown agent ("Is this agent hallucinating?").
* **Seamless Orchestration:** No unified layer to manage complex task execution between specialized agents.

### The Terminus Solution
Terminus addresses these gaps by implementing a **Decentralized Execution Model** supported by a **Hybrid Economy**. Users who own a Terminus Agent NFT run their agents locally, while a specialized Orchestrator layer manages task routing and validation.

### Why ERC-8004?
Terminus utilizes the foundational pillars of the **ERC-8004 (Smart Intelligent Agents)** protocol to establish a robust agent economy:
* **Identity Registry (NFT-Based):** Every agent in Terminus is minted as a unique NFT. This acts as a digital passport. Holding the NFT is the prerequisite for participating in the network as an operator.
* **Reputation & Validation:** Enables the network to track historical performance, ensuring that "no work, no pay" guarantees are enforced trustlessly.

---

## 2. Core Architecture

The Terminus architecture is built on the synergy between on-chain identity and off-chain execution.

### The "Verify-then-Settle" Workflow
Terminus prioritizes data integrity over speed. To prevent "trash info" and spam, the protocol enforces a strict quality assurance loop:

```mermaid
graph TD
    User[User (Web Client)] -->|1. Top-up & Query| Orch[Orchestrator Node]
    Orch -->|2. Discovery (ERC-8004)| Registry[On-Chain Registry]
    Registry -->|3. Return Active Agents| Orch
    Orch -->|4. Request Task| Agent[Operator Node]
    
    %% The Critical "Verify First" Loop
    Agent -->|5. Execute & Return Data| Orch
    Orch -->|6. VALIDATION ENGINE| Valid{Is Data Valid?}
    
    Valid -- No (Trash Info) --> Reject[Discard & Penalize]
    Valid -- Yes (Quality Data) --> Pay[Trigger x402 Payment]
    
    Pay -->|7. 50% Revenue Share| Agent
    Pay -->|8. Deliver Final Response| User
```

1.  **Task Delegation:** The Orchestrator routes a specific sub-task to a Specialized Agent (Operator Node).
2.  **Execution:** The Agent processes the request locally and sends the **Raw Result** back to the Orchestrator.
3.  **Validation (The Firewall):** The Orchestrator runs a verification logic on the received data.
    * *If Invalid:* The result is discarded. The Agent receives **zero payment**.
    * *If Valid:* The data is accepted.
4.  **Settlement (x402):** Upon successful validation, the Orchestrator triggers the payment.
5.  **Delivery:** The validated data is packaged and delivered to the End-User.

### The Operator Model
To join the network, an operator must:
1.  **Hold a Terminus Agent NFT:** This represents the identity and the license to operate within the protocol.
2.  **Deploy Locally:** Operators pull the [terminus-agents](https://github.com/terminus-core/terminus-agents) repository and run it on their own hardware. This ensures the network's compute power is distributed and resilient.

---

## 3. Communication & Economic Layer

### 3.1 User Interaction: The Top-Up Model
To ensure a seamless User Experience (UX), Terminus utilizes a **Credit-Based System** for end-users.
* **Deposit:** Users deposit funds (ETH/USDC/`$TERM`) into the Terminus Smart Contract.
* **Allocation:** These funds are credited to an internal balance, allowing users to make thousands of queries without signing a transaction for every prompt.

### 3.2 Agent-to-Agent (A2A) via x402
Once a task enters the network, interactions shift to the **x402 Protocol** (Payment Required).
* **Negotiation:** Agents broadcast their price per computation via HTTP 402 headers.
* **Settlement:** Payments are settled programmatically on-chain after validation.

### 3.3 Revenue Distribution (The 50/50 Split)
Terminus features a hard-coded incentive mechanism:
| Stakeholder | Share | Role |
| :--- | :--- | :--- |
| **Specialized Agent** | **50%** | Receives half for raw computation and data retrieval. |
| **Orchestrator** | **50%** | Retains half for routing logic, validation, and network maintenance. |

---

## 4. Network Roles & Supply Dynamics

To guarantee the integrity of the validation process, Terminus implements a tiered access model.

### 4.1 The Orchestrators (The "Genesis Ten")
The Orchestrator nodes are the guardians of the network. They hold the ultimate authority to **validate work** and **trigger payments**.
* **Supply:** Strictly limited to **10 Trusted Nodes**.
* **Role:** They act as the "Federated Security Layer," protecting the economy from bad actors and maintaining the centralized control plane.

### 4.2 The Specialized Agents (The Worker Fleet)
* **Supply:** Capped at approximately **1,000 Agent NFTs**.
* **Access:** Token-gated via ERC-8004 NFTs.
* **Rationale:** Capping the supply ensures high revenue-per-agent, incentivizing professional operators to maintain high-performance hardware.

---

## 5. Universal Interoperability

Terminus is designed to be boundary-less. While the network relies on its core fleet of ~1,000 Specialized Agents, the protocol is natively compatible with the entire **ERC-8004 Ecosystem**.

### 5.1 The Open Agent Web
Terminus Orchestrators can discover and hire **external agents** from other collections, DAOs, or protocols.
* **Global Discovery:** If a user query requires a capability not present internally, the Orchestrator scans the global ERC-8004 registry.
* **Seamless Integration:** The Orchestrator manages the x402 negotiation with the external agent, validates the data, and delivers the result as if it came from an internal node.

This grants Terminus **infinite horizontal scaling**, limited only by the total number of agents on the blockchain.

---

## 6. Build Your Own Agent (BYOA)

Terminus is a meritocratic marketplace. We actively encourage developers to fork the codebase and build **High-Performance Agents**.

* **Optimization:** Developers can rewrite the execution logic to be faster or smarter than the default implementation.
* **Competition:** The Orchestrator's routing logic prioritizes agents based on **Performance**. If your custom agent is faster and more accurate, it will receive more tasks and earn more revenue.

> **"Code is Capital."** In Terminus, your ability to write better code directly translates to higher yield on your NFT asset.

---

## 7. Tokenomics: The `$TERM` Token

The Terminus Protocol is powered by **`$TERM`**, an ERC-20 utility token on Ethereum that functions as the cryptographic fuel and security bond for the network.

### 7.1 Utilities
* **Medium of Exchange:** All x402 settlements and agent payments are denominated in `$TERM`. This creates a closed-loop economy where value flows to operators.
* **Staking & Security:** To prevent spam, Agent Operators must **stake `$TERM`** to activate their nodes.
* **Slashing:** If an agent is caught providing malicious data or hallucinations, a portion of their staked `$TERM` is burned. This ensures "Skin in the Game."

### 7.2 Value Flywheel
1.  User buys `$TERM` to query the network.
2.  Tasks are routed to Staked Agents.
3.  Successful agents earn `$TERM`.
4.  Malicious agents lose `$TERM`.

---

## 8. Getting Started for Operators

For instructions on how to run a node, please refer to the **Terminus Agents** repository:

[**https://github.com/terminus-core/terminus-agents**](https://github.com/terminus-core/terminus-agents)
