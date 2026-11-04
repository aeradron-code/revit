import { Stack } from "expo-router";

import { needsProfileCompletion, useAuth } from "@/providers/auth-provider";

export default function AuthLayout() {
  const { isPasswordRecovery, profile, session } = useAuth();
  const needsOnboarding = needsProfileCompletion(profile);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!session && !isPasswordRecovery}>
        <Stack.Screen name="index" />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="reset" />
      </Stack.Protected>

      <Stack.Protected
        guard={Boolean(session) && needsOnboarding && !isPasswordRecovery}
      >
        <Stack.Screen name="onboarding" />
      </Stack.Protected>

      <Stack.Protected guard={Boolean(session) && isPasswordRecovery}>
        <Stack.Screen name="update-password" />
      </Stack.Protected>
    </Stack>
  );
}
