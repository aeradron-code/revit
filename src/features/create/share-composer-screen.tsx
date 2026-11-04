import type * as ImagePicker from "expo-image-picker";
import { randomUUID } from "expo-crypto";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { MapPin } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";

import type { Entity } from "@/api/entities";
import type { AskCreationAttempt } from "@/api/posts";
import type { ResourceCreationAttempt } from "@/api/creation-recovery";
import {
  API_ERROR_MESSAGES,
  normalizeApiError,
  validationError,
} from "@/api/errors";
import { ImagePickerCarousel } from "@/components/media/image-picker-carousel";
import { ENTITY_IMAGE_PRESENTATION } from "@/components/media/image-presentation";
import { AppHeader } from "@/components/navigation/app-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ContentSkeleton } from "@/components/ui/content-skeleton";
import { FeedbackState } from "@/components/ui/feedback-state";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { SearchInput } from "@/components/ui/search-input";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/features/ratings/star-rating";
import { PostRecoveryGate } from "@/features/create/post-recovery-gate";
import { ResourceRecoveryGate } from "@/features/create/resource-recovery-gate";
import {
  canPublishShare,
  initializeShareDraft,
} from "@/features/create/share-draft";
import { selectionFeedback, successFeedback } from "@/lib/feedback";
import { readLocalImage } from "@/lib/media/read-local-image";
import { routes } from "@/lib/routes";
import { useAuthUser } from "@/providers/auth-provider";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  useResolvePostRecovery,
  useResolveResourceRecovery,
} from "@/queries/creation-recovery";
import {
  useCreateEntity,
  useEntity,
  useEntityCategories,
  useEntitySearch,
} from "@/queries/entities";
import {
  useCreateShareRating,
  useMyEntityRating,
  useUpdateShareRating,
} from "@/queries/shares";

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function ShareComposerScreen() {
  const user = useAuthUser();
  if (!user) return null;
  return (
    <ResourceRecoveryGate
      key={`find:${user.id}`}
      userId={user.id}
      kind="FIND"
      closeRoute={routes.create}
      resultRoute={(id) => ({
        pathname: "/create/share",
        params: { entityId: id },
      })}
    >
      <PostRecoveryGate
        key={user.id}
        userId={user.id}
        kinds={["GLOBAL_SHARE"]}
        closeRoute={routes.create}
      >
        <ShareComposerForm key={user.id} userId={user.id} />
      </PostRecoveryGate>
    </ResourceRecoveryGate>
  );
}

