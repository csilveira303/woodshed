// ─── fretboard.js ─────────────────────────────────────────────────────────────
// Fretboard geometry, string/fret math, chord voicing shapes, and positional
// scale/chord algorithms. No React.
//
// KEY DESIGN DECISIONS — read before modifying:
//
// 1. STRING NUMBERING: str6 = low E (thickest), str1 = high e (thinnest).
//    STRING_OPEN_NOTE[strNum] gives the open note as a semitone index.
//    This is different from OPEN_STRINGS[] which is indexed by loop variable s
//    (used only in getScalePositions for legacy reasons).
//
// 2. FRET ZERO → FRET 12: fretOnString() and simpleFret() return 12 instead of 0
//    when a note falls on the open string. This keeps all positional shapes in
//    barre-chord territory (frets 1–15) so the fretboard window stays consistent.
//    Do NOT change this back to returning 0 — it breaks E major and similar keys.
//
// 3. POSITIONAL SCALE ALGORITHM:
//    - I, ii  → always on 6th string, ii above root using fretAboveMin()
//    - iii, IV, V → always on 5th string, placed using fretInRegion5()
//    - vi, vii → 6th string (below root) if both frets ≥ 1; else both on 5th string
//    fretInRegion5(noteIdx, rf6): if the note's natural 5th-string fret is more
//    than 5 frets below root-on-6th, add 12 to bring it into the same position box.
//    This is validated: IV fret === I fret, V fret === ii fret for all major/minor keys.
//
// 4. CHORD VOICING SHAPES: shape[] arrays use offset from baseFret.
//    shape[0] = str6 (low E), shape[5] = str1 (high e). null = muted.
//    For standard barre chords baseFret = root fret on that string.
//    Exception: m7b5 on 6th string has B-string one fret below root, so
//    shape = [0,null,1,1,0,null] at baseFret = rootFret (no adjustment needed).
//
// 5. OPEN CHORD DB: Only genuine cowboy/open-position shapes.
//    F: D-string root at fret 3, partial barre at fret 1 (user-specified).
//    B: D-string root at fret 4 (user-specified). Bm: D-string root at fret 4.
//    Anything not in the DB falls back to the lowest available barre position.
// ─────────────────────────────────────────────────────────────────────────────

import {
  SCALE_INTERVALS, getIntervalName,
  noteNameToPitchClass, buildScale, spellChordTone,
  triadSuffix, seventhSuffix,
} from "./theory.js";

// ─── String tuning ────────────────────────────────────────────────────────────
// Open string notes by string number (str6=low E, str1=high e).
// Values are chromatic pitch classes (0-11, C=0).
// str1(e)=4, str2(B)=11, str3(G)=7, str4(D)=2, str5(A)=9, str6(E)=4
export const STRING_OPEN_NOTE = { 1:4, 2:11, 3:7, 4:2, 5:9, 6:4 };

// OPEN_STRINGS[s] for s=5→str6(low E) down to s=0→str1(high e).
// Only used by getAllScaleNotesInWindow() which iterates s from 5 to 0.
export const OPEN_STRINGS = [4,11,7,2,9,4];

// ─── Core fret math ───────────────────────────────────────────────────────────

/** Fret where rootIdx sits on strNum. Returns 12 instead of 0 (see note 2). */
export function rootFretOn(rootIdx, strNum) {
  const f = (rootIdx - STRING_OPEN_NOTE[strNum] + 12) % 12;
  return f === 0 ? 12 : f;
}

/** Natural fret for noteIdx on strNum. Returns 12 instead of 0 (see note 2). */
export function simpleFret(noteIdx, strNum) {
  const f = (noteIdx - STRING_OPEN_NOTE[strNum] + 12) % 12;
  return f === 0 ? 12 : f;
}

/** Fret for noteIdx on strNum that is strictly above minFret (octave up if needed). */
export function fretAboveMin(noteIdx, strNum, minFret) {
  const f = simpleFret(noteIdx, strNum);
  return f <= minFret ? f + 12 : f;
}

/** Fret for noteIdx on strNum that is strictly below maxFret (octave down if needed). */
export function fretBelowMax(noteIdx, strNum, maxFret) {
  const f = simpleFret(noteIdx, strNum);
  return f >= maxFret ? f - 12 : f;
}

