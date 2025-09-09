// agent.ts
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { ModelMCP } from "../../service/LlmMcp.js";

// Connect to Playwright MCP server (running in another process)
const transport = new StdioClientTransport({
  command: "npx",
  args: ["tsx", "src/tools/fetchServer.ts"],
});
const client = new Client({
  name: "client-scraper",
  version: "1.0.0",
});
await client.connect(transport);

// Call the scrape-data tool (from your server)
const result = await client.callTool({
  name: "product-scraper",
  arguments: {
    search: "laptop",
    limit: 5,
  },
});

console.log("MCP tool result:", result.content);

// Ask model to return JSON plan for extracting product titles + prices
const query =
  "Search Amazon.in for 'laptop' and return top 5 products have rating above 4.0 and price range between 40000-50000 rupees as JSON";

const response = new ModelMCP(
  "openai/gpt-oss-120b",
  process.env.GROQ_API_KEY || ""
);

response.run(query);
