import * as cheerio from 'cheerio';

// Logs the tag/class fingerprint of the page when no listings are found
// This lets us identify the correct selectors from GitHub Actions logs
export function logPageStructure(html: string, label: string): void {
  const $ = cheerio.load(html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, ''));

  // Top-level structural tags with their classes
  const tags: string[] = [];
  $('body *').each((_, el) => {
    const cls = ($(el).attr('class') ?? '').trim().split(/\s+/).slice(0, 3).join(' ');
    const id = $(el).attr('id') ?? '';
    const tag = el.type === 'tag' ? el.name : '';
    if (!tag || tags.length > 80) return;
    if (cls || id) tags.push(`<${tag}${id ? ` #${id}` : ''}${cls ? ` .${cls}` : ''}>`);
  });

  console.log(`[${label}] Page structure (first 80 els with class/id):`);
  console.log(tags.join('\n'));

  // Also log any price-like text found anywhere on the page
  const priceMatches: string[] = [];
  $('*').each((_, el) => {
    const text = $(el).clone().children().remove().end().text().trim();
    if (/\$[\d,]+|J\$[\d,]+|JMD\s*[\d,]+/.test(text) && text.length < 80) {
      priceMatches.push(text.slice(0, 80));
    }
  });
  if (priceMatches.length > 0) {
    console.log(`[${label}] Price-like text found on page:`, priceMatches.slice(0, 10));
  } else {
    console.log(`[${label}] No price-like text found — page may be JS-rendered or blocked`);
  }
}
