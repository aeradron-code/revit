// Fallback for tooling that does not apply Expo's platform file resolution.
// Metro selects auth.web.ts for web and auth.native.ts for native platforms.
export * from "./auth.native";
