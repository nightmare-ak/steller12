import {
  nativeToScVal,
  scValToNative,
  Address,
} from "@stellar/stellar-sdk";

// --- ScVal converters (for manual contract calls) ---
// Booleans, numbers, and strings are auto-detected by nativeToScVal.
// Use explicit types only when you need a specific type (e.g., u32 vs u64).

export function toScValString(v: string) {
  return nativeToScVal(v, { type: "string" });
}

export function toScValSymbol(v: string) {
  return nativeToScVal(v, { type: "symbol" });
}

export function toScValU32(v: number) {
  return nativeToScVal(v, { type: "u32" });
}

export function toScValU64(v: bigint | number) {
  return nativeToScVal(v, { type: "u64" });
}

export function toScValI128(v: bigint | number | string) {
  return nativeToScVal(v, { type: "i128" });
}

export function toScValAddress(v: string) {
  return new Address(v).toScVal();
}

export function fromScVal(v: any): any {
  return scValToNative(v);
}

// --- Address formatting ---

export function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// --- Game helpers ---

export function formatScore(score: number): string {
  return score.toLocaleString();
}
