import { Link, router, Stack } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useUniwind } from "uniwind";

import { deleteAccount } from "@/api/account";
import { AppHeader } from "@/components/navigation/app-header";
import {
  API_ERROR_CODES,
  API_ERROR_MESSAGES,
  ApiError,
  normalizeApiError,
} from "@/api/errors";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { routes } from "@/lib/routes";
import { useAuth } from "@/providers/auth-provider";
import { useThemePreference } from "@/providers/theme-preference-provider";

export default function SettingsScreen() {
  const { profile, updateProfile, user } = useAuth();
  const { theme } = useUniwind();
  const { setPreference } = useThemePreference();
  const [profileOpen, setProfileOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const openProfileEditor = () => {
    setDisplayName(profile?.display_name ?? "");
    setUsername(profile?.username ?? "");
    setBio(profile?.bio ?? "");
    setError(null);
    setProfileOpen(true);
  };

  const saveProfile = async () => {
    const name = displayName.trim();
    const normalizedUsername = username.trim().toLowerCase();
    if (!name) {
      setError("Enter the name people should see.");
      return;
    }
    if (!/^[a-z0-9_]{3,30}$/.test(normalizedUsername)) {
      setError("Use 3–30 lowercase letters, numbers, or underscores.");
      return;
    }
    setSavingProfile(true);
    setError(null);
    try {
      await updateProfile({
        bio: bio.trim() || null,
        display_name: name,
        username: normalizedUsername,
      });
      setProfileOpen(false);
      setNotice("Your profile was updated.");
    } catch (submissionError) {
      setError(
        submissionError instanceof ApiError &&
          submissionError.code === API_ERROR_CODES.USERNAME_TAKEN
          ? API_ERROR_MESSAGES.USERNAME_TAKEN
          : normalizeApiError(
              submissionError,
              API_ERROR_MESSAGES.UPDATE_YOUR_PROFILE,
            ).message,
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const confirmDeletion = async () => {
    if (deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount();
      setDeleted(true);
      setDeleteOpen(false);
      setNotice("Your account and uploaded files have been deleted.");
    } catch (deletionError) {
      setError(
        normalizeApiError(deletionError, API_ERROR_MESSAGES.DELETE_ACCOUNT)
          .message,
      );
    } finally {
      setDeleting(false);
    }
  };

  if (!user) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
        <SettingsHeader />
        <View className="mx-auto w-full max-w-2xl gap-4 p-5 md:p-8">
          {deleted ? (
            <>
              <Text variant="h2">Account deleted</Text>
              <Text variant="muted">
                Your account and uploaded files have been deleted.
              </Text>
            </>
          ) : (
            <>
              <Text variant="h2">Settings</Text>
              <Text variant="muted">
                Sign in to manage your account settings.
              </Text>
              <Link href={routes.auth} asChild>
                <Button className="self-start">
                  <Text>Sign in</Text>
                </Button>
              </Link>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <SettingsHeader />
      <ScrollView
        className="flex-1"
        contentContainerClassName="mx-auto w-full max-w-2xl gap-6 p-5 md:p-8"
      >
        <View className="gap-1">
          <Text variant="muted">Manage your profile and app preferences.</Text>
        </View>

        <View className="gap-3 rounded-xl border border-border bg-card p-4">
          <Text variant="h2">Profile</Text>
          <Text variant="muted">
            {profile?.display_name ?? "Your profile"}
            {profile?.username ? ` · @${profile.username}` : ""}
          </Text>
          <Button
            className="self-start"
            variant="outline"
            onPress={openProfileEditor}
          >
            <Text>Edit profile</Text>
          </Button>
        </View>

        <View className="gap-3 rounded-xl border border-border bg-card p-4">
          <Text variant="h2">Appearance</Text>
          <View className="flex-row items-center justify-between gap-4">
            <View className="flex-1 gap-1">
              <Text className="font-medium">Dark theme</Text>
              <Text variant="muted">
                Use a darker appearance throughout the app.
              </Text>
            </View>
            <Switch
              accessibilityLabel="Use dark theme"
              checked={theme === "dark"}
              onCheckedChange={(enabled) =>
                setPreference(enabled ? "dark" : "light")
              }
            />
          </View>
        </View>

        {profile?.role === "admin" ? (
          <View className="gap-3 rounded-xl border border-border bg-card p-4">
            <Text variant="h2">Admin</Text>
            <Text variant="muted">Review user-submitted safety reports.</Text>
            <Link href={routes.adminReports} asChild>
              <Button className="self-start" variant="outline">
                <Text>Review reports</Text>
              </Button>
            </Link>
          </View>
        ) : null}

        <View className="gap-3 rounded-xl border border-border bg-card p-4">
          <Text variant="h2">Legal and support</Text>
          <Text variant="muted">
            Read Revit’s policies or contact Aeradron for help.
          </Text>
          <Link href={routes.privacy} asChild>
            <Button className="self-start" variant="outline">
              <Text>Privacy Policy</Text>
            </Button>
          </Link>
          <Link href={routes.terms} asChild>
            <Button className="self-start" variant="outline">
              <Text>Terms and Conditions</Text>
            </Button>
          </Link>
          <Link href={routes.support} asChild>
            <Button className="self-start" variant="outline">
              <Text>Contact support</Text>
            </Button>
          </Link>
        </View>

        <View className="gap-3 rounded-xl border border-destructive/40 bg-card p-4">
          <Text variant="h2">Delete account</Text>
          <Text variant="muted">
            Permanently remove your account and the personal content associated
            with it.
          </Text>
          <Button
            className="self-start"
            variant="destructive"
            onPress={() => {
              setError(null);
              setDeleteOpen(true);
            }}
          >
            <Text>Delete account</Text>
          </Button>
        </View>

        {notice ? (
          <Text accessibilityLiveRegion="polite" variant="muted">
            {notice}
          </Text>
        ) : null}
        {error && !profileOpen && !deleteOpen ? (
          <Text
            accessibilityLiveRegion="polite"
            role="alert"
            className="text-sm text-destructive"
          >
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <Dialog
        open={profileOpen}
        onOpenChange={(open) => {
          if (!savingProfile) setProfileOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>
              Update the details shown on your profile.
            </DialogDescription>
          </DialogHeader>
          <View className="gap-3">
            <View className="gap-1.5">
              <Text variant="small">Display name</Text>
              <Input
                accessibilityLabel="Display name"
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
              />
            </View>
            <View className="gap-1.5">
              <Text variant="small">Username</Text>
              <Input
                accessibilityLabel="Username"
                autoCapitalize="none"
                autoCorrect={false}
                value={username}
                onChangeText={(value) => setUsername(value.toLowerCase())}
                placeholder="your_username"
              />
            </View>
            <View className="gap-1.5">
              <Text variant="small">Bio</Text>
              <Input
                accessibilityLabel="Bio"
                multiline
                maxLength={160}
                value={bio}
                onChangeText={setBio}
                placeholder="A little about you"
                className="min-h-20"
              />
            </View>
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
          <DialogFooter>
            <Button
              variant="outline"
              disabled={savingProfile}
              onPress={() => setProfileOpen(false)}
            >
              <Text>Cancel</Text>
            </Button>
            <Button disabled={savingProfile} onPress={() => void saveProfile()}>
              <Text>{savingProfile ? "Saving…" : "Save changes"}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!deleting) setDeleteOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account permanently?</DialogTitle>
            <DialogDescription>
              This permanently deletes your profile, posts, comments, ratings,
              follows, saved Picks, forums you own, and uploaded images. Shared
              Find listings may remain without your creator details or image.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <Text
              accessibilityLiveRegion="polite"
              role="alert"
              className="text-sm text-destructive"
            >
              {error}
            </Text>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={deleting}
              onPress={() => setDeleteOpen(false)}
            >
              <Text>Cancel</Text>
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onPress={() => void confirmDeletion()}
            >
              <Text>{deleting ? "Deleting…" : "Delete permanently"}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SafeAreaView>
  );
}

function SettingsHeader() {
  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(routes.home);
  };

  return (
    <Stack.Screen
      options={{
        header: () => (
          <AppHeader showAccountActions title="Settings" onBack={goBack} />
        ),
      }}
    />
  );
}
