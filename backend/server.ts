import express from "express";
import cors from "cors";
import http from "http";
import route from "./routes/routes";

const allowedOrigins = ["http://localhost:5173", "https://ronak232.github.io"];
const app = express();

// CORS for dev: restrict to Vite origin
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // allow tools like Postman (no origin)
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json()); // body parser

// simple request logger to verify requests reach server
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

app.use("/", route);

const port = Number(process.env.PORT || 5000);
const server = http.createServer(app); // attach express `app` to server

server.listen(port, () => {
  console.log(`app running on http://localhost:${port}`);
});
