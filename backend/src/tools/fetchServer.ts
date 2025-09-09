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

server.registerTool(
  "product-scraper",
  {
    title: "Product Scraper", // optional, for display purposes
    description: "Tool to get product information",
    inputSchema: {
      search: z.string().describe("Search Product"),
      limit: z.number().describe("Limit number of results"),
    },
  },
  async ({ search, limit }) => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Go to Amazon search results
    await page.goto(`https://www.amazon.in/s?k=${encodeURIComponent(search)}`);

    // Extract product titles + prices
    const products = await page.evaluate((limit) => {
      const items: { title: string; price: string }[] = [];
      const nodes = document.querySelectorAll("div[data-asin]");

      for (let node of nodes) {
        if (items.length >= limit) break;
        const titleEl = node.querySelector("h2 a span");
        const priceEl = node.querySelector(".a-price .a-offscreen");

        if (titleEl && priceEl) {
          items.push({
            title: titleEl.textContent?.trim() || "N/A",
            price: priceEl.textContent?.trim() || "N/A",
          });
        }
      }
      return items;
    }, limit);

    await browser.close();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(products, null, 2),
        },
      ],
    };
  }
);

async function connectServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

connectServer().catch((err) => {
  console.error("server error", err);
});
