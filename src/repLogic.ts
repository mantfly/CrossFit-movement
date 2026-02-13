export type Movement = "air_squat" | "wall_ball" | "deadlift";

export interface RepState {
  repCount: number;
  lastPhase: "top" | "bottom" | "unknown";
  invalidCount: number;
  lastInvalidReason: string | null;
}

export interface PoseSample {
  // Minimal subset of landmarks we care about, in pixel or normalized coordinates
  hipY: number;
  kneeY: number;
  shoulderY: number;
  barY?: number; // for deadlift (approx hands/bar)
}

export function createInitialRepState(): RepState {
  return {
    repCount: 0,
    lastPhase: "unknown",
    invalidCount: 0,
    lastInvalidReason: null
  };
}

interface Thresholds {
  squatDepthRatio: number;
  deadliftLockoutDelta: number;
}

const THRESHOLDS: Thresholds = {
  // hipY vs kneeY; larger means hip visually below knee in image coordinates
  squatDepthRatio: 0.04,
  // bar vs hip at top (deadlift)
  deadliftLockoutDelta: 0.03
};

export interface ProcessResult {
  state: RepState;
  repCompleted: boolean;
  invalidRep: boolean;
}

export function processPoseSample(
  movement: Movement,
  state: RepState,
  sample: PoseSample
): ProcessResult {
  switch (movement) {
    case "air_squat":
    case "wall_ball":
      return processSquatLike(movement, state, sample);
    case "deadlift":
      return processDeadlift(state, sample);
    default:
      return { state, repCompleted: false, invalidRep: false };
  }
}

function processSquatLike(
  movement: Movement,
  state: RepState,
  sample: PoseSample
): ProcessResult {
  const { hipY, kneeY } = sample;

  const atBottom = hipY - kneeY > THRESHOLDS.squatDepthRatio;
  const atTop = hipY <= kneeY;

  let repCompleted = false;
  let invalidRep = false;
  let newState: RepState = { ...state, lastInvalidReason: null };

  if (state.lastPhase === "top" && atBottom) {
    newState.lastPhase = "bottom";
  } else if (state.lastPhase === "bottom" && atTop) {
    repCompleted = true;
    newState.repCount += 1;
    newState.lastPhase = "top";

    const depthOk = hipY - kneeY > THRESHOLDS.squatDepthRatio;
    if (!depthOk) {
      invalidRep = true;
      newState.invalidCount += 1;
      newState.lastInvalidReason =
        movement === "air_squat" || movement === "wall_ball"
          ? "Squat depth likely too shallow"
          : "Depth issue";
    }
  } else if (state.lastPhase === "unknown") {
    newState.lastPhase = atTop ? "top" : atBottom ? "bottom" : "unknown";
  }

  return { state: newState, repCompleted, invalidRep };
}

function processDeadlift(state: RepState, sample: PoseSample): ProcessResult {
  const { hipY, shoulderY, barY } = sample;
  const barYVal = barY ?? hipY;

  const atBottom = barYVal > hipY;
  const atTop = barYVal <= hipY - THRESHOLDS.deadliftLockoutDelta;

  let repCompleted = false;
  let invalidRep = false;
  let newState: RepState = { ...state, lastInvalidReason: null };

  const torsoUprightEnough = shoulderY <= hipY - THRESHOLDS.deadliftLockoutDelta;

  if (state.lastPhase === "top" && atBottom) {
    newState.lastPhase = "bottom";
  } else if (state.lastPhase === "bottom" && atTop) {
    repCompleted = true;
    newState.repCount += 1;
    newState.lastPhase = "top";

    if (!torsoUprightEnough) {
      invalidRep = true;
      newState.invalidCount += 1;
      newState.lastInvalidReason =
        "Deadlift lockout: stand taller and open hips fully";
    }
  } else if (state.lastPhase === "unknown") {
    newState.lastPhase = atTop ? "top" : atBottom ? "bottom" : "unknown";
  }

  return { state: newState, repCompleted, invalidRep };
}

