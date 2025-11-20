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

