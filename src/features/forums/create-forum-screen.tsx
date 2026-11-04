import type * as ImagePicker from "expo-image-picker";
import { randomUUID } from "expo-crypto";
import { router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { ImagePickerCarousel } from "@/components/media/image-picker-carousel";
import { API_ERROR_MESSAGES, normalizeApiError } from "@/api/errors";
import type { ResourceCreationAttempt } from "@/api/creation-recovery";
import { ResourceRecoveryGate } from "@/features/create/resource-recovery-gate";
import {
  FORUM_COVER_PRESENTATION,
  FORUM_IMAGE_PRESENTATION,
} from "@/components/media/image-presentation";
import { AppHeader } from "@/components/navigation/app-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { successFeedback } from "@/lib/feedback";
import { readLocalImage } from "@/lib/media/read-local-image";
import { routes } from "@/lib/routes";
import { useAuthUser } from "@/providers/auth-provider";
import { useCreateForum } from "@/queries/forums";
import { useResolveResourceRecovery } from "@/queries/creation-recovery";

export function CreateForumScreen() {
  const user = useAuthUser();
  if (!user) return null;
  return (
    <ResourceRecoveryGate
      key={user.id}
      userId={user.id}
      kind="FORUM"
      closeRoute={routes.create}
      resultRoute={routes.forum}
    >
      <CreateForumForm key={user.id} userId={user.id} />
    </ResourceRecoveryGate>
  );
}

function CreateForumForm({ userId }: { userId: string }) {
  const createForum = useCreateForum();
  const resolveRecovery = useResolveResourceRecovery();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionInFlight = useRef(false);
  const attempt = useRef<
    (ResourceCreationAttempt & { signature: string }) | null
  >(null);
  const [uncertain, setUncertain] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [forumImage, setForumImage] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [cover, setCover] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const slug = slugFromName(name);
  const canSubmit = Boolean(
    userId &&
      name.trim() &&
      slug.trim().length >= 3 &&
      !isSubmitting &&
      !checking,
  );

  const submit = async () => {
    if (!canSubmit || submissionInFlight.current) return;
    submissionInFlight.current = true;
    setIsSubmitting(true);
    setSubmissionError(null);
    const signature = JSON.stringify([
      name,
      description,
      rules,
      forumImage?.uri,
      cover?.uri,
    ]);
    if (
      !attempt.current ||
      (!uncertain && attempt.current.signature !== signature)
    )
      attempt.current = { id: randomUUID(), signature };
    const current = attempt.current;
    try {
      const forumImageUpload =
        current.preparedImages?.image ??
        (forumImage
          ? await readLocalImage({
              file: forumImage.file,
              fileName: forumImage.fileName,
              mimeType: forumImage.mimeType,
              uri: forumImage.uri,
            })
          : undefined);
      const coverImageUpload =
        current.preparedImages?.cover ??
        (cover
          ? await readLocalImage({
              file: cover.file,
              fileName: cover.fileName,
              mimeType: cover.mimeType,
              uri: cover.uri,
            })
          : undefined);
      current.preparedImages = {
        image: forumImageUpload,
        cover: coverImageUpload,
      };
      const forum = await createForum.mutateAsync({
        attempt: current,
        forumImage: forumImageUpload,
        coverImage: coverImageUpload,
        description,
        name,
        ownerId: userId,
        rules,
        slug,
      });
      if (mounted.current) {
        successFeedback();
        router.replace(routes.forum(forum.id));
      }
    } catch (error) {
      if (!mounted.current) return;
      setUncertain(Boolean(current.outcomeUncertain));
      setSubmissionError(
        normalizeApiError(error, API_ERROR_MESSAGES.CREATE_THIS_FORUM).message,
      );
    } finally {
      submissionInFlight.current = false;
      if (mounted.current) setIsSubmitting(false);
    }
  };

  const checkOutcome = async () => {
    const current = attempt.current;
    if (!current || submissionInFlight.current) return;
    submissionInFlight.current = true;
    setChecking(true);
    setLookupMessage(null);
    try {
      const id = await resolveRecovery.mutateAsync({
        userId,
        operationId: current.id,
        kind: "FORUM",
      });
      if (!id) {
        if (mounted.current)
          setLookupMessage(
            "The result is not available yet. Retry creating or check again.",
          );
        return;
      }
      if (mounted.current) router.replace(routes.forum(id));
    } catch {
      if (mounted.current)
        setLookupMessage(
          "We couldn’t check or clear saved recovery. Please try again.",
        );
    } finally {
      submissionInFlight.current = false;
      if (mounted.current) setChecking(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <Stack.Screen
        options={{
          header: () => (
            <AppHeader
              leading="close"
              onLeadingPress={() => router.replace(routes.create)}
              title="Forums"
              titleAlign="center"
              trailing={
                <Button
                  disabled={!canSubmit}
                  size="sm"
                  onPress={() => void submit()}
                >
                  <Text>{isSubmitting ? "Creating…" : "Create"}</Text>
                </Button>
              }
            />
          ),
        }}
      />
      <ScrollView
        pointerEvents={uncertain || isSubmitting || checking ? "none" : "auto"}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="w-full gap-5 px-2 pb-8 pt-4 md:mx-auto md:max-w-2xl md:pb-12 md:pt-6"
      >
        <Card className="gap-5 border-border bg-card p-5 shadow-none md:p-6">
          <View className="gap-1.5 border-b border-border pb-4">
            <Text variant="h1" className="text-left">
              Create forum
            </Text>
            <Text variant="muted" className="leading-5">
              You become the owner and first member.
            </Text>
          </View>

          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text variant="small">Forum name</Text>
              <Text variant="muted">{name.length}/100</Text>
            </View>
            <Input
              accessibilityLabel="Forum name"
              editable={!isSubmitting && !uncertain && !checking}
              maxLength={100}
              placeholder="Give your forum a clear name"
              value={name}
              onChangeText={setName}
            />
          </View>

          <View className="gap-2.5">
            <View className="gap-0.5">
              <Text variant="small">Forum image (optional)</Text>
              <Text variant="muted">
                A square image shown beside your forum name.
              </Text>
            </View>
            <ImagePickerCarousel
              images={forumImage ? [forumImage] : []}
              onImagesChange={(images) => setForumImage(images[0] ?? null)}
              maxImages={1}
              selectionLimit={1}
              presentation={FORUM_IMAGE_PRESENTATION}
              replaceExisting
              addLabel={forumImage ? "Change forum image" : "Add forum image"}
              disabled={isSubmitting}
            />
          </View>

          <View className="gap-2.5">
            <View className="gap-0.5">
              <Text variant="small">Cover image (optional)</Text>
              <Text variant="muted">
                A wide banner displayed across the top of your forum.
              </Text>
            </View>
            <ImagePickerCarousel
              images={cover ? [cover] : []}
              onImagesChange={(images) => setCover(images[0] ?? null)}
              maxImages={1}
              selectionLimit={1}
              presentation={FORUM_COVER_PRESENTATION}
              replaceExisting
              addLabel={cover ? "Change cover image" : "Add cover image"}
              disabled={isSubmitting}
            />
          </View>

          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text variant="small">Details (optional)</Text>
              <Text variant="muted">{description.length}/1000</Text>
            </View>
            <Textarea
              accessibilityLabel="Forum description"
              editable={!isSubmitting && !uncertain && !checking}
              maxLength={1000}
              placeholder="What is this forum for?"
              value={description}
              onChangeText={setDescription}
            />
          </View>

          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text variant="small">Rules (optional)</Text>
              <Text variant="muted">{rules.length}/2000</Text>
            </View>
            <Textarea
              accessibilityLabel="Forum rules"
              editable={!isSubmitting && !uncertain && !checking}
              maxLength={2000}
              placeholder="Add rules for members."
              value={rules}
              onChangeText={setRules}
            />
          </View>

          {submissionError ? (
            <Text className="text-destructive" variant="small">
              {submissionError}
            </Text>
          ) : null}
        </Card>
      </ScrollView>
      {uncertain ? (
        <View className="gap-2 p-4">
          <Text variant="small" className="text-destructive">
            Your forum may have been created. Check the result or retry before
            editing.
          </Text>
          <Button
            disabled={checking || isSubmitting}
            variant="outline"
            onPress={() => void checkOutcome()}
          >
            <Text>{checking ? "Checking…" : "Check result"}</Text>
          </Button>
          {lookupMessage ? <Text variant="small">{lookupMessage}</Text> : null}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function slugFromName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 63);
}
