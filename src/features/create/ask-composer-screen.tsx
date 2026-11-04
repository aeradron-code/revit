import { randomUUID } from "expo-crypto";
import type * as ImagePicker from "expo-image-picker";
import { router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { API_ERROR_MESSAGES, normalizeApiError } from "@/api/errors";
import type { AskCreationAttempt } from "@/api/posts";
import { ImagePickerCarousel } from "@/components/media/image-picker-carousel";
import { AppHeader } from "@/components/navigation/app-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { successFeedback } from "@/lib/feedback";
import { routes } from "@/lib/routes";
import { useAuthUser } from "@/providers/auth-provider";
import {
  useAskRecovery,
  useDiscardAskRecovery,
  useResolveAskRecovery,
} from "@/queries/creation-recovery";
import { useCreateAskPost } from "@/queries/posts";

const MAX_IMAGES = 3;

export function AskComposerScreen() {
  const user = useAuthUser();
  const recovery = useAskRecovery(user?.id ?? "");

  if (!user || recovery.isFetching) {
    return <RecoveryMessage message="Checking your previous post…" />;
  }
  if (recovery.isError) {
    return (
      <RecoveryMessage
        message="We couldn’t check saved post recovery. Please try again."
        retry={() => void recovery.refetch()}
      />
    );
  }
  if (recovery.data) {
    return (
      <SavedAskRecovery
        key={`${user.id}:${recovery.data}`}
        userId={user.id}
        operationId={recovery.data}
      />
    );
  }
  return <AskComposerForm key={user.id} />;
}

function RecoveryMessage({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <SafeAreaView className="flex-1 bg-background p-4" edges={["bottom"]}>
      <Stack.Screen
        options={{
          header: () => (
            <AppHeader
              leading="close"
              title="Create post"
              onLeadingPress={() => router.replace(routes.create)}
            />
          ),
        }}
      />
      <View className="gap-3">
        <Text>{message}</Text>
        {retry ? (
          <Button onPress={retry} variant="outline">
            <Text>Retry</Text>
          </Button>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function SavedAskRecovery({
  userId,
  operationId,
}: {
  userId: string;
  operationId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const resolveRecovery = useResolveAskRecovery();
  const discardRecovery = useDiscardAskRecovery();
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const check = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const result = await resolveRecovery.mutateAsync({ userId, operationId });
      if (!mounted.current) return;
      if (result.status === "confirmed") {
        if (mounted.current) router.replace(routes.post(result.post.id));
      } else {
        setMessage(
          "We can’t confirm the result yet. Check again later, or start a new post knowing the earlier one may still appear.",
        );
      }
    } catch {
      if (mounted.current)
        setMessage(
          "We couldn’t check or clear the saved post recovery. Please try again.",
        );
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const discard = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      await discardRecovery.mutateAsync({ userId, operationId });
    } catch {
      if (mounted.current)
        setMessage(
          "We couldn’t clear the saved post recovery. Please try again.",
        );
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background p-4" edges={["bottom"]}>
      <Stack.Screen
        options={{
          header: () => (
            <AppHeader
              leading="close"
              title="Create post"
              onLeadingPress={() => router.replace(routes.create)}
            />
          ),
        }}
      />
      <View className="gap-3">
        <Text variant="h1">Check your previous post</Text>
        <Text>
          Your previous post may have been published. Check its result before
          starting another.
        </Text>
        <Button disabled={busy} onPress={() => void check()}>
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
              onPress={() => void discard()}
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
      </View>
    </SafeAreaView>
  );
}

function AskComposerForm() {
  const user = useAuthUser();
  const createPost = useCreateAskPost();
  const [body, setBody] = useState("");
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [outcomeUncertain, setOutcomeUncertain] = useState(false);
  const [checkingOutcome, setCheckingOutcome] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const attempt = useRef<(AskCreationAttempt & { userId: string }) | null>(
    null,
  );
  const submitting = useRef(false);
  const mounted = useRef(true);
  const lookupController = useRef<AbortController | null>(null);
  const resolveRecovery = useResolveAskRecovery();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      lookupController.current?.abort();
    };
  }, []);
  const bodyLength = body.length;
  const canPublish =
    Boolean(user) &&
    body.trim().length >= 1 &&
    bodyLength <= 2000 &&
    !createPost.isPending &&
    !checkingOutcome;

  const publish = async () => {
    if (!user || !canPublish || submitting.current) return;
    submitting.current = true;
    setLookupMessage(null);
    if (!attempt.current || attempt.current.userId !== user.id) {
      attempt.current = { id: randomUUID(), userId: user.id };
    }

    try {
      const post = await createPost.mutateAsync({
        authorId: user.id,
        attempt: attempt.current,
        body,
        images: images.map((image) => ({
          file: image.file,
          fileName: image.fileName,
          fileSize: image.fileSize,
          mimeType: image.mimeType,
          uri: image.uri,
        })),
      });

      if (mounted.current) {
        successFeedback();
        router.replace(routes.post(post.id));
      }
    } catch {
      // The mutation error is rendered below and remains available for retry.
      if (mounted.current)
        setOutcomeUncertain(Boolean(attempt.current?.outcomeUncertain));
    } finally {
      submitting.current = false;
    }
  };

  const checkOutcome = async () => {
    const current = attempt.current;
    if (!user || !current || current.userId !== user.id || submitting.current)
      return;
    submitting.current = true;
    const controller = new AbortController();
    lookupController.current = controller;
    setCheckingOutcome(true);
    setLookupMessage(null);
    try {
      const result = await resolveRecovery.mutateAsync({
        userId: current.userId,
        operationId: current.id,
        signal: controller.signal,
      });
      if (!mounted.current || attempt.current !== current) return;
      if (result.status === "confirmed") {
        if (mounted.current) router.replace(routes.post(result.post.id));
      } else {
        setLookupMessage(
          "The result is not available yet. Retry publishing or check again.",
        );
      }
    } catch (error) {
      if (mounted.current && !controller.signal.aborted)
        setLookupMessage(
          normalizeApiError(error, API_ERROR_MESSAGES.CHECK_ASK_CREATION)
            .message,
        );
    } finally {
      if (lookupController.current === controller)
        lookupController.current = null;
      if (mounted.current) setCheckingOutcome(false);
      submitting.current = false;
    }
  };

  const closeComposer = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(routes.create);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <Stack.Screen
        options={{
          header: () => (
            <AppHeader
              leading="close"
              onLeadingPress={closeComposer}
              title="Create post"
              titleAlign="center"
              trailing={
                <Button
                  disabled={!canPublish}
                  size="sm"
                  onPress={() => void publish()}
                >
                  <Text>
                    {createPost.isPending ? "Publishing…" : "Publish"}
                  </Text>
                </Button>
              }
            />
          ),
        }}
      />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.select({ ios: "padding", default: undefined })}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="w-full gap-6 px-2 pb-8 pt-4 md:mx-auto md:max-w-2xl md:px-6 md:pb-12 md:pt-6"
        >
          <Card className="gap-6 border-border bg-card pt-4 pb-6 px-4 shadow-none">
            <View className="gap-2 py-1">
              <Text variant="h1" className="text-left">
                Ask your circle.
              </Text>
              <Text variant="muted" className="leading-5">
                A little context. Better opinions.
              </Text>
            </View>

            <View className="flex-row items-center gap-3">
              <Avatar
                alt={`${user?.email ?? "Your"} avatar`}
                className="size-9"
              >
                <AvatarFallback>
                  <Text variant="small">
                    {(user?.email?.[0] ?? "Y").toUpperCase()}
                  </Text>
                </AvatarFallback>
              </Avatar>
              <View className="gap-0.5">
                <Text className="text-sm font-semibold">
                  {user?.email?.split("@")[0] ?? "You"}
                </Text>
                <Text variant="muted">New question</Text>
              </View>
            </View>

            <View className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text variant="small">Your question</Text>
                <Text variant="muted">{bodyLength}/2000</Text>
              </View>
              <Textarea
                accessibilityLabel="Ask details"
                editable={!createPost.isPending && !outcomeUncertain}
                maxLength={2000}
                placeholder="What would you like to ask your circle?"
                value={body}
                onChangeText={(value) => {
                  if (outcomeUncertain) return;
                  if (value !== body) attempt.current = null;
                  setBody(value);
                }}
              />
            </View>

            <View className="gap-3">
              <ImagePickerCarousel
                images={images}
                onImagesChange={(value) => {
                  if (outcomeUncertain) return;
                  attempt.current = null;
                  setImages(value);
                }}
                maxImages={MAX_IMAGES}
                disabled={createPost.isPending || outcomeUncertain}
                addLabel="Add images"
              />
            </View>

            {createPost.isError ? (
              <Text variant="small" className="text-destructive">
                {
                  normalizeApiError(
                    createPost.error,
                    API_ERROR_MESSAGES.CREATE_YOUR_ASK_POST,
                  ).message
                }
              </Text>
            ) : null}
            {outcomeUncertain ? (
              <View className="gap-2">
                <Text variant="small" className="text-destructive">
                  Your post may have been published. Check the result or retry
                  publishing before editing.
                </Text>
                <Button
                  disabled={checkingOutcome || createPost.isPending}
                  onPress={() => void checkOutcome()}
                  variant="outline"
                >
                  <Text>{checkingOutcome ? "Checking…" : "Check result"}</Text>
                </Button>
                {lookupMessage ? (
                  <Text variant="small">{lookupMessage}</Text>
                ) : null}
              </View>
            ) : null}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
