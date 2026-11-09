import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getMyBlockStatus,
  getReports,
  markReportReviewed,
  setUserBlocked,
  submitContentReport,
  type ReportTargetType,
  type ReportReason,
} from "@/api/safety";
import { queryKeys } from "@/lib/query/query-keys";

export function useMyBlockStatus(viewerId: string, targetId: string) {
  return useQuery({
    enabled: Boolean(viewerId && targetId && viewerId !== targetId),
    queryFn: ({ signal }) => getMyBlockStatus(targetId, signal),
    queryKey: queryKeys.safety.blockStatus(viewerId, targetId),
  });
}

export function useSubmitContentReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      targetType: ReportTargetType;
      targetId: string;
      reason: ReportReason;
      details: string;
    }) => submitContentReport(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.safety.reports() }),
  });
}

export function useSetUserBlocked(viewerId: string, targetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (blocked: boolean) =>
      setUserBlocked(viewerId, targetId, blocked),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.safety.blockStatus(viewerId, targetId),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.posts.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.feed.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.comments.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.forums.postsAll }),
        queryClient.invalidateQueries({ queryKey: queryKeys.shares.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.follows.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.discover.all }),
      ]);
    },
  });
}

export function useSafetyReports(enabled = true) {
  return useQuery({
    enabled,
    queryFn: ({ signal }) => getReports(signal),
    queryKey: queryKeys.safety.reports(),
  });
}

export function useMarkReportReviewed(adminId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reportId: string) => markReportReviewed(reportId, adminId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.safety.reports() }),
  });
}
