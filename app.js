const path = require("path");
const dotenv = require("dotenv");
const express = require("express");
const { Pool } = require("pg");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");

const BCRYPT_SALT_ROUNDS = 10;

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

// Ensure the login_history table exists. Safe to run on every boot.
const ensureSchema = async () => {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS login_history (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      email VARCHAR(255) NOT NULL,
      success BOOLEAN NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_login_history_email ON login_history(email)"
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_login_history_created ON login_history(created_at DESC)"
  );
  console.log("login_history schema is ready.");
};

// Best-effort history write; never let it break the auth flow.
const recordLogin = async ({ userId, email, success }) => {
  if (!pool) return;
  try {
    await pool.query(
      "INSERT INTO login_history (user_id, email, success) VALUES ($1, $2, $3)",
      [userId || null, (email || "").trim().toLowerCase(), !!success]
    );
  } catch (error) {
    console.error("Failed to record login history:", error);
  }
};

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required." });
  }

  if (!pool) {
    return res.status(500).json({ success: false, message: "DATABASE_URL is not configured." });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const query = "SELECT id, email, name, password FROM users WHERE email = $1 LIMIT 1";
    const values = [normalizedEmail];
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      await recordLogin({ userId: null, email: normalizedEmail, success: false });
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      await recordLogin({ userId: user.id, email: normalizedEmail, success: false });
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    await recordLogin({ userId: user.id, email: normalizedEmail, success: true });
    return res.json({ success: true, user: { id: user.id, email: user.email, name: user.name } });
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
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const insertQuery = "INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name";
    const values = [email.trim().toLowerCase(), passwordHash, name.trim()];
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

// Recent login history for a given email (most recent first).
app.get("/api/history", async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ success: false, message: "email query parameter is required." });
  }

  if (!pool) {
    return res.status(500).json({ success: false, message: "DATABASE_URL is not configured." });
  }

  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

  try {
    const result = await pool.query(
      "SELECT id, email, success, created_at FROM login_history WHERE email = $1 ORDER BY created_at DESC LIMIT $2",
      [email.trim().toLowerCase(), limit]
    );

    return res.json({ success: true, history: result.rows });
  } catch (error) {
    console.error("History error:", error);
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
      await ensureSchema();
    } catch (error) {
      console.error("Database startup connection error:", error);
    }
  }

  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
};

startServer();
