// One-off: generate tile art (512px PNG) for the bundled Lynx demo apps, whose
// icons don't come from a remote site the way apps:snapshot resolves them.
// Run: node scripts/make-lynx-icons.mjs
import { Resvg } from "@resvg/resvg-js";
import fs from "fs";
import path from "path";

const OUT = path.join(process.cwd(), "public", "app-icons");

function render(name, svg) {
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 512 } });
  const png = resvg.render().asPng();
  const file = path.join(OUT, `${name}.png`);
  fs.writeFileSync(file, png);
  console.log("wrote", file, png.length, "bytes");
}

const S = 512;

// A big rounded plus, centered — the "counter/stepper" motif.
function plus(color, w = 44, len = 150) {
  const c = S / 2;
  return `
    <rect x="${c - w / 2}" y="${c - len / 2}" width="${w}" height="${len}" rx="${w / 2}" fill="${color}"/>
    <rect x="${c - len / 2}" y="${c - w / 2}" width="${len}" height="${w}" rx="${w / 2}" fill="${color}"/>`;
}

// React-Lynx counter — navy field, cyan plus.
render(
  "lynx-react-counter",
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0e1630"/><stop offset="1" stop-color="#1b3a7a"/>
    </linearGradient></defs>
    <rect width="${S}" height="${S}" fill="url(#g)"/>
    ${plus("#61dafb")}
    <rect x="128" y="356" width="256" height="10" rx="5" fill="#61dafb" opacity="0.25"/>
  </svg>`,
);

// React-Lynx picker — dark field, 2×3 grid of vibe colors.
const COLORS = ["#ff6b9d", "#6b7bff", "#38d39f", "#ff9f43", "#4dc0ff", "#ffd93d"];
function dots() {
  let out = "";
  const r = 52;
  const xs = [166, 346];
  const ys = [150, 256, 362];
  let k = 0;
  for (const y of ys) for (const x of xs) {
    out += `<circle cx="${x}" cy="${y}" r="${r}" fill="${COLORS[k++]}"/>`;
  }
  return out;
}
render(
  "lynx-react-picker",
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}">
    <rect width="${S}" height="${S}" fill="#16121e"/>
    ${dots()}
  </svg>`,
);

// Vue-Lynx counter — green field, green plus (only used if the Vue bundle builds).
render(
  "lynx-vue-counter",
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}">
    <defs><linearGradient id="gv" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0c2018"/><stop offset="1" stop-color="#12503a"/>
    </linearGradient></defs>
    <rect width="${S}" height="${S}" fill="url(#gv)"/>
    ${plus("#42d392")}
    <rect x="128" y="356" width="256" height="10" rx="5" fill="#42d392" opacity="0.25"/>
  </svg>`,
);
