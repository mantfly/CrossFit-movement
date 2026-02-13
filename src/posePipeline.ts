// This file sketches the integration point for a web pose-estimation library
// such as MediaPipe Pose. It exposes a minimal callback-based interface that
// the rest of the prototype can use without depending on a specific backend.

import type { PoseSample } from "./repLogic";

export type PoseCallback = (sample: PoseSample) => void;

export interface PosePipelineHandle {
  stop: () => void;
}

export interface StartPosePipelineParams {
  video: HTMLVideoElement;
  onPose: PoseCallback;
}

/**
 * Start a pose-estimation loop on top of a running video element.
 *
 * In a full implementation, this would:
 * - Load MediaPipe Pose (via CDN or npm)
 * - Create a Pose instance and connect it to the video frames
 * - Map pose landmarks to PoseSample and call onPose() on each frame
 *
 * For now, we implement a lightweight requestAnimationFrame loop that
 * is easy to replace with a real model later.
 */
export function startPosePipeline({
  video,
  onPose
}: StartPosePipelineParams): PosePipelineHandle {
  let stopped = false;

  const loop = () => {
    if (stopped) return;

    if (!video.videoWidth || !video.videoHeight) {
      requestAnimationFrame(loop);
      return;
    }

    // Placeholder: build a neutral sample that does not trigger reps.
    // This keeps the structure correct without faking counts.
    const neutral: PoseSample = {
      hipY: 0.5,
      kneeY: 0.6,
      shoulderY: 0.3
    };

    onPose(neutral);
    requestAnimationFrame(loop);
  };

  requestAnimationFrame(loop);

  return {
    stop() {
      stopped = true;
    }
  };
}

