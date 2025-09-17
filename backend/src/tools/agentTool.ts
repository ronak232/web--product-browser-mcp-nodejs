// agent.ts
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { ModelMCP } from "../../service/LlmMcp.js";

const transport = new StdioClientTransport({
  command: "npx",
  args: ["tsx", "src/tools/fetchServer.ts"],
});

const client = new Client({
  name: "client-scraper",
  version: "1.0.0",
});
await client.connect(transport);

const query =
  "Search Amazon.in for 'gaming-keyboard' and return top 5 products with rating above 4.0 and price between 1000-2000 INR.";

const llm = new ModelMCP({
  model: "openai/gpt-oss-20b",
  apikey: process.env.GROQ_API_KEY || "",
});

const planRaw = await llm.run(query);
console.log("LLM plan raw:", planRaw);

let plan: { tool: string; args: any }[];
try {
  plan = JSON.parse(planRaw);
} catch (err) {
  throw new Error("LLM did not return valid JSON: " + planRaw);
}

for (const step of plan) {
  console.log(`Calling tool: ${step.tool}`, step.args);
  const result = await client.callTool({
    name: step.tool,
    arguments: step.args,
  });
  console.log("Tool result:", result);
}
