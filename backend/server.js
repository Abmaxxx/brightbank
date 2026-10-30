const cors = require("cors");
require("dotenv").config();

const express = require("express");
const mysql = require("mysql2/promise");

const app = express();

app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "10kb" }));

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true
});

// Structured logs for troubleshooting
function log(level, message, extra = {}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...extra
  }));
}

// Liveness: confirms the API process is responding.
// Does not depend on MySQL.
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "alive" });
});

// Readiness: checks whether the database is reachable.
app.get("/api/ready", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.status(200).json({
      status: "ready",
      database: "connected"
    });
  } catch (error) {
    log("error", "Readiness check failed", {
      error: error.message
    });

    res.status(503).json({
      status: "not_ready",
      database: "disconnected"
    });
  }
});

// Get account details
app.get("/api/account", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, account_name, balance FROM accounts WHERE id = 1"
    );

    if (!rows.length) {
      return res.status(404).json({
        error: "Account not found"
      });
    }

    res.json(rows[0]);
  } catch (error) {
    log("error", "Could not load account", {
      error: error.message
    });

    res.status(500).json({
      error: "Could not load account"
    });
  }
});

// Get recent transactions
app.get("/api/transactions", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, type, amount, balance_after, created_at
       FROM transactions
       ORDER BY id DESC
       LIMIT 50`
    );

    res.json(rows);
  } catch (error) {
    log("error", "Could not load transactions", {
      error: error.message
    });

    res.status(500).json({
      error: "Could not load transactions"
    });
  }
});

// Shared deposit and withdrawal logic
async function makeTransaction(req, res, type) {
  const rawAmount = req.body?.amount;
  const amountText = String(rawAmount ?? "").trim();

  // Validate amount format
  if (!/^\d+(\.\d{1,2})?$/.test(amountText)) {
    return res.status(400).json({
      error: "Enter a valid amount with at most two decimal places"
    });
  }

  const amount = Number(amountText);

  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 1000000
  ) {
    return res.status(400).json({
      error: "Amount must be greater than zero and no more than 1,000,000"
    });
  }

  let connection;
  let transactionStarted = false;

  try {
    // Connection errors are now caught by this try block.
    connection = await pool.getConnection();

    await connection.beginTransaction();
    transactionStarted = true;

    // Lock the account row during the transaction.
    const [rows] = await connection.query(
      "SELECT balance FROM accounts WHERE id = 1 FOR UPDATE"
    );

    if (!rows.length) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(404).json({
        error: "Account not found"
      });
    }

    const currentBalance = Number(rows[0].balance);

    // Prevent withdrawals exceeding the balance.
    if (type === "WITHDRAWAL" && amount > currentBalance) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        error: "Insufficient balance"
      });
    }

    const newBalance =
      type === "DEPOSIT"
        ? currentBalance + amount
        : currentBalance - amount;

    // Update account balance
    await connection.query(
      "UPDATE accounts SET balance = ? WHERE id = 1",
      [newBalance.toFixed(2)]
    );

    // Record transaction history
    await connection.query(
      `INSERT INTO transactions
       (type, amount, balance_after)
       VALUES (?, ?, ?)`,
      [
        type,
        amount.toFixed(2),
        newBalance.toFixed(2)
      ]
    );

    await connection.commit();
    transactionStarted = false;

    log("info", "Transaction completed", {
      type,
      amount: amount.toFixed(2)
    });

    return res.json({
      message:
        type === "DEPOSIT"
          ? "Deposit successful"
          : "Withdrawal successful",
      balance: newBalance.toFixed(2)
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        log("error", "Transaction rollback failed", {
          error: rollbackError.message
        });
      }
    }

    log("error", "Transaction failed", {
      type,
      error: error.message
    });

    return res.status(500).json({
      error: "Transaction failed"
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// Deposit endpoint
app.post("/api/deposit", (req, res) => {
  makeTransaction(req, res, "DEPOSIT");
});

// Withdrawal endpoint
app.post("/api/withdraw", (req, res) => {
  makeTransaction(req, res, "WITHDRAWAL");
});

// Handle malformed JSON requests
app.use((error, req, res, next) => {
  if (
    error instanceof SyntaxError &&
    error.status === 400 &&
    "body" in error
  ) {
    return res.status(400).json({
      error: "Invalid JSON request body"
    });
  }

  log("error", "Unhandled request error", {
    error: error.message
  });

  return res.status(500).json({
    error: "Internal server error"
  });
});

// Start API (only when run directly, not when imported by tests)
const PORT = Number(process.env.PORT || 5000);
let server;

// Graceful shutdown for Docker
function shutdown(signal) {
  log("info", "Shutting down API", { signal });

  server.close(async () => {
    try {
      await pool.end();
      process.exit(0);
    } catch (error) {
      log("error", "Shutdown failed", { error: error.message });
      process.exit(1);
    }
  });

  setTimeout(() => process.exit(1), 10000).unref();
}

if (require.main === module) {
  server = app.listen(PORT, "0.0.0.0", () => {
    log("info", "BrightBank API started", { port: PORT });
  });

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

module.exports = app;
