import { Link } from "expo-router";
import { MessageCircle } from "lucide-react-native";
import { memo, useCallback } from "react";
import type { ReactElement, ReactNode } from "react";
import { useRef, useState } from "react";
import type { ListRenderItem } from "react-native";
import { View } from "react-native";

import type { CommentThread, CommentWithAuthor } from "@/api/comments";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FeedbackState } from "@/components/ui/feedback-state";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { getInitials } from "@/lib/format";
import { routes } from "@/lib/routes";
import { useAuthUser } from "@/providers/auth-provider";
import {
  useCreateReply,
  useCreateTopLevelComment,
  useDeleteComment,
  type useTopLevelComments,
  useUpdateComment,
} from "@/queries/comments";

type CommentSectionProps = {
  canInteract?: boolean;
  comments: ReturnType<typeof useTopLevelComments>;
  postId: string;
  listHeader?: ReactNode;
  renderList: (content: CommentListContent) => ReactNode;
};

export type CommentListContent = {
  data: CommentListRow[];
  keyExtractor: (item: CommentListRow) => string;
  ListHeaderComponent: ReactElement;
  ListFooterComponent: ReactElement;
  renderItem: ListRenderItem<CommentListRow>;
};

export type CommentListRow =
  | { kind: "thread"; comment: CommentThread }
  | { kind: "reply"; parentId: string; comment: CommentWithAuthor };

