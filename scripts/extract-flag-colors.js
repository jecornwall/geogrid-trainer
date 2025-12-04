/**
 * Extract Flag Colors for GeoGrid Trainer
 * 
 * Parses downloaded SVG flag files to extract colors and normalize them
 * to the 12 GeoGrid-accepted colors.
 * 
 * Rules from flag-with-color.md:
 * - Only 12 colors recognized: black, white, grey, pink, red, orange, 
 *   yellow, green, blue, light blue, purple, brown
 * - Shades don't count separately (dark red → red)
 * - Exception for Blue: If two distinct blues exist and one is significantly
 *   lighter, classify as both "blue" and "light blue"
 * 
 * Run with: node scripts/extract-flag-colors.js
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const CONFIG = {
  flagsDir: path.join(ROOT, 'data/flags'),
  outputJson: path.join(ROOT, 'data/flags/_colors.json'),
  countriesJsonl: path.join(ROOT, 'data/countries.jsonl'),
};

// ============================================
// COLOR DEFINITIONS
// ============================================

/**
 * The 12 GeoGrid-accepted colors with their RGB reference values.
 * These are chosen to be "typical" representatives of each color category.
 */
const ACCEPTED_COLORS = {
  black:      { r: 0,   g: 0,   b: 0   },
  white:      { r: 255, g: 255, b: 255 },
  grey:       { r: 128, g: 128, b: 128 },
  pink:       { r: 255, g: 105, b: 180 },  // Hot pink - good middle ground
  red:        { r: 200, g: 30,  b: 30  },  // Typical flag red
  orange:     { r: 255, g: 140, b: 0   },  // Dark orange
  yellow:     { r: 255, g: 215, b: 0   },  // Gold/yellow
  green:      { r: 0,   g: 128, b: 0   },  // Medium green
  blue:       { r: 0,   g: 50,  b: 160 },  // Typical flag blue (darker)
  'light blue': { r: 100, g: 180, b: 230 }, // Sky blue
  purple:     { r: 128, g: 0,   b: 128 },
  brown:      { r: 139, g: 90,  b: 43  },  // Saddle brown
};

/**
 * Named CSS colors mapped to RGB values (subset commonly used in flags)
 */
const NAMED_COLORS = {
  black: { r: 0, g: 0, b: 0 },
  white: { r: 255, g: 255, b: 255 },
  red: { r: 255, g: 0, b: 0 },
  green: { r: 0, g: 128, b: 0 },
  blue: { r: 0, g: 0, b: 255 },
  yellow: { r: 255, g: 255, b: 0 },
  orange: { r: 255, g: 165, b: 0 },
  purple: { r: 128, g: 0, b: 128 },
  pink: { r: 255, g: 192, b: 203 },
  brown: { r: 165, g: 42, b: 42 },
  gold: { r: 255, g: 215, b: 0 },
  silver: { r: 192, g: 192, b: 192 },
  gray: { r: 128, g: 128, b: 128 },
  grey: { r: 128, g: 128, b: 128 },
  navy: { r: 0, g: 0, b: 128 },
  maroon: { r: 128, g: 0, b: 0 },
  olive: { r: 128, g: 128, b: 0 },
  teal: { r: 0, g: 128, b: 128 },
  aqua: { r: 0, g: 255, b: 255 },
  cyan: { r: 0, g: 255, b: 255 },
  lime: { r: 0, g: 255, b: 0 },
  fuchsia: { r: 255, g: 0, b: 255 },
  magenta: { r: 255, g: 0, b: 255 },
  crimson: { r: 220, g: 20, b: 60 },
  darkred: { r: 139, g: 0, b: 0 },
  darkgreen: { r: 0, g: 100, b: 0 },
  darkblue: { r: 0, g: 0, b: 139 },
  lightblue: { r: 173, g: 216, b: 230 },
  skyblue: { r: 135, g: 206, b: 235 },
  royalblue: { r: 65, g: 105, b: 225 },
  forestgreen: { r: 34, g: 139, b: 34 },
  seagreen: { r: 46, g: 139, b: 87 },
  turquoise: { r: 64, g: 224, b: 208 },
  coral: { r: 255, g: 127, b: 80 },
  salmon: { r: 250, g: 128, b: 114 },
  khaki: { r: 240, g: 230, b: 140 },
  tan: { r: 210, g: 180, b: 140 },
  sienna: { r: 160, g: 82, b: 45 },
  chocolate: { r: 210, g: 105, b: 30 },
  saddlebrown: { r: 139, g: 69, b: 19 },
  peru: { r: 205, g: 133, b: 63 },
  wheat: { r: 245, g: 222, b: 179 },
  beige: { r: 245, g: 245, b: 220 },
  ivory: { r: 255, g: 255, b: 240 },
  snow: { r: 255, g: 250, b: 250 },
  none: null,
  transparent: null,
};

