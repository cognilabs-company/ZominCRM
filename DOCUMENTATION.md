# Zomin CRM - Developer Documentation

## Overview
Zomin CRM is a modern, responsive React application designed for an "AI Bot + CRM" system. It features a dual-theme system (Dark Navy/Light) and multi-language support (English, Russian, Uzbek).

## Tech Stack
- **Framework:** React 18+ (Create Root API)
- **Language:** TypeScript
- **Styling:** Tailwind CSS (Utility-first)
- **Icons:** Lucide React
- **Routing:** React Router DOM (HashRouter)
- **Charts:** Recharts

## Project Structure

### `/src` Root
- `App.tsx`: Main application component containing the Router and global Providers (Theme, Language).
- `index.tsx`: Entry point rendering the React root.
- `types.ts`: Global TypeScript definitions (Interfaces for User, Order, translations, etc.).
- `constants.ts`: Static data including Translation dictionaries and Navigation items.

### `/src/context`
- `ThemeContext.tsx`: Manages the 'dark' vs 'light' class on the HTML root element. Persists preference to LocalStorage.
- `LanguageContext.tsx`: Manages current locale ('en', 'ru', 'uz') and provides a `t(key)` function for translating strings.

### `/src/components`
- `Sidebar.tsx`: The main left-hand navigation. Uses `NavLink` for active states.
- `Header.tsx`: Top bar containing the Language Switcher, Theme Toggle, and User Profile/Notifications.
- `/ui`: Reusable atomic components.
  - `Card.tsx`: Standard container with optional title/action header.
  - `Badge.tsx`: Status indicators with color variants (success, warning, error, etc.).

### `/src/pages`
- `Dashboard.tsx`: High-level view with KPI cards and Recharts visualizations.
- `Conversations.tsx`: A split-view chat interface (Sidebar List + Chat Window).
- `Orders.tsx`: A data table listing orders with filtering UI and status badges.

### `/src/services`
- `api.ts`: Central configuration file for API Endpoints. Change `API_BASE_URL` here to connect to your backend.

## How to Customize

### Changing Colors
Colors are defined in `tailwind.config` (inside `index.html` script tag for this build). 
- To change the dark background, modify `colors.navy`.
- To change the accent color, modify `colors.primary.red` or `colors.primary.blue`.

### Adding Translations
1. Open `src/constants.ts`.
2. Add a new key to the `TRANSLATIONS` object.
   ```typescript
   new_key: { en: 'Hello', ru: 'Привет', uz: 'Salom' }
   ```
3. Use in components: `const { t } = useLanguage(); ... <span>{t('new_key')}</span>`

### Connecting to API
1. Open `src/services/api.ts`.
2. Update `API_BASE_URL` to your real backend URL.
3. Use the defined `ENDPOINTS` in your `useEffect` hooks within pages to fetch data.

## API Integration Pattern
Currently, data is mocked in the components. To integrate real data:
1. Create a function in `services/api.ts` (e.g., `fetchOrders`).
2. In `Orders.tsx`, add a `useEffect`:
   ```typescript
   useEffect(() => {
     fetch(ENDPOINTS.ORDERS.LIST, { headers: getHeaders() })
       .then(res => res.json())
       .then(data => setOrders(data));
   }, []);
   ```

## Key Features Code Map
- **Theme Logic:** `context/ThemeContext.tsx` -> Toggles `.dark` class on `<html>`.
- **Language Logic:** `context/LanguageContext.tsx` -> Maps keys to strings in `constants.ts`.
- **Layout:** `App.tsx` (MainLayout) wraps the `Sidebar`, `Header` and `Outlet` (Page Content).