function ShareComposerForm({ userId }: { userId: string }) {
  const { entityId } = useLocalSearchParams<{ entityId?: string }>();
  const [search, setSearch] = useState("");
  const [entity, setEntity] = useState<Entity | null>(null);
  const [categorySlug, setCategorySlug] = useState("place");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [entityImage, setEntityImage] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [entityDraftError, setEntityDraftError] = useState<string | null>(null);
  const [isPreparingEntity, setIsPreparingEntity] = useState(false);
  const entitySubmissionInFlight = useRef(false);
  const entityAttempt = useRef<
    (ResourceCreationAttempt & { signature: string }) | null
  >(null);
  const [findUncertain, setFindUncertain] = useState(false);
  const [checkingFind, setCheckingFind] = useState(false);
  const [findLookupMessage, setFindLookupMessage] = useState<string | null>(
    null,
  );
  const [score, setScore] = useState<number | null>(null);
  const [body, setBody] = useState("");
  const initializedEntityId = useRef<string | null>(null);
  const dirtyFields = useRef({ score: false, body: false });
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [uncertain, setUncertain] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const attempt = useRef<(AskCreationAttempt & { signature: string }) | null>(
    null,
  );
  const publishInFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const entityFromRoute = useEntity(entityId ?? "");
  const categories = useEntityCategories();
  const debouncedSearch = useDebouncedValue(search);
  const isDebouncing = search.trim() !== debouncedSearch.trim();
  const results = useEntitySearch(debouncedSearch, categorySlug);
  const createEntity = useCreateEntity();
  const resolveResourceRecovery = useResolveResourceRecovery();
  const resolvePostRecovery = useResolvePostRecovery();
  const isCreatingEntity = isPreparingEntity || createEntity.isPending;
  const existingRating = useMyEntityRating(entity?.id ?? "", userId);
  const createRating = useCreateShareRating();
  const updateRating = useUpdateShareRating(
    existingRating.data?.postId ?? "",
    entity?.id ?? "",
    userId,
  );
  const isUpdating = Boolean(existingRating.data) && !uncertain;
  const isSaving = createRating.isPending || updateRating.isPending;
  const mutationError = isUpdating ? updateRating.error : createRating.error;
  const canPublish = canPublishShare({
    signedIn: Boolean(userId),
    hasEntity: Boolean(entity),
    score,
    saving: isSaving || checking,
    ratingLookupSucceeded: existingRating.isSuccess,
    ratingLookupFailed: existingRating.isError,
  });

  useEffect(() => {
    if (entity || !entityFromRoute.data) return;
    setEntity(entityFromRoute.data);
  }, [entity, entityFromRoute.data]);

  useEffect(() => {
    if (
      uncertain ||
      !entity ||
      !existingRating.isSuccess ||
      initializedEntityId.current === entity.id
    )
      return;
    const initial = initializeShareDraft(
      { score, body },
      existingRating.data,
      dirtyFields.current,
    );
    initializedEntityId.current = entity.id;
    setScore(initial.score);
    setBody(initial.body);
  }, [
    existingRating.data,
    existingRating.isSuccess,
    entity,
    score,
    body,
    uncertain,
  ]);

  const selectEntity = (nextEntity: Entity) => {
    selectionFeedback();
    initializedEntityId.current = null;
    dirtyFields.current = { score: false, body: false };
    setEntity(nextEntity);
    setSearch("");
    setScore(null);
    setBody("");
    setImages([]);
  };

  const clearEntity = () => {
    initializedEntityId.current = null;
    dirtyFields.current = { score: false, body: false };
    setEntity(null);
    router.setParams({ entityId: undefined });
  };

  const closeComposer = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(routes.create);
  };

  const createEntityFromDraft = async () => {
    if (!userId || !newName.trim() || entitySubmissionInFlight.current) return;
    entitySubmissionInFlight.current = true;
    setIsPreparingEntity(true);
    setEntityDraftError(null);
    const signature = JSON.stringify([
      categorySlug,
      newName,
      newDescription,
      newLocation,
      entityImage?.uri,
    ]);
    if (
      !entityAttempt.current ||
      (!findUncertain && entityAttempt.current.signature !== signature)
    )
      entityAttempt.current = { id: randomUUID(), signature };
    const current = entityAttempt.current;
    try {
      if (entityImage?.fileSize && entityImage.fileSize > MAX_IMAGE_BYTES) {
        throw validationError(
          API_ERROR_MESSAGES.THE_FIND_IMAGE_MUST_BE_SMALLER_THAN_10_MB,
        );
      }
      const image =
        current.preparedImages?.image ??
        (entityImage
          ? await readLocalImage({
              file: entityImage.file,
              fileName: entityImage.fileName,
              fileSize: entityImage.fileSize,
              mimeType: entityImage.mimeType,
              uri: entityImage.uri,
            })
          : undefined);
      current.preparedImages = { image };
      const created = await createEntity.mutateAsync({
        authorId: userId,
        attempt: current,
        categorySlug,
        name: newName.trim(),
        description: newDescription,
        locality: newLocation,
        image,
      });
      if (!mounted.current) return;
      selectEntity(created);
      setNewName("");
      setNewDescription("");
      setNewLocation("");
      setEntityImage(null);
    } catch (error) {
      if (!mounted.current) return;
      setFindUncertain(Boolean(current.outcomeUncertain));
      setEntityDraftError(
        normalizeApiError(error, API_ERROR_MESSAGES.ADD_THIS_FIND).message,
      );
    } finally {
      entitySubmissionInFlight.current = false;
      if (mounted.current) setIsPreparingEntity(false);
    }
  };

  const checkFindOutcome = async () => {
    const current = entityAttempt.current;
    if (!current || entitySubmissionInFlight.current) return;
    entitySubmissionInFlight.current = true;
    setCheckingFind(true);
    setFindLookupMessage(null);
    try {
      const id = await resolveResourceRecovery.mutateAsync({
        userId,
        operationId: current.id,
        kind: "FIND",
      });
      if (!id) {
        if (mounted.current)
          setFindLookupMessage(
            "The result is not available yet. Retry creating or check again.",
          );
        return;
      }
      if (mounted.current)
        router.replace({ pathname: "/create/share", params: { entityId: id } });
    } catch {
      if (mounted.current)
        setFindLookupMessage(
          "We couldn’t check or clear saved recovery. Please try again.",
        );
    } finally {
      entitySubmissionInFlight.current = false;
      if (mounted.current) setCheckingFind(false);
    }
  };

  const publish = async () => {
    if (!userId || !entity || !score || !canPublish || publishInFlight.current)
      return;
    publishInFlight.current = true;
    const signature = JSON.stringify([
      entity.id,
      score,
      body,
      images.map((image) => image.uri),
    ]);
    if (
      !isUpdating &&
      (!attempt.current ||
        (!uncertain && attempt.current.signature !== signature))
    ) {
      attempt.current = { id: randomUUID(), signature };
    }
    const current = attempt.current;
    setLookupMessage(null);

    try {
      if (!isUpdating && !current) throw new Error("Missing creation attempt");
      const post = isUpdating
        ? await updateRating.mutateAsync({ body, score })
        : current &&
          (await createRating.mutateAsync({
            authorId: userId,
            attempt: current,
            body,
            entityId: entity.id,
            images: images.map((image) => ({
              file: image.file,
              fileName: image.fileName,
              fileSize: image.fileSize,
              mimeType: image.mimeType,
              uri: image.uri,
            })),
            score,
          }));

      if (mounted.current && post) {
        successFeedback();
        router.replace(routes.post(post.id));
      }
    } catch {
      // The API error is kept on-screen so the user can retry.
      if (mounted.current && !isUpdating)
        setUncertain(Boolean(current?.outcomeUncertain));
    } finally {
      publishInFlight.current = false;
    }
  };

  const checkOutcome = async () => {
    const current = attempt.current;
    if (!current || publishInFlight.current) return;
    publishInFlight.current = true;
    setChecking(true);
    setLookupMessage(null);
    try {
      const result = await resolvePostRecovery.mutateAsync({
        userId,
        operationId: current.id,
        kind: "GLOBAL_SHARE",
      });
      if (result.status === "inconclusive") {
        if (mounted.current)
          setLookupMessage(
            "The result is not available yet. Retry publishing or check again.",
          );
        return;
      }
      if (mounted.current) router.replace(routes.post(result.post.id));
    } catch {
      if (mounted.current)
        setLookupMessage(
          "We couldn’t check or clear saved post recovery. Please try again.",
        );
    } finally {
      publishInFlight.current = false;
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
                    {isSaving ? "Saving…" : isUpdating ? "Update" : "Publish"}
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
          pointerEvents={
            uncertain || isSaving || checking || findUncertain || checkingFind
              ? "none"
              : "auto"
          }
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="w-full gap-6 px-2 pb-8 pt-4 md:mx-auto md:max-w-2xl md:px-6 md:pb-12 md:pt-6"
        >
          <Card className="gap-6 border-border bg-card p-4 pb-6 shadow-none">
            <View className="gap-2 py-1">
              <Text variant="h1" className="text-left">
                Rate anything
              </Text>
              <Text variant="muted" className="leading-5">
                Choose a category, find what you’re looking for, and share your
                rating.
              </Text>
            </View>

            <View className="gap-3">
              <Text variant="small">Category</Text>
              {!entity && categories.isError ? (
                <FeedbackState
                  variant="error"
                  title="Couldn’t load categories."
                  actionLabel="Retry"
                  onAction={() => void categories.refetch()}
                />
              ) : null}
              {!entity && categories.isLoading ? (
                <ContentSkeleton rows={1} />
              ) : null}
              {!entity && categories.isSuccess && !categories.isError ? (
                <View className="flex-row flex-wrap gap-2">
                  {(categories.data ?? []).map((category) => (
                    <Button
                      key={category.id}
                      disabled={isCreatingEntity}
                      size="sm"
                      variant={
                        category.slug === categorySlug ? "default" : "outline"
                      }
                      onPress={() => {
                        setCategorySlug(category.slug);
                        setSearch("");
                        setNewName("");
                      }}
                    >
                      <Text>{category.label}</Text>
                    </Button>
                  ))}
                </View>
              ) : null}
              <Text variant="small">Find</Text>
              {!entity && entityId && entityFromRoute.isError ? (
                <FeedbackState
                  variant="error"
                  title="Couldn’t load the selected find."
                  actionLabel="Retry"
                  onAction={() => void entityFromRoute.refetch()}
                />
              ) : null}
              {!entity &&
              entityId &&
              entityFromRoute.isSuccess &&
              !entityFromRoute.data ? (
                <Text variant="muted">
                  This find is no longer available. Search for another find
                  below.
                </Text>
              ) : null}
              {entity ? (
                <View className="min-h-11 flex-row items-center gap-3 border-l-2 border-primary px-3 py-1.5">
                  <Icon as={MapPin} className="size-5 text-primary" />
                  <View className="min-w-0 flex-1 gap-0.5">
                    <Text className="truncate text-base font-semibold">
                      {entity.name}
                    </Text>
                    <Text variant="muted" className="truncate text-xs">
                      {[entity.category.label, entity.locality]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                  <Button
                    disabled={isSaving}
                    className="shrink-0"
                    size="xs"
                    variant="ghost"
                    onPress={clearEntity}
                  >
                    <Text className="text-sm text-primary">Change</Text>
                  </Button>
                </View>
              ) : (
                <>
                  <SearchInput
                    accessibilityLabel="Search finds"
                    autoFocus
                    placeholder="Search by name or location"
                    value={search}
                    editable={
                      categories.isSuccess &&
                      !categories.isError &&
                      !isCreatingEntity
                    }
                    onChangeText={(value) => {
                      setSearch(value);
                      setNewName(value.trim());
                    }}
                  />
                  {isDebouncing || results.isLoading ? (
                    <ContentSkeleton rows={1} />
                  ) : null}
                  {!isDebouncing && results.isError ? (
                    <Text variant="small" className="text-destructive">
                      {results.error.message}
                    </Text>
                  ) : null}
                  {!isDebouncing && categories.isSuccess && !categories.isError
                    ? results.data?.map((item) => (
                        <Button
                          key={item.id}
                          disabled={isCreatingEntity}
                          className="border border-border bg-card"
                          size="content"
                          variant="ghost"
                          onPress={() => selectEntity(item)}
                        >
                          <Icon as={MapPin} className="text-primary" />
                          <View className="min-w-0 flex-1 gap-0.5">
                            <Text className="truncate text-left font-medium">
                              {item.name}
                            </Text>
                            <Text
                              variant="muted"
                              className="truncate text-left text-xs"
                            >
                              {[item.category.label, item.locality]
                                .filter(Boolean)
                                .join(" · ")}
                            </Text>
                          </View>
                        </Button>
                      ))
                    : null}
                  {search.trim().length >= 2 &&
                  !isDebouncing &&
                  categories.isSuccess &&
                  !categories.isError &&
                  !results.isLoading &&
                  results.data?.length === 0 ? (
                    <View className="gap-3 border-t border-border pt-3">
                      <Text variant="muted" className="text-sm">
                        Can’t find it? Add it as a find
                      </Text>
                      <Input
                        accessibilityLabel="Find name"
                        placeholder="Name"
                        editable={
                          !isCreatingEntity && !findUncertain && !checkingFind
                        }
                        value={newName}
                        onChangeText={setNewName}
                      />
                      <Textarea
                        accessibilityLabel="Find description"
                        placeholder="Description (optional)"
                        editable={
                          !isCreatingEntity && !findUncertain && !checkingFind
                        }
                        value={newDescription}
                        onChangeText={setNewDescription}
                      />
                      <Input
                        accessibilityLabel="Find location"
                        placeholder="Location (optional)"
                        editable={
                          !isCreatingEntity && !findUncertain && !checkingFind
                        }
                        value={newLocation}
                        onChangeText={setNewLocation}
                      />
                      <ImagePickerCarousel
                        images={entityImage ? [entityImage] : []}
                        onImagesChange={(selected) =>
                          setEntityImage(selected[0] ?? null)
                        }
                        maxImages={1}
                        selectionLimit={1}
                        presentation={ENTITY_IMAGE_PRESENTATION}
                        replaceExisting
                        addLabel={entityImage ? "Change image" : "Add image"}
                        disabled={isCreatingEntity}
                      />
                      {entityDraftError ? (
                        <Text variant="small" className="text-destructive">
                          {entityDraftError}
                        </Text>
                      ) : null}
                      <Button
                        disabled={!newName.trim() || isCreatingEntity}
                        size="sm"
                        variant="outline"
                        onPress={() => void createEntityFromDraft()}
                      >
                        <Text>
                          {isCreatingEntity ? "Creating…" : "Add find"}
                        </Text>
                      </Button>
                    </View>
                  ) : null}
                </>
              )}
            </View>

            {entity ? (
              <>
                <View className="gap-3 border-t border-border pt-6">
                  <View className="flex-row items-center justify-between">
                    <Text variant="small">Your rating</Text>
                    {existingRating.isLoading ? (
                      <Text variant="muted">Checking your rating…</Text>
                    ) : null}
                  </View>
                  {existingRating.isError ? (
                    <FeedbackState
                      variant="error"
                      title="Couldn’t check your existing rating."
                      actionLabel="Retry"
                      onAction={() => void existingRating.refetch()}
                    />
                  ) : null}
                  <View className="flex-row items-center justify-between gap-3">
                    <View className="flex-row items-center gap-3">
                      <StarRating
                        value={score}
                        disabled={isSaving || existingRating.isLoading}
                        starSize={25}
                        gap={5}
                        onChange={(nextScore) => {
                          selectionFeedback();
                          dirtyFields.current.score = true;
                          setScore(nextScore);
                        }}
                      />
                      <Text className="text-sm font-medium" variant="muted">
                        {score === null ? "Not rated" : `${score} of 5`}
                      </Text>
                    </View>
                    {score !== null ? (
                      <Button
                        accessibilityLabel="Clear your rating"
                        className="shrink-0"
                        size="xs"
                        disabled={isSaving || existingRating.isLoading}
                        variant="link"
                        onPress={() => {
                          selectionFeedback();
                          dirtyFields.current.score = true;
                          setScore(null);
                        }}
                      >
                        <Text className="text-sm text-primary">
                          Clear rating
                        </Text>
                      </Button>
                    ) : null}
                  </View>
                </View>

                <View className="gap-3 border-t border-border pt-6">
                  <View className="flex-row items-center justify-between">
                    <Text variant="small">Review (optional)</Text>
                    <Text variant="muted">{body.length}/2000</Text>
                  </View>
                  <Textarea
                    accessibilityLabel="Review"
                    editable={!isSaving && !uncertain && !checking}
                    maxLength={2000}
                    placeholder="What did you like, or what should people know?"
                    value={body}
                    onChangeText={(value) => {
                      dirtyFields.current.body = true;
                      setBody(value);
                    }}
                  />
                </View>

                {!isUpdating ? (
                  <View className="gap-3 border-t border-border pt-6">
                    <View className="flex-row items-center justify-between">
                      <Text variant="small">Photos (optional)</Text>
                      <Text variant="muted">{images.length}/3</Text>
                    </View>
                    <ImagePickerCarousel
                      images={images}
                      onImagesChange={setImages}
                      maxImages={MAX_IMAGES}
                      disabled={isSaving}
                      addLabel="Add photos"
                    />
                  </View>
                ) : null}
              </>
            ) : null}

            {mutationError ? (
              <Text variant="small" className="text-destructive">
                {
                  normalizeApiError(
                    mutationError,
                    API_ERROR_MESSAGES.PUBLISH_YOUR_RATING,
                  ).message
                }
              </Text>
            ) : null}
          </Card>
        </ScrollView>
        {findUncertain ? (
          <View className="gap-2 p-4">
            <Text variant="small" className="text-destructive">
              Your find may have been created. Check the result or retry before
              editing.
            </Text>
            <Button
              disabled={checkingFind || isCreatingEntity}
              variant="outline"
              onPress={() => void checkFindOutcome()}
            >
              <Text>{checkingFind ? "Checking…" : "Check result"}</Text>
            </Button>
            <Button
              disabled={checkingFind || isCreatingEntity}
              onPress={() => void createEntityFromDraft()}
            >
              <Text>Retry creating</Text>
            </Button>
            {findLookupMessage ? (
              <Text variant="small">{findLookupMessage}</Text>
            ) : null}
          </View>
        ) : null}
        {uncertain ? (
          <View className="gap-2 p-4">
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
