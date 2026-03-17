const express = require("express");
const Database = require("better-sqlite3");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const AUTH_PIN = process.env.AUTH_PIN || "spartan2025";

// ── Database Setup ───────────────────────────────────────────────────────────
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "spartan.db");
const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    current_week INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS week_day_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week INTEGER NOT NULL,
    day_index INTEGER NOT NULL,
    checked TEXT NOT NULL DEFAULT '{}',
    log_data TEXT NOT NULL DEFAULT '{}',
    amrap_rounds TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(week, day_index)
  );
  INSERT OR IGNORE INTO app_state (id, current_week) VALUES (1, 1);
`);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Serve static client files in production
const clientDist = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
}

// Simple PIN auth
const auth = (req, res, next) => {
  const pin = req.headers["x-auth-pin"] || req.query.pin;
  if (pin !== AUTH_PIN) {
    return res.status(401).json({ error: "Invalid PIN" });
  }
  next();
};

// ── API Routes ───────────────────────────────────────────────────────────────

// GET /api/state — Load full app state
app.get("/api/state", auth, (req, res) => {
  try {
    const state = db.prepare("SELECT current_week FROM app_state WHERE id = 1").get();
    const logs = db.prepare("SELECT week, day_index, checked, log_data, amrap_rounds FROM week_day_log ORDER BY week, day_index").all();

    const data = {};
    for (const log of logs) {
      if (!data[log.week]) data[log.week] = {};
      data[log.week][log.day_index] = {
        ck: JSON.parse(log.checked),
        lg: JSON.parse(log.log_data),
        ar: JSON.parse(log.amrap_rounds),
      };
    }

    res.json({
      week: state?.current_week || 1,
      data,
    });
  } catch (e) {
    console.error("GET /api/state error:", e);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/state — Save full app state (bulk)
app.put("/api/state", auth, (req, res) => {
  try {
    const { week, data } = req.body;
    if (!week || !data) return res.status(400).json({ error: "Missing week or data" });

    const updateWeek = db.prepare("UPDATE app_state SET current_week = ?, updated_at = datetime('now') WHERE id = 1");
    const upsertLog = db.prepare(`
      INSERT INTO week_day_log (week, day_index, checked, log_data, amrap_rounds, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(week, day_index) DO UPDATE SET
        checked = excluded.checked,
        log_data = excluded.log_data,
        amrap_rounds = excluded.amrap_rounds,
        updated_at = datetime('now')
    `);

    const saveAll = db.transaction(() => {
      updateWeek.run(week);
      for (const [wk, days] of Object.entries(data)) {
        for (const [di, dayLog] of Object.entries(days)) {
          upsertLog.run(
            Number(wk),
            Number(di),
            JSON.stringify(dayLog.ck || {}),
            JSON.stringify(dayLog.lg || {}),
            JSON.stringify(dayLog.ar || {})
          );
        }
      }
    });

    saveAll();
    res.json({ ok: true, saved: new Date().toISOString() });
  } catch (e) {
    console.error("PUT /api/state error:", e);
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/day — Save a single day's log (for real-time saves)
app.patch("/api/day", auth, (req, res) => {
  try {
    const { week, day_index, checked, log_data, amrap_rounds } = req.body;
    if (week == null || day_index == null) {
      return res.status(400).json({ error: "Missing week or day_index" });
    }

    const upsert = db.prepare(`
      INSERT INTO week_day_log (week, day_index, checked, log_data, amrap_rounds, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(week, day_index) DO UPDATE SET
        checked = excluded.checked,
        log_data = excluded.log_data,
        amrap_rounds = excluded.amrap_rounds,
        updated_at = datetime('now')
    `);

    upsert.run(
      week,
      day_index,
      JSON.stringify(checked || {}),
      JSON.stringify(log_data || {}),
      JSON.stringify(amrap_rounds || {})
    );

    // Also update current week
    db.prepare("UPDATE app_state SET current_week = ?, updated_at = datetime('now') WHERE id = 1").run(week);

    res.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/day error:", e);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/week — Set current week
app.put("/api/week", auth, (req, res) => {
  try {
    const { week } = req.body;
    db.prepare("UPDATE app_state SET current_week = ?, updated_at = datetime('now') WHERE id = 1").run(week);
    res.json({ ok: true, week });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/state — Reset everything
app.delete("/api/state", auth, (req, res) => {
  try {
    db.prepare("DELETE FROM week_day_log").run();
    db.prepare("UPDATE app_state SET current_week = 1, updated_at = datetime('now') WHERE id = 1").run();
    res.json({ ok: true, reset: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/seed — Seed with Week 1 data
app.post("/api/seed", auth, (req, res) => {
  try {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: "Missing data" });

    const upsert = db.prepare(`
      INSERT INTO week_day_log (week, day_index, checked, log_data, amrap_rounds, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(week, day_index) DO UPDATE SET
        checked = excluded.checked,
        log_data = excluded.log_data,
        amrap_rounds = excluded.amrap_rounds,
        updated_at = datetime('now')
    `);

    const seedAll = db.transaction(() => {
      for (const [wk, days] of Object.entries(data)) {
        for (const [di, dayLog] of Object.entries(days)) {
          upsert.run(
            Number(wk),
            Number(di),
            JSON.stringify(dayLog.ck || {}),
            JSON.stringify(dayLog.lg || {}),
            JSON.stringify(dayLog.ar || {})
          );
        }
      }
    });

    seedAll();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// SPA fallback — serve index.html for all non-API routes
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "Not found" });
  }
  const indexPath = path.join(clientDist, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send("Run 'npm run build:client' first, or use dev mode.");
  }
});

app.listen(PORT, () => {
  console.log(`🔥 Spartan Training App running on port ${PORT}`);
  console.log(`   PIN: ${AUTH_PIN}`);
  console.log(`   DB: ${DB_PATH}`);
});
