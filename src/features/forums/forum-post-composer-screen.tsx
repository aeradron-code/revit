import type * as ImagePicker from "expo-image-picker";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { randomUUID } from "expo-crypto";
import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { UsersRound } from "lucide-react-native";
import type { Entity } from "@/api/entities";
import { API_ERROR_MESSAGES, normalizeApiError } from "@/api/errors";
import type { AskCreationAttempt } from "@/api/posts";
import { ImagePickerCarousel } from "@/components/media/image-picker-carousel";
import { AppHeader } from "@/components/navigation/app-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ContentSkeleton } from "@/components/ui/content-skeleton";
import { Icon } from "@/components/ui/icon";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { SearchInput } from "@/components/ui/search-input";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/features/ratings/star-rating";
import { PostRecoveryGate } from "@/features/create/post-recovery-gate";
import { successFeedback } from "@/lib/feedback";
import type { LocalImage } from "@/lib/media/read-local-image";
import { routes } from "@/lib/routes";
import { useAuthUser } from "@/providers/auth-provider";
import { useResolvePostRecovery } from "@/queries/creation-recovery";
import { useForum } from "@/queries/forums";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useEntityCategories, useEntitySearch } from "@/queries/entities";
import {
  useCreateForumAskPost,
  useCreateForumSharePost,
} from "@/queries/posts";

export function ForumPostComposerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthUser();
  if (!user) return null;
  return (
    <PostRecoveryGate
      key={user.id}
      userId={user.id}
      kinds={["FORUM_ASK", "FORUM_SHARE"]}
      closeRoute={routes.forum(id)}
    >
      <ForumPostComposerForm
        key={`${user.id}:${id}`}
        userId={user.id}
        id={id}
      />
    </PostRecoveryGate>
  );
}

