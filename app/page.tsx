"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ParticleField } from "@/components/ParticleField";
import { formatTime } from "@/lib/time";

const PARTICLE_COLORS = [
  "255,0,230", // magenta
  "255,105,180", // hot pink
  "255,140,0", // orange
  "255,255,0", // yellow
  "57,255,20", // neon green
  "255,0,0", // red
  "0,150,255", // electric blue
  "0,255,240", // cyan
  "64,224,208", // turquoise
  "191,0,255", // purple
];

const STORAGE_KEY = "cyber-stop-state-v1";

interface Lap {
  id: number;
  splitMs: number; // time since previous lap
  totalMs: number; // total elapsed at lap
}

interface PersistedState {
  running: boolean;
  elapsedMs: number;
  startEpoch: number | null; // epoch ms when current run segment started
  laps: Lap[];
}

function loadState(): PersistedState {
  if (typeof window === "undefined") {
    return { running: false, elapsedMs: 0, startEpoch: null, laps: [] };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { running: false, elapsedMs: 0, startEpoch: null, laps: [] };
    return JSON.parse(raw);
  } catch {
    return { running: false, elapsedMs: 0, startEpoch: null, laps: [] };
  }
}

function saveState(state: PersistedState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export default function StopwatchPage() {
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [laps, setLaps] = useState<Lap[]>([]);
  const [pressed, setPressed] = useState<string | null>(null);

  const startEpochRef = useRef<number | null>(null);
  const baseElapsedRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // Restore persisted state (accounting for time passed while backgrounded/closed)
  useEffect(() => {
    const state = loadState();
    let elapsed = state.elapsedMs;
    if (state.running && state.startEpoch) {
      elapsed = state.elapsedMs + (Date.now() - state.startEpoch);
    }
    baseElapsedRef.current = elapsed;
    setElapsedMs(elapsed);
    setLaps(state.laps ?? []);
    if (state.running) {
      startEpochRef.current = Date.now();
      setRunning(true);
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback(
    (overrides: Partial<PersistedState> = {}) => {
      saveState({
        running,
        elapsedMs: baseElapsedRef.current,
        startEpoch: startEpochRef.current,
        laps,
        ...overrides,
      });
    },
    [running, laps]
  );

  // Animation loop while running
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const start = startEpochRef.current ?? Date.now();
      setElapsedMs(baseElapsedRef.current + (Date.now() - start));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [running]);

  // Persist on visibility change / unload so backgrounding doesn't lose time
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        persist();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onVisibility);
    };
  }, [persist]);

  const handleStart = useCallback(() => {
    startEpochRef.current = Date.now();
    setRunning(true);
    saveState({
      running: true,
      elapsedMs: baseElapsedRef.current,
      startEpoch: startEpochRef.current,
      laps,
    });
  }, [laps]);

  const handlePause = useCallback(() => {
    const start = startEpochRef.current ?? Date.now();
    baseElapsedRef.current = baseElapsedRef.current + (Date.now() - start);
    startEpochRef.current = null;
    setRunning(false);
    setElapsedMs(baseElapsedRef.current);
    saveState({
      running: false,
      elapsedMs: baseElapsedRef.current,
      startEpoch: null,
      laps,
    });
  }, [laps]);

  const handleReset = useCallback(() => {
    startEpochRef.current = null;
    baseElapsedRef.current = 0;
    setRunning(false);
    setElapsedMs(0);
    setLaps([]);
    saveState({ running: false, elapsedMs: 0, startEpoch: null, laps: [] });
  }, []);

  const handleLap = useCallback(() => {
    setLaps((prev) => {
      const prevTotal = prev.length > 0 ? prev[0].totalMs : 0;
      const totalMs = elapsedMs;
      const splitMs = totalMs - prevTotal;
      const next: Lap[] = [{ id: Date.now(), splitMs, totalMs }, ...prev];
      saveState({
        running,
        elapsedMs: baseElapsedRef.current,
        startEpoch: startEpochRef.current,
        laps: next,
      });
      return next;
    });
  }, [elapsedMs, running]);

  // Keyboard shortcuts: space = start/pause, L = lap, R = reset
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (running) handlePause();
        else handleStart();
      } else if (e.key.toLowerCase() === "l" && running) {
        handleLap();
      } else if (e.key.toLowerCase() === "r" && !running) {
        handleReset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, handleStart, handlePause, handleLap, handleReset]);

  if (!ready) return null;

  const { main, centis } = formatTime(elapsedMs);

  let bestId: number | null = null;
  let worstId: number | null = null;
  if (laps.length > 1) {
    const splits = laps.map((l) => l.splitMs);
    const min = Math.min(...splits);
    const max = Math.max(...splits);
    bestId = laps.find((l) => l.splitMs === min)?.id ?? null;
    worstId = laps.find((l) => l.splitMs === max)?.id ?? null;
  }

  return (
    <>
      <ParticleField colors={PARTICLE_COLORS} count={2300} />
      <div className="app-content">
        <h1 className="brand-title">
          Cyber<span>Stop</span>
        </h1>

        <div className="display-panel" role="timer" aria-live="off">
          <div className="display-time">
            {main}
            <span className="display-ms">.{centis}</span>
          </div>
          <div className={`display-status ${running ? "display-status-running" : ""}`}>
            {running ? "Running" : elapsedMs > 0 ? "Paused" : "Ready"}
          </div>
        </div>

        <div className="control-row">
          <button
            type="button"
            className="stop-btn"
            style={{ "--btn-color": running ? "255,140,0" : "57,255,20" } as React.CSSProperties}
            onPointerDown={() => setPressed("primary")}
            onPointerUp={() => setPressed(null)}
            onPointerLeave={() => setPressed(null)}
            onClick={running ? handlePause : handleStart}
            aria-label={running ? "Pause stopwatch" : "Start stopwatch"}
          >
            {running ? "Pause" : elapsedMs > 0 ? "Resume" : "Start"}
          </button>
          <button
            type="button"
            className="stop-btn"
            style={{ "--btn-color": running ? "0,255,240" : "255,0,230" } as React.CSSProperties}
            onClick={running ? handleLap : handleReset}
            disabled={!running && elapsedMs === 0}
            aria-label={running ? "Record lap" : "Reset stopwatch"}
          >
            {running ? "Lap" : "Reset"}
          </button>
        </div>

        <div className="lap-panel">
          <div className="lap-header">
            <span className="lap-title">Laps</span>
            <span className="lap-title" style={{ color: "rgba(255,255,255,0.4)", textShadow: "none" }}>
              {laps.length}
            </span>
          </div>
          <div className="lap-list">
            {laps.length === 0 ? (
              <div className="lap-empty">No laps yet — press Lap while running.</div>
            ) : (
              laps.map((lap, idx) => {
                const num = laps.length - idx;
                const split = formatTime(lap.splitMs);
                const total = formatTime(lap.totalMs);
                const cls =
                  lap.id === bestId ? "lap-row-best" : lap.id === worstId ? "lap-row-worst" : "";
                return (
                  <div className="lap-row" key={lap.id}>
                    <span className="lap-num">#{num}</span>
                    <span className={`lap-split ${cls}`}>
                      {split.main}.{split.centis}
                    </span>
                    <span className="lap-total">
                      {total.main}.{total.centis}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}
