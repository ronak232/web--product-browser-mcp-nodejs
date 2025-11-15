// agent.ts
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { ModelMCP } from "../../service/LlmMcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

export async function callMCPClient(query: string) {
  const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
  const transport = new StdioClientTransport({
    command: npxCmd,
    args: ["tsx", "src/tools/fetchServer.ts"],
  });

  const client = new Client({
    name: "client-scraper",
    version: "1.0.0",
  });
  await client.connect(transport);

  const llm = new ModelMCP({
    model: "openai/gpt-oss-120b",
    apikey: process.env.GROQ_API_KEY || "",
  });

  const planRaw = await llm.run(query);
  console.log("LLM plan raw:", planRaw);

  let plan: { tool: string; args: any }[];
  let finalResult: any = null;
  try {
    plan = JSON.parse(planRaw);
    for (const step of plan) {
      console.log(`Calling tool: ${step.tool}`, step.args);
      const result: any = await client.callTool({
        name: step.tool,
        arguments: step.args,
      });
      console.log("Tool result:", result);
      if (result.content && result.content[0]?.type === "text") {
        finalResult = JSON.parse(result.content[0].text);
      } else {
        // Fallback if the structure is different
        finalResult = result.content;
      }
    }
  } catch (err) {
    console.error("Error in agentTool:", err);
    // Ensure client is disconnected even on error
    await transport.close();
    throw new Error("Failed to execute tool plan. Check logs for details.");
  } finally {
    await transport.close();
  }
  return finalResult;
}