/** fretOnString by note name (wraps simpleFret). */
export function fretOnString(noteName, strNum) {
  return simpleFret(noteNameToPitchClass(noteName), strNum);
}

/**
 * Place a 5th-string note in the same positional region as root-on-6th.
 * If simpleFret gives a fret more than 5 below rf6, it's out of the position
 * box — add 12 to bring it into the same neighborhood.
 * Validated: IV fret === I fret, V fret === ii fret for all 12 major/minor roots.
 */
export function fretInRegion5(noteIdx, rf6) {
  const f = simpleFret(noteIdx, 5);
  return (rf6 - f) > 5 ? f + 12 : f;
}

/** Root fret on 6th string (low E). E = fret 12 (not 0). */
export function fretFor6th(rootName) { return rootFretOn(noteNameToPitchClass(rootName), 6); }

/** Root fret on 5th string (A). A = fret 12 (not 0). */
export function fretFor5th(rootName) { return rootFretOn(noteNameToPitchClass(rootName), 5); }

/** Root fret on 4th string (D). D = fret 12 (not 0). */
export function fretFor4th(rootName) { return rootFretOn(noteNameToPitchClass(rootName), 4); }

// ─── Positional scale algorithm ───────────────────────────────────────────────
/**
 * Returns 7 note objects, each assigned to its positional string and fret.
 * See KEY DESIGN DECISIONS note 3 for the full algorithm description.
 *
 * Applies to all 7 scale types (same function, same rules). Validated across
 * all 84 root/scale combinations: no fret < 1, no fret > 15, notes correct.
 */
export function getPositionalScaleNotes(rootName, scaleName) {
  const intervals = SCALE_INTERVALS[scaleName] || SCALE_INTERVALS["Major (Ionian)"];
  const rootIdx   = noteNameToPitchClass(rootName);
  const noteIdxs  = intervals.map(i => (rootIdx + i) % 12);
  const notes     = buildScale(rootName, scaleName);

  const rf6 = rootFretOn(rootIdx, 6);

  const fI   = rf6;
  const fIi  = fretAboveMin(noteIdxs[1], 6, rf6);   // ii above root on 6th
  const fIii = fretInRegion5(noteIdxs[2], rf6);      // iii in 5th-str position box
  const fIV  = fretInRegion5(noteIdxs[3], rf6);      // IV  in 5th-str position box
  const fV   = fretInRegion5(noteIdxs[4], rf6);      // V   in 5th-str position box

  // vi/vii: prefer 6th string below root; both move to 5th if either can't fit
  const viBelow  = fretBelowMax(noteIdxs[5], 6, rf6);
  const viiBelow = fretBelowMax(noteIdxs[6], 6, rf6);
  const bothBelow = viBelow >= 1 && viiBelow >= 1;

  let fVI, fVII, viViiStr;
  if (bothBelow) {
    viViiStr = 6; fVI = viBelow; fVII = viiBelow;
  } else {
    viViiStr = 5;
    fVI  = fretAboveMin(noteIdxs[5], 5, fV);
    fVII = fretAboveMin(noteIdxs[6], 5, Math.max(fV, fVI));
  }

  const frets = [fI, fIi, fIii, fIV, fV, fVI, fVII];
  const strs  = [6,  6,   5,    5,   5,  viViiStr, viViiStr];

  return notes.map((note, deg) => ({
    deg, note, str: strs[deg], fret: frets[deg], isRoot: deg === 0,
  }));
}

/**
 * Builds all 7 diatonic chords for a scale (I, ii, iii, IV, V, vi, vii°, or
 * that scale's own equivalent degrees), each voiced as a movable shape rooted
 * at the exact string/fret getPositionalScaleNotes places that degree at — so
 * the whole diatonic ladder sits in the same fixed hand position shown by the
 * Scale Walk diagram, matching I/ii on the 6th string, iii/IV/V on the 5th,
 * and vi/vii° on whichever string has room (see note 3 at the top of this file).
 */