export function CommentSection({
  canInteract = true,
  comments,
  postId,
  listHeader: pageHeader,
  renderList,
}: CommentSectionProps) {
  const user = useAuthUser();
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState<CommentWithAuthor | null>(null);
  const [editBody, setEditBody] = useState("");
  const [deleting, setDeleting] = useState<CommentWithAuthor | null>(null);
  const [replyingTo, setReplyingTo] = useState<CommentWithAuthor | null>(null);
  const commentInFlight = useRef(false);
  const bodyRef = useRef(body);
  const replyInFlight = useRef(false);
  const createComment = useCreateTopLevelComment(postId, user?.id ?? "");
  const createReply = useCreateReply(postId, user?.id ?? "");
  const updateComment = useUpdateComment(postId);
  const deleteComment = useDeleteComment(postId);
  const items = comments.data?.pages.flatMap((page) => page.items) ?? [];
  const listItems: CommentListRow[] = items.flatMap((comment) => [
    { kind: "thread", comment },
    ...comment.replies.map((reply) => ({
      kind: "reply" as const,
      parentId: comment.id,
      comment: reply,
    })),
  ]);
  const totalCount = comments.data?.pages[0]?.totalCount ?? 0;
  const canPost =
    canInteract && body.trim().length > 0 && !createComment.isPending;
  const canSave =
    canInteract && editBody.trim().length > 0 && !updateComment.isPending;

  const submit = async () => {
    if (!canInteract || !canPost || commentInFlight.current) return;
    commentInFlight.current = true;
    const submittedBody = body;

    try {
      await createComment.mutateAsync(submittedBody);
      if (bodyRef.current === submittedBody) {
        bodyRef.current = "";
        setBody("");
      }
    } catch {
      // Keep the draft and show the mutation error so the user can retry.
    } finally {
      commentInFlight.current = false;
    }
  };

  const changeBody = (value: string) => {
    bodyRef.current = value;
    setBody(value);
  };

  const openEditor = useCallback(
    (comment: CommentWithAuthor) => {
      if (!canInteract) return;
      updateComment.reset();
      setEditBody(comment.body);
      setEditing(comment);
    },
    [canInteract, updateComment.reset],
  );

  const openReply = useCallback(
    (comment: CommentWithAuthor) => {
      if (!canInteract || replyInFlight.current) return;
      createReply.reset();
      setReplyingTo(comment);
    },
    [canInteract, createReply.reset],
  );

  const submitReply = useCallback(
    async (target: CommentWithAuthor, replyBody: string) => {
      if (!canInteract || !replyBody.trim() || replyInFlight.current) return;
      replyInFlight.current = true;

      try {
        await createReply.mutateAsync({
          body: replyBody,
          parentId: target.id,
        });
        setReplyingTo(null);
      } catch {
        // Keep the reply draft visible and show the error for a retry.
      } finally {
        replyInFlight.current = false;
      }
    },
    [canInteract, createReply.mutateAsync],
  );

  const cancelReply = useCallback(() => setReplyingTo(null), []);
  const openDelete = useCallback(
    (comment: CommentWithAuthor) => {
      if (!canInteract) return;
      deleteComment.reset();
      setDeleting(comment);
    },
    [canInteract, deleteComment.reset],
  );

  const save = async () => {
    if (!canInteract || !editing || !canSave) return;

    try {
      await updateComment.mutateAsync({
        body: editBody,
        commentId: editing.id,
      });
      setEditing(null);
    } catch {
      // Keep the editor open and show the mutation error for a retry.
    }
  };

  const remove = async () => {
    if (!canInteract || !deleting) return;

    try {
      await deleteComment.mutateAsync(deleting.id);
      setDeleting(null);
    } catch {
      // Keep the confirmation open and show the mutation error for a retry.
    }
  };

  const listHeader = (
    <View className="gap-3 md:gap-6">
      {pageHeader}
      <View className="gap-3">
        <View className="flex-row items-center justify-between gap-3 pl-1">
          <Text className="text-xl font-semibold">Comments</Text>
          <Text className="rounded-md bg-secondary px-2 py-1 text-sm text-secondary-foreground">
            {totalCount} {totalCount === 1 ? "comment" : "comments"}
          </Text>
        </View>
        <View className="gap-3 rounded-lg border border-border bg-card p-3 shadow-none">
          <Textarea
            accessibilityLabel="Write a comment"
            editable={canInteract && !createComment.isPending}
            maxLength={2000}
            onChangeText={changeBody}
            placeholder={
              canInteract
                ? "Add to the conversation…"
                : "Join this forum to comment"
            }
            value={body}
          />
          <View className="flex-row items-center justify-between gap-3">
            <Text variant="muted">{body.length}/2000</Text>
            <Button disabled={!canPost} onPress={() => void submit()}>
              <Text>
                {createComment.isPending ? "Posting…" : "Post comment"}
              </Text>
            </Button>
          </View>
          {createComment.isError ? (
            <Text className="text-destructive" variant="small">
              {createComment.error.message}
            </Text>
          ) : null}
        </View>
        {comments.isLoading ? <CommentListLoading /> : null}
        {comments.isError && items.length === 0 ? (
          <FeedbackState
            actionLabel="Retry"
            onAction={() => void comments.refetch()}
            title="Couldn’t load comments."
            variant="error"
          />
        ) : null}
        {!comments.isLoading && !comments.isError && items.length === 0 ? (
          <View className="items-center gap-2 rounded-lg border border-border bg-card px-4 py-6">
            <View className="size-10 items-center justify-center rounded-full bg-muted">
              <Icon as={MessageCircle} className="size-5 text-foreground" />
            </View>
            <Text className="font-semibold">No comments yet</Text>
            <Text variant="muted">Start the conversation.</Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  const listFooter = (
    <View className="gap-2">
      {comments.hasNextPage ? (
        <Button
          disabled={comments.isFetchingNextPage}
          variant="outline"
          onPress={() => void comments.fetchNextPage()}
        >
          <Text>
            {comments.isFetchingNextPage ? "Loading…" : "Load more comments"}
          </Text>
        </Button>
      ) : null}
      {comments.isFetchNextPageError ? (
        <View className="items-start gap-2">
          <Text className="text-destructive" variant="small">
            More comments could not be loaded.
          </Text>
          <Button variant="link" onPress={() => void comments.fetchNextPage()}>
            <Text>Try again</Text>
          </Button>
        </View>
      ) : null}
    </View>
  );

  const renderComment: ListRenderItem<CommentListRow> = ({ item }) => {
    if (item.kind === "reply") {
      return (
        <View className="ml-4 border-l-2 border-secondary pl-3 sm:ml-8 sm:pl-4">
          <CommentItem
            comment={item.comment}
            isOwn={item.comment.author_id === user?.id}
            onDelete={() => openDelete(item.comment)}
            onEdit={() => openEditor(item.comment)}
            canInteract={canInteract}
            isReply
          />
        </View>
      );
    }

    const comment = item.comment;
    return (
      <CommentThreadItem
        comment={comment}
        currentUserId={user?.id}
        onDelete={openDelete}
        onEdit={openEditor}
        onReply={openReply}
        isReplyingTo={replyingTo?.id === comment.id}
        isReplyPending={replyingTo?.id === comment.id && createReply.isPending}
        replyError={
          replyingTo?.id === comment.id ? createReply.error?.message : undefined
        }
        onCancelReply={cancelReply}
        onSubmitReply={submitReply}
        canInteract={canInteract}
      />
    );
  };

  return (
    <>
      {renderList({
        data: listItems,
        keyExtractor: (item) => `${item.kind}:${item.comment.id}`,
        ListHeaderComponent: listHeader,
        ListFooterComponent: listFooter,
        renderItem: renderComment,
      })}

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit comment</DialogTitle>
            <DialogDescription>Update what you wrote.</DialogDescription>
          </DialogHeader>
          <View className="gap-2">
            <Textarea
              editable={canInteract && !updateComment.isPending}
              maxLength={2000}
              onChangeText={setEditBody}
              value={editBody}
            />
            <Text className="text-right" variant="muted">
              {editBody.length}/2000
            </Text>
            {updateComment.isError ? (
              <Text className="text-destructive" variant="small">
                {updateComment.error.message}
              </Text>
            ) : null}
          </View>
          <DialogFooter>
            <Button
              disabled={updateComment.isPending}
              onPress={() => setEditing(null)}
              variant="secondary"
            >
              <Text>Cancel</Text>
            </Button>
            <Button disabled={!canSave} onPress={() => void save()}>
              <Text>
                {updateComment.isPending ? "Saving…" : "Save changes"}
              </Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this comment?</DialogTitle>
            <DialogDescription>
              This permanently removes the comment.
            </DialogDescription>
          </DialogHeader>
          {deleteComment.isError ? (
            <Text className="text-destructive" variant="small">
              {deleteComment.error.message}
            </Text>
          ) : null}
          <DialogFooter>
            <Button
              disabled={!canInteract || deleteComment.isPending}
              onPress={() => setDeleting(null)}
              variant="secondary"
            >
              <Text>Cancel</Text>
            </Button>
            <Button
              disabled={!canInteract || deleteComment.isPending}
              onPress={() => void remove()}
              variant="destructive"
            >
              <Text>
                {deleteComment.isPending ? "Deleting…" : "Delete comment"}
              </Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const CommentThreadItem = memo(function CommentThreadItem({
  comment,
  currentUserId,
  onDelete,
  onEdit,
  onReply,
  isReplyingTo,
  isReplyPending,
  replyError,
  onCancelReply,
  onSubmitReply,
  canInteract,
}: {
  comment: CommentThread;
  currentUserId?: string;
  onDelete: (comment: CommentWithAuthor) => void;
  onEdit: (comment: CommentWithAuthor) => void;
  onReply: (comment: CommentWithAuthor) => void;
  isReplyingTo: boolean;
  isReplyPending: boolean;
  replyError?: string;
  onCancelReply: () => void;
  onSubmitReply: (comment: CommentWithAuthor, body: string) => Promise<void>;
  canInteract: boolean;
}) {
  return (
    <View className="gap-1">
      <CommentItem
        comment={comment}
        isOwn={comment.author_id === currentUserId}
        onDelete={() => onDelete(comment)}
        onEdit={() => onEdit(comment)}
        onReply={() => onReply(comment)}
        replyDisabled={isReplyPending || !canInteract}
        canInteract={canInteract}
      />
      {isReplyingTo && canInteract ? (
        <ReplyComposer
          comment={comment}
          error={replyError}
          isPending={isReplyPending}
          onCancel={onCancelReply}
          onSubmit={onSubmitReply}
        />
      ) : null}
    </View>
  );
});

function ReplyComposer({
  comment,
  error,
  isPending,
  onCancel,
  onSubmit,
}: {
  comment: CommentWithAuthor;
  error?: string;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (comment: CommentWithAuthor, body: string) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const canSubmit = body.trim().length > 0 && !isPending;

  return (
    <View className="ml-4 gap-3 rounded-lg border border-border bg-card p-3 shadow-none sm:ml-8">
      <Text className="text-sm" variant="muted">
        Replying to {comment.author.display_name}
      </Text>
      <Textarea
        accessibilityLabel={`Reply to ${comment.author.display_name}`}
        editable={!isPending}
        maxLength={2000}
        onChangeText={setBody}
        placeholder="Write a reply…"
        value={body}
      />
      <View className="flex-row items-center justify-between gap-3">
        <Text variant="muted">{body.length}/2000</Text>
        <View className="flex-row gap-2">
          <Button disabled={isPending} onPress={onCancel} variant="secondary">
            <Text>Cancel</Text>
          </Button>
          <Button
            disabled={!canSubmit}
            onPress={() => void onSubmit(comment, body)}
          >
            <Text>{isPending ? "Replying…" : "Post reply"}</Text>
          </Button>
        </View>
      </View>
      {error ? (
        <Text className="text-destructive" variant="small">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function CommentItem({
  comment,
  isReply = false,
  isOwn,
  onDelete,
  onEdit,
  onReply,
  replyDisabled = false,
  canInteract = true,
}: {
  comment: CommentWithAuthor;
  isReply?: boolean;
  isOwn: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onReply?: () => void;
  replyDisabled?: boolean;
  canInteract?: boolean;
}) {
  return (
    <View
      className={
        isReply
          ? "gap-2 rounded-md bg-muted/70 p-3"
          : "gap-2 rounded-lg border border-border bg-card p-3 shadow-none"
      }
    >
      <View className="flex-row items-start justify-between gap-3">
        <Link href={routes.user(comment.author.username)} asChild>
          <Button
            variant="ghost"
            className="min-w-0 flex-1 gap-3"
            size="content"
          >
            <Avatar
              alt={`${comment.author.display_name}'s avatar`}
              className="size-9"
            >
              {comment.author.avatar_url ? (
                <AvatarImage
                  accessibilityLabel={`${comment.author.display_name}'s avatar`}
                  source={{ uri: comment.author.avatar_url }}
                />
              ) : null}
              <AvatarFallback>
                <Text variant="small">
                  {getInitials(comment.author.display_name)}
                </Text>
              </AvatarFallback>
            </Avatar>
            <View className="min-w-0 flex-1 items-start">
              <Text className="font-medium" numberOfLines={1}>
                {comment.author.display_name}
              </Text>
              <Text numberOfLines={1} variant="muted">
                @{comment.author.username} ·{" "}
                {formatCommentDate(comment.created_at)}
                {comment.updated_at !== comment.created_at ? " · edited" : ""}
              </Text>
            </View>
          </Button>
        </Link>
        {isOwn ? (
          <View className="flex-row gap-1">
            <Button
              disabled={!canInteract}
              onPress={onEdit}
              size="sm"
              variant="ghost"
            >
              <Text>Edit</Text>
            </Button>
            <Button
              disabled={!canInteract}
              onPress={onDelete}
              size="sm"
              variant="ghost"
            >
              <Text className="text-destructive">Delete</Text>
            </Button>
          </View>
        ) : null}
      </View>
      <Text className="leading-6">{comment.body}</Text>
      {onReply ? (
        <Button
          className="self-start"
          disabled={replyDisabled || !canInteract}
          onPress={onReply}
          size="sm"
          variant="ghost"
        >
          <Text>Reply</Text>
        </Button>
      ) : null}
    </View>
  );
}

function CommentListLoading() {
  return (
    <View className="gap-3">
      <Skeleton className="h-28 w-full rounded-lg" />
      <Skeleton className="h-28 w-full rounded-lg" />
    </View>
  );
}

function formatCommentDate(createdAt: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(createdAt));
}
