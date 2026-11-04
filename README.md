# Social Rating Platform

A universal Expo application for sharing ratings, asking for feedback, and discovering trusted opinions.

## Development

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Start the app:

   ```bash
   pnpm start
   ```

Use the terminal shortcuts to open the running app on iOS, Android, or web.

## Quality checks

```bash
pnpm lint
pnpm check
```

Implementation follows the [Expo SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/).

## Implementation rules

- Use stable Expo Router APIs. Do not introduce alpha or unstable navigation APIs without explicit approval.
- Build app UI with Uniwind semantic utilities and React Native Reusables. Use `StyleSheet.create` only when a platform API cannot accept `className` or needs truly runtime-computed styles.
- All Supabase Data API database calls (`from`, `rpc`, and database-function access) must live in `src/api`. Screens, components, hooks, stores, and providers consume typed API functions and never query the database directly.
- Keep Supabase Auth session operations in the dedicated Supabase/auth layer. Never expose the raw Supabase database client as a shortcut around `src/api`.
- API modules select only required fields, normalize errors, apply bounded timeouts, retry safe reads only, and return application-ready typed data rather than raw Supabase responses.
- All runtime consumers use TanStack Query adapters from `src/queries`; providers, screens, components, and feature modules do not invoke `src/api` request functions directly. Type-only and normalized-error imports are allowed.
