
require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "127.0.0.1";

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = path.join(ROOT_DIR, "data");
const PROJECTS_FILE = path.join(DATA_DIR, "projects.json");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "Jawad";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;

fs.mkdirSync(DATA_DIR, { recursive: true });

function readJSON(file, fallback) {
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
      return fallback;
    }

    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    console.error(
      `Could not read ${path.basename(file)}:`,
      error.message
    );
    return fallback;
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const defaultProjects = [
  {
    id: "project-1",
    title: "Jawad Real Terminal",
    description: "A controlled terminal-style web application.",
    category: "Development",
    stack: ["JavaScript", "Node.js", "Express"],
    link: "https://github.com/xtjawad1122-sys/jawad-real-terminal",
    featured: true
  },
  {
    id: "project-2",
    title: "Ultra Portfolio",
    description: "A modern portfolio built with web technologies.",
    category: "Web Design",
    stack: ["HTML", "CSS", "JavaScript"],
    link: "#",
    featured: true
  }
];

if (!fs.existsSync(PROJECTS_FILE)) {
  writeJSON(PROJECTS_FILE, defaultProjects);
}

if (!fs.existsSync(MESSAGES_FILE)) {
  writeJSON(MESSAGES_FILE, []);
}

app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));

if (!ADMIN_PASSWORD || !SESSION_SECRET) {
  console.warn(
    "WARNING: Set ADMIN_PASSWORD and SESSION_SECRET in your .env file."
  );
}

app.use(
  session({
    name: "jawad.sid",
    secret: SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 1000
    }
  })
);

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }

  return res.status(401).json({
    success: false,
    error: "Please log in as admin first."
  });
}

function validText(value, maxLength) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= maxLength
  );
}

function saveJSONResponse(res, file, data, message) {
  try {
    writeJSON(file, data);
    return res.json({ success: true, message });
  } catch (error) {
    console.error("Could not save data:", error.message);

    return res.status(500).json({
      success: false,
      error: "Could not save data. Please try again."
    });
  }
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Jawad Ultra Portfolio backend is running."
  });
});

// Public projects
app.get("/api/projects", (req, res) => {
  const projects = readJSON(PROJECTS_FILE, defaultProjects);
  res.json({ success: true, projects });
});

// Contact form
app.post("/api/contact", (req, res) => {
  const { name, email, subject = "", message } = req.body || {};

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

  const messages = readJSON(MESSAGES_FILE, []);

  messages.push({
    id: crypto.randomUUID(),
    name: name.trim(),
    email: email.trim(),
    subject: subject.trim(),
    message: message.trim(),
    read: false,
    createdAt: new Date().toISOString()
  });

  try {
    writeJSON(MESSAGES_FILE, messages);

    return res.status(201).json({
      success: true,
      message: "Your message has been received. Thank you!"
    });
  } catch (error) {
    console.error("Could not save contact message:", error.message);

    return res.status(500).json({
      success: false,
      error: "Could not save your message."
    });
  }
});

// Check admin session
app.get("/api/admin/me", requireAdmin, (req, res) => {
  res.json({ success: true, username: ADMIN_USERNAME });
});

// Admin login
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body || {};

  if (!ADMIN_PASSWORD || !SESSION_SECRET) {
    return res.status(503).json({
      success: false,
      error: "Admin is not configured. Check your .env file."
    });
  }

  const usernameMatches =
    typeof username === "string" &&
    username.trim() === ADMIN_USERNAME.trim();

  const passwordMatches =
    typeof password === "string" &&
    password === ADMIN_PASSWORD;

  // Safe diagnostics: never print the actual password.
  console.log("Admin username matched:", usernameMatches);
  console.log("Admin password matched:", passwordMatches);

  if (!usernameMatches || !passwordMatches) {
    return res.status(401).json({
      success: false,
      error: "Incorrect username or password."
    });
  }

  req.session.regenerate((error) => {
    if (error) {
      console.error("Session regeneration failed:", error.message);

      return res.status(500).json({
        success: false,
        error: "Could not start admin session."
      });
    }

    req.session.isAdmin = true;

    req.session.save((saveError) => {
      if (saveError) {
        console.error("Session save failed:", saveError.message);

        return res.status(500).json({
          success: false,
          error: "Could not save admin session."
        });
      }

      return res.json({
        success: true,
        message: "Admin login successful."
      });
    });
  });
});

