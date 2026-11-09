import { Link } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { signIn } from "@/api/auth";
import { API_ERROR_MESSAGES, normalizeApiError } from "@/api/errors";
import { AuthScreenLayout } from "@/components/auth/auth-screen-layout";
import { AuthTextLink } from "@/components/auth/auth-text-link";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Text } from "@/components/ui/text";
import { routes } from "@/lib/routes";

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (loading) return;
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (submissionError) {
      setError(
        normalizeApiError(submissionError, API_ERROR_MESSAGES.SIGN_IN).message,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreenLayout
      keyboardAware
      showBrandGradient
      title="Welcome back"
      description="Sign in to see the ratings shared by people you follow."
    >
      <View className="gap-5">
        <View className="gap-2">
          <Text variant="small">Email</Text>
          <Input
            accessibilityLabel="Email address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            inputMode="email"
            keyboardType="email-address"
            editable={!loading}
            onChangeText={setEmail}
            placeholder="name@example.com"
            value={email}
          />
        </View>
        <View className="gap-2">
          <Text variant="small">Password</Text>
          <PasswordInput
            accessibilityLabel="Password"
            autoComplete="current-password"
            onChangeText={setPassword}
            placeholder="Your password"
            editable={!loading}
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
            value={password}
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
        <Link href="/auth/forgot-password" className="self-end">
          <Text className="text-xs text-muted-foreground">
            Forgot password?
          </Text>
        </Link>
        <Button size="lg" disabled={loading} onPress={submit}>
          <Text>{loading ? "Please wait…" : "Sign in"}</Text>
        </Button>
        <GoogleSignInButton />
        <Text className="text-center text-xs leading-5 text-muted-foreground">
          By continuing with Google to create an account, you agree to the{" "}
          <Link href={routes.terms} className="text-primary underline">
            Terms and Conditions
          </Link>{" "}
          and acknowledge the{" "}
          <Link href={routes.privacy} className="text-primary underline">
            Privacy Policy
          </Link>
          .
        </Text>
        <AuthTextLink href="/auth/sign-up">
          Need an account? Create one
        </AuthTextLink>
      </View>
    </AuthScreenLayout>
  );
}
