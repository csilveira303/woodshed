import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const scale = size / 512;
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = "#0d0d0d";
  ctx.fillRect(0, 0, 512, 512);

  // --- Shed walls (rounded, with a faint outline for definition) ---
  roundedRect(ctx, 126, 290, 260, 170, 10);
  ctx.fillStyle = "#1e1e1e";
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // --- Amber elements share a soft glow for a bit of polish ---
  ctx.save();
  ctx.shadowColor = "rgba(184,115,51,0.5)";
  ctx.shadowBlur = 18;

  // Shed roof
  ctx.beginPath();
  ctx.moveTo(100, 290);
  ctx.lineTo(256, 180);
  ctx.lineTo(412, 290);
  ctx.closePath();
  ctx.fillStyle = "#b87333";
  ctx.fill();

  // Guitar neck (drawn over the roof so it appears to poke through)
  roundedRect(ctx, 232, 102, 28, 248, 4);
  ctx.fillStyle = "#b87333";
  ctx.fill();

  // Headstock — tapered trapezoid, slightly left of shed center
  ctx.beginPath();
  ctx.moveTo(232, 102);
  ctx.lineTo(260, 102);
  ctx.lineTo(276, 74);
  ctx.lineTo(216, 74);
  ctx.closePath();
  ctx.fillStyle = "#b87333";
  ctx.fill();

  ctx.restore();

  // --- Crisp details on top (no glow) ---

  // Fret lines across the neck
  ctx.strokeStyle = "#0d0d0d";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    const y = 150 + i * 40;
    ctx.beginPath();
    ctx.moveTo(234, y);
    ctx.lineTo(258, y);
    ctx.stroke();
  }

  // Tuning pegs — filled circle with a thin dark ring for definition
  const pegYs = [78, 88, 98];
  for (const y of pegYs) {
    for (const x of [208, 284]) {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#c8a87a";
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#0d0d0d";
      ctx.stroke();
    }
  }

  // Door
  roundedRect(ctx, 214, 376, 84, 84, 6);
  ctx.fillStyle = "#2a2a2a";
  ctx.fill();

  return canvas;
}

const outDir = path.join(__dirname, "../public/icons");
fs.mkdirSync(outDir, { recursive: true });

const icon192 = drawIcon(192);
fs.writeFileSync(path.join(outDir, "icon-192.png"), icon192.toBuffer("image/png"));

const icon512 = drawIcon(512);
fs.writeFileSync(path.join(outDir, "icon-512.png"), icon512.toBuffer("image/png"));

console.log("Icons generated: icon-192.png, icon-512.png");
