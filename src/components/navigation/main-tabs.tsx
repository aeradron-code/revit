import { Tabs } from "expo-router";
import {
  Bookmark,
  Compass,
  House,
  type LucideIcon,
  Plus,
  UserRound,
  UsersRound,
} from "lucide-react-native";
import { type ColorValue, Platform, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUniwind } from "uniwind";

import { AppHeader } from "@/components/navigation/app-header";
import { useTheme } from "@/hooks/use-theme";

export default function MainTabs() {
  const theme = useTheme();
  const { theme: themeName } = useUniwind();
  const isDark = themeName === "dark";
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);
  // CSS keeps web insets current without interrupting streamed hydration.
  const tabBarInsets = (Platform.OS === "web"
    ? {
        height: "calc(58px + max(env(safe-area-inset-bottom, 0px), 8px))",
        paddingBottom: "max(env(safe-area-inset-bottom, 0px), 8px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }
    : { height: 58 + bottomPadding, paddingBottom: bottomPadding }) as ViewStyle;

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: true,
        header: () => (
          <AppHeader
            showAccountActions
            title={tabTitles[route.name] ?? "Profile"}
          />
        ),
        headerShadowVisible: false,
        tabBarActiveTintColor: isDark ? theme.text : theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", marginTop: 2 },
        tabBarStyle: {
          backgroundColor: theme.backgroundElement,
          borderTopColor: theme.border,
          ...tabBarInsets,
          paddingTop: 6,
        },
      })}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: tabIcon(House) }}
      />
      <Tabs.Screen
        name="discover"
        options={{ title: "Discover", tabBarIcon: tabIcon(Compass) }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "Create",
          tabBarIcon: ({ size }) => (
            <View className="-mt-4 size-11 items-center justify-center rounded-full bg-primary shadow-sm shadow-primary/20">
              <Plus color="white" size={size + 4} strokeWidth={2.5} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="forums"
        options={{ title: "Forums", tabBarIcon: tabIcon(UsersRound) }}
      />
      <Tabs.Screen
        name="picks"
        options={{ title: "Picks", tabBarIcon: tabIcon(Bookmark) }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarButton: () => null,
          tabBarItemStyle: { display: "none" },
          title: "Profile",
          tabBarIcon: tabIcon(UserRound),
        }}
      />
    </Tabs>
  );
}

const tabTitles: Record<string, string> = {
  index: "Home",
  discover: "Discover",
  create: "Create",
  forums: "Forums",
  picks: "Picks",
  profile: "Profile",
};

function tabIcon(IconComponent: LucideIcon) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <IconComponent color={String(color)} size={size} strokeWidth={2.2} />
  );
}
