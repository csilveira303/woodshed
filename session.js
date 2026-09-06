// ─── session.js ───────────────────────────────────────────────────────────────
// Session builder and rhythm generator. Composes theory + fretboard into the
// 4-block practice session structure (Major, Minor, Mode1, Mode2).
// ─────────────────────────────────────────────────────────────────────────────

import { RANDOM_MODES, progressionsFor, buildScale, buildProgressionChords, rootNameForPitchClass, scaleNameForProgression } from "./theory.js";
import { buildPositionalVoicings, openVoicing, powerVoicing, fourthStringVoicing } from "./fretboard.js";

// ─── Techniques ───────────────────────────────────────────────────────────────
// Each voicing pass is played with a technique appropriate to how that chord
// shape is normally handled on the instrument (barre chords strummed, open
// chords often fingerpicked, power chords palm-muted).

export const TECHNIQUES = {
  strum: {
    label: "Strum",
    description: "Strum across all strings with pick or strumming hand",
    voicingAffinity: ["6th-anchored positional", "5th-anchored positional"],
  },
  pluck: {
    label: "Pluck",
    description: "Pick strings one at a time — play each note of the chord separately",
    voicingAffinity: ["Open chords"],
  },
  palmMute: {
    label: "Palm Mute",
    description: "Rest palm lightly on strings near bridge — produces muffled, percussive tone",
    voicingAffinity: ["Power chords"],
  },
};

// Weighted technique pool per voicing type. Format: [technique, weight].
const TECHNIQUE_WEIGHTS = {
  "Open chords":             [["strum", 50], ["pluck", 50]],
  "Power chords":            [["strum", 30], ["palmMute", 70]],
  "6th-anchored positional": [["strum", 100]],
  "5th-anchored positional": [["strum", 100]],
  "4th-anchored":            [["strum", 50], ["pluck", 50]],
};

export function suggestTechnique(voicingType) {
  const pool  = TECHNIQUE_WEIGHTS[voicingType] || [["strum", 100]];
  const total = pool.reduce((sum, [, w]) => sum + w, 0);
  let rand = Math.random() * total;
  for (const [technique, weight] of pool) {
    rand -= weight;
    if (rand <= 0) return technique;
  }
  return "strum";
}

// ─── Strum pattern generation ──────────────────────────────────────────────────
export const RHYTHM_STYLES = [
  "Straight 8ths",
  "Syncopated 8ths",
  "16th note groove",
  "Shuffle feel",
  "Quarter notes",
  "Off-beat emphasis",
];

// steps: number of cells shown per bar
// stepsPerBeat: how many steps equal one quarter note (controls metronome rate)
export const RHYTHM_META = {
  "Straight 8ths":    { steps:8,  stepsPerBeat:2, label:"8th notes — 1 bar" },
  "Syncopated 8ths":  { steps:8,  stepsPerBeat:2, label:"Syncopated 8ths — 1 bar" },
  "16th note groove": { steps:16, stepsPerBeat:4, label:"16th notes — 1 bar" },
  "Shuffle feel":     { steps:8,  stepsPerBeat:2, label:"Shuffle (triplet feel) — 1 bar" },
  "Quarter notes":    { steps:4,  stepsPerBeat:1, label:"Quarter notes — 1 bar" },
  "Off-beat emphasis":{ steps:8,  stepsPerBeat:2, label:"Off-beat 8ths — 1 bar" },
};

function generateStrumSteps(styleKey) {
  const { steps } = RHYTHM_META[styleKey] || RHYTHM_META["Straight 8ths"];
  const p = [];

  if (styleKey === "Straight 8ths") {
    for (let i = 0; i < steps; i++) {
      if (Math.random() < 0.07) p.push("—");
      else if (i % 2 === 0)     p.push("↓");
      else                       p.push(Math.random() > 0.3 ? "↑" : "—");
    }
  } else if (styleKey === "Syncopated 8ths") {
    for (let i = 0; i < steps; i++) {
      if (i % 2 === 0) p.push(Math.random() > 0.45 ? "↓" : "—");
      else              p.push(Math.random() > 0.2  ? "↑" : "↓");
    }
  } else if (styleKey === "16th note groove") {
    for (let i = 0; i < steps; i++) {
      if      (i % 4 === 0) p.push("↓");
      else if (i % 2 === 0) p.push(Math.random() > 0.5  ? "↑" : "↓");
      else                   p.push(Math.random() > 0.45 ? "↑" : "—");
    }
  } else if (styleKey === "Shuffle feel") {
    for (let i = 0; i < steps; i++) {
      if (i % 2 === 0) p.push("↓");
      else              p.push(Math.random() > 0.5 ? "↑" : "—");
    }
  } else if (styleKey === "Quarter notes") {
    for (let i = 0; i < steps; i++) p.push(Math.random() > 0.15 ? "↓" : "↑");
  } else { // Off-beat emphasis
    for (let i = 0; i < steps; i++) {
      if (i % 2 === 0) p.push(Math.random() > 0.5 ? "↓" : "—");
      else              p.push("↑");
    }
  }
  const meta = RHYTHM_META[styleKey] || RHYTHM_META["Straight 8ths"];
  return { steps: p, stepsPerBeat: meta.stepsPerBeat, label: styleKey };
}