// Admin logout
app.post("/api/admin/logout", (req, res) => {
  if (!req.session) {
    res.clearCookie("jawad.sid");
    return res.json({ success: true, message: "Logged out." });
  }

  req.session.destroy((error) => {
    res.clearCookie("jawad.sid");

    if (error) {
      return res.status(500).json({
        success: false,
        error: "Could not log out."
      });
    }

    return res.json({
      success: true,
      message: "Logged out successfully."
    });
  });
});

// Read contact messages
app.get("/api/admin/messages", requireAdmin, (req, res) => {
  const messages = readJSON(MESSAGES_FILE, []);

  res.json({
    success: true,
    messages: messages.slice().reverse()
  });
});

// Mark message read or unread
app.patch("/api/admin/messages/:id", requireAdmin, (req, res) => {
  const { read } = req.body || {};

  if (typeof read !== "boolean") {
    return res.status(400).json({
      success: false,
      error: "The read value must be true or false."
    });
  }

  const messages = readJSON(MESSAGES_FILE, []);
  const message = messages.find(
    (item) => item.id === req.params.id
  );

  if (!message) {
    return res.status(404).json({
      success: false,
      error: "Message not found."
    });
  }

  message.read = read;

  return saveJSONResponse(
    res,
    MESSAGES_FILE,
    messages,
    "Message updated."
  );
});

// Delete contact message
app.delete("/api/admin/messages/:id", requireAdmin, (req, res) => {
  const messages = readJSON(MESSAGES_FILE, []);

  const updatedMessages = messages.filter(
    (item) => item.id !== req.params.id
  );

  if (updatedMessages.length === messages.length) {
    return res.status(404).json({
      success: false,
      error: "Message not found."
    });
  }

  return saveJSONResponse(
    res,
    MESSAGES_FILE,
    updatedMessages,
    "Message deleted."
  );
});

// Add project
app.post("/api/admin/projects", requireAdmin, (req, res) => {
  const {
    title,
    description,
    category,
    link = "#",
    stack = [],
    featured = false
  } = req.body || {};

  if (
    !validText(title, 100) ||
    !validText(description, 500) ||
    !validText(category, 60) ||
    typeof link !== "string" ||
    link.length > 500 ||
    !Array.isArray(stack) ||
    !stack.every(
      (item) => typeof item === "string" && item.length <= 60
    )
  ) {
    return res.status(400).json({
      success: false,
      error: "Please enter valid project details."
    });
  }

  const cleanLink = link.trim();

  if (
    cleanLink &&
    cleanLink !== "#" &&
    !/^https?:\/\/[^\s]+$/i.test(cleanLink)
  ) {
    return res.status(400).json({
      success: false,
      error: "Project link must start with http:// or https://."
    });
  }

  const projects = readJSON(PROJECTS_FILE, defaultProjects);

  const project = {
    id: crypto.randomUUID(),
    title: title.trim(),
    description: description.trim(),
    category: category.trim(),
    link: cleanLink || "#",
    stack: stack.map((item) => item.trim()).filter(Boolean),
    featured: Boolean(featured)
  };

  projects.push(project);

  try {
    writeJSON(PROJECTS_FILE, projects);
    return res.status(201).json({ success: true, project });
  } catch (error) {
    console.error("Could not save project:", error.message);

    return res.status(500).json({
      success: false,
      error: "Could not save project."
    });
  }
});

// Delete project
app.delete("/api/admin/projects/:id", requireAdmin, (req, res) => {
  const projects = readJSON(PROJECTS_FILE, defaultProjects);

  const updatedProjects = projects.filter(
    (project) => project.id !== req.params.id
  );

  if (updatedProjects.length === projects.length) {
    return res.status(404).json({
      success: false,
      error: "Project not found."
    });
  }

  return saveJSONResponse(
    res,
    PROJECTS_FILE,
    updatedProjects,
    "Project deleted."
  );
});

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

app.listen(PORT, HOST, () => {
  console.log(`Jawad Ultra Portfolio running at http://${HOST}:${PORT}`);
  console.log(`Website folder: ${PUBLIC_DIR}`);
  console.log("Admin username:", ADMIN_USERNAME);
  console.log("Admin password configured:", Boolean(ADMIN_PASSWORD));
  console.log("Session secret configured:", Boolean(SESSION_SECRET));
});
