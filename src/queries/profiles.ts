import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getFollowCounts,
  getProfile,
  getProfileByUsername,
  type Profile,
  type UpdateProfileInput,
  updateProfile,
} from "@/api/profiles";
import { queryKeys } from "@/lib/query/query-keys";

export function useProfile(profileId: string) {
  return useQuery({
    enabled: profileId.length > 0,
    queryFn: ({ signal }) => getProfile(profileId, signal),
    queryKey: queryKeys.profiles.byId(profileId),
  });
}

export function useProfileByUsername(username: string) {
  return useQuery({
    enabled: username.length > 0,
    queryFn: ({ signal }) => getProfileByUsername(username, signal),
    queryKey: queryKeys.profiles.byUsername(username),
  });
}

export function useFollowCounts(profileId: string) {
  return useQuery({
    enabled: profileId.length > 0,
    queryFn: ({ signal }) => getFollowCounts(profileId, signal),
    queryKey: queryKeys.profiles.followCounts(profileId),
  });
}

export function useUpdateProfile(profileId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateProfileInput) => {
      if (!profileId) {
        throw new Error("You must be signed in to update your profile.");
      }

      return updateProfile(profileId, input);
    },
    onSuccess: async (profile) => {
      const previousProfile = queryClient.getQueryData<Profile | null>(
        queryKeys.profiles.byId(profileId),
      );

      queryClient.setQueryData(queryKeys.profiles.byId(profileId), profile);
      if (profile.username)
        queryClient.setQueryData(
          queryKeys.profiles.byUsername(profile.username),
          profile,
        );

      if (
        previousProfile?.username &&
        previousProfile.username !== profile.username
      ) {
        queryClient.removeQueries({
          exact: true,
          queryKey: queryKeys.profiles.byUsername(previousProfile.username),
        });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.follows.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.posts.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.feed.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.forums.postsAll }),
        queryClient.invalidateQueries({ queryKey: queryKeys.shares.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.picks.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.forums.all }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.notifications.all,
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.discover.all }),
      ]);
    },
  });
}
