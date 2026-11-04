import { type Href, router, Stack } from "expo-router";
import { type ReactNode, useRef, useState } from "react";
import { View } from "react-native";
import type { ResourceCreationKind } from "@/api/creation-recovery";
import { AppHeader } from "@/components/navigation/app-header";
import { Button } from "@/components/ui/button";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Text } from "@/components/ui/text";
import {
  useDiscardResourceRecovery,
  useResolveResourceRecovery,
  useResourceRecovery,
} from "@/queries/creation-recovery";

export function ResourceRecoveryGate({
  userId,
  kind,
  children,
  closeRoute,
  resultRoute,
}: {
  userId: string;
  kind: ResourceCreationKind;
  children: ReactNode;
  closeRoute: Href;
  resultRoute: (id: string) => Href;
}) {
  const recovery = useResourceRecovery(userId, kind);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const inFlight = useRef(false);
  const resolveRecovery = useResolveResourceRecovery();
  const discardRecovery = useDiscardResourceRecovery();
  if (!recovery.isFetching && !recovery.isError && !recovery.data)
    return children;
  const run = async (discard: boolean) => {
    if (!recovery.data || inFlight.current) return;
    const operationId = recovery.data;
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const resourceId = discard
        ? null
        : await resolveRecovery.mutateAsync({ userId, operationId, kind });
      if (!discard && !resourceId) {
        setMessage(
          "We can’t confirm the result yet. Check again later, or start again knowing the earlier creation may still appear.",
        );
        return;
      }
      if (discard)
        await discardRecovery.mutateAsync({ userId, operationId, kind });
      if (resourceId) router.replace(resultRoute(resourceId));
    } catch {
      setMessage(
        "We couldn’t check or clear saved recovery. Please try again.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const label = kind === "FORUM" ? "forum" : "find";
  return (
    <SafeAreaView className="flex-1 bg-background p-4" edges={["bottom"]}>
      <Stack.Screen
        options={{
          header: () => (
            <AppHeader
              leading="close"
              title={`Create ${label}`}
              onLeadingPress={() => router.replace(closeRoute)}
            />
          ),
        }}
      />
      <View className="gap-3">
        {recovery.isFetching ? (
          <Text>Checking your previous {label}…</Text>
        ) : recovery.isError ? (
          <>
            <Text>We couldn’t check saved recovery.</Text>
            <Button onPress={() => void recovery.refetch()}>
              <Text>Retry</Text>
            </Button>
          </>
        ) : (
          <>
            <Text variant="h1">Check your previous {label}</Text>
            <Text>
              Your previous {label} may have been created. Check its result
              before starting another.
            </Text>
            <Button disabled={busy} onPress={() => void run(false)}>
              <Text>{busy ? "Checking…" : "Check result"}</Text>
            </Button>
            {message ? <Text variant="small">{message}</Text> : null}
            {confirmDiscard ? (
              <>
                <Text variant="small">
                  Starting again clears recovery. The previous {label} may still
                  appear.
                </Text>
                <Button
                  disabled={busy}
                  variant="destructive"
                  onPress={() => void run(true)}
                >
                  <Text>Start again anyway</Text>
                </Button>
                <Button
                  disabled={busy}
                  variant="ghost"
                  onPress={() => setConfirmDiscard(false)}
                >
                  <Text>Cancel</Text>
                </Button>
              </>
            ) : (
              <Button
                disabled={busy}
                variant="outline"
                onPress={() => setConfirmDiscard(true)}
              >
                <Text>Start again</Text>
              </Button>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
