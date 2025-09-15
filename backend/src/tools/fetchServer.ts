import { createConnection } from "@playwright/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { chromium } from "playwright";

console.log("mcp-server executed...");

const server = new McpServer({
  name: "mcp-web-server",
  version: "1.0.0",
});

interface ScraperResult {
  items: Array<{
    asin: string;
    title: string;
    price: number | null;
    rating: number | null;
    url: string;
  }>;
  count: number;
}

server.registerTool(
  "product-scraper",
  {
    title: "Product Scraper",
    description:
      "Tool to get product information from Amazon.in (supports price/rating filters). Accepts a product search term.",
    inputSchema: {
      search: z
        .string()
        .describe("Search term for the product (e.g., 'gaming keyboard')"),
      limit: z
        .number()
        .optional()
        .describe("Limit number of results (default 5)"),
      minPrice: z.number().optional().describe("Minimum price (INR)"),
      maxPrice: z.number().optional().describe("Maximum price (INR)"),
      minRating: z.number().optional().describe("Minimum rating (e.g. 4.0)"),
    },
  },
  async ({
    search,
    limit = 5,
    minPrice = 0,
    maxPrice = Number.MAX_SAFE_INTEGER,
    minRating = 0,
  }) => {
    let browser;
    try {
      browser = await chromium.launch({ headless: false });
      const context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
      });
      const page = await context.newPage();

      await page.goto("https://www.amazon.in", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      // Fill and submit search
      await page.locator("#twotabsearchtextbox").fill("gaming keyboard");
      const results = page.locator(
        'div.s-result-item[data-component-type="s-search-result"]'
      );
      await Promise.all([
        // Prefer element-based wait rather than brittle URL pattern
        results.first().waitFor({ timeout: 45000 }),
        page.locator("#nav-search-submit-button").click(),
      ]);

      await results.first().waitFor({ timeout: 45000 });

      const scraperScript = `
      (() => {
        const limit = ${limit};
        const minPrice = ${minPrice};
        const maxPrice = ${maxPrice};
        const minRating = ${minRating};


        const normalizePrice = (text) => {
          if (!text) return null;
          const t = text.replace(/[^0-9.,]/g, '').replace(/,/g, '');
          const n = parseFloat(t);
          return Number.isFinite(n) ? n : null;
        };
        const normalizeRating = (text) => {
          if (!text) return null;
          const m = text.match(/([0-9]+(\\.[0-9]+)?)/);
          return m ? parseFloat(m[0]) : null;
        };


        const items = [];
        const seen = new Set();
        const candidates = Array.from(document.querySelectorAll("[data-asin]:not([data-asin=''])"));


        for (const el of candidates) {
          const asin = el.getAttribute('data-asin').trim();
          if (!asin || seen.has(asin)) continue;
          seen.add(asin);


          if (el.querySelector('[data-component-type="s-sponsored-result"]')) continue;


          const titleEl = el.querySelector('h2 a span') || el.querySelector('h2 a');
          const title = titleEl ? (titleEl.innerText || titleEl.textContent || '').trim() : null;


          const linkEl = el.querySelector('h2 a') || el.querySelector('a.a-link-normal');
          let url = linkEl ? (linkEl.href || linkEl.getAttribute('href')) : null;
          if (url && url.startsWith('/')) url = location.origin + url;


          let priceText = null;
          const priceEl = el.querySelector('.a-price .a-offscreen');
          if (priceEl) {
            priceText = priceEl.innerText;
          } else {
            const whole = el.querySelector('.a-price-whole');
            const frac = el.querySelector('.a-price-fraction');
            if (whole) priceText = (whole.innerText || '') + (frac ? '.' + frac.innerText : '');
          }
          const price = normalizePrice(priceText);


          const ratingEl = el.querySelector('.a-icon-alt') || el.querySelector('span[aria-label*="out of 5 stars"]');
          const rating = normalizeRating(ratingEl ? (ratingEl.innerText || ratingEl.getAttribute('aria-label')) : null);


          if (!title || !url || price == null) continue;
          
          if (price >= minPrice && price <= maxPrice && (rating === null || rating >= minRating)) {
            items.push({ asin, title, price, rating, url });
            if (items.length >= limit) break;
          }
        }


        return { items, count: items.length };
      })()
    `;

      const result = (await page.evaluate(scraperScript)) as ScraperResult;

      // 4. Add screenshot for debugging if no results are found
      if (result.count === 0) {
        const path = "debug_screenshot.png";
        await page.screenshot({ path, fullPage: true });
        console.log(
          `No items found. Saved a screenshot for debugging to: ${path}`
        );
      }
      await page.close();
      await browser.close();
      return {
        content: [
          {
            name: "result",
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      if (browser) await browser.close();
      console.error("An error occurred during scraping:", error);
      return {
        content: [
          {
            name: "result",
            type: "text",
            text: JSON.stringify({ items: [], count: 0, error: error.message }),
          },
        ],
        isError: true,
      };
    }
  }
);

async function connectServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

connectServer().catch((err) => {
  console.error("server error", err);
});