// ============================================
// COLOR PARSING UTILITIES
// ============================================

/**
 * Parse a hex color string to RGB
 */
function parseHex(hex) {
  hex = hex.replace('#', '');
  
  // Handle 3-character hex
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  
  // Handle 4-character hex (with alpha)
  if (hex.length === 4) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  
  // Handle 8-character hex (with alpha)
  if (hex.length === 8) {
    hex = hex.substring(0, 6);
  }
  
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return null;
  }
  
  return { r, g, b };
}

/**
 * Parse an rgb() or rgba() color string to RGB
 */
function parseRgb(str) {
  const match = str.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!match) return null;
  
  return {
    r: parseInt(match[1], 10),
    g: parseInt(match[2], 10),
    b: parseInt(match[3], 10),
  };
}

/**
 * Parse any color string to RGB
 */
function parseColor(colorStr) {
  if (!colorStr || typeof colorStr !== 'string') return null;
  
  colorStr = colorStr.trim().toLowerCase();
  
  // Skip none/transparent
  if (colorStr === 'none' || colorStr === 'transparent' || colorStr === 'inherit' || colorStr === 'currentcolor') {
    return null;
  }
  
  // Named color
  if (NAMED_COLORS[colorStr] !== undefined) {
    return NAMED_COLORS[colorStr];
  }
  
  // Hex color
  if (colorStr.startsWith('#')) {
    return parseHex(colorStr);
  }
  
  // RGB/RGBA
  if (colorStr.startsWith('rgb')) {
    return parseRgb(colorStr);
  }
  
  // URL references (gradients, patterns) - skip
  if (colorStr.startsWith('url(')) {
    return null;
  }
  
  return null;
}

// ============================================
// COLOR MATCHING
// ============================================

/**
 * Calculate Euclidean distance between two RGB colors
 */
