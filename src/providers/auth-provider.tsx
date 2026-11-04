import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  handleAuthCallback,
  isPasswordRecoveryUrl,
  signOut as signOutRequest,
  subscribeToAuthState,
} from "@/api/auth";
import { API_ERROR_MESSAGES } from "@/api/errors";
import type { Profile, UpdateProfileInput } from "@/api/profiles";
import { useInlineDrafts } from "@/features/comments/inline-drafts";
import { useProfile, useUpdateProfile } from "@/queries/profiles";

type AuthContextValue = {
  clearPasswordRecovery: () => void;
  clearPasswordRecoveryError: () => void;
  isLoading: boolean;
  isPasswordRecovery: boolean;
  passwordRecoveryError: string | null;
  profile: Profile | null;
  profileError: Error | null;
  retryProfile: () => Promise<void>;
  session: Session | null;
  signOut: () => Promise<void>;
  updateProfile: (input: UpdateProfileInput) => Promise<void>;
  user: User | null;
};

type AuthIdentity = Pick<User, "id"> & { email: string | null };

const AuthContext = createContext<AuthContextValue | null>(null);
const AuthIdentityContext = createContext<AuthIdentity | null | undefined>(
  undefined,
);

export function needsProfileCompletion(profile: Profile | null) {
  return !profile?.onboarding_completed_at;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [passwordRecoveryError, setPasswordRecoveryError] = useState<
    string | null
  >(null);
  const handledUrls = useRef(new Set<string>());
  const previousUserId = useRef<string | null>(null);
  const userId = session?.user.id ?? "";
  const profileQuery = useProfile(userId);
  const profileMutation = useUpdateProfile(userId);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = subscribeToAuthState((event, nextSession) => {
      if (!isMounted) return;

      const nextUserId = nextSession?.user.id ?? null;
      if (
        previousUserId.current !== null &&
        previousUserId.current !== nextUserId
      ) {
        void queryClient.cancelQueries();
        queryClient.clear();
        useInlineDrafts.getState().clearAll();
      }
      previousUserId.current = nextUserId;
      setSession(nextSession);
      setIsSessionLoading(false);
      if (event === "PASSWORD_RECOVERY") setIsPasswordRecovery(true);
      if (event === "SIGNED_OUT") setIsPasswordRecovery(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [queryClient]);

  useEffect(() => {
    let isMounted = true;

    const handleUrl = async (url: string) => {
      if (handledUrls.current.has(url)) return;
      handledUrls.current.add(url);

      try {
        const result = await handleAuthCallback(url);
        if (!isMounted) return;
        if (result.status === "recovery") {
          setPasswordRecoveryError(null);
          setIsPasswordRecovery(true);
        } else if (result.status === "invalid") {
          setIsPasswordRecovery(false);
          setPasswordRecoveryError(
            API_ERROR_MESSAGES.PASSWORD_RESET_LINK_INVALID,
          );
        } else if (result.status === "unavailable") {
          setIsPasswordRecovery(false);
          setPasswordRecoveryError(
            API_ERROR_MESSAGES.PASSWORD_RESET_LINK_UNAVAILABLE,
          );
        }
      } catch {
        if (isMounted && isPasswordRecoveryUrl(url)) {
          setIsPasswordRecovery(false);
          setPasswordRecoveryError(
            API_ERROR_MESSAGES.PASSWORD_RESET_LINK_UNAVAILABLE,
          );
        }
      }
    };

    void Linking.getInitialURL()
      .then((url) => {
        if (url) void handleUrl(url);
      })
      .catch(() => {
        if (isMounted) {
          setPasswordRecoveryError(
            API_ERROR_MESSAGES.PASSWORD_RESET_LINK_UNAVAILABLE,
          );
        }
      });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      void handleUrl(url);
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  const retryProfile = useCallback(async () => {
    await profileQuery.refetch();
  }, [profileQuery.refetch]);

  const updateProfile = useCallback(
    async (input: UpdateProfileInput) => {
      await profileMutation.mutateAsync(input);
    },
    [profileMutation.mutateAsync],
  );

  const clearPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false);
    setPasswordRecoveryError(null);
  }, []);

  const clearPasswordRecoveryError = useCallback(() => {
    setPasswordRecoveryError(null);
  }, []);

  const signOut = useCallback(async () => {
    await signOutRequest();
  }, []);

  const profile = profileQuery.data ?? null;
  const userEmail = session?.user.email ?? null;
  const authIdentity = useMemo<AuthIdentity | null>(
    () => (userId ? { id: userId, email: userEmail } : null),
    [userEmail, userId],
  );
  const profileError =
    profileQuery.error instanceof Error ? profileQuery.error : null;
  const isLoading =
    isSessionLoading || (Boolean(session) && profileQuery.isLoading);

  const value = useMemo(
    () => ({
      clearPasswordRecovery,
      clearPasswordRecoveryError,
      isLoading,
      isPasswordRecovery,
      passwordRecoveryError,
      profile,
      profileError,
      retryProfile,
      session,
      signOut,
      updateProfile,
      user: session?.user ?? null,
    }),
    [
      clearPasswordRecovery,
      clearPasswordRecoveryError,
      isLoading,
      isPasswordRecovery,
      passwordRecoveryError,
      profile,
      profileError,
      retryProfile,
      session,
      signOut,
      updateProfile,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      <AuthIdentityContext.Provider value={authIdentity}>
        {children}
      </AuthIdentityContext.Provider>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return value;
}

/** Subscribe only to stable user identity; profile and recovery updates do not rerender this consumer. */
export function useAuthUser(): AuthIdentity | null {
  const identity = useContext(AuthIdentityContext);

  if (identity === undefined) {
    throw new Error("useAuthUser must be used within AuthProvider");
  }

  return identity;
}
