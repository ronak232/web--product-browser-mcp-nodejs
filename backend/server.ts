import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import http from "http"

const httpServer = http.createServer();
const app = express.Router();

app.use("/", routes)
app.use("/", )