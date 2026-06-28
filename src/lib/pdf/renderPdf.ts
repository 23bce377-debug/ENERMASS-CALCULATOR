import type { Browser } from 'puppeteer-core';

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserPromise) return browserPromise;

  const isServerless = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (isServerless) {
    console.log('[renderPdf] Launching serverless Chromium (production)...');
    try {
      console.log('[renderPdf] Step 1: Importing @sparticuz/chromium-min...');
      const chromium = (await import('@sparticuz/chromium-min')).default as any;
      console.log('[renderPdf] Step 2: Importing puppeteer-core...');
      const puppeteerCore = (await import('puppeteer-core')).default;

      // chromium-min downloads the binary at runtime from this URL
      // instead of requiring bundled binaries in node_modules
      const remoteUrl = 'https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.tar';
      console.log('[renderPdf] Step 3: Downloading chromium binary from:', remoteUrl);
      const executablePath = await chromium.executablePath(remoteUrl);
      console.log('[renderPdf] Step 4: Got executablePath:', executablePath);

      browserPromise = puppeteerCore.launch({
        args: [
          ...chromium.args,
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--font-render-hinting=none'
        ],
        defaultViewport: chromium.defaultViewport,
        executablePath,
        headless: true
      }) as unknown as Promise<Browser>;
      console.log('[renderPdf] Step 5: Browser launched successfully');
    } catch (err: any) {
      console.error('[renderPdf] Failed to launch serverless Chromium:', err?.message || err);
      console.error('[renderPdf] Error stack:', err?.stack);
      throw err;
    }
  } else {
    console.log('[renderPdf] Launching local Puppeteer browser (development)...');
    try {
      const puppeteer = (await import('puppeteer')).default;
      browserPromise = puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      }) as unknown as Promise<Browser>;
    } catch (err) {
      console.error('[renderPdf] Failed to launch local Puppeteer:', err);
      throw err;
    }
  }

  return browserPromise;
}

export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    console.log('[renderPdf] Rendering page content to PDF...');
    // We set content and wait for network connections to idle (useful for loading external SVGs/fonts/images)
    await page.setContent(html, { waitUntil: 'networkidle0' as any, timeout: 30000 });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,       // Ensures background colors and banners render correctly
      preferCSSPageSize: true,     // Respects the A4 sizing and margin specifications from the CSS
      margin: {
        top: '0mm',
        bottom: '0mm',
        left: '0mm',
        right: '0mm'
      }
    });

    return Buffer.from(pdf);
  } catch (err) {
    console.error('[renderPdf] PDF rendering exception:', err);
    throw err;
  } finally {
    await page.close();
  }
}