export function buildScaleChordVoicings(rootName, scaleName, use7ths) {
  const notes    = buildScale(rootName, scaleName);
  const posNotes = getPositionalScaleNotes(rootName, scaleName);
  return posNotes.map(({ deg, str, fret }) => {
    const quality = use7ths ? seventhSuffix(deg, scaleName) : triadSuffix(deg, scaleName);
    const shape   = str === 6 ? shapeFor6th(quality) : shapeFor5th(quality);
    return {
      degree: deg,
      root: notes[deg],
      quality,
      name: notes[deg] + quality,
      voicing: {
        baseFret: fret,
        shape,
        mutedStrings: shape.map((v,i) => v === null ? i : -1).filter(i => i >= 0),
        stringRoot: str,
      },
    };
  });
}

/** All scale notes on all strings within a fret window (for the background layer). */
export function getAllScaleNotesInWindow(rootName, scaleName, win) {
  const rootIdx  = noteNameToPitchClass(rootName);
  const intervals = SCALE_INTERVALS[scaleName] || SCALE_INTERVALS["Major (Ionian)"];
  const spelled   = buildScale(rootName, scaleName);
  const nameByPC  = new Map(intervals.map((i, deg) => [(rootIdx + i) % 12, spelled[deg]]));
  const all = [];
  for (let strNum = 1; strNum <= 6; strNum++) {
    const open = STRING_OPEN_NOTE[strNum];
    for (const fret of win) {
      if (fret < 0 || fret > 15) continue;
      const ni = (open + fret) % 12;
      if (nameByPC.has(ni))
        all.push({ str: strNum, fret, note: nameByPC.get(ni), isRoot: ni === rootIdx });
    }
  }
  return all;
}

// ─── Chord shape definitions ───────────────────────────────────────────────────
// shape[0]=str6(lowE) … shape[5]=str1(highe). null=muted. Values=fret offsets from baseFret.

export function shapeFor6th(quality) {
  const isMinor = quality.startsWith("m") && !quality.startsWith("maj");
  const isDim   = quality.includes("°");
  const isMaj7  = quality === "maj7";
  const isM7b5  = quality === "m7b5";
  const isM7    = quality === "m7";
  const isDom7  = quality === "7";
  if (isMaj7)   return [0,null,1,1,0,null]; // E=root, A=mute, D=+1(maj7), G=+1(3rd), B=+0(5th), e=mute
  if (isM7b5)   return [0,1,0,0,null,null]; // E=root, A=+1(b5), D=+0(b7), G=+0(b3), mute B and e
  if (isM7)     return [0,2,0,0,0,0];       // full barre + 5th string up 2
  if (isDom7)   return [0,2,0,1,0,0];
  if (isDim)    return [0,1,2,0,null,null]; // E=root, A=+1(b5), D=+2(root), G=+0(b3), mute B and e
  // Verified against jguitar.com (F/A root barre shapes): each is the standard
  // major/minor/E-shape barre with one note moved to add the color tone.
  if (quality === "5")     return [0,2,2,null,null,null];  // power chord: root+5th only
  if (quality === "dim7")  return [0,1,2,0,2,0];            // fully symmetric, repeats every 3 frets
  if (quality === "sus4")  return [0,0,2,2,0,0];            // major barre with the 3rd raised to the 4th
  if (quality === "maj6")  return [0,2,2,1,2,0];            // E6 shape: major barre, 5th (B-string) raised to 6th
  if (quality === "m6")    return [0,2,2,0,2,0];            // Em6 shape: minor barre, 5th (B-string) raised to 6th
  if (isMinor)  return [0,2,2,0,0,0];
  return               [0,2,2,1,0,0];
}

