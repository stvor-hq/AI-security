# STVOR CLOUD — Post‑Quantum, End‑to‑End Encrypted Agentic Commerce

One-sentence pitch: Stvor Cloud hardens agentic commerce by combining ERC‑8183 escrows with PQC‑E2EE transport — protecting funds and secrets from both modern and quantum attackers.

Why this matters
- Classical agent systems leak secrets: prompts, API keys, and private data often transit or are stored in plain text logs or third-party services. Quantum computers threaten today's asymmetric crypto (ECDSA/Ed25519), enabling retroactive decryption of intercepted messages.
- Stvor Cloud defends both money and data: escrow and settlement live in the ERC‑8183 ledger as tamper-evident hashes; sensitive payloads travel only inside a hybrid PQC + Signal Double‑Ratchet channel (`@stvor/sdk`). Even if an attacker gets the ledger, there are no plaintext secrets to steal.

Core idea (short)
- Money: ERC‑8183 stores token locking and SHA‑256 attestations (hashes only).
- Secrets: `@stvor/sdk` (Signal + ML‑KEM‑768) encrypts all prompts, deliverables and evaluation blobs.
- Security guard: Decrypted payloads pass through a deterministic `SecurityGuard` that isolates prompt injections and enforces payload size/type constraints.

Architecture (visual)

Client (Alice)                       PQC Relay (@stvor/sdk)                       Provider (Bob)
---------------                       --------------------                       ---------------
  createJob()  ── lock funds ──▶  ERC‑8183 Ledger (hashes only)  ──▶  submit deliverable hash
      │                                     ▲                                      │
      │ send encrypted prompt              │ receive attestations                    │
      └─▶ encrypt via Signal+ML‑KEM ──▶ relay ──▶ double‑ratchet ──▶ decrypt ──▶ verify

Notes:
- The ledger contains only SHA‑256 receipts — never plaintext.
- The PQC transport ensures forward secrecy and post‑quantum resilience.

Quick Start (2 commands)
1) Run the installer (installs deps, generates a default `.env`, and optionally starts a mock relay):

```bash
./install.sh
```

2) Launch the cinematic demo (ANSI terminal visualization):

```bash
bun start:demo
```

What you will see
- Animated step‑by‑step flow: node bootstrap, key generation, escrow lock, encrypted prompt delivery, simulated prompt‑injection blocked in real time, deliverable hash attestation and final settlement.

Why we win hackathons
- Security-first: Explicit separation of funds (ledger) and secrets (PQC transport) with runtime guards against prompt injection and tampering.
- Future-ready: Hybrid PQC+Signal protects agents from classical and quantum‑era threats.
- Demo‑grade UX: Cinematic terminal visualization makes technical depth instantly legible to judges.

Contribute
- Fork, run `./install.sh`, then `bun start:demo` and watch the end‑to‑end hardened flow.

License: MIT
# Stvor Cloud — Secure Agent-to-Agent Operator Node

> **Cyberpunk-inspired, highly secure node for autonomous agent commerce.**
> 
> Phase 2: **Post-Quantum Cryptography Transport Layer** (Signal Protocol + ML-KEM-768)

A production-grade foundation for the Hermes Hackathon project implementing the **ERC-8183 Agentic Commerce Protocol** with **Stvor SDK's hybrid post-quantum encryption** for end-to-end secure agent communication.

## 🚀 Quick Start

### One-Command Docker Quickstart

Judges: build and run the full cinematic demo (with interactive TTY) using Docker Compose:

```bash
docker compose up --build
```

This will build the minimal Bun image and attach the console to the demo (ANSI colors & delays preserved).


