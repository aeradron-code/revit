import { type Href, router, Stack } from "expo-router";
import { type ReactNode, useRef, useState } from "react";
import { View } from "react-native";

import type { IdempotentPostKind } from "@/api/posts";
import { AppHeader } from "@/components/navigation/app-header";
import { Button } from "@/components/ui/button";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Text } from "@/components/ui/text";
import { routes } from "@/lib/routes";
import {
  useDiscardPostRecovery,
  usePostRecovery,
  useResolvePostRecovery,
} from "@/queries/creation-recovery";

export function PostRecoveryGate({
  userId,
  kinds,
  children,
  closeRoute,
}: {
  userId: string;
  kinds: IdempotentPostKind[];
  children: ReactNode;
  closeRoute: Href;
}) {
  const recovery = usePostRecovery(userId, kinds);
  if (recovery.isFetching || recovery.isError)
    return (
      <Shell closeRoute={closeRoute}>
        <Text>
          {recovery.isError
            ? "We couldn’t check saved post recovery."
            : "Checking your previous post…"}
        </Text>
        {recovery.isError ? (
          <Button onPress={() => void recovery.refetch()}>
            <Text>Retry</Text>
          </Button>
        ) : null}
      </Shell>
    );
  if (recovery.data)
    return (
      <SavedPostRecovery
        key={`${userId}:${recovery.data.operationId}`}
        userId={userId}
        closeRoute={closeRoute}
        {...recovery.data}
      />
    );
  return children;
}

function Shell({
  closeRoute,
  children,
}: {
  closeRoute: Href;
  children: ReactNode;
}) {
  return (
    <SafeAreaView className="flex-1 bg-background p-4" edges={["bottom"]}>
      <Stack.Screen
        options={{
          header: () => (
            <AppHeader
              leading="close"
              title="Create post"
              onLeadingPress={() => router.replace(closeRoute)}
            />
          ),
        }}
      />
      <View className="gap-3">{children}</View>
    </SafeAreaView>
  );
}

function SavedPostRecovery({
  userId,
  operationId,
  kind,
  closeRoute,
}: {
  userId: string;
  operationId: string;
  kind: IdempotentPostKind;
  closeRoute: Href;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const inFlight = useRef(false);
  const resolveRecovery = useResolvePostRecovery();
  const discardRecovery = useDiscardPostRecovery();
  const run = async (discard: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const result = discard
        ? null
        : await resolveRecovery.mutateAsync({ userId, operationId, kind });
      if (result?.status === "inconclusive") {
        setMessage(
          "We can’t confirm the result yet. Check again later, or start a new post knowing the earlier one may still appear.",
        );
        return;
      }
      if (discard)
        await discardRecovery.mutateAsync({ userId, operationId, kind });
      if (result?.status === "confirmed") {
        router.replace(
          result.post.forum_id
            ? routes.forum(result.post.forum_id)
            : routes.post(result.post.id),
        );
      }
    } catch {
      setMessage(
        "We couldn’t check or clear saved post recovery. Please try again.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <Shell closeRoute={closeRoute}>
      <Text variant="h1">Check your previous post</Text>
      <Text>
        Your previous post may have been published. Check its result before
        starting another.
      </Text>
      <Button disabled={busy} onPress={() => void run(false)}>
        <Text>{busy ? "Checking…" : "Check result"}</Text>
      </Button>
      {message ? <Text variant="small">{message}</Text> : null}
      {confirmDiscard ? (
        <>
          <Text variant="small">
            Starting a new post clears this recovery. The previous post may
            still appear.
          </Text>
          <Button
            disabled={busy}
            variant="destructive"
            onPress={() => void run(true)}
          >
            <Text>Start new post anyway</Text>
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
          <Text>Start a new post</Text>
        </Button>
      )}
    </Shell>
  );
}