// ─── Pluck pattern generation ──────────────────────────────────────────────────
// String-order sequence (strings numbered 1=high e … 6=low E). Always starts
// on the chord's bass string, then walks toward the treble strings and back.

function generatePluckSteps() {
  const bass    = Math.random() < 0.5 ? "6" : "5";
  const treble  = bass === "6" ? ["4","3","2","1"] : ["3","2","1"];
  const shape   = ["ascending","descending","alternating"][Math.floor(Math.random()*3)];
  const use8    = Math.random() < 0.5;

  let seq;
  if (shape === "ascending") {
    seq = [bass, ...treble, ...[...treble].reverse().slice(1)];
  } else if (shape === "descending") {
    const down = [...treble].reverse();
    seq = [bass, ...down, ...[...down].reverse().slice(1)];
  } else { // alternating
    const partner = treble[Math.floor(treble.length/2)];
    seq = [bass, partner, bass, partner, bass, partner, bass, partner];
  }

  const targetLen = use8 ? 8 : 4;
  const steps = [];
  for (let i = 0; i < targetLen; i++) steps.push(seq[i % seq.length]);

  return { steps, stepsPerBeat: 2, label: `Pluck — ${shape}` };
}

// ─── Palm mute pattern generation ──────────────────────────────────────────────
// Muted downstrokes on every beat, with occasional accents that lift the mute.

function generatePalmMuteSteps() {
  const steps = [];
  for (let i = 0; i < 8; i++) {
    if (i % 2 === 0) {
      const liftMute = Math.random() < 0.12;
      steps.push(liftMute ? "↓" : "PM↓");
    } else {
      steps.push(Math.random() > 0.4 ? "↑" : "—");
    }
  }
  return { steps, stepsPerBeat: 2, label: "Palm Mute — chug" };
}

// ─── Rhythm dispatcher ──────────────────────────────────────────────────────────
/**
 * Generates a rhythm pattern object for the given technique.
 * `styleKey` only matters for technique "strum" (selects which of the 6
 * strum styles to use); it's ignored for "pluck" and "palmMute".
 */
export function generateRhythm(styleKey, technique = "strum") {
  const gen = technique === "pluck"    ? generatePluckSteps()
            : technique === "palmMute" ? generatePalmMuteSteps()
            :                            generateStrumSteps(styleKey);
  return {
    technique,
    steps:        gen.steps,
    stepsPerBeat: gen.stepsPerBeat,
    styleLabel:   gen.label,
    description:  TECHNIQUES[technique].description,
  };
}

// ─── Voicing passes ───────────────────────────────────────────────────────────
// Triads: 5 passes — 6th-anchored, 5th-anchored, 4th-anchored, open chords, power chords
// 7ths:   3 passes — 6th-anchored, 5th-anchored, 4th-anchored

export function getVoicingPasses(use7ths) {
  if (use7ths) {
    return [
      { type:"6th-anchored positional" },
      { type:"5th-anchored positional" },
      { type:"4th-anchored" },
    ];
  }
  return [
    { type:"6th-anchored positional" },
    { type:"5th-anchored positional" },
    { type:"4th-anchored" },
    { type:"Open chords" },
    { type:"Power chords" },
  ];
}