function ForumPostComposerForm({ userId, id }: { userId: string; id: string }) {
  const [type, setType] = useState<"ASK" | "SHARE">("ASK");
  const [body, setBody] = useState("");
  const [entity, setEntity] = useState<Entity | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [categorySlug, setCategorySlug] = useState("place");
  const [search, setSearch] = useState("");
  const forum = useForum(id, userId);
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [uncertain, setUncertain] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const attempt = useRef<(AskCreationAttempt & { signature: string }) | null>(
    null,
  );
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const categories = useEntityCategories();
  const debouncedSearch = useDebouncedValue(search);
  const isDebouncing = search.trim() !== debouncedSearch.trim();
  const results = useEntitySearch(debouncedSearch, categorySlug);
  const createAsk = useCreateForumAskPost(id);
  const createShare = useCreateForumSharePost(id);
  const resolveRecovery = useResolvePostRecovery();
  const isSaving = createAsk.isPending || createShare.isPending;
  const error = type === "ASK" ? createAsk.error : createShare.error;
  const canPublish = Boolean(
    userId &&
      (type === "SHARE" ? entity && score : body.trim()) &&
      !isSaving &&
      !checking,
  );

  const publish = async () => {
    if (!canPublish || inFlight.current) return;
    inFlight.current = true;
    const signature = JSON.stringify([
      type,
      body,
      entity?.id,
      score,
      images.map((image) => image.uri),
    ]);
    if (
      !attempt.current ||
      (!uncertain && attempt.current.signature !== signature)
    ) {
      attempt.current = { id: randomUUID(), signature };
    }
    const current = attempt.current;
    setLookupMessage(null);
    try {
      if (type === "ASK") {
        await createAsk.mutateAsync({
          authorId: userId,
          attempt: current,
          body,
          forumId: id,
          images: images.map(toLocalImage),
        });
      } else {
        if (!entity || !score) return;
        await createShare.mutateAsync({
          authorId: userId,
          attempt: current,
          body,
          entityId: entity.id,
          forumId: id,
          images: images.map(toLocalImage),
          score,
        });
      }
      if (mounted.current) {
        successFeedback();
        router.replace(routes.forum(id));
      }
    } catch {
      // The active mutation exposes the error below so the draft can be retried.
      if (mounted.current) setUncertain(Boolean(current.outcomeUncertain));
    } finally {
      inFlight.current = false;
    }
  };

  const checkOutcome = async () => {
    const current = attempt.current;
    if (!current || inFlight.current) return;
    inFlight.current = true;
    setChecking(true);
    setLookupMessage(null);
    const kind = type === "ASK" ? "FORUM_ASK" : "FORUM_SHARE";
    try {
      const result = await resolveRecovery.mutateAsync({
        userId,
        operationId: current.id,
        kind,
      });
      if (result.status === "inconclusive") {
        if (mounted.current)
          setLookupMessage(
            "The result is not available yet. Retry publishing or check again.",
          );
        return;
      }
      if (mounted.current) router.replace(routes.forum(id));
    } catch {
      if (mounted.current)
        setLookupMessage(
          "We couldn’t check or clear saved post recovery. Please try again.",
        );
    } finally {
      inFlight.current = false;
      if (mounted.current) setChecking(false);
    }
  };

  const selectType = (nextType: "ASK" | "SHARE") => {
    if (nextType === type || isSaving) return;
    createAsk.reset();
    createShare.reset();
    setType(nextType);
  };

  const closeComposer = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(routes.forum(id));
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <Stack.Screen
        options={{
          header: () => (
            <AppHeader
              leading="close"
              onLeadingPress={closeComposer}
              title="Forums"
              titleAlign="center"
              trailing={
                <Button
                  disabled={!canPublish}
                  size="sm"
                  onPress={() => void publish()}
                >
                  <Text>{isSaving ? "Publishing…" : "Publish"}</Text>
                </Button>
              }
            />
          ),
        }}
      />
      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="w-full gap-6 pb-8 px-2 pt-4 md:mx-auto md:max-w-2xl md:pb-12 md:pt-6"
      >
        <View
          pointerEvents={uncertain || isSaving || checking ? "none" : "auto"}
        >
          <Card className="gap-6 border-border bg-card p-4 pt-2 shadow-none">
            <View className="gap-2 py-1">
              <Text variant="h1" className="text-left">
                New forum post
              </Text>
              <Text variant="muted">
                Posts stay inside this forum and never enter Home.
              </Text>
            </View>
            <View className="flex-row items-center gap-3 rounded-lg border border-border bg-background p-3">
              <View className="size-9 items-center justify-center rounded-full bg-primary/10">
                <Icon as={UsersRound} className="size-4 text-primary" />
              </View>
              <View className="min-w-0 flex-1 gap-0.5">
                <Text className="text-sm font-semibold" numberOfLines={1}>
                  {forum.data?.name ?? "Selected forum"}
                </Text>
                <Text variant="muted" className="text-xs">
                  Posting in this forum
                </Text>
              </View>
            </View>
            <View className="flex-row gap-2">
              <Button
                className="flex-1"
                disabled={isSaving}
                variant={type === "ASK" ? "default" : "outline"}
                onPress={() => selectType("ASK")}
              >
                <Text>Ask</Text>
              </Button>
              <Button
                className="flex-1"
                disabled={isSaving}
                variant={type === "SHARE" ? "default" : "outline"}
                onPress={() => selectType("SHARE")}
              >
                <Text>Share</Text>
              </Button>
            </View>
            {type === "SHARE" ? (
              <View className="gap-2">
                <Text variant="small">Category</Text>
                {!entity ? (
                  <View className="flex-row flex-wrap gap-2">
                    {(categories.data ?? []).map((category) => (
                      <Button
                        key={category.slug}
                        size="xs"
                        variant={
                          categorySlug === category.slug ? "default" : "outline"
                        }
                        onPress={() => {
                          setCategorySlug(category.slug);
                          setSearch("");
                        }}
                      >
                        <Text>{category.label}</Text>
                      </Button>
                    ))}
                  </View>
                ) : null}
                <Text variant="small">Find</Text>
                {entity ? (
                  <Button
                    variant="outline"
                    onPress={() => {
                      setEntity(null);
                      setScore(null);
                    }}
                  >
                    <Text>{entity.name} · Change</Text>
                  </Button>
                ) : (
                  <>
                    <SearchInput
                      accessibilityLabel="Search finds"
                      placeholder="Search finds by name or location"
                      value={search}
                      onChangeText={setSearch}
                    />
                    {search.trim().length >= 2 &&
                    (isDebouncing || results.isLoading) ? (
                      <ContentSkeleton rows={1} />
                    ) : null}
                    {!isDebouncing && results.isError ? (
                      <Text className="text-destructive" variant="small">
                        {results.error.message}
                      </Text>
                    ) : null}
                    {!isDebouncing
                      ? results.data?.map((item) => (
                          <Button
                            key={item.id}
                            className="border border-border bg-card"
                            size="content"
                            variant="outline"
                            onPress={() => {
                              setEntity(item);
                              setScore(null);
                              setSearch("");
                            }}
                          >
                            <Text>
                              {item.name} · {item.category.label}
                            </Text>
                          </Button>
                        ))
                      : null}
                    {search.trim().length >= 2 &&
                    !isDebouncing &&
                    !results.isLoading &&
                    !results.isError &&
                    results.data?.length === 0 ? (
                      <Text variant="muted">
                        No finds in this category yet.
                      </Text>
                    ) : null}
                  </>
                )}
                {entity ? (
                  <View className="gap-2 pt-2">
                    <Text variant="small">Your rating</Text>
                    <View className="flex-row items-center gap-3">
                      <StarRating
                        value={score}
                        starSize={24}
                        gap={8}
                        onChange={setScore}
                      />
                      <Text variant="muted">
                        {score === null ? "Choose 1–5 stars" : `${score}/5`}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}
            <View className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text variant="small">
                  {type === "ASK" ? "Your question" : "Details (optional)"}
                </Text>
                <Text variant="muted">{body.length}/2000</Text>
              </View>
              <Textarea
                accessibilityLabel="Post details"
                editable={!isSaving && !uncertain && !checking}
                maxLength={2000}
                placeholder="Add context that will help people respond."
                value={body}
                onChangeText={setBody}
              />
            </View>
            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <Text variant="small">Images (optional)</Text>
                <Text variant="muted">{images.length}/3</Text>
              </View>
              <ImagePickerCarousel
                images={images}
                onImagesChange={setImages}
                maxImages={3}
                disabled={isSaving}
                addLabel="Add images"
              />
            </View>
            {type === "SHARE" ? (
              <Text variant="muted" className="text-xs">
                This rating is shown in the forum and does not change the find’s
                global rating.
              </Text>
            ) : null}
            {error ? (
              <Text className="text-destructive" variant="small">
                {
                  normalizeApiError(
                    error,
                    API_ERROR_MESSAGES.PUBLISH_THIS_FORUM_POST,
                  ).message
                }
              </Text>
            ) : null}
          </Card>
        </View>
        {uncertain ? (
          <View className="gap-2">
            <Text variant="small" className="text-destructive">
              Your post may have been published. Check the result or retry
              publishing before editing.
            </Text>
            <Button
              disabled={checking || isSaving}
              variant="outline"
              onPress={() => void checkOutcome()}
            >
              <Text>{checking ? "Checking…" : "Check result"}</Text>
            </Button>
            {lookupMessage ? (
              <Text variant="small">{lookupMessage}</Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function toLocalImage(image: ImagePicker.ImagePickerAsset): LocalImage {
  return {
    file: image.file,
    fileName: image.fileName,
    fileSize: image.fileSize,
    mimeType: image.mimeType,
    uri: image.uri,
  };
}