export function shapeFor5th(quality) {
  const isMinor = quality.startsWith("m") && !quality.startsWith("maj");
  const isDim   = quality.includes("°");
  const isMaj7  = quality === "maj7";
  const isM7b5  = quality === "m7b5";
  const isM7    = quality === "m7";
  const isDom7  = quality === "7";
  if (isMaj7)   return [null,0,2,1,2,0];
  if (isM7b5)   return [null,0,1,0,1,null]; // root/b5/b7/b3, mute E and e (user-specified)
  if (isM7)     return [null,0,2,0,1,0];
  if (isDom7)   return [null,0,2,0,2,0];
  if (isDim)    return [null,0,1,2,1,null];
  // Verified against jguitar.com (B/F root barre shapes): each is the standard
  // A-shape major/minor barre with one note moved to add the color tone.
  // sus2 has no equivalent on the 6th string — see NO_PRACTICAL_SHAPE below.
  if (quality === "5")     return [null,0,2,2,null,null];   // power chord: root+5th only
  if (quality === "dim7")  return [null,0,1,2,1,2];          // fully symmetric, repeats every 3 frets
  if (quality === "sus2")  return [null,0,2,2,0,0];          // A-shape barre with the 3rd released to the 2nd
  if (quality === "sus4")  return [null,0,0,2,3,0];          // A-shape barre with the 3rd raised to the 4th
  if (quality === "maj6")  return [null,0,2,2,2,2];          // A6 shape: major barre, 3rd (G-string) raised to 6th
  if (quality === "m6")    return [null,0,2,2,1,2];          // Am6 shape: minor barre, 5th (e-string) raised to 6th
  if (isMinor)  return [null,0,2,2,1,0];
  return               [null,0,2,2,2,0];
}

// sus2 has no practical movable shape rooted on the 6th string — every
// fingering either drops the low E or requires an unplayable stretch.
// Confirmed against guitar-chord.org, which omits it for the same reason.
export const NO_PRACTICAL_SHAPE = {
  "6th string": new Set(["sus2"]),
};

// Movable "D-shape" chords, rooted on the 4th string with strings 6/5 always
// muted — matches the classic open D/D7/Dmaj7/Dm7/Dm7b5 shapes (same values
// as the D-family entries in OPEN_CHORD_DB below, confirming the derivation).
export function shapeFor4th(quality) {
  const isMinor = quality.startsWith("m") && !quality.startsWith("maj");
  const isDim   = quality.includes("°");
  const isMaj7  = quality === "maj7";
  const isM7b5  = quality === "m7b5";
  const isM7    = quality === "m7";
  const isDom7  = quality === "7";
  if (isMaj7)  return [null,null,0,2,2,2];
  if (isM7b5)  return [null,null,0,1,1,1];
  if (isM7)    return [null,null,0,2,1,1];
  if (isDom7)  return [null,null,0,2,1,2];
  if (isDim)   return [null,null,0,1,null,1];
  if (isMinor) return [null,null,0,2,3,1];
  return              [null,null,0,2,3,2];
}

/** Build a voicing object {baseFret, shape, mutedStrings, stringRoot} for barre chords. */
export function makeVoicing(rootName, quality, useString) {
  if (useString === 6) {
    const baseFret = fretFor6th(rootName);
    const shape    = shapeFor6th(quality);
    return {
      baseFret,
      shape,
      mutedStrings: shape.map((v,i) => v === null ? i : -1).filter(i => i >= 0),
      stringRoot: 6,
    };
  } else if (useString === 4) {
    const baseFret = fretFor4th(rootName);
    const shape    = shapeFor4th(quality);
    return {
      baseFret,
      shape,
      mutedStrings: shape.map((v,i) => v === null ? i : -1).filter(i => i >= 0),
      stringRoot: 4,
    };
  } else {
    const baseFret = fretFor5th(rootName);
    const shape    = shapeFor5th(quality);
    const muted    = [0, ...shape.map((v,i) => v === null && i > 0 ? i : -1).filter(i => i > 0)];
    return { baseFret, shape, mutedStrings: muted, stringRoot: 5 };
  }
}

/** A fixed 4th-string-rooted voicing per chord (like openVoicing/powerVoicing). */
export function fourthStringVoicing(rootName, quality) {
  return makeVoicing(rootName, quality, 4);
}

