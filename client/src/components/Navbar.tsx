"use client";

import { truncateAddress } from "@/lib/utils";

interface NavbarProps {
  walletAddress: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export default function Navbar({
  walletAddress,
  isConnected,
  isConnecting,
  onConnect,
  onDisconnect,
}: NavbarProps) {
  return (
    <nav className="relative z-50 flex items-center justify-between px-6 py-3 border-b border-purple-900/20 bg-[#05030a]/80 backdrop-blur-md">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="relative w-9 h-9 flex items-center justify-center">
          <svg viewBox="0 0 40 40" className="w-full h-full text-cyan-400">
            <defs>
              <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
            <polygon
              points="20,2 8,36 20,28 32,36"
              fill="url(#logo-grad)"
              opacity="0.85"
            />
            <polygon
              points="20,6 12,32 20,26 28,32"
              fill="url(#logo-grad)"
              opacity="0.25"
            />
          </svg>
          {/* Glow dot */}
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.6)]" />
        </div>
        <div>
          <span className="text-base font-bold tracking-wider text-white">
            STELLAR RACER
          </span>
          <span className="block text-[8px] tracking-[0.3em] text-cyan-500/40 uppercase">
            Soroban Arcade
          </span>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {isConnected && walletAddress ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-cyan-900/20">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
              <span className="text-xs font-mono text-zinc-400">
                {truncateAddress(walletAddress)}
              </span>
            </div>
            <button
              onClick={onDisconnect}
              className="text-[10px] text-zinc-700 hover:text-zinc-500 tracking-wider uppercase transition-colors"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={onConnect}
            disabled={isConnecting}
            className="px-4 py-1.5 bg-gradient-to-r from-purple-600/60 to-cyan-600/60 text-white text-xs font-semibold rounded-lg tracking-widest uppercase hover:from-purple-500 hover:to-cyan-500 disabled:opacity-40 transition-all shadow-[0_0_15px_rgba(168,85,247,0.05)] hover:shadow-[0_0_25px_rgba(168,85,247,0.15)]"
          >
            {isConnecting ? "⟳ SYNC" : "⟡ CONNECT"}
          </button>
        )}
      </div>
    </nav>
  );
}
