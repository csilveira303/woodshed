// ─── theory.js ────────────────────────────────────────────────────────────────
// Pure music theory data and functions. No React, no fretboard geometry.
// All scale/chord/progression logic lives here.
// ─────────────────────────────────────────────────────────────────────────────

export const NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

// ─── Scales ───────────────────────────────────────────────────────────────────
export const SCALE_INTERVALS = {
  "Major (Ionian)":  [0,2,4,5,7,9,11],
  "Minor (Aeolian)": [0,2,3,5,7,8,10],
  "Dorian":          [0,2,3,5,7,9,10],
  "Phrygian":        [0,1,3,5,7,8,10],
  "Lydian":          [0,2,4,6,7,9,11],
  "Mixolydian":      [0,2,4,5,7,9,10],
  "Locrian":         [0,1,3,5,6,8,10],
};

export const MODES       = Object.keys(SCALE_INTERVALS);
// Locrian excluded for now — rarely used in real music, not worth surfacing
// in random Mode 1/2 practice blocks. Scale data stays intact above.
export const RANDOM_MODES = MODES.filter(
  m => m !== "Major (Ionian)" && m !== "Minor (Aeolian)" && m !== "Locrian"
);

// Semitone offset of each mode within its parent major scale.
// Used to compute the relative/parent major key root.
// e.g. A Minor (Aeolian) offset=9 → parent = A − 9 semitones = C major
export const MODE_OFFSET = {
  "Major (Ionian)":  0,
  "Dorian":          2,
  "Phrygian":        4,
  "Lydian":          5,
  "Mixolydian":      7,
  "Minor (Aeolian)": 9,
  "Locrian":         11,
};

// ─── Note spelling ──────────────────────────────────────────────────────────
// Real scale/chord spelling uses each letter A–G exactly once, with accidentals
// chosen to match the actual pitch — NOTES[] above is only a chromatic pitch-class
// table and must never be used directly to name a note shown to the user.

const NATURAL_PITCH = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };

/** Parses any spelling (naturals, sharps, flats, e.g. "Gb", "E#", "Cb") to 0-11. */
export function noteNameToPitchClass(name) {
  let pc = NATURAL_PITCH[name[0]];
  for (const ch of name.slice(1)) pc += ch === "#" ? 1 : ch === "b" ? -1 : 0;
  return (pc + 120) % 12;
}

// The 12 standard major keys, indexed by tonic pitch class. Conventional picks
// for the enharmonic keys: F# over Gb, Db over C#, B over Cb.
export const MAJOR_KEY_SPELLING = [
  ["C","D","E","F","G","A","B"],           // 0
  ["Db","Eb","F","Gb","Ab","Bb","C"],      // 1
  ["D","E","F#","G","A","B","C#"],         // 2
  ["Eb","F","G","Ab","Bb","C","D"],        // 3
  ["E","F#","G#","A","B","C#","D#"],       // 4
  ["F","G","A","Bb","C","D","E"],          // 5
  ["F#","G#","A#","B","C#","D#","E#"],     // 6  (E#, not F — keeps letters unique)
  ["G","A","B","C","D","E","F#"],          // 7
  ["Ab","Bb","C","Db","Eb","F","G"],       // 8
  ["A","B","C#","D","E","F#","G#"],        // 9
  ["Bb","C","D","Eb","F","G","A"],         // 10
  ["B","C#","D#","E","F#","G#","A#"],      // 11
];

/** Canonical tonic spelling for a pitch class (used for session/theory root pickers). */
export function rootNameForPitchClass(pc) {
  return MAJOR_KEY_SPELLING[pc][0];
}

/**
 * Spells a diatonic mode's 7 notes correctly: every mode is a rotation of its
 * parent major key's spelling (see MODE_OFFSET), so this looks up the parent
 * key's spelling and rotates it to start at the mode's own tonic.
 */
export function spellScale(rootPitchClass, scaleName) {
  const parentPC = (rootPitchClass - (MODE_OFFSET[scaleName] || 0) + 12) % 12;
  const parentSpelling = MAJOR_KEY_SPELLING[parentPC];
  const idx = parentSpelling.findIndex(n => noteNameToPitchClass(n) === rootPitchClass);
  return [...parentSpelling.slice(idx), ...parentSpelling.slice(0, idx)];
}

