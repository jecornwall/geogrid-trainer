/**
 * Parse Wikipedia olympic-medals.html to extract Olympic medal counts.
 * 
 * Updates ONLY sports.olympic_medals in countries.jsonl.
 * All other fields are preserved.
 */

import fs from 'fs/promises';
import path from 'path';
import { updateCountries, paths } from './lib/countries-jsonl.js';

const MEDALS_HTML = path.join(paths.rawWikipedia, 'olympic-medals.html');

// IOC code to ISO 2-letter code mapping
const IOC_TO_ISO = {
  'AFG': 'AF', 'ALB': 'AL', 'ALG': 'DZ', 'AND': 'AD', 'ANG': 'AO',
  'ANT': 'AG', 'ARG': 'AR', 'ARM': 'AM', 'ARU': 'AW', 'ASA': 'AS',
  'AUS': 'AU', 'AUT': 'AT', 'AZE': 'AZ', 'BAH': 'BS', 'BAN': 'BD',
  'BAR': 'BB', 'BDI': 'BI', 'BEL': 'BE', 'BEN': 'BJ', 'BER': 'BM',
  'BHU': 'BT', 'BIH': 'BA', 'BIZ': 'BZ', 'BLR': 'BY', 'BOL': 'BO',
  'BOT': 'BW', 'BRA': 'BR', 'BRN': 'BH', 'BRU': 'BN', 'BUL': 'BG',
  'BUR': 'BF', 'CAF': 'CF', 'CAM': 'KH', 'CAN': 'CA', 'CAY': 'KY',
  'CGO': 'CG', 'CHA': 'TD', 'CHI': 'CL', 'CHN': 'CN', 'CIV': 'CI',
  'CMR': 'CM', 'COD': 'CD', 'COK': 'CK', 'COL': 'CO', 'COM': 'KM',
  'CPV': 'CV', 'CRC': 'CR', 'CRO': 'HR', 'CUB': 'CU', 'CYP': 'CY',
  'CZE': 'CZ', 'DEN': 'DK', 'DJI': 'DJ', 'DMA': 'DM', 'DOM': 'DO',
  'ECU': 'EC', 'EGY': 'EG', 'ERI': 'ER', 'ESA': 'SV', 'ESP': 'ES',
  'EST': 'EE', 'ETH': 'ET', 'FIJ': 'FJ', 'FIN': 'FI', 'FRA': 'FR',
  'FSM': 'FM', 'GAB': 'GA', 'GAM': 'GM', 'GBR': 'GB', 'GBS': 'GW',
  'GEO': 'GE', 'GEQ': 'GQ', 'GER': 'DE', 'GHA': 'GH', 'GRE': 'GR',
  'GRN': 'GD', 'GUA': 'GT', 'GUI': 'GN', 'GUM': 'GU', 'GUY': 'GY',
  'HAI': 'HT', 'HKG': 'HK', 'HON': 'HN', 'HUN': 'HU', 'INA': 'ID',
  'IND': 'IN', 'IRI': 'IR', 'IRL': 'IE', 'IRQ': 'IQ', 'ISL': 'IS',
  'ISR': 'IL', 'ISV': 'VI', 'ITA': 'IT', 'IVB': 'VG', 'JAM': 'JM',
  'JOR': 'JO', 'JPN': 'JP', 'KAZ': 'KZ', 'KEN': 'KE', 'KGZ': 'KG',
  'KIR': 'KI', 'KOR': 'KR', 'KOS': 'XK', 'KSA': 'SA', 'KUW': 'KW',
  'LAO': 'LA', 'LAT': 'LV', 'LBA': 'LY', 'LBN': 'LB', 'LBR': 'LR',
  'LCA': 'LC', 'LES': 'LS', 'LIE': 'LI', 'LTU': 'LT', 'LUX': 'LU',
  'MAD': 'MG', 'MAR': 'MA', 'MAS': 'MY', 'MAW': 'MW', 'MDA': 'MD',
  'MDV': 'MV', 'MEX': 'MX', 'MGL': 'MN', 'MHL': 'MH', 'MKD': 'MK',
  'MLI': 'ML', 'MLT': 'MT', 'MNE': 'ME', 'MON': 'MC', 'MOZ': 'MZ',
  'MRI': 'MU', 'MTN': 'MR', 'MYA': 'MM', 'NAM': 'NA', 'NCA': 'NI',
  'NED': 'NL', 'NEP': 'NP', 'NGR': 'NG', 'NIG': 'NE', 'NOR': 'NO',
  'NRU': 'NR', 'NZL': 'NZ', 'OMA': 'OM', 'PAK': 'PK', 'PAN': 'PA',
  'PAR': 'PY', 'PER': 'PE', 'PHI': 'PH', 'PLE': 'PS', 'PLW': 'PW',
  'PNG': 'PG', 'POL': 'PL', 'POR': 'PT', 'PRK': 'KP', 'PUR': 'PR',
  'QAT': 'QA', 'ROU': 'RO', 'RSA': 'ZA', 'RUS': 'RU', 'RWA': 'RW',
  'SAM': 'WS', 'SEN': 'SN', 'SEY': 'SC', 'SGP': 'SG', 'SKN': 'KN',
  'SLE': 'SL', 'SLO': 'SI', 'SMR': 'SM', 'SOL': 'SB', 'SOM': 'SO',
  'SRB': 'RS', 'SRI': 'LK', 'SSD': 'SS', 'STP': 'ST', 'SUD': 'SD',
  'SUI': 'CH', 'SUR': 'SR', 'SVK': 'SK', 'SWE': 'SE', 'SWZ': 'SZ',
  'SYR': 'SY', 'TAN': 'TZ', 'TGA': 'TO', 'THA': 'TH', 'TJK': 'TJ',
  'TKM': 'TM', 'TLS': 'TL', 'TOG': 'TG', 'TPE': 'TW', 'TTO': 'TT',
  'TUN': 'TN', 'TUR': 'TR', 'TUV': 'TV', 'UAE': 'AE', 'UGA': 'UG',
  'UKR': 'UA', 'URU': 'UY', 'USA': 'US', 'UZB': 'UZ', 'VAN': 'VU',
  'VEN': 'VE', 'VIE': 'VN', 'VIN': 'VC', 'YEM': 'YE', 'ZAM': 'ZM',
  'ZIM': 'ZW',
};

