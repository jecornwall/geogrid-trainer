/**
 * Parse Wikipedia olympic-medals.html to extract Olympic medal counts.
 * 
 * Updates existing countries.jsonl with sports.olympic_medals:
 * - gold (number)
 * - silver (number)
 * - bronze (number)
 * - total (number)
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const MEDALS_HTML = path.join(ROOT, 'data/raw/wikipedia/olympic-medals.html');
const COUNTRIES_JSON = path.join(ROOT, 'data/countries.json');
const COUNTRIES_JSONL = path.join(ROOT, 'data/countries.jsonl');

// IOC code to ISO 2-letter code mapping
// IOC uses 3-letter codes, ISO uses 2-letter codes
const IOC_TO_ISO = {
  'AFG': 'AF', // Afghanistan
  'ALB': 'AL', // Albania
  'ALG': 'DZ', // Algeria
  'AND': 'AD', // Andorra
  'ANG': 'AO', // Angola
  'ANT': 'AG', // Antigua and Barbuda
  'ARG': 'AR', // Argentina
  'ARM': 'AM', // Armenia
  'ARU': 'AW', // Aruba
  'ASA': 'AS', // American Samoa
  'AUS': 'AU', // Australia
  'AUT': 'AT', // Austria
  'AZE': 'AZ', // Azerbaijan
  'BAH': 'BS', // Bahamas
  'BAN': 'BD', // Bangladesh
  'BAR': 'BB', // Barbados
  'BDI': 'BI', // Burundi
  'BEL': 'BE', // Belgium
  'BEN': 'BJ', // Benin
  'BER': 'BM', // Bermuda
  'BHU': 'BT', // Bhutan
  'BIH': 'BA', // Bosnia and Herzegovina
  'BIZ': 'BZ', // Belize
  'BLR': 'BY', // Belarus
  'BOL': 'BO', // Bolivia
  'BOT': 'BW', // Botswana
  'BRA': 'BR', // Brazil
  'BRN': 'BH', // Bahrain
  'BRU': 'BN', // Brunei
  'BUL': 'BG', // Bulgaria
  'BUR': 'BF', // Burkina Faso
  'CAF': 'CF', // Central African Republic
  'CAM': 'KH', // Cambodia
  'CAN': 'CA', // Canada
  'CAY': 'KY', // Cayman Islands
  'CGO': 'CG', // Congo (Republic)
  'CHA': 'TD', // Chad
  'CHI': 'CL', // Chile
  'CHN': 'CN', // China
  'CIV': 'CI', // Côte d'Ivoire
  'CMR': 'CM', // Cameroon
  'COD': 'CD', // Congo (DR)
  'COK': 'CK', // Cook Islands
  'COL': 'CO', // Colombia
  'COM': 'KM', // Comoros
  'CPV': 'CV', // Cape Verde
  'CRC': 'CR', // Costa Rica
  'CRO': 'HR', // Croatia
  'CUB': 'CU', // Cuba
  'CYP': 'CY', // Cyprus
  'CZE': 'CZ', // Czech Republic
  'DEN': 'DK', // Denmark
  'DJI': 'DJ', // Djibouti
  'DMA': 'DM', // Dominica
  'DOM': 'DO', // Dominican Republic
  'ECU': 'EC', // Ecuador
  'EGY': 'EG', // Egypt
  'ERI': 'ER', // Eritrea
  'ESA': 'SV', // El Salvador
  'ESP': 'ES', // Spain
  'EST': 'EE', // Estonia
  'ETH': 'ET', // Ethiopia
  'FIJ': 'FJ', // Fiji
  'FIN': 'FI', // Finland
  'FRA': 'FR', // France
  'FSM': 'FM', // Micronesia
  'GAB': 'GA', // Gabon
  'GAM': 'GM', // Gambia
  'GBR': 'GB', // Great Britain
  'GBS': 'GW', // Guinea-Bissau
  'GEO': 'GE', // Georgia
  'GEQ': 'GQ', // Equatorial Guinea
  'GER': 'DE', // Germany
  'GHA': 'GH', // Ghana
  'GRE': 'GR', // Greece
  'GRN': 'GD', // Grenada
  'GUA': 'GT', // Guatemala
  'GUI': 'GN', // Guinea
  'GUM': 'GU', // Guam
  'GUY': 'GY', // Guyana
  'HAI': 'HT', // Haiti
  'HKG': 'HK', // Hong Kong
  'HON': 'HN', // Honduras
  'HUN': 'HU', // Hungary
  'INA': 'ID', // Indonesia
  'IND': 'IN', // India
  'IRI': 'IR', // Iran
  'IRL': 'IE', // Ireland
  'IRQ': 'IQ', // Iraq
  'ISL': 'IS', // Iceland
  'ISR': 'IL', // Israel
  'ISV': 'VI', // US Virgin Islands
  'ITA': 'IT', // Italy
  'IVB': 'VG', // British Virgin Islands
  'JAM': 'JM', // Jamaica
  'JOR': 'JO', // Jordan
  'JPN': 'JP', // Japan
  'KAZ': 'KZ', // Kazakhstan
  'KEN': 'KE', // Kenya
  'KGZ': 'KG', // Kyrgyzstan
  'KIR': 'KI', // Kiribati
  'KOR': 'KR', // South Korea
  'KOS': 'XK', // Kosovo
  'KSA': 'SA', // Saudi Arabia
  'KUW': 'KW', // Kuwait
  'LAO': 'LA', // Laos
  'LAT': 'LV', // Latvia
  'LBA': 'LY', // Libya
  'LBN': 'LB', // Lebanon (using LBN as alternative)
  'LBR': 'LR', // Liberia
  'LCA': 'LC', // Saint Lucia
  'LES': 'LS', // Lesotho
  'LIB': 'LB', // Lebanon
  'LIE': 'LI', // Liechtenstein
  'LTU': 'LT', // Lithuania
  'LUX': 'LU', // Luxembourg
  'MAD': 'MG', // Madagascar
  'MAR': 'MA', // Morocco
  'MAS': 'MY', // Malaysia
  'MAW': 'MW', // Malawi
  'MDA': 'MD', // Moldova
  'MDV': 'MV', // Maldives
  'MEX': 'MX', // Mexico
  'MGL': 'MN', // Mongolia
  'MHL': 'MH', // Marshall Islands
  'MKD': 'MK', // North Macedonia
  'MLI': 'ML', // Mali
  'MLT': 'MT', // Malta
  'MNE': 'ME', // Montenegro
  'MON': 'MC', // Monaco
  'MOZ': 'MZ', // Mozambique
  'MRI': 'MU', // Mauritius
  'MTN': 'MR', // Mauritania
  'MYA': 'MM', // Myanmar
  'NAM': 'NA', // Namibia
  'NCA': 'NI', // Nicaragua
  'NED': 'NL', // Netherlands
  'NEP': 'NP', // Nepal
  'NGR': 'NG', // Nigeria
  'NIG': 'NE', // Niger
  'NOR': 'NO', // Norway
  'NRU': 'NR', // Nauru
  'NZL': 'NZ', // New Zealand
  'OMA': 'OM', // Oman
  'PAK': 'PK', // Pakistan
  'PAN': 'PA', // Panama
  'PAR': 'PY', // Paraguay
  'PER': 'PE', // Peru
  'PHI': 'PH', // Philippines
  'PLE': 'PS', // Palestine
  'PLW': 'PW', // Palau
  'PNG': 'PG', // Papua New Guinea
  'POL': 'PL', // Poland
  'POR': 'PT', // Portugal
  'PRK': 'KP', // North Korea
  'PUR': 'PR', // Puerto Rico
  'QAT': 'QA', // Qatar
  'ROU': 'RO', // Romania
  'RSA': 'ZA', // South Africa
  'RUS': 'RU', // Russia
  'RWA': 'RW', // Rwanda
  'SAM': 'WS', // Samoa
  'SEN': 'SN', // Senegal
  'SEY': 'SC', // Seychelles
  'SIN': 'SG', // Singapore
  'SKN': 'KN', // Saint Kitts and Nevis
  'SLE': 'SL', // Sierra Leone
  'SLO': 'SI', // Slovenia
  'SMR': 'SM', // San Marino
  'SOL': 'SB', // Solomon Islands
  'SOM': 'SO', // Somalia
  'SRB': 'RS', // Serbia
  'SRI': 'LK', // Sri Lanka
  'SSD': 'SS', // South Sudan
  'STP': 'ST', // São Tomé and Príncipe
  'SUD': 'SD', // Sudan
  'SUI': 'CH', // Switzerland
  'SUR': 'SR', // Suriname
  'SVK': 'SK', // Slovakia
  'SWE': 'SE', // Sweden
  'SWZ': 'SZ', // Eswatini
  'SYR': 'SY', // Syria
  'TAN': 'TZ', // Tanzania
  'TGA': 'TO', // Tonga
  'THA': 'TH', // Thailand
  'TJK': 'TJ', // Tajikistan
  'TKM': 'TM', // Turkmenistan
  'TLS': 'TL', // Timor-Leste
  'TOG': 'TG', // Togo
  'TPE': 'TW', // Taiwan (Chinese Taipei)
  'TTO': 'TT', // Trinidad and Tobago
  'TUN': 'TN', // Tunisia
  'TUR': 'TR', // Turkey
  'TUV': 'TV', // Tuvalu
  'UAE': 'AE', // United Arab Emirates
  'UGA': 'UG', // Uganda
  'UKR': 'UA', // Ukraine
  'URU': 'UY', // Uruguay
  'USA': 'US', // United States
  'UZB': 'UZ', // Uzbekistan
  'VAN': 'VU', // Vanuatu
  'VEN': 'VE', // Venezuela
  'VIE': 'VN', // Vietnam
  'VIN': 'VC', // Saint Vincent and the Grenadines
  'YEM': 'YE', // Yemen
  'ZAM': 'ZM', // Zambia
  'ZIM': 'ZW', // Zimbabwe
};

// Country name to ISO code mapping (for fallback when IOC code not found)
let nameToIso = new Map();

/**
 * Build a name -> ISO lookup from countries.json
 */