// Letter distance (0-6) for each interval "number" — a 3rd is always 2 letters
// up from the root, a 5th 4 letters up, etc., regardless of accidental.
const LETTER_STEPS = { 1:0, 2:1, 3:2, 4:3, 5:4, 6:5, 7:6, 9:1, 11:3, 13:5 };
const LETTERS = "CDEFGAB";

/**
 * Spells an arbitrary chord tone (used by the freeform Theory tab, which has
 * no parent key to rotate) by stacking the interval's letter distance from the
 * root, then picking the accidental that matches the actual pitch.
 */
export function spellChordTone(rootName, semitone, intervalName) {
  const degreeNum = parseInt(intervalName.replace(/[^\d]/g, ""), 10);
  const steps  = LETTER_STEPS[degreeNum] ?? 0;
  const letter = LETTERS[(LETTERS.indexOf(rootName[0]) + steps) % 7];
  const naturalPC = NATURAL_PITCH[letter];
  const targetPC  = (noteNameToPitchClass(rootName) + semitone) % 12;
  const accidental = (((targetPC - naturalPC + 18) % 12) - 6);
  return letter + (accidental > 0 ? "#".repeat(accidental) : accidental < 0 ? "b".repeat(-accidental) : "");
}

/** Returns the parent major scale root name, or null for Ionian itself. */
export function parentMajor(rootName, scaleName) {
  if (scaleName === "Major (Ionian)") return null;
  const rootIdx = noteNameToPitchClass(rootName);
  const offset  = MODE_OFFSET[scaleName] || 0;
  return rootNameForPitchClass((rootIdx - offset + 12) % 12);
}

export function buildScale(rootName, scaleName) {
  const rootIdx = noteNameToPitchClass(rootName);
  return spellScale(rootIdx, scaleName);
}

// ─── Chord qualities per scale degree ─────────────────────────────────────────
// Returns the suffix string (e.g. "m", "°", "maj7") for a given degree and scale.

export function triadSuffix(degreeIdx, scaleName) {
  const map = {
    "Major (Ionian)":  ["",  "m","m","",  "","m","°"],
    "Minor (Aeolian)": ["m","°", "","m","m","","" ],
    "Dorian":          ["m","m", "","",  "m","°",""],
    "Phrygian":        ["m","",  "","m", "°","","m"],
    "Lydian":          ["",  "","m","°","","m","m"],
    "Mixolydian":      ["",  "m","°","","m","m",""],
    "Locrian":         ["°","",  "m","m","","","m"],
  };
  return (map[scaleName] || map["Major (Ionian)"])[degreeIdx] ?? "";
}

export function seventhSuffix(degreeIdx, scaleName) {
  const map = {
    "Major (Ionian)":  ["maj7","m7","m7","maj7","7",   "m7","m7b5"],
    "Minor (Aeolian)": ["m7","m7b5","maj7","m7","m7","maj7","7"   ],
    "Dorian":          ["m7","m7","maj7","7","m7","m7b5","maj7"   ],
    "Phrygian":        ["m7","maj7","7","m7","m7b5","maj7","m7"   ],
    "Lydian":          ["maj7","7","m7","m7b5","maj7","m7","m7"   ],
    "Mixolydian":      ["7","m7","m7b5","maj7","m7","m7","maj7"   ],
    "Locrian":         ["m7b5","maj7","m7","m7","maj7","7","m7"   ],
  };
  return (map[scaleName] || map["Major (Ionian)"])[degreeIdx] ?? "7";
}

// ─── Progressions ─────────────────────────────────────────────────────────────
// Degree indices (0-based) into the scale. Each mode gets its own curated list
// of progressions actually used in real playing for that mode's characteristic
// sound — not borrowed wholesale from a generic major/minor pool — so the
// random picker never lands on something that doesn't represent the mode.
// Roman numeral case matches that mode's own triadSuffix() qualities exactly.