/**
 * Parse HTML and extract medal counts
 */
async function parseMedals() {
  const html = await fs.readFile(MEDALS_HTML, 'utf-8');
  
  const medals = new Map();
  
  const rowPattern = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
  const rows = html.match(rowPattern) || [];
  
  for (const row of rows) {
    if (row.includes('<th') || row.includes('bgcolor="lightblue"')) continue;
    
    const iocMatch = row.match(/"wt":"([A-Z]{3})"/);
    if (!iocMatch) continue;
    
    const iocCode = iocMatch[1];
    const isoCode = IOC_TO_ISO[iocCode];
    
    if (!isoCode) continue;
    
    const cellPattern = /<td[^>]*>(?:<b[^>]*>)?([\d,]+)(?:<\/b>)?<\/td>/gi;
    const cellMatches = [...row.matchAll(cellPattern)].map(m => parseInt(m[1].replace(/,/g, ''), 10));
    
    if (cellMatches.length >= 15) {
      const gold = cellMatches[cellMatches.length - 4];
      const silver = cellMatches[cellMatches.length - 3];
      const bronze = cellMatches[cellMatches.length - 2];
      const total = cellMatches[cellMatches.length - 1];
      
      medals.set(isoCode, { gold, silver, bronze, total });
    }
  }
  
  return medals;
}

async function main() {
  console.log('Parsing olympic-medals.html...');
  const medals = await parseMedals();
  console.log(`  Found medal data for ${medals.size} countries`);
  
  console.log('\nUpdating countries.jsonl...');
  
  const { updated, total } = await updateCountries((country, iso) => {
    if (medals.has(iso)) {
      const m = medals.get(iso);
      
      // Return ONLY the fields we manage
      return {
        sports: {
          olympic_medals: {
            total: m.total,
            gold: m.gold,
            silver: m.silver,
            bronze: m.bronze,
          }
        }
      };
    }
    
    // No data - don't update
    return null;
  });
  
  console.log(`  Updated ${updated} of ${total} countries`);
  
  console.log('\nDone!');
  
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
