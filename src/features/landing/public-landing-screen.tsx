import { Image } from "expo-image";
import { Link } from "expo-router";
import {
  ArrowRight,
  Bookmark,
  Coffee,
  Layers,
  MapPin,
  MessageCircle,
  Star,
  Users,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Text } from "@/components/ui/text";
import { routes } from "@/lib/routes";

const features = [
  {
    name: "Find",
    icon: MapPin,
    detail:
      "See places and products your circle has actually tried, with ratings, photos, and the details you need to choose.",
  },
  {
    name: "Share",
    icon: Star,
    detail:
      "Rate something you’ve used or visited. Add a photo and tell people what made it worth recommending.",
  },
  {
    name: "Ask",
    icon: MessageCircle,
    detail:
      "Have a specific need? Ask your circle for ideas, then follow up with questions in the conversation.",
  },
  {
    name: "Picks",
    icon: Layers,
    detail:
      "Bring favorite Finds together in a list, order them your way, and share it with someone planning their next stop.",
  },
  {
    name: "Forums",
    icon: Users,
    detail:
      "Join conversations around the things you care about and get advice from people who know the subject.",
  },
];

export function PublicLandingScreen() {
  const [preview, setPreview] = useState<"Review" | "Pick">("Review");
  return (
    <SafeAreaView
      className="relative flex-1 bg-background"
      edges={["top", "left", "right", "bottom"]}
    >
      <View
        pointerEvents="none"
        className="public-landing-atmosphere pointer-events-none absolute inset-0"
      />
      <ScrollView
        className="flex-1 bg-transparent"
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View className="w-full flex-1">
          <View className="mx-auto w-full max-w-6xl flex-1 px-5 pb-8 md:px-8">
            <View className="flex-row items-center justify-between gap-3 py-5">
              <Link href="/" push asChild>
                <Pressable
                  accessibilityLabel="Revit home"
                  accessibilityRole="link"
                  className="flex flex-row items-center gap-2.5 no-underline"
                >
                  <Image
                    source={require("../../../assets/images/revit-logo.svg")}
                    accessibilityLabel="Revit logo"
                    contentFit="contain"
                    style={{ width: 30, height: 30 }}
                  />
                  <Text className="text-xl font-bold tracking-tight">
                    revit
                  </Text>
                </Pressable>
              </Link>
              <View className="flex-row items-center gap-2 sm:gap-4">
                <a
                  href="#how-it-works"
                  className="hidden px-2 text-sm font-medium text-muted-foreground no-underline hover:text-foreground sm:block"
                >
                  How it works
                </a>
                <Link
                  href={routes.auth}
                  push
                  className="rounded-md px-3 py-2.5 text-sm font-semibold text-foreground no-underline hover:bg-selected"
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/sign-up"
                  push
                  className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground no-underline hover:opacity-90"
                >
                  Get started
                </Link>
              </View>
            </View>
            <View className="mt-6 gap-8 md:mt-8 md:flex-row md:items-center md:gap-12 md:py-4">
              <View className="items-start gap-5 md:flex-1">
                <Text
                  variant="h1"
                  className="text-4xl leading-tight md:text-5xl md:leading-tight"
                >
                  Good finds.{"\n"}Trusted opinions.
                </Text>
                <Text className="text-base leading-7 text-muted-foreground md:text-lg md:leading-7">
                  Find places and products your circle loves. Share what you’ve
                  tried, and ask for ideas tailored to what you need.
                </Text>
                <View className="flex-row flex-wrap items-center gap-x-5 gap-y-3">
                  <Link href="/auth/sign-up" push asChild>
                    <Pressable
                      accessibilityRole="link"
                      className="flex flex-row items-center gap-2 rounded-md bg-primary px-4 py-3"
                    >
                      <Text className="font-semibold text-primary-foreground">
                        Join Revit
                      </Text>
                      <Icon
                        as={ArrowRight}
                        className="size-4 text-primary-foreground"
                      />
                    </Pressable>
                  </Link>
                  <a
                    href="#how-it-works"
                    className="text-sm font-semibold text-foreground underline underline-offset-4"
                  >
                    See how it works
                  </a>
                </View>
              </View>
              <Card className="overflow-hidden gap-0 rounded-xl border-border pt-0 shadow-sm md:flex-1">
                <View className="relative">
                  <Image
                    source={require("../../../assets/images/landing-cafe.jpg")}
                    accessibilityLabel="Coffee and a cardamom bun beside an open book"
                    contentFit="cover"
                    style={{ width: "100%", aspectRatio: 2.15 }}
                  />
                  <Badge
                    variant="secondary"
                    className="absolute bottom-3 left-3 bg-card"
                  >
                    <Icon as={Coffee} className="size-3" />
                    <Text>Example Find</Text>
                  </Badge>
                </View>
                <CardContent className="gap-3 pt-4">
                  <View className="flex-row flex-wrap items-center justify-between gap-2">
                    <Text variant="h2">Window Seat Café</Text>
                    <View className="flex-row gap-1 rounded-lg bg-muted p-1">
                      {(["Review", "Pick"] as const).map((item) => (
                        <Button
                          key={item}
                          size="xs"
                          variant={preview === item ? "default" : "ghost"}
                          accessibilityLabel={`Show example ${item}`}
                          accessibilityState={{ selected: preview === item }}
                          onPress={() => setPreview(item)}
                        >
                          <Icon
                            as={item === "Review" ? Star : Bookmark}
                            className="size-3"
                          />
                          <Text>{item}</Text>
                        </Button>
                      ))}
                    </View>
                  </View>
                  <View
                    accessibilityLiveRegion="polite"
                    className="min-h-24 gap-2 border-t border-border pt-3"
                  >
                    {preview === "Review" ? (
                      <>
                        <View className="flex-row items-center gap-2">
                          <Text className="text-rating" aria-hidden>
                            ★★★★☆
                          </Text>
                          <Text variant="small">4 out of 5</Text>
                        </View>
                        <Text variant="p">
                          “I’d go back for the cardamom bun alone. Grab the
                          table by the window if you’re bringing a book.”
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text variant="small">Saturday coffee crawl</Text>
                        {[
                          "Window Seat Café · Cardamom bun",
                          "Corner Roasters · Cold brew",
                        ].map((stop, i) => (
                          <View
                            key={stop}
                            className="flex-row items-center gap-2"
                          >
                            <Badge variant="secondary">
                              <Text>{i + 1}</Text>
                            </Badge>
                            <Text>{stop}</Text>
                          </View>
                        ))}
                      </>
                    )}
                  </View>
                </CardContent>
              </Card>
            </View>
            <View
              nativeID="how-it-works"
              className="mt-8 gap-5 border-t border-border pt-6 md:mt-10 md:pt-7"
            >
              <View className="gap-1">
                <Text variant="h2">
                  Good recommendations start with real experiences.
                </Text>
                <Text variant="muted" className="text-sm">
                  Find a place worth visiting. Share something you’ve tried. Get
                  advice that fits your life.
                </Text>
              </View>
              <View className="gap-3">
                {[features.slice(0, 3), features.slice(3)].map(
                  (row, rowIndex) => (
                    <View key={rowIndex} className="gap-3 md:flex-row">
                      {row.map(({ name, icon, detail }) => (
                        <Card
                          key={name}
                          className="rounded-xl border-border bg-card/80 py-4 md:flex-1"
                        >
                          <CardContent className="gap-3">
                            <View className="flex-row items-center gap-3">
                              <View className="size-10 items-center justify-center rounded-lg bg-selected">
                                <Icon
                                  as={icon}
                                  className="size-5 text-primary dark:text-foreground"
                                />
                              </View>
                              <Text variant="h3">{name}</Text>
                            </View>
                            <Text
                              variant="p"
                              className="text-sm leading-6 text-muted-foreground"
                            >
                              {detail}
                            </Text>
                          </CardContent>
                        </Card>
                      ))}
                    </View>
                  ),
                )}
              </View>
            </View>
          </View>
          <View className="mt-auto border-t border-border bg-secondary/20">
            <View className="mx-auto w-full max-w-6xl px-5 pt-7 md:px-8">
              <View className="flex-col items-start justify-between gap-5 sm:flex-row sm:items-start">
                <View className="flex-row items-center gap-3">
                  <Image
                    source={require("../../../assets/images/aeradron-mark.png")}
                    accessibilityLabel="Aeradron logo"
                    contentFit="contain"
                    style={{ width: 24, height: 32 }}
                  />
                  <View className="gap-0.5">
                    <Text className="font-semibold">Aeradron</Text>
                    <Text
                      variant="small"
                      className="text-xs text-muted-foreground"
                    >
                      Revit, by Aeradron
                    </Text>
                  </View>
                </View>
                <View className="flex-col items-start gap-2.5 sm:items-end">
                  {(["support", "privacy", "terms"] as const).map((key) => (
                    <Link href={routes[key]} key={key} push>
                      <Text
                        variant="small"
                        className="capitalize text-muted-foreground"
                      >
                        {key}
                      </Text>
                    </Link>
                  ))}
                </View>
              </View>
              <View className="mt-6 flex-row flex-wrap items-center justify-between gap-2 border-t border-border/70 py-4">
                <Text variant="small" className="text-xs text-muted-foreground">
                  © 2026 Aeradron
                </Text>
                <Text variant="small" className="text-xs text-muted-foreground">
                  Good finds. Trusted opinions.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
