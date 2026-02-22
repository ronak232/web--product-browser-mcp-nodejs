import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { chromium } from "playwright";

// console.error("mcp-server executing...");

const server = new McpServer({
  name: "mcp-web-server",
  version: "1.0.0",
  title: "playwright-server",
});

interface ScraperResult {
  items: Array<{
    asin: string;
    title: string;
    price: number | null;
    rating: number | null;
    url: string;
    image: string | null;
    originalPrice?: number | null;  // List/original price
    salePrice?: number | null;      // Current sale/offer price
    discountPercent?: number | null; // Discount percentage
    platform: 'amazon' | 'flipkart';
    isDeal?: boolean;
  }>;
  count: number;
}

server.registerTool(
  "product-scraper",
  {
    title: "Product Scraper",
    description:
      "Tool to get product information from Amazon.in and Flipkart.com. Accepts a product search term.",
    inputSchema: {
      search: z
        .string()
        .describe("Search term for the product (e.g., 'gaming keyboard')"),
      limit: z
        .number()
        .optional()
        .describe("Limit number of results per platform (default 5)"),
      minPrice: z.number().optional().describe("Minimum price (INR)"),
      maxPrice: z.number().optional().describe("Maximum price (INR)"),
      minRating: z.number().optional().describe("Minimum rating (e.g. 4.0)"),
      platform: z.enum(["amazon", "flipkart", "all"]).optional().describe("Platform to scrape from (default: all)"),
    },
  },
  async ({
    search,
    limit = 5,
    minPrice = 0,
    maxPrice = Number.MAX_SAFE_INTEGER,
    minRating = 0,
    platform = "all",
  }) => {
    let browser;
    try {
      browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--window-size=1920,1080'
        ]
      });
      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        viewport: { width: 1920, height: 1080 },
        extraHTTPHeaders: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'document',
          'sec-fetch-mode': 'navigate',
          'sec-fetch-site': 'none',
          'sec-fetch-user': '?1',
          'upgrade-insecure-requests': '1',
        }
      });

      const items: ScraperResult["items"] = [];

      // --- Amazon Scraping ---
      if (platform === "all" || platform === "amazon") {
        try {
          const page = await context.newPage();
          const url = `https://www.amazon.in/s?k=${encodeURIComponent(search)}`;
          const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
          const pageTitle = await page.title();
          const status = response?.status();
          console.error(`Amazon Page: ${pageTitle} (Status: ${status})`);

          // Check for captcha/block
          const content = await page.content();
          if (content.includes('captcha') || content.includes('robot') || content.includes('automated')) {
            console.error('Amazon: Possible captcha/bot detection!');
          }

          // Write debug files
          const fs = await import('fs');
          const debugDir = 'debug_output';
          if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir);
          fs.writeFileSync(`${debugDir}/amazon_page.html`, content);
          await page.screenshot({ path: `${debugDir}/amazon_screenshot.png`, fullPage: false });
          console.error(`Debug files written to ${debugDir}/`);

          // Manual wait for dynamic results
          await page.waitForTimeout(3000);

          // Get content again AFTER waiting
          const contentAfterWait = await page.content();
          fs.writeFileSync(`${debugDir}/amazon_page_after_wait.html`, contentAfterWait);
          await page.screenshot({ path: `${debugDir}/amazon_screenshot_after_wait.png`, fullPage: false });

          try {
            await page.waitForSelector('div[data-asin], .s-result-item', { timeout: 10000 });
          } catch (e) {
            console.error(`Amazon selector timeout. Full page length: ${contentAfterWait.length}`);
          }

          const amazonItems = await page.evaluate(
            ({ limit, minPrice, maxPrice, minRating }) => {
              try {
                var results: any[] = [];
                var debug: string[] = [];
                var itemErrors: string[] = [];

                // Try multiple selector strategies
                var nodes = Array.from(document.querySelectorAll('div[data-component-type="s-search-result"]'));
                debug.push(`Strategy 1 (s-search-result): ${nodes.length} nodes`);

                if (nodes.length === 0) {
                  nodes = Array.from(document.querySelectorAll('div[data-asin]:not([data-asin=""])'));
                  debug.push(`Strategy 2 (data-asin): ${nodes.length} nodes`);
                }

                if (nodes.length === 0) {
                  nodes = Array.from(document.querySelectorAll('.s-result-item[data-asin]'));
                  debug.push(`Strategy 3 (s-result-item): ${nodes.length} nodes`);
                }

                debug.push(`All divs with data-asin: ${document.querySelectorAll('[data-asin]').length}`);

                // Counters for debugging
                var skipNoAsin = 0;
                var skipSponsored = 0;
                var skipNoTitle = 0;
                var skipPriceFilter = 0;
                var skipRatingFilter = 0;
                var processed = 0;

                for (var _i = 0; _i < nodes.length; _i++) {
                  var node = nodes[_i];
                  if (results.length >= limit) break;
                  processed++;
                  try {
                    var asin = (node as HTMLElement).dataset.asin?.trim() || "";
                    if (!asin) { skipNoAsin++; continue; }

                    // Skip sponsored but count it
                    if (node.querySelector('[data-component-type="s-sponsored-result"]') ||
                      node.querySelector('.s-sponsored-label-info-icon')) {
                      skipSponsored++;
                      continue;
                    }

                    // Title Selection prioritise h2
                    var titleEl = node.querySelector("h2");
                    var title = titleEl?.textContent?.trim() ?? node.querySelector(".a-size-medium, .a-size-base-plus, .a-text-normal, [class*='title']")?.textContent?.trim() ?? null;
                    if (!title || title.length < 3) { skipNoTitle++; continue; }

                    // Link Selection
                    var linkEl = node.querySelector("a[href*='/dp/'], a[href*='/gp/'], h2 a");
                    var href = linkEl?.getAttribute("href") ?? null;
                    if (href && href.startsWith("/")) {
                      href = new URL(href, location.origin).href;
                    }

                    // Image Selection
                    var imgEl = node.querySelector("img[src*='images-amazon'], img.s-image");
                    var image = imgEl?.getAttribute("src") || imgEl?.getAttribute("data-src") || null;

                    // Price Selection — use multiple strategies, most reliable first
                    var salePrice: number | null = null;
                    var originalPrice: number | null = null;

                    // Strategy 1: .a-price-whole (most reliable, contains just the number)
                    var priceWholeEl = node.querySelector('.a-price:not(.a-text-price) .a-price-whole');
                    if (priceWholeEl) {
                      var wholeTxt = priceWholeEl.textContent?.trim() || '';
                      salePrice = parseFloat(wholeTxt.replace(/[^0-9]/g, '')) || null;
                    }

                    // Strategy 2: .a-offscreen inside .a-price but ONLY if it contains ₹
                    if (!salePrice) {
                      var offscreenEl = node.querySelector('.a-price:not(.a-text-price) .a-offscreen');
                      var offTxt = offscreenEl?.textContent?.trim() || '';
                      if (offTxt.includes('₹')) {
                        salePrice = parseFloat(offTxt.replace(/[^0-9,.]/g, '').replace(/,/g, '')) || null;
                      }
                    }

                    // Strategy 3: ₹ regex on innerText (catches any price format)
                    if (!salePrice) {
                      var priceMatches = (node as HTMLElement).innerText.match(/₹\s*([\d,]+)/);
                      if (priceMatches) {
                        salePrice = parseFloat(priceMatches[1].replace(/,/g, ''));
                      }
                    }

                    // Sanity check: price must be between 1 and 10,000,000
                    if (salePrice !== null && (salePrice < 1 || salePrice > 10000000 || isNaN(salePrice))) {
                      salePrice = null;
                    }

                    // Original/MRP price
                    var mrpEl = node.querySelector('.a-price.a-text-price .a-offscreen, .a-text-strike');
                    var mrpTxt = mrpEl?.textContent || null;
                    if (mrpTxt && mrpTxt.includes('₹')) {
                      originalPrice = parseFloat(mrpTxt.replace(/[^0-9,.]/g, '').replace(/,/g, '')) || null;
                    }

                    const ratingEl = node.querySelector(".a-icon-alt, i.a-icon-star, [aria-label*='stars']");
                    let ratingRaw = ratingEl ? (ratingEl.textContent || ratingEl.getAttribute("aria-label") || "") : "";
                    const ratingMatch = ratingRaw.match(/(\d+\.?\d*)\s*out of/);
                    const rating = ratingMatch ? parseFloat(ratingMatch[1]) : (parseFloat(ratingRaw) || null);

                    let discountPercent: number | null = null;
                    if (originalPrice && salePrice && originalPrice > salePrice) {
                      discountPercent = Math.round(((originalPrice - salePrice) / originalPrice) * 100);
                    }

                    if (salePrice !== null && (salePrice < minPrice || salePrice > maxPrice)) { skipPriceFilter++; continue; }
                    if (rating !== null && rating < minRating) { skipRatingFilter++; continue; }

                    results.push({
                      asin,
                      title,
                      price: salePrice,
                      rating,
                      url: href || "",
                      image,
                      originalPrice,
                      salePrice,
                      discountPercent,
                      platform: 'amazon',
                      isDeal: !!node.querySelector('.a-badge-text') || (discountPercent ? discountPercent > 20 : false)
                    });
                  } catch (e: any) {
                    itemErrors.push(`Item[${(node as HTMLElement).dataset?.asin || 'unknown'}]: ${e?.message || String(e)}`);
                  }
                }
                return {
                  results,
                  debug: {
                    strategies: debug,
                    nodeCount: nodes.length,
                    processed,
                    skipNoAsin,
                    skipSponsored,
                    skipNoTitle,
                    skipPriceFilter,
                    skipRatingFilter,
                    resultCount: results.length,
                    itemErrors,
                    firstTitles: nodes.slice(0, 5).map(n => n.querySelector('h2')?.textContent?.trim() || "no-title"),
                    firstAsins: nodes.slice(0, 5).map(n => (n as HTMLElement).dataset?.asin || "no-asin")
                  }
                };
              } catch (error: any) {
                return { error: error.message };
              }
            },
            { limit, minPrice, maxPrice, minRating }
          );

          if (amazonItems && amazonItems.results) {
            console.error('Amazon debug info:', JSON.stringify(amazonItems.debug, null, 2));
            // Write debug to file for inspection
            fs.writeFileSync(`${debugDir}/amazon_evaluate_debug.json`, JSON.stringify(amazonItems, null, 2));
            items.push(...amazonItems.results);
            if (amazonItems.results.length === 0) {
              console.error('Amazon 0 results - check debug info above');
            }
          } else if (amazonItems?.error) {
            console.error('Amazon evaluate error:', amazonItems.error);
            fs.writeFileSync(`${debugDir}/amazon_evaluate_error.json`, JSON.stringify(amazonItems, null, 2));
          }
          await page.close();
        } catch (e) {
          console.error("Amazon Scraping Error:", e);
        }
      }

      // --- Flipkart Scraping ---
      if (platform === "all" || platform === "flipkart") {
        try {
          const page = await context.newPage();
          const url = `https://www.flipkart.com/search?q=${encodeURIComponent(search)}`;
          const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
          console.error(`Flipkart Page: ${await page.title()} (Status: ${response?.status()})`);

          // Manual wait for dynamic results
          await page.waitForTimeout(3000);

          try {
            await page.waitForSelector('div[data-id], .RGLWAk', { timeout: 10000 });
          } catch (e) {
            console.error("Flipkart wait timeout");
          }

          const flipkartItems = await page.evaluate(
            ({ limit, minPrice, maxPrice, minRating }) => {
              try {
                var results: any[] = [];

                // Multi-strategy node selection: prefer data-id containers, fallback to .RGLWAk parents
                var nodes = Array.from(document.querySelectorAll('div[data-id]'));
                if (nodes.length === 0) {
                  // Try getting parents of .RGLWAk that have data-id
                  nodes = Array.from(document.querySelectorAll('.RGLWAk')).map(n => {
                    let p = n.parentElement;
                    while (p && !p.getAttribute('data-id')) p = p.parentElement;
                    return p;
                  }).filter(Boolean) as Element[];
                }

                for (var _i = 0; _i < nodes.length; _i++) {
                  var node = nodes[_i];
                  if (results.length >= limit) break;
                  try {
                    var asin = (node as HTMLElement).dataset.id || node.getAttribute('data-id') || `fk-${Math.random()}`;

                    // Title: new class .pIpigb, fallback to older classes, then img alt text
                    var titleEl = node.querySelector('.pIpigb, .KzDlHZ, ._4rR01T, .s1Q9rs, ._2WkVRV, .IRpwS_');
                    var imgEl = node.querySelector('img');
                    var title = titleEl?.textContent?.trim() ||
                      imgEl?.getAttribute('alt')?.trim() || null;
                    if (!title || title.length < 3) continue;

                    var linkEl = node.querySelector('a[href]');
                    var href = linkEl?.getAttribute('href') || null;
                    if (href && href.startsWith('/')) {
                      href = new URL(href, location.origin).href;
                    }

                    var image = imgEl?.getAttribute('src') || null;

                    // Price: new class .hZ3P6w, multiple fallbacks, then ₹ regex on innerText
                    var salePriceEl = node.querySelector('.hZ3P6w, ._30jeq3, ._16Jk6d, .Nx9bqj');
                    var salePriceTxt = salePriceEl?.textContent?.trim() || null;
                    var salePrice: number | null = null;
                    if (salePriceTxt) {
                      salePrice = parseFloat(salePriceTxt.replace(/[^0-9.]/g, '')) || null;
                    }
                    // Fallback: search for ₹ in innerText
                    if (!salePrice) {
                      var priceMatch = (node as HTMLElement).innerText?.match(/₹\s*([\d,]+)/);
                      if (priceMatch) salePrice = parseFloat(priceMatch[1].replace(/,/g, ''));
                    }

                    // MRP/original price
                    var mrpEl = node.querySelector('.yRaY8j, ._3I9_wc, ._2p6lqe');
                    var mrpTxt = mrpEl?.textContent?.trim() || null;
                    var originalPrice: number | null = mrpTxt ? parseFloat(mrpTxt.replace(/[^0-9.]/g, '')) || null : null;

                    // Rating: new class .CjyrHS, fallback to older classes
                    var ratingEl = node.querySelector('.CjyrHS, ._3LWZlK, .XQDdHH');
                    var rating: number | null = null;
                    if (ratingEl) {
                      var ratingTxt = ratingEl.textContent?.trim() || '';
                      var ratingMatch = ratingTxt.match(/(\d+\.?\d*)/);
                      rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;
                    }

                    // Discount
                    let discountPercent: number | null = null;
                    var discountEl = node.querySelector('.UkUFwK, ._3Ay6Sb, [class*="percent"], [class*="discount"]');
                    if (discountEl) {
                      var discTxt = discountEl.textContent?.match(/(\d+)%/);
                      if (discTxt) discountPercent = parseInt(discTxt[1]);
                    }
                    if (!discountPercent && originalPrice && salePrice && originalPrice > salePrice) {
                      discountPercent = Math.round(((originalPrice - salePrice) / originalPrice) * 100);
                    }

                    if (salePrice !== null && (salePrice < minPrice || salePrice > maxPrice)) continue;
                    if (rating !== null && rating < minRating) continue;

                    results.push({
                      asin,
                      title,
                      price: salePrice,
                      rating,
                      url: href || '',
                      image,
                      originalPrice,
                      salePrice,
                      discountPercent,
                      platform: 'flipkart',
                      isDeal: (discountPercent ? discountPercent > 20 : false)
                    });
                  } catch (e: any) {
                    console.error(`Flipkart item error: ${e?.message || String(e)}`);
                  }
                }
                return { results };
              } catch (error: any) {
                return { error: error.message };
              }
            }, { limit, minPrice, maxPrice, minRating }
          );

          if (flipkartItems && flipkartItems.results) {
            items.push(...flipkartItems.results);
          }
          await page.close();
        } catch (e) {
          console.error("Flipkart Scraping Error:", e);
        }
      }

      await browser.close();
      return {
        content: [
          {
            name: "result",
            type: "text",
            text: JSON.stringify({ items, count: items.length }, null, 2),
          },
        ],
      };
    } catch (error: any) {
      if (browser) await browser.close();
      console.error("An error occurred during scraping:", error);
      return {
        content: [
          {
            name: "result",
            type: "text",
            text: JSON.stringify({
              items: [],
              count: 0,
              error: error.message,
            }),
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "product-details",
  {
    title: "Product Details Scraper",
    description: "Scrape detailed product information from a specific Amazon or Flipkart URL.",
    inputSchema: {
      url: z.string().describe("The full URL of the product page."),
      platform: z.enum(["amazon", "flipkart"]).describe("The platform source."),
    },
  },
  async ({ url, platform }) => {
    let browser;
    try {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
      });
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

      const details = await page.evaluate((plat) => {
        const res: any = { features: [], description: "" };

        if (plat === 'amazon') {
          // Amazon details
          const featureBullets = document.querySelectorAll('#feature-bullets li span.a-list-item');
          featureBullets.forEach(li => {
            const txt = li.textContent?.trim();
            if (txt) res.features.push(txt);
          });

          const desc = document.querySelector('#productDescription');
          if (desc) res.description = desc.textContent?.trim();

        } else if (plat === 'flipkart') {
          // Flipkart details
          const highlights = document.querySelectorAll('div._2cM9lP div.yN+eNk'); // Highlights section
          highlights.forEach(h => {
            const txt = h.textContent?.trim();
            if (txt) res.features.push(txt);
          });

          const desc = document.querySelector('div._1mXcCf');
          if (desc) res.description = desc.textContent?.trim();
        }
        return res;
      }, platform);

      await browser.close();
      return {
        content: [{ name: "details", type: "text", text: JSON.stringify(details, null, 2) }]
      };

    } catch (e: any) {
      if (browser) await browser.close();
      return {
        content: [{ name: "error", type: "text", text: JSON.stringify({ error: e.message }) }],
        isError: true
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
