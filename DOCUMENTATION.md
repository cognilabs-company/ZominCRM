# Zomin CRM Developer Documentation

## Overview

Zomin CRM is a single frontend repository with two runtime surfaces:

- Admin CRM for operators, superusers, and admins
- Client Telegram WebApp for customer ordering

Both are mounted from the same React application and share the same build pipeline, but they use different providers and API helpers.

## Current Tech Stack

- React 19
- TypeScript
- Vite 6
- Tailwind CSS 4
- React Router DOM with `HashRouter`
- Lucide React
- Recharts
- Leaflet and React Leaflet

## Runtime Architecture

### Entry Points

- `index.tsx` mounts the React root and global CSS.
- `App.tsx` composes providers and defines all admin and client routes.

### Admin Application

Admin runtime uses:

- `context/AuthContext.tsx`
- `context/LanguageContext.tsx`
- `context/ThemeContext.tsx`
- `context/ToastContext.tsx`
- `services/api.ts`

Admin pages live in `pages/`.

Main admin feature areas include:

- dashboard
- conversations
- orders
- products
- clients
- bottle controller
- payments
- couriers
- users
- AI tools, credentials, and automation settings

### Client WebApp

Client runtime uses:

- `client/bootstrap/ClientAppContext.tsx`
- `client/bootstrap/ClientCartContext.tsx`
- `client/bootstrap/ClientLanguageContext.tsx`
- `client/api/clientApi.ts`

Client pages live in `client/pages/`.

Main client feature areas include:

- Telegram bootstrap and preview mode
- product catalog
- cart and delivery draft persistence
- checkout preview and order creation
- order history and order detail
- bottle balance and movement history
- client profile

## API Layers

### Admin API

`services/api.ts` is the central admin API layer.

Responsibilities:

- resolve API base URL from environment or current host
- define endpoint constants
- attach bearer token headers
- normalize backend envelope responses
- throw typed request errors

### Client API

`client/api/clientApi.ts` is the client WebApp API layer.

Responsibilities:

- resolve client API base URL
- attach client session token when available
- normalize client request failures
- resolve media URLs safely across hosts

## Routing Model

The project uses `HashRouter`.

Route groups:

- `/app/*` for the client WebApp
- `/*` for admin auth and admin CRM routes

Legacy admin routes are redirected into `/admin-app/*`.

`App.tsx` also includes path normalization so direct browser access without a hash can be converted into the expected hash route.

## State and Persistence

### Admin

- auth token stored in `localStorage`
- token expiry stored in `localStorage`
- theme stored in `localStorage`
- language stored in `localStorage`
- toast notifications are in-memory only

### Client

- bootstrap session token comes from `/bootstrap/`
- cart contents stored in `sessionStorage`
- order draft stored in `sessionStorage`
- optional language override stored in `localStorage`

## Styling

- Tailwind CSS v4 is configured through `index.css`
- shared tokens such as colors, shadows, and animations are defined with `@theme`
- admin and client surfaces intentionally use different visual styles

## Important Files

- `App.tsx`
- `index.tsx`
- `index.css`
- `services/api.ts`
- `context/AuthContext.tsx`
- `pages/Clients.tsx`
- `pages/Orders.tsx`
- `pages/Products.tsx`
- `pages/Conversations.tsx`
- `client/api/clientApi.ts`
- `client/bootstrap/ClientAppContext.tsx`
- `client/bootstrap/ClientCartContext.tsx`
- `client/bootstrap/ClientLanguageContext.tsx`
- `client/routes.tsx`

## Development Guidance

### Adding Admin API Calls

1. Add or extend the endpoint in `services/api.ts`.
2. Use `apiRequest(...)` from the page or context.
3. Prefer page-local loading and error state unless the state is truly shared.

### Adding Client API Calls

1. Use `clientApiRequest(...)` from `client/api/clientApi.ts`.
2. Pass the session token from `useClientApp()` when the endpoint requires authenticated client access.
3. Keep client ordering state inside the existing cart/bootstrap providers unless there is a clear reason to create a new provider.

### Translations

- Admin translations are in `constants.ts`.
- Client WebApp translations are in `client/bootstrap/ClientLanguageContext.tsx`.

When adding translations:

- provide `uz`, `ru`, and `en` values
- avoid placeholder strings
- prefer complete translations over transliterated labels

## Known Constraints

- The admin settings page is read-only until backend settings endpoints are available.
- Some older documents referenced mocked data or `/src` folder structure; those references are obsolete.
- Several admin pages are large and should be refactored carefully to avoid regressions.

## Verification

Primary verification command:

```bash
npm run build
```

If this passes, the Vite/TypeScript production bundle is currently valid.
