import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { randomUUID } from "expo-crypto";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { FlatList, View } from "react-native";

import type { Entity } from "@/api/entities";
import type { ResourceCreationAttempt } from "@/api/creation-recovery";
import { ResourceRecoveryGate } from "@/features/create/resource-recovery-gate";
import { AppHeader } from "@/components/navigation/app-header";
import { Button } from "@/components/ui/button";
import { FeedbackState } from "@/components/ui/feedback-state";
import { Input } from "@/components/ui/input";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchInput } from "@/components/ui/search-input";
import { Text } from "@/components/ui/text";
import { routes } from "@/lib/routes";
import {
  useCreateEntity,
  useEntityCategories,
  useEntitySearch,
} from "@/queries/entities";
import { useAuthUser } from "@/providers/auth-provider";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useResolveResourceRecovery } from "@/queries/creation-recovery";

export function EntitySearchScreen() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const returnToShare = returnTo === "share";
  const user = useAuthUser();
  if (!user) return null;
  return (
    <ResourceRecoveryGate
      key={user.id}
      userId={user.id}
      kind="FIND"
      closeRoute={routes.create}
      resultRoute={(id) =>
        returnToShare
          ? { pathname: "/create/share", params: { entityId: id } }
          : routes.entity(id)
      }
    >
      <EntitySearchForm
        key={user.id}
        returnToShare={returnToShare}
        userId={user.id}
      />
    </ResourceRecoveryGate>
  );
}

function EntitySearchForm({
  returnToShare,
  userId,
}: {
  returnToShare: boolean;
  userId: string;
}) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query);
  const isDebouncing = query.trim() !== debouncedQuery.trim();
  const search = useEntitySearch(debouncedQuery);
  const hasSearchTerm = query.trim().length >= 2;
  const finds = search.data ?? [];
  const [isAddingEntity, setIsAddingEntity] = useState(false);
  const [creationLocked, setCreationLocked] = useState(false);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(returnToShare ? routes.createShare : routes.create);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <Stack.Screen
        options={{
          header: () => (
            <AppHeader
              showAccountActions
              title={returnToShare ? "Create" : "Finds"}
              onBack={goBack}
            />
          ),
        }}
      />
      <FlatList
        className="flex-1"
        contentContainerClassName="mx-auto w-full gap-6 px-4 py-4 md:max-w-3xl md:px-6 md:py-6"
        data={
          !creationLocked &&
          hasSearchTerm &&
          !isDebouncing &&
          !search.isLoading &&
          !search.isError
            ? finds
            : []
        }
        keyExtractor={(entity) => entity.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View className="gap-6">
            <View className="gap-1">
              <Text variant="h1" className="text-left">
                Find something
              </Text>
              <Text className="text-sm" variant="muted">
                Search existing finds before adding a new one.
              </Text>
            </View>

            <SearchInput
              accessibilityLabel="Search finds"
              autoCapitalize="words"
              placeholder="Name or locality"
              value={query}
              editable={!creationLocked}
              onChangeText={setQuery}
            />

            {!hasSearchTerm ? (
              <SearchState
                description="Enter at least two characters to search by name, locality, or address."
                title="Search finds"
              />
            ) : null}

            {hasSearchTerm && (isDebouncing || search.isLoading) ? (
              <EntitySearchResultsSkeleton />
            ) : null}

            {hasSearchTerm && !isDebouncing && search.isError ? (
              <FeedbackState
                actionLabel="Retry"
                onAction={() => void search.refetch()}
                title="Couldn’t load finds."
                variant="error"
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !creationLocked &&
          hasSearchTerm &&
          !isDebouncing &&
          !search.isLoading &&
          !search.isError ? (
            <SearchState
              description="No existing find matches that search. Check the name and locality before adding one."
              title="No matches found"
            />
          ) : undefined
        }
        ListFooterComponent={
          creationLocked ||
          (hasSearchTerm &&
            !isDebouncing &&
            !search.isLoading &&
            !search.isError &&
            finds.length === 0) ? (
            isAddingEntity ? (
              <AddEntityForm
                initialName={query}
                onCancel={() => setIsAddingEntity(false)}
                returnToShare={returnToShare}
                userId={userId}
                onLockChange={setCreationLocked}
              />
            ) : (
              <Button
                className="self-start rounded-md"
                onPress={() => setIsAddingEntity(true)}
              >
                <Text>Add find</Text>
              </Button>
            )
          ) : undefined
        }
        renderItem={({ item }) => (
          <EntityResult entity={item} returnToShare={returnToShare} />
        )}
      />
    </SafeAreaView>
  );
}

