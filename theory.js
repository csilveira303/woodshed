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
// Each mode's list is curated for that mode's own characteristic sound — not
// borrowed wholesale from a generic major/minor pool — so the random picker
// never lands on something that doesn't represent the mode.
//
// Chords are stored as roman numeral + semitone offset (from the block's
// root) + quality suffix, rather than pure diatonic scale degree, because
// several signature modal progressions intentionally borrow a chromatic
// quality for their characteristic color — e.g. Phrygian's Spanish/Andalusian
// cadence plays its bVII as major even though it's minor in strict natural
// Phrygian, and Mixolydian's heavier rock vamps borrow a bVI from the
// parallel minor. Quality suffixes match triadSuffix()/seventhSuffix() exactly
// so voicings and the 7th-chords toggle stay compatible.

const ROMAN_DEGREE = { I:1, II:2, III:3, IV:4, V:5, VI:6, VII:7 };

/** Extracts the base scale-degree number (1-7) from a roman numeral, ignoring
 *  any leading accidental (b/#) and trailing quality mark (°, m7, maj7...). */
function romanDegreeNumber(roman) {
  const m = /^[b#]*([ivIV]+)/.exec(roman);
  return ROMAN_DEGREE[(m ? m[1] : "I").toUpperCase()] || 1;
}

/** Diatonic degree index (0-6) for a semitone within a mode, or -1 if the
 *  chord isn't a note of that mode's scale (a chromatic borrowing). */
function diatonicDegreeIndex(scaleName, semitone) {
  return (SCALE_INTERVALS[scaleName] || SCALE_INTERVALS["Major (Ionian)"]).indexOf(semitone);
}

/** Upgrades a progression chord's triad quality to a 7th-chord quality for the
 *  7ths toggle. Uses the mode's own diatonic 7th quality when the chord is
 *  naturally diatonic (its given quality matches triadSuffix exactly);
 *  otherwise upgrades the given triad quality directly, since the chord's
 *  color there is a deliberate chromatic borrowing that seventhSuffix's
 *  diatonic table doesn't know about. */
function seventhQualityFor(scaleName, semitone, quality) {
  const degreeIdx = diatonicDegreeIndex(scaleName, semitone);
  if (degreeIdx !== -1 && triadSuffix(degreeIdx, scaleName) === quality) {
    return seventhSuffix(degreeIdx, scaleName);
  }
  if (quality === "") return "maj7";
  if (quality === "m") return "m7";
  if (quality === "°") return "m7b5";
  return quality; // already an extended quality (maj7, m7, ...) — leave as-is
}

export const IONIAN_PROGRESSIONS = [
  { name:"Classic Major",    romans:["I","IV","V"],                            semitones:[0,5,7],            qualities:["","",""],                    difficulty:"beginner",     feel:"The foundation of Western music — bright and resolved" },
  { name:"Pop Ballad",       romans:["I","V","vi","IV"],                       semitones:[0,7,9,5],          qualities:["","","m",""],                difficulty:"beginner",     feel:"Ubiquitous in pop — emotional but uplifting" },
  { name:"50s Progression",  romans:["I","vi","IV","V"],                       semitones:[0,9,5,7],          qualities:["","m","",""],                difficulty:"beginner",     feel:"Doo-wop, early rock and roll — nostalgic and warm" },
  { name:"ii–V–I",           romans:["ii","V","I"],                            semitones:[2,7,0],            qualities:["m","",""],                   difficulty:"intermediate", feel:"Jazz staple — strong sense of resolution" },
  { name:"Circle of Fifths", romans:["I","IV","vii°","iii","vi","ii","V","I"], semitones:[0,5,11,4,9,2,7,0], qualities:["","","°","m","m","m","",""], difficulty:"advanced",     feel:"Full diatonic circle — builds harmonic vocabulary" },
];

export const DORIAN_PROGRESSIONS = [
  { name:"Dorian Vamp",       romans:["i","IV"],             semitones:[0,5],      qualities:["m",""],         difficulty:"beginner",     feel:"The signature Dorian sound — minor i against major IV" },
  { name:"Soul Groove",       romans:["i","IV","i","IV"],    semitones:[0,5,0,5],  qualities:["m","","m",""],  difficulty:"beginner",     feel:"Repeated i–IV vamp — Santana, Herbie Hancock territory" },
  { name:"Dorian Turnaround", romans:["i","ii","IV","i"],    semitones:[0,2,5,0],  qualities:["m","m","","m"], difficulty:"intermediate", feel:"Uses the major II — highlights the Dorian flavor" },
  { name:"Modal Jazz",        romans:["i","IV","VII","III"], semitones:[0,5,10,3], qualities:["m","","",""],   difficulty:"advanced",     feel:"So What style — floating, no strong resolution" },
];

export const PHRYGIAN_PROGRESSIONS = [
  { name:"Phrygian Vamp",     romans:["i","bII"],              semitones:[0,1],      qualities:["m",""],       difficulty:"beginner",     feel:"The essential Phrygian sound — flamenco, metal" },
  { name:"Spanish Cadence",   romans:["i","bVII","bVI","bII"], semitones:[0,10,8,1], qualities:["m","","",""], difficulty:"intermediate", feel:"Andalusian descent — flamenco and classical Spanish" },
  { name:"Metal Riff",        romans:["i","bII","bVII","i"],   semitones:[0,1,10,0], qualities:["m","","","m"],difficulty:"intermediate", feel:"Heavy and dark — common in metal and film scores" },
  { name:"Phrygian Dominant", romans:["I","bII","i","bII"],    semitones:[0,1,0,1],  qualities:["","","m",""], difficulty:"advanced",     feel:"Major I against bII — Middle Eastern, exotic color" },
];

export const LYDIAN_PROGRESSIONS = [
  { name:"Lydian Float",    romans:["I","II"],                          semitones:[0,2],      qualities:["",""],                     difficulty:"beginner",     feel:"The Lydian signature — major I to major II, dreamy lift" },
  { name:"Film Score",      romans:["I","II","vii","I"],                semitones:[0,2,11,0], qualities:["","","m",""],              difficulty:"intermediate", feel:"Cinematic and expansive — John Williams territory" },
  { name:"Lydian Drift",    romans:["I","II","IV","I"],                 semitones:[0,2,6,0],  qualities:["","","°",""],              difficulty:"intermediate", feel:"Uses the #IV diminished — otherworldly and unresolved" },
  { name:"Neo-Soul Lydian", romans:["Imaj7","IImaj7","vii m7","Imaj7"], semitones:[0,2,11,0], qualities:["maj7","maj7","m7","maj7"], difficulty:"advanced",     feel:"Extended chords over Lydian — lush and sophisticated" },
];

export const MIXOLYDIAN_PROGRESSIONS = [
  { name:"Rock Vamp",         romans:["I","bVII"],              semitones:[0,10],      qualities:["",""],       difficulty:"beginner",     feel:"The rock and blues staple — Sweet Home Alabama, La Grange" },
  { name:"Southern Rock",     romans:["I","bVII","IV","I"],     semitones:[0,10,5,0],  qualities:["","","",""], difficulty:"beginner",     feel:"Classic southern rock — all major chords, bluesy feel" },
  { name:"Mixolydian Groove", romans:["I","IV","bVII","IV"],    semitones:[0,5,10,5],  qualities:["","","",""], difficulty:"intermediate", feel:"Rotating around bVII — funky and hypnotic" },
  { name:"Modal Rock",        romans:["I","bVII","bVI","bVII"], semitones:[0,10,8,10], qualities:["","","",""], difficulty:"intermediate", feel:"Adds the bVI — heavier, more dramatic color" },
];

export const AEOLIAN_PROGRESSIONS = [
  { name:"Natural Minor",    romans:["i","iv","v"],         semitones:[0,5,7],    qualities:["m","m","m"],   difficulty:"beginner",     feel:"Pure natural minor — dark and unresolved" },
  { name:"Minor Ballad",     romans:["i","VI","III","VII"], semitones:[0,8,3,10], qualities:["m","","",""],  difficulty:"beginner",     feel:"Emotional and cinematic — Stairway, Nothing Else Matters" },
  { name:"Andalusian",       romans:["i","VII","VI","v"],   semitones:[0,10,8,7], qualities:["m","","","m"], difficulty:"intermediate", feel:"Descending bass line — dramatic and classical" },
  { name:"Minor Turnaround", romans:["i","VI","VII","i"],   semitones:[0,8,10,0], qualities:["m","","","m"], difficulty:"intermediate", feel:"Circular and hypnotic — common in rock and pop" },
  { name:"ii°–v–i",          romans:["ii°","v","i"],        semitones:[2,7,0],    qualities:["°","m","m"],   difficulty:"advanced",     feel:"Natural minor ii–V–i — darker than harmonic minor version" },
];

export const LOCRIAN_PROGRESSIONS = [
  { name:"Locrian Vamp",    romans:["i°","bII"],              semitones:[0,1],      qualities:["°",""],        difficulty:"intermediate", feel:"Tense and unstable — the diminished i resolves nowhere" },
  { name:"Half-Diminished", romans:["i°","bVII","bVI","bII"], semitones:[0,10,8,1], qualities:["°","m","",""], difficulty:"intermediate", feel:"Used in jazz over m7b5 chords — dark and sophisticated" },
  { name:"Metal Locrian",   romans:["i°","bII","bV","bII"],   semitones:[0,1,6,1],  qualities:["°","","",""],  difficulty:"advanced",     feel:"Extreme dissonance — tritone relationships, avant-garde metal" },
];

const PROGRESSIONS_BY_SCALE = {
  "Major (Ionian)":  IONIAN_PROGRESSIONS,
  "Minor (Aeolian)": AEOLIAN_PROGRESSIONS,
  "Dorian":          DORIAN_PROGRESSIONS,
  "Phrygian":        PHRYGIAN_PROGRESSIONS,
  "Lydian":          LYDIAN_PROGRESSIONS,
  "Mixolydian":      MIXOLYDIAN_PROGRESSIONS,
  "Locrian":         LOCRIAN_PROGRESSIONS,
};

// Flat lookup by name — every progression name must be unique across all modes.
// Each entry is tagged with its home scaleName so a block that's pinned to a
// specific progression can also be pinned to that progression's mode (see
// scaleNameForProgression below) instead of landing on a random, mismatched one.
const ALL_PROGRESSIONS = {};
for (const [scaleName, list] of Object.entries(PROGRESSIONS_BY_SCALE)) {
  for (const p of list) ALL_PROGRESSIONS[p.name] = { ...p, scaleName };
}

export function progressionsFor(scaleName) {
  return PROGRESSIONS_BY_SCALE[scaleName] || IONIAN_PROGRESSIONS;
}

/** The mode a named progression belongs to, or null if the name isn't known. */
export function scaleNameForProgression(name) {
  return ALL_PROGRESSIONS[name]?.scaleName ?? null;
}

export function buildProgressionChords(rootName, scaleName, progressionName, use7ths) {
  const progression = ALL_PROGRESSIONS[progressionName] || IONIAN_PROGRESSIONS[0];
  return progression.romans.map((roman, i) => {
    const semitone  = progression.semitones[i];
    const degreeNum = romanDegreeNumber(roman);
    const quality   = use7ths
      ? seventhQualityFor(scaleName, semitone, progression.qualities[i])
      : progression.qualities[i];
    const root = spellChordTone(rootName, semitone, String(degreeNum));
    return { degree: degreeNum - 1, name: root + quality, root, quality };
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
  { label:"Mi13",      quality:"m13",     intervals:[0,3,7,10,2,9],   formula:"1-b3-5-b7-9-13" },
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