async function buildNameLookup() {
  const countries = JSON.parse(await fs.readFile(COUNTRIES_JSON, 'utf-8'));
  
  for (const c of countries) {
    const code = c.code;
    const name = c.name;
    
    nameToIso.set(name.toLowerCase(), code);
    nameToIso.set(name.toLowerCase().replace(/[^a-z]/g, ''), code);
  }
  
  // Add manual mappings for common variations
  const manualMappings = {
    'united states': 'US',
    'united kingdom': 'GB',
    'great britain': 'GB',
    'russia': 'RU',
    'russian federation': 'RU',
    'south korea': 'KR',
    'north korea': 'KP',
    'republic of korea': 'KR',
    'democratic republic of the congo': 'CD',
    'dr congo': 'CD',
    'congo': 'CG',
    'republic of the congo': 'CG',
    'ivory coast': 'CI',
    "cote d'ivoire": 'CI',
    'czech republic': 'CZ',
    'czechia': 'CZ',
    'north macedonia': 'MK',
    'chinese taipei': 'TW',
    'taiwan': 'TW',
  };
  
  for (const [name, code] of Object.entries(manualMappings)) {
    nameToIso.set(name, code);
  }
}

/**
 * Parse HTML and extract medal counts
 */
async function parseMedals() {
  const html = await fs.readFile(MEDALS_HTML, 'utf-8');
  
  const medals = new Map(); // ISO code -> { gold, silver, bronze, total }
  
  // Find the main table (first one with sortable class)
  // Each row has: Team | Summer(5 cols) | Winter(5 cols) | Combined(5 cols)
  // We want the Combined total columns (last 5)
  
  // Match rows: look for IOC code patterns and the following cells
  // Pattern: flagIOC template with code, then cells with numbers
  const rowPattern = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
  const rows = html.match(rowPattern) || [];
  
  for (const row of rows) {
    // Skip header rows and special delegations (light blue background)
    if (row.includes('<th') || row.includes('bgcolor="lightblue"')) continue;
    
    // Extract IOC code from template: "wt":"AFG" or similar
    const iocMatch = row.match(/"wt":"([A-Z]{3})"/);
    if (!iocMatch) continue;
    
    const iocCode = iocMatch[1];
    const isoCode = IOC_TO_ISO[iocCode];
    
    if (!isoCode) {
      // Skip defunct/historical entities we don't track
      continue;
    }
    
    // Extract all td values (handle numbers with commas like "1,105")
    const cellPattern = /<td[^>]*>(?:<b[^>]*>)?([\d,]+)(?:<\/b>)?<\/td>/gi;
    const cellMatches = [...row.matchAll(cellPattern)].map(m => parseInt(m[1].replace(/,/g, ''), 10));
    
    // Should have at least 15 numbers (5 summer + 5 winter + 5 combined)
    if (cellMatches.length >= 15) {
      // Last 5 are: games, gold, silver, bronze, total
      const gold = cellMatches[cellMatches.length - 4];
      const silver = cellMatches[cellMatches.length - 3];
      const bronze = cellMatches[cellMatches.length - 2];
      const total = cellMatches[cellMatches.length - 1];
      
      medals.set(isoCode, { gold, silver, bronze, total });
    }
  }
  
  return medals;
}

