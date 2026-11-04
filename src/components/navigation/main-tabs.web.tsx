import { usePathname } from "expo-router";
import { TabList, TabSlot, Tabs, TabTrigger } from "expo-router/ui";
import {
  Bookmark,
  Compass,
  House,
  Plus,
  UsersRound,
} from "lucide-react-native";
import { Pressable, View } from "react-native";
import { AppHeader } from "@/components/navigation/app-header";
import { Text } from "@/components/ui/text";
import { routes } from "@/lib/routes";

const mainItems = [
  { href: routes.home, Icon: House, name: "index", title: "Home" },
  { href: routes.discover, Icon: Compass, name: "discover", title: "Discover" },
  { href: routes.forums, Icon: UsersRound, name: "forums", title: "Forums" },
  { href: routes.picks, Icon: Bookmark, name: "picks", title: "Picks" },
] as const;

export default function MainTabs() {
  const pathname = usePathname();
  const title =
    mainItems.find((item) => item.href === pathname)?.title ??
    (pathname === routes.create ? "Create" : "Profile");

  return (
    <Tabs className="flex-1 bg-background">
      <AppHeader showAccountActions title={title} />
      <TabSlot style={{ flex: 1 }} />

      <TabList
        className="hidden"
        style={{ flexDirection: "column", justifyContent: "flex-start" }}
      >
        <Text className="px-2 pb-6 text-xl font-bold">Revit</Text>

        {mainItems.slice(0, 2).map(({ href, Icon, name, title: itemTitle }) => {
          const isActive = pathname === href;

          return (
            <TabTrigger
              key={name}
              asChild
              href={href}
              name={name}
              style={{ justifyContent: "flex-start" }}
            >
              <Pressable
                accessibilityLabel={`Open ${itemTitle}`}
                className={`mb-1 h-10 flex-row items-center justify-start gap-3 rounded-md px-3 active:bg-selected ${
                  isActive ? "bg-selected" : ""
                }`}
              >
                <Icon
                  className={
                    isActive
                      ? "text-primary dark:text-foreground"
                      : "text-muted-foreground"
                  }
                  size={16}
                  strokeWidth={2}
                />
                <Text
                  className={`text-sm ${
                    isActive
                      ? "font-semibold text-primary dark:text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {itemTitle}
                </Text>
              </Pressable>
            </TabTrigger>
          );
        })}

        <TabTrigger
          asChild
          href={routes.create}
          name="create"
          style={{ justifyContent: "flex-start" }}
        >
          <Pressable
            accessibilityLabel="Create a new post"
            className={`h-10 flex-row items-center justify-start gap-2 rounded-md bg-primary px-3 active:bg-primary/85 ${
              pathname === routes.create ? "opacity-85" : ""
            }`}
          >
            <Plus
              className="text-primary-foreground"
              size={16}
              strokeWidth={2.5}
            />
            <Text className="text-sm font-semibold text-primary-foreground">
              Create
            </Text>
          </Pressable>
        </TabTrigger>

        {mainItems.slice(2).map(({ href, Icon, name, title: itemTitle }) => {
          const isActive = pathname === href;

          return (
            <TabTrigger
              key={name}
              asChild
              href={href}
              name={name}
              style={{ justifyContent: "flex-start" }}
            >
              <Pressable
                accessibilityLabel={`Open ${itemTitle}`}
                className={`mb-1 h-10 flex-row items-center justify-start gap-3 rounded-md px-3 active:bg-selected ${
                  isActive ? "bg-selected" : ""
                }`}
              >
                <Icon
                  className={
                    isActive
                      ? "text-primary dark:text-foreground"
                      : "text-muted-foreground"
                  }
                  size={16}
                  strokeWidth={2}
                />
                <Text
                  className={`text-sm ${
                    isActive
                      ? "font-semibold text-primary dark:text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {itemTitle}
                </Text>
              </Pressable>
            </TabTrigger>
          );
        })}

        <View className="flex-1" />

        <TabTrigger asChild href={routes.profile} name="profile">
          <Pressable className="hidden" accessibilityLabel="Open profile" />
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}