export const MAJOR_PROGRESSIONS = {
  "I – IV – V":        [0,3,4],
  "I – V – vi – IV":   [0,4,5,3],
  "I – IV – vi – V":   [0,3,5,4],
  "I – vi – IV – V":   [0,5,3,4],
  "ii – V – I":        [1,4,0],
  "I – iii – IV – V":  [0,2,3,4],
  "I – IV – ii – V":   [0,3,1,4],
  "vi – IV – I – V":   [5,3,0,4],
};

export const MINOR_PROGRESSIONS = {
  "i – iv – v":         [0,3,4],
  "i – VI – III – VII": [0,5,2,6],
  "i – VII – VI – VII": [0,6,5,6],
  "i – iv – VII – III": [0,3,6,2],
  "i – v – VI – VII":   [0,4,5,6],
  "ii° – v – i":        [1,4,0],
  "i – VI – VII – i":   [0,5,6,0],
  "i – III – VII – VI": [0,2,6,5],
};

// Dorian's signature is the major IV over a minor i (the classic modal vamp
// heard in "So What", "Oye Como Va", "Riders on the Storm"). vi° (diminished)
// is skipped — too unstable for a strummed vamp.
export const DORIAN_PROGRESSIONS = {
  "i – IV – i":       [0,3,0],
  "i – VII – IV":     [0,6,3],
  "i – IV – VII":     [0,3,6],
  "i – ii – IV":      [0,1,3],
  "i – v – IV":       [0,4,3],
  "i – IV – v – i":   [0,3,4,0],
  "i – III – VII":    [0,2,6],
  "ii – IV – i":      [1,3,0],
};

// Phrygian's signature is the major II a half-step above the tonic (the
// flamenco/metal "flat 2" color). v° is skipped — too unstable to vamp on.
export const PHRYGIAN_PROGRESSIONS = {
  "i – II – i":        [0,1,0],
  "i – VI – vii":      [0,5,6],
  "i – II – III":      [0,1,2],
  "i – iv – i":        [0,3,0],
  "i – VI – II – i":   [0,5,1,0],
  "III – II – i":      [2,1,0],
  "i – vii – VI":      [0,6,5],
  "i – II – vii – i":  [0,1,6,0],
};

// Lydian's signature is the major II (from the raised 4th) giving a bright,
// floaty I–II color. iv° (diminished, built on the raised 4th itself) and the
// minor vii are skipped — neither is used in a typical Lydian vamp.
export const LYDIAN_PROGRESSIONS = {
  "I – II – I":       [0,1,0],
  "I – II – V":       [0,1,4],
  "I – V – II – I":   [0,4,1,0],
  "I – vi – II":      [0,5,1],
  "I – iii – II":     [0,2,1],
  "I – II – vi – V":  [0,1,5,4],
  "vi – II – I":      [5,1,0],
};

// Mixolydian's signature is the major bVII (THE classic rock/blues dominant
// vamp: I–bVII–IV). iii° is skipped — too unstable to vamp on.
export const MIXOLYDIAN_PROGRESSIONS = {
  "I – VII – IV":       [0,6,3],
  "I – IV – VII – I":   [0,3,6,0],
  "I – v – IV":         [0,4,3],
  "I – ii – IV":        [0,1,3],
  "I – VII – IV – VII": [0,6,3,6],
  "I – IV – v – VII":   [0,3,4,6],
  "vi – IV – I – VII":  [5,3,0,6],
  "I – VII – I":        [0,6,0],
};

// Locrian's tonic itself is diminished, so it's rarely used as a true "home"
// vamp — these lean on its other diatonic chords, with i° appearing only as
// a color/cadence point rather than something to rest on.
export const LOCRIAN_PROGRESSIONS = {
  "II – V – i°":    [1,4,0],
  "iv – V – II":    [3,4,1],
  "VI – vii – i°":  [5,6,0],
  "II – iii – iv":  [1,2,3],
  "iv – II – V":    [3,1,4],
  "VI – iv – II":   [5,3,1],
};