// ─── Session builder ──────────────────────────────────────────────────────────
function pickRandom(arr, exclude = []) {
  const pool = arr.filter(x => !exclude.includes(x));
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Builds a complete 4-block practice session.
 *
 * @param {boolean} use7ths      - When true, 2 of the 4 blocks (chosen at random) use
 *                                 7th chord quality instead of triads; when false, all
 *                                 4 blocks use triads.
 * @param {string[]} progsOverride - Array of 4 progression names or "Random"
 * @returns Session object with blocks (each block carries its own use7ths/voicing count)
 */
export function buildSession(use7ths, progsOverride) {
  const allKeys = [0,1,2,3,4,5,6,7,8,9,10,11];

  // A pitch class's correct spelling depends on which mode it's the tonic of
  // (e.g. pitch class 8 is "Ab" as a major tonic but "G#" as an Aeolian tonic,
  // since its parent key there is B major, not Ab major) — so derive each
  // block's root from that block's own scale spelling, not a fixed table.
  function rootNameForMode(pc, scaleName) {
    return buildScale(rootNameForPitchClass(pc), scaleName)[0];
  }

  const majorKeyPC = pickRandom(allKeys);
  const minorKeyPC = pickRandom(allKeys, [majorKeyPC]);
  const majorKey   = rootNameForMode(majorKeyPC, "Major (Ionian)");
  const minorKey   = rootNameForMode(minorKeyPC, "Minor (Aeolian)");

  // A pinned (non-Random) progression for Mode 1/2 belongs to one specific
  // mode — use that mode for the block instead of re-randomizing it, or the
  // block could land on a different mode than the progression it's showing.
  const pinnedMode1 = progsOverride?.[2] && progsOverride[2] !== "Random" ? scaleNameForProgression(progsOverride[2]) : null;
  const pinnedMode2 = progsOverride?.[3] && progsOverride[3] !== "Random" ? scaleNameForProgression(progsOverride[3]) : null;

  const mode1      = pinnedMode1 || pickRandom(RANDOM_MODES);
  const mode2      = pinnedMode2 || pickRandom(RANDOM_MODES, [mode1]);
  const mode1Key   = rootNameForMode(pickRandom(allKeys), mode1);
  const mode2Key   = rootNameForMode(pickRandom(allKeys), mode2);

  const scaleNames = ["Major (Ionian)", "Minor (Aeolian)", mode1, mode2];
  const progNames  = (progsOverride || ["Random","Random","Random","Random"]).map((p, bi) =>
    (!p || p === "Random")
      ? pickRandom(progressionsFor(scaleNames[bi]).map(p => p.name))
      : p
  );

  // When the 7th-chords toggle is on, 2 of the 4 blocks (chosen at random) use
  // 7th chord quality; the other 2 stay triads. Each block keeps its own
  // voicing-pass list since 7th-chord blocks skip Open/Power chord passes.
  const seventhBlocks = [];
  if (use7ths) {
    const first = pickRandom([0,1,2,3]);
    seventhBlocks.push(first, pickRandom([0,1,2,3], [first]));
  }

  const usedStrumStyles = [];

  function buildRhythmForPass(passType) {
    const suggestedTechnique = suggestTechnique(passType);
    if (suggestedTechnique !== "strum") {
      return { rhythm: generateRhythm(undefined, suggestedTechnique), suggestedTechnique };
    }
    const style = pickRandom(
      RHYTHM_STYLES,
      usedStrumStyles.length < RHYTHM_STYLES.length ? usedStrumStyles : []
    );
    usedStrumStyles.push(style);
    return { rhythm: generateRhythm(style, "strum"), suggestedTechnique };
  }

  function buildBlock(rootKey, scaleName, progName, blockUse7ths) {
    const scale  = buildScale(rootKey, scaleName);
    const chords = buildProgressionChords(rootKey, scaleName, progName, blockUse7ths);
    const passes = getVoicingPasses(blockUse7ths);

    const voicings = passes.map(pass => {
      let chordShapes;
      if      (pass.type === "6th-anchored positional") chordShapes = buildPositionalVoicings(chords, 6);
      else if (pass.type === "5th-anchored positional") chordShapes = buildPositionalVoicings(chords, 5);
      else if (pass.type === "4th-anchored")  chordShapes = chords.map(c => ({ ...c, voicing: fourthStringVoicing(c.root, c.quality) }));
      else if (pass.type === "Open chords")   chordShapes = chords.map(c => ({ ...c, voicing: openVoicing(c.root, c.quality) }));
      else                                    chordShapes = chords.map(c => ({ ...c, voicing: powerVoicing(c.root) }));
      const { rhythm, suggestedTechnique } = buildRhythmForPass(pass.type);
      return { type: pass.type, rhythm, suggestedTechnique, chordShapes };
    });

    return { rootKey, scaleName, scale, progressionName: progName, chords, voicings, use7ths: blockUse7ths };
  }

  return {
    blocks: [
      buildBlock(majorKey,  "Major (Ionian)",  progNames[0], seventhBlocks.includes(0)),
      buildBlock(minorKey,  "Minor (Aeolian)",  progNames[1], seventhBlocks.includes(1)),
      buildBlock(mode1Key,  mode1,              progNames[2], seventhBlocks.includes(2)),
      buildBlock(mode2Key,  mode2,              progNames[3], seventhBlocks.includes(3)),
    ],
  };
}
