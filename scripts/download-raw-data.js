/**
 * Raw Data Downloader for GeoGrid Trainer
 * 
 * Downloads raw HTML/data from Wikipedia and other sources for later extraction.
 * Run with: node scripts/download-raw-data.js [--wikipedia-only] [--external-only] [--countries-only]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  outputDir: path.join(__dirname, '..', 'data', 'raw'),
  manifestPath: path.join(__dirname, '..', 'data', 'raw', 'sources-manifest.json'),
  countriesPath: path.join(__dirname, '..', 'data', 'countries.json'),
  rateLimit: 1000, // ms between requests (be nice to servers)
  retryAttempts: 3,
  retryDelay: 5000,
};

// Create output directories
function ensureDirectories() {
  const dirs = [
    CONFIG.outputDir,
    path.join(CONFIG.outputDir, 'wikipedia'),
    path.join(CONFIG.outputDir, 'external'),
    path.join(CONFIG.outputDir, 'country-pages'),
  ];
  
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  }
}

// Load manifest
function loadManifest() {
  const content = fs.readFileSync(CONFIG.manifestPath, 'utf-8');
  return JSON.parse(content);
}

// Load countries list
function loadCountries() {
  const content = fs.readFileSync(CONFIG.countriesPath, 'utf-8');
  return JSON.parse(content);
}

// Sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Download status tracker
class DownloadTracker {
  constructor() {
    this.statusPath = path.join(CONFIG.outputDir, 'download-status.json');
    this.status = this.load();
  }
  
  load() {
    if (fs.existsSync(this.statusPath)) {
      return JSON.parse(fs.readFileSync(this.statusPath, 'utf-8'));
    }
    return {
      startedAt: new Date().toISOString(),
      wikipedia: {},
      external: {},
      countryPages: {},
    };
  }
  
  save() {
    this.status.lastUpdated = new Date().toISOString();
    fs.writeFileSync(this.statusPath, JSON.stringify(this.status, null, 2));
  }
  
  markComplete(category, id, metadata = {}) {
    this.status[category][id] = {
      status: 'complete',
      downloadedAt: new Date().toISOString(),
      ...metadata,
    };
    this.save();
  }
  
  markFailed(category, id, error) {
    this.status[category][id] = {
      status: 'failed',
      error: error.message,
      failedAt: new Date().toISOString(),
    };
    this.save();
  }
  
  isComplete(category, id) {
    return this.status[category]?.[id]?.status === 'complete';
  }
}

// Wikipedia downloader using REST API
async function downloadWikipediaPage(title, outputPath) {
  // Use Wikipedia REST API for cleaner HTML
  const apiUrl = `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(title)}`;
  
  const response = await fetch(apiUrl, {
    headers: {
      'User-Agent': 'GeoGridTrainer/1.0 (Educational project; contact@example.com)',
      'Accept': 'text/html',
    },
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const html = await response.text();
  fs.writeFileSync(outputPath, html);
  
  return {
    size: html.length,
    contentType: response.headers.get('content-type'),
  };
}

// Playwright downloader for JS-heavy pages
async function downloadWithPlaywright(browser, url, outputPath) {
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { 
      waitUntil: 'networkidle',
      timeout: 60000,
    });
    
    // Wait for dynamic content to load
    await page.waitForTimeout(2000);
    
    const html = await page.content();
    fs.writeFileSync(outputPath, html);
    
    return {
      size: html.length,
      url: page.url(),
    };
  } finally {
    await page.close();
  }
}

// Download all Wikipedia sources
async function downloadWikipediaSources(manifest, tracker) {
  console.log('\n📚 Downloading Wikipedia sources...\n');
  
  const sources = manifest.wikipedia.sources;
  let completed = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const source of sources) {
    const outputPath = path.join(CONFIG.outputDir, 'wikipedia', `${source.id}.html`);
    
    // Skip if already downloaded
    if (tracker.isComplete('wikipedia', source.id)) {
      console.log(`⏭️  Skipping ${source.id} (already downloaded)`);
      skipped++;
      continue;
    }
    
    console.log(`📥 Downloading: ${source.title}`);
    
    for (let attempt = 1; attempt <= CONFIG.retryAttempts; attempt++) {
      try {
        const metadata = await downloadWikipediaPage(source.title, outputPath);
        tracker.markComplete('wikipedia', source.id, {
          title: source.title,
          category: source.category,
          fields: source.fields,
          ...metadata,
        });
        console.log(`   ✅ Saved (${(metadata.size / 1024).toFixed(1)} KB)`);
        completed++;
        break;
      } catch (error) {
        console.log(`   ⚠️  Attempt ${attempt}/${CONFIG.retryAttempts} failed: ${error.message}`);
        if (attempt === CONFIG.retryAttempts) {
          tracker.markFailed('wikipedia', source.id, error);
          console.log(`   ❌ Failed after ${CONFIG.retryAttempts} attempts`);
          failed++;
        } else {
          await sleep(CONFIG.retryDelay);
        }
      }
    }
    
    // Rate limiting
    await sleep(CONFIG.rateLimit);
  }
  
  console.log(`\n📊 Wikipedia: ${completed} downloaded, ${skipped} skipped, ${failed} failed`);
}

// Download external sources using Playwright
async function downloadExternalSources(manifest, tracker) {
  console.log('\n🌐 Downloading external sources...\n');
  
  const sources = manifest.external.sources;
  let completed = 0;
  let skipped = 0;
  let failed = 0;
  
  const browser = await chromium.launch({ headless: true });
  
  try {
    for (const source of sources) {
      const outputPath = path.join(CONFIG.outputDir, 'external', `${source.id}.html`);
      
      // Skip if already downloaded
      if (tracker.isComplete('external', source.id)) {
        console.log(`⏭️  Skipping ${source.id} (already downloaded)`);
        skipped++;
        continue;
      }
      
      console.log(`📥 Downloading: ${source.id}`);
      
      for (let attempt = 1; attempt <= CONFIG.retryAttempts; attempt++) {
        try {
          const metadata = await downloadWithPlaywright(browser, source.url, outputPath);
          tracker.markComplete('external', source.id, {
            url: source.url,
            category: source.category,
            fields: source.fields,
            ...metadata,
          });
          console.log(`   ✅ Saved (${(metadata.size / 1024).toFixed(1)} KB)`);
          completed++;
          break;
        } catch (error) {
          console.log(`   ⚠️  Attempt ${attempt}/${CONFIG.retryAttempts} failed: ${error.message}`);
          if (attempt === CONFIG.retryAttempts) {
            tracker.markFailed('external', source.id, error);
            console.log(`   ❌ Failed after ${CONFIG.retryAttempts} attempts`);
            failed++;
          } else {
            await sleep(CONFIG.retryDelay);
          }
        }
      }
      
      // Rate limiting
      await sleep(CONFIG.rateLimit * 2); // Extra delay for external sites
    }
  } finally {
    await browser.close();
  }
  
  console.log(`\n📊 External: ${completed} downloaded, ${skipped} skipped, ${failed} failed`);
}

// Download individual country Wikipedia pages
async function downloadCountryPages(tracker) {
  console.log('\n🗺️  Downloading country Wikipedia pages...\n');
  
  const countries = loadCountries();
  let completed = 0;
  let skipped = 0;
  let failed = 0;
  
  // Filter out non-country entries (territories, etc.)
  const countriesToDownload = countries.filter(c => 
    // Skip some special cases
    !['AQ', 'BV', 'HM', 'TF', 'GS', 'UM'].includes(c.code)
  );
  
  console.log(`Found ${countriesToDownload.length} countries to download\n`);
  
  for (const country of countriesToDownload) {
    const id = country.code.toLowerCase();
    const outputPath = path.join(CONFIG.outputDir, 'country-pages', `${id}.html`);
    
    // Skip if already downloaded
    if (tracker.isComplete('countryPages', id)) {
      skipped++;
      continue;
    }
    
    // Convert country name to Wikipedia title format
    const wikiTitle = country.name.replace(/ /g, '_');
    
    console.log(`📥 ${country.code}: ${country.name}`);
    
    for (let attempt = 1; attempt <= CONFIG.retryAttempts; attempt++) {
      try {
        const metadata = await downloadWikipediaPage(wikiTitle, outputPath);
        tracker.markComplete('countryPages', id, {
          code: country.code,
          name: country.name,
          wikiTitle,
          ...metadata,
        });
        console.log(`   ✅ Saved`);
        completed++;
        break;
      } catch (error) {
        // Try alternative titles for some countries
        const alternatives = getAlternativeWikiTitles(country.name);
        let success = false;
        
        for (const alt of alternatives) {
          try {
            const metadata = await downloadWikipediaPage(alt, outputPath);
            tracker.markComplete('countryPages', id, {
              code: country.code,
              name: country.name,
              wikiTitle: alt,
              ...metadata,
            });
            console.log(`   ✅ Saved (using: ${alt})`);
            completed++;
            success = true;
            break;
          } catch {
            // Try next alternative
          }
        }
        
        if (success) break;
        
        console.log(`   ⚠️  Attempt ${attempt}/${CONFIG.retryAttempts} failed: ${error.message}`);
        if (attempt === CONFIG.retryAttempts) {
          tracker.markFailed('countryPages', id, error);
          console.log(`   ❌ Failed`);
          failed++;
        } else {
          await sleep(CONFIG.retryDelay);
        }
      }
    }
    
    // Rate limiting
    await sleep(CONFIG.rateLimit);
    
    // Progress update every 20 countries
    if ((completed + skipped + failed) % 20 === 0) {
      console.log(`\n   Progress: ${completed + skipped + failed}/${countriesToDownload.length}\n`);
    }
  }
  
  console.log(`\n📊 Country pages: ${completed} downloaded, ${skipped} skipped, ${failed} failed`);
}

// Alternative Wikipedia titles for some countries
function getAlternativeWikiTitles(name) {
  const alternatives = {
    'Bahamas': ['The_Bahamas'],
    'The Gambia': ['The_Gambia', 'Gambia'],
    'Czechia': ['Czech_Republic'],
    'Eswatini': ['Eswatini', 'Swaziland'],
    'Côte d\'Ivoire': ['Ivory_Coast', 'Côte_d%27Ivoire'],
    'Türkiye': ['Turkey'],
    'Timor-Leste': ['East_Timor'],
    'North Korea': ['North_Korea'],
    'South Korea': ['South_Korea'],
    'United Kingdom': ['United_Kingdom'],
    'United States of America': ['United_States'],
    'Vatican City': ['Vatican_City'],
    'Federated States of Micronesia': ['Federated_States_of_Micronesia', 'Micronesia'],
    'Democratic Republic of the Congo': ['Democratic_Republic_of_the_Congo'],
    'Republic of the Congo': ['Republic_of_the_Congo'],
    'Cabo Verde': ['Cape_Verde'],
    'Bailiwick of Guernsey': ['Guernsey'],
    'São Tomé and Príncipe': ['São_Tomé_and_Príncipe', 'Sao_Tome_and_Principe'],
    'Saint Helena, Ascension and Tristan da Cunha': ['Saint_Helena,_Ascension_and_Tristan_da_Cunha'],
  };
  
  return alternatives[name] || [];
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const wikipediaOnly = args.includes('--wikipedia-only');
  const externalOnly = args.includes('--external-only');
  const countriesOnly = args.includes('--countries-only');
  const runAll = !wikipediaOnly && !externalOnly && !countriesOnly;
  
  console.log('🌍 GeoGrid Trainer - Raw Data Downloader\n');
  console.log('=' .repeat(50));
  
  // Setup
  ensureDirectories();
  const manifest = loadManifest();
  const tracker = new DownloadTracker();
  
  console.log(`\n📋 Loaded manifest with:`);
  console.log(`   - ${manifest.wikipedia.sources.length} Wikipedia sources`);
  console.log(`   - ${manifest.external.sources.length} external sources`);
  
  const startTime = Date.now();
  
  try {
    // Download Wikipedia sources
    if (runAll || wikipediaOnly) {
      await downloadWikipediaSources(manifest, tracker);
    }
    
    // Download external sources
    if (runAll || externalOnly) {
      await downloadExternalSources(manifest, tracker);
    }
    
    // Download country pages
    if (runAll || countriesOnly) {
      await downloadCountryPages(tracker);
    }
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
  
  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log('\n' + '=' .repeat(50));
  console.log(`✨ Download complete! (${duration} minutes)`);
  console.log(`📁 Raw data saved to: ${CONFIG.outputDir}`);
  console.log(`📊 Status file: ${tracker.statusPath}`);
}

main().catch(console.error);