function colorDistance(c1, c2) {
  const dr = c1.r - c2.r;
  const dg = c1.g - c2.g;
  const db = c1.b - c2.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Calculate perceptual lightness (0-100 scale, roughly)
 */
function getLightness(rgb) {
  // Using relative luminance formula
  return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 2.55;
}

/**
 * Check if a color is "blue-ish" (for the blue exception rule)
 */
function isBlueish(rgb) {
  // Blue has high B component relative to R and G
  return rgb.b > rgb.r && rgb.b > rgb.g && rgb.b > 50;
}

/**
 * Find the closest accepted color for an RGB value
 */
function findClosestColor(rgb) {
  let closest = null;
  let minDist = Infinity;
  
  for (const [name, ref] of Object.entries(ACCEPTED_COLORS)) {
    const dist = colorDistance(rgb, ref);
    if (dist < minDist) {
      minDist = dist;
      closest = name;
    }
  }
  
  return closest;
}

/**
 * Apply the blue exception rule:
 * If there are multiple distinct blue shades and one is significantly lighter,
 * classify the lighter one as "light blue"
 */
function applyBlueException(colors, rawBlues) {
  if (!colors.includes('blue') || rawBlues.length < 2) {
    return colors;
  }
  
  // Calculate lightness of each blue
  const bluesWithLightness = rawBlues.map(rgb => ({
    rgb,
    lightness: getLightness(rgb),
  }));
  
  // Sort by lightness
  bluesWithLightness.sort((a, b) => a.lightness - b.lightness);
  
  const darkest = bluesWithLightness[0];
  const lightest = bluesWithLightness[bluesWithLightness.length - 1];
  
  // If lightness difference is significant (> 20 on 0-100 scale), add light blue
  const lightnessDiff = lightest.lightness - darkest.lightness;
  
  if (lightnessDiff > 20 && !colors.includes('light blue')) {
    // Also check the lightest blue is actually light (> 50 lightness)
    if (lightest.lightness > 45) {
      colors.push('light blue');
    }
  }
  
  return colors;
}

// ============================================
// SVG PARSING
// ============================================

/**
 * Extract all color values from an SVG string
 */
function extractColorsFromSvg(svgContent) {
  const colors = new Set();
  const rawColors = []; // Store raw RGB values for blue exception
  
  // Match fill and stroke attributes
  const fillMatches = svgContent.matchAll(/fill\s*[=:]\s*["']?([^"';\s>]+)/gi);
  const strokeMatches = svgContent.matchAll(/stroke\s*[=:]\s*["']?([^"';\s>]+)/gi);
  const stopColorMatches = svgContent.matchAll(/stop-color\s*[=:]\s*["']?([^"';\s>]+)/gi);
  const styleMatches = svgContent.matchAll(/style\s*=\s*["']([^"']+)/gi);
  
  const colorStrings = new Set();
  
  // Collect all color strings
  for (const match of fillMatches) {
    colorStrings.add(match[1]);
  }
  for (const match of strokeMatches) {
    colorStrings.add(match[1]);
  }
  for (const match of stopColorMatches) {
    colorStrings.add(match[1]);
  }
  
  // Parse inline styles for fill/stroke
  for (const match of styleMatches) {
    const style = match[1];
    const fillStyle = style.match(/fill\s*:\s*([^;]+)/i);
    const strokeStyle = style.match(/stroke\s*:\s*([^;]+)/i);
    if (fillStyle) colorStrings.add(fillStyle[1].trim());
    if (strokeStyle) colorStrings.add(strokeStyle[1].trim());
  }
  
  // Parse each color string
  for (const colorStr of colorStrings) {
    const rgb = parseColor(colorStr);
    if (rgb) {
      rawColors.push(rgb);
      const normalized = findClosestColor(rgb);
      if (normalized) {
        colors.add(normalized);
      }
    }
  }
  
  // Check for shape elements without explicit fill attribute (default to black in SVG)
  // Remove non-rendering containers: defs, clipPath, mask, symbol, pattern
  const svgClean = svgContent
    .replace(/<defs\b[^>]*>[\s\S]*?<\/defs>/gi, '')
    .replace(/<clipPath\b[^>]*>[\s\S]*?<\/clipPath>/gi, '')
    .replace(/<mask\b[^>]*>[\s\S]*?<\/mask>/gi, '')
    .replace(/<symbol\b[^>]*>[\s\S]*?<\/symbol>/gi, '')
    .replace(/<pattern\b[^>]*>[\s\S]*?<\/pattern>/gi, '');
  
  // Match tags like <rect ...> or <path ...> that don't contain 'fill='
  // Also track if we're inside a <g> with fill (which provides inherited fill)
  // Simple heuristic: if any <g fill="..."> or <svg fill="..."> exists, shapes inside may inherit
  const hasGroupWithFill = /<g\b[^>]*\bfill\s*=/i.test(svgClean);
  const hasSvgWithFill = /<svg\b[^>]*\bfill\s*=/i.test(svgClean);
  const hasInheritableFill = hasGroupWithFill || hasSvgWithFill;
  
  const shapeElements = svgClean.matchAll(/<(path|rect|circle|polygon|ellipse|polyline)\b([^>]*)>/gi);
  for (const match of shapeElements) {
    const attrs = match[2];
    // If no fill attribute, element uses default black
    // BUT: if element has stroke and no fill, it's a line/stroke-only shape - fill won't render
    // AND: if there are groups with fill, the element might inherit
    const hasFill = attrs.includes('fill=') || attrs.includes('fill:');
    const hasStroke = attrs.includes('stroke=') || attrs.includes('stroke:');
    
    if (!hasFill && !hasStroke && !hasInheritableFill) {
      // No fill, no stroke, no possible inheritance = defaults to black fill
      colors.add('black');
      break;
    }
  }
  
  // Track raw blue colors for the exception rule
  const rawBlues = rawColors.filter(isBlueish);
  
  let colorArray = Array.from(colors);
  
  // Apply blue exception
  colorArray = applyBlueException(colorArray, rawBlues);
  
  // Sort for consistency
  const colorOrder = Object.keys(ACCEPTED_COLORS);
  colorArray.sort((a, b) => colorOrder.indexOf(a) - colorOrder.indexOf(b));
  
  return {
    colors: colorArray,
    rawColorCount: rawColors.length,
    rawBlueCount: rawBlues.length,
  };
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('🎨 Flag Color Extractor\n');
  
  // Find all SVG files
  const files = await fs.readdir(CONFIG.flagsDir);
  const svgFiles = files.filter(f => f.endsWith('.svg')).sort();
  
  console.log(`📂 Found ${svgFiles.length} flag SVGs\n`);
  
  const results = {};
  const stats = {
    processed: 0,
    colorCounts: {},
  };
  
  for (const file of svgFiles) {
    const iso = file.replace('.svg', '').toUpperCase();
    const filePath = path.join(CONFIG.flagsDir, file);
    
    const svgContent = await fs.readFile(filePath, 'utf-8');
    const { colors, rawColorCount, rawBlueCount } = extractColorsFromSvg(svgContent);
    
    results[iso] = {
      colors,
      colorCount: colors.length,
      rawColorCount,
    };
    
    // Track statistics
    stats.processed++;
    for (const color of colors) {
      stats.colorCounts[color] = (stats.colorCounts[color] || 0) + 1;
    }
    
    // Show progress with colors
    const colorList = colors.length > 0 ? colors.join(', ') : '(no colors found)';
    console.log(`  ${iso}: ${colorList}`);
    
    // Flag blue exception cases
    if (rawBlueCount >= 2 && colors.includes('light blue')) {
      console.log(`      ↳ Blue exception applied (${rawBlueCount} blues detected)`);
    }
  }
  
  // Write results
  await fs.writeFile(CONFIG.outputJson, JSON.stringify(results, null, 2));
  console.log(`\n📄 Colors saved to: ${CONFIG.outputJson}`);
  
  // Print statistics
  console.log('\n' + '='.repeat(50));
  console.log('📊 Statistics:\n');
  console.log(`   Flags processed: ${stats.processed}`);
  console.log('\n   Color frequency:');
  
  const sortedColors = Object.entries(stats.colorCounts)
    .sort((a, b) => b[1] - a[1]);
  
  for (const [color, count] of sortedColors) {
    const bar = '█'.repeat(Math.round(count / 5));
    console.log(`   ${color.padEnd(12)} ${String(count).padStart(3)} ${bar}`);
  }
  
  // Show sample flags for verification
  console.log('\n📋 Sample extractions for verification:');
  const samples = ['US', 'GB', 'JP', 'BR', 'IN', 'ZA', 'UA', 'JM'];
  for (const iso of samples) {
    if (results[iso]) {
      console.log(`   ${iso}: ${results[iso].colors.join(', ')}`);
    }
  }
}

main().catch(console.error);

