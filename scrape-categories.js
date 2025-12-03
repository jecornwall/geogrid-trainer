const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

function toFileName(name) {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}

function toFolderName(section) {
  return section.toLowerCase().replace(/\s+/g, '-');
}

function cleanDescription(text) {
  if (!text) return '';
  return text
    .replace(/(\.)([A-Z])/g, '$1\n\n$2')
    .replace(/(Source:\s*)/g, '\n\n$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function scrapeCategories() {
  console.log('Starting browser...');
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    console.log('Navigating to GeoGrid...');
    await page.goto('https://www.geogridgame.com/', { 
      timeout: 60000,
      waitUntil: 'domcontentloaded'
    });
    await page.waitForTimeout(3000);
    
    console.log('Opening menu...');
    await page.click('button:has-text("menu")', { timeout: 10000 });
    await page.waitForTimeout(1000);
    
    console.log('Opening Categories Atlas...');
    await page.click('button:has-text("Categories Info")', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Wait for category list
    await page.waitForSelector('.category-list', { timeout: 10000 });
    console.log('Category list found!\n');
    
    // Parse the HTML to get all categories with their sections
    const categoriesWithSections = await page.evaluate(() => {
      const results = [];
      const panels = document.querySelectorAll('.accordian-panel');
      
      panels.forEach(panel => {
        const header = panel.querySelector('.accordian-header');
        const section = header?.textContent?.trim() || 'Unknown';
        
        const items = panel.querySelectorAll('.accordian-content-item');
        items.forEach(item => {
          const name = item.textContent?.trim();
          if (name) {
            results.push({ section, name });
          }
        });
      });
      
      return results;
    });
    
    console.log(`Found ${categoriesWithSections.length} categories in HTML\n`);
    
    const results = [];
    const seenDescriptions = new Set();
    
    // Process each category
    for (const cat of categoriesWithSections) {
      try {
        // First scroll the category into view
        await page.evaluate((name) => {
          const items = document.querySelectorAll('.accordian-content-item');
          for (const item of items) {
            if (item.textContent?.trim() === name) {
              item.scrollIntoView({ behavior: 'instant', block: 'center' });
              break;
            }
          }
        }, cat.name);
        
        await page.waitForTimeout(100);
        
        // Click the category
        await page.click(`.accordian-content-item:has-text("${cat.name}")`, { timeout: 2000 });
        await page.waitForTimeout(500);
        
        // Get description with markdown links
        const content = await page.evaluate(() => {
          const info = document.querySelector('.category-info');
          if (!info) return '';
          
          const clone = info.cloneNode(true);
          
          // Convert links to markdown
          clone.querySelectorAll('a').forEach(link => {
            const href = link.getAttribute('href');
            const text = link.textContent?.trim();
            if (href && text) {
              link.replaceWith(`[${text}](${href})`);
            }
          });
          
          return clone.innerText;
        });
        
        if (content && content.length > 10) {
          const cleaned = cleanDescription(content);
          if (!seenDescriptions.has(cleaned)) {
            seenDescriptions.add(cleaned);
            results.push({
              section: cat.section,
              name: cat.name,
              description: cleaned
            });
            console.log(`✓ ${cat.name}`);
          } else {
            console.log(`~ ${cat.name} (duplicate)`);
          }
        } else {
          console.log(`✗ ${cat.name} (no content)`);
        }
      } catch (e) {
        console.log(`- ${cat.name} (error: ${e.message?.substring(0, 50)})`);
      }
    }
    
    // Save files
    console.log(`\n=== Saving ${results.length} categories ===`);
    const baseDir = path.join(__dirname, 'scraped-categories');
    if (fs.existsSync(baseDir)) fs.rmSync(baseDir, { recursive: true });
    fs.mkdirSync(baseDir, { recursive: true });
    
    for (const cat of results) {
      const dir = path.join(baseDir, toFolderName(cat.section));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, toFileName(cat.name) + '.md'), cat.description);
      console.log(`  ${cat.section}/${toFileName(cat.name)}.md`);
    }
    
    fs.writeFileSync(path.join(baseDir, 'all-categories.json'), JSON.stringify(results, null, 2));
    console.log('\nDone!');
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await page.waitForTimeout(1000);
    await browser.close();
  }
}

scrapeCategories();
