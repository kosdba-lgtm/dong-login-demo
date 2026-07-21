const path = require("path");
const dotenv = require("dotenv");
const express = require("express");
const { Pool } = require("pg");
const bodyParser = require("body-parser");

const envPath = path.join(__dirname, ".env");
const envResult = dotenv.config({ path: envPath });
if (envResult.error) {
  if (envResult.error.code !== "ENOENT") {
    console.warn("Could not load .env file:", envResult.error.message);
  }
} else {
  console.log("Loaded .env:", envResult.parsed);
}

const app = express();
const port = process.env.PORT || 3000;

const databaseUrl = process.env.DATABASE_URL || null;
console.log("Using DATABASE_URL:", databaseUrl ? databaseUrl.slice(0, 40) + "..." : "<unset>");

const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
    })
  : null;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required." });
  }

  if (!pool) {
    return res.status(500).json({ success: false, message: "DATABASE_URL is not configured." });
  }

  try {
    const query = "SELECT id, email, name FROM users WHERE email = $1 AND password = $2 LIMIT 1";
    const values = [email.trim().toLowerCase(), password];
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    return res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ success: false, message: "Database error." });
  }
});

app.post("/api/signup", async (req, res) => {
  const { email, password, name } = req.body || {};

  if (!email || !password || !name) {
    return res.status(400).json({ success: false, message: "Name, email, and password are required." });
  }

  if (!pool) {
    return res.status(500).json({ success: false, message: "DATABASE_URL is not configured." });
  }

  try {
    const insertQuery = "INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name";
    const values = [email.trim().toLowerCase(), password, name.trim()];
    const result = await pool.query(insertQuery, values);

    return res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error("Signup error:", error);

    if (error.code === "23505") {
      return res.status(409).json({ success: false, message: "A user with that email already exists." });
    }

    return res.status(500).json({ success: false, message: "Database error." });
  }
});

app.get("/healthz", async (req, res) => {
  if (!pool) {
    return res.status(500).send("DB_NOT_CONFIGURED");
  }

  try {
    await pool.query("SELECT 1");
    res.send("OK");
  } catch (error) {
    console.error("Health check DB error:", error);
    res.status(500).send("DB_CONNECTION_ERROR");
  }
});

const startServer = async () => {
  if (!databaseUrl) {
    console.warn("Warning: DATABASE_URL is not set. Set it in Railway or with an environment variable.");
  }

  if (pool) {
    pool.on("error", (err) => {
      console.error("Postgres pool error:", err);
    });

    try {
      await pool.query("SELECT 1");
      console.log("Database connected successfully.");
    } catch (error) {
      console.error("Database startup connection error:", error);
    }
  }

  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
};

startServer();
