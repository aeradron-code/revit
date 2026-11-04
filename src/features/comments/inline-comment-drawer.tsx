import { Send } from "lucide-react-native";
import { ActivityIndicator, View } from "react-native";

import type { CommentWithAuthor } from "@/api/comments";
import { API_ERROR_MESSAGES, normalizeApiError } from "@/api/errors";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { getInitials } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import {
  useCreateReply,
  useCreateTopLevelComment,
  useTopLevelComments,
} from "@/queries/comments";
import { useInlineDrafts } from "./inline-drafts";

export function InlineCommentDrawer({ postId }: { postId: string }) {
  const { profile, user } = useAuth();
  const draftKey = JSON.stringify([user?.id ?? "", postId]);
  const draft = useInlineDrafts((state) => state.drafts[draftKey]);
  const body = draft?.body ?? "";
  const replyBody = draft?.replyBody ?? "";
  const replyingTo = draft?.replyTargetId ?? null;
  const commentPending = Boolean(draft?.commentPending);
  const replyPending = Boolean(draft?.replyPending);
  const updateDraft = (
    change: Parameters<
      ReturnType<typeof useInlineDrafts.getState>["update"]
    >[1],
  ) => useInlineDrafts.getState().update(draftKey, change);
  const setBody = (value: string) =>
    updateDraft((current) => ({
      ...current,
      body: value,
      bodyRevision: current.bodyRevision + 1,
    }));
  const setReplyBody = (value: string) =>
    updateDraft((current) => ({
      ...current,
      replyBody: value,
      replyRevision: current.replyRevision + 1,
    }));
  const comments = useTopLevelComments(postId, {
    pageSize: 2,
    viewerId: user?.id ?? "",
  });
  const createComment = useCreateTopLevelComment(postId, user?.id ?? "");
  const createReply = useCreateReply(postId, user?.id ?? "");
  const items = comments.data?.pages.flatMap((page) => page.items) ?? [];
  const canPost = Boolean(user) && body.trim().length > 0 && !commentPending;
  const canReply =
    Boolean(user) && replyBody.trim().length > 0 && !replyPending;
  const displayName = profile?.display_name ?? user?.email ?? "You";

  const submit = async () => {
    if (!canPost) return;
    const token = useInlineDrafts.getState().begin(draftKey, "comment");
    if (token === null) return;

    try {
      await createComment.mutateAsync(body);
      useInlineDrafts.getState().finish(draftKey, "comment", token, true);
    } catch (error) {
      useInlineDrafts
        .getState()
        .finish(
          draftKey,
          "comment",
          token,
          false,
          normalizeApiError(error, API_ERROR_MESSAGES.POST_YOUR_COMMENT)
            .message,
        );
      // Keep the draft visible so the user can retry.
    }
  };

  const openReply = (comment: CommentWithAuthor) => {
    if (useInlineDrafts.getState().drafts[draftKey]?.replyPending) return;
    if (replyingTo === comment.id) {
      updateDraft((current) => ({
        ...current,
        replyTargetId: null,
        replyRevision: current.replyRevision + 1,
      }));
      return;
    }

    createReply.reset();
    updateDraft((current) => ({
      ...current,
      replyBody: "",
      replyTargetId: comment.id,
      replyError: null,
      replyRevision: current.replyRevision + 1,
    }));
  };

  const submitReply = async () => {
    if (!replyingTo || !canReply) return;
    const token = useInlineDrafts.getState().begin(draftKey, "reply");
    if (token === null) return;

    try {
      await createReply.mutateAsync({
        body: replyBody,
        parentId: replyingTo,
      });
      useInlineDrafts.getState().finish(draftKey, "reply", token, true);
    } catch (error) {
      useInlineDrafts
        .getState()
        .finish(
          draftKey,
          "reply",
          token,
          false,
          normalizeApiError(error, API_ERROR_MESSAGES.POST_YOUR_COMMENT)
            .message,
        );
      // Keep the draft visible so the user can retry.
    }
  };

  return (
    <View className="gap-2 border-t border-border bg-elevated px-3 py-2 w-full">
      <View className="gap-2">
        <View className="flex-row items-center gap-2">
          <Avatar alt={`${displayName}'s avatar`} className="size-10">
            {profile?.avatar_url ? (
              <AvatarImage
                accessibilityLabel={`${displayName}'s avatar`}
                source={{ uri: profile.avatar_url }}
              />
            ) : null}
            <AvatarFallback className="bg-secondary">
              <Text className="text-xs">{getInitials(displayName)}</Text>
            </AvatarFallback>
          </Avatar>
          <Input
            accessibilityLabel="Add a comment"
            className="flex-1"
            editable={!commentPending && Boolean(user)}
            maxLength={2000}
            onChangeText={setBody}
            placeholder={user ? "Add a comment…" : "Sign in to comment"}
            size="compact"
            value={body}
          />
          <Button
            accessibilityLabel="Post comment"
            disabled={!canPost}
            onPress={() => void submit()}
            size="icon"
          >
            {commentPending ? (
              <ActivityIndicator className="size-4" />
            ) : (
              <Icon as={Send} className="size-4" />
            )}
          </Button>
        </View>

        {draft?.commentError ? (
          <Text className="text-xs text-destructive">{draft.commentError}</Text>
        ) : null}
      </View>

      <View className="-mx-5">
        <Separator />
      </View>

      {comments.isLoading ? <InlineCommentsLoading /> : null}

      {comments.isError && items.length === 0 ? (
        <View className="flex-row items-center gap-2">
          <Text className="text-sm" variant="muted">
            Comments could not be loaded.
          </Text>
          <Button
            onPress={() => void comments.refetch()}
            size="xs"
            variant="link"
          >
            <Text className="text-sm">Try again</Text>
          </Button>
        </View>
      ) : null}

      {!comments.isLoading && !comments.isError && items.length === 0 ? (
        <Text className="text-sm" variant="muted">
          No comments yet.
        </Text>
      ) : null}

      {items.length > 0 ? (
        <View className="gap-2">
          {items.map((comment) => (
            <View key={comment.id} className="gap-1.5">
              <View className="flex-row gap-3 rounded-lg bg-card px-3 py-2.5">
                <Avatar
                  alt={`${comment.author.display_name}'s avatar`}
                  className="size-8"
                >
                  {comment.author.avatar_url ? (
                    <AvatarImage
                      accessibilityLabel={`${comment.author.display_name}'s avatar`}
                      source={{ uri: comment.author.avatar_url }}
                    />
                  ) : null}
                  <AvatarFallback className="bg-muted">
                    <Text className="text-xs">
                      {getInitials(comment.author.display_name)}
                    </Text>
                  </AvatarFallback>
                </Avatar>
                <View className="min-w-0 flex-1 gap-1">
                  <View className="flex-row items-baseline justify-between">
                    <Text
                      className="min-w-0 flex-1 text-xs font-semibold"
                      numberOfLines={1}
                    >
                      {comment.author.display_name}
                    </Text>
                    <Text className="text-xs" variant="muted">
                      {formatRelativeTime(comment.created_at)}
                    </Text>
                  </View>
                  <Text className="text-xs leading-4" numberOfLines={2}>
                    {comment.body}
                  </Text>
                  <Button
                    className="self-start p-0 pt-1"
                    disabled={replyPending}
                    onPress={() => openReply(comment)}
                    size="icon"
                    variant="link"
                  >
                    <Text className="text-xs text-primary">Reply</Text>
                  </Button>
                </View>
              </View>
              {replyingTo === comment.id || comment.replies.length > 0 ? (
                <View className="ml-8 gap-1.5 border-l border-border pl-3">
                  {replyingTo === comment.id ? (
                    <View className="gap-1 rounded-lg bg-card px-2 py-1">
                      <View className="flex-row items-center justify-between gap-2">
                        <Text className="text-xs ml-1" variant="muted">
                          Replying to {comment.author.display_name}
                        </Text>
                        <Button
                          className="p-0"
                          disabled={replyPending}
                          onPress={() =>
                            updateDraft((current) => ({
                              ...current,
                              replyTargetId: null,
                              replyRevision: current.replyRevision + 1,
                            }))
                          }
                          size="xs"
                          variant="link"
                        >
                          <Text className="text-xs">Cancel</Text>
                        </Button>
                      </View>
                      <View className="flex-row items-center gap-2">
                        <Avatar
                          alt={`${displayName}'s avatar`}
                          className="size-8"
                        >
                          {profile?.avatar_url ? (
                            <AvatarImage
                              accessibilityLabel={`${displayName}'s avatar`}
                              source={{ uri: profile.avatar_url }}
                            />
                          ) : null}
                          <AvatarFallback className="bg-secondary">
                            <Text className="text-xs">
                              {getInitials(displayName)}
                            </Text>
                          </AvatarFallback>
                        </Avatar>
                        <Input
                          accessibilityLabel={`Reply to ${comment.author.display_name}`}
                          className="flex-1"
                          editable={!replyPending && Boolean(user)}
                          maxLength={2000}
                          onChangeText={setReplyBody}
                          placeholder={
                            user ? "Add a reply…" : "Sign in to reply"
                          }
                          size="compact"
                          value={replyBody}
                        />
                        <Button
                          accessibilityLabel="Post reply"
                          disabled={!canReply}
                          onPress={() => void submitReply()}
                          size="icon"
                        >
                          {replyPending ? (
                            <ActivityIndicator className="size-4" />
                          ) : (
                            <Icon as={Send} className="size-4" />
                          )}
                        </Button>
                      </View>
                      {draft?.replyError ? (
                        <Text className="text-xs text-destructive">
                          {draft.replyError}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                  {comment.replies.map((reply) => (
                    <View
                      key={reply.id}
                      className="flex-row gap-3 rounded-lg bg-card px-3 py-2.5"
                    >
                      <Avatar
                        alt={`${reply.author.display_name}'s avatar`}
                        className="size-8"
                      >
                        {reply.author.avatar_url ? (
                          <AvatarImage
                            accessibilityLabel={`${reply.author.display_name}'s avatar`}
                            source={{ uri: reply.author.avatar_url }}
                          />
                        ) : null}
                        <AvatarFallback className="bg-muted">
                          <Text className="text-xs">
                            {getInitials(reply.author.display_name)}
                          </Text>
                        </AvatarFallback>
                      </Avatar>
                      <View className="min-w-0 flex-1 gap-0.5">
                        <View className="flex-row items-baseline justify-between gap-3">
                          <Text
                            className="min-w-0 flex-1 text-xs font-semibold"
                            numberOfLines={1}
                          >
                            {reply.author.display_name}
                          </Text>
                          <Text className="text-xs" variant="muted">
                            {formatRelativeTime(reply.created_at)}
                          </Text>
                        </View>
                        <Text className="text-xs leading-4" numberOfLines={2}>
                          {reply.body}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {comments.hasNextPage ? (
        <Button
          className="self-center"
          disabled={comments.isFetchingNextPage}
          onPress={() => void comments.fetchNextPage()}
          size="xs"
          variant="link"
        >
          {comments.isFetchingNextPage ? (
            <ActivityIndicator className="size-4" />
          ) : null}
          <Text className="text-sm text-primary">
            {comments.isFetchingNextPage ? "Loading…" : "Load more comments"}
          </Text>
        </Button>
      ) : null}

      {comments.isFetchNextPageError ? (
        <View className="flex-row items-center justify-center gap-2">
          <Text className="text-xs text-destructive">
            More comments could not be loaded.
          </Text>
          <Button
            onPress={() => void comments.fetchNextPage()}
            size="xs"
            variant="link"
          >
            <Text className="text-xs">Try again</Text>
          </Button>
        </View>
      ) : null}
    </View>
  );
}

function InlineCommentsLoading() {
  return (
    <View className="gap-3">
      {["first", "second"].map((key) => (
        <View key={key} className="flex-row gap-3">
          <Skeleton className="size-8 rounded-full bg-secondary" />
          <View className="flex-1 gap-2 py-0.5">
            <Skeleton className="h-3 w-28 rounded-sm bg-secondary" />
            <Skeleton className="h-3 w-full rounded-sm bg-secondary" />
          </View>
        </View>
      ))}
    </View>
  );
}

function formatRelativeTime(createdAt: string) {
  const minutes = Math.max(
    1,
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000),
  );

  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  return `${Math.floor(hours / 24)}d`;
}
