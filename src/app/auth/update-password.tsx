import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { AuthScreenLayout } from "@/components/auth/auth-screen-layout";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Text } from "@/components/ui/text";
import { routes } from "@/lib/routes";
import { updatePassword } from "@/api/auth";
import { API_ERROR_MESSAGES, normalizeApiError } from "@/api/errors";
import { useAuth } from "@/providers/auth-provider";

export default function UpdatePasswordScreen() {
  const { clearPasswordRecovery } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);

    if (password.length < 8) {
      setError("Use at least 8 characters for your new password.");
      return;
    }

    if (password !== confirmation) {
      setError("Your passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await updatePassword(password);
      clearPasswordRecovery();
      router.replace(routes.home);
    } catch (submissionError) {
      setError(
        normalizeApiError(submissionError, API_ERROR_MESSAGES.UPDATE_PASSWORD)
          .message,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreenLayout
      title="Choose a new password"
      description="Create a new password for your account."
    >
      <View className="gap-4">
        <View className="gap-2">
          <Text variant="small">New password</Text>
          <PasswordInput
            accessibilityLabel="New password"
            autoComplete="new-password"
            editable={!loading}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            value={password}
          />
        </View>
        <View className="gap-2">
          <Text variant="small">Confirm new password</Text>
          <PasswordInput
            accessibilityLabel="Confirm new password"
            autoComplete="new-password"
            editable={!loading}
            onChangeText={setConfirmation}
            placeholder="Repeat your new password"
            value={confirmation}
          />
        </View>
        {error ? (
          <Text
            accessibilityLiveRegion="polite"
            role="alert"
            className="text-sm text-destructive"
          >
            {error}
          </Text>
        ) : null}
        <Button disabled={loading} onPress={() => void submit()}>
          <Text>{loading ? "Saving…" : "Save new password"}</Text>
        </Button>
      </View>
    </AuthScreenLayout>
  );
}
