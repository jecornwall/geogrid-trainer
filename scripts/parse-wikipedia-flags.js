/**
 * Parse Wikipedia flags-design.html to extract flag properties:
 * - has_coat_of_arms
 * - has_star (includes sun/moon as "star" per schema)
 * - has_animal (includes humans)
 * 
 * Updates ONLY flag.has_star, flag.has_coat_of_arms, flag.has_animal in countries.jsonl.
 * All other fields are preserved.
 */

import fs from 'fs/promises';
import path from 'path';
import { updateCountries, buildNameToIsoLookup, paths } from './lib/countries-jsonl.js';

const FLAGS_HTML = path.join(paths.rawWikipedia, 'flags-design.html');

let nameToIso = new Map();

/**
 * Extract country name from a "Flag of X" reference
 * Returns null for state/government flag variants - we only want current civil flags
 */
function extractCountryFromFlagRef(text) {
  // Skip state/government flag variants - we only want civil flags
  // These are typically "Flag_of_X_(state).svg" or URL-encoded as "%28state%29"
  if (/\(state\)/i.test(text) || /%28state%29/i.test(text) ||
      /\(government\)/i.test(text) || /%28government%29/i.test(text) ||
      /_state\./i.test(text)) {
    return null;
  }
  
  const match = text.match(/Flag[_ ]of[_ ](?:the[_ ])?([A-Za-z_\-' ]+?)(?:#|"|$|\s*\(|\.svg)/i);
  if (!match) return null;
  
  let country = match[1]
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  country = country.replace(/^the\s+/i, '');
  
  // Skip non-country flags (regions, provinces, etc.)
  const skipPatterns = [
    /province/i, /state of/i, /british columbia/i, /brittany/i, /corsica/i,
    /^england$/i, /^scotland$/i, /^wales$/i, /northern ireland/i,
    /catalonia/i, /basque/i, /galicia/i, /andalusia/i, /flanders/i,
    /wallonia/i, /quebec/i, /^texas$/i, /^california$/i, /^hawaii$/i,
    /crimea/i, /^tibet$/i, /kurdistan/i, /^europe$/i, /virgin islands/i,
    /gagauzia/i, /transnistria/i, /abkhazia/i, /^valencia$/i, /west papua/i,
  ];
  
  for (const pattern of skipPatterns) {
    if (pattern.test(country)) return null;
  }
  
  return country;
}

/**
 * Look up ISO code for a country name
 */
function lookupIso(countryName) {
  if (!countryName) return null;
  
  const normalized = countryName.toLowerCase().trim();
  
  if (nameToIso.has(normalized)) return nameToIso.get(normalized);
  
  const alphaOnly = normalized.replace(/[^a-z]/g, '');
  if (nameToIso.has(alphaOnly)) return nameToIso.get(alphaOnly);
  
  const withoutThe = normalized.replace(/^the /, '');
  if (nameToIso.has(withoutThe)) return nameToIso.get(withoutThe);
  
  return null;
}

/**
 * Parse HTML and extract flags by section
 */
async function parseFlags() {
  const html = await fs.readFile(FLAGS_HTML, 'utf-8');
  
  const coatOfArmsFlags = new Set();
  const starFlags = new Set();
  const animalFlags = new Set();
  
  const sections = html.split(/<section[^>]*>/);
  let currentSection = '';
  
  for (const section of sections) {
    // Skip state-flag-only sections entirely - we only want civil flags
    if (section.includes('state_flags_only') || section.includes('state flags only')) {
      currentSection = '';
      continue;
    }
    
    // Coat of arms sections
    if (section.includes('id="Mobile_charge_—_National_coat_of_arms') || 
        section.includes('id="National_coat_of_arms')) {
      currentSection = 'coat_of_arms';
    }
    // Emblem section - also counts as coat of arms
    else if (section.includes('id="Mobile_charge_—_National_emblem') ||
             section.includes('id="National_emblem')) {
      currentSection = 'emblem';
    }
    // Astronomical sections: Sun, Moon, Star
    else if (section.includes('id="Mobile_charge_—_Astronomical') ||
             section.includes('id="Sun"') || 
             section.includes('id="Moon"') || 
             section.includes('id="Star"')) {
      currentSection = 'star';
    }
    // Living organisms sections: Human, Animals
    else if (section.includes('id="Mobile_charge_—_Living_organisms') ||
             section.includes('id="Human_and_body_parts"') ||
             section.includes('id="Animals"')) {
      currentSection = 'animal';
    }
    // Reset when we hit non-target sections
    else if (section.includes('id="Ordinary_/_mobile_charge_—_Cross') ||
             section.includes('id="Mobile_charge_—_Other_objects') ||
             section.includes('id="Mobile_charge_—_Text') ||
             section.includes('id="Ordinary_charge') ||
             section.includes('id="See_also"') ||
             section.includes('id="Plants"')) {
      currentSection = '';
    }
    
    if (!currentSection) continue;
    
    // Split section into gallery items to check context per item
    const galleryItems = section.split(/<li class="gallerybox"/);
    
    for (const item of galleryItems) {
      // Skip items that explicitly mention state flag only / civil flag without arms
      if (/state flag only|civil flag is without/i.test(item)) {
        continue;
      }
      
      const flagRefs = item.matchAll(/Flag[_ ]of[_ ](?:the[_ ])?([A-Za-z_\-' ]+?)(?:#|"|<|\.svg)/gi);
      
      for (const match of flagRefs) {
        const fullMatch = match[0];

        // Skip historical/state flags by checking the full gallery item context
        if (/Flag_of_[A-Za-z_]+_\d{4}|Flag_of_[A-Za-z_]+_%28\d{4}|Flag_of_[A-Za-z_]+_\(\d{4}/.test(item) ||
            /_1921|_1868|_\(1957|_1868/.test(item)) {
          continue;
        }

        const country = extractCountryFromFlagRef(fullMatch);
        const iso = lookupIso(country);

        if (iso) {
          if (currentSection === 'coat_of_arms' || currentSection === 'emblem') {
            coatOfArmsFlags.add(iso);
          } else if (currentSection === 'star') {
            starFlags.add(iso);
          } else if (currentSection === 'animal') {
            animalFlags.add(iso);
          }
        }
      }
    }
  }
  
  return { coatOfArmsFlags, starFlags, animalFlags };
}

async function main() {
  console.log('Building country name lookup...');
  nameToIso = await buildNameToIsoLookup();
  console.log(`  ${nameToIso.size} name mappings`);
  
  console.log('\nParsing flags-design.html...');
  const { coatOfArmsFlags, starFlags, animalFlags } = await parseFlags();
  
  console.log(`  Coat of arms: ${coatOfArmsFlags.size} countries`);
  console.log(`  Stars/Sun/Moon: ${starFlags.size} countries`);
  console.log(`  Animals/Humans: ${animalFlags.size} countries`);
  
  console.log('\nUpdating countries.jsonl...');
  
  const { updated, total } = await updateCountries((country, iso) => {
    // Return ONLY the fields we manage
    return {
      flag: {
        has_coat_of_arms: coatOfArmsFlags.has(iso),
        has_star: starFlags.has(iso),
        has_animal: animalFlags.has(iso)
      }
    };
  });
  
  console.log(`  Updated ${updated} of ${total} countries`);
  console.log('\nDone!');
  
  console.log('\nSample coat of arms:', Array.from(coatOfArmsFlags).slice(0, 10).join(', '));
  console.log('Sample stars:', Array.from(starFlags).slice(0, 10).join(', '));
  console.log('Sample animals:', Array.from(animalFlags).slice(0, 10).join(', '));
}

main().catch(console.error);
