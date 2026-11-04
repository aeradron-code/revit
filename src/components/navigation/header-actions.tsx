import { Link, router } from "expo-router";
import { Bell, LogOut } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, View } from "react-native";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Text } from "@/components/ui/text";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useUnreadNotificationCount } from "@/queries/notifications";

export function HeaderActions({ className }: { className?: string }) {
  const { profile, user, signOut } = useAuth();
  const unread = useUnreadNotificationCount(user?.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initials = (profile?.display_name ?? "You")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const closeMenu = () => {
    if (!signingOut) {
      setMenuOpen(false);
      setError(null);
    }
  };
  const handleSignOut = async () => {
    setSigningOut(true);
    setError(null);
    try {
      await signOut();
      setMenuOpen(false);
    } catch {
      setError("Couldn’t sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <View className={cn("flex-row items-center gap-2", className)}>
      <Link href={routes.activity} asChild>
        <Button
          accessibilityLabel="Open activity"
          className="relative size-10 rounded-full border border-border bg-card p-0"
          size="icon"
          variant="ghost"
        >
          <Icon as={Bell} className="size-4 text-card-foreground" />
          {(unread.data ?? 0) > 0 ? (
            <View className="absolute right-1 top-1 size-1.5 rounded-full bg-primary" />
          ) : null}
        </Button>
      </Link>
      <Button
        accessibilityLabel="Open account menu"
        accessibilityState={{ expanded: menuOpen }}
        className="size-10 overflow-hidden rounded-full border border-border p-0"
        onPress={() => setMenuOpen(true)}
        size="icon"
        variant="ghost"
      >
        <Avatar alt="Your profile" className="size-full">
          {profile?.avatar_url ? (
            <AvatarImage source={{ uri: profile.avatar_url }} />
          ) : null}
          <AvatarFallback>
            <Text className="text-xs font-semibold">{initials}</Text>
          </AvatarFallback>
        </Avatar>
      </Button>
      <Modal
        transparent
        visible={menuOpen}
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <View className="flex-1">
          <Pressable
            accessibilityLabel="Close account menu"
            accessibilityRole="button"
            className="absolute inset-0"
            onPress={closeMenu}
          />
          <SafeAreaView
            edges={["top"]}
            pointerEvents="box-none"
            className="items-end px-3"
          >
            <View className="mt-14 w-64 rounded-xl border border-border bg-popover shadow-lg">
              <View className="flex-row items-center gap-3 border-b border-border p-4">
                <Avatar
                  alt="Your profile"
                  className="size-11 border border-border"
                >
                  {profile?.avatar_url ? (
                    <AvatarImage source={{ uri: profile.avatar_url }} />
                  ) : null}
                  <AvatarFallback>
                    <Text className="font-semibold">{initials}</Text>
                  </AvatarFallback>
                </Avatar>
                <View className="min-w-0 flex-1">
                  <Text className="font-semibold" numberOfLines={1}>
                    {profile?.display_name ?? "Your profile"}
                  </Text>
                  {profile?.username ? (
                    <Text variant="muted" className="text-sm" numberOfLines={1}>
                      @{profile.username}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View className="p-1">
                <Button
                  accessibilityLabel="View your profile"
                  className="w-full justify-start"
                  disabled={signingOut}
                  onPress={() => {
                    closeMenu();
                    router.push(routes.profile);
                  }}
                  size="sm"
                  variant="ghost"
                >
                  <Text>View profile</Text>
                </Button>
                <Button
                  accessibilityLabel="Sign out"
                  className="w-full justify-start"
                  disabled={signingOut}
                  onPress={() => void handleSignOut()}
                  size="sm"
                  variant="ghost"
                >
                  <Icon as={LogOut} className="size-4 text-foreground" />
                  <Text>{signingOut ? "Signing out…" : "Sign out"}</Text>
                </Button>
                {error ? (
                  <Text className="px-3 pb-2 text-xs text-destructive">
                    {error}
                  </Text>
                ) : null}
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}
