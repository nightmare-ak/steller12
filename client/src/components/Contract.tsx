"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useWallet } from "@/hooks/useWallet";
import {
  submitScore,
  getScore,
  getLeaderboard,
  CONTRACT_ADDRESS,
  LeaderboardEntry,
} from "@/hooks/contract";
import { truncateAddress, formatScore } from "@/lib/utils";

// ─── Space Background (CSS stars canvas) ───────────────────

function SpaceBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Generate stars with depth layers
    const stars: {
      x: number;
      y: number;
      size: number;
      brightness: number;
      speed: number;
      twinkleSpeed: number;
      twinkleOffset: number;
    }[] = [];
    for (let i = 0; i < 400; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: 0.5 + Math.random() * 2.5,
        brightness: 0.3 + Math.random() * 0.7,
        speed: 0.02 + Math.random() * 0.08,
        twinkleSpeed: 0.01 + Math.random() * 0.03,
        twinkleOffset: Math.random() * Math.PI * 2,
      });
    }

    let animId = 0;
    let frame = 0;

    const draw = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Nebula glow
      const neb1 = ctx.createRadialGradient(
        canvas.width * 0.3,
        canvas.height * 0.4,
        0,
        canvas.width * 0.3,
        canvas.height * 0.4,
        canvas.width * 0.5
      );
      neb1.addColorStop(0, "rgba(124, 58, 237, 0.06)");
      neb1.addColorStop(0.5, "rgba(0, 240, 255, 0.03)");
      neb1.addColorStop(1, "transparent");
      ctx.fillStyle = neb1;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const neb2 = ctx.createRadialGradient(
        canvas.width * 0.7,
        canvas.height * 0.7,
        0,
        canvas.width * 0.7,
        canvas.height * 0.7,
        canvas.width * 0.4
      );
      neb2.addColorStop(0, "rgba(236, 72, 153, 0.04)");
      neb2.addColorStop(1, "transparent");
      ctx.fillStyle = neb2;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Stars
      for (const star of stars) {
        const twinkle =
          Math.sin(frame * star.twinkleSpeed + star.twinkleOffset) * 0.3 + 0.7;
        const alpha = star.brightness * twinkle;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}

// ─── Game Canvas Component ────────────────────────────────

