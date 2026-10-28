const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const symbols = { Security: "⌘", Creative: "✳", Tools: "⌁", Design: "◈", Web: "↗" };
let allProjects = [];
let activeFilter = "All";

$("#year").textContent = new Date().getFullYear();

const menuToggle = $("#menuToggle");
const nav = $("#nav");
menuToggle.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(open));
});
$$("nav a").forEach(link => link.addEventListener("click", () => {
  nav.classList.remove("open");
  menuToggle.setAttribute("aria-expanded", "false");
}));

const glow = $(".cursor-glow");
window.addEventListener("pointermove", event => {
  if (glow) { glow.style.left = `${event.clientX}px`; glow.style.top = `${event.clientY}px`; }
}, { passive: true });

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });
function observeReveals() { $$(".reveal:not(.visible)").forEach(el => observer.observe(el)); }
observeReveals();

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
}
function projectCard(project, index) {
  const card = document.createElement("article");
  card.className = "project-card";
  const visual = document.createElement("div");
  visual.className = "project-visual";
  const indexEl = document.createElement("span");
  indexEl.className = "project-index";
  indexEl.textContent = `PROJECT / ${String(index + 1).padStart(2, "0")}`;
  const category = document.createElement("span");
  category.className = "project-category";
  category.textContent = (project.category || "Project").toUpperCase();
  const symbol = document.createElement("span");
  symbol.className = "project-symbol";
  symbol.textContent = symbols[project.category] || "✳";
  visual.append(indexEl, category, symbol);
  const body = document.createElement("div");
  body.className = "project-body";
  const title = document.createElement("h3");
  title.textContent = project.title;
  const description = document.createElement("p");
  description.textContent = project.description;
  const stack = document.createElement("div");
  stack.className = "stack-list";
  (project.stack || []).forEach(item => {
    const chip = document.createElement("span");
    chip.textContent = item;
    stack.append(chip);
  });
  const links = document.createElement("div");
  links.className = "project-links";
  const demo = safeUrl(project.demo);
  const source = safeUrl(project.source);
  if (demo) {
    const a = document.createElement("a"); a.href = demo; a.target = "_blank"; a.rel = "noopener noreferrer"; a.textContent = "Live demo ↗"; links.append(a);
  }
  if (source) {
    const a = document.createElement("a"); a.href = source; a.target = "_blank"; a.rel = "noopener noreferrer"; a.textContent = "Source code ↗"; links.append(a);
  }
  if (!demo && !source) {
    const label = document.createElement("span"); label.textContent = "Case study in progress"; label.style.cssText = "font-size:10px;color:#81788f"; links.append(label);
  }
  body.append(title, description, stack, links);
  card.append(visual, body);
  return card;
}
function renderProjects() {
  const grid = $("#projectGrid");
  grid.replaceChildren();
  const filtered = activeFilter === "All" ? allProjects : allProjects.filter(p => p.category === activeFilter);
  if (!filtered.length) {
    const empty = document.createElement("div"); empty.className = "loading-card"; empty.textContent = "No projects in this category yet."; grid.append(empty); return;
  }
  filtered.forEach((project, index) => grid.append(projectCard(project, index)));
  const allButton = $('[data-filter="All"]');
  if (allButton) allButton.innerHTML = `All projects <span>${String(allProjects.length).padStart(2, "0")}</span>`;
}
async function loadProjects() {
  try {
    const response = await fetch("/api/projects");
    if (!response.ok) throw new Error("Unable to load projects");
const result = await response.json();
allProjects = Array.isArray(result) ? result : (result.projects || []);
    renderProjects();
  } catch {
    const grid = $("#projectGrid");
    grid.replaceChildren();
    const error = document.createElement("div"); error.className = "loading-card"; error.textContent = "Projects could not load. Please refresh in a moment."; grid.append(error);
  }
}
$("#filters").addEventListener("click", event => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  activeFilter = button.dataset.filter;
  $$(".filter").forEach(item => item.classList.toggle("active", item === button));
  renderProjects();
});
loadProjects();

$("#contactForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = $("#formStatus");
  const button = $(".submit-button", form);
  status.classList.remove("error");
  status.textContent = "Sending your message...";
  button.disabled = true;
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Message could not be sent.");
    status.textContent = result.message || "Message received. Thank you!";
    form.reset();
  } catch (error) {
    status.classList.add("error");
    status.textContent = error.message || "Something went wrong. Please try again.";
  } finally {
    button.disabled = false;
  }
});
