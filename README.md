## HIIT E‑Judge Prototype (Thesis DA256X)

This folder contains the first prototype for the thesis **“Design and Evaluation of Real-Time Feedback for Movement Validity in Functional Fitness Training”**.

The goal of this prototype is to support:

- **Rep counting** for three functional fitness movements (air squat, wall ball, deadlift) using pose-based logic.
- **Lightweight movement-standard reminders** when reps likely do not meet a simple standard (e.g., squat depth, deadlift lockout).
- **Real-time feedback** through an on-screen UI and short audio beeps for reps vs likely “no-reps”.

### Tech stack

- **Web-based smartphone prototype** (runs in mobile browser)
- **React + TypeScript + Vite**
- **Pose estimation integration point** for e.g. MediaPipe Pose (see `src/posePipeline.ts`)

### How the prototype maps to thesis objectives

- **Objective 1 – Rep counting accuracy**
  - `src/repLogic.ts` implements a simple state-machine rep counter that consumes pose features (hip, knee, shoulder, bar heights). It is written to be compatible with live pose landmarks from MediaPipe or similar.
- **Objective 2 – “Standard reminder” detection**
  - The same file adds checks for key standards:
    - Air squat / wall ball: hip passes below knee (depth).
    - Deadlift: bar/hand height and torso uprightness at lockout.
  - Likely violations increment an “invalid” counter and record a reason string.
- **Objective 3 – Feedback design (audio + visual)**
  - `src/App.tsx`:
    - Visual: real-time counters for reps and likely “no-reps”, plus a banner summarizing recent standard feedback.
    - Audio: short high-pitch beep on each completed rep; lower, longer beep on likely invalid reps.
  - The layout is phone-oriented (single column, touch-friendly controls).
- **Objective 4 – Evaluation hooks**
  - The app is structured so that you can later:
    - Log pose samples + rep events (e.g., by extending `handlePoseSample` in `App.tsx`).
    - Export JSON/CSV for offline analysis and ground-truth comparison.

### Running the prototype

1. **Install dependencies**

   ```bash
   cd "/Users/cc/Documents/KTH/degree project/prototype"
   npm install
   ```

2. **Start the dev server**

   ```bash
   npm run dev
   ```

3. **Open on phone**

   - From your laptop, open the printed dev URL (e.g. `http://localhost:5173`).
   - For smartphone:
     - Either use the same network and open the machine’s IP with port 5173, or
     - Use a tunneling solution (ngrok, etc.) and open the URL on your phone.
   - Allow **camera access** when prompted.

### Connecting MediaPipe Pose (next step)

Right now `src/posePipeline.ts` runs a placeholder loop that calls `onPose` with a neutral pose sample (so it will not count reps). To connect a real model:

1. **Load MediaPipe Pose**
   - Via npm packages (`@mediapipe/pose`, `@mediapipe/camera_utils`) or via a CDN script in `index.html`.
2. **Implement landmark → `PoseSample` mapping**
   - In `startPosePipeline`, replace the placeholder `neutral` sample with code that:
     - Runs pose detection on the current video frame.
     - Derives vertical coordinates (e.g., normalized y) for:
       - Hip (e.g., average of left/right hip landmarks)
       - Knee (e.g., average of left/right knee landmarks)
       - Shoulder (e.g., average of left/right shoulder landmarks)
       - Optional “bar” (e.g., average of both hands for deadlift).
     - Passes those into `onPose({ hipY, kneeY, shoulderY, barY })`.
3. **Tune thresholds**
   - Adjust the constants in `THRESHOLDS` inside `src/repLogic.ts` based on pilot recordings and cross-checked ground truth.

### Files overview

- `index.html` – Vite entry, basic HTML shell.
- `src/App.tsx` – Main UI: movement selector, camera status, metrics, and real-time feedback.
- `src/main.tsx` – React entry point.
- `src/styles.css` – Mobile-first, dark UI tailored for HIIT use.
- `src/repLogic.ts` – Movement-specific rep counting and standard-reminder heuristics.
- `src/posePipeline.ts` – Abstraction layer where MediaPipe Pose (or similar) should be plugged in.

This prototype is intentionally minimal but end-to-end: from camera access, through pose hooks and rep logic, to real-time feedback, matching the structure described in the individual plan for the DA256X thesis.

