/**
 * Download Flag SVGs for GeoGrid Trainer
 * 
 * Downloads all flag SVG files from Wikimedia Commons based on URLs
 * stored in wikidata/flagImages.json. Saves them locally for:
 * 1. Version control (stable, offline access)
 * 2. Color extraction analysis
 * 
 * Run with: node scripts/download-flag-svgs.js
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const CONFIG = {
  flagImagesJson: path.join(ROOT, 'data/raw/wikidata/flagImages.json'),
  outputDir: path.join(ROOT, 'data/flags'),
  userAgent: 'GeoGridTrainer/1.0 (https://github.com/geogrid-trainer; Educational project)',
  delayMs: 200, // Be nice to Wikimedia servers
};

/**
 * Sleep helper for rate limiting
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Download a single SVG file
 */
async function downloadSvg(url, outputPath, iso) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': CONFIG.userAgent,
        'Accept': 'image/svg+xml, application/xml, */*',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('svg') && !contentType.includes('xml')) {
      console.warn(`\n  ⚠️  ${iso}: Unexpected content-type: ${contentType}`);
    }

    const svg = await response.text();
    await fs.writeFile(outputPath, svg, 'utf-8');
    return { success: true, size: svg.length };
  } catch (error) {
    return { success: false, error: error.message, cause: error.cause?.message };
  }
}

// Set to a small number for testing, or 0 for all flags
const MAX_FLAGS_TO_DOWNLOAD = 0;

/**
 * Main function
 */
async function main() {
  console.log('🏳️  Flag SVG Downloader\n');

  // Load flag URLs from wikidata
  console.log('📂 Loading flag URLs from flagImages.json...');
  const flagData = JSON.parse(await fs.readFile(CONFIG.flagImagesJson, 'utf-8'));
  const bindings = flagData.results.bindings;
  console.log(`   Found ${bindings.length} flag entries\n`);

  // Build unique ISO -> URL mapping (some ISOs may have duplicates)
  const isoToUrl = new Map();
  for (const binding of bindings) {
    const iso = binding.iso2?.value;
    const url = binding.flag?.value;
    
    if (iso && url) {
      // Prefer Kosovo's actual flag over UN flag
      if (iso === 'XK' && url.includes('United_Nations')) {
        continue;
      }
      isoToUrl.set(iso, url);
    }
  }
  console.log(`   ${isoToUrl.size} unique countries with flags\n`);

  // Ensure output directory exists
  await fs.mkdir(CONFIG.outputDir, { recursive: true });

  // Download each flag
  console.log('📥 Downloading flags...\n');
  
  const results = { success: 0, failed: 0, skipped: 0 };
  const failures = [];
  let entries = Array.from(isoToUrl.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  
  // Limit for testing
  if (MAX_FLAGS_TO_DOWNLOAD > 0 && MAX_FLAGS_TO_DOWNLOAD < entries.length) {
    console.log(`   ⚠️  LIMITED MODE: Only downloading first ${MAX_FLAGS_TO_DOWNLOAD} flags for testing\n`);
    entries = entries.slice(0, MAX_FLAGS_TO_DOWNLOAD);
  }

  for (let i = 0; i < entries.length; i++) {
    const [iso, url] = entries[i];
    const filename = `${iso.toLowerCase()}.svg`;
    const outputPath = path.join(CONFIG.outputDir, filename);
    const progress = `[${i + 1}/${entries.length}]`;

    // Check if already downloaded
    try {
      await fs.access(outputPath);
      console.log(`  ${progress} ⏭️  ${iso}: Already exists`);
      results.skipped++;
      continue;
    } catch {
      // File doesn't exist, proceed with download
    }

    const result = await downloadSvg(url, outputPath, iso);
    
    if (result.success) {
      console.log(`  ${progress} ✅ ${iso}: ${filename} (${result.size} bytes)`);
      results.success++;
    } else {
      console.log(`  ${progress} ❌ ${iso}: ${result.error}`);
      results.failed++;
      failures.push({ iso, url, error: result.error, cause: result.cause });
    }

    // Rate limit
    if (i < entries.length - 1) {
      await sleep(CONFIG.delayMs);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary:');
  console.log(`   ✅ Downloaded: ${results.success}`);
  console.log(`   ⏭️  Skipped (existing): ${results.skipped}`);
  console.log(`   ❌ Failed: ${results.failed}`);
  
  if (failures.length > 0) {
    console.log('\n❌ Failed downloads:');
    for (const f of failures) {
      console.log(`   ${f.iso}: ${f.error}`);
      console.log(`      URL: ${f.url}`);
    }
  }

  // Write manifest of downloaded flags
  const manifest = {
    downloadedAt: new Date().toISOString(),
    totalFlags: isoToUrl.size,
    flags: Object.fromEntries(
      entries.map(([iso, url]) => [
        iso.toLowerCase(),
        {
          sourceUrl: url,
          localPath: `data/flags/${iso.toLowerCase()}.svg`,
        }
      ])
    ),
  };

  const manifestPath = path.join(CONFIG.outputDir, '_manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\n📄 Manifest written to: ${manifestPath}`);
}

main().catch(console.error);

