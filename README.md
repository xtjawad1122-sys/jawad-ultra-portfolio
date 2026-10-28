# Jawad Ultra Portfolio

A full-stack portfolio starter built with HTML, CSS, JavaScript, Node.js and Express.

## Included
- Responsive dark/purple portfolio landing page
- Animated hero, scroll reveals, mobile navigation and project category filters
- Projects loaded from the backend API
- Contact form with server-side validation, a honeypot field and rate limiting
- Admin sign-in, contact inbox, read/unread and delete actions
- Admin project creation and deletion
- Helmet security headers and HTTP-only session cookie
- JSON-file persistence for easy local setup

## Requirements
- Node.js 20 or newer
- npm (included with Node.js)

## Windows / VS Code setup
1. Extract the project folder.
2. Open VS Code -> File -> Open Folder -> select `jawad-ultra-portfolio`.
3. Open Terminal -> New Terminal.
4. Run `npm install`.
5. Copy `.env.example` to a new file named `.env`.
6. In `.env`, change `SESSION_SECRET` to a long random string and change `ADMIN_PASSWORD` to a strong private password. Do not share or commit `.env`.
7. Run `npm start`.
8. Open `http://localhost:3000` in your browser. Admin page: `http://localhost:3000/admin`.

## Change your portfolio content
- Edit the copy in `public/index.html`.
- Starter projects are in `data/site-data.json`, created on first server start.
- You can also add/delete projects from `/admin`.

## Important production notes
This starter uses JSON-file persistence and Express's default in-memory session store. These are suitable for local development and a small demonstration, but not for a reliable multi-instance production launch. Before a real public launch:
- Use a managed database such as PostgreSQL for messages/projects.
- Use a persistent session store (e.g. Redis or a compatible database store).
- Configure HTTPS, a strong `SESSION_SECRET`, and `NODE_ENV=production`.
- Use a production-ready admin password policy and consider bcrypt-hashed credentials.
- Set up backups, monitoring, and an email provider if you want contact notifications.
- If deploying behind a trusted reverse proxy, configure Express `trust proxy` correctly for secure cookies.
- Never commit `.env` or user messages to a public repository.

## API endpoints
- `GET /api/health`
- `GET /api/projects`
- `POST /api/contact`
- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/me`
- `GET /api/admin/messages`
- `PATCH /api/admin/messages/:id`
- `DELETE /api/admin/messages/:id`
- `POST /api/admin/projects`
- `DELETE /api/admin/projects/:id`

This is a starter implementation, not a security audit. Review and upgrade persistence/authentication before collecting real customer data.
