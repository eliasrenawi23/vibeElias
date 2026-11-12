import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Browser } from 'playwright';
import type { Env } from '../config/env';

/** What `page.pdf()` prints around the HTML body. */
export interface PdfPrintOptions {
  /** HTML of the footer (Chromium header / footer template: page x of y). */
  footerTemplate: string;
}

/** A4 margins; the bottom one leaves room for the footer. */
export const PDF_MARGINS = { top: '14mm', right: '14mm', bottom: '17mm', left: '14mm' } as const;

/**
 * HTML -> PDF with Playwright Chromium (correct Hebrew / Arabic shaping): one browser launched
 * lazily on the first render and reused, a fresh context + page per render, at most
 * `PDF_CONCURRENCY` renders at a time (the rest wait in a FIFO queue), closed on shutdown.
 */
@Injectable()
export class PdfRenderer implements OnModuleDestroy {
  private readonly logger = new Logger(PdfRenderer.name);
  private browser: Promise<Browser> | null = null;
  private readonly concurrency: number;
  private readonly timeoutMs: number;
  private running = 0;
  private readonly waiting: (() => void)[] = [];
  private closed = false;

  constructor(config: ConfigService<Env, true>) {
    this.concurrency = config.get('PDF_CONCURRENCY', { infer: true });
    this.timeoutMs = config.get('PDF_TIMEOUT_MS', { infer: true });
  }

  /** Renders a full HTML document to an A4 PDF. */
  async pdf(html: string, options: PdfPrintOptions): Promise<Buffer> {
    return this.withSlot(async () => {
      const browser = await this.getBrowser();
      const context = await browser.newContext({ javaScriptEnabled: false });
      try {
        const page = await context.newPage();
        page.setDefaultTimeout(this.timeoutMs);
        await page.setContent(html, { waitUntil: 'load', timeout: this.timeoutMs });
        await page.emulateMedia({ media: 'print' });
        const pdf = await page.pdf({
          format: 'A4',
          printBackground: true,
          preferCSSPageSize: false,
          margin: { ...PDF_MARGINS },
          displayHeaderFooter: true,
          headerTemplate: '<span></span>',
          footerTemplate: options.footerTemplate,
        });
        return Buffer.from(pdf);
      } finally {
        await context.close().catch(() => undefined);
      }
    });
  }

  /** Number of renders running / waiting (diagnostics, tests). */
  get load(): { running: number; waiting: number } {
    return { running: this.running, waiting: this.waiting.length };
  }

  async onModuleDestroy(): Promise<void> {
    this.closed = true;
    const pending = this.browser;
    this.browser = null;
    if (pending) {
      try {
        await (await pending).close();
      } catch {
        // The browser failed to start or is already gone.
      }
    }
  }

  /** Runs `task` in a render slot; a finished render hands its slot straight to the next waiter. */
  private async withSlot<T>(task: () => Promise<T>): Promise<T> {
    if (this.running >= this.concurrency) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    } else {
      this.running += 1;
    }
    try {
      return await task();
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.running -= 1;
    }
  }

  private getBrowser(): Promise<Browser> {
    if (this.closed) return Promise.reject(new Error('PDF renderer is shut down'));
    if (!this.browser) {
      const launching = this.launch();
      this.browser = launching;
      launching.then(
        (browser) =>
          browser.on('disconnected', () => {
            if (this.browser === launching) this.browser = null;
          }),
        () => {
          if (this.browser === launching) this.browser = null;
        },
      );
    }
    return this.browser;
  }

  private async launch(): Promise<Browser> {
    const { chromium } = await import('playwright');
    const started = Date.now();
    const browser = await chromium.launch({
      headless: true,
      // Containers run as a non-root user without user namespaces.
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
    });
    this.logger.log(`Chromium ${browser.version()} started in ${Date.now() - started} ms`);
    return browser;
  }
}
