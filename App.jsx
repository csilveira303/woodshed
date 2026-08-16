// ─── App.jsx ──────────────────────────────────────────────────────────────────
// Main React application. All music theory and fretboard math lives in
// theory.js and fretboard.js — this file is UI only.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import {
  THEORY_CHORD_TYPES, INTERVAL_COLORS, INTERVAL_NAMES,
  getIntervalName, parentMajor, DEGREE_LABELS_BY_SCALE,
  progressionsFor,
  spellChordTone, rootNameForPitchClass,
} from "./theory.js";
import {
  STRING_OPEN_NOTE, OPEN_STRINGS,
  getPositionalScaleNotes, getAllScaleNotesInWindow,
  buildTheoryVoicing,
} from "./fretboard.js";
import { buildSession, getVoicingPasses, TECHNIQUES, generateRhythm, RHYTHM_STYLES } from "./session.js";
import { createClickScheduler } from "./audio.js";

// Session persists across reloads (sessionStorage), reset only by the
// "New Session" button or a fresh app restart (new browser tab/session).
const SESSION_STORAGE_KEY = "guitar-practice-session-v1";

// ─── UI constants ─────────────────────────────────────────────────────────────
// Canonical tonic spelling for each of the 12 pitch classes (Db not C#, etc.) —
// used anywhere a root note picker isn't tied to a specific scale/key context.
const CANONICAL_ROOTS = Array.from({ length: 12 }, (_, pc) => rootNameForPitchClass(pc));

const BLOCK_LABELS = ["Major Key","Minor Key","Mode 1","Mode 2"];
const BLOCK_COLORS = ["#2a5a3a","#5a2a3a","#2a3a5a","#4a3a5a"];
const BLOCK_ACCENT = ["#4aaa6a","#aa4a6a","#4a6aaa","#8a6aaa"];
const THEORY_COLOR  = "#3a3a1a";
const THEORY_ACCENT = "#c8a87a";

const PASS_LABELS = {
  "6th-anchored positional": "6th Anchor",
  "5th-anchored positional": "5th Anchor",
  "4th-anchored":            "4th Anchor",
  "Open chords":             "Open",
  "Power chords":            "Power",
};
const PASS_DESC = {
  "6th-anchored positional": "Root starts on 6th string — each chord voiced at the nearest position",
  "5th-anchored positional": "Root starts on 5th string — each chord voiced at the nearest position",
  "4th-anchored":            "Root starts on 4th string — compact movable D-shape voicing",
  "Open chords":             "All chords in open position",
  "Power chords":            "Root + 5th only, no 3rd",
};

const TECHNIQUE_ORDER      = ["strum","pluck","palmMute"];
const PLUCK_STRING_COLOR   = { "6":"#c8a87a","5":"#c8a87a","4":"#4aaa6a","3":"#4aaa6a","2":"#7ab8c8","1":"#7ab8c8" };
const STRING_ROOT_COLOR    = { 6:"#c8a87a", 5:"#7ab8c8", 4:"#a87ac8" };
const STRING_ROOT_LABEL    = { 6:"6th str", 5:"5th str", 4:"4th str" };

function legendForTechnique(technique) {
  if (technique === "pluck")
    return <>1–6 = string to pick &nbsp;·&nbsp; <span style={{ color:"#c8a87a" }}>amber = bass (5/6)</span> &nbsp;·&nbsp; <span style={{ color:"#4aaa6a" }}>green = mid (3/4)</span> &nbsp;·&nbsp; <span style={{ color:"#7ab8c8" }}>blue = treble (1/2)</span></>;
  if (technique === "palmMute")
    return <>↓ down · ↑ up · — rest &nbsp;·&nbsp; <span style={{ color:"#e8a84a" }}>PM = palm-muted downstroke</span></>;
  return <>↓ down · ↑ up · — rest</>;
}