const PROGRESSIONS_BY_SCALE = {
  "Major (Ionian)":  MAJOR_PROGRESSIONS,
  "Minor (Aeolian)": MINOR_PROGRESSIONS,
  "Dorian":          DORIAN_PROGRESSIONS,
  "Phrygian":        PHRYGIAN_PROGRESSIONS,
  "Lydian":          LYDIAN_PROGRESSIONS,
  "Mixolydian":      MIXOLYDIAN_PROGRESSIONS,
  "Locrian":         LOCRIAN_PROGRESSIONS,
};

// Combined lookup — all keys must be unique across all tables above.
export const ALL_PROGRESSIONS = Object.assign({}, ...Object.values(PROGRESSIONS_BY_SCALE));

export function progressionsFor(scaleName) {
  return PROGRESSIONS_BY_SCALE[scaleName] || MAJOR_PROGRESSIONS;
}

export function buildProgressionChords(rootName, scaleName, progressionName, use7ths) {
  const scale   = buildScale(rootName, scaleName);
  const degrees = ALL_PROGRESSIONS[progressionName] || [0,3,4];
  return degrees.map(d => {
    const quality = use7ths ? seventhSuffix(d, scaleName) : triadSuffix(d, scaleName);
    return { degree: d, name: scale[d] + quality, root: scale[d], quality };
  });
}

// ─── Degree labels per scale ───────────────────────────────────────────────────
export const DEGREE_LABELS_BY_SCALE = {
  "Major (Ionian)":  ["I",  "ii", "iii","IV", "V",  "vi", "vii°"],
  "Minor (Aeolian)": ["i",  "ii°","III","iv", "v",  "VI", "VII" ],
  "Dorian":          ["i",  "ii", "III","IV", "v",  "vi°","VII" ],
  "Phrygian":        ["i",  "II", "III","iv", "v°", "VI", "vii" ],
  "Lydian":          ["I",  "II", "iii","iv°","V",  "vi", "vii" ],
  "Mixolydian":      ["I",  "ii", "iii°","IV","v",  "vi", "VII" ],
  "Locrian":         ["i°", "II", "iii","iv", "V",  "VI", "vii" ],
};

// ─── Chord Theory vocabulary ───────────────────────────────────────────────────
// All 32 chord types from the chord theory reference chart.
// intervals: semitone offsets from root (all within 0–11, extensions collapsed).
// formula:   human-readable interval string shown in the theory UI.

