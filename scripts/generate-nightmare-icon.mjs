import sharp from "sharp";
import fs from "fs";
import path from "path";

const svg = `<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#141824" />
      <stop offset="50%" stop-color="#08090d" />
      <stop offset="100%" stop-color="#000000" />
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#000000" flood-opacity="0.9" />
    </filter>
  </defs>

  <!-- Deep Dark Void Background -->
  <rect width="512" height="512" fill="url(#bg)" />

  <!-- Moonlit Room Doorway Frame hint -->
  <rect x="96" y="64" width="320" height="448" rx="8" stroke="#1d2230" stroke-width="2" fill="#040507" />
  <rect x="108" y="76" width="296" height="436" fill="#010203" />

  <!-- The Tall Figure with Huge Flat Hat -->
  <g filter="url(#shadow)">
    <!-- Hat Crown -->
    <ellipse cx="256" cy="156" rx="52" ry="16" fill="#020304" />
    <path d="M 204 156 C 204 126, 308 126, 308 156 L 306 186 L 206 186 Z" fill="#06070a" />
    
    <!-- Enormous Circular Flat Brim (犹太人式但远大于此的巨型平圆帽子) -->
    <ellipse cx="256" cy="186" rx="192" ry="38" fill="#020203" stroke="#252a3a" stroke-width="2.5" />
    <ellipse cx="256" cy="188" rx="186" ry="36" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1.5" />

    <!-- Gaunt Head in Deep Shadow -->
    <path d="M 234 192 C 230 216, 236 244, 256 254 C 276 244, 282 216, 278 192 Z" fill="#050608" />

    <!-- Pale Gaze Eyes in the Dark -->
    <ellipse cx="245" cy="216" rx="3.5" ry="2.2" fill="#d2d8e8" />
    <ellipse cx="267" cy="216" rx="3.5" ry="2.2" fill="#d2d8e8" />
    <circle cx="245" cy="216" r="1.2" fill="#ffffff" />
    <circle cx="267" cy="216" r="1.2" fill="#ffffff" />

    <!-- Slender Towering Coat Silhouette -->
    <path
      d="M 256 254
         C 218 258, 202 278, 194 316
         L 178 512
         L 334 512
         L 318 316
         C 310 278, 294 258, 256 254 Z"
      fill="#030406"
    />
    <!-- Hanging Arms -->
    <path d="M 194 310 C 182 380, 176 450, 172 512" stroke="#020204" stroke-width="20" stroke-linecap="round" />
    <path d="M 318 310 C 330 380, 336 450, 340 512" stroke="#020204" stroke-width="20" stroke-linecap="round" />
  </g>

  <!-- Door Opening Crack of Light / Warning Glow -->
  <line x1="96" y1="64" x2="96" y2="512" stroke="rgba(190,40,40,0.6)" stroke-width="3" />
</svg>`;

async function main() {
  const outPath = path.join(process.cwd(), "public/app-icons/nightmare.png");
  await sharp(Buffer.from(svg))
    .resize(512, 512)
    .png()
    .toFile(outPath);
  console.log("Generated:", outPath);
}

main().catch(console.error);
