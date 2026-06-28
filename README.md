NEXT_PUBLIC_CONTRACT_ADDRESS=CABX5FTHFQ3AKJP575FRJRGSCO4J5Y3QOL5HF7OTY3YPMJ65AAFKUOT6
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015

# Stellar Racer 🚀

A space-themed dodge-and-survive arcade game where your high scores are permanently recorded on the **Stellar blockchain** via a **Soroban smart contract**.

Navigate your ship through an asteroid field at lightspeed. The longer you survive, the higher your score. Connect your **Freighter** wallet to submit scores, compete on the global leaderboard, and earn token rewards.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Client                        │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Canvas   │  │ Freighter    │  │  Leaderboard UI   │  │
│  │  Game     │◀─┤ Wallet       │──┤  + Player Stats   │  │
│  │ (dodge)   │  │ Integration  │  │                   │  │
│  └──────────┘  └──────┬───────┘  └────────┬──────────┘  │
│                       │                    │              │
│              ┌────────▼────────────────────▼──────────┐  │
│              │         hooks/contract.ts               │  │
│              │    (Typed Client via Stellar SDK)        │  │
│              └────────────────┬───────────────────────┘  │
└───────────────────────────────┼─────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │   Stellar RPC Node    │
                    │  (Soroban Testnet)    │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │  Soroban Smart Contract│
                    │   (Rust / soroban-sdk) │
                    └───────────────────────┘
```

## Smart Contract

The contract is written in Rust using `soroban-sdk v25` and deployed on Stellar's **Soroban** runtime. It lives in `contract/contracts/contract/`.

### Contract Functions

| Function | Auth | Description |
|---|---|---|
| `init` | — | Initialize contract with admin address and reward token |
| `submit_score` | `player` | Submit a score. Only updates if higher than previous best |
| `get_score` | — | Get a player's best score |
| `get_leaderboard` | — | Get the top N leaderboard entries (sorted descending) |
| `get_total_players` | — | Total number of unique players who have submitted |
| `get_rank` | — | Get a player's rank (1-based). Returns 0 if not found |
| `get_player_stats` | — | Convenience: score + rank + total players in one call |
| `claim_reward` | `player` | Permissionless — claim a token reward if in top N |
| `reward_top_players` | `admin` | Admin-only — reward every player in the top N |
| `get_reward_token` | — | Get the configured reward token address |

### Key Types

```rust
struct Entry {
    player: Address,
    score: u64,
}

struct PlayerStats {
    score: u64,
    rank: u32,
    total_players: u32,
}
```

## Client

Built with **Next.js**, **TailwindCSS**, **@stellar/stellar-sdk**, and **@stellar/freighter-api**.

### Features

- **Canvas-based spaceship game** — dodge procedurally generated asteroids with a parallax starfield, nebula effects, and smooth ship controls (mouse/touch)
- **Freighter wallet integration** — connect your Stellar wallet with a robust connection flow
- **On-chain score submission** — scores are submitted to the Soroban contract and stored on Stellar
- **Live leaderboard** — top 10 players displayed with a space-themed UI; auto-refreshes every 15 seconds
- **Player stats** — personal best score and rank visible when connected

### Environment Variables (`.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | Deployed Soroban contract address (C...) |
| `NEXT_PUBLIC_RPC_URL` | Stellar RPC URL (defaults to Soroban Testnet) |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | Network passphrase (defaults to Testnet) |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) (v20+)
- [Bun](https://bun.sh) (package manager)
- [Rust](https://rustup.rs) (for contract development)
- [Freighter Wallet](https://freighter.app) browser extension

### Client

```bash
cd client
bun install
bun run dev
```

The app runs at `http://localhost:3000`.

### Contract

```bash
cd contract
cargo test                           # Run tests
cargo build --target wasm32v1-none   # Build for Soroban deployment
stellar contract deploy \
  --wasm target/wasm32v1-none/release/contract.wasm \
  --source-account <KEY> \
  --network testnet
```

### Deploy & Connect

1. Deploy the contract and note its `C...` address
2. Set `NEXT_PUBLIC_CONTRACT_ADDRESS` in `client/.env.local`
3. Start the client and connect your Freighter wallet to submit scores

## Tech Stack

- **Blockchain**: [Stellar](https://stellar.org) / [Soroban](https://soroban.stellar.org)
- **Smart Contract**: Rust, `soroban-sdk v25`
- **Frontend**: Next.js, React, TypeScript, TailwindCSS
- **Wallet**: Freighter API
- **SDK**: @stellar/stellar-sdk v16

## License

MIT
