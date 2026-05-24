import { chromium, type Browser, type Page } from 'playwright';

let _browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!_browser) {
    _browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
    });
  }
  return _browser;
}

export async function closeBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}

export async function fetchPageHtml(url: string, waitMs = 2000): Promise<string> {
  const browser = await getBrowser();
  let page: Page | null = null;

  try {
    page = await browser.newPage();

    // Mimic a real browser
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
    });

    await page.setViewportSize({ width: 1280, height: 900 });

    // Block images, fonts, and media to speed up page loads
    await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,ico,woff,woff2,ttf,mp4,webm}', (route) =>
      route.abort()
    );

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // Wait for content to render
    await page.waitForTimeout(waitMs);

    // Scroll down to trigger lazy-loading
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(500);

    return await page.content();
  } finally {
    await page?.close();
  }
}
