// Generates the PNG app icons from our logo (app/icon.svg).
// Run after changing the logo:   node scripts/generate-icons.mjs
//
// Makes:
//   public/icons/icon-192.png           Android / install icon (rounded square)
//   public/icons/icon-512.png           Android / install icon, large
//   public/icons/icon-maskable-512.png  Android "maskable" icon: full navy square, logo
//                                       shrunk into the middle so any crop shape (circle,
//                                       squircle…) keeps the whole hanger visible
//   app/apple-icon.png (180px)          iPhone home screen icon. Full navy square with no
//                                       rounded corners: iOS rounds it itself and would
//                                       turn transparent corners black.
//
// Uses "sharp", which comes with Next.js (no extra install needed).
import { mkdir, readFile } from "node:fs/promises";
import sharp from "sharp";

const svg = await readFile("app/icon.svg", "utf8");

// The logo's drawing = everything inside <svg> except the rounded navy background.
const drawing = svg
  .replace(/^[\s\S]*?<svg[^>]*>/, "")
  .replace(/<\/svg>\s*$/, "")
  .replace(/<rect[^>]*\/>/, "");

// Full-bleed navy square with the drawing scaled around the center.
function fullBleed(scale) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#0D1B3D"/>
  <g transform="translate(50 50) scale(${scale}) translate(-50 -50)">${drawing}</g>
</svg>`;
}

async function render(source, size, out) {
  await sharp(Buffer.from(source), { density: 72 * (size / 100) * 4 })
    .resize(size, size)
    .png()
    .toFile(out);
  console.log("made", out);
}

await mkdir("public/icons", { recursive: true });
await render(svg, 192, "public/icons/icon-192.png");
await render(svg, 512, "public/icons/icon-512.png");
await render(fullBleed(0.72), 512, "public/icons/icon-maskable-512.png"); // fits the 80% safe zone
await render(fullBleed(0.86), 180, "app/apple-icon.png");
