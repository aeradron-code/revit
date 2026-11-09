import { Link, router, Stack, type Href } from "expo-router";
import { useMemo } from "react";
import { FlatList, View } from "react-native";

import type { Report } from "@/api/safety";
import { API_ERROR_MESSAGES } from "@/api/errors";
import { AppHeader } from "@/components/navigation/app-header";
import { Button } from "@/components/ui/button";
import { FeedbackState } from "@/components/ui/feedback-state";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { routes } from "@/lib/routes";
import { useAuth } from "@/providers/auth-provider";
import { useMarkReportReviewed, useSafetyReports } from "@/queries/safety";

export function AdminReportsScreen() {
  const { profile, user } = useAuth();
  const reports = useSafetyReports(profile?.role === "admin");
  const markReviewed = useMarkReportReviewed(user?.id ?? "");
  const items = useMemo(
    () => [...(reports.data ?? [])].sort(reportOrder),
    [reports.data],
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <Stack.Screen
        options={{
          header: () => (
            <AppHeader
              showAccountActions
              title="Report review"
              onBack={() => router.replace(routes.settings)}
            />
          ),
        }}
      />
      {profile?.role !== "admin" ? (
        <View className="mx-auto w-full max-w-3xl p-5">
          <FeedbackState title="You don’t have access to this page." />
        </View>
      ) : (
        <FlatList
          className="flex-1"
          contentContainerClassName="mx-auto w-full max-w-3xl gap-3 p-4 md:p-6"
          data={items}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View className="gap-1 pb-2">
              <Text variant="h2">Reports</Text>
              <Text variant="muted">
                Review submissions. Marking a report reviewed only updates its
                status; it does not remove the reported content or account.
              </Text>
              {reports.isLoading ? <ReportsSkeleton /> : null}
              {reports.isError ? (
                <FeedbackState
                  actionLabel="Retry"
                  onAction={() => void reports.refetch()}
                  title="Couldn’t load reports."
                  variant="error"
                />
              ) : null}
            </View>
          }
          ListEmptyComponent={
            reports.isLoading || reports.isError ? undefined : (
              <FeedbackState title="No reports yet." />
            )
          }
          renderItem={({ item }) => (
            <ReportCard
              report={item}
              isUpdating={markReviewed.isPending}
              reviewError={
                markReviewed.isError && markReviewed.variables === item.id
                  ? API_ERROR_MESSAGES.REVIEW_REPORT
                  : null
              }
              onReview={() => markReviewed.mutate(item.id)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function ReportCard({
  report,
  isUpdating,
  reviewError,
  onReview,
}: {
  report: Report;
  isUpdating: boolean;
  reviewError: string | null;
  onReview: () => void;
}) {
  const pending = report.status === "pending";
  return (
    <View className="gap-3 rounded-xl border border-border bg-card p-4">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text className="font-semibold capitalize">
          {report.target_type} · {report.reason.replaceAll("_", " ")}
        </Text>
        <Text variant="muted">{pending ? "Pending" : "Reviewed"}</Text>
      </View>
      <Text className="text-sm">{report.target_summary}</Text>
      {report.target_user_id ? (
        <Text variant="muted">Reported account: {report.target_user_id}</Text>
      ) : null}
      {report.target_path ? (
        <Link href={report.target_path as Href} asChild>
          <Button className="self-start" size="sm" variant="outline">
            <Text>Open reported item</Text>
          </Button>
        </Link>
      ) : null}
      {report.details ? (
        <Text className="text-sm leading-5">{report.details}</Text>
      ) : null}
      <Text variant="muted">
        Reported by {report.reporter_summary} · {formatDate(report.created_at)}
      </Text>
      {reviewError ? (
        <Text className="text-sm text-destructive">{reviewError}</Text>
      ) : null}
      {pending ? (
        <Button
          className="self-start"
          disabled={isUpdating}
          onPress={onReview}
          size="sm"
          variant="outline"
        >
          <Text>{isUpdating ? "Saving…" : "Mark reviewed"}</Text>
        </Button>
      ) : null}
    </View>
  );
}

function reportOrder(a: Report, b: Report) {
  if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
  return b.created_at.localeCompare(a.created_at);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function ReportsSkeleton() {
  return (
    <View className="gap-3 pt-2">
      {[0, 1].map((index) => (
        <Skeleton key={index} className="h-32 rounded-xl" />
      ))}
    </View>
  );
}
