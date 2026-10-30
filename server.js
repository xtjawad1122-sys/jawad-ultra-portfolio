require("dotenv").config();

const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const rateLimit = require("express-rate-limit");

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "Jawad";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase environment variables.");
}

if (!ADMIN_PASSWORD || !SESSION_SECRET) {
  console.error("Missing admin environment variables.");
}

const supabase = createClient(
  SUPABASE_URL || "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY || "missing-key"
);

app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));

const isProduction = process.env.NODE_ENV === "production";
const COOKIE_NAME = "jawad_admin";
const SESSION_DURATION = 60 * 60;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many login attempts. Try again later."
  }
});

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many messages. Please try again later."
  }
});

function validText(value, maxLength) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= maxLength
  );
}

function createToken(username) {
  const payload = Buffer.from(
    JSON.stringify({
      username,
      expires: Date.now() + SESSION_DURATION * 1000
    })
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

function verifyToken(token) {
  if (!token || !SESSION_SECRET) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;

  const expected = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("base64url");

  const suppliedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    );

    if (
      data.username !== ADMIN_USERNAME ||
      !Number.isFinite(data.expires) ||
      data.expires < Date.now()
    ) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

function getCookie(req, name) {
  const cookieHeader = req.headers.cookie || "";

  for (const item of cookieHeader.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;

    const key = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();

    if (key === name) {
      try {
        return decodeURIComponent(value);
      } catch {
        return "";
      }
    }
  }

  return "";
}

function setAdminCookie(res, token) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_DURATION}`
  ];

  if (isProduction) parts.push("Secure");

  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearAdminCookie(res) {
  const parts = [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0"
  ];

  if (isProduction) parts.push("Secure");

  res.setHeader("Set-Cookie", parts.join("; "));
}

function requireAdmin(req, res, next) {
  const token = getCookie(req, COOKIE_NAME);
  const session = verifyToken(token);

  if (!session) {
    return res.status(401).json({
      success: false,
      error: "Please log in as admin first."
    });
  }

  req.admin = session;
  next();
}

function sendDatabaseError(res, error, message) {
  console.error(message, error?.message || error);

  return res.status(500).json({
    success: false,
    error: message
  });
}

function mapProject(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    stack: Array.isArray(row.stack) ? row.stack : [],
    demo: row.demo || "",
    source: row.source || "",
    featured: Boolean(row.featured)
  };
}

function mapMessage(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    subject: row.subject || "",
    message: row.message,
    read: Boolean(row.read),
    createdAt: row.created_at
  };
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Jawad Ultra Portfolio backend is running."
  });
});

// Public projects
app.get("/api/projects", async (req, res) => {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return sendDatabaseError(
      res,
      error,
      "Could not load projects."
    );
  }

  return res.json({
    success: true,
    projects: (data || []).map(mapProject)
  });
});

// Contact form
app.post("/api/contact", contactLimiter, async (req, res) => {
  const {
    name,
    email,
    subject = "",
    message
  } = req.body || {};

  if (
    !validText(name, 80) ||
    !validText(email, 254) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    !validText(message, 3000) ||
    typeof subject !== "string" ||
    subject.length > 150
  ) {
    return res.status(400).json({
      success: false,
      error: "Please provide a valid name, email, and message."
    });
  }

  const { error } = await supabase
    .from("messages")
    .insert({
      name: name.trim(),
      email: email.trim(),
      subject: subject.trim(),
      message: message.trim()
    });

  if (error) {
    return sendDatabaseError(
      res,
      error,
      "Could not save your message."
    );
  }

  return res.status(201).json({
    success: true,
    message: "Your message has been received. Thank you!"
  });
});

// Check admin session
app.get("/api/admin/me", requireAdmin, (req, res) => {
  res.json({
    success: true,
    username: ADMIN_USERNAME
  });
});

// Admin login
app.post("/api/admin/login", loginLimiter, (req, res) => {
  const { username, password } = req.body || {};

  if (!ADMIN_PASSWORD || !SESSION_SECRET) {
    return res.status(503).json({
      success: false,
      error: "Admin is not configured."
    });
  }

  const usernameMatches =
    typeof username === "string" &&
    username.trim() === ADMIN_USERNAME.trim();

  const passwordMatches =
    typeof password === "string" &&
    password === ADMIN_PASSWORD;

  if (!usernameMatches || !passwordMatches) {
    return res.status(401).json({
      success: false,
      error: "Incorrect username or password."
    });
  }

  const token = createToken(ADMIN_USERNAME);
  setAdminCookie(res, token);

  return res.json({
    success: true,
    message: "Admin login successful."
  });
});

// Admin logout
app.post("/api/admin/logout", (req, res) => {
  clearAdminCookie(res);

  return res.json({
    success: true,
    message: "Logged out successfully."
  });
});

// Read contact messages
app.get(
  "/api/admin/messages",
  requireAdmin,
  async (req, res) => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return sendDatabaseError(
        res,
        error,
        "Could not load messages."
      );
    }

    return res.json({
      success: true,
      messages: (data || []).map(mapMessage)
    });
  }
);

// Mark message read or unread
app.patch(
  "/api/admin/messages/:id",
  requireAdmin,
  async (req, res) => {
    const { read } = req.body || {};

    if (typeof read !== "boolean") {
      return res.status(400).json({
        success: false,
        error: "The read value must be true or false."
      });
    }

    const { data, error } = await supabase
      .from("messages")
      .update({ read })
      .eq("id", req.params.id)
      .select("id")
      .maybeSingle();

    if (error) {
      return sendDatabaseError(
        res,
        error,
        "Could not update message."
      );
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: "Message not found."
      });
    }

    return res.json({
      success: true,
      message: "Message updated."
    });
  }
);

// Delete contact message
app.delete(
  "/api/admin/messages/:id",
  requireAdmin,
  async (req, res) => {
    const { data, error } = await supabase
      .from("messages")
      .delete()
      .eq("id", req.params.id)
      .select("id")
      .maybeSingle();

    if (error) {
      return sendDatabaseError(
        res,
        error,
        "Could not delete message."
      );
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: "Message not found."
      });
    }

    return res.json({
      success: true,
      message: "Message deleted."
    });
  }
);

// Add project
app.post(
  "/api/admin/projects",
  requireAdmin,
  async (req, res) => {
    const {
      title,
      description,
      category,
      demo = "",
      source = "",
      stack = [],
      featured = false
    } = req.body || {};

    if (
      !validText(title, 100) ||
      !validText(description, 500) ||
      !validText(category, 60) ||
      typeof demo !== "string" ||
      demo.length > 500 ||
      typeof source !== "string" ||
      source.length > 500 ||
      !Array.isArray(stack) ||
      !stack.every(
        (item) =>
          typeof item === "string" &&
          item.trim().length <= 60
      )
    ) {
      return res.status(400).json({
        success: false,
        error: "Please enter valid project details."
      });
    }

    for (const link of [demo.trim(), source.trim()]) {
      if (
        link &&
        !/^https?:\/\/[^\s]+$/i.test(link)
      ) {
        return res.status(400).json({
          success: false,
          error: "Project links must start with http:// or https://."
        });
      }
    }

    const project = {
      id: crypto.randomUUID(),
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      stack: stack
        .map((item) => item.trim())
        .filter(Boolean),
      demo: demo.trim(),
      source: source.trim(),
      featured: Boolean(featured)
    };

    const { data, error } = await supabase
      .from("projects")
      .insert(project)
      .select("*")
      .single();

    if (error) {
      return sendDatabaseError(
        res,
        error,
        "Could not save project."
      );
    }

    return res.status(201).json({
      success: true,
      project: mapProject(data)
    });
  }
);

// Delete project
app.delete(
  "/api/admin/projects/:id",
  requireAdmin,
  async (req, res) => {
    const { data, error } = await supabase
      .from("projects")
      .delete()
      .eq("id", req.params.id)
      .select("id")
      .maybeSingle();

    if (error) {
      return sendDatabaseError(
        res,
        error,
        "Could not delete project."
      );
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: "Project not found."
      });
    }

    return res.json({
      success: true,
      message: "Project deleted."
    });
  }
);

// Serve website files
app.use(express.static(PUBLIC_DIR));

app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "admin.html"));
});

// Unknown route
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Not found."
  });
});

// Local development server
if (require.main === module) {
  app.listen(PORT, "127.0.0.1", () => {
    console.log(
      `Jawad Ultra Portfolio running at http://127.0.0.1:${PORT}`
    );
  });
}

module.exports = app;
