import { NavigationBar } from "expo-navigation-bar";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { Fragment, useEffect } from "react";
import { Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Uniwind, useUniwind } from "uniwind";
import "../global.css";

import { PortalHost } from "@rn-primitives/portal";
import { AuthenticatedShell } from "@/components/navigation/authenticated-shell";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Colors } from "@/constants/theme";
import { ProfileMessageScreen } from "@/features/profile/profile-state-screen";
import { AppProvider } from "@/providers/app-provider";
import {
  AuthProvider,
  needsProfileCompletion,
  useAuth,
} from "@/providers/auth-provider";

SplashScreen.preventAutoHideAsync();
Uniwind.setTheme("system");

const SafeAreaContainer = Platform.OS === "web" ? Fragment : SafeAreaProvider;

export default function TabLayout() {
  const { theme } = useUniwind();
  const isDark = theme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const navigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      border: colors.border,
      card: colors.backgroundElement,
      notification: colors.primary,
      primary: colors.primary,
      text: colors.text,
    },
  };

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  return (
    <>
      <SafeAreaContainer>
        <AppProvider>
          <AuthProvider>
            <ThemeProvider value={navigationTheme}>
              <View className="flex-1">
                <RootNavigator />
                <PortalHost />
              </View>
            </ThemeProvider>
          </AuthProvider>
        </AppProvider>
      </SafeAreaContainer>

      <StatusBar style={isDark ? "light" : "dark"} />
      <NavigationBar style={isDark ? "light" : "dark"} />
    </>
  );
}

function RootNavigator() {
  const {
    isLoading,
    isPasswordRecovery,
    passwordRecoveryError,
    profile,
    profileError,
    clearPasswordRecoveryError,
    retryProfile,
    session,
  } = useAuth();
  const needsOnboarding = needsProfileCompletion(profile);
  const canEnterApp = Boolean(session) && !needsOnboarding;

  useEffect(() => {
    if (!isLoading) {
      void SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (session && profileError && !profile) {
    return (
      <ProfileMessageScreen
        title="Profile unavailable"
        description="We couldn&apos;t load your account profile. Check your connection and try again."
        action={() => void retryProfile()}
      />
    );
  }

  return (
    <AuthenticatedShell enabled={canEnterApp && !isPasswordRecovery}>
      <View className="flex-1">
        {passwordRecoveryError ? (
          <View
            className="flex-row items-center justify-between gap-2 bg-elevated px-4 py-2"
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
          >
            <Text className="flex-1" variant="small">
              {passwordRecoveryError}
            </Text>
            <Button
              size="sm"
              variant="ghost"
              onPress={clearPasswordRecoveryError}
            >
              <Text>Dismiss</Text>
            </Button>
          </View>
        ) : null}
        {session && profile && profileError ? (
          <View
            className="flex-row items-center justify-between gap-2 bg-elevated px-4 py-2"
            accessibilityLiveRegion="polite"
          >
            <Text className="flex-1" variant="small">
              Couldn’t refresh your profile.
            </Text>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => void retryProfile()}
            >
              <Text>Retry</Text>
            </Button>
          </View>
        ) : null}
        <Stack>
          <Stack.Protected guard={canEnterApp && !isPasswordRecovery}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="activity"
              options={{ headerShown: true, title: "Activity" }}
            />
            <Stack.Screen
              name="create/ask"
              options={{ headerShown: true, title: "Create post" }}
            />
            <Stack.Screen
              name="create/share"
              options={{ headerShown: true, title: "Create post" }}
            />
            <Stack.Screen
              name="entities/[id]"
              options={{ headerShown: true, title: "Find" }}
            />
            <Stack.Screen
              name="entities/search"
              options={({ route }) => ({
                headerShown: true,
                title:
                  (route.params as { returnTo?: string } | undefined)
                    ?.returnTo === "share"
                    ? "Create"
                    : "Finds",
              })}
            />
            <Stack.Screen
              name="posts/[id]"
              options={{ headerShown: true, title: "Post" }}
            />
            <Stack.Screen
              name="restaurants/[id]"
              options={{ headerShown: true, title: "Find" }}
            />
            <Stack.Screen
              name="restaurants/search"
              options={({ route }) => ({
                headerShown: true,
                title:
                  (route.params as { returnTo?: string } | undefined)
                    ?.returnTo === "share"
                    ? "Create"
                    : "Finds",
              })}
            />
            <Stack.Screen
              name="forums/[id]"
              options={{ headerShown: true, title: "Forums" }}
            />
            <Stack.Screen
              name="forums/create"
              options={{ headerShown: true, title: "Forums" }}
            />
            <Stack.Screen
              name="forums/[id]/create"
              options={{ headerShown: true, title: "Forums" }}
            />
            <Stack.Screen
              name="forums/[id]/posts/[postId]"
              options={{ headerShown: true, title: "Forum post" }}
            />
            <Stack.Screen
              name="picks/create"
              options={{ headerShown: true, title: "Picks" }}
            />
            <Stack.Screen
              name="picks/[id]"
              options={{ headerShown: true, title: "Picks" }}
            />
            <Stack.Screen
              name="users/[username]/index"
              options={{ headerShown: true, title: "Profile" }}
            />
            <Stack.Screen
              name="users/[username]/followers"
              options={{ headerShown: true, title: "Followers" }}
            />
            <Stack.Screen
              name="users/[username]/following"
              options={{ headerShown: true, title: "Following" }}
            />
          </Stack.Protected>

          <Stack.Protected
            guard={!session || needsOnboarding || isPasswordRecovery}
          >
            <Stack.Screen name="auth" options={{ headerShown: false }} />
          </Stack.Protected>
        </Stack>
      </View>
    </AuthenticatedShell>
  );
}

function AuthLoadingScreen() {
  return (
    <View className="flex-1 items-center justify-center gap-2 bg-background px-6">
      <Text variant="large">Loading your session…</Text>
      <Text variant="muted">
        One moment while we securely restore your account.
      </Text>
    </View>
  );
}