function GameCanvas({
  onScoreUpdate,
  onGameOver,
  isPlaying,
  startGame,
}: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gs = useRef({
    shipX: 250,
    shipY: 540,
    shipWidth: 34,
    shipHeight: 28,
    obstacles: [] as {
      x: number;
      y: number;
      size: number;
      speed: number;
      rot: number;
      rotSpeed: number;
    }[],
    score: 0,
    gameOver: false,
    animId: 0,
    frame: 0,
    spawnTimer: 0,
    mouseX: 250,
    // Parallax starfield
    stars: [] as { x: number; y: number; size: number; speed: number; bright: number }[],
  });

  // Initialize stars once
  useEffect(() => {
    const stars = gs.current.stars;
    if (stars.length === 0) {
      for (let i = 0; i < 120; i++) {
        stars.push({
          x: Math.random() * 500,
          y: Math.random() * 600,
          size: 0.5 + Math.random() * 1.5,
          speed: 0.3 + Math.random() * 1.2,
          bright: 0.4 + Math.random() * 0.6,
        });
      }
    }
  }, []);

  const reset = useCallback(() => {
    const s = gs.current;
    s.shipX = 250;
    s.shipY = 540;
    s.obstacles = [];
    s.score = 0;
    s.gameOver = false;
    s.frame = 0;
    s.spawnTimer = 0;
    s.mouseX = 250;
    onScoreUpdate(0);
  }, [onScoreUpdate]);

  const loop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const s = gs.current;
    if (s.gameOver) return;
    s.frame++;

    // Ship movement
    s.shipX += (s.mouseX - s.shipX) * 0.15;
    s.shipX = Math.max(20, Math.min(canvas.width - 20, s.shipX));

    // Spawn asteroids
    s.spawnTimer++;
    const interval = Math.max(12, 40 - Math.floor(s.frame / 250));
    if (s.spawnTimer >= interval) {
      s.spawnTimer = 0;
      const size = 12 + Math.random() * 24;
      s.obstacles.push({
        x: 20 + Math.random() * (canvas.width - 40),
        y: -size - 10,
        size,
        speed: 1.8 + Math.random() * 3 + s.frame / 1200,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.04,
      });
    }

    // Update and collide
    const sL = s.shipX - s.shipWidth / 2;
    const sR = s.shipX + s.shipWidth / 2;
    const sT = s.shipY - s.shipHeight / 2;
    const sB = s.shipY + s.shipHeight / 2;

    s.obstacles = s.obstacles.filter((obs) => {
      obs.y += obs.speed;
      obs.rot += obs.rotSpeed;

      const oL = obs.x - obs.size / 2;
      const oR = obs.x + obs.size / 2;
      const oT = obs.y - obs.size / 2;
      const oB = obs.y + obs.size / 2;

      if (sL < oR && sR > oL && sT < oB && sB > oT) {
        s.gameOver = true;
        onGameOver(s.score);
        return false;
      }
      return obs.y < canvas.height + obs.size;
    });

    // Score
    s.score = Math.floor(s.frame / 3);
    onScoreUpdate(s.score);

    // ─── DRAW ───
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Deep space gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, "#05000a");
    bgGrad.addColorStop(0.3, "#0a001a");
    bgGrad.addColorStop(0.6, "#100525");
    bgGrad.addColorStop(1, "#0a0015");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Nebula glow
    const ng = ctx.createRadialGradient(350, 200, 0, 350, 200, 350);
    ng.addColorStop(0, "rgba(124, 58, 237, 0.08)");
    ng.addColorStop(0.5, "rgba(0, 200, 255, 0.04)");
    ng.addColorStop(1, "transparent");
    ctx.fillStyle = ng;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Distant planet
    ctx.save();
    const planetX = 380 + Math.sin(s.frame * 0.003) * 20;
    const planetY = 140 + Math.cos(s.frame * 0.004) * 15;
    const planetGrad = ctx.createRadialGradient(
      planetX - 15,
      planetY - 15,
      5,
      planetX,
      planetY,
      40
    );
    planetGrad.addColorStop(0, "#2dd4bf");
    planetGrad.addColorStop(0.4, "#0d9488");
    planetGrad.addColorStop(0.8, "#115e59");
    planetGrad.addColorStop(1, "#042f2e");
    ctx.fillStyle = planetGrad;
    ctx.beginPath();
    ctx.arc(planetX, planetY, 30, 0, Math.PI * 2);
    ctx.fill();
    // Planet ring
    ctx.strokeStyle = "rgba(45, 212, 191, 0.2)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(planetX, planetY, 50, 12, 0.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Parallax starfield (3 layers)
    for (let i = 0; i < 3; i++) {
      const layerSpeed = [0.15, 0.4, 0.8][i];
      const layerCount = [40, 50, 30][i];
      const layerSize = [0.6, 1.0, 1.6][i];
      const layerAlpha = [0.4, 0.7, 1.0][i];
      for (let j = 0; j < layerCount; j++) {
        const idx = i * 50 + j;
        const star = gs.current.stars[idx];
        if (!star) continue;
        let y = (star.y + s.frame * layerSpeed * star.speed) % canvas.height;
        const x = ((star.x + j * 7) % canvas.width);
        const twinkle = 0.6 + Math.sin(s.frame * 0.02 + idx) * 0.4;
        ctx.fillStyle = `rgba(255,255,255,${star.bright * layerAlpha * twinkle})`;
        ctx.beginPath();
        ctx.arc(x, y, layerSize * star.size * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Asteroids
    for (const obs of s.obstacles) {
      ctx.save();
      ctx.translate(obs.x, obs.y);
      ctx.rotate(obs.rot);

      // Shadow/glow
      ctx.shadowColor = "rgba(255, 80, 80, 0.15)";
      ctx.shadowBlur = 20;

      // Irregular asteroid shape
      const r = obs.size / 2;
      ctx.beginPath();
      const points = 7 + Math.floor(obs.size / 5);
      for (let p = 0; p < points; p++) {
        const angle = (p / points) * Math.PI * 2;
        const variance = 0.75 + Math.random() * 0.25;
        // Use deterministic variance based on position
        const vr =
          r * (0.8 + ((p * 37 + Math.floor(obs.x * 10)) % 25) / 100);
        const px = Math.cos(angle) * vr;
        const py = Math.sin(angle) * vr;
        if (p === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();

      const grad = ctx.createRadialGradient(-3, -3, 2, 0, 0, r);
      grad.addColorStop(0, "#f97316");
      grad.addColorStop(0.3, "#b91c1c");
      grad.addColorStop(0.6, "#7f1d1d");
      grad.addColorStop(0.85, "#450a0a");
      grad.addColorStop(1, "#1a0000");
      ctx.fillStyle = grad;
      ctx.fill();

      // Edge highlights
      ctx.strokeStyle = "rgba(251, 146, 60, 0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // ─── Spaceship ───
    ctx.save();
    ctx.translate(s.shipX, s.shipY);

    // Engine thrust glow
    const thrustLen = 12 + Math.random() * 10;
    const thrustGrad = ctx.createRadialGradient(
      0,
      s.shipHeight / 2 + 5,
      2,
      0,
      s.shipHeight / 2 + thrustLen / 2,
      thrustLen / 2
    );
    thrustGrad.addColorStop(0, "rgba(255, 200, 50, 0.9)");
    thrustGrad.addColorStop(0.3, "rgba(255, 100, 20, 0.6)");
    thrustGrad.addColorStop(0.7, "rgba(255, 50, 0, 0.3)");
    thrustGrad.addColorStop(1, "rgba(255, 0, 0, 0)");
    ctx.fillStyle = thrustGrad;
    ctx.beginPath();
    ctx.moveTo(-8, s.shipHeight / 2 - 2);
    ctx.lineTo(0, s.shipHeight / 2 + thrustLen);
    ctx.lineTo(8, s.shipHeight / 2 - 2);
    ctx.closePath();
    ctx.fill();

    // Ship hull glow
    ctx.shadowColor = "rgba(0, 240, 255, 0.5)";
    ctx.shadowBlur = 15;

    // Main hull
    const hullGrad = ctx.createLinearGradient(-s.shipWidth / 2, 0, s.shipWidth / 2, 0);
    hullGrad.addColorStop(0, "#0ea5e9");
    hullGrad.addColorStop(0.2, "#06b6d4");
    hullGrad.addColorStop(0.5, "#a855f7");
    hullGrad.addColorStop(0.8, "#06b6d4");
    hullGrad.addColorStop(1, "#0ea5e9");
    ctx.fillStyle = hullGrad;

    ctx.beginPath();
    ctx.moveTo(0, -s.shipHeight / 2 - 2);
    ctx.lineTo(-s.shipWidth / 2 + 2, 0);
    ctx.lineTo(-s.shipWidth / 2 + 4, s.shipHeight / 2 - 6);
    ctx.lineTo(-4, s.shipHeight / 2 - 2);
    ctx.lineTo(0, s.shipHeight / 2);
    ctx.lineTo(4, s.shipHeight / 2 - 2);
    ctx.lineTo(s.shipWidth / 2 - 4, s.shipHeight / 2 - 6);
    ctx.lineTo(s.shipWidth / 2 - 2, 0);
    ctx.closePath();
    ctx.fill();

    // Cockpit glow
    ctx.shadowBlur = 0;
    const cockpitGrad = ctx.createRadialGradient(0, -4, 1, 0, -4, 6);
    cockpitGrad.addColorStop(0, "rgba(255, 255, 255, 0.9)");
    cockpitGrad.addColorStop(0.4, "rgba(0, 240, 255, 0.6)");
    cockpitGrad.addColorStop(1, "rgba(0, 240, 255, 0)");
    ctx.fillStyle = cockpitGrad;
    ctx.beginPath();
    ctx.ellipse(0, -4, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wing accents
    ctx.fillStyle = "rgba(168, 85, 247, 0.4)";
    ctx.beginPath();
    ctx.moveTo(-s.shipWidth / 2 + 2, 0);
    ctx.lineTo(-s.shipWidth / 2 - 6, 6);
    ctx.lineTo(-s.shipWidth / 2 + 2, 4);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(s.shipWidth / 2 - 2, 0);
    ctx.lineTo(s.shipWidth / 2 + 6, 6);
    ctx.lineTo(s.shipWidth / 2 - 2, 4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // HUD Score
    ctx.fillStyle = "rgba(0, 240, 255, 0.8)";
    ctx.font = "bold 18px 'Geist Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText(`⏤ SCORE`, 14, 28);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px 'Geist Mono', monospace";
    ctx.fillText(`${s.score}`, 14, 56);

    // HUD decorative lines
    ctx.strokeStyle = "rgba(0, 240, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(12, 62);
    ctx.lineTo(120, 62);
    ctx.stroke();

    s.animId = requestAnimationFrame(loop);
  }, [onGameOver, onScoreUpdate]);

  useEffect(() => {
    if (!isPlaying) {
      if (gs.current.animId) cancelAnimationFrame(gs.current.animId);
      return;
    }
    reset();
    gs.current.animId = requestAnimationFrame(loop);
    return () => {
      if (gs.current.animId) cancelAnimationFrame(gs.current.animId);
    };
  }, [isPlaying, loop, reset]);

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) gs.current.mouseX = e.clientX - rect.left;
    },
    []
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) gs.current.mouseX = e.touches[0].clientX - rect.left;
    },
    []
  );

  return (
    <div className="relative group">
      {/* Glow border */}
      <div className="absolute -inset-[1px] rounded-xl bg-gradient-to-b from-cyan-500/20 via-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      <canvas
        ref={canvasRef}
        width={500}
        height={600}
        className="rounded-xl border border-cyan-900/40 cursor-none w-full max-w-[500px] mx-auto relative z-10 shadow-[0_0_30px_rgba(0,240,255,0.05)]"
        onMouseMove={onMouseMove}
        onTouchMove={onTouchMove}
      />
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl z-20">
          <div className="text-center space-y-4">
            {gs.current.gameOver ? (
              <p className="text-2xl font-bold text-red-400 mb-2 tracking-wider">
                ✦ SHIP DESTROYED ✦
              </p>
            ) : (
              <div className="mb-4">
                <div className="w-16 h-16 mx-auto mb-2 flex items-center justify-center">
                  <svg viewBox="0 0 40 40" className="w-full h-full text-cyan-400">
                    <polygon
                      points="20,2 8,36 20,28 32,36"
                      fill="currentColor"
                      opacity="0.8"
                    />
                    <polygon
                      points="20,6 12,32 20,26 28,32"
                      fill="currentColor"
                      opacity="0.3"
                    />
                  </svg>
                </div>
                <p className="text-cyan-400/60 text-xs tracking-[0.3em] uppercase">
                  Ready for Launch
                </p>
              </div>
            )}
            <button
              onClick={startGame}
              className="px-10 py-3.5 bg-gradient-to-r from-cyan-600 via-purple-600 to-cyan-600 text-white font-bold rounded-lg text-lg tracking-wider hover:from-cyan-500 hover:via-purple-500 hover:to-cyan-500 transition-all duration-300 shadow-[0_0_25px_rgba(0,240,255,0.15)] hover:shadow-[0_0_40px_rgba(0,240,255,0.3)] transform hover:scale-105 active:scale-95"
            >
              {gs.current.gameOver ? "▶ RETRY MISSION" : "▶ LAUNCH"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface GameProps {
  walletAddress: string | null;
  onScoreUpdate: (score: number) => void;
  onGameOver: (score: number) => void;
  isPlaying: boolean;
  startGame: () => void;
}

// ─── Leaderboard Panel ────────────────────────────────────

function LeaderboardPanel({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-purple-900/30 bg-gradient-to-b from-[#0d0620]/90 to-[#05050f]/90 backdrop-blur-sm p-5">
      {/* Decorative top accent */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
      <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-[0.25em] mb-4 flex items-center gap-3">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(0,240,255,0.6)]" />
        Cosmos Rankings
      </h3>
      {entries.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-zinc-600 text-xs tracking-widest uppercase">
            ◇ No Pilots in Sector ◇
          </p>
          <p className="text-zinc-700 text-[10px] mt-2 tracking-wider">
            Be the first to log a warp jump
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {entries.map((entry, i) => (
            <div
              key={`${entry.player}-${i}`}
              className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                i === 0
                  ? "bg-gradient-to-r from-yellow-500/10 to-transparent border border-yellow-500/10"
                  : i === 1
                  ? "bg-gradient-to-r from-zinc-300/5 to-transparent border border-zinc-300/5"
                  : i === 2
                  ? "bg-gradient-to-r from-amber-700/10 to-transparent border border-amber-700/10"
                  : "bg-white/[0.02]"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    i === 0
                      ? "text-yellow-400 bg-yellow-500/10"
                      : i === 1
                      ? "text-zinc-300 bg-zinc-300/10"
                      : i === 2
                      ? "text-amber-500 bg-amber-500/10"
                      : "text-zinc-600 bg-zinc-800/30"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="flex items-center gap-2">
                  {i === 0 && <span className="text-xs">👑</span>}
                  <span className="text-xs font-mono text-zinc-400">
                    {truncateAddress(entry.player)}
                  </span>
                </div>
              </div>
              <span className="text-sm font-bold font-mono text-cyan-300">
                {formatScore(entry.score)}
              </span>
            </div>
          ))}
        </div>
      )}
      {/* Bottom decoration */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
    </div>
  );
}

// ─── Space-themed Panel ───────────────────────────────────

function SpacePanel({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-purple-900/30 bg-gradient-to-b from-[#0d0620]/90 to-[#05050f]/90 backdrop-blur-sm p-5">
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
      <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-[0.25em] mb-4 flex items-center gap-3">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(0,240,255,0.6)]" />
        {icon && <span className="text-base">{icon}</span>}
        {title}
      </h3>
      {children}
    </div>
  );
}

// ─── Main Contract Component ──────────────────────────────

export default function Contract() {
  const wallet = useWallet();
  const [currentScore, setCurrentScore] = useState(0);
  const [lastScore, setLastScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [playerHighScore, setPlayerHighScore] = useState<number>(0);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch leaderboard
  useEffect(() => {
    const fetchLB = async () => {
      const lb = await getLeaderboard(10);
      setLeaderboard(lb);
    };
    fetchLB();
    const interval = setInterval(fetchLB, 15000);
    return () => clearInterval(interval);
  }, []);

  // Fetch player high score
  useEffect(() => {
    if (wallet.isConnected && wallet.address) {
      getScore(wallet.address).then(setPlayerHighScore);
    }
  }, [wallet.isConnected, wallet.address]);

  const handleStartGame = useCallback(() => {
    setIsPlaying(true);
    setScoreSubmitted(false);
    setTxHash(null);
    setSubmitError(null);
    setCurrentScore(0);
  }, []);

  const handleGameOver = useCallback(
    async (score: number) => {
      setLastScore(score);
      setIsPlaying(false);

      if (wallet.isConnected && wallet.address && score > 0) {
        try {
          setIsSubmitting(true);
          const hash = await submitScore(wallet.address, score);
          setTxHash(hash);
          setScoreSubmitted(true);
          const [lb, hs] = await Promise.all([
            getLeaderboard(10),
            getScore(wallet.address),
          ]);
          setLeaderboard(lb);
          setPlayerHighScore(hs);
        } catch (err: any) {
          const msg = err?.message || err?.toString() || "Unknown error";
          setSubmitError(msg);
          console.error("Failed to submit score:", err);
        } finally {
          setIsSubmitting(false);
        }
      }
    },
    [wallet.isConnected, wallet.address]
  );

  return (
    <div className="relative min-h-screen text-white overflow-hidden">
      <SpaceBackground />

      {/* Content layer */}
      <div className="relative z-10">
        {/* Hero */}
        <div className="text-center py-10 px-4">
          <div className="inline-block mb-3">
            <span className="text-[10px] tracking-[0.4em] text-cyan-500/60 uppercase">
              ◆ Stellar Network ◆
            </span>
          </div>
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight">
            <span className="bg-gradient-to-r from-cyan-300 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              STELLAR
            </span>{" "}
            <span className="text-white">RACER</span>
          </h1>
          <p className="text-zinc-500 mt-3 text-sm max-w-lg mx-auto tracking-wide leading-relaxed">
            Navigate the asteroid belt at lightspeed.
            <br />
            Set warp records on the Stellar blockchain.
          </p>
          {/* Nebula decoration */}
          <div className="flex justify-center gap-1 mt-4">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1 h-1 rounded-full bg-cyan-400/30"
                style={{ opacity: 0.3 + i * 0.2 }}
              />
            ))}
          </div>
        </div>

        {/* Main grid */}
        <div className="max-w-6xl mx-auto px-4 pb-20 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Game column */}
          <div className="lg:col-span-2 flex flex-col items-center gap-4">
            <GameCanvas
              walletAddress={wallet.address}
              onScoreUpdate={setCurrentScore}
              onGameOver={handleGameOver}
              isPlaying={isPlaying}
              startGame={handleStartGame}
            />

            {/* Status bar */}
            <div className="w-full max-w-[500px] flex items-center justify-between px-4 py-3 rounded-lg border border-purple-900/20 bg-[#0d0620]/60 backdrop-blur-sm">
              <div className="flex items-center gap-5">
                <span className="text-xs text-zinc-500 tracking-wider">
                  LIVE SCAN{" "}
                  <span className="text-cyan-400 font-bold font-mono text-sm">
                    {formatScore(currentScore)}
                  </span>
                </span>
                {wallet.isConnected && (
                  <span className="text-xs text-zinc-600 tracking-wider">
                    PERSONAL BEST{" "}
                    <span className="text-purple-400 font-bold font-mono text-sm">
                      {formatScore(playerHighScore)}
                    </span>
                  </span>
                )}
              </div>
              {!wallet.isConnected && (
                <span className="text-[10px] text-amber-500/60 tracking-widest uppercase">
                  Unlinked — scores local only
                </span>
              )}
            </div>

            {/* Post-game result */}
            {!isPlaying && lastScore > 0 && (
              <div className="w-full max-w-[500px] p-5 rounded-xl border border-purple-900/30 bg-gradient-to-b from-[#0d0620]/90 to-[#05050f]/90 backdrop-blur-sm">
                <div className="text-center space-y-3">
                  <p className="text-3xl font-black tracking-wide">
                    <span className="text-zinc-500 text-sm block font-normal tracking-widest mb-1">
                      FINAL SCORE
                    </span>
                    <span className="bg-gradient-to-r from-cyan-300 to-purple-400 bg-clip-text text-transparent">
                      {formatScore(lastScore)}
                    </span>
                  </p>
                  {isSubmitting && (
                    <div className="flex items-center justify-center gap-2 text-cyan-400 text-sm">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                      Broadcasting to Stellar...
                    </div>
                  )}
                  {scoreSubmitted && txHash && (
                    <div className="space-y-2">
                      <p className="text-green-400/80 text-sm tracking-wider">
                        ✦ Score Anchored On-Chain ✦
                      </p>
                      <p className="text-[10px] text-zinc-600 font-mono break-all">
                        {truncateAddress(txHash)}
                      </p>
                    </div>
                  )}
                  {submitError && (
                    <div className="p-3 rounded-lg bg-red-900/20 border border-red-500/20">
                      <p className="text-red-400/90 text-xs tracking-wider mb-1">
                        ✦ Transmission Failed ✦
                      </p>
                      <p className="text-red-300/60 text-[10px] font-mono leading-relaxed">
                        {submitError}
                      </p>
                    </div>
                  )}
                  {!wallet.isConnected && lastScore > 0 && (
                    <p className="text-zinc-600 text-xs tracking-wider">
                      Link Freighter wallet to submit your score to the Stellar
                      network.
                    </p>
                  )}
                  <button
                    onClick={handleStartGame}
                    className="mt-2 px-6 py-2 text-sm bg-white/5 border border-cyan-900/30 rounded-lg text-cyan-400 hover:bg-white/10 tracking-wider transition-all"
                  >
                    FLY AGAIN
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Wallet panel */}
            <SpacePanel title="Pilot" icon="🪐">
              {wallet.isConnected && wallet.address ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
                    <span className="text-xs text-green-400 tracking-wider font-medium">
                      COMMS ONLINE
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-zinc-500 break-all tracking-tight">
                    {wallet.address}
                  </p>
                  {playerHighScore > 0 && (
                    <div className="pt-3 border-t border-purple-900/20">
                      <p className="text-[10px] text-zinc-600 tracking-widest uppercase">
                        All-Time Best
                      </p>
                      <p className="text-2xl font-black text-purple-400 mt-1 font-mono">
                        {formatScore(playerHighScore)}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={wallet.disconnect}
                    className="text-[10px] text-zinc-700 hover:text-zinc-500 tracking-wider uppercase transition-colors"
                  >
                    — Disconnect
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-[11px] text-zinc-600 tracking-wide leading-relaxed">
                    No active pilot link. Connect your Stellar wallet to save
                    warp records and earn rewards.
                  </p>
                  <button
                    onClick={wallet.connect}
                    disabled={wallet.isConnecting}
                    className="w-full py-2.5 bg-gradient-to-r from-purple-600/80 to-cyan-600/80 text-white text-xs font-semibold rounded-lg tracking-widest uppercase hover:from-purple-500 hover:to-cyan-500 disabled:opacity-40 transition-all shadow-[0_0_20px_rgba(168,85,247,0.1)] hover:shadow-[0_0_30px_rgba(168,85,247,0.2)]"
                  >
                    {wallet.isConnecting ? "SYNCING..." : "⟡ LINK WALLET"}
                  </button>
                  {wallet.error && (
                    <p className="text-[10px] text-red-400/70 whitespace-pre-line">{wallet.error}</p>
                  )}
                  {wallet.debug && !wallet.error && (
                    <p className="text-[10px] text-zinc-600/50 truncate">{wallet.debug}</p>
                  )}
                </div>
              )}
            </SpacePanel>

            {/* Contract panel */}
            <SpacePanel title="Network" icon="⛓️">
              {CONTRACT_ADDRESS ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
                    <span className="text-xs text-green-400 tracking-wider font-medium">
                      SOROBAN ACTIVE
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-zinc-600 break-all">
                    {CONTRACT_ADDRESS}
                  </p>
                  <p className="text-[10px] text-zinc-600 tracking-wider">
                    {leaderboard.length} registered pilots in sector
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400/50 animate-pulse" />
                    <span className="text-xs text-amber-400/70 tracking-wider font-medium">
                      STANDBY — NO CONTRACT
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-600 tracking-wider">
                    Deploy the Soroban contract and set
                    NEXT_PUBLIC_CONTRACT_ADDRESS
                  </p>
                </div>
              )}
            </SpacePanel>

            {/* Leaderboard */}
            <LeaderboardPanel entries={leaderboard} />
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center py-8 border-t border-purple-900/10">
          <div className="flex items-center justify-center gap-4 text-[10px] text-zinc-700 tracking-widest uppercase">
            <span>✦ Built on Soroban</span>
            <span className="w-px h-3 bg-zinc-800" />
            <span>✦ Testnet</span>
            <span className="w-px h-3 bg-zinc-800" />
            <span>✦ Stellar Racer v1</span>
          </div>
          <p className="text-[9px] text-zinc-800 mt-3 tracking-wider">
            Navigate the galaxy. Every warp logged on-chain.
          </p>
        </footer>
      </div>
    </div>
  );
}
