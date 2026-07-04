import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

await mkdir(new URL("../assets", import.meta.url), { recursive: true });

const source = fileURLToPath(new URL("../assets/source/icon.svg", import.meta.url));
const adaptiveSource = fileURLToPath(new URL("../assets/source/adaptive-icon.svg", import.meta.url));

await Promise.all([
  sharp(source).resize(1024, 1024).png().toFile(fileURLToPath(new URL("../assets/icon.png", import.meta.url))),
  sharp(adaptiveSource).resize(1024, 1024).png().toFile(fileURLToPath(new URL("../assets/adaptive-icon.png", import.meta.url))),
  sharp(source).resize(64, 64).png().toFile(fileURLToPath(new URL("../assets/favicon.png", import.meta.url)))
]);

console.log("Rendered Daily Vedic Astro app assets.");