// ─── Open chord database ───────────────────────────────────────────────────────
// Only genuine cowboy/open-position shapes. See KEY DESIGN DECISIONS note 5.
// shape = [str6(lowE), str5(A), str4(D), str3(G), str2(B), str1(highE)]
// baseFret is always 0 for open chords.
export const OPEN_CHORD_DB = {
  // Triads
  "C":    { shape:[null,3,2,0,1,0] },
  "D":    { shape:[null,null,0,2,3,2] },
  "E":    { shape:[0,2,2,1,0,0] },
  "F":    { shape:[null,null,3,2,1,1] },  // D-string root fret 3, partial barre B&e at fret 1
  "G":    { shape:[3,2,0,0,0,3] },
  "A":    { shape:[null,0,2,2,2,0] },
  "B":    { shape:[null,null,4,4,4,2] },  // D-string root fret 4 (user-specified)
  "Em":   { shape:[0,2,2,0,0,0] },
  "Am":   { shape:[null,0,2,2,1,0] },
  "Cm":   { shape:[null,null,5,5,4,3] },  // G-string root fret 5 (user-specified)
  "Dm":   { shape:[null,null,0,2,3,1] },
  "Fm":   { shape:[null,null,3,1,1,1] },  // classic "baby Fm": D-string root fret 3, G/B/e barre at 1
  "Gm":   { shape:[null,null,null,3,3,3] },  // top-3-string mini barre, e-string root fret 3
  "Bm":   { shape:[null,null,4,4,3,2] },  // D-string root fret 4 (user-specified)
  // Dominant 7ths
  "C7":   { shape:[null,3,2,3,1,0] },
  "D7":   { shape:[null,null,0,2,1,2] },
  "E7":   { shape:[0,2,0,1,0,0] },
  "G7":   { shape:[3,2,0,0,0,1] },
  "A7":   { shape:[null,0,2,0,2,0] },
  "B7":   { shape:[null,2,1,2,0,2] },
  // Major 7ths
  "Cmaj7":{ shape:[null,3,2,0,0,0] },
  "Dmaj7":{ shape:[null,null,0,2,2,2] },
  "Emaj7":{ shape:[0,2,1,1,0,0] },
  "Gmaj7":{ shape:[3,2,0,0,0,2] },
  "Amaj7":{ shape:[null,0,2,1,2,0] },
  // Minor 7ths
  "Em7":  { shape:[0,2,0,0,0,0] },
  "Am7":  { shape:[null,0,2,0,1,0] },
  "Dm7":  { shape:[null,null,0,2,1,1] },
  // Half-diminished
  "Dm7b5":{ shape:[null,null,0,1,1,1] },
  "Em7b5":{ shape:[0,1,0,0,null,0] },
  // Sus2 (root-3rd-5th triad with the 3rd swapped for the 2nd)
  "Csus2":{ shape:[null,3,0,0,1,3] },
  "Dsus2":{ shape:[null,null,0,2,3,0] },
  "Esus2":{ shape:[0,2,4,4,0,0] },
  "Asus2":{ shape:[null,0,2,2,0,0] },
  // Sus4 (root-3rd-5th triad with the 3rd swapped for the 4th)
  "Csus4":{ shape:[null,3,3,0,1,1] },
  "Dsus4":{ shape:[null,null,0,2,3,3] },
  "Esus4":{ shape:[0,2,2,2,0,0] },
  "Asus4":{ shape:[null,0,2,2,3,0] },
  "Gsus4":{ shape:[3,3,0,0,1,3] },
  // Major add9 (triad plus the 9th, 3rd kept)
  "Cadd9":{ shape:[null,3,2,0,3,3] },
  "Gadd9":{ shape:[3,2,0,2,0,3] },
  "Aadd9":{ shape:[null,0,2,4,2,0] },
  "Eadd9":{ shape:[0,2,2,1,0,2] },
};

export function openVoicing(rootName, quality) {
  const key = rootName + quality;
  const oc  = OPEN_CHORD_DB[key];
  if (oc) {
    return {
      baseFret: 0,
      shape: oc.shape,
      mutedStrings: oc.shape.map((v,i) => v === null ? i : -1).filter(i => i >= 0),
    };
  }
  // No open shape — fall back to lowest barre position
  const bf6 = fretFor6th(rootName);
  if (bf6 >= 1) return { ...makeVoicing(rootName, quality, 6), isBarre: true };
  return { ...makeVoicing(rootName, quality, 5), isBarre: true };
}

