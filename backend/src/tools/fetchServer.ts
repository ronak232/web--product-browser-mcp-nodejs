import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { chromium } from "playwright";

// console.log("mcp-server executed...");

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
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
      });
      const page = await context.newPage();

      const url = `https://www.amazon.in/s?k=${encodeURIComponent(search)}`;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      const results = page.locator(
        'div.s-result-item[data-component-type="s-search-result"]'
      );
      await results.first().waitFor({ timeout: 45000 });

      const result = await page.evaluate(
        ({ limit, minPrice, maxPrice, minRating }) => {
          const items: ScraperResult["items"] = [];
          const nodes = Array.from(
            document.querySelectorAll(
              "div[data-asin][data-component-type='s-search-result']"
            )
          );

          for (const node of nodes) {
            if (items.length >= limit) break;

            try {
              const asin = (node as HTMLElement).dataset.asin?.trim();
              if (!asin) continue;

              if (
                node.querySelector('[data-component-type="s-sponsored-result"]')
              )
                continue;

              const titleEl = node.querySelector(
                "h2 a span, h2 span, .a-size-medium"
              );
              const linkEl = node.querySelector("h2 a, a[href]");
              const imgEl = node.querySelector("img.s-image, img");
              const priceEl =
                node.querySelector(
                  ".a-row [data-cy='price-recipe'] .a-price, .a-offscreen"
                ) || node.querySelector(".a-offscreen");

              const ratingEl = node.querySelector(
                ".a-icon-alt, .rating, .stars, .product-rating, i.a-icon-star span"
              );

              const title = titleEl?.textContent?.trim() ?? null;
              if (!title) continue; // Essential field

              let href = linkEl?.getAttribute("href") ?? null;
              if (href && href.startsWith("/")) {
                href = new URL(href, location.origin).href;
              }

              const image =
                imgEl?.getAttribute("src") ||
                imgEl?.getAttribute("data-src") ||
                null;

              const textContent = (node as HTMLElement).innerText ?? "";
              const priceText =
                priceEl?.textContent ??
                textContent.match(/₹\s*([\d,]+(?:\.\d+)?)/)?.[1] ??
                null;
              const ratingText =
                ratingEl?.textContent ??
                textContent.match(/([0-9]+(?:\.[0-9]+)?)\s*out of 5/)?.[1] ??
                null;

              const price = priceText
                ? parseFloat(
                    priceText.replace(/[^0-9.,]/g, "").replace(/,/g, "")
                  )
                : null;
              const rating = ratingText ? parseFloat(ratingText) : null;

              // Apply filters
              if (price !== null && (price < minPrice || price > maxPrice))
                continue;
              if (rating !== null && rating < minRating) continue;

              items.push({
                asin,
                title,
                price,
                rating,
                url: href!,
                image,
              });
            } catch {
              throw new Error("Something wrong happened!");
            }
          }
          return { items, count: items.length };
        },
        { limit, minPrice, maxPrice, minRating }
      );

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

async function connectServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

connectServer().catch((err) => {
  console.error("server error", err);
});