export const THEORY_CHORD_TYPES = [
  // Triads
  { label:"Ma",        quality:"",        intervals:[0,4,7],          formula:"1-3-5" },
  { label:"Mi",        quality:"m",       intervals:[0,3,7],          formula:"1-b3-5" },
  { label:"Dim",       quality:"°",       intervals:[0,3,6],          formula:"1-b3-b5" },
  { label:"Aug",       quality:"+",       intervals:[0,4,8],          formula:"1-3-#5" },
  // 6th & 6/9
  { label:"Ma6",       quality:"maj6",    intervals:[0,4,7,9],        formula:"1-3-5-6" },
  { label:"Mi6",       quality:"m6",      intervals:[0,3,7,9],        formula:"1-b3-5-6" },
  { label:"Ma6/9",     quality:"6/9",     intervals:[0,4,7,9,2],      formula:"1-3-5-6-9" },
  { label:"Mi6/9",     quality:"m6/9",    intervals:[0,3,7,9,2],      formula:"1-b3-5-6-9" },
  // Sus & Add
  { label:"Sus2",      quality:"sus2",    intervals:[0,2,7],          formula:"1-2-5" },
  { label:"Sus4",      quality:"sus4",    intervals:[0,5,7],          formula:"1-4-5" },
  { label:"Ma.add9",   quality:"add9",    intervals:[0,4,7,2],        formula:"1-3-5-9" },
  { label:"Mi.add9",   quality:"madd9",   intervals:[0,3,7,2],        formula:"1-b3-5-9" },
  { label:"Ma.add11",  quality:"add11",   intervals:[0,4,7,5],        formula:"1-3-5-11" },
  { label:"Mi.add11",  quality:"madd11",  intervals:[0,3,7,5],        formula:"1-b3-5-11" },
  // Power
  { label:"Power",     quality:"5",       intervals:[0,7],            formula:"1-5" },
  // 7th
  { label:"Ma7",       quality:"maj7",    intervals:[0,4,7,11],       formula:"1-3-5-7" },
  { label:"Mi7",       quality:"m7",      intervals:[0,3,7,10],       formula:"1-b3-5-b7" },
  { label:"Dom7",      quality:"7",       intervals:[0,4,7,10],       formula:"1-3-5-b7" },
  { label:"Mi7b5",     quality:"m7b5",    intervals:[0,3,6,10],       formula:"1-b3-b5-b7" },
  { label:"Dim7",      quality:"dim7",    intervals:[0,3,6,9],        formula:"1-b3-b5-bb7" },
  // 9th
  { label:"Ma9",       quality:"maj9",    intervals:[0,4,7,11,2],     formula:"1-3-5-7-9" },
  { label:"Mi9",       quality:"m9",      intervals:[0,3,7,10,2],     formula:"1-b3-5-b7-9" },
  { label:"Dom9",      quality:"9",       intervals:[0,4,7,10,2],     formula:"1-3-5-b7-9" },
  // 11th
  { label:"Ma7#11",    quality:"maj7#11", intervals:[0,4,7,11,6],     formula:"1-3-5-7-#11" },
  { label:"Dom7#11",   quality:"7#11",    intervals:[0,4,7,10,6],     formula:"1-3-5-b7-#11" },
  { label:"Mi11",      quality:"m11",     intervals:[0,3,7,10,5],     formula:"1-b3-5-b7-11" },
  // 13th
  { label:"Ma13",      quality:"maj13",   intervals:[0,4,7,11,2,9],   formula:"1-3-5-7-9-13" },
  { label:"Dom13",     quality:"13",      intervals:[0,4,7,10,2,9],   formula:"1-3-5-b7-9-13" },
  { label:"Mi13",      quality:"m13",     intervals:[0,3,7,10,2,5],   formula:"1-b3-5-b7-9-11" },
  // #11
  { label:"Ma9#11",    quality:"maj9#11", intervals:[0,4,7,11,2,6],   formula:"1-3-5-7-9-#11" },
  { label:"Dom9#11",   quality:"9#11",    intervals:[0,4,7,10,2,6],   formula:"1-3-5-b7-9-#11" },
  { label:"Ma13#11",   quality:"maj13#11",intervals:[0,4,7,11,2,9,6], formula:"1-3-5-7-9-13-#11" },
  { label:"Dom13#11",  quality:"13#11",   intervals:[0,4,7,10,2,9,6], formula:"1-3-5-b7-9-13-#11" },
];

// Semitone → interval name (context-free).
// For chords where semitone 9 = "6" vs "13", or 2 = "2" vs "9",
// use getIntervalName(semitone, quality) instead.
export const INTERVAL_NAMES = {
  0:"R", 1:"b2", 2:"9", 3:"b3", 4:"3", 5:"11",
  6:"#11", 7:"5", 8:"#5", 9:"13", 10:"b7", 11:"7",
};

/** Context-aware interval label. Handles 6 vs 13, 2 vs 9, 4 vs 11. */
export function getIntervalName(semitone, quality) {
  if (semitone === 9 && (quality.includes("6") || quality === "dim7")) return "6";
  if (semitone === 2 && (quality === "sus2" || quality === "add9"  || quality === "madd9"))  return "2";
  if (semitone === 5 && (quality === "sus4" || quality === "add11" || quality === "madd11")) return "4";
  return INTERVAL_NAMES[semitone] || "?";
}

export const INTERVAL_COLORS = {
  "R":   "#b87333",
  "b3":  "#7ab8c8", "3":   "#7ab8c8",
  "4":   "#7ab8c8", "2":   "#7ab8c8",
  "9":   "#7ab8c8", "b2":  "#7ab8c8",
  "5":   "#4aaa6a",
  "b5":  "#aa4a6a", "#5":  "#aa4a6a",
  "b7":  "#8a6aaa", "7":   "#8a6aaa", "bb7": "#8a6aaa",
  "6":   "#c8c87a", "13":  "#c8c87a",
  "11":  "#c87ac8", "#11": "#c87ac8",
};
