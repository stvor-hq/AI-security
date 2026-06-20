# Stvor Cloud
### Post-Quantum, End-to-End Encrypted Agentic Commerce

> The only ERC-8183 implementation where **funds and secrets are both provably secure** —
> against classical attackers today and quantum computers tomorrow.

[![Tests](https://img.shields.io/badge/tests-23%20passing-brightgreen)]()
[![PQC](https://img.shields.io/badge/crypto-ML--KEM--768-blue)]()
[![ElizaOS](https://img.shields.io/badge/ElizaOS-plugin%20compatible-purple)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

## The problem

Every existing agent commerce system has the same flaw: sensitive payloads — prompts, API keys, deliverables — travel in plaintext or under classical encryption that quantum computers will break. ERC-8183 defines the protocol, but not the security. Stvor Cloud adds it.

## What makes us different

| | Classical agent systems | Stvor Cloud |
|--|--|--|
| Prompt security | Plaintext in logs | ML-KEM-768 + AES-256-GCM |
| Quantum resistance | ❌ ECDSA/Ed25519 broken by Shor's | ✅ ML-KEM-768 (NIST FIPS 203) |
| Ledger data | Full payload stored | SHA-256 hash only |
| Prompt injection | Unprotected | SecurityGuard runtime filter |
| ElizaOS | Not compatible | Drop-in plugin |
| Demo | README only | `bun start:demo` — live, cinematic |

## Quick start

```bash
./install.sh
bun start:demo
```

## Architecture

```
Client (Alice)                       PQC Relay (mock, in-process)              Provider (Bob)
---------------                      -------------------------                 ---------------
  createJob()  ── lock funds ──▶  ERC-8183 Ledger (hashes only)  ──▶  submit deliverable hash
      │                                     ▲                                      │
      │ send encrypted prompt              │ receive attestations                    │
      └─▶ encrypt via HybridPQCTransport ─▶ relay ──▶ decrypt ──▶ SecurityGuard ──▶ execute
          @noble/curves X25519
          @noble/post-quantum ML-KEM-768
          @noble/ciphers AES-256-GCM
```

```
src/
├── core/
│   ├── security.ts                # SecurityGuard prompt-injection filter
│   ├── types.ts                   # ERC-8183 state types
│   └── runtime.ts                 # Runtime wiring
├── plugins/
│   └── agent-commerce/
│       ├── elizaos/               # 4 actions, 1 provider, 1 evaluator
│       ├── state-machine.ts       # OPEN → FUNDED → SUBMITTED → COMPLETE/REFUND
│       ├── lifecycle.ts           # ERC-8183 event bridge
│       └── index.ts               # AgentCommercePlugin + MemoryJobStore
├── transport/
│   ├── pqc.ts                     # HybridPQCTransport + PayloadHasher
│   └── mock-relay.ts              # In-process relay for demo/tests
└── demo.ts                        # Cinematic Hermes hackathon story
```

## Cryptography

Stvor Cloud uses a narrow, auditable crypto stack:

- ML-KEM-768: `@noble/post-quantum` — NIST FIPS 203, 128-bit quantum security
- X25519: `@noble/curves` — classical key exchange
- AES-256-GCM: `@noble/ciphers` — authenticated symmetric encryption
- SHA-256: `@noble/hashes` — ledger attestation
- Hybrid secret: `SHA-256(X25519_secret ∥ ML-KEM_secret)` — both must be broken to decrypt

The relay sees ciphertext, IV, ephemeral X25519 public key, and ML-KEM ciphertext. It does not receive the hybrid secret and cannot decrypt payloads.

## ElizaOS integration

Install the package and add the plugin to an ElizaOS character:

```json
{
  "dependencies": {
    "@elizaos/plugin-agent-commerce": "github:stvor-hq/cloud"
  }
}
```

```json
{
  "name": "StvorAgent",
  "plugins": ["@elizaos/plugin-agent-commerce"],
  "settings": {
    "STVOR_RELAY_URL": "http://localhost:4444"
  }
}
```

The plugin exports `agentCommercePlugin` with 4 actions, 1 provider, and 1 evaluator. A ready character file is included at `characters/stvor-agent.character.json`.

## Test results

```text
bun test tests/crypto.test.ts          5 passed
bun test tests/commerce-flow.test.ts  12 passed
bun test tests/elizaos-plugin.test.ts  6 passed
─────────────────────────────────────────────────
Total                                 23 passed
```

## Roadmap

- [ ] Production Stvor relay (replace mock)
- [ ] On-chain reputation oracle (Solana)
- [ ] Persistent storage (SQLite/PGLite)

## Built for

Hermes AI Agent Hackathon — ERC-8183 track
