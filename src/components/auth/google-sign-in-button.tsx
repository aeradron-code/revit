import { useState } from "react";

import { signInWithGoogle } from "@/api/auth";
import { API_ERROR_MESSAGES, normalizeApiError } from "@/api/errors";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import Svg, { Path } from "react-native-svg";

export function GoogleSignInButton({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (signInError) {
      setError(
        normalizeApiError(signInError, API_ERROR_MESSAGES.SIGN_IN).message,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        disabled={loading || disabled}
        onPress={() => void signIn()}
        variant="outline"
      >
        <Svg
          width={20}
          height={20}
          viewBox="0 0 48 48"
          accessibilityLabel="Google"
        >
          <Path
            fill="#4285F4"
            d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.9 6.1-15Z"
          />
          <Path
            fill="#34A853"
            d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z"
          />
          <Path
            fill="#FBBC05"
            d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.3H5.8a20 20 0 0 0 0 17.8l6.8-5.3Z"
          />
          <Path
            fill="#EA4335"
            d="M24 12c3 0 5.7 1 7.8 3.1l5.9-5.9C34.1 5.8 29.5 4 24 4A20 20 0 0 0 5.8 15.1l6.8 5.3C14.2 15.6 18.7 12 24 12Z"
          />
        </Svg>
        <Text>{loading ? "Connecting…" : "Continue with Google"}</Text>
      </Button>
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          className="text-sm text-destructive"
          role="alert"
        >
          {error}
        </Text>
      ) : null}
    </>
  );
}
