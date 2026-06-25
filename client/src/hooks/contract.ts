"use client";

import {
  rpc,
  TransactionBuilder,
  Contract,
  scValToNative,
} from "@stellar/stellar-sdk";

// ─── Configuration ────────────────────────────────────────
// Set these after deploying the contract
export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ||
  "Test SDF Network ; September 2015";

// ─── Helpers ──────────────────────────────────────────────

import {
  toScValU32,
  toScValU64,
  toScValAddress,
} from "@/lib/utils";

const server = new rpc.Server(RPC_URL);

export interface LeaderboardEntry {
  player: string;
  score: number;
}

// ─── Sign & Send Transaction ──────────────────────────────

async function signAndSend(
  txXdr: string,
  networkPassphrase: string = NETWORK_PASSPHRASE
): Promise<string> {
  const { signedTxXdr } = await window.freighterApi.signTransaction(txXdr, {
    networkPassphrase,
  });
  const tx = TransactionBuilder.fromXDR(signedTxXdr, networkPassphrase);
  const sendResult = await server.sendTransaction(tx);
  if (sendResult.status === "PENDING" || sendResult.status === "DUPLICATE") {
    // Wait for confirmation
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
  throw new Error(`Send failed: ${sendResult.errorResult ? "transaction rejected" : sendResult.status}`);
}

// ─── State-changing calls ─────────────────────────────────

export async function submitScore(
  callerAddress: string,
  score: number
): Promise<string> {
  if (!CONTRACT_ADDRESS) throw new Error("Contract not deployed yet");

  const account = await server.getAccount(callerAddress);
  const contract = new Contract(CONTRACT_ADDRESS);
  const tx = new TransactionBuilder(account, {
    fee: "10000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("submit_score", toScValAddress(callerAddress), toScValU64(score)))
    .setTimeout(30)
    .build();

  const simulateResult = await server.simulateTransaction(tx);
  if (!("result" in simulateResult) || !simulateResult.result) {
    throw new Error(`Simulation failed: ${JSON.stringify(simulateResult)}`);
  }

  const assembled = rpc.assembleTransaction(tx, simulateResult).build();
  return signAndSend(assembled.toXDR());
}

// ─── Read-only calls ──────────────────────────────────────

export async function getScore(playerAddress: string): Promise<number> {
  if (!CONTRACT_ADDRESS) return 0;

  try {
    const contract = new Contract(CONTRACT_ADDRESS);
    const result = await server.simulateTransaction(
      new TransactionBuilder(await server.getAccount(playerAddress), {
        fee: "10000",
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call("get_score", toScValAddress(playerAddress))
        )
        .setTimeout(30)
        .build()
    );

    if ("result" in result && result.result?.retval) {
      return Number(scValToNative(result.result.retval));
    }
    return 0;
  } catch {
    return 0;
  }
}

export async function getLeaderboard(
  topN: number = 10
): Promise<LeaderboardEntry[]> {
  if (!CONTRACT_ADDRESS) return [];

  try {
    // Use a public address for read-only calls
    const publicKey =
      "GBRUNOVGQNA6D6YKXJD3W6P7PI5L5G7FOJYSFX6KQYIN7P5GMEAAAAAAAA";
    const contract = new Contract(CONTRACT_ADDRESS);
    const result = await server.simulateTransaction(
      new TransactionBuilder(await server.getAccount(publicKey), {
        fee: "10000",
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(contract.call("get_leaderboard", toScValU32(topN)))
        .setTimeout(30)
        .build()
    );

    if ("result" in result && result.result?.retval) {
      const vec = scValToNative(result.result.retval) as any[];
      return vec.map((entry: any) => ({
        player: entry.player as string,
        score: Number(entry.score),
      }));
    }
    return [];
  } catch {
    return [];
  }
}

export async function getRewardToken(): Promise<string> {
  if (!CONTRACT_ADDRESS) return "";

  try {
    const publicKey =
      "GBRUNOVGQNA6D6YKXJD3W6P7PI5L5G7FOJYSFX6KQYIN7P5GMEAAAAAAAA";
    const contract = new Contract(CONTRACT_ADDRESS);
    const result = await server.simulateTransaction(
      new TransactionBuilder(await server.getAccount(publicKey), {
        fee: "10000",
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(contract.call("get_reward_token"))
        .setTimeout(30)
        .build()
    );

    if ("result" in result && result.result?.retval) {
      return scValToNative(result.result.retval) as string;
    }
    return "";
  } catch {
    return "";
  }
}

// ─── Wallet interaction helper ───────────────────────────

// Freighter types
declare global {
  interface Window {
    freighterApi: {
      isConnected(): Promise<{ isConnected: boolean }>;
      isAllowed(): Promise<{ isAllowed: boolean }>;
      setAllowed(): Promise<{ isAllowed: boolean }>;
      getAddress(): Promise<{ address: string }>;
      signTransaction(
        xdr: string,
        opts: { networkPassphrase: string }
      ): Promise<{ signedTxXdr: string }>;
    };
  }
}