// ─── ScaleDiagram ─────────────────────────────────────────────────────────────
// `modalRoot` optionally marks a different note (e.g. a mode's own root) with
// a secondary highlight, while the diagram itself is anchored on `rootName`.
function ScaleDiagram({ rootName, scaleName, leftHanded, modalRoot }) {
  const posNotes  = getPositionalScaleNotes(rootName, scaleName);
  const degLabels = DEGREE_LABELS_BY_SCALE[scaleName] || DEGREE_LABELS_BY_SCALE["Major (Ionian)"];
  const frets     = posNotes.map(p => p.fret);
  const minF      = Math.max(0, Math.min(...frets) - 1);
  const maxF      = Math.min(15, Math.max(...frets) + 1);
  const winSize   = Math.max(7, maxF - minF + 1);
  const win       = Array.from({ length: winSize }, (_, i) => minF + i);
  const dotFrets  = [3,5,7,9,12,14];

  const anchorKey = (str, fret) => `${str}-${fret}`;
  const anchorMap = new Map(posNotes.map(p => [anchorKey(p.str, p.fret), p]));
  const allNotes  = getAllScaleNotesInWindow(rootName, scaleName, win);

  const W = Math.max(280, win.length * 36 + 40);
  const H = 120;

  function slotX(fret) {
    const fi = win.indexOf(fret);
    if (fi < 0) return -999;
    return leftHanded ? W - 36 - fi * 36 + 18 : 36 + fi * 36 + 18;
  }
  function strY(strNum) { return 10 + (strNum - 1) * 16; }
  function fretLineX(fi) { return leftHanded ? W - 36 - fi * 36 : 36 + fi * 36; }

  const anchorNote = posNotes[0];
  const stringNames = ["e","B","G","D","A","E"];

  return (
    <div style={{ overflowX:"auto", paddingBottom:"4px" }}>
      <div style={{ display:"flex", gap:"12px", alignItems:"center", marginBottom:"8px", flexWrap:"wrap" }}>
        <div style={{ background:"#b8733322", border:"1px solid #b87333", borderRadius:"5px", padding:"4px 10px", fontSize:"11px", color:"#e8a84a", fontWeight:700 }}>
          Key center: {rootName} — {anchorNote.str === 6 ? "6th" : "5th"} string, fret {anchorNote.fret}
        </div>
        <div style={{ fontSize:"10px", color:"#555" }}>{scaleName.split(" (")[0]}</div>
        {modalRoot && modalRoot !== rootName && (
          <div style={{ background:"#4aaa6a22", border:"1px solid #4aaa6a", borderRadius:"5px", padding:"4px 10px", fontSize:"11px", color:"#7adf9a", fontWeight:700 }}>
            Mode root: {modalRoot}
          </div>
        )}
      </div>
      <svg width={W} height={H} style={{ display:"block" }}>
        {minF === 0 && <rect x={leftHanded ? W-40 : 36} y={10} width={4} height={80} fill="#c8a87a" />}
        {win.map((f,fi) => <rect key={f} x={fretLineX(fi)} y={10} width={1} height={80} fill="#333" />)}
        {[1,2,3,4,5,6].map(sn => <rect key={sn} x={36} y={strY(sn)} width={win.length*36} height={1} fill={sn>=4?"#555":"#444"} />)}
        {win.map((f,fi) => dotFrets.includes(f) && <circle key={f} cx={fretLineX(fi)+18} cy={H-8} r={3} fill="#444" />)}
        {win.map((f,fi) => f > 0 && <text key={f} x={fretLineX(fi)+18} y={8} textAnchor="middle" style={{ fontSize:"8px",fill:"#555",fontFamily:"monospace" }}>{f}</text>)}
        {stringNames.map((label,si) => {
          const sn = si+1;
          return <text key={si} x={leftHanded?W-10:26} y={strY(sn)+4} textAnchor="middle" style={{ fontSize:"9px",fontFamily:"monospace",fill:sn===5||sn===6?"#c8a87a":"#444",fontWeight:sn===5||sn===6?"bold":"normal" }}>{label}</text>;
        })}
        {allNotes.map((p,i) => {
          if (anchorMap.has(anchorKey(p.str,p.fret))) return null;
          const cx=slotX(p.fret), cy=strY(p.str);
          if (cx<0) return null;
          return <g key={`bg-${i}`}><circle cx={cx} cy={cy} r={6} fill={p.isRoot?"#5a3a1a":"#1a2a3a"} stroke={p.isRoot?"#8a5a2a":"#2a3a5a"} strokeWidth={1}/><text x={cx} y={cy+3} textAnchor="middle" style={{ fontSize:"6px",fill:"#999",fontFamily:"monospace" }}>{p.note}</text></g>;
        })}
        {posNotes.map((p,i) => {
          const cx=slotX(p.fret), cy=strY(p.str);
          if (cx<0) return null;
          const isModalRoot = modalRoot && p.note === modalRoot && !p.isRoot;
          return <g key={`anchor-${i}`}>
            {p.isRoot && <circle cx={cx} cy={cy} r={10} fill="none" stroke="#e8a84a" strokeWidth={1.5} strokeDasharray="3,2"/>}
            {isModalRoot && <circle cx={cx} cy={cy} r={10} fill="none" stroke="#4aaa6a" strokeWidth={1.5} strokeDasharray="2,2"/>}
            <circle cx={cx} cy={cy} r={7} fill={p.isRoot?"#b87333":p.str===6?"#2a4a6a":"#2a5a3a"} stroke={p.isRoot?"#e8a84a":isModalRoot?"#4aaa6a":p.str===6?"#4a7aaa":"#4aaa6a"} strokeWidth={1.5}/>
            <text x={cx} y={cy+3} textAnchor="middle" style={{ fontSize:"7px",fill:"#fff",fontFamily:"monospace",fontWeight:"bold" }}>{p.note}</text>
            <text x={cx} y={cy+19} textAnchor="middle" style={{ fontSize:"7px",fill:p.isRoot?"#e8a84a":"#777",fontFamily:"monospace" }}>{degLabels[p.deg]}</text>
          </g>;
        })}
      </svg>
      <div style={{ fontSize:"9px",color:"#555",display:"flex",gap:"14px",marginTop:"6px",flexWrap:"wrap" }}>
        <span>🟠 Root (I)</span><span style={{ color:"#4a7aaa" }}>🔵 6th string</span>
        <span style={{ color:"#4aaa6a" }}>🟢 5th string</span><span style={{ color:"#555" }}>· other notes</span>
        {modalRoot && modalRoot !== rootName && <span style={{ color:"#4aaa6a" }}>⭕ mode root ({modalRoot})</span>}
        {leftHanded && <span style={{ color:"#666" }}>← Left-handed</span>}
      </div>
    </div>
  );
}

// ─── ChordDiagram ─────────────────────────────────────────────────────────────
function ChordDiagram({ chordName, voicingData, leftHanded }) {
  const { baseFret, shape, mutedStrings=[], isBarre, stringRoot } = voicingData;
  const svgW=72, svgH=82, gridLeft=10, gridRight=62, gridTop=16;
  const strSpacing=(gridRight-gridLeft)/5;
  function strX(si) { return leftHanded ? gridLeft+(5-si)*strSpacing : gridLeft+si*strSpacing; }
  return (
    <div style={{ textAlign:"center", minWidth:"72px" }}>
      <div style={{ fontSize:"11px",fontWeight:700,color:"#e8e4dc",marginBottom:"2px" }}>{chordName}</div>
      <div style={{ fontSize:"8px",color:STRING_ROOT_COLOR[stringRoot]||"#888",marginBottom:"3px" }}>
        {STRING_ROOT_LABEL[stringRoot] || (isBarre?"barre":"open")}
      </div>
      <svg width={svgW} height={svgH}>
        {baseFret===0 && <rect x={gridLeft} y={13} width={gridRight-gridLeft} height={3} fill="#c8a87a"/>}
        {[0,1,2,3,4].map(f=><rect key={f} x={gridLeft} y={gridTop+f*12} width={gridRight-gridLeft} height={1} fill="#333"/>)}
        {[0,1,2,3,4,5].map(si=><rect key={si} x={strX(si)-0.5} y={13} width={si<=1?1.5:si<=3?1:0.75} height={60} fill={si<=1?"#666":si<=3?"#555":"#444"}/>)}
        {baseFret>0 && <text x={leftHanded?svgW-3:5} y={22} textAnchor="middle" style={{ fontSize:"7px",fill:"#b87333",fontFamily:"monospace" }}>{baseFret}fr</text>}
        {shape && shape.map((fret,si)=>{
          if (fret===null||mutedStrings.includes(si)) return null;
          const cx=strX(si);
          if (fret===0) return <circle key={si} cx={cx} cy={10} r={3.5} fill="none" stroke="#7ab8c8" strokeWidth={1.5}/>;
          return <circle key={si} cx={cx} cy={gridTop+(fret-0.5)*12} r={4.5} fill="#b87333"/>;
        })}
        {mutedStrings.map(si=><text key={si} x={strX(si)} y={10} textAnchor="middle" style={{ fontSize:"9px",fill:"#555",fontFamily:"monospace" }}>×</text>)}
      </svg>
      <div style={{ fontSize:"8px",color:"#555",marginTop:"-6px" }}>
        {isBarre?"no open shape":baseFret>0?`Fret ${baseFret}`:"Open"}
      </div>
    </div>
  );
}

