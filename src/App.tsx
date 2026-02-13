import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  type Movement,
  type PoseSample,
  createInitialRepState,
  processPoseSample
} from "./repLogic";
import { startPosePipeline, type PosePipelineHandle } from "./posePipeline";

type CameraStatus = "idle" | "starting" | "running" | "error";

interface SessionMetrics {
  lastRepAt: number | null;
  lastInvalidAt: number | null;
}

const MOVEMENT_LABELS: Record<Movement, string> = {
  air_squat: "Air Squat",
  wall_ball: "Wall Ball",
  deadlift: "Deadlift"
};

export const App: React.FC = () => {
  const [movement, setMovement] = useState<Movement>("air_squat");
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [repState, setRepState] = useState(() => createInitialRepState());
  const [metrics, setMetrics] = useState<SessionMetrics>({
    lastRepAt: null,
    lastInvalidAt: null
  });

  const poseHandleRef = useRef<PosePipelineHandle | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const resetSession = useCallback(() => {
    setRepState(createInitialRepState());
    setMetrics({ lastRepAt: null, lastInvalidAt: null });
    setErrorMsg(null);
  }, []);

  const stopCamera = useCallback(() => {
    if (poseHandleRef.current) {
      poseHandleRef.current.stop();
      poseHandleRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraStatus("idle");
  }, []);

  const beep = useCallback((frequency: number, durationMs: number) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = frequency;
      osc.type = "sine";

      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.25, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);

      osc.start(now);
      osc.stop(now + durationMs / 1000 + 0.05);
    } catch {
      // Audio not critical; ignore failures in this prototype.
    }
  }, []);

  const handlePoseSample = useCallback(
    (sample: PoseSample) => {
      setRepState((prev) => {
        const result = processPoseSample(movement, prev, sample);
        if (result.repCompleted) {
          beep(880, 80);
          setMetrics((m) => ({ ...m, lastRepAt: Date.now() }));
        }
        if (result.invalidRep) {
          beep(330, 180);
          setMetrics((m) => ({ ...m, lastInvalidAt: Date.now() }));
        }
        return result.state;
      });
    },
    [beep, movement]
  );

  useEffect(() => {
    resetSession();
  }, [movement, resetSession]);

  const startCamera = useCallback(async () => {
    try {
      setCameraStatus("starting");
      setErrorMsg(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 720 },
          height: { ideal: 1280 }
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraStatus("running");

      if (videoRef.current) {
        poseHandleRef.current = startPosePipeline({
          video: videoRef.current,
          onPose: handlePoseSample
        });
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Could not start camera. Check permissions and try again.");
      setCameraStatus("error");
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, [stopCamera]);

  const feedbackSeverity =
    metrics.lastInvalidAt && metrics.lastInvalidAt > (metrics.lastRepAt ?? 0)
      ? "warn"
      : "ok";

  const feedbackText =
    feedbackSeverity === "warn"
      ? repState.lastInvalidReason ?? "Watch your movement standard."
      : "Standards look good on recent reps.";

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-title">HIIT E‑Judge Prototype</div>
        <div className="app-subtitle">
          Smartphone camera + rep counting + real-time standard reminders
        </div>
      </header>

      <section className="card">
        <div className="card-title">Movement</div>
        <div className="card-subtitle">
          Select one of the three functional movements targeted in the thesis.
        </div>
        <div className="mode-select">
          {(
            ["air_squat", "wall_ball", "deadlift"] as Movement[]
          ).map((m) => (
            <button
              key={m}
              className={`chip ${movement === m ? "chip-active" : ""}`}
              onClick={() => setMovement(m)}
              type="button"
            >
              {MOVEMENT_LABELS[m]}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-title">Camera & Pose</div>
        <div className="card-subtitle">
          Place your phone about 2–3 m away, with full body in view.
        </div>

        <div className="camera-container">
          <video ref={videoRef} className="camera-video" playsInline muted />
          <canvas className="overlay-canvas" />
        </div>

        <div className="status-row">
          <div>
            <span>Status: </span>
            <strong>
              {cameraStatus === "idle" && "Idle"}
              {cameraStatus === "starting" && "Starting…"}
              {cameraStatus === "running" && "Running"}
              {cameraStatus === "error" && "Error"}
            </strong>
          </div>
          <span
            className={`status-pill ${
              cameraStatus === "running"
                ? "status-pill-ok"
                : cameraStatus === "error"
                  ? "status-pill-error"
                  : "status-pill-warn"
            }`}
          >
            {cameraStatus === "running"
              ? "Tracking"
              : cameraStatus === "error"
                ? "Issue"
                : "Not tracking"}
          </span>
        </div>

        {errorMsg && (
          <div className="feedback-banner feedback-warn">
            <span className="feedback-strong">Camera issue</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="controls-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={cameraStatus === "running" || cameraStatus === "starting"}
            onClick={startCamera}
          >
            {cameraStatus === "idle" && "Start camera"}
            {cameraStatus === "starting" && "Starting…"}
            {cameraStatus === "running" && "Camera on"}
            {cameraStatus === "error" && "Retry camera"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              stopCamera();
              resetSession();
            }}
          >
            Reset session
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-title">Real-Time Feedback</div>
        <div className="card-subtitle">
          Counts reps and flags likely movement-standard issues.
        </div>

        <div className="metrics-grid">
          <div className="metric">
            <div className="metric-label">Reps</div>
            <div className="metric-value">{repState.repCount}</div>
            <div className="metric-tag">Total</div>
          </div>
          <div className="metric">
            <div className="metric-label">Likely No-Reps</div>
            <div className="metric-value">{repState.invalidCount}</div>
            <div className="metric-tag">Standard reminders</div>
          </div>
          <div className="metric">
            <div className="metric-label">Last Rep</div>
            <div className="metric-value">
              {metrics.lastRepAt
                ? `${Math.round((Date.now() - metrics.lastRepAt) / 1000)}s`
                : "–"}
            </div>
            <div className="metric-tag">Ago</div>
          </div>
        </div>

        <div
          className={`feedback-banner ${
            feedbackSeverity === "warn" ? "feedback-warn" : "feedback-ok"
          }`}
        >
          <span className="feedback-strong">
            {feedbackSeverity === "warn" ? "Standard reminder" : "Form OK"}
          </span>
          <span>{feedbackText}</span>
        </div>
      </section>

      <footer className="footer-note">
        Prototype for DA256X thesis — not an official judging system. Audio
        feedback requires sound on and may be reduced on some devices.
      </footer>
    </div>
  );
};

