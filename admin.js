
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const loginPanel = $("#loginPanel");
const dashboard = $("#dashboard");

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const body =
    response.status === 204
      ? {}
      : await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      body.error || body.message || `Request failed (${response.status}).`
    );
  }

  return body;
}

function showError(element, message) {
  if (!element) return;
  element.classList.add("error");
  element.textContent = message;
}

function showStatus(element, message) {
  if (!element) return;
  element.classList.remove("error");
  element.textContent = message;
}

function textEl(tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text ?? "";

  if (className) {
    element.className = className;
  }

  return element;
}

function showLogin(message = "") {
  if (loginPanel) loginPanel.hidden = false;
  if (dashboard) dashboard.hidden = true;

  if (message) {
    showError($("#loginStatus"), message);
  }
}

function showDashboard() {
  if (loginPanel) loginPanel.hidden = true;
  if (dashboard) dashboard.hidden = false;

  loadMessages();
  loadProjects();
}

async function checkSession() {
  try {
    await api("/api/admin/me");
    showDashboard();
  } catch {
    showLogin();
  }
}

// LOGIN
const loginForm = $("#loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const status = $("#loginStatus");
    showStatus(status, "Signing in...");

    const formData = new FormData(event.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      await api("/api/admin/login", {
        method: "POST",
        body: JSON.stringify(data)
      });

      const form = event.currentTarget;

if (form && typeof form.reset === "function") {
  form.reset();
}

showStatus(status, "");
showDashboard();
      showStatus(status, "");
      showDashboard();
    } catch (error) {
      showError(status, error.message);
    }
  });
}

// LOGOUT
const logoutButton = $("#logoutButton");

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    try {
      await api("/api/admin/logout", {
        method: "POST"
      });
    } catch (error) {
      console.error("Logout error:", error.message);
    } finally {
      showLogin();
    }
  });
}

// DASHBOARD TABS
$$(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    $$(".tab").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    const selectedTab = button.dataset.tab;

    const messagesPanel = $("#messagesPanel");
    const projectsPanel = $("#projectsPanel");

    if (messagesPanel) {
      messagesPanel.hidden = selectedTab !== "messages";
    }

    if (projectsPanel) {
      projectsPanel.hidden = selectedTab !== "projects";
    }
  });
});

// LOAD MESSAGES
async function loadMessages() {
  const list = $("#messagesList");
  if (!list) return;

  list.replaceChildren();

  try {
    const result = await api("/api/admin/messages");
    const messages = Array.isArray(result)
      ? result
      : result.messages || [];

    const unreadCount = messages.filter(
      (message) => !message.read
    ).length;

    const countElement = $("#messageCount");
    if (countElement) {
      countElement.textContent = unreadCount;
    }

    if (messages.length === 0) {
      list.append(
        textEl(
          "div",
          "No messages yet. Messages sent from the public contact form will appear here.",
          "empty"
        )
      );
      return;
    }

    messages.forEach((message) => {
      const card = textEl(
        "article",
        "",
        `message-card${message.read ? "" : " unread"}`
      );

      const top = textEl("div", "", "message-top");
      const identity = document.createElement("div");

      identity.append(
        textEl("strong", message.name || "Unknown"),
        textEl("div", message.email || "", "meta"),
        textEl(
          "div",
          message.createdAt
            ? new Date(message.createdAt).toLocaleString()
            : "",
          "meta"
        )
      );

      top.append(
        identity,
        textEl("small", message.read ? "READ" : "NEW")
      );

      card.append(top);

      if (message.subject) {
        card.append(textEl("h3", message.subject));
      }

      card.append(textEl("p", message.message || ""));

      const actions = textEl("div", "", "message-actions");

      const toggle = textEl(
        "button",
        message.read ? "Mark unread" : "Mark read",
        "secondary"
      );

      toggle.type = "button";

      toggle.addEventListener("click", async () => {
        toggle.disabled = true;

        try {
          await api(
            `/api/admin/messages/${encodeURIComponent(message.id)}`,
            {
              method: "PATCH",
              body: JSON.stringify({
                read: !message.read
              })
            }
          );

          await loadMessages();
        } catch (error) {
          alert(error.message);
          toggle.disabled = false;
        }
      });

      const reply = textEl("a", "Reply by email ↗");
      reply.className = "secondary";
      reply.style.cssText =
        "padding:8px 10px;border-radius:6px;font-size:11px";

      reply.href = `mailto:${encodeURIComponent(
        message.email || ""
      )}?subject=${encodeURIComponent(
        "Re: " + (message.subject || "Your message")
      )}`;

      const del = textEl("button", "Delete", "secondary");
      del.type = "button";

      del.addEventListener("click", async () => {
        if (!confirm("Delete this message?")) return;

        del.disabled = true;

        try {
          await api(
            `/api/admin/messages/${encodeURIComponent(message.id)}`,
            { method: "DELETE" }
          );

          await loadMessages();
        } catch (error) {
          alert(error.message);
          del.disabled = false;
        }
      });

      actions.append(toggle, reply, del);
      card.append(actions);
      list.append(card);
    });
  } catch (error) {
    list.append(textEl("div", error.message, "empty"));
  }
}

const refreshMessages = $("#refreshMessages");

if (refreshMessages) {
  refreshMessages.addEventListener("click", loadMessages);
}

// LOAD PROJECTS
async function loadProjects() {
  const container = $("#adminProjects");
  if (!container) return;

  container.replaceChildren();

  try {
    const result = await api("/api/projects");
    const projects = Array.isArray(result)
      ? result
      : result.projects || [];

    if (projects.length === 0) {
      container.append(textEl("div", "No projects yet.", "empty"));
      return;
    }

    projects.forEach((project) => {
      const card = textEl("article", "", "admin-project");

      const info = document.createElement("div");

      const stack = Array.isArray(project.stack)
        ? project.stack.join(", ")
        : "";

      info.append(
        textEl("strong", project.title || "Untitled project"),
        textEl(
          "p",
          `${project.category || "General"}${stack ? ` · ${stack}` : ""}`
        )
      );

      const del = textEl("button", "Delete project", "secondary");
      del.type = "button";

      del.addEventListener("click", async () => {
        if (!confirm(`Delete "${project.title}"?`)) return;

        del.disabled = true;

        try {
          await api(
            `/api/admin/projects/${encodeURIComponent(project.id)}`,
            { method: "DELETE" }
          );

          await loadProjects();
        } catch (error) {
          alert(error.message);
          del.disabled = false;
        }
      });

      card.append(info, del);
      container.append(card);
    });
  } catch (error) {
    container.append(textEl("div", error.message, "empty"));
  }
}

// ADD PROJECT
const projectForm = $("#projectForm");

if (projectForm) {
  projectForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const status = $("#projectStatus");
    const raw = Object.fromEntries(new FormData(form).entries());

    const payload = {
      ...raw,
      stack: (raw.stack || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      featured: new FormData(form).has("featured")
    };

    showStatus(status, "Adding project...");

    try {
      await api("/api/admin/projects", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      form.reset();
      showStatus(
        status,
        "Project added. Refresh the public portfolio to see it."
      );

      await loadProjects();
    } catch (error) {
      showError(status, error.message);
    }
  });
}

// INITIAL CHECK
checkSession();
