import { Link } from "expo-router";
import {
  ArrowRight,
  Bookmark,
  MessageCircleQuestion,
  Star,
  UsersRound,
} from "lucide-react-native";
import { ScrollView, View } from "react-native";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Text } from "@/components/ui/text";
import { routes } from "@/lib/routes";

export function CreateChoiceScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["left", "right"]}>
      <ScrollView contentContainerClassName="w-full gap-6 px-6 pb-8 pt-4 md:mx-auto md:max-w-3xl md:px-6 md:pb-12 md:pt-6">
        <View className="gap-2 py-1">
          <Text variant="h1" className="text-left">
            Share your taste
          </Text>
          <Text variant="muted" className="text-base leading-6">
            Choose what you’d like to share with the community.
          </Text>
        </View>

        <View className="gap-4">
          <View className="items-stretch gap-4 sm:flex-row">
            <Card className="flex-1 justify-between gap-4 p-4">
              <CardHeader className="gap-3 px-0">
                <View className="size-9 items-center justify-center rounded-md bg-selected">
                  <Icon as={MessageCircleQuestion} className="text-primary" />
                </View>
                <CardTitle className="text-lg">Ask for ratings</CardTitle>
                <CardDescription className="leading-5">
                  Post a question and let people respond with a 1–5 rating.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <Link href={routes.createAsk} asChild>
                  <Button className="w-full">
                    <Text>Start an Ask</Text>
                    <Icon as={ArrowRight} />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="flex-1 justify-between gap-4 p-4">
              <CardHeader className="gap-3 px-0">
                <View className="size-9 items-center justify-center rounded-md bg-elevated">
                  <Icon as={Star} className="text-rating" />
                </View>
                <CardTitle className="text-lg">Share a rating</CardTitle>
                <CardDescription className="leading-5">
                  Rate a find and add an optional review or photos.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <Link href={routes.createShare} asChild>
                  <Button variant="outline" className="w-full">
                    <Text>Rate a find</Text>
                    <Icon as={ArrowRight} />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </View>

          <View className="items-stretch gap-4 sm:flex-row">
            <Card className="flex-1 justify-between gap-4 p-4">
              <CardHeader className="gap-3 px-0">
                <View className="size-9 items-center justify-center rounded-md bg-selected">
                  <Icon as={UsersRound} className="text-primary" />
                </View>
                <CardTitle className="text-lg">Create a forum</CardTitle>
                <CardDescription className="leading-5">
                  Start a public space for focused conversations.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <Link href={routes.createForum} asChild>
                  <Button variant="outline" className="w-full">
                    <Text>Create a forum</Text>
                    <Icon as={ArrowRight} />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="flex-1 justify-between gap-4 p-4">
              <CardHeader className="gap-3 px-0">
                <View className="size-9 items-center justify-center rounded-md bg-elevated">
                  <Icon as={Bookmark} className="text-primary" />
                </View>
                <CardTitle className="text-lg">Create a Pick</CardTitle>
                <CardDescription className="leading-5">
                  Build an ordered list of finds to share.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <Link href={routes.createPick} asChild>
                  <Button variant="outline" className="w-full">
                    <Text>Create a Pick</Text>
                    <Icon as={ArrowRight} />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
