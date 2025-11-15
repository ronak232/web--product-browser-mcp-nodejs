import express from "express";
import { callMCPClient } from "../src/tools/agentTool.js";

const router = express.Router();

router.post("/api/get", async (req, res) => {
  const { query } = req.body;
  console.log(`Received API request for query: "${query}"`);

  if (!query || typeof query !== "string") {
    return res
      .status(400)
      .json({ success: false, message: "Query is required." });
  }

  try {
    const data = await callMCPClient(query);
    console.log("Successfully retrieved data, sending to client.");
    return res.json({ success: true, data });
  } catch (err: any) {
    console.error("API route error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: err.message || "Server error." });
  }
});

export default router;
