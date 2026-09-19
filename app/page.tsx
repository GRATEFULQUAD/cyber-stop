"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ParticleField } from "@/components/ParticleField";
import { formatTime, getTimeParts } from "@/lib/time";

const PARTICLE_COLORS = [
  "255,0,230",
  "255,105,180",
  "255,140,0",
  "255,255,0",
  "57,255,20",
  "255,0,0",
  "0,150,255",
  "0,255,240",
  "64,224,208",
  "191,0,255",
];

const STORAGE_KEY = "cyber-stop-state-v2";

type LapType = "LAP" | "SPLIT";

interface Lap {
  id: number;
  type: LapType;
  splitMs: number;
  totalMs: number;
}

interface PersistedState {
  running: boolean;
  elapsedMs: number;
  startEpoch: number | null;
  laps: Lap[];
}

const EMPTY_STATE: PersistedState = { running: false, elapsedMs: 0, startEpoch: null, laps: [] };

function loadState(): PersistedState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    return { ...EMPTY_STATE, ...JSON.parse(raw) };
  } catch {
    return EMPTY_STATE;
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
  const [sheetOpen, setSheetOpen] = useState(false);

  const startEpochRef = useRef<number | null>(null);
  const baseElapsedRef = useRef(0);
  const rafRef = useRef<number | null>(null);

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

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") persist();
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
    saveState({ running: true, elapsedMs: baseElapsedRef.current, startEpoch: startEpochRef.current, laps });
  }, [laps]);

  const handlePause = useCallback(() => {
    const start = startEpochRef.current ?? Date.now();
    baseElapsedRef.current = baseElapsedRef.current + (Date.now() - start);
    startEpochRef.current = null;
    setRunning(false);
    setElapsedMs(baseElapsedRef.current);
    saveState({ running: false, elapsedMs: baseElapsedRef.current, startEpoch: null, laps });
  }, [laps]);

  const handleReset = useCallback(() => {
    startEpochRef.current = null;
    baseElapsedRef.current = 0;
    setRunning(false);
    setElapsedMs(0);
    setLaps([]);
    saveState(EMPTY_STATE);
  }, []);

  const recordEntry = useCallback(
    (type: LapType) => {
      setLaps((prev) => {
        const prevTotal = prev.length > 0 ? prev[0].totalMs : 0;
        const totalMs = elapsedMs;
        const splitMs = totalMs - prevTotal;
        const next: Lap[] = [{ id: Date.now(), type, splitMs, totalMs }, ...prev];
        saveState({ running, elapsedMs: baseElapsedRef.current, startEpoch: startEpochRef.current, laps: next });
        return next;
      });
    },
    [elapsedMs, running]
  );

  const handleLap = useCallback(() => recordEntry("LAP"), [recordEntry]);
  const handleSplit = useCallback(() => recordEntry("SPLIT"), [recordEntry]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sheetOpen) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (running) handlePause();
        else handleStart();
      } else if (e.key.toLowerCase() === "l" && running) {
        handleLap();
      } else if (e.key.toLowerCase() === "s" && running) {
        handleSplit();
      } else if (e.key.toLowerCase() === "r" && !running) {
        handleReset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, sheetOpen, handleStart, handlePause, handleLap, handleSplit, handleReset]);

  if (!ready) return null;

  const parts = getTimeParts(elapsedMs);
  const canReset = !running && elapsedMs > 0;

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
      <h1 className="sr-only">Cyber Stop — Neon Stopwatch</h1>

      <div className="stopwatch-screen">
        <div className="control-column">
          <button
            type="button"
            className="neon-circle"
            style={{ "--circle-color": "var(--pa-color)" } as React.CSSProperties}
            onClick={running ? handlePause : handleStart}
            aria-label={running ? "Pause stopwatch" : "Start stopwatch"}
          >
            {running ? "PA" : "GO"}
          </button>

          <button
            type="button"
            className="neon-circle"
            style={{ "--circle-color": "var(--lp-color)" } as React.CSSProperties}
            onClick={handleLap}
            disabled={!running}
            aria-label="Record lap"
          >
            LP
          </button>

          <button
            type="button"
            className="neon-circle"
            style={{ "--circle-color": "var(--sp-color)" } as React.CSSProperties}
            onClick={handleSplit}
            disabled={!running}
            aria-label="Record split"
          >
            SP
          </button>

          <button
            type="button"
            className="neon-circle"
            style={{ "--circle-color": "var(--rt-color)" } as React.CSSProperties}
            onClick={handleReset}
            disabled={!canReset}
            aria-label="Reset stopwatch"
          >
            RT
          </button>

          <div className="control-spacer" />

          <button
            type="button"
            className="run-indicator"
            onClick={() => setSheetOpen(true)}
            aria-label="Open lap history and settings"
            style={{ background: "transparent", border: "none", padding: 0 }}
          >
            <span className={`run-dot ${running ? "run-dot-active" : ""}`} aria-hidden="true" />
            <span className="run-label">RUN</span>
          </button>

          <button
            type="button"
            className="neon-circle"
            style={{ "--circle-color": "var(--gear-color)", fontSize: "20px" } as React.CSSProperties}
            onClick={() => setSheetOpen(true)}
            aria-label="Open settings"
          >
            ⚙
          </button>
        </div>

        <div className="digit-column">
          <div className="digit-box" style={{ "--box-color": "var(--hrs-color)" } as React.CSSProperties}>
            <span className="digit-box-label">HRS</span>
            <div className="digit-box-inner">
              <span className="digit-box-value">{parts.hrs}</span>
            </div>
          </div>
          <div className="digit-box" style={{ "--box-color": "var(--min-color)" } as React.CSSProperties}>
            <span className="digit-box-label">MIN</span>
            <div className="digit-box-inner">
              <span className="digit-box-value">{parts.min}</span>
            </div>
          </div>
          <div className="digit-box" style={{ "--box-color": "var(--sec-color)" } as React.CSSProperties}>
            <span className="digit-box-label">SEC</span>
            <div className="digit-box-inner">
              <span className="digit-box-value">{parts.sec}</span>
            </div>
          </div>
          <div className="digit-box" style={{ "--box-color": "var(--ms-color)" } as React.CSSProperties}>
            <span className="digit-box-label">MS</span>
            <div className="digit-box-inner">
              <span className="digit-box-value">{parts.ms}</span>
            </div>
          </div>
        </div>
      </div>

      {sheetOpen && (
        <div className="sheet-backdrop" onClick={() => setSheetOpen(false)}>
          <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header">
              <span className="sheet-title">Laps &amp; Splits ({laps.length})</span>
              <button type="button" className="sheet-close" onClick={() => setSheetOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="lap-list">
              {laps.length === 0 ? (
                <div className="lap-empty">No laps or splits recorded yet.</div>
              ) : (
                laps.map((lap, idx) => {
                  const num = laps.length - idx;
                  const split = formatTime(lap.splitMs);
                  const total = formatTime(lap.totalMs);
                  const cls = lap.id === bestId ? "lap-row-best" : lap.id === worstId ? "lap-row-worst" : "";
                  return (
                    <div className="lap-row" key={lap.id}>
                      <span className="lap-num">
                        #{num}
                        <span className="lap-type">{lap.type}</span>
                      </span>
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
            <button type="button" className="sheet-reset-btn" onClick={handleReset} disabled={!canReset}>
              Reset Everything
            </button>
          </div>
        </div>
      )}
    </>
  );
}
