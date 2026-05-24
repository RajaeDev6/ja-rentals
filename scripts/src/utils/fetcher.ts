const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
];

const ACCEPT_LANGUAGES = [
  'en-US,en;q=0.9',
  'en-GB,en;q=0.9',
  'en-JM,en;q=0.9,en-US;q=0.8',
];

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Jitter: humanise delay to ±30% of the specified value
function jitter(ms: number): number {
  return Math.floor(ms * (0.7 + Math.random() * 0.6));
}

function buildHeaders(referer?: string): Record<string, string> {
  const ua = randomPick(USER_AGENTS);
  const isFirefox = ua.includes('Firefox');
  const isSafari = ua.includes('Safari') && !ua.includes('Chrome');

  const headers: Record<string, string> = {
    'User-Agent': ua,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': randomPick(ACCEPT_LANGUAGES),
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': referer ? 'same-origin' : 'none',
    'Sec-Fetch-User': '?1',
    DNT: '1',
  };

  if (referer) headers['Referer'] = referer;

  // Firefox and Safari don't send sec-ch-ua headers
  if (!isFirefox && !isSafari) {
    headers['sec-ch-ua'] = '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"';
    headers['sec-ch-ua-mobile'] = '?0';
    headers['sec-ch-ua-platform'] = randomPick(['"Windows"', '"macOS"', '"Linux"']);
  }

  return headers;
}

// Route through ScraperAPI if SCRAPER_API_KEY is set, otherwise direct
// render=true for JS-heavy sites, false for plain HTML (faster, fewer credits)
function resolveUrl(url: string, renderJs = false): { url: string; useProxy: boolean } {
  const key = process.env.SCRAPER_API_KEY;
  if (!key) return { url, useProxy: false };
  const render = renderJs ? 'true' : 'false';
  return {
    url: `http://api.scraperapi.com?api_key=${key}&url=${encodeURIComponent(url)}&render=${render}&country_code=us`,
    useProxy: true,
  };
}

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAX_RETRIES = 3;
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);

async function doFetch(url: string, headers: Record<string, string>, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { headers, signal: controller.signal, redirect: 'follow' });
  } finally {
    clearTimeout(t);
  }
}

export async function fetchHtml(targetUrl: string, baseDelayMs = 0, referer?: string, renderJs = false): Promise<string> {
  if (baseDelayMs > 0) await new Promise((r) => setTimeout(r, jitter(baseDelayMs)));

  const { url, useProxy } = resolveUrl(targetUrl, renderJs);
  // JS rendering via ScraperAPI can take 30–90s; plain proxy ~15s; direct ~20s
  const timeoutMs = useProxy ? (renderJs ? 90_000 : 30_000) : 20_000;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 1) {
      // Exponential back-off between retries: 3s, 9s, 27s (with jitter)
      await new Promise((r) => setTimeout(r, jitter(3000 * Math.pow(3, attempt - 2))));
    }

    let res: Response;
    try {
      res = await doFetch(url, buildHeaders(referer), timeoutMs);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      console.warn(`[fetch] Attempt ${attempt}/${MAX_RETRIES} network error for ${targetUrl}:`, lastError.message);
      continue;
    }

    if (res.ok) {
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_RESPONSE_BYTES) { reader.cancel(); break; }
        chunks.push(value);
      }

      const merged = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) { merged.set(c, offset); offset += c.byteLength; }
      return new TextDecoder().decode(merged);
    }

    // 403/404 are final — no point retrying
    if (res.status === 403 || res.status === 404) {
      throw new Error(`HTTP ${res.status} for ${targetUrl} (not retrying)`);
    }

    if (RETRY_STATUSES.has(res.status)) {
      lastError = new Error(`HTTP ${res.status}`);
      console.warn(`[fetch] Attempt ${attempt}/${MAX_RETRIES} got ${res.status} for ${targetUrl}`);

      // Respect Retry-After header if present
      const retryAfter = res.headers.get('Retry-After');
      if (retryAfter) {
        const wait = parseInt(retryAfter, 10) * 1000;
        if (!isNaN(wait) && wait < 60_000) await new Promise((r) => setTimeout(r, wait));
      }
      continue;
    }

    throw new Error(`HTTP ${res.status} for ${targetUrl}`);
  }

  throw lastError ?? new Error(`Failed to fetch ${targetUrl} after ${MAX_RETRIES} attempts`);
}

export async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { Accept: 'application/json', ...(options.headers as Record<string, string>) },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timeout);
  }
}
