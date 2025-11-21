# Learning Notes

Friendly notes to explain **what** each piece does, **how** it works inside this repo, and **why** it was added so you can answer interview questions quickly.

---

## 1. Product Snapshot
- **Problem solved**: make a Google Docs–style editor where teams can write together, see each other’s cursors, autosave changes, and ask an AI helper for rewrites.
- **Core idea**: React + Vite frontend talks to an Express + MongoDB API. Socket.io keeps every browser in sync, and Gemini powers the AI sidekick.
- **User story**: sign in, create or open a doc from the dashboard, edit in real time with teammates, run AI actions for guidance, share access with owners/editors/viewers.

---

## 2. Tech Stack Map
| Piece | What it is | How we use it | Why it matters |
| --- | --- | --- | --- |
| React + Vite | SPA framework + dev server | Screens under `client/src/components` (`Dashboard.jsx`, `Editor.jsx`, `AIAssistant.jsx`) | Fast dev feedback and modern JSX tooling |
| Tailwind + shadcn/ui | Styling system + ready-made UI pieces | Buttons, cards, inputs keep the UI consistent | Ship a polished UI without writing raw CSS |
| React Router | Client-side routing | Dashboard → `/documents/:id` editor | Keeps URL state in sync with current doc |
| React Query-lite hooks | Custom hooks like `useEditor` | Handle socket status, doc data, autosave | Encapsulates complex logic for reuse |
| Express | REST backend | `server/server.js` wires routes and middleware | Simple, battle-tested HTTP layer |
| MongoDB + Mongoose | Document database | Models for `User`, `Document`, `Permission` | Schemaless flexibility for doc content |
| Socket.io | WebSocket abstraction | `server/websockets/editorSocket.js` + client `useEditor` | Real-time presence, cursor, and doc updates |
| JWT + Cookies | Auth tokens | Access token in httpOnly cookie, refresh logic via `/api/v1/auth` | Secure auth flows compatible with browsers |
| Google Gemini SDK | AI calls | `server/routes/ai` sends prompts to Gemini 1.5 | Adds AI helper without hosting own model |
| Helmet, rate limits, sanitizers | Security middlewares | Enabled globally in `server/server.js` | Prevents XSS, injection, and request abuse |

---

## 3. Frontend Flow

### Auth + Dashboard (`client/src/components/Dashboard.jsx`)
- **What**: home screen that lists docs, creates new ones, searches, and handles sharing/deleting.
- **How**:
  - Pulls docs by calling `DocumentAPI.list()` inside `useEffect` and caches them in state.
  - `handleCreate` posts `{ title }`, then prepends the server response so the UI feels instant.
  - Search box uses `useMemo` to filter titles locally; zero-result states are explained to the user.
  - Share/Delete buttons live inside each card; `ShareDialog` only opens for owners (permission check `doc.permissionRole === 'owner'`).
  - `ThemeToggle` hooks into the app-wide dark/light theme.
- **Why**: proves full CRUD + permission UX, which is a common interview topic (ownership checks, optimistic updates, search UX).

### Editor Experience (`client/src/components/Editor.jsx`)
- **What**: Google Docs–style canvas powered by ReactQuill with presence indicators, live cursors, AI helper, and autosave alerts.
- **How**:
  - `useEditor(id, user)` hook manages socket connection, joins the doc room, and exposes `emitChange`/`emitCursor`.
  - Quill modules register `quill-cursors` once and configure read-only toolbars when the role is `viewer`.
  - Text changes travel through the `text-change` event → `emitChange({ delta, content })` → Socket.io.
  - Remote updates trigger `handleTextChange`, marking `isApplyingRemoteChangeRef` so we don’t loop changes back.
  - Presence badges pull from `participants` returned by the hook; colors are set by the server for consistency.
  - Autosave panel reads the status machine (`idle`, `dirty`, `saving`, etc.) to show “All changes saved” vs “Autosave failed”.
- **Why**: demonstrates knowledge of controlled editors, debouncing network traffic, and making collaborative UX resilient (flagging remote vs local changes is a typical interview question).

### AI Assistant (`client/src/components/AIAssistant.jsx`)
- **What**: right-side card with buttons (Grammar, Enhance, Summarize, Complete, Suggest) that call Gemini.
- **How**:
  - Selected text is converted to plain text with `htmlToPlain`, then sent to the matching REST endpoint.
  - Loading state shows a spinner; responses render inside a bordered panel.
  - “Insert into doc” calls `onInsert` so the parent can paste the AI suggestion into Quill.
- **Why**: showcases how to bolt AI helpers onto an editor while handling latency/errors gracefully.

---

## 4. Backend & Security Flow

### Express Server (`server/server.js`)
- **What**: Entry point that wires HTTP middleware, REST routes, security, and Socket.io setup.
- **How**:
  - Loads env once (so prod uses actual environment variables).
  - Builds a safe `CLIENT_ORIGINS` list by combining `.env` with localhost fallbacks; both CORS and Socket.io reuse it.
  - Applies security layers: `helmet`, `express.json` limit, cookie parser, gzip `compression`, manual Mongo sanitizer, `hpp`, plus a global `apiLimiter`.
  - Routes: `/api/v1/auth`, `/api/v1/documents`, `/api/v1/ai`, and `/health` for probes. `notFound` + `errorHandler` capture remaining errors.
- **Why**: interview-ready explanation of production middleware and CORS handling for both HTTP + WebSocket traffic.

