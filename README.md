## WorkRadius Collaborative Editor

A production-ready, real-time collaborative editor with AI assistance built for the WorkRadius SDE Intern assignment. The stack combines React + Vite, TailwindCSS, Express, MongoDB, Socket.io, and Google Gemini to deliver authenticated document management, live presence, autosave, and contextual writing help.

### Highlights
- Secure JWT authentication with httpOnly cookies, refresh tokens, and role-based access (owner/editor/viewer)
- Document CRUD with sharing, autosave (30s), and granular permissions enforced on both API and websocket layers
- Real-time text synchronization, cursor broadcasting, and presence tracking powered by Socket.io
- Gemini-powered AI toolkit with grammar, enhancement, summary, completion, and suggestion endpoints
- Hardened Express API (helmet, rate limits, validation, sanitization), structured logging, and centralized error handling
- Dockerized frontend, backend, MongoDB, and Nginx reverse proxy ready for EC2 + PM2 deployment

---

## Project Structure

```
.
├── client/                 # React + Vite frontend
├── server/                 # Express + MongoDB backend
├── docker-compose.yml      # Local orchestration
├── nginx.conf              # Reverse proxy config
├── ecosystem.config.js     # PM2 process definitions
└── LEARNING.md             # Reflection and future work
```

Key frontend modules live under `client/src/{components,hooks,services}` and backend logic is grouped into `server/{routes,services,middleware,websockets}`.

---

## Environment Variables

Create `server/.env` (use `server/env.sample` as a template):

| Variable | Description |
| --- | --- |
| `PORT` | API port (default 5000) |
| `MONGO_URI` / `MONGO_DB_NAME` | MongoDB connection info |
| `CLIENT_URL` | Comma-separated list of allowed origins (frontends) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Strong secrets for tokens |
| `JWT_ACCESS_EXPIRES` / `JWT_REFRESH_EXPIRES` | e.g. `45m`, `7d` |
| `GEMINI_API_KEY` | Google Gemini API key |
| `GEMINI_MODEL` | Model name (default `gemini-1.5-flash`) |

Frontend build-time variables (set via `.env` or CI):

| Variable | Description |
| --- | --- |
| `VITE_API_URL` | Base REST endpoint, e.g. `https://api.example.com/api/v1` |
| `VITE_SOCKET_URL` | Socket.io endpoint, e.g. `https://api.example.com` |

---

## Local Development

1. **Backend**
   ```bash
   cd server
   cp env.sample .env
   npm install
   npm run dev
   ```
2. **Frontend**
   ```bash
   cd client
   npm install
   npm run dev
   ```
3. Visit `http://localhost:5173` — requests and sockets proxy to `http://localhost:5000`.

---

## Dockerized Setup

```bash
docker compose up --build
```

Services:
- `mongo`: MongoDB 7.x with persistent volume `mongo-data`
- `server`: Express API on port 5000
- `client`: Static build served by Nginx
- `proxy`: Public-facing Nginx forwarding `/api` and `/socket.io`

Once running, hit `http://localhost` for the UI and `/api/v1/*` for the API (proxied).

---

## AI Assistant Configuration

1. Enable the Gemini API in Google Cloud and generate an API key.
2. Set `GEMINI_API_KEY` and (optionally) `GEMINI_MODEL`.
3. Each AI endpoint (`/grammar-check`, `/enhance`, `/summarize`, `/complete`, `/suggestions`) validates input, forwards the prompt via `@google/generative-ai`, and returns trimmed text. Failures degrade gracefully with user-friendly messaging.

---

## Deployment on AWS EC2 (Ubuntu)

1. **Provision VM & install tooling**
   ```bash
   sudo apt update && sudo apt install -y nginx docker.io docker-compose git nodejs npm
   sudo npm install -g pm2
   ```
2. **Clone repo & set env**
   ```bash
   git clone <repo> workradius
   cd workradius
   cp server/env.sample server/.env   # fill secrets & DB URI
   ```
3. **Build artifacts**
   ```bash
   (cd client && npm install && npm run build)
   (cd server && npm install)
   ```
4. **Run with PM2**
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   ```
5. **Nginx reverse proxy**
   - Copy `nginx.conf` to `/etc/nginx/sites-available/workradius`
   - Symlink into `sites-enabled` and reload: `sudo nginx -t && sudo systemctl reload nginx`
6. **SSL (Let’s Encrypt)**
   ```bash
   sudo certbot --nginx -d editor.example.com -d api.example.com
   ```

For container-based deployment on EC2, ship `docker-compose.yml` and run `docker compose up -d`. Attach an Application Load Balancer or configure security groups to expose 80/443 only.

---

## Testing & Hardening

- **Linting**: `npm run lint` (client) / placeholder script on server
- **Rate limits**: `/api/v1/auth/*` capped at 20 req/15min, global API at 200 rpm
- **Validation**: `express-validator` plus custom middleware ensures clean payloads
- **Sanitization**: helmet, `express-mongo-sanitize`, `hpp`, `xss-clean`, compression
- **Logging**: Winston JSON logs for API + socket lifecycle

---

## Realtime & Autosave Flow

1. User opens a doc → REST check for permission, content fetched.
2. Socket connects with auth metadata → server verifies permission before joining room.
3. `text-change` emits deltas + HTML snapshot to peers; server persists content (with optimistic UI feedback).
4. Autosave loop hits `/documents/:id` every 30s with `autosave` flag for redundancy.
5. Presence, cursor, and join/leave events keep participants panel updated.

---

## Useful Commands

| Purpose | Command |
| --- | --- |
| Seed dependencies | `npm install` (both `client` and `server`) |
| Dev servers | `npm run dev` |
| Production build | `cd client && npm run build` |
| Run API in prod | `cd server && npm start` |
| PM2 control | `pm2 start ecosystem.config.js`, `pm2 logs`, `pm2 restart all` |
| Docker cleanup | `docker compose down -v` |

---

## Troubleshooting

- **Cookies missing in dev**: ensure frontend hits the backend via the Vite proxy (`/api`) so the same origin is respected, or run both over HTTPS and set `CLIENT_URL` accordingly.
- **Gemini quota**: responses will degrade to friendly fallbacks; monitor Google Cloud usage.
- **Websocket blocked**: open ports 80/443 (or 5000) in security groups and verify Nginx `Upgrade` headers.

---

Happy collaborating! 🎉

