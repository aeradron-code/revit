import { Link, Stack } from "expo-router";
import { ScrollView, View } from "react-native";

import { Button } from "@/components/ui/button";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Text } from "@/components/ui/text";
import { routes } from "@/lib/routes";

export default function SupportScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <Stack.Screen options={{ title: "Support" }} />
      <ScrollView
        className="flex-1"
        contentContainerClassName="mx-auto w-full max-w-2xl gap-6 px-5 py-5 md:px-8 md:py-8"
      >
        <View className="gap-2">
          <Text variant="h1">Revit Support</Text>
          <Text className="leading-6">
            Contact Aeradron for help with your Revit account, privacy, or app
            issues. Include your username and a short description. Never send
            your password or sign-in codes.
          </Text>
        </View>

        <View className="gap-3 rounded-xl border border-border bg-card p-4">
          <Text variant="h2">Contact Aeradron</Text>
          <Link href="mailto:aeradron@gmail.com" asChild>
            <Button className="self-start" variant="outline">
              <Text>Email aeradron@gmail.com</Text>
            </Button>
          </Link>
          <Link href="tel:+917899270142" asChild>
            <Button className="self-start" variant="outline">
              <Text>Call +91 7899270142</Text>
            </Button>
          </Link>
        </View>

        <View className="gap-2">
          <Text variant="h2">Report or block an account</Text>
          <Text className="leading-6">
            Open the three-dot menu on a profile, post, comment, Find, forum, or
            Pick to report it. On a profile, you can also block that person. A
            report marked “Reviewed” means an administrator has reviewed it; it
            does not automatically remove content or disable an account.
          </Text>
        </View>

        <View className="gap-2">
          <Text variant="h2">Account and sign-in help</Text>
          <Text className="leading-6">
            You can change profile details or request account deletion in
            Settings. If you cannot sign in with your password, use “Forgot
            password?” on the sign-in screen.
          </Text>
          <Link href={routes.privacy} asChild>
            <Button className="self-start" variant="ghost">
              <Text>Read the Privacy Policy</Text>
            </Button>
          </Link>
          <Link href={routes.terms} asChild>
            <Button className="self-start" variant="ghost">
              <Text>Read the Terms and Conditions</Text>
            </Button>
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