### Editor Socket (`server/websockets/editorSocket.js`)
- **Auth**: parses cookies, validates JWT via `JWT_ACCESS_SECRET`, fetches the user, then checks `Permission` for the doc.
- **Room lifecycle**:
  - Joins the doc room, sets a random cursor color, and stores metadata in `activeUsers`.
  - Emits `presence` and `user-joined` events so the UI can render avatars instantly.
- **Text changes**:
  - Editors only (owner/editor roles) can broadcast `text-change`; server forwards it and persists `content` + `lastEditedBy`.
  - Emits `document-saved` or `document-save-error` for UX feedback.
- **Cursor updates**: `cursor-move` keeps cursor ranges in memory and rebroadcasts to others.
- **Why**: demonstrates token-based socket auth, room isolation, and permission-aware collaboration.

### AI Routes
- Each endpoint receives plain text, validates it, forwards to Gemini through `@google/generative-ai`, and returns the cleaned answer.
- Errors bubble up as friendly messages so the UI can show “AI request failed”.
- Why: highlights safe AI integration (sanitized inputs, controlled outputs, graceful failure).

---

## 5. Data & Permissions
- `Documents` store title, HTML content, last editor, autosave timestamps.
- `Permissions` map `user` + `document` + `role` (`owner`, `editor`, `viewer`). Owners can share and delete; editors can type; viewers are read-only but still receive live updates.
- API and socket both check the same permissions, preventing bypasses.

---

## 6. Environment & Deployment
- **Local dev**: run `npm run dev` in `client` (Vite) and `server` (nodemon). Vite proxy sends `/api` and sockets to port 5000, so cookies keep SameSite rules satisfied.
- **Env vars**: `server/env.sample` lists Mongo URI, JWT secrets, Gemini settings, and `CLIENT_URL`. Frontend uses `VITE_API_URL` + `VITE_SOCKET_URL`.
- **Docker**: `docker compose up --build` spins Mongo, server, client, and Nginx proxy. Useful to mention you can ship the whole stack with one command.
- **Production**: PM2 + Nginx instructions live in `README.md` (install deps, build client, `pm2 start ecosystem.config.js`, configure SSL).

---

## 7. Interview Cheat Sheet
- **“How do you secure real-time collaboration?”**  
  Authenticate sockets with the same JWT as REST, check per-document permissions, and deny `text-change` if the user is only a viewer.

**“How do you avoid edit conflicts?”**  
Send both Quill deltas and the full HTML snapshot. Clients treat remote updates as “apply, but don’t re-emit” by toggling `isApplyingRemoteChangeRef`.

**“What happens if autosave fails?”**  
Server emits `document-save-error`, the React status machine flips to `error`, and the UI surfaces a red badge so users can retry.

**“Why Gemini?”**  
Gemini 1.5 flash is fast and cheap for text editing suggestions; we isolate prompts on the backend, so the API key never leaks to the browser.

**“How would you scale?”**  
Move Socket.io to Redis adapter for multi-instance sync, add Mongo indexes on `Permission` lookups, use CDN for static assets, and keep rate limits to protect `/auth`.

---

## 8. Quick Recap
- React Quill + Socket.io = real-time doc editing.
- Express API + Mongo models = auth, documents, permissions, AI endpoints.
- Security middleware + JWT cookies keep the app production-ready.
- `learning.md` is your speaking guide; reference file paths (`client/src/components/Editor.jsx`, `server/websockets/editorSocket.js`) to sound specific in interviews.

Happy practicing! ✨
## Learning Documentation

### What I Learned
- Reinforced best practices for secure cookie-based JWT auth (dual tokens, refresh rotation, httpOnly, dynamic SameSite) alongside SSR-friendly React flows.
- Deepened hands-on experience wiring Quill delta streams with Socket.io, optimistic UI patterns, and autosave fallbacks to guarantee durable persistence.
- Practiced packaging Gemini prompts for multiple UX scenarios (grammar, enhancement, completion) while gracefully handling API quota or latency issues.
- Strengthened deployment muscle memory: multi-service Docker builds, Nginx reverse proxying for websockets, and PM2 orchestration on EC2.

### Challenges
- **Peer dependency conflicts**: `react-quill` lagged React 19 support, so I downgraded the scaffold to React 18 to keep a stable editor stack.
- **Realtime data races**: balancing live socket persistence with scheduled autosave required careful debouncing and status signalling to avoid write storms.
- **Secure cross-origin cookies**: handling local dev vs. production (SameSite/secure flags) demanded dynamic config to keep auth seamless across environments.

### Technical Decisions
- **String-based document storage** instead of Quill deltas to simplify autosave diffs and AI prompts, while still broadcasting deltas for realtime UX.
- **Centralized service layer** (Auth, Document, Gemini) to isolate business logic from routes/websockets, easing future unit testing or refactors.
- **Winston logging + structured error middleware** to make the API production-observable and align with Docker/PM2 log aggregation.
- **Nginx edge proxy** with websocket upgrade handling so the same configuration works locally, in containers, and on EC2.

### Future Improvements
- Add collaborative cursors/annotations rendered inside the editor with colored carets.
- Introduce invitation flows that reference user emails instead of raw Mongo IDs for sharing.
- Implement offline/CRDT buffering so edits survive brief disconnects without data loss.
- Expand test coverage (unit + integration) and add GitHub Actions for CI/CD guardrails.