/**
 * Load existing JSONL, update medal data, and save
 */
async function updateJsonl(medals) {
  const content = await fs.readFile(COUNTRIES_JSONL, 'utf-8');
  const lines = content.trim().split('\n');
  
  let updated = 0;
  
  const result = lines.map(line => {
    const country = JSON.parse(line);
    const iso = country.id;
    
    if (medals.has(iso)) {
      const m = medals.get(iso);
      country.sports.olympic_medals = {
        total: m.total,
        gold: m.gold,
        silver: m.silver,
        bronze: m.bronze,
      };
      updated++;
    }
    
    return JSON.stringify(country);
  });
  
  await fs.writeFile(COUNTRIES_JSONL, result.join('\n') + '\n');
  return updated;
}

async function main() {
  console.log('Building country name lookup...');
  await buildNameLookup();
  console.log(`  ${nameToIso.size} name mappings`);
  
  console.log('\nParsing olympic-medals.html...');
  const medals = await parseMedals();
  console.log(`  Found medal data for ${medals.size} countries`);
  
  console.log('\nUpdating countries.jsonl...');
  const updated = await updateJsonl(medals);
  console.log(`  Updated ${updated} countries`);
  
  console.log('\nDone!');
  
  // Print some samples
  console.log('\nSample medal counts:');
  const samples = ['US', 'GB', 'CN', 'RU', 'DE', 'AU', 'FR', 'JP', 'IT', 'KR'];
  for (const iso of samples) {
    if (medals.has(iso)) {
      const m = medals.get(iso);
      console.log(`  ${iso}: ${m.gold}G ${m.silver}S ${m.bronze}B = ${m.total} total`);
    }
  }
}

main().catch(console.error);

