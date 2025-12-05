/**
 * Parse Wikipedia land-borders.html to extract land border data.
 * 
 * Updates ONLY borders.countries[] in countries.jsonl.
 * All other fields are preserved.
 * 
 * This replaces the Wikidata P47 source which incorrectly includes
 * maritime borders (causing island nations to show borders).
 * 
 * Source: https://en.wikipedia.org/wiki/List_of_countries_and_territories_by_number_of_land_borders
 */

import fs from 'fs/promises';
import path from 'path';
import { updateCountries, paths } from './lib/countries-jsonl.js';

const BORDERS_HTML = path.join(paths.rawWikipedia, 'land-borders.html');

/**
 * Country name to ISO code mapping
 */
const NAME_TO_ISO = {
  // Standard names
  'Afghanistan': 'AF', 'Antigua and Barbuda': 'AG', 'Australia': 'AU',
  'Albania': 'AL', 'Algeria': 'DZ', 'Andorra': 'AD', 'Angola': 'AO',
  'Argentina': 'AR', 'Armenia': 'AM', 'Austria': 'AT', 'Azerbaijan': 'AZ',
  'Bangladesh': 'BD', 'Belarus': 'BY', 'Belgium': 'BE', 'Belize': 'BZ',
  'Benin': 'BJ', 'Bhutan': 'BT', 'Bolivia': 'BO', 'Bosnia and Herzegovina': 'BA',
  'Botswana': 'BW', 'Brazil': 'BR', 'Brunei': 'BN', 'Bulgaria': 'BG',
  'Burkina Faso': 'BF', 'Burundi': 'BI', 'Cambodia': 'KH', 'Cameroon': 'CM',
  'Canada': 'CA', 'Central African Republic': 'CF', 'Chad': 'TD', 'Chile': 'CL',
  'China': 'CN', 'Colombia': 'CO', 'Democratic Republic of the Congo': 'CD',
  'Republic of the Congo': 'CG', 'Costa Rica': 'CR', 'Croatia': 'HR',
  'Czech Republic': 'CZ', 'Czechia': 'CZ', 'Denmark': 'DK', 'Djibouti': 'DJ',
  'Dominican Republic': 'DO', 'East Timor': 'TL', 'Timor-Leste': 'TL',
  'Ecuador': 'EC', 'Egypt': 'EG', 'El Salvador': 'SV', 'Equatorial Guinea': 'GQ',
  'Eritrea': 'ER', 'Estonia': 'EE', 'Eswatini': 'SZ', 'Swaziland': 'SZ',
  'Ethiopia': 'ET', 'Finland': 'FI', 'France': 'FR', 'Gabon': 'GA',
  'Gambia': 'GM', 'Georgia': 'GE', 'Germany': 'DE', 'Ghana': 'GH',
  'Gibraltar': 'GI', 'Greece': 'GR', 'Guatemala': 'GT', 'Guinea': 'GN',
  'Guinea-Bissau': 'GW', 'Guyana': 'GY', 'Haiti': 'HT', 'Honduras': 'HN',
  'Hungary': 'HU', 'India': 'IN', 'Indonesia': 'ID', 'Iran': 'IR', 'Iraq': 'IQ',
  'Ireland': 'IE', 'Israel': 'IL', 'Italy': 'IT', 'Ivory Coast': 'CI',
  "Côte d'Ivoire": 'CI', 'Jordan': 'JO', 'Kazakhstan': 'KZ', 'Kenya': 'KE',
  'Kosovo': 'XK', 'Kuwait': 'KW', 'Kyrgyzstan': 'KG', 'Laos': 'LA',
  'Latvia': 'LV', 'Lebanon': 'LB', 'Lesotho': 'LS', 'Liberia': 'LR',
  'Libya': 'LY', 'Liechtenstein': 'LI', 'Lithuania': 'LT', 'Luxembourg': 'LU',
  'North Macedonia': 'MK', 'Macedonia': 'MK', 'Malawi': 'MW', 'Malaysia': 'MY',
  'Mali': 'ML', 'Mauritania': 'MR', 'Mexico': 'MX', 'Moldova': 'MD',
  'Monaco': 'MC', 'Mongolia': 'MN', 'Montenegro': 'ME', 'Morocco': 'MA',
  'Mozambique': 'MZ', 'Myanmar': 'MM', 'Burma': 'MM', 'Namibia': 'NA',
  'Nepal': 'NP', 'Netherlands': 'NL', 'Nicaragua': 'NI', 'Niger': 'NE',
  'Nigeria': 'NG', 'North Korea': 'KP', 'Norway': 'NO', 'Oman': 'OM',
  'Pakistan': 'PK', 'Palestine': 'PS', 'Panama': 'PA', 'Papua New Guinea': 'PG',
  'Paraguay': 'PY', 'Peru': 'PE', 'Poland': 'PL', 'Portugal': 'PT',
  'Qatar': 'QA', 'Romania': 'RO', 'Russia': 'RU', 'Rwanda': 'RW',
  'San Marino': 'SM', 'Saudi Arabia': 'SA', 'Senegal': 'SN', 'Serbia': 'RS',
  'Sierra Leone': 'SL', 'Singapore': 'SG', 'Slovakia': 'SK', 'Slovenia': 'SI',
  'Somalia': 'SO', 'South Africa': 'ZA', 'South Korea': 'KR', 'South Sudan': 'SS',
  'Spain': 'ES', 'Sudan': 'SD', 'Suriname': 'SR', 'Sweden': 'SE',
  'Switzerland': 'CH', 'Syria': 'SY', 'Tajikistan': 'TJ', 'Tanzania': 'TZ',
  'Thailand': 'TH', 'Togo': 'TG', 'Tunisia': 'TN', 'Turkey': 'TR',
  'Turkmenistan': 'TM', 'Uganda': 'UG', 'Ukraine': 'UA',
  'United Arab Emirates': 'AE', 'United Kingdom': 'GB', 'United States': 'US',
  'Uruguay': 'UY', 'Uzbekistan': 'UZ', 'Vatican City': 'VA', 'Venezuela': 'VE',
  'Vietnam': 'VN', 'Western Sahara': 'EH', 'Yemen': 'YE', 'Zambia': 'ZM',
  'Zimbabwe': 'ZW',
  
  // Alternate names
  "People's Republic of China": 'CN', 'Russia (Kaliningrad)': 'RU',
  'Spain (Ceuta)': 'ES', 'Spain (Melilla)': 'ES', 'France (French Guiana)': 'FR',
  'France (Saint Martin)': 'FR', 'Netherlands (Sint Maarten)': 'NL',
  'Netherlands (Aruba)': 'NL', 'United States (Alaska)': 'US',
  'United States (Guantanamo Bay)': 'US', 'United Kingdom (Gibraltar)': 'GB',
  'United Kingdom (Akrotiri and Dhekelia)': 'GB', 'Denmark (Greenland)': 'DK',
  'The Gambia': 'GM', 'The Bahamas': 'BS', 'Republic of Ireland': 'IE',
  'Russian Federation': 'RU', 'Slovak Republic': 'SK', 'UAE': 'AE',
  'UK': 'GB', 'USA': 'US', 'D.R. Congo': 'CD', 'DRC': 'CD',
  'Congo': 'CG', 'Congo-Brazzaville': 'CG', 'Congo-Kinshasa': 'CD',
  'Türkiye': 'TR', 'ROC': 'TW', 'Taiwan': 'TW',
  
  // Territories
  'Hong Kong': 'HK', 'Macau': 'MO', 'Greenland': 'GL', 'French Guiana': 'GF',
  'Sint Maarten': 'SX', 'Saint Martin': 'MF', 'Ceuta': 'ES', 'Melilla': 'ES',
  'Cyprus': 'CY', 'Northern Cyprus': 'CY', 'Akrotiri and Dhekelia': 'GB',
  'Transnistria': 'MD', 'Abkhazia': 'GE', 'South Ossetia': 'GE',
  'Nagorno-Karabakh': 'AZ', 'Artsakh': 'AZ', 'Somaliland': 'SO',
  
  // Island nations (0 land borders)
  'Azores': 'PT', 'Bahrain': 'BH', 'Barbados': 'BB', 'Cape Verde': 'CV',
  'Cabo Verde': 'CV', 'Comoros': 'KM', 'Cuba': 'CU', 'Dominica': 'DM',
  'Fiji': 'FJ', 'Grenada': 'GD', 'Iceland': 'IS', 'Jamaica': 'JM',
  'Japan': 'JP', 'Kiribati': 'KI', 'Madagascar': 'MG', 'Madeira': 'PT',
  'Maldives': 'MV', 'Malta': 'MT', 'Marshall Islands': 'MH', 'Mauritius': 'MU',
  'Federated States of Micronesia': 'FM', 'Micronesia': 'FM', 'Nauru': 'NR',
  'New Zealand': 'NZ', 'Palau': 'PW', 'Philippines': 'PH',
  'Saint Kitts and Nevis': 'KN', 'Saint Lucia': 'LC',
  'Saint Pierre and Miquelon': 'PM', 'Saint Vincent and the Grenadines': 'VC',
  'Samoa': 'WS', 'São Tomé and Príncipe': 'ST', 'Sao Tome and Principe': 'ST',
  'Seychelles': 'SC', 'Solomon Islands': 'SB', 'Sri Lanka': 'LK',
  'Tonga': 'TO', 'Trinidad and Tobago': 'TT', 'Tuvalu': 'TV', 'Vanuatu': 'VU',
  
  // Kingdom references
  'Kingdom of Denmark': 'DK', 'Denmark, Kingdom of': 'DK',
  'Kingdom of the Netherlands': 'NL', 'Netherlands, Kingdom of': 'NL',
  'Metropolitan France': 'FR', 'France, Metropolitan': 'FR',
};

