import { router, Stack, useLocalSearchParams } from "expo-router";

import { AppHeader } from "@/components/navigation/app-header";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import {
  ProfileLoadingScreen,
  ProfileMessageScreen,
} from "@/features/profile/profile-state-screen";
import { ProfileView } from "@/features/profile/profile-view";
import { routes } from "@/lib/routes";
import { useProfileByUsername } from "@/queries/profiles";

export default function UserProfileScreen() {
  const params = useLocalSearchParams<{ username?: string | string[] }>();
  const username = Array.isArray(params.username)
    ? params.username[0]
    : (params.username ?? "");
  const profile = useProfileByUsername(username.toLowerCase());
  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(routes.discover);
  };

  if (profile.isLoading) {
    return (
      <UserProfileFrame onBack={goBack}>
        <ProfileLoadingScreen />
      </UserProfileFrame>
    );
  }

  if (profile.isError) {
    return (
      <UserProfileFrame onBack={goBack}>
        <ProfileMessageScreen
          title="Profile unavailable"
          description="We couldn&apos;t load this profile. Check your connection and try again."
          action={() => void profile.refetch()}
        />
      </UserProfileFrame>
    );
  }

  if (!profile.data) {
    return (
      <UserProfileFrame onBack={goBack}>
        <ProfileMessageScreen
          title="Profile not found"
          description="This username doesn&apos;t belong to an available profile."
        />
      </UserProfileFrame>
    );
  }

  return (
    <UserProfileFrame onBack={goBack}>
      <ProfileView profile={profile.data} />
    </UserProfileFrame>
  );
}

function UserProfileFrame({
  children,
  onBack,
}: {
  children: React.ReactNode;
  onBack: () => void;
}) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <Stack.Screen
        options={{
          header: () => (
            <AppHeader showAccountActions title="Profile" onBack={onBack} />
          ),
        }}
      />
      {children}
    </SafeAreaView>
  );
}
