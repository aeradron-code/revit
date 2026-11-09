import { Stack } from "expo-router";
import { ScrollView, View } from "react-native";

import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Text } from "@/components/ui/text";

export type LegalSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export function LegalDocumentScreen({
  intro,
  sections,
  title,
}: {
  intro: string;
  sections: LegalSection[];
  title: string;
}) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <Stack.Screen options={{ title }} />
      <ScrollView
        className="flex-1"
        contentContainerClassName="mx-auto w-full max-w-3xl gap-6 px-5 py-5 md:px-8 md:py-8"
      >
        <View className="gap-2">
          <Text variant="h1">{title}</Text>
          <Text variant="muted">Last updated: 9 November 2026</Text>
          <Text className="pt-2 leading-6">{intro}</Text>
        </View>
        {sections.map((section) => (
          <View key={section.title} className="gap-2">
            <Text variant="h2">{section.title}</Text>
            {section.paragraphs.map((paragraph) => (
              <Text key={`${section.title}-${paragraph}`} className="leading-6">
                {paragraph}
              </Text>
            ))}
            {section.bullets?.map((bullet) => (
              <Text
                key={`${section.title}-${bullet}`}
                className="pl-2 leading-6"
              >
                • {bullet}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