// ─── StringMapBar ─────────────────────────────────────────────────────────────
function StringMapBar({ chordShapes }) {
  return (
    <div style={{ display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"10px" }}>
      {chordShapes.map((cs,i)=>(
        <div key={i} style={{ display:"flex",alignItems:"center",gap:"4px",background:"#1a1a1a",borderRadius:"4px",padding:"3px 8px",border:`1px solid ${STRING_ROOT_COLOR[cs.voicing.stringRoot]||"#888"}44` }}>
          <span style={{ fontSize:"11px",fontWeight:700,color:"#e8e4dc" }}>{cs.name}</span>
          <span style={{ fontSize:"9px",color:STRING_ROOT_COLOR[cs.voicing.stringRoot]||"#888",background:`${STRING_ROOT_COLOR[cs.voicing.stringRoot]||"#888"}22`,borderRadius:"3px",padding:"1px 4px" }}>
            {STRING_ROOT_LABEL[cs.voicing.stringRoot] || ""}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── RhythmStrip ─────────────────────────────────────────────────────────────
function RhythmStrip({ steps, activeStep, technique, styleLabel, stepsPerBeat }) {
  if (technique === "pluck") {
    return (
      <div>
        <div style={{ fontSize:"10px",color:"#666",letterSpacing:"2px",textTransform:"uppercase",marginBottom:"6px" }}>{styleLabel}</div>
        <div style={{ display:"flex",gap:"2px" }}>
          {steps.map((str,i)=>{
            const isActive = activeStep===i;
            const color    = PLUCK_STRING_COLOR[str] || "#888";
            return <div key={i} style={{ flex:1,minWidth:"16px",textAlign:"center",padding:"6px 2px",background:isActive?"#b87333":"#161616",border:`1px solid ${isActive?"#e8a84a":"#1a1a1a"}`,borderRadius:"3px",fontSize:"14px",fontWeight:700,color:isActive?"#fff":color,transition:"background 0.05s",userSelect:"none" }}>
              {str}
            </div>;
          })}
        </div>
      </div>
    );
  }

  const spb = stepsPerBeat || 2;
  return (
    <div>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:"6px" }}>
        <div style={{ fontSize:"10px",color:"#666",letterSpacing:"2px",textTransform:"uppercase" }}>{styleLabel}</div>
      </div>
      <div style={{ display:"flex",gap:"2px" }}>
        {steps.map((sym,i)=>{
          const isActive=activeStep===i, isBeatDown=i%spb===0, beatNum=Math.floor(i/spb)+1;
          const isMuted = sym === "PM↓";
          const glyph   = isMuted ? "↓" : sym;
          const color   = sym==="—" ? "#3a3a3a" : isMuted ? "#e8a84a" : sym==="↓" ? "#c8a87a" : "#7ab8c8";
          return <div key={i} style={{ flex:1,minWidth:"16px",textAlign:"center",padding:spb===4?"6px 1px":"6px 2px",background:isActive?"#b87333":isMuted?"#241a10":isBeatDown?"#1e1e1e":"#161616",border:`1px solid ${isActive?"#e8a84a":isMuted?"#4a3018":isBeatDown?"#2a2a2a":"#1a1a1a"}`,borderRadius:"3px",fontSize:spb===4?"11px":"14px",color:isActive?"#fff":color,transition:"background 0.05s",userSelect:"none" }}>
            {glyph}
            {isMuted && <div style={{ fontSize:"6px",color:isActive?"#ffdd99":"#c8843a",marginTop:"1px",fontWeight:700 }}>PM</div>}
            {!isMuted && isBeatDown && <div style={{ fontSize:"7px",color:isActive?"#ffdd99":"#444",marginTop:"1px" }}>{beatNum}</div>}
          </div>;
        })}
      </div>
    </div>
  );
}

// ─── TheoryChordDiagram ───────────────────────────────────────────────────────
function TheoryChordDiagram({ rootName, chordType, voicingData, leftHanded }) {
  const { baseFret, shape, mutedStrings=[], stringData } = voicingData;
  const svgW=80, svgH=100, gridLeft=12, gridRight=68, gridTop=18;
  const strSpacing=(gridRight-gridLeft)/5;
  function strX(si) { return leftHanded ? gridLeft+(5-si)*strSpacing : gridLeft+si*strSpacing; }
  return (
    <div style={{ textAlign:"center" }}>
      <div style={{ fontSize:"14px",fontWeight:700,color:"#f0ebe0",marginBottom:"2px" }}>{rootName}{chordType.quality}</div>
      <div style={{ fontSize:"10px",color:"#888",marginBottom:"2px" }}>{chordType.label}</div>
      <div style={{ fontSize:"9px",color:"#c8a87a",marginBottom:"6px" }}>{chordType.formula}</div>
      <svg width={svgW} height={svgH}>
        {baseFret===0 && <rect x={gridLeft} y={15} width={gridRight-gridLeft} height={3} fill="#c8a87a"/>}
        {[0,1,2,3,4].map(f=><rect key={f} x={gridLeft} y={gridTop+f*14} width={gridRight-gridLeft} height={1} fill="#333"/>)}
        {[0,1,2,3,4,5].map(si=><rect key={si} x={strX(si)-0.5} y={15} width={si<=1?1.5:si<=3?1:0.75} height={60} fill={si<=1?"#666":si<=3?"#555":"#444"}/>)}
        {baseFret>0 && <text x={leftHanded?svgW-4:6} y={26} textAnchor="middle" style={{ fontSize:"7px",fill:"#b87333",fontFamily:"monospace" }}>{baseFret}fr</text>}
        {shape && shape.map((offset,si)=>{
          if (offset===null||mutedStrings.includes(si)) return null;
          const cx=strX(si), sd=stringData[si];
          if (!sd) return null;
          const color=INTERVAL_COLORS[sd.interval]||"#555";
          if (offset===0&&baseFret===0) return <g key={si}><circle cx={cx} cy={12} r={5} fill="none" stroke={color} strokeWidth={1.5}/><text x={cx} y={15} textAnchor="middle" style={{ fontSize:"6px",fill:color,fontFamily:"monospace",fontWeight:"bold" }}>{sd.interval}</text></g>;
          const cy=gridTop+(offset-0.5)*14;
          return <g key={si}><circle cx={cx} cy={cy} r={7} fill={sd.semitone===0?"#b87333":color+"55"} stroke={color} strokeWidth={1.5}/><text x={cx} y={cy+3} textAnchor="middle" style={{ fontSize:"7px",fill:"#fff",fontFamily:"monospace",fontWeight:"bold" }}>{sd.interval}</text></g>;
        })}
        {mutedStrings.map(si=><text key={si} x={strX(si)} y={12} textAnchor="middle" style={{ fontSize:"9px",fill:"#555",fontFamily:"monospace" }}>×</text>)}
      </svg>
      {baseFret>0 && <div style={{ fontSize:"8px",color:"#555",marginTop:"-4px" }}>Fret {baseFret}</div>}
    </div>
  );
}

function IntervalTable({ chordNotes }) {
  return (
    <div style={{ display:"flex",gap:"8px",flexWrap:"wrap",justifyContent:"center" }}>
      {chordNotes.map((n,i)=>{
        const color=INTERVAL_COLORS[n.interval]||"#888";
        return <div key={i} style={{ background:"#1a1a1a",border:`1px solid ${color}66`,borderRadius:"6px",padding:"8px 12px",textAlign:"center",minWidth:"52px" }}>
          <div style={{ fontSize:"16px",fontWeight:700,color:"#f0ebe0" }}>{n.note}</div>
          <div style={{ fontSize:"11px",color,fontWeight:700,marginTop:"2px" }}>{n.interval}</div>
        </div>;
      })}
    </div>
  );
}

// ─── ChordTheoryBlock ─────────────────────────────────────────────────────────
function ChordTheoryBlock({ session, leftHanded }) {
  const sessionRoots = session ? session.blocks.map(b => b.rootKey) : [...CANONICAL_ROOTS];
  const [chordType,   setChordType]   = useState(THEORY_CHORD_TYPES[0]);
  const [rootName,    setRootName]    = useState(sessionRoots[0] || "C");
  const [voicingType, setVoicingType] = useState("6th string");
  const [voicingData, setVoicingData] = useState(null);
  const [chordNotes,  setChordNotes]  = useState([]);

  function randomize() {
    const root = sessionRoots[Math.floor(Math.random()*sessionRoots.length)];
    const type = THEORY_CHORD_TYPES[Math.floor(Math.random()*THEORY_CHORD_TYPES.length)];
    setRootName(root); setChordType(type);
  }

  useEffect(() => {
    try {
      const vd = buildTheoryVoicing(rootName, chordType, voicingType);
      setVoicingData(vd);
      setChordNotes(chordType.intervals.map(interval => {
        const intervalName = getIntervalName(interval, chordType.quality);
        return {
          note: spellChordTone(rootName, interval, intervalName),
          interval: intervalName,
          semitone: interval,
        };
      }));
    } catch(e) { setVoicingData(null); }
  }, [rootName, chordType, voicingType]);

  useEffect(() => { randomize(); }, []);

  const accent="#c8a87a";
  return (
    <div>
      <div style={{ display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"14px",alignItems:"flex-end" }}>
        <div style={{ flex:"0 0 auto" }}>
          <div style={{ fontSize:"9px",color:"#666",letterSpacing:"2px",textTransform:"uppercase",marginBottom:"4px" }}>Root</div>
          <select value={rootName} onChange={e=>setRootName(e.target.value)} style={{ background:"#1a1a1a",color:"#e8e4dc",border:"1px solid #333",borderRadius:"5px",fontFamily:"inherit",fontSize:"12px",padding:"6px 8px",cursor:"pointer" }}>
            {CANONICAL_ROOTS.map(n=><option key={n} value={n}>{n}{sessionRoots.includes(n)?" ★":""}</option>)}
          </select>
        </div>
        <div style={{ flex:1,minWidth:"120px" }}>
          <div style={{ fontSize:"9px",color:"#666",letterSpacing:"2px",textTransform:"uppercase",marginBottom:"4px" }}>Chord Type</div>
          <select value={chordType.label} onChange={e=>setChordType(THEORY_CHORD_TYPES.find(t=>t.label===e.target.value))} style={{ width:"100%",background:"#1a1a1a",color:"#e8e4dc",border:"1px solid #333",borderRadius:"5px",fontFamily:"inherit",fontSize:"12px",padding:"6px 8px",cursor:"pointer" }}>
            {THEORY_CHORD_TYPES.map(t=><option key={t.label} value={t.label}>{t.label} ({t.quality||"maj"})</option>)}
          </select>
        </div>
        <button onClick={randomize} style={{ background:"#1a1a1a",border:"1px solid #444",borderRadius:"6px",color:accent,fontFamily:"inherit",fontSize:"12px",padding:"7px 14px",cursor:"pointer" }}>⚄ Random</button>
      </div>
      <div style={{ display:"flex",gap:"5px",marginBottom:"14px" }}>
        {["6th string","5th string","Open chord"].map(opt=>(
          <button key={opt} onClick={()=>setVoicingType(opt)} style={{ flex:1,padding:"6px 4px",background:voicingType===opt?"#c8a87a33":"#141414",border:`1px solid ${voicingType===opt?"#c8a87a":"#222"}`,borderRadius:"5px",color:voicingType===opt?"#fff":"#555",fontFamily:"inherit",fontSize:"10px",cursor:"pointer" }}>{opt}</button>
        ))}
      </div>
      {voicingData && (
        <div style={{ background:"#141414",border:"1px solid #222",borderRadius:"8px",padding:"16px",marginBottom:"14px" }}>
          <div style={{ display:"flex",gap:"24px",alignItems:"flex-start",flexWrap:"wrap" }}>
            <TheoryChordDiagram rootName={rootName} chordType={chordType} voicingData={voicingData} leftHanded={leftHanded}/>
            <div style={{ flex:1,minWidth:"180px" }}>
              <div style={{ fontSize:"10px",color:"#666",letterSpacing:"2px",textTransform:"uppercase",marginBottom:"10px" }}>Chord Tones</div>
              <IntervalTable chordNotes={chordNotes}/>
              <div style={{ marginTop:"14px" }}>
                <div style={{ fontSize:"10px",color:"#666",letterSpacing:"2px",textTransform:"uppercase",marginBottom:"8px" }}>String Breakdown</div>
                <div style={{ display:"flex",flexDirection:"column",gap:"4px" }}>
                  {["e","B","G","D","A","E"].map((strLabel,si)=>{
                    const shapeIdx=5-si, sd=voicingData.stringData[shapeIdx];
                    const isMuted=voicingData.mutedStrings.includes(shapeIdx)||voicingData.shape[shapeIdx]===null;
                    if (isMuted) return <div key={si} style={{ display:"flex",gap:"8px",alignItems:"center",fontSize:"11px",color:"#444" }}><span style={{ minWidth:"12px",fontFamily:"monospace" }}>{strLabel}</span><span>muted</span></div>;
                    if (!sd) return null;
                    const color=INTERVAL_COLORS[sd.interval]||"#888";
                    return <div key={si} style={{ display:"flex",gap:"8px",alignItems:"center",fontSize:"11px" }}>
                      <span style={{ minWidth:"12px",fontFamily:"monospace",color:"#555" }}>{strLabel}</span>
                      <span style={{ color:"#666",fontFamily:"monospace" }}>fr{sd.fret}</span>
                      <span style={{ color:"#e8e4dc",fontWeight:700 }}>{sd.note}</span>
                      <span style={{ color,fontWeight:700,background:color+"22",borderRadius:"3px",padding:"0 5px" }}>{sd.interval}</span>
                    </div>;
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <div style={{ background:"#141414",border:"1px solid #1e1e1e",borderRadius:"6px",padding:"10px 12px" }}>
        <div style={{ fontSize:"9px",color:"#555",letterSpacing:"2px",textTransform:"uppercase",marginBottom:"6px" }}>Interval Legend</div>
        <div style={{ display:"flex",gap:"8px",flexWrap:"wrap" }}>
          {Object.entries(INTERVAL_COLORS).map(([name,color])=>(
            <div key={name} style={{ fontSize:"10px",color,background:color+"22",borderRadius:"3px",padding:"2px 6px",fontFamily:"monospace" }}>{name}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function GuitarPracticeSession() {
  const [use7ths,       setUse7ths]       = useState(true);
  const [leftHanded,    setLeftHanded]    = useState(true);
  const [keepAwake,     setKeepAwake]     = useState(true);
  const [settingsOpen,  setSettingsOpen]  = useState(false);
  const [helpOpen,      setHelpOpen]      = useState(false);
  const [selectedProgs, setSelectedProgs] = useState(["Random","Random","Random","Random"]);
  const [activeTab,     setActiveTab]     = useState("practice");
  const [session,       setSession]       = useState(null);
  const [activeBlock,   setActiveBlock]   = useState(0);
  const [activeVoicing, setActiveVoicing] = useState(0);
  const [phase,         setPhase]         = useState("scale");
  const [tempo,         setTempo]         = useState(75);
  const [isPlaying,     setIsPlaying]     = useState(false);
  const [activeStep,    setActiveStep]    = useState(-1);
  const schedulerRef = useRef(null);
  const wakeLockRef  = useRef(null);
  if (schedulerRef.current === null) {
    schedulerRef.current = createClickScheduler({ onStep: setActiveStep });
  }

  // ── Keep-awake (Screen Wake Lock) — user-toggleable, on by default, best-effort ─
  useEffect(() => {
    if (!keepAwake) return;
    async function acquireWakeLock() {
      if (!("wakeLock" in navigator)) return;
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        wakeLockRef.current.addEventListener("release", () => { wakeLockRef.current = null; });
      } catch (e) {}
    }
    acquireWakeLock();
    function onVisibilityChange() {
      if (document.visibilityState === "visible") acquireWakeLock();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (wakeLockRef.current) { wakeLockRef.current.release(); wakeLockRef.current = null; }
    };
  }, [keepAwake]);

  useEffect(() => {
    if (!settingsOpen && !helpOpen) return;
    function onKeyDown(e) { if (e.key === "Escape") { setSettingsOpen(false); setHelpOpen(false); } }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [settingsOpen, helpOpen]);

  function newSession(u7=use7ths, progs=selectedProgs) {
    stopPlayback();
    setSession(buildSession(u7, progs));
    setActiveBlock(0); setActiveVoicing(0); setPhase("scale"); setActiveStep(-1);
  }

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY));
      if (saved?.session) {
        setSession(saved.session);
        setUse7ths(saved.use7ths ?? true);
        setSelectedProgs(saved.selectedProgs ?? ["Random","Random","Random","Random"]);
        setActiveBlock(saved.activeBlock ?? 0);
        setActiveVoicing(saved.activeVoicing ?? 0);
        setPhase(saved.phase ?? "scale");
        return;
      }
    } catch (e) {}
    newSession();
  }, []);

  useEffect(() => {
    if (!session) return;
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
        session, use7ths, selectedProgs, activeBlock, activeVoicing, phase,
      }));
    } catch (e) {}
  }, [session, use7ths, selectedProgs, activeBlock, activeVoicing, phase]);

  const block   = session?.blocks[activeBlock];
  const voicing = block?.voicings[activeVoicing];
  const steps   = voicing?.rhythm.steps;
  const vCount  = block?.voicings.length ?? 4;
  const maxVI   = vCount - 1;

  function getMsPerStep(stepsPerBeat) {
    return (60 / tempo) * 1000 / stepsPerBeat;
  }

  // ── Metronome (Web Audio click track) ──────────────────────────────────────
  function restartPlayback() {
    if (!steps || !voicing) return;
    const stepsPerBeat = voicing.rhythm.stepsPerBeat;
    const ms = getMsPerStep(stepsPerBeat);
    schedulerRef.current.start(ms, steps.length, stepsPerBeat);
    setIsPlaying(true);
  }

  function stopPlayback() {
    schedulerRef.current.stop();
    setIsPlaying(false); setActiveStep(-1);
  }

  function togglePlay() { isPlaying ? stopPlayback() : restartPlayback(); }

  useEffect(() => {
    if (isPlaying && steps) restartPlayback();
  }, [activeVoicing, activeBlock, tempo]);

  useEffect(() => () => schedulerRef.current.stop(), []);

  function setVoicingTechnique(newTechnique) {
    stopPlayback();
    const styleKey = newTechnique === "strum"
      ? RHYTHM_STYLES[Math.floor(Math.random()*RHYTHM_STYLES.length)]
      : undefined;
    const newRhythm = generateRhythm(styleKey, newTechnique);
    setSession(prev => ({
      ...prev,
      blocks: prev.blocks.map((b, bi) => bi !== activeBlock ? b : {
        ...b,
        voicings: b.voicings.map((v, vi) => vi !== activeVoicing ? v : { ...v, rhythm: newRhythm }),
      }),
    }));
  }

  function advance() {
    stopPlayback(); setActiveStep(-1);
    if (activeVoicing < maxVI)  { setActiveVoicing(v=>v+1); setPhase("voicing"); }
    else if (activeBlock < 3)   { setActiveBlock(b=>b+1); setActiveVoicing(0); setPhase("scale"); }
  }
  function goBack() {
    stopPlayback(); setActiveStep(-1);
    if (phase==="voicing"&&activeVoicing>0) setActiveVoicing(v=>v-1);
    else if (phase==="voicing")             setPhase("scale");
    else if (activeBlock>0) {
      const prevMaxVI = session.blocks[activeBlock-1].voicings.length - 1;
      setActiveBlock(b=>b-1); setActiveVoicing(prevMaxVI); setPhase("voicing");
    }
  }

  if (!session||!block) return <div style={{ background:"#0d0d0d",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:"#e8e4dc",fontFamily:"monospace" }}>Building session...</div>;

  const totalSteps  = session.blocks.reduce((sum,b) => sum + b.voicings.length, 0);
  const currentStep = session.blocks.slice(0, activeBlock).reduce((sum,b) => sum + b.voicings.length, 0) + activeVoicing + 1;
  const accent      = BLOCK_ACCENT[activeBlock];
  const bgColor     = BLOCK_COLORS[activeBlock];
  const isLastStep  = activeBlock===3 && activeVoicing===maxVI && phase==="voicing";
  const passKeys    = getVoicingPasses(block.use7ths).map(p=>p.type);
  // Mode 1 / Mode 2 blocks show the scale walk in their parent major shape.
  const isModeBlock   = activeBlock===2 || activeBlock===3;
  const modeParentRoot = isModeBlock ? parentMajor(block.rootKey, block.scaleName) : null;

  const voicingTabLabels = block.use7ths
    ? ["Scale Walk","6th Anchor","5th Anchor","4th Anchor"]
    : ["Scale Walk","6th Anchor","5th Anchor","4th Anchor","Open","Power"];

  function jumpTab(i) {
    stopPlayback(); setActiveStep(-1);
    if (i===0) setPhase("scale");
    else { setPhase("voicing"); setActiveVoicing(i-1); }
  }

  return (
    <div style={{ minHeight:"100vh",background:"#0d0d0d",color:"#e8e4dc",fontFamily:"'JetBrains Mono','Fira Code','Courier New',monospace",padding:"16px",boxSizing:"border-box",maxWidth:"900px",margin:"0 auto" }}>

      {/* Header */}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"14px",flexWrap:"wrap",gap:"8px" }}>
        <div>
          <div style={{ fontSize:"10px",letterSpacing:"3px",color:"#666",textTransform:"uppercase",marginBottom:"3px" }}>Practice Session</div>
          <h1 style={{ margin:0,fontSize:"clamp(18px,3.5vw,26px)",fontWeight:700,color:"#f0ebe0",letterSpacing:"-0.5px" }}>WoodShed</h1>
        </div>
        <div style={{ display:"flex",gap:"8px" }}>
          <button onClick={()=>newSession()} style={{ background:"#1a1a1a",border:"1px solid #333",borderRadius:"6px",color:"#c8a87a",fontFamily:"inherit",fontSize:"12px",padding:"8px 14px",cursor:"pointer" }}>⚄ New Session</button>
          <button onClick={()=>setSettingsOpen(true)} aria-label="Settings" style={{ background:"#1a1a1a",border:"1px solid #333",borderRadius:"6px",color:"#c8a87a",fontFamily:"inherit",fontSize:"14px",padding:"8px 12px",cursor:"pointer",lineHeight:1 }}>⚙️</button>
          <button onClick={()=>setHelpOpen(true)} aria-label="Help" style={{ background:"#1a1a1a",border:"1px solid #333",borderRadius:"6px",color:"#c8a87a",fontFamily:"inherit",fontSize:"14px",padding:"8px 12px",cursor:"pointer",lineHeight:1 }}>❓</button>
        </div>
      </div>

      {/* Progressions */}
      <div style={{ display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"14px",background:"#141414",border:"1px solid #222",borderRadius:"8px",padding:"10px 12px",alignItems:"center" }}>
        <span style={{ fontSize:"10px",color:"#555",letterSpacing:"2px",textTransform:"uppercase",marginRight:"4px" }}>Progressions</span>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"6px",width:"100%" }}>
          {BLOCK_LABELS.map((label,bi)=>(
            <div key={bi}>
              <div style={{ fontSize:"9px",color:BLOCK_ACCENT[bi],letterSpacing:"2px",textTransform:"uppercase",marginBottom:"4px" }}>{label}</div>
              <select value={selectedProgs[bi]} onChange={e=>{ const next=[...selectedProgs]; next[bi]=e.target.value; setSelectedProgs(next); if(session) newSession(use7ths,next); }} style={{ width:"100%",background:"#1a1a1a",color:"#c8a87a",border:`1px solid ${BLOCK_COLORS[bi]}`,borderRadius:"5px",fontFamily:"inherit",fontSize:"10px",padding:"5px 6px",cursor:"pointer" }}>
                <option value="Random">Random</option>
                {Object.keys(progressionsFor(session?.blocks[bi]?.scaleName||"Major (Ionian)")).map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Settings modal */}
      {settingsOpen && (
        <div onClick={()=>setSettingsOpen(false)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:"16px" }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:"#141414",border:"1px solid #333",borderRadius:"10px",padding:"18px",width:"100%",maxWidth:"340px" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px" }}>
              <span style={{ fontSize:"11px",color:"#888",letterSpacing:"2px",textTransform:"uppercase" }}>Settings</span>
              <button onClick={()=>setSettingsOpen(false)} aria-label="Close settings" style={{ background:"none",border:"none",color:"#666",fontSize:"18px",cursor:"pointer",lineHeight:1,padding:"4px" }}>✕</button>
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:"8px" }}>
              <button onClick={()=>setLeftHanded(v=>!v)} style={{ textAlign:"left",background:leftHanded?"#2a3a5a":"#1a1a1a",border:`1px solid ${leftHanded?"#4a6aaa":"#333"}`,borderRadius:"6px",color:leftHanded?"#7ab8ff":"#666",fontFamily:"inherit",fontSize:"12px",padding:"10px 12px",cursor:"pointer" }}>
                🤚 Left-Handed {leftHanded?"ON":"OFF"}
              </button>
              <button onClick={()=>{ const next=!use7ths; setUse7ths(next); newSession(next,selectedProgs); }} style={{ textAlign:"left",background:use7ths?"#b87333":"#1a1a1a",border:`1px solid ${use7ths?"#e8a84a":"#333"}`,borderRadius:"6px",color:use7ths?"#fff":"#666",fontFamily:"inherit",fontSize:"12px",padding:"10px 12px",cursor:"pointer" }}>
                7th Chords {use7ths?"ON":"OFF"}
              </button>
              <button onClick={()=>setKeepAwake(v=>!v)} style={{ textAlign:"left",background:keepAwake?"#2a3a5a":"#1a1a1a",border:`1px solid ${keepAwake?"#4a6aaa":"#333"}`,borderRadius:"6px",color:keepAwake?"#7ab8ff":"#666",fontFamily:"inherit",fontSize:"12px",padding:"10px 12px",cursor:"pointer" }}>
                ☀️ Keep Screen Awake {keepAwake?"ON":"OFF"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help modal */}
      {helpOpen && (
        <div onClick={()=>setHelpOpen(false)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:"16px" }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:"#141414",border:"1px solid #333",borderRadius:"10px",padding:"18px",width:"100%",maxWidth:"460px",maxHeight:"80vh",overflowY:"auto" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px" }}>
              <span style={{ fontSize:"11px",color:"#888",letterSpacing:"2px",textTransform:"uppercase" }}>How WoodShed Works</span>
              <button onClick={()=>setHelpOpen(false)} aria-label="Close help" style={{ background:"none",border:"none",color:"#666",fontSize:"18px",cursor:"pointer",lineHeight:1,padding:"4px" }}>✕</button>
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:"16px",fontSize:"12px",color:"#aaa",lineHeight:1.5 }}>
              <div>
                <div style={{ fontSize:"11px",color:"#c8a87a",fontWeight:700,marginBottom:"4px" }}>A Session</div>
                <div>Every session has four blocks — <b style={{color:"#e8e4dc"}}>Major Key</b>, <b style={{color:"#e8e4dc"}}>Minor Key</b>, <b style={{color:"#e8e4dc"}}>Mode 1</b>, and <b style={{color:"#e8e4dc"}}>Mode 2</b> — each assigned a random key, scale, and chord progression. Tap ⚄ New Session to reroll all four. Tap a block in the row of tiles below the header to jump straight to it.</div>
              </div>
              <div>
                <div style={{ fontSize:"11px",color:"#c8a87a",fontWeight:700,marginBottom:"4px" }}>Working a Block</div>
                <div>Each block runs through two stages: <b style={{color:"#e8e4dc"}}>Scale Walk</b> shows the scale's notes and a fretboard diagram to learn the shape first; <b style={{color:"#e8e4dc"}}>Chord Practice</b> then steps through the block's progression in five voicing styles — 6th/5th/4th Anchor (positional shapes built off a bass string), Open, and Power — via the tabs above the fretboard. Use ← Back / Next → to move through steps, or jump directly to a voicing tab.</div>
              </div>
              <div>
                <div style={{ fontSize:"11px",color:"#c8a87a",fontWeight:700,marginBottom:"4px" }}>Playing Along</div>
                <div>During Chord Practice, pick a strumming/picking <b style={{color:"#e8e4dc"}}>Technique</b>, then hit ▶ Play Along — the rhythm strip highlights each step in time with a metronome click. Drag the BPM slider to change tempo.</div>
              </div>
              <div>
                <div style={{ fontSize:"11px",color:"#c8a87a",fontWeight:700,marginBottom:"4px" }}>Theory Tab</div>
                <div>Tap 🎸 Theory to explore any chord on its own — pick a Root and Chord Type (roots from your current session are marked ★) and a voicing style (6th string / 5th string / Open chord) to see its interval breakdown, diagram, and string-by-string notes. Tap ⚄ Random for a random chord. This is a standalone reference, independent of the active block's progression.</div>
              </div>
              <div>
                <div style={{ fontSize:"11px",color:"#c8a87a",fontWeight:700,marginBottom:"4px" }}>Progressions</div>
                <div>Pin any block to a specific chord progression instead of a random one using the dropdowns in the Progressions panel.</div>
              </div>
              <div>
                <div style={{ fontSize:"11px",color:"#c8a87a",fontWeight:700,marginBottom:"4px" }}>Settings (⚙️)</div>
                <div>
                  <div>🤚 <b style={{color:"#e8e4dc"}}>Left-Handed</b> — mirrors every fretboard and chord diagram.</div>
                  <div>7th Chords — swaps triads for 7th-chord voicings throughout.</div>
                  <div>☀️ <b style={{color:"#e8e4dc"}}>Keep Screen Awake</b> — stops your device from locking mid-practice.</div>
                </div>
              </div>
              <div>
                <div style={{ fontSize:"11px",color:"#c8a87a",fontWeight:700,marginBottom:"4px" }}>Installing on iPhone</div>
                <div>In Safari, tap Share → Add to Home Screen. WoodShed installs as a full-screen app and works fully offline.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Session Map */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr) auto",gap:"6px",marginBottom:"14px" }}>
        {session.blocks.map((b,bi)=>(
          <button key={bi} onClick={()=>{ stopPlayback(); setActiveBlock(bi); setActiveVoicing(0); setPhase("scale"); setActiveStep(-1); setActiveTab("practice"); }} style={{ background:activeTab==="practice"&&bi===activeBlock?BLOCK_COLORS[bi]:"#141414",border:`1px solid ${activeTab==="practice"&&bi===activeBlock?BLOCK_ACCENT[bi]:"#222"}`,borderRadius:"6px",padding:"8px 4px",cursor:"pointer",textAlign:"center",transition:"all 0.15s" }}>
            <div style={{ fontSize:"9px",color:activeTab==="practice"&&bi===activeBlock?BLOCK_ACCENT[bi]:"#555",letterSpacing:"2px",textTransform:"uppercase",marginBottom:"3px" }}>{BLOCK_LABELS[bi]}</div>
            <div style={{ fontSize:"13px",fontWeight:700,color:activeTab==="practice"&&bi===activeBlock?"#fff":"#666" }}>{b.rootKey}</div>
            <div style={{ fontSize:"8px",color:activeTab==="practice"&&bi===activeBlock?"#ccc":"#444",marginTop:"2px" }}>{b.scaleName.split(" ")[0]}</div>
          </button>
        ))}
        <button onClick={()=>{ stopPlayback(); setActiveTab("theory"); }} style={{ background:activeTab==="theory"?THEORY_COLOR:"#141414",border:`1px solid ${activeTab==="theory"?THEORY_ACCENT:"#222"}`,borderRadius:"6px",padding:"8px 6px",cursor:"pointer",textAlign:"center",minWidth:"64px" }}>
          <div style={{ fontSize:"9px",color:activeTab==="theory"?THEORY_ACCENT:"#555",letterSpacing:"1px",textTransform:"uppercase",marginBottom:"3px" }}>Theory</div>
          <div style={{ fontSize:"16px" }}>🎸</div>
        </button>
      </div>

      {/* Theory Tab */}
      {activeTab==="theory" && (
        <div style={{ background:"#141414",border:`1px solid ${THEORY_ACCENT}44`,borderRadius:"8px",padding:"14px",marginBottom:"14px" }}>
          <div style={{ fontSize:"10px",color:THEORY_ACCENT,letterSpacing:"3px",textTransform:"uppercase",marginBottom:"12px" }}>Chord Theory</div>
          <ChordTheoryBlock session={session} leftHanded={leftHanded}/>
        </div>
      )}

      {/* Practice Tab */}
      {activeTab==="practice" && (<>

      {/* Progress Bar */}
      <div style={{ height:"2px",background:"#1a1a1a",borderRadius:"1px",marginBottom:"14px",overflow:"hidden" }}>
        <div style={{ height:"100%",width:`${(currentStep/totalSteps)*100}%`,background:accent,transition:"width 0.3s ease" }}/>
      </div>

      {/* Block Header */}
      <div style={{ background:bgColor+"44",border:`1px solid ${accent}44`,borderRadius:"8px",padding:"12px 14px",marginBottom:"12px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"8px" }}>
        <div>
          <div style={{ fontSize:"10px",color:accent,letterSpacing:"3px",textTransform:"uppercase",marginBottom:"2px" }}>{BLOCK_LABELS[activeBlock]}</div>
          <div style={{ fontSize:"22px",fontWeight:700,color:"#fff" }}>
            {block.rootKey} <span style={{ color:accent }}>{block.scaleName.split(" (")[0]}</span>
            <span style={{ fontSize:"13px",color:"#888",fontWeight:400,marginLeft:"8px" }}>{block.scaleName.match(/\(([^)]+)\)/)?.[1]??""}</span>
          </div>
        </div>
        <div style={{ fontSize:"11px",color:"#666",textAlign:"right" }}>
          <div>Progression: <span style={{ color:"#c8a87a" }}>{block.progressionName}</span></div>
          <div style={{ marginTop:"2px" }}>Step {currentStep} of {totalSteps}</div>
        </div>
      </div>

      {/* Phase Tabs */}
      <div style={{ display:"flex",gap:"5px",marginBottom:"12px",flexWrap:"wrap" }}>
        {voicingTabLabels.map((label,i)=>{
          const isActive=i===0?phase==="scale":(phase==="voicing"&&activeVoicing===i-1);
          return <button key={label} onClick={()=>jumpTab(i)} style={{ flex:1,minWidth:"60px",padding:"6px 4px",background:isActive?accent+"33":"#141414",border:`1px solid ${isActive?accent:"#222"}`,borderRadius:"5px",color:isActive?"#fff":"#555",fontFamily:"inherit",fontSize:"10px",cursor:"pointer",transition:"all 0.1s" }}>{label}</button>;
        })}
      </div>

      {/* Scale Phase */}
      {phase==="scale" && (
        <div style={{ background:"#141414",border:"1px solid #222",borderRadius:"8px",padding:"14px",marginBottom:"14px" }}>
          <div style={{ display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap",marginBottom:"8px" }}>
            <div style={{ fontSize:"10px",color:"#666",letterSpacing:"2px",textTransform:"uppercase" }}>
              Scale Notes — <span style={{ textTransform:"none" }}>{block.rootKey} {block.scaleName.split(" (")[0]}</span>
            </div>
            {parentMajor(block.rootKey,block.scaleName) && (
              <div style={{ fontSize:"10px",color:"#7ab8c8",background:"#7ab8c811",border:"1px solid #7ab8c844",borderRadius:"4px",padding:"2px 8px" }}>
                Parent major: {parentMajor(block.rootKey,block.scaleName)} major
              </div>
            )}
          </div>
          <div style={{ display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"14px" }}>
            {block.scale.map((note,i)=>(
              <div key={i} style={{ background:note===block.rootKey?accent:"#1e1e1e",border:`1px solid ${note===block.rootKey?accent:"#333"}`,borderRadius:"20px",padding:"5px 12px",fontSize:"13px",fontWeight:700,color:note===block.rootKey?"#fff":"#c8a87a" }}>
                {note}<span style={{ fontSize:"9px",color:note===block.rootKey?"#ffd":"#666",marginLeft:"4px" }}>{["1","2","3","4","5","6","7"][i]}</span>
              </div>
            ))}
          </div>
          <ScaleDiagram
            rootName={modeParentRoot || block.rootKey}
            scaleName={modeParentRoot ? "Major (Ionian)" : block.scaleName}
            modalRoot={modeParentRoot ? block.rootKey : null}
            leftHanded={leftHanded}
          />
          <button onClick={()=>{ setPhase("voicing"); setActiveVoicing(0); }} style={{ marginTop:"12px",background:accent+"22",border:`1px solid ${accent}66`,borderRadius:"6px",color:accent,fontFamily:"inherit",fontSize:"12px",padding:"8px 16px",cursor:"pointer" }}>
            Start Chord Practice →
          </button>
        </div>
      )}

      {/* Voicing Phase */}
      {phase==="voicing" && voicing && (<>
        <div style={{ background:"#141414",border:`1px solid ${accent}33`,borderRadius:"6px",padding:"8px 12px",marginBottom:"10px",fontSize:"11px",color:"#888" }}>
          <span style={{ color:accent,fontWeight:700 }}>{PASS_LABELS[voicing.type]}: </span>{PASS_DESC[voicing.type]}
        </div>
        {(voicing.type==="6th-anchored positional"||voicing.type==="5th-anchored positional"||voicing.type==="4th-anchored") && (
          <StringMapBar chordShapes={voicing.chordShapes}/>
        )}
        <div style={{ background:"#141414",border:"1px solid #222",borderRadius:"8px",padding:"14px",marginBottom:"10px" }}>
          <div style={{ fontSize:"10px",color:"#666",letterSpacing:"2px",textTransform:"uppercase",marginBottom:"10px" }}>
            {block.progressionName} — {voicing.type}
          </div>
          <div style={{ display:"flex",gap:"10px",flexWrap:"wrap" }}>
            {voicing.chordShapes.map((cs,i)=><ChordDiagram key={i} chordName={cs.name} voicingData={cs.voicing} leftHanded={leftHanded}/>)}
          </div>
        </div>
        <div style={{ background:"#141414",border:"1px solid #222",borderRadius:"8px",padding:"14px",marginBottom:"14px" }}>
          <div style={{ display:"flex",gap:"6px",marginBottom:"8px",alignItems:"center",flexWrap:"wrap" }}>
            <span style={{ fontSize:"9px",color:"#666",letterSpacing:"2px",textTransform:"uppercase",marginRight:"2px" }}>Technique</span>
            {TECHNIQUE_ORDER.map(t=>{
              const isActive    = voicing.rhythm.technique===t;
              const isSuggested = voicing.suggestedTechnique===t;
              return (
                <button key={t} onClick={()=>setVoicingTechnique(t)} style={{ position:"relative",background:isActive?accent:"#1a1a1a",border:`1px solid ${isActive?accent:"#333"}`,borderRadius:"5px",color:isActive?"#fff":"#888",fontFamily:"inherit",fontSize:"11px",padding:"6px 12px",cursor:"pointer" }}>
                  {TECHNIQUES[t].label}
                  {isSuggested && <span style={{ position:"absolute",top:"-6px",right:"-4px",fontSize:"7px",background:"#c8a87a",color:"#000",borderRadius:"3px",padding:"1px 3px",fontWeight:700,letterSpacing:"0.5px" }}>SUGGESTED</span>}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize:"10px",color:"#777",marginBottom:"10px" }}>{voicing.rhythm.description}</div>
          <RhythmStrip steps={voicing.rhythm.steps} activeStep={isPlaying?activeStep:-1} technique={voicing.rhythm.technique} styleLabel={voicing.rhythm.styleLabel} stepsPerBeat={voicing.rhythm.stepsPerBeat}/>
        </div>
        <div style={{ display:"flex",gap:"8px",alignItems:"center",marginBottom:"14px",flexWrap:"wrap" }}>
          <button onClick={togglePlay} style={{ background:isPlaying?accent:"#1e1e1e",border:`1px solid ${isPlaying?accent:"#444"}`,borderRadius:"6px",color:"#fff",fontFamily:"inherit",fontSize:"13px",padding:"9px 20px",cursor:"pointer",minWidth:"110px",transition:"all 0.15s" }}>
            {isPlaying?"⏹ Stop":"▶ Play Along"}
          </button>
          <div style={{ display:"flex",alignItems:"center",gap:"8px",flex:1,minWidth:"180px" }}>
            <span style={{ fontSize:"10px",color:"#666",letterSpacing:"1px" }}>BPM</span>
            <input type="range" min={40} max={180} value={tempo} onChange={e=>setTempo(Number(e.target.value))} style={{ flex:1,accentColor:accent,cursor:"pointer" }}/>
            <span style={{ fontSize:"13px",color:accent,minWidth:"44px",textAlign:"right" }}>{tempo}</span>
          </div>
        </div>
      </>)}

      {/* Navigation */}
      <div style={{ display:"flex",gap:"8px" }}>
        <button onClick={goBack} disabled={activeBlock===0&&phase==="scale"} style={{ background:"#141414",border:"1px solid #222",borderRadius:"6px",color:"#666",fontFamily:"inherit",fontSize:"12px",padding:"9px 16px",cursor:"pointer",opacity:(activeBlock===0&&phase==="scale")?0.3:1 }}>← Back</button>
        <button onClick={()=>{
          if (phase==="scale"){ stopPlayback(); setPhase("voicing"); setActiveVoicing(0); setActiveStep(-1); }
          else if (isLastStep) newSession();
          else advance();
        }} style={{ flex:1,background:isLastStep?accent:"#1e1e1e",border:`1px solid ${isLastStep?accent:"#333"}`,borderRadius:"6px",color:"#fff",fontFamily:"inherit",fontSize:"12px",padding:"9px 16px",cursor:"pointer",transition:"all 0.15s" }}>
          {phase==="scale"?"Start Chord Practice →":isLastStep?"🎸 Session Complete — New Session →":activeVoicing<maxVI?`Next: ${PASS_LABELS[passKeys[activeVoicing+1]]} →`:`Next Block: ${BLOCK_LABELS[activeBlock+1]} →`}
        </button>
      </div>

      </>)}{/* end practice tab */}

      <div style={{ marginTop:"16px",fontSize:"10px",color:"#333",textAlign:"center",lineHeight:1.7 }}>
        <div>{legendForTechnique(phase==="voicing" && voicing ? voicing.rhythm.technique : "strum")}</div>
        <div>
          🟠 root · 🔵 scale note &nbsp;·&nbsp;
          <span style={{ color:"#c8a87a" }}>amber = 6th str</span> &nbsp;·&nbsp;
          <span style={{ color:"#7ab8c8" }}>blue = 5th str</span>
        </div>
      </div>
    </div>
  );
}
