#!/usr/bin/env node
/**
 * PWA Icon Generator
 *
 * Generates PNG icons from the SVG icon for PWA manifest.
 * Run: node scripts/generate-pwa-icons.js
 *
 * Requires: npm install sharp
 */

const fs = require("fs");
const path = require("path");

async function generateIcons() {
  // Dynamic import for sharp (ESM module)
  const sharp = (await import("sharp")).default;

  const svgPath = path.join(__dirname, "../public/images/icons/icon.svg");
  const outputDir = path.join(__dirname, "../public/images/icons");

  // Sizes to generate
  const sizes = [192, 512];

  // Read SVG
  const svgBuffer = fs.readFileSync(svgPath);

  console.log("Generating PWA icons...");

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}.png`);

    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);

    console.log(`  Created: icon-${size}.png`);
  }

  console.log("Done! Icons generated in public/images/icons/");
}

generateIcons().catch(console.error);