export function powerVoicing(rootName) {
  const bf6 = fretFor6th(rootName);
  if (bf6 >= 1)
    return { baseFret:bf6, shape:[0,2,2,null,null,null], mutedStrings:[3,4,5], stringRoot:6 };
  const bf5 = fretFor5th(rootName);
  return { baseFret:bf5, shape:[null,0,2,2,null,null], mutedStrings:[0,4,5], stringRoot:5 };
}

// ─── Positional chord voicing builder ─────────────────────────────────────────
/**
 * Assigns each chord in a progression to its positional string based on scale degree.
 * anchor = 6 or 5 (which string the root/I chord starts on).
 *
 * Degree → string assignment (anchor=6):
 *   0,1 (I, ii)    → 6th string
 *   2,3,4 (iii–V)  → 5th string
 *   5,6 (vi, vii)  → 6th string (bumps to 5th if fret < 1)
 * anchor=5 inverts all assignments.
 *
 * Floor rule: if the preferred string would put the chord at fret 0 (open),
 * bump to the other string instead (open = no barre position).
 */
export function buildPositionalVoicings(chords, anchor) {
  function defaultString(degree) {
    if (anchor === 6) {
      if (degree <= 1) return 6;
      if (degree <= 4) return 5;
      return 6;
    } else {
      if (degree <= 1) return 5;
      if (degree <= 4) return 6;
      return 5;
    }
  }

  return chords.map(c => {
    let preferred = defaultString(c.degree);
    const fret6   = fretFor6th(c.root);
    const fret5   = fretFor5th(c.root);
    let useString = preferred;
    if (preferred === 6 && fret6 < 1) useString = 5;
    if (preferred === 5 && fret5 < 1) useString = 6;
    return { ...c, voicing: makeVoicing(c.root, c.quality, useString) };
  });
}

// ─── Theory voicing (chord tone window) ───────────────────────────────────────
/**
 * Finds a physically playable shape for a dense chord (9ths/11ths/13ths/etc.
 * with no fixed shape) within a limited fret window around baseFret.
 *
 * Two passes:
 *  1. Walk the chord's intervals in priority order and give each one the
 *     closest not-yet-used string that can reach it. This guarantees every
 *     distinct color tone gets a slot before any string doubles up — the
 *     naive per-string search used to let doubled roots crowd out the
 *     chord's actual named extensions (e.g. a "13#11" voicing that never
 *     played the 13 or the #11). If there are more than 4 distinct tones,
 *     the plain 5th is pushed to the back of the priority list, since it's
 *     the tone real chord charts drop first when a dense chord won't fit on
 *     six strings — the 3rd/7th/color tones are what define the sound.
 *  2. Any strings left over (fewer chord tones than strings) get the
 *     nearest available tone, repeats allowed.
 *
 * The window itself is kept to a realistic hand span (4 frets) rather than
 * letting each string reach independently, which used to produce shapes
 * spanning 5-6 frets — impossible to actually fret in one grip.
 */
function nearestChordToneShape(rootIdx, chordSet, baseFret, offsetMin, offsetMax) {
  let priority = [...chordSet];
  if (priority.length > 4 && chordSet.has(7)) {
    priority = [...priority.filter(iv => iv !== 7), 7];
  }

  const shape = [null, null, null, null, null, null]; // [str6…str1]
  const assigned = new Set();

  for (const sem of priority) {
    let bestSi = null, bestOffset = null, bestDist = Infinity;
    for (let si = 0; si < 6; si++) {
      if (assigned.has(si)) continue;
      const open = STRING_OPEN_NOTE[6 - si];
      for (let offset = offsetMin; offset <= offsetMax; offset++) {
        const fret = baseFret + offset;
        if (fret < 0) continue;
        if (((open + fret) - rootIdx + 144) % 12 !== sem) continue;
        const dist = Math.abs(offset);
        if (dist < bestDist) { bestDist = dist; bestSi = si; bestOffset = offset; }
      }
    }
    if (bestSi !== null) {
      shape[bestSi] = bestOffset;
      assigned.add(bestSi);
    }
  }

  for (let si = 0; si < 6; si++) {
    if (assigned.has(si)) continue;
    const open = STRING_OPEN_NOTE[6 - si];
    let best = null, bestDist = Infinity;
    for (let offset = offsetMin; offset <= offsetMax; offset++) {
      const fret = baseFret + offset;
      if (fret < 0) continue;
      const sem = ((open + fret) - rootIdx + 144) % 12;
      if (!chordSet.has(sem)) continue;
      const dist = Math.abs(offset);
      if (dist < bestDist) { bestDist = dist; best = offset; }
    }
    shape[si] = best;
  }

  return shape;
}

