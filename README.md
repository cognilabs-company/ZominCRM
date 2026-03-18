# Zomin CRM Frontend

Zomin CRM is a Vite + React + TypeScript frontend that serves two applications from one codebase:

- Admin CRM under `#/admin-app`
- Client Telegram WebApp under `#/app`

## Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- React Router DOM
- Recharts
- Leaflet / React Leaflet

## Project Areas

- `App.tsx`: top-level routing and provider composition
- `context/`: admin auth, theme, language, toast state
- `services/api.ts`: admin API base resolution, endpoints, and request helper
- `pages/`: admin CRM pages
- `client/bootstrap/`: client WebApp bootstrap, cart, and language state
- `client/api/clientApi.ts`: client WebApp API helper
- `client/pages/`: client-facing ordering flow
- `components/` and `components/ui/`: shared admin UI building blocks

## Local Development

Prerequisites:

- Node.js 20+

Install and run:

```bash
npm install
npm run dev
```

Default Vite dev server:

- `http://localhost:3000`

## Environment Variables

The frontend can derive API URLs automatically from the current host, but these variables can override that behavior when needed:

- `VITE_API_BASE_URL`
- `VITE_CLIENT_API_BASE_URL`
- `GEMINI_API_KEY`

Notes:

- Admin API defaults to `/internal` style routes.
- Client WebApp API defaults to `/client/webapp` style routes.
- `vite.config.ts` also exposes `GEMINI_API_KEY` through `process.env.*` compatibility keys.

## Routing

This project uses `HashRouter`.

Examples:

- Admin dashboard: `/#/admin-app`
- Admin orders: `/#/admin-app/orders`
- Client home: `/#/app/home`
- Client cart: `/#/app/cart`

There is also path normalization in `App.tsx` so direct non-hash paths can be redirected into hash routes.

## Build

```bash
npm run build
```

The production build is emitted to `dist/`.

## Notes

- The admin settings page is intentionally read-only until dedicated backend settings endpoints exist.
- The client WebApp depends on Telegram WebApp context for full authentication and ordering behavior.
- The client app supports preview mode outside Telegram, but some actions remain unavailable without a verified client session.
