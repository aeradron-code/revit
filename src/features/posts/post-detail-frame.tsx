import type { ReactNode } from "react";
import { Stack } from "expo-router";

import { AppHeader } from "@/components/navigation/app-header";
import { SafeAreaView } from "@/components/ui/safe-area-view";

export function PostDetailFrame({
  children,
  onBack,
  title,
  showAccountActions = true,
}: {
  children: ReactNode;
  onBack: () => void;
  title: string;
  showAccountActions?: boolean;
}) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <Stack.Screen
        options={{
          header: () => (
            <AppHeader
              showAccountActions={showAccountActions}
              title={title}
              onBack={onBack}
            />
          ),
        }}
      />
      {children}
    </SafeAreaView>
  );
}
