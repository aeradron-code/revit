# Mobile layout and safe-area ownership

This document records the Phase 1 layout contract for Revit. It is the baseline for later scrolling and keyboard work. The project uses Expo SDK 58, `react-native-safe-area-context`, Expo Router, a custom `AppHeader`, and a custom tab bar. The root installs `SafeAreaProvider`; web deliberately uses CSS `env(safe-area-inset-*)` handling to avoid relying on native inset measurement during hydration.

## Ownership contract

Each device inset has one owner on a given screen edge:

| Surface | Top | Bottom | Horizontal edges |
|---|---|---|---|
| Root stack screen with `AppHeader` | `AppHeader` (`edges={["top"]}`) | Screen canvas (`edges={["bottom"]}`) | Screen canvas where edge-to-edge content needs protection |
| Tab screen | Tab `AppHeader` | Tab bar, including `useSafeAreaInsets()` padding | Tab screen canvas (`left`/`right`) |
| Auth screen with no app header or tabs | Auth screen canvas | Auth screen canvas | Auth screen canvas |
| Modal or portal surface | The overlay/dialog surface itself, when it reaches an unsafe edge | The overlay/dialog surface itself | Dialog width constraints and safe-area padding |
| Web | CSS safe-area env variables in the web safe-area component and tab-bar styles | Same | Same |

Do not add a second inset for an edge already owned by a header or tab bar. `SafeAreaView` should wrap the screen canvas and select only edges that canvas owns. The native root provider is installed once above navigation; individual screens must not create providers.

## Route and surface inventory

| Route group / route | Header and bottom-bar owner | Screen canvas owner | Notes |
|---|---|---|---|
| `/(tabs)/index`, `/discover`, `/forums`, `/picks`, `/create`, `/profile` | `MainTabs` renders `AppHeader`; native tab bar owns bottom inset | Feed/list screens generally protect left and right; profile uses route-dependent edges | Profile is shown as a hidden tab route. Preserve the tab shell's inset behavior. |
| `/activity` | Stack `AppHeader`; no tab bar | Bottom edge | Virtualized list. |
| `/create/ask`, `/create/share` | Custom stack `AppHeader`; no tab bar | Bottom edge | Composer/recovery states share this route family. |
| `/entities/search`, `/restaurants/search` | Custom `AppHeader`; no tab bar | Bottom edge | Search list can contain the add-entity form. |
| `/entities/[id]`, `/restaurants/[id]` | Custom stack `AppHeader`; no tab bar | Bottom edge | Detail content and dialogs. |
| `/posts/[id]`, `/forums/[id]/posts/[postId]` | `PostDetailFrame` / `ForumPostFrame` custom header; no tab bar | Bottom edge | Comment list owns scrolling; overlays are separate surfaces. |
| `/forums/[id]`, `/forums/create`, `/forums/[id]/create` | Custom stack `AppHeader`; no tab bar | Bottom edge | Includes forum create and post composer forms. |
| `/picks/[id]`, `/picks/create` | Custom stack `AppHeader`; no tab bar | Bottom edge | Pick editor uses a virtualized list with form controls in its header. |
| `/users/[username]`, `/followers`, `/following` | Custom `AppHeader`; no tab bar | Bottom edge for detail/list routes | Own profile can render inside the tab shell and uses horizontal-only screen insets; follow-list routes use bottom edge. |
| `/settings` | Custom `AppHeader`; no tab bar | Bottom edge | Profile editor and account dialogs are portals. |
| `/privacy`, `/terms`, `/support` | Expo Router stack header; no tab bar | Bottom edge | Long-form content is scrollable. |
| `/admin/reports` | Custom stack `AppHeader`; no tab bar | Bottom edge | List screen. |
| `/auth`, `/auth/sign-up`, `/auth/forgot-password`, `/auth/onboarding`, `/auth/update-password` | No app header or tab bar | Auth layout owns all safe edges | Web uses CSS safe-area values. |
| Recovery, loading, error, and placeholder states | Inherit their route header when present | Their owning screen or `RoutePlaceholderScreen` | Check long messages/actions at large text sizes during overflow phase. |
| Dialogs, native modals, header action sheets | No stack header/tab bar ownership | Overlay owns its own bounds and edge padding | Do not assume the underlying screen's safe area or scroll view applies to a portal. |

