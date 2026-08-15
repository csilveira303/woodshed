// ─── audio.js ─────────────────────────────────────────────────────────────────
// Web Audio click-track scheduler for the metronome. No React.
// Uses the standard lookahead-scheduling pattern so timing stays sample-accurate
// instead of drifting the way a plain setInterval-driven click would.
// ─────────────────────────────────────────────────────────────────────────────

const LOOKAHEAD_MS       = 25;   // how often the scheduler polls
const SCHEDULE_AHEAD_SEC = 0.1;  // how far ahead of "now" we schedule audio events

function playClick(ctx, time, accented) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = accented ? 1500 : 1000;
  gain.gain.setValueAtTime(accented ? 0.6 : 0.35, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
  osc.connect(gain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.05);
}

/**
 * Creates a click-track scheduler. `onStep(stepIndex)` fires once per pattern
 * step, timed to match when that step's audio (if any) actually plays.
 */
export function createClickScheduler({ onStep }) {
  let ctx            = null;
  let timerId         = null;
  let nextStepTime    = 0;
  let stepIndex       = 0;
  let patternLength   = 1;
  let stepsPerBeat    = 2;
  let stepDurationSec = 0.25;

  function tick() {
    while (nextStepTime < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      const isBeat = stepIndex % stepsPerBeat === 0;
      if (isBeat) playClick(ctx, nextStepTime, stepIndex === 0);

      const step = stepIndex;
      const delayMs = Math.max(0, (nextStepTime - ctx.currentTime) * 1000);
      setTimeout(() => onStep(step), delayMs);

      stepIndex    = (stepIndex + 1) % patternLength;
      nextStepTime += stepDurationSec;
    }
  }

  return {
    start(msPerStep, totalSteps, stepsPerBeatArg) {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") ctx.resume();

      stepDurationSec = msPerStep / 1000;
      patternLength   = totalSteps;
      stepsPerBeat    = stepsPerBeatArg;
      stepIndex       = 0;
      nextStepTime    = ctx.currentTime + 0.05;

      clearInterval(timerId);
      timerId = setInterval(tick, LOOKAHEAD_MS);
      tick();
    },

    updateTiming(msPerStep, totalSteps, stepsPerBeatArg) {
      stepDurationSec = msPerStep / 1000;
      patternLength   = totalSteps;
      stepsPerBeat    = stepsPerBeatArg;
    },

    stop() {
      clearInterval(timerId);
      timerId = null;
    },
  };
}
