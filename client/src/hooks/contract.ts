"use client";

import { Client } from "contract";
import { TransactionBuilder, rpc } from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";

// ─── Configuration ────────────────────────────────────────
export const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ||
  "Test SDF Network ; September 2015";

// ─── Typed Client ─────────────────────────────────────────

/** Get a typed Client instance with the given caller address for simulation. */
function getClient(callerAddress?: string): Client {
  return new Client({
    rpcUrl: RPC_URL,
    networkPassphrase: NETWORK_PASSPHRASE,
    contractId: CONTRACT_ADDRESS,
    publicKey: callerAddress,
  });
}

// ─── Sign & Send Transaction ──────────────────────────────

const server = new rpc.Server(RPC_URL);

async function signAndSend(txXdr: string): Promise<string> {
  const result = await signTransaction(txXdr, {
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  if (result.error) {
    throw new Error(result.error.message || "User rejected signing");
  }

  const tx = TransactionBuilder.fromXDR(result.signedTxXdr, NETWORK_PASSPHRASE);
  const sendResult = await server.sendTransaction(tx);

  if (sendResult.status === "PENDING" || sendResult.status === "DUPLICATE") {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const getResult = await server.getTransaction(sendResult.hash);
      const txStatus = "status" in getResult ? getResult.status : "";
      if (txStatus === "SUCCESS") {
        return sendResult.hash;
      }
      if (txStatus === "FAILED") {
        throw new Error(`Transaction failed`);
      }
    }
    throw new Error("Transaction timeout");
  }
  throw new Error(
    `Send failed: ${
      sendResult.errorResult ? "transaction rejected" : sendResult.status
    }`
  );
}

// ─── State-changing calls ─────────────────────────────────

export async function submitScore(
  callerAddress: string,
  score: number
): Promise<string> {
  if (!CONTRACT_ADDRESS) throw new Error("Contract not deployed yet");

  const client = getClient(callerAddress);

  // Build and simulate via the typed client
  const tx = await client.submit_score({
    player: callerAddress,
    score: BigInt(score),
  });

  // Sign & send using Freighter
  return signAndSend(tx.toXDR());
}

// ─── Read-only calls ──────────────────────────────────────

export async function getScore(playerAddress: string): Promise<number> {
  if (!CONTRACT_ADDRESS) return 0;

  try {
    const client = getClient(playerAddress);
    const tx = await client.get_score({ player: playerAddress });
    return Number(tx.result);
  } catch {
    return 0;
  }
}

export interface LeaderboardEntry {
  player: string;
  score: number;
}

export async function getLeaderboard(
  topN: number = 10
): Promise<LeaderboardEntry[]> {
  if (!CONTRACT_ADDRESS) return [];

  try {
    const client = getClient();
    const tx = await client.get_leaderboard({ top_n: topN });
    return tx.result.map((entry) => ({
      player: entry.player,
      score: Number(entry.score),
    }));
  } catch {
    return [];
  }
}

export async function getRewardToken(): Promise<string> {
  if (!CONTRACT_ADDRESS) return "";

  try {
    const client = getClient();
    const tx = await client.get_reward_token();
    return tx.result;
  } catch {
    return "";
  }
}
