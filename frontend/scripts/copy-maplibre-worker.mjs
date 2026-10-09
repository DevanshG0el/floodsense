// MapLibre GL v6 runs tile parsing in a separate module worker that bundlers do not emit.
// Copy it into public/ so it is served next to the app, then point setWorkerUrl at it.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("maplibre-gl/package.json"));
mkdirSync("public/maplibre", { recursive: true });
copyFileSync(join(dist, "dist", "maplibre-gl-worker.mjs"), "public/maplibre/maplibre-gl-worker.js");
console.log("copied maplibre worker -> public/maplibre/maplibre-gl-worker.js");
