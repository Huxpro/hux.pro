// The experiences' saved intent trees (content/scenes/*.intents.json, written
// by /api/scenes/intents in dev and committed), copied beside the built
// experiences (public/scenes/_data/), where each loads its own on start.

import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const FROM = "content/scenes";
const TO = "public/scenes/_data";
mkdirSync(TO, { recursive: true });
if (existsSync(FROM)) for (const f of readdirSync(FROM)) if (f.endsWith(".json")) copyFileSync(join(FROM, f), join(TO, f));