/**
 * Builds a voicing for the theory block by finding the nearest chord tone on
 * each string within a fret window around the root. Works for all 32 chord
 * types including extended chords where no fixed shape exists.
 *
 * For open chords, falls back to OPEN_CHORD_DB if available.
 */
export function buildTheoryVoicing(rootName, chordType, voicingType) {
  const quality  = chordType.quality;
  const rootIdx  = noteNameToPitchClass(rootName);
  const chordSet = new Set(chordType.intervals);

  let baseFret, shape, mutedStrings;

  if (voicingType === "Open chord") {
    const ov = OPEN_CHORD_DB[rootName + quality];
    if (ov) {
      // Genuine cowboy/open-position shape for this exact root+quality.
      baseFret = 0;
      shape    = ov.shape;
      mutedStrings = ov.shape.map((v,i) => v === null ? i : -1).filter(i => i >= 0);
    } else {
      // No named open shape for this root/quality — rather than silently
      // downgrading to a plain major/minor triad (which would show the wrong
      // notes under the chord's real label), find a playable shape within
      // the open position (frets 0-4).
      baseFret = 0;
      shape = nearestChordToneShape(rootIdx, chordSet, 0, 0, 4);
      mutedStrings = shape.map((v,i) => v === null ? i : -1).filter(i => i >= 0);
    }
  } else {
    const strNum = voicingType === "6th string" ? 6 : 5;
    baseFret = strNum === 6 ? fretFor6th(rootName) : fretFor5th(rootName);

    // For qualities with a real movable shape (shapeFor6th/shapeFor5th), use it
    // directly — it's the standard barre-chord fingering (e.g. the classic A7/E7
    // shapes). Only fall back to the nearest-chord-tone search below for
    // extended qualities (9ths/11ths/13ths/etc.) that have no fixed shape.
    const FIXED_SHAPE_QUALITIES_6TH = new Set(["", "m", "°", "maj7", "m7", "7", "m7b5", "5", "dim7", "sus4", "maj6", "m6"]);
    const FIXED_SHAPE_QUALITIES_5TH = new Set(["", "m", "°", "maj7", "m7", "7", "m7b5", "5", "dim7", "sus2", "sus4", "maj6", "m6"]);
    const fixedShapeQualities = strNum === 6 ? FIXED_SHAPE_QUALITIES_6TH : FIXED_SHAPE_QUALITIES_5TH;
    if (fixedShapeQualities.has(quality)) {
      shape = strNum === 6 ? shapeFor6th(quality) : shapeFor5th(quality);
      mutedStrings = shape.map((v,i) => v === null ? i : -1).filter(i => i >= 0);
    } else {
      // Extended qualities (9ths/11ths/13ths/etc.) have no fixed shape —
      // find a playable one within a realistic 4-fret barre-hand span.
      shape = nearestChordToneShape(rootIdx, chordSet, baseFret, -1, 3);
      mutedStrings = shape.map((v,i) => v === null ? i : -1).filter(i => i >= 0);
    }
  }

  const noPracticalShape = NO_PRACTICAL_SHAPE[voicingType]?.has(quality) ?? false;

  // Label each occupied string with its interval
  const stringData = shape.map((offset, si) => {
    if (offset === null) return null;
    const sn      = 6 - si;
    const open    = STRING_OPEN_NOTE[sn];
    const fret    = baseFret + offset;
    const noteIdx = (open + fret) % 12;
    const sem     = (noteIdx - rootIdx + 12) % 12;
    const interval = getIntervalName(sem, quality);
    return {
      fret,
      note:    spellChordTone(rootName, sem, interval),
      interval,
      semitone: sem,
    };
  });

  return { baseFret, shape, mutedStrings, stringData, noPracticalShape };
}