/**
 * Parse HTML and extract land borders for each country
 */
async function parseLandBorders() {
  const html = await fs.readFile(BORDERS_HTML, 'utf-8');
  
  // Stop before "Artificial border crossings" section
  const artificialStart = html.indexOf('id="Artificial_border_crossings"');
  const relevantHtml = artificialStart > 0 ? html.substring(0, artificialStart) : html;
  
  const borders = new Map();
  const rows = relevantHtml.split(/<tr[^>]*>/);
  
  for (const row of rows) {
    if (!row.includes('<td') || row.includes('<th')) continue;
    
    const cells = row.split(/<td[^>]*>/);
    if (cells.length < 5) continue;
    
    const firstCell = cells[1];
    const countryMatch = firstCell.match(/href="\.\/([^"]+)"[^>]*title="([^"]+)"[^>]*>([^<]+)<\/a><\/b>/);
    
    if (!countryMatch) continue;
    
    const countryLinkName = decodeURIComponent(countryMatch[1].replace(/_/g, ' '));
    const countryTitle = countryMatch[2];
    const countryText = countryMatch[3];
    
    let countryIso = NAME_TO_ISO[countryTitle] || NAME_TO_ISO[countryText] || NAME_TO_ISO[countryLinkName];
    
    if (!countryIso) {
      const cleanName = countryTitle.replace(/\s*\([^)]*\)\s*/g, '').trim();
      countryIso = NAME_TO_ISO[cleanName];
    }
    
    if (!countryIso) {
      console.log(`  Warning: Unknown country "${countryTitle}" / "${countryText}"`);
      continue;
    }
    
    if (!borders.has(countryIso)) {
      borders.set(countryIso, new Set());
    }
    
    const lastCell = cells[cells.length - 1];
    const neighborPattern = /href="\.\/([^"]+)"[^>]*title="([^"]+)"[^>]*>([^<]+)<\/a>/g;
    let match;
    
    while ((match = neighborPattern.exec(lastCell)) !== null) {
      const neighborLinkName = decodeURIComponent(match[1].replace(/_/g, ' '));
      const neighborTitle = match[2];
      const neighborText = match[3];
      
      if (neighborTitle.includes(':') || neighborTitle.startsWith('Template')) continue;
      if (neighborText.match(/^\d|^km$|^mi$/)) continue;
      
      let neighborIso = NAME_TO_ISO[neighborTitle] || NAME_TO_ISO[neighborText] || NAME_TO_ISO[neighborLinkName];
      
      if (!neighborIso) {
        const cleanName = neighborTitle.replace(/\s*\([^)]*\)\s*/g, '').trim();
        neighborIso = NAME_TO_ISO[cleanName];
      }
      
      if (neighborIso && neighborIso !== countryIso) {
        borders.get(countryIso).add(neighborIso);
      }
    }
  }
  
  return borders;
}

async function main() {
  console.log('Parsing land-borders.html...');
  const borders = await parseLandBorders();
  console.log(`  Found border data for ${borders.size} countries\n`);
  
  let totalBorderPairs = 0;
  for (const [, neighbors] of borders) {
    totalBorderPairs += neighbors.size;
  }
  console.log(`  Total border relationships: ${totalBorderPairs}\n`);
  
  console.log('Updating countries.jsonl...');
  
  let zeroBorders = 0;
  let withBorders = 0;
  
  const { updated, total } = await updateCountries((country, iso) => {
    const borderSet = borders.get(iso) || new Set();
    const newBorders = Array.from(borderSet).sort();
    
    if (newBorders.length === 0) {
      zeroBorders++;
    } else {
      withBorders++;
    }
    
    // Return ONLY the fields we manage
    return {
      borders: {
        countries: newBorders
      }
    };
  });
  
  console.log(`  Updated ${updated} of ${total} countries`);
  console.log(`  Countries with 0 land borders: ${zeroBorders}`);
  console.log(`  Countries with land borders: ${withBorders}`);
  
  console.log('\nDone!');
}

main().catch(console.error);