## Current implementation notes

- `src/app/_layout.tsx` creates the native `SafeAreaProvider` above providers and navigation; web uses the existing `Fragment` path.
- `src/components/navigation/app-header.tsx` owns the top inset for custom headers.
- `src/components/navigation/main-tabs.tsx` owns the tab-bar bottom inset on native and CSS safe-area padding on web.
- `src/components/ui/safe-area-view.web.tsx` translates requested edges to CSS safe-area variables.
- Most stack screens already declare `edges={["bottom"]}`; tab canvases generally declare horizontal edges. Treat deviations as deliberate only when the route is embedded in a different shell.
- `src/components/ui/sticky-action-footer.tsx` owns the bottom safe area when used. A screen using it must not also add bottom inset to its parent canvas.

## Review rule for future routes

When adding a route, record whether it is inside tabs, whether it has a custom or router header, and which component owns top, bottom, and side insets. Then choose a scroll strategy independently; safe-area ownership does not imply that every page should scroll.

## Shared scroll primitives (Phase 2)

- Use `PageScrollView` for ordinary bounded page content. It supplies the common content gutter and defaults taps in controls to remain handled while the keyboard is open.
- Use `KeyboardAwareScrollView` for native forms and keyboard-sensitive dialog content. The shared primitive supplies a 24-point focused-field offset, handled taps, and interactive/on-drag dismissal defaults. On web it resolves to a regular `ScrollView`; browser focus scrolling remains in control.
- Keep large collections virtualized. Input-bearing `FlatList`s use `renderKeyboardAwareListScroll` as their `renderScrollComponent`. This replaces the existing scroll host without wrapping the list in another scroll view. The library tracks focused fields and provides keyboard space on both native platforms. Preserve its insets mode so it does not append extra layout children to the virtualized content.
- `KeyboardProvider` belongs once above navigation, next to the root safe-area provider. Do not add a provider per form or dialog.
- Use `StickyActionFooter` for a persistent bottom action region. It owns the bottom safe inset; the surrounding screen should not add another bottom inset for that same region. Keyboard movement for a specific sticky control is handled in its screen migration, rather than globally shifting every footer.

## Input-bearing lists and navigation (Phase 4)

- Feed, profile, forum, comment, search, and editor lists with inputs use the shared keyboard-aware scroll host. Native automatic keyboard insets are explicitly disabled there so the library is the only inset owner. Do not assume Android window resize will handle fields while the root keyboard provider is active.
- Detail comment lists also use interactive keyboard dismissal so the user can expose more comments with a drag. Inline composers in feed cards rely on the owning feed list's keyboard inset adjustment.
- The native tab bar hides while the keyboard is open, giving focused fields and list content the available viewport. Web keeps browser-managed viewport behavior.
- Dialogs use a bounded full-window keyboard-aware scroll viewport, with safe-area padding and a naturally sized card inside it. Fields and actions scroll together, including when the card is taller than the viewport. There is no percentage-height constraint on an unmeasured animated parent and no second keyboard adjustment inside the card.

## Overflow policy (Phase 5)

- Keep feed and result collections virtualized. Long-form legal/support/settings content and multi-section forms use their existing scroll container.
- Recovery gates, route placeholders, and reusable profile/error states can expand with larger text or retry/error copy, so they use a scrollable canvas with a growing content container. Short messages remain visually centered when they fit.
- Avoid adding scroll containers to every screen by default. A fixed loading skeleton or compact confirmation can remain stationary when it has no user-entered content and no variable-length action list.
- When reviewing a new state, test large text and long localized/error copy; retain safe-area ownership at the screen canvas and keep action buttons in the same scrollable region when the state itself may exceed the viewport.

## Verification status

Lint, API-boundary checks, TypeScript, and bundle checks can detect source/integration errors. They do not establish native keyboard correctness. Device verification remains outstanding for list focus changes, multiline caret movement, dialog actions, backdrop dismissal, large text, and keyboard open/close transitions on iOS and Android.