function AddEntityForm({
  initialName,
  onCancel,
  returnToShare,
  userId,
  onLockChange,
}: {
  initialName: string;
  onCancel: () => void;
  returnToShare: boolean;
  userId: string;
  onLockChange: (locked: boolean) => void;
}) {
  const createEntity = useCreateEntity();
  const resolveRecovery = useResolveResourceRecovery();
  const attempt = useRef<
    (ResourceCreationAttempt & { signature: string }) | null
  >(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const [uncertain, setUncertain] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const categories = useEntityCategories();
  const [categorySlug, setCategorySlug] = useState("");
  const [name, setName] = useState(initialName.trim());
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [locality, setLocality] = useState("");
  const [district, setDistrict] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const canSubmit =
    name.trim().length > 0 &&
    Boolean(userId && categorySlug) &&
    !createEntity.isPending &&
    !checking;

  const submit = async () => {
    if (!canSubmit || inFlight.current) return;
    inFlight.current = true;
    onLockChange(true);
    const signature = JSON.stringify([
      categorySlug,
      name,
      addressLine1,
      addressLine2,
      locality,
      district,
      state,
      country,
      postalCode,
    ]);
    if (
      !attempt.current ||
      (!uncertain && attempt.current.signature !== signature)
    )
      attempt.current = { id: randomUUID(), signature };
    const current = attempt.current;

    try {
      const entity = await createEntity.mutateAsync({
        authorId: userId,
        attempt: current,
        categorySlug,
        address_line_1: addressLine1,
        address_line_2: addressLine2 || null,
        district: district || null,
        state: state || null,
        country: country || null,
        locality,
        name,
        postal_code: postalCode || null,
      });
      if (mounted.current)
        router.replace(
          returnToShare
            ? {
                pathname: "/create/share",
                params: { entityId: entity.id },
              }
            : routes.entity(entity.id),
        );
    } catch {
      // The API error remains visible below and supports a corrected retry.
      if (mounted.current) {
        setUncertain(Boolean(current.outcomeUncertain));
        onLockChange(Boolean(current.outcomeUncertain));
      }
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
    try {
      const id = await resolveRecovery.mutateAsync({
        userId,
        operationId: current.id,
        kind: "FIND",
      });
      if (!id) {
        if (mounted.current)
          setLookupMessage(
            "The result is not available yet. Retry creating or check again.",
          );
        return;
      }
      if (mounted.current)
        router.replace(
          returnToShare
            ? { pathname: "/create/share", params: { entityId: id } }
            : routes.entity(id),
        );
    } catch {
      if (mounted.current)
        setLookupMessage(
          "We couldn’t check or clear saved recovery. Please try again.",
        );
    } finally {
      inFlight.current = false;
      if (mounted.current) setChecking(false);
    }
  };

  return (
    <View className="gap-3 rounded-lg border border-border bg-card p-3">
      <View className="gap-1">
        <Text className="text-sm font-semibold">Add find</Text>
        <Text className="text-xs leading-4" variant="muted">
          Only add it if the search above does not show a suitable match.
        </Text>
      </View>

      <LabeledField label="Category">
        {categories.isError ? (
          <Text className="text-destructive" variant="small">
            Could not load categories.
          </Text>
        ) : null}
        <View className="flex-row flex-wrap gap-2">
          {(categories.data ?? []).map((category) => (
            <Button
              key={category.id}
              size="sm"
              variant={categorySlug === category.slug ? "default" : "outline"}
              disabled={createEntity.isPending || uncertain || checking}
              onPress={() => setCategorySlug(category.slug)}
            >
              <Text>{category.label}</Text>
            </Button>
          ))}
        </View>
      </LabeledField>
      <LabeledField label="Find name">
        <Input
          accessibilityLabel="Find name"
          size="compact"
          editable={!createEntity.isPending && !uncertain && !checking}
          placeholder="Find name"
          value={name}
          onChangeText={setName}
        />
      </LabeledField>
      <LabeledField label="Street address (optional)">
        <Input
          accessibilityLabel="Address line 1"
          size="compact"
          editable={!createEntity.isPending && !uncertain && !checking}
          placeholder="Street address"
          value={addressLine1}
          onChangeText={setAddressLine1}
        />
      </LabeledField>
      <LabeledField label="Address details (optional)">
        <Input
          accessibilityLabel="Address line 2"
          size="compact"
          editable={!createEntity.isPending && !uncertain && !checking}
          placeholder="Suite, floor, or landmark (optional)"
          value={addressLine2}
          onChangeText={setAddressLine2}
        />
      </LabeledField>
      <View className="gap-2 sm:flex-row">
        <LabeledField className="flex-1" label="City or locality (optional)">
          <Input
            accessibilityLabel="Locality"
            className="flex-1"
            size="compact"
            editable={!createEntity.isPending && !uncertain && !checking}
            placeholder="City or locality"
            value={locality}
            onChangeText={setLocality}
          />
        </LabeledField>
        <LabeledField className="flex-1" label="State or region (optional)">
          <Input
            accessibilityLabel="State or region"
            className="flex-1"
            size="compact"
            editable={!createEntity.isPending && !uncertain && !checking}
            placeholder="State or region (optional)"
            value={state}
            onChangeText={setState}
          />
        </LabeledField>
      </View>
      <LabeledField label="District (optional)">
        <Input
          accessibilityLabel="District"
          size="compact"
          editable={!createEntity.isPending && !uncertain && !checking}
          placeholder="District (optional)"
          value={district}
          onChangeText={setDistrict}
        />
      </LabeledField>
      <View className="gap-2 sm:flex-row">
        <LabeledField className="flex-1" label="Country (optional)">
          <Input
            accessibilityLabel="Country"
            autoCapitalize="words"
            className="flex-1"
            size="compact"
            editable={!createEntity.isPending && !uncertain && !checking}
            placeholder="Country"
            value={country}
            onChangeText={setCountry}
          />
        </LabeledField>
        <LabeledField className="flex-1" label="Postal code (optional)">
          <Input
            accessibilityLabel="Postal code"
            className="flex-1"
            size="compact"
            editable={!createEntity.isPending && !uncertain && !checking}
            placeholder="Postal code (optional)"
            value={postalCode}
            onChangeText={setPostalCode}
          />
        </LabeledField>
      </View>

      {createEntity.isError ? (
        <Text className="text-destructive" variant="small">
          {createEntity.error.message}
        </Text>
      ) : null}

      {uncertain ? (
        <View className="gap-2">
          <Text variant="small" className="text-destructive">
            Your find may have been created. Check the result or retry before
            editing.
          </Text>
          <Button
            disabled={checking || createEntity.isPending}
            variant="outline"
            onPress={() => void checkOutcome()}
          >
            <Text>{checking ? "Checking…" : "Check result"}</Text>
          </Button>
          {lookupMessage ? <Text variant="small">{lookupMessage}</Text> : null}
        </View>
      ) : null}

      <View className="flex-row justify-end gap-2">
        <Button
          disabled={createEntity.isPending || uncertain || checking}
          size="sm"
          variant="ghost"
          onPress={onCancel}
        >
          <Text>Cancel</Text>
        </Button>
        <Button disabled={!canSubmit} size="sm" onPress={() => void submit()}>
          <Text>{createEntity.isPending ? "Adding…" : "Add find"}</Text>
        </Button>
      </View>
    </View>
  );
}

function LabeledField({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <View className={`gap-2 ${className ?? ""}`}>
      <Text variant="small">{label}</Text>
      {children}
    </View>
  );
}

function EntityResult({
  entity,
  returnToShare,
}: {
  entity: Entity;
  returnToShare: boolean;
}) {
  if (returnToShare) {
    return (
      <Button
        className="w-full items-start border border-border bg-card"
        size="content"
        variant="ghost"
        onPress={() =>
          router.replace({
            pathname: "/create/share",
            params: { entityId: entity.id },
          })
        }
      >
        <View className="min-w-0 flex-1 items-start gap-0.5">
          <Text className="text-sm font-semibold">{entity.name}</Text>
          <Text className="text-xs" variant="muted">
            {formatEntityLocation(entity)}
          </Text>
        </View>
      </Button>
    );
  }

  return (
    <Link href={routes.entity(entity.id)} asChild>
      <Button
        accessibilityRole="link"
        className="w-full items-start border border-border bg-card"
        size="content"
        variant="ghost"
      >
        <View className="min-w-0 flex-1 items-start gap-0.5">
          <Text className="text-sm font-semibold">{entity.name}</Text>
          <Text className="text-xs" variant="muted">
            {formatEntityLocation(entity)}
          </Text>
        </View>
      </Button>
    </Link>
  );
}

function EntitySearchResultsSkeleton() {
  return (
    <View accessibilityLabel="Loading Find results" className="gap-2">
      {["first", "second"].map((key) => (
        <View
          key={key}
          className="min-h-11 w-full gap-1 rounded-lg border border-border bg-card px-3 py-2"
        >
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-3/5" />
        </View>
      ))}
    </View>
  );
}

function SearchState({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return <FeedbackState description={description} title={title} />;
}

function formatEntityLocation(entity: Entity) {
  return [
    entity.category.label,
    entity.address_line_1,
    entity.locality,
    entity.state,
  ]
    .filter(Boolean)
    .join(", ");
}
