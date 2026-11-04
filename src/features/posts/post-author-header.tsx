import type { ReactNode } from "react";
import { View } from "react-native";

import type { PostAuthor } from "@/api/posts";
import { Link } from "expo-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { formatPostDate, getInitials } from "@/lib/format";
import { routes } from "@/lib/routes";

export function PostAuthorHeader({
  author,
  createdAt,
  trailingContent,
}: {
  author: PostAuthor;
  createdAt: string;
  trailingContent?: ReactNode;
}) {
  const avatarLabel = `${author.display_name}'s avatar`;

  return (
    <View className="flex-row items-start justify-between gap-2">
      <Avatar alt={avatarLabel} className="size-9">
        {author.avatar_url ? (
          <AvatarImage
            accessibilityLabel={avatarLabel}
            source={{ uri: author.avatar_url }}
          />
        ) : null}
        <AvatarFallback>
          <Text variant="small">{getInitials(author.display_name)}</Text>
        </AvatarFallback>
      </Avatar>
      <View className="min-w-0 flex-1 items-start">
        <Link href={routes.user(author.username)} className="pointer-cursor">
          <Text className="text-sm font-semibold" numberOfLines={1}>
            {author.display_name}
          </Text>
        </Link>
        <Link href={routes.user(author.username)} className="pointer-cursor">
          <Text className="text-xs" variant="muted" numberOfLines={1}>
            @{author.username} · {formatPostDate(createdAt)}
          </Text>
        </Link>
      </View>
      {trailingContent}
    </View>
  );
}
