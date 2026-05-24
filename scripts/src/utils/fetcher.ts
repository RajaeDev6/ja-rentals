const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; JARentalsBot/1.0; +https://jarentals.com/bot)',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

export async function fetchHtml(url: string, delayMs = 0): Promise<string> {
  if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(url, { headers: DEFAULT_HEADERS, signal: controller.signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);

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
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
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
