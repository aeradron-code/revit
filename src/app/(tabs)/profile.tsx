import { ProfileMessageScreen } from "@/features/profile/profile-state-screen";
import { ProfileView } from "@/features/profile/profile-view";
import { useAuth } from "@/providers/auth-provider";

export default function ProfileScreen() {
  const { profile } = useAuth();

  if (!profile) {
    return (
      <ProfileMessageScreen
        title="Profile unavailable"
        description="We couldn&apos;t load your profile. Please restart the app and try again."
      />
    );
  }

  return <ProfileView profile={profile} isOwnProfile />;
}
