import { router, Stack, useLocalSearchParams } from "expo-router";
import { ChevronDown, ChevronUp, MapPin, Trash2 } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, View } from "react-native";

import type { Entity } from "@/api/entities";
import { AppHeader } from "@/components/navigation/app-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FeedbackState } from "@/components/ui/feedback-state";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchInput } from "@/components/ui/search-input";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { selectionFeedback, successFeedback } from "@/lib/feedback";
import { routes } from "@/lib/routes";
import { useAuthUser } from "@/providers/auth-provider";
import {
  useCreatePersonalPick,
  usePersonalPick,
  useUpdatePersonalPick,
} from "@/queries/picks";
import { useEntitySearch } from "@/queries/entities";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

type DraftPickItem = {
  note: string;
  entity: Entity;
};

export function PickEditorScreen() {
  const { pickId } = useLocalSearchParams<{ pickId?: string }>();
  const user = useAuthUser();
  const pick = usePersonalPick(pickId ?? "");
  const createPick = useCreatePersonalPick(user?.id ?? "");
  const updatePick = useUpdatePersonalPick(pickId ?? "", user?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<DraftPickItem[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const isDebouncing = search.trim() !== debouncedSearch.trim();
  const entitySearch = useEntitySearch(debouncedSearch);
  const initializedPickId = useRef<string | null>(null);
  const isEditing = Boolean(pickId);
  const isSaving = createPick.isPending || updatePick.isPending;
  const mutationError = createPick.error ?? updatePick.error;
  const isOwner = !isEditing || pick.data?.author_id === user?.id;

  useEffect(() => {
    if (!pickId || !pick.data || initializedPickId.current === pickId) return;

    initializedPickId.current = pickId;
    setTitle(pick.data.title);
    setDescription(pick.data.description ?? "");
    setItems(
      pick.data.items.map((item) => ({
        note: item.note ?? "",
        entity: item.entity,
      })),
    );
  }, [pick.data, pickId]);

  const addEntity = (entity: Entity) => {
    if (items.some((item) => item.entity.id === entity.id)) return;

    selectionFeedback();
    setItems((current) => [...current, { note: "", entity }]);
    setSearch("");
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    selectionFeedback();
    setItems((current) => {
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const updateNote = (index: number, note: string) => {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, note } : item,
      ),
    );
  };

  const removeItem = (index: number) => {
    selectionFeedback();
    setItems((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const save = async () => {
    if (!user || !isOwner || isSaving) return;

    try {
      const input = {
        description,
        items: items.map((item) => ({
          entityId: item.entity.id,
          note: item.note,
        })),
        title,
      };
      const savedPick = isEditing
        ? await updatePick.mutateAsync(input)
        : await createPick.mutateAsync(input);

      successFeedback();
      router.replace(routes.pick(savedPick.id));
    } catch {
      // The corrected retry can reuse the complete draft above.
    }
  };

  const closeEditor = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(routes.picks);
  };

  if (isEditing && (!pickId || pick.isLoading)) {
    return <LoadingState />;
  }

  if (isEditing && (pick.isError || !pick.data || !isOwner)) {
    return (
      <MessageState
        description={
          pick.isError
            ? pick.error.message
            : "This Pick is unavailable or belongs to another account."
        }
        title="Can’t edit this Pick"
      />
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <Stack.Screen
        options={{
          header: () => (
            <AppHeader
              leading="close"
              onLeadingPress={closeEditor}
              title="Picks"
              titleAlign="center"
              trailing={
                <Button
                  disabled={!title.trim() || items.length === 0 || isSaving}
                  size="sm"
                  onPress={() => void save()}
                >
                  <Text>
                    {isSaving ? "Saving…" : isEditing ? "Save" : "Publish"}
                  </Text>
                </Button>
              }
            />
          ),
        }}
      />
      <FlatList
        className="flex-1"
        contentContainerClassName="mx-auto w-full max-w-2xl gap-3 px-2 pb-8 pt-4 md:pb-12 md:pt-6"
        data={items}
        keyExtractor={(item) => item.entity.id}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <Card className="gap-5 border-border bg-card p-5 shadow-none md:p-6">
            <View className="gap-1.5 border-b border-border pb-4">
              <Text variant="h1" className="text-left">
                {isEditing ? "Edit Pick" : "Create a Pick"}
              </Text>
              <Text variant="muted" className="leading-5">
                Curate an ordered list of finds worth sharing.
              </Text>
            </View>

            <View className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text variant="small">Title</Text>
                <Text variant="muted">{title.length}/100</Text>
              </View>
              <Input
                accessibilityLabel="Pick title"
                editable={!isSaving}
                maxLength={100}
                placeholder="Give this Pick a clear name"
                value={title}
                onChangeText={setTitle}
              />
            </View>
            <View className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text variant="small">Details (optional)</Text>
                <Text variant="muted">{description.length}/1000</Text>
              </View>
              <Textarea
                accessibilityLabel="Pick description"
                editable={!isSaving}
                maxLength={1000}
                placeholder="Add a note about this collection."
                value={description}
                onChangeText={setDescription}
              />
            </View>

            <View className="gap-2.5">
              <View className="gap-0.5">
                <Text variant="small">Add finds</Text>
                <Text variant="muted">
                  Add finds, then arrange them in the order you recommend.
                </Text>
              </View>
              <SearchInput
                accessibilityLabel="Finds for this Pick"
                editable={!isSaving}
                placeholder="Search finds to add"
                value={search}
                onChangeText={setSearch}
              />
              {search.trim().length >= 2 &&
              (isDebouncing || entitySearch.isLoading) ? (
                <View className="flex-row items-center gap-2 py-1">
                  <ActivityIndicator />
                  <Text variant="muted">Searching finds…</Text>
                </View>
              ) : null}
              {!isDebouncing && entitySearch.isError ? (
                <Text className="text-destructive" variant="small">
                  {entitySearch.error.message}
                </Text>
              ) : null}
              {!isDebouncing
                ? entitySearch.data?.map((entity) => {
                    const isAdded = items.some(
                      (item) => item.entity.id === entity.id,
                    );

                    return (
                      <Button
                        key={entity.id}
                        className="border border-border bg-card"
                        size="content"
                        disabled={isAdded || isSaving}
                        variant="ghost"
                        onPress={() => addEntity(entity)}
                      >
                        <Icon as={MapPin} className="text-primary" />
                        <View className="min-w-0 flex-1 gap-0.5">
                          <Text className="truncate text-left font-medium">
                            {entity.name}
                          </Text>
                          <Text
                            variant="muted"
                            className="truncate text-left text-xs"
                          >
                            {[entity.category.label, entity.locality]
                              .filter(Boolean)
                              .join(" · ")}
                          </Text>
                        </View>
                        <Text className="text-xs text-primary">
                          {isAdded ? "Added" : "Add"}
                        </Text>
                      </Button>
                    );
                  })
                : null}
            </View>

            <View className="gap-2.5">
              <View className="flex-row items-center justify-between gap-3">
                <Text variant="small">Your order</Text>
                {items.length > 0 ? (
                  <Text variant="muted" className="text-xs">
                    {items.length} {items.length === 1 ? "find" : "finds"}
                  </Text>
                ) : null}
              </View>
            </View>
          </Card>
        }
        ListEmptyComponent={
          <FeedbackState
            description="Search above and add at least one find to continue."
            title="No finds added"
          />
        }
        ListFooterComponent={
          mutationError ? (
            <Text className="mt-2 text-destructive" variant="small">
              {mutationError.message}
            </Text>
          ) : undefined
        }
        renderItem={({ item, index }) => (
          <PickEditorItem
            item={item}
            index={index}
            count={items.length}
            isSaving={isSaving}
            moveItem={moveItem}
            removeItem={removeItem}
            updateNote={updateNote}
          />
        )}
      />
    </SafeAreaView>
  );
}

function PickEditorItem({
  item,
  index,
  count,
  isSaving,
  moveItem,
  removeItem,
  updateNote,
}: {
  item: DraftPickItem;
  index: number;
  count: number;
  isSaving: boolean;
  moveItem: (index: number, direction: -1 | 1) => void;
  removeItem: (index: number) => void;
  updateNote: (index: number, note: string) => void;
}) {
  return (
    <Card className="gap-2 border-border bg-card p-3 shadow-none">
      <View className="flex-row items-start gap-2">
        <Text className="pt-0.5 text-sm font-semibold text-primary">
          {index + 1}
        </Text>
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="truncate font-medium">{item.entity.name}</Text>
          <Text variant="muted" className="truncate text-xs">
            {[item.entity.category.label, item.entity.locality]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
        <Button
          accessibilityLabel={`Move ${item.entity.name} up`}
          disabled={index === 0 || isSaving}
          size="icon"
          variant="ghost"
          onPress={() => moveItem(index, -1)}
        >
          <Icon as={ChevronUp} />
        </Button>
        <Button
          accessibilityLabel={`Move ${item.entity.name} down`}
          disabled={index === count - 1 || isSaving}
          size="icon"
          variant="ghost"
          onPress={() => moveItem(index, 1)}
        >
          <Icon as={ChevronDown} />
        </Button>
        <Button
          accessibilityLabel={`Remove ${item.entity.name}`}
          disabled={isSaving}
          size="icon"
          variant="ghost"
          onPress={() => removeItem(index)}
        >
          <Icon as={Trash2} className="text-destructive" />
        </Button>
      </View>
      <Input
        accessibilityLabel={`Note for ${item.entity.name}`}
        editable={!isSaving}
        maxLength={500}
        placeholder="Why it belongs here (optional)"
        size="compact"
        value={item.note}
        onChangeText={(note) => updateNote(index, note)}
      />
    </Card>
  );
}

function LoadingState() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <Stack.Screen
        options={{
          header: () => (
            <AppHeader
              showAccountActions
              title="Picks"
              onBack={returnToPicks}
            />
          ),
        }}
      />
      <View className="w-full max-w-2xl gap-3 px-2 pb-8 pt-4 md:mx-auto md:pb-12 md:pt-6">
        <View className="gap-5 rounded-lg border border-border bg-card p-5 md:p-6">
          <View className="gap-2 border-b border-border pb-4">
            <Skeleton className="h-8 w-2/5" />
            <Skeleton className="h-4 w-4/5" />
          </View>
          <View className="gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-11 w-full rounded-md" />
          </View>
          <View className="gap-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-24 w-full rounded-md" />
          </View>
          <View className="gap-2.5">
            <View className="gap-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4/5" />
            </View>
            <Skeleton className="h-11 w-full rounded-md" />
            <View className="min-h-11 flex-row items-center gap-3 rounded-lg border border-border px-3 py-2">
              <Skeleton className="size-5 rounded-full" />
              <View className="flex-1 gap-1">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-3/5" />
              </View>
              <Skeleton className="h-4 w-10" />
            </View>
          </View>
          <View className="gap-2.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-20 w-full rounded-md" />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function MessageState({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <Stack.Screen
        options={{
          header: () => (
            <AppHeader
              showAccountActions
              title="Picks"
              onBack={returnToPicks}
            />
          ),
        }}
      />
      <View className="flex-1 items-center justify-center gap-2 px-6">
        <Text variant="h2">{title}</Text>
        <Text variant="muted" className="text-center">
          {description}
        </Text>
        <Button variant="outline" onPress={returnToPicks}>
          <Text>Go back</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}

function returnToPicks() {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(routes.picks);
}