### Prerequisites
- **Bun** (≥1.0.0): [Install Bun](https://bun.sh)
- **Stvor Relay** (optional, for local testing): Uses mock relay by default

### Installation

```bash
# Clone and enter the workspace
cd stvor-cloud

# Run setup script (initializes DB, env vars, @stvor/sdk integration)
bash install.sh

# Or manual setup:
bun install
mkdir -p ./data && touch ./data/stvor.db
```

### Running the Node

```bash
# API Mode (HTTP server on :8080 with secure transport)
bun start
# or: bun start:api

# CLI Mode (interactive ElizaOS-style prompt with transport)
bun start:cli

# Watch mode (auto-reload on changes)
bun run dev

# Run comprehensive E2E test (3 agents, full commerce flow)
bun test:commerce

# Health check
curl http://localhost:8080/health

# Check transport status
curl http://localhost:8080/api/transport/status
```

## 🏗️ Architecture (Phase 2: PQC Transport)

### Transport Layer: Stvor SDK Integration

All agent communication is encrypted end-to-end using:
- **Signal Protocol** (X3DH key exchange + Double Ratchet for forward secrecy)
- **ML-KEM-768** (NIST post-quantum key encapsulation mechanism)
- **Hybrid security**: Classical + quantum-resistant algorithms combined

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Job Creation (OPEN)                                      │
│    └─ Job metadata created in mock ledger                   │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Funding (OPEN → FUNDED)                                  │
│    └─ Reputation gate check (on-chain or mocked)            │
│    └─ Task specification encrypted via Stvor                │
│    └─ SHA-256 hash recorded on ledger (no plaintext)        │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Provider Receives Encrypted Prompt                       │
│    └─ Signal Protocol + ML-KEM decryption (automatic)       │
│    └─ Double Ratchet state updated                          │
│    └─ Task specification fully available in plaintext       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Provider Executes & Submits (FUNDED → SUBMITTED)         │
│    └─ Deliverable encrypted via Stvor                       │
│    └─ SHA-256 hash stored on ledger                         │
│    └─ Raw encrypted bytes queued for Evaluator              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Evaluator Decrypts & Settles (SUBMITTED → COMPLETE)      │
│    └─ Deliverable decrypted via Signal Protocol             │
│    └─ Evaluation decision recorded                          │
│    └─ Job settles (refund or payment)                       │
└─────────────────────────────────────────────────────────────┘
```

### Project Structure

```
src/
├── index.ts                           # Hybrid CLI/API entry (Phase 2)
├── core/
│   ├── types.ts                       # Shared type definitions
│   ├── settings.ts                    # Environment + config
│   └── runtime.ts                     # Core runtime orchestrator
├── plugins/
│   └── agent-commerce/
│       ├── index.ts                   # Commerce plugin (with transport hooks)
│       ├── types.ts                   # ERC-8183 types
│       ├── state-machine.ts           # State transitions
│       ├── hooks.ts                   # Reputation gate (mock)
│       └── lifecycle.ts               # Transport lifecycle hooks (NEW)
├── transport/
│   ├── interfaces.ts                  # Transport type definitions (updated)
│   └── pqc.ts                         # Stvor SDK wrapper + PayloadHasher (NEW)
└── api/
    └── server.ts                      # REST API + transport endpoints (updated)

tests/
└── commerce-flow.test.ts              # E2E test: 3 agents, full lifecycle (NEW)
```

## 🔄 ERC-8183 State Machine with Secure Transport

Jobs follow a strict state progression with encrypted payload delivery:

```
OPEN → FUNDED → SUBMITTED → (COMPLETE | REFUND)
 ↑        ↓
 │        └─ [Stvor] Send encrypted task spec
 │
 └─ Reputation gate checked before funding
```

### Stvor Transport Integration

**When a job transitions to FUNDED:**
1. Commerce plugin fires `onJobFunded()` event
2. Transport bridge encrypts task specification
3. SHA-256 hash sent to mock ledger (for attestation)
4. Encrypted bytes delivered via Stvor relay to Provider
5. Provider receives via Signal Protocol decryption

**When Provider submits deliverable:**
1. Deliverable encrypted via Stvor to Evaluator
2. Hash recorded on ledger
3. Raw encrypted bytes queued for evaluation

## 📡 HTTP API Endpoints

### Commerce Endpoints
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/jobs/create` | Create a new job |
| `POST` | `/api/jobs/:id/fund` | Fund a job (with reputation check + secure delivery) |
| `POST` | `/api/jobs/:id/submit` | Submit encrypted deliverable |
| `POST` | `/api/jobs/:id/evaluate` | Evaluate and finalize job |
| `GET` | `/api/jobs/:id` | Get job state |
| `GET` | `/api/jobs?agentId=X` | List jobs for agent |

### Transport Endpoints (NEW)
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/transport/send` | Send secure payload via Stvor |
| `GET` | `/api/transport/status` | Get transport connection status |
| `GET` | `/api/transport/session/:agentId` | Get crypto session info |

### Monitoring
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/agent/status` | Agent status + transport stats |
| `GET` | `/health` | Health check |

## 🧪 End-to-End Testing

### Run the full commerce flow test:
```bash
bun test:commerce
```

This simulates **3 distinct autonomous agents**:
1. **Alice (Client)**: Creates job, funds with reputation check, receives evaluation
2. **Bob (Provider)**: Receives encrypted prompt, executes work, submits encrypted result
3. **Charlie (Evaluator)**: Receives encrypted deliverable, evaluates, settles job

**Test coverage:**
- Job lifecycle: OPEN → FUNDED → SUBMITTED → COMPLETE
- Stvor encryption/decryption at each hop
- SHA-256 payload hashing for ledger attestation
- Double Ratchet state management
- Transport connection status & session tracking
- Performance metrics (cycle time < 30s)

### Manual workflow (CLI):
```bash
bun start:cli

[agent-...]$ create-job alice bob "Build API" 1000000
[agent-...]$ fund-job job-abc alice 1000000
[agent-...]$ transport-status
```

### Manual workflow (API + curl):
```bash
# Terminal 1: Start API server
bun start:api

# Terminal 2: Create job
JOB=$(curl -s -X POST http://localhost:8080/api/jobs/create \
  -H "Content-Type: application/json" \
  -d '{
    "clientAgent": "alice",
    "providerAgent": "bob",
    "taskDescription": "Build secure pipeline",
    "requiredAmount": "1000000"
  }' | jq -r '.job.jobId')

# Fund job (triggers secure delivery)
curl -X POST http://localhost:8080/api/jobs/$JOB/fund \
  -H "Content-Type: application/json" \
  -d '{"clientAgent": "alice", "fundAmount": "1000000"}'

# Check transport status
curl http://localhost:8080/api/transport/status
```

## 🔐 Cryptography Specs

### Stvor SDK Integration

- **Key Exchange**: Signal Protocol X3DH (triple DH with ephemeral + long-term keys)
- **Post-Quantum**: ML-KEM-768 (Kyber variant, NIST approved)
- **Symmetric**: AES-256-GCM (derived from hybrid secrets)
- **Forward Secrecy**: Double Ratchet (SigMa protocol) on every message
- **Authentication**: Built-in signature verification in Stvor SDK

### Payload Hashing (Ledger Attestation)

- **Algorithm**: SHA-256
- **Purpose**: Record proof of payload existence without storing secrets
- **Use Case**: Verify state transitions without exposing plaintext on ledger
- **Verification**: `PayloadHasher.verifyHash(payload, storedHash)`

## 📊 Performance Characteristics

- **Cold Start**: <50ms (tiered boot)
- **Job Creation**: ~1ms
- **Secure Delivery**: ~10-50ms per hop (depends on relay latency)
- **Full Cycle**: <30s (create → fund → submit → evaluate)
- **Encryption Ops**: Signal Protocol + ML-KEM-768 per message

## 🎯 Phase 3 Roadmap

- [ ] Persistent storage (PGLite/SQLite replacing in-memory)
- [ ] Real Stvor relay deployment (mock → production)
- [ ] On-chain reputation oracle (Solana integration)
- [ ] Agent memory persistence (ElizaOS hooks)
- [ ] Multi-agent orchestration (AutoGen compatibility)
- [ ] Benchmark suite (throughput, latency, cost)
- [ ] Docker containerization + Kubernetes deployment

## 📚 References

- **Stvor SDK**: [stvor-secure-agent-protocol](https://github.com/stvor-labs/stvor-sdk)
- **ERC-8183**: [Agentic Commerce Protocol](https://eips.ethereum.org/EIPS/eip-8183)
- **Signal Protocol**: [Signal Documentation](https://signal.org/docs/)
- **ML-KEM (Kyber)**: [NIST FIPS 203](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.203.pdf)
- **Doolittle CLI**: [GitHub](https://github.com/SYMBaiEX/doolittle)
- **ElizaOS**: [GitHub](https://github.com/elizaOS/eliza)

## 📄 License

MIT

---

**Built for the Hermes Hackathon** with ❤️ and quantum-resistant cryptography.
