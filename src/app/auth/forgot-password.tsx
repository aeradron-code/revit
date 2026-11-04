import * as Linking from "expo-linking";
import { useState } from "react";
import { View } from "react-native";
import { AuthScreenLayout } from "@/components/auth/auth-screen-layout";
import { AuthTextLink } from "@/components/auth/auth-text-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { requestPasswordReset } from "@/api/auth";
import { API_ERROR_MESSAGES, normalizeApiError } from "@/api/errors";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setError(null);
    setMessage(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(
        email.trim(),
        Linking.createURL("auth/update-password"),
      );
      setMessage(
        "If that account exists, reset instructions are on their way.",
      );
    } catch (submissionError) {
      setError(
        normalizeApiError(submissionError, API_ERROR_MESSAGES.RESET_PASSWORD)
          .message,
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthScreenLayout
      title="Reset your password"
      description="Enter your email and we’ll send you instructions to regain access."
    >
      <View className="gap-4">
        <View className="gap-2">
          <Text variant="small">Email</Text>
          <Input
            accessibilityLabel="Email address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            inputMode="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="you@example.com"
            value={email}
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
        {message ? (
          <Text className="text-sm text-muted-foreground">{message}</Text>
        ) : null}
        <Button disabled={loading} onPress={submit}>
          <Text>{loading ? "Sending…" : "Send reset instructions"}</Text>
        </Button>
        <AuthTextLink href="/auth">Back to sign in</AuthTextLink>
      </View>
    </AuthScreenLayout>
  );
}
