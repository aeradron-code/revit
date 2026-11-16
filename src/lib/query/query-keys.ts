export const queryKeys = {
  safety: {
    all: ["safety"] as const,
    reports: () => [...queryKeys.safety.all, "reports"] as const,
    blockStatus: (viewerId: string, targetId: string) =>
      [...queryKeys.safety.all, "block-status", viewerId, targetId] as const,
  },
  comments: {
    all: ["comments"] as const,
    byPostPrefix: (postId: string) =>
      [...queryKeys.comments.all, "post", postId] as const,
    byPost: (postId: string, viewerId: string) =>
      [...queryKeys.comments.byPostPrefix(postId), viewerId] as const,
    inlineByPost: (postId: string, viewerId: string, pageSize: number) =>
      [
        ...queryKeys.comments.byPost(postId, viewerId),
        "inline",
        pageSize,
      ] as const,
    count: (postId: string, viewerId: string) =>
      [...queryKeys.comments.byPost(postId, viewerId), "count"] as const,
  },
  discover: {
    all: ["discover"] as const,
    search: (query: string, viewerId: string) =>
      [...queryKeys.discover.all, query, viewerId] as const,
  },
  entities: {
    all: ["entities"] as const,
    categories: () => [...queryKeys.entities.all, "categories"] as const,
    byId: (id: string) => [...queryKeys.entities.all, "id", id] as const,
    search: (query: string, category?: string) =>
      [...queryKeys.entities.all, "search", category ?? "all", query] as const,
  },
  feed: {
    all: ["feed"] as const,
    home: (viewerId: string, mode: "following" | "for-you") =>
      [...queryKeys.feed.all, "home", viewerId, mode] as const,
  },
  follows: {
    all: ["follows"] as const,
    followers: (profileId: string) =>
      [...queryKeys.follows.all, "followers", profileId] as const,
    following: (profileId: string) =>
      [...queryKeys.follows.all, "following", profileId] as const,
    status: (followerId: string, followingId: string) =>
      [...queryKeys.follows.all, "status", followerId, followingId] as const,
  },
  forums: {
    all: ["forums"] as const,
    list: (viewerId: string) =>
      [...queryKeys.forums.all, "list", viewerId] as const,
    byIdPrefix: (forumId: string) =>
      [...queryKeys.forums.all, "id", forumId] as const,
    byId: (forumId: string, userId: string) =>
      [...queryKeys.forums.byIdPrefix(forumId), userId] as const,
    postsAll: ["forums", "posts"] as const,
    postsByForum: (forumId: string) =>
      [...queryKeys.forums.postsAll, forumId] as const,
    posts: (forumId: string, userId: string) =>
      [...queryKeys.forums.postsByForum(forumId), userId] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    list: (userId: string) =>
      [...queryKeys.notifications.all, "list", userId] as const,
    unread: (userId: string) =>
      [...queryKeys.notifications.all, "unread", userId] as const,
  },
  profiles: {
    all: ["profiles"] as const,
    byId: (profileId: string) =>
      [...queryKeys.profiles.all, "id", profileId] as const,
    byUsername: (username: string) =>
      [...queryKeys.profiles.all, "username", username] as const,
    followCounts: (profileId: string) =>
      [...queryKeys.profiles.all, profileId, "follow-counts"] as const,
  },
  shares: {
    all: ["shares"] as const,
    byEntity: (entityId: string) =>
      [...queryKeys.shares.all, "entity", entityId] as const,
    mine: (entityId: string, authorId: string) =>
      [...queryKeys.shares.all, "mine", entityId, authorId] as const,
    scoreByPostPrefix: (postId: string) =>
      [...queryKeys.shares.all, "score", postId] as const,
    score: (postId: string, viewerId: string) =>
      [...queryKeys.shares.scoreByPostPrefix(postId), viewerId] as const,
    summary: (entityId: string) =>
      [...queryKeys.shares.all, "summary", entityId] as const,
  },
  posts: {
    all: ["posts"] as const,
    byAuthorPrefix: (authorId: string) =>
      [...queryKeys.posts.all, "author", authorId] as const,
    byAuthor: (authorId: string) => queryKeys.posts.byAuthorPrefix(authorId),
    byIdPrefix: (postId: string) =>
      [...queryKeys.posts.all, "id", postId] as const,
    byId: (postId: string, viewerId: string) =>
      [...queryKeys.posts.byIdPrefix(postId), viewerId] as const,
  },
  picks: {
    all: ["picks"] as const,
    byAuthor: (authorId: string) =>
      [...queryKeys.picks.all, "author", authorId] as const,
    byId: (pickId: string) => [...queryKeys.picks.all, "id", pickId] as const,
    followingDirectory: (userId: string) =>
      [...queryKeys.picks.all, "following-directory", userId] as const,
    followed: (userId: string) =>
      [...queryKeys.picks.all, "followed", userId] as const,
  },
  recovery: {
    all: ["creation-recovery"] as const,
    ask: (userId: string) =>
      [...queryKeys.recovery.all, "ask", userId] as const,
    postsByUser: (userId: string) =>
      [...queryKeys.recovery.all, "posts", userId] as const,
    posts: (userId: string, kinds: readonly string[]) =>
      [...queryKeys.recovery.postsByUser(userId), ...kinds] as const,
    resources: (userId: string, kind: string) =>
      [...queryKeys.recovery.all, "resources", userId, kind] as const,
  },
  ratings: {
    all: ["ratings"] as const,
    mine: (postId: string, raterId: string) =>
      [...queryKeys.ratings.all, "mine", postId, raterId] as const,
    summaryByPostPrefix: (postId: string) =>
      [...queryKeys.ratings.all, "summary", postId] as const,
    summary: (postId: string, viewerId: string) =>
      [...queryKeys.ratings.summaryByPostPrefix(postId), viewerId] as const,
  },
} as const;
