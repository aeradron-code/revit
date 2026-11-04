import type { Href } from "expo-router";

const routeTable = {
  activity: "/activity",
  auth: "/auth",
  create: "/create",
  createAsk: "/create/ask",
  createForum: "/forums/create",
  createPick: "/picks/create",
  createShare: "/create/share",
  discover: "/discover",
  forums: "/forums",
  home: "/",
  picks: "/picks",
  profile: "/profile",
  entitySearch: "/entities/search",
  entitySearchForShare: {
    pathname: "/entities/search",
    params: { returnTo: "share" },
  },
  entity: (id: string) => ({ pathname: "/entities/[id]", params: { id } }),
  forum: (id: string) => ({ pathname: "/forums/[id]", params: { id } }),
  createForumPost: (id: string) => ({
    pathname: "/forums/[id]/create",
    params: { id },
  }),
  pick: (id: string) => ({ pathname: "/picks/[id]", params: { id } }),
  editPick: (pickId: string) => ({
    pathname: "/picks/create",
    params: { pickId },
  }),
  post: (id: string) => ({ pathname: "/posts/[id]", params: { id } }),
  user: (username: string | null) => ({
    pathname: "/users/[username]",
    params: { username: username ?? "" },
  }),
  followers: (username: string) => ({
    pathname: "/users/[username]/followers",
    params: { username },
  }),
  following: (username: string) => ({
    pathname: "/users/[username]/following",
    params: { username },
  }),
} as const satisfies Record<string, Href | ((value: string) => Href)>;

export const routes = Object.assign(routeTable, {
  forumPost: (id: string, postId: string): Href =>
    `/forums/${encodeURIComponent(id)}/posts/${encodeURIComponent(postId)}` as Href,
});
