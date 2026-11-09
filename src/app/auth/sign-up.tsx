import { Link } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { signUp } from "@/api/auth";
import { API_ERROR_MESSAGES, normalizeApiError } from "@/api/errors";
import { AuthScreenLayout } from "@/components/auth/auth-screen-layout";
import { AuthTextLink } from "@/components/auth/auth-text-link";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Text } from "@/components/ui/text";
import { routes } from "@/lib/routes";

export default function SignUpScreen() {
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (loading) return;
    setError(null);
    setMessage(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    if (!acceptedTerms) {
      setError("Please accept the Terms and Conditions to create an account.");
      return;
    }
    setLoading(true);
    try {
      const result = await signUp(email.trim(), password);
      if (!result.session) {
        setMessage(
          "Check your email to confirm your account, then return here to sign in.",
        );
      }
    } catch (submissionError) {
      setError(
        normalizeApiError(submissionError, API_ERROR_MESSAGES.SIGN_UP).message,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreenLayout
      keyboardAware
      showBrandGradient
      title="Create your account"
      description="Share your reviews and follow people whose reviews you care about."
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
            autoComplete="new-password"
            onChangeText={setPassword}
            placeholder="At least 8 characters"
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
        {message ? (
          <Text className="text-sm text-muted-foreground">{message}</Text>
        ) : null}
        <View className="flex-row items-start gap-3">
          <Checkbox
            accessibilityLabel="I agree to the Terms and Conditions and acknowledge the Privacy Policy"
            checked={acceptedTerms}
            onCheckedChange={setAcceptedTerms}
            disabled={loading}
            hitSlop={8}
            className="mt-0.5"
          />
          <Text className="flex-1 text-sm text-muted-foreground">
            I agree to the{" "}
            <Link href={routes.terms} className="text-primary underline">
              Terms and Conditions
            </Link>{" "}
            and acknowledge the{" "}
            <Link href={routes.privacy} className="text-primary underline">
              Privacy Policy
            </Link>
            .
          </Text>
        </View>
        <Button size="lg" disabled={loading || !acceptedTerms} onPress={submit}>
          <Text>{loading ? "Please wait…" : "Create account"}</Text>
        </Button>
        <GoogleSignInButton disabled={!acceptedTerms || loading} />
        <AuthTextLink href="/auth/sign-up">
          Already have an account? Sign in
        </AuthTextLink>
      </View>
    </AuthScreenLayout>
  );
}
