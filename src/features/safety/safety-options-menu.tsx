import { Flag, MoreHorizontal } from "lucide-react-native";
import { type ElementRef, useRef, useState } from "react";
import { Modal, Pressable, useWindowDimensions, View } from "react-native";

import { type ReportReason, type ReportTargetType } from "@/api/safety";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAuthUser } from "@/providers/auth-provider";
import {
  useMyBlockStatus,
  useSetUserBlocked,
  useSubmitContentReport,
} from "@/queries/safety";

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment" },
  { value: "inappropriate", label: "Inappropriate" },
  { value: "impersonation", label: "Impersonation" },
  { value: "other", label: "Other" },
];

export function SafetyOptionsMenu({
  ownerId,
  targetId,
  targetLabel,
  reportMenuLabel,
  blockMenuLabel,
  unblockMenuLabel,
  showReportIcon = true,
  targetType,
  triggerClassName,
}: {
  ownerId?: string | null;
  targetId: string;
  targetLabel: string;
  reportMenuLabel?: string;
  blockMenuLabel?: string;
  unblockMenuLabel?: string;
  showReportIcon?: boolean;
  targetType: ReportTargetType;
  triggerClassName?: string;
}) {
  const user = useAuthUser();
  const triggerRef = useRef<ElementRef<typeof View>>(null);
  const { width, height } = useWindowDimensions();
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockConfirmationOpen, setBlockConfirmationOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("other");
  const [details, setDetails] = useState("");
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const reportMutation = useSubmitContentReport();
  const blockStatus = useMyBlockStatus(user?.id ?? "", ownerId ?? "");
  const blockMutation = useSetUserBlocked(user?.id ?? "", ownerId ?? "");

  if (!user || user.id === ownerId) return null;

  const closeMenu = () => setMenuPosition(null);
  const openReport = () => {
    closeMenu();
    setReportError(null);
    setReportOpen(true);
  };

  const submitReport = async () => {
    if (reportMutation.isPending) return;
    setReportError(null);
    try {
      await reportMutation.mutateAsync({
        details,
        reason,
        targetId,
        targetType,
      });
      setReportSubmitted(true);
      setReportOpen(false);
    } catch (error) {
      setReportError(
        error instanceof Error
          ? error.message
          : "We couldn’t submit this report. Please try again.",
      );
    }
  };

  const blockOrUnblock = async () => {
    if (!ownerId || blockMutation.isPending) return;
    if (blockStatus.data) {
      closeMenu();
      try {
        await blockMutation.mutateAsync(false);
      } catch {
        // The inline error remains visible beside the options menu.
      }
      return;
    }
    closeMenu();
    setBlockConfirmationOpen(true);
  };

  const confirmBlock = async () => {
    try {
      await blockMutation.mutateAsync(true);
      setBlockConfirmationOpen(false);
    } catch {
      // Keep the confirmation open and display the error for retry.
    }
  };

  return (
    <>
      <View ref={triggerRef} collapsable={false}>
        <Button
          accessibilityLabel="More options"
          accessibilityState={{ expanded: menuPosition !== null }}
          className={cn("size-8 rounded-full p-0", triggerClassName)}
          onPress={() =>
            triggerRef.current?.measureInWindow((x, y, w, h) =>
              setMenuPosition({
                top: Math.min(y + h + 4, height - 180),
                right: Math.max(8, width - x - w),
              }),
            )
          }
          size="icon"
          variant="ghost"
        >
          <Icon as={MoreHorizontal} className="size-4 text-muted-foreground" />
        </Button>
      </View>

      <Modal
        transparent
        visible={menuPosition !== null}
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <View className="flex-1">
          <Pressable
            accessibilityLabel="Close options menu"
            accessibilityRole="button"
            className="absolute inset-0"
            onPress={closeMenu}
          />
          {menuPosition ? (
            <View
              className="absolute w-48 rounded-lg border border-border bg-popover p-1 shadow-lg"
              style={menuPosition}
            >
              <Button
                className="w-full justify-start"
                disabled={reportSubmitted}
                onPress={openReport}
                size="sm"
                variant="ghost"
              >
                {showReportIcon ? (
                  <Icon as={Flag} className="size-4 text-foreground" />
                ) : null}
                <Text>
                  {reportSubmitted
                    ? "Reported"
                    : (reportMenuLabel ?? `Report ${targetLabel}`)}
                </Text>
              </Button>
              {ownerId ? (
                <Button
                  className="w-full justify-start"
                  disabled={
                    blockStatus.isLoading ||
                    blockStatus.isError ||
                    blockMutation.isPending
                  }
                  onPress={() => void blockOrUnblock()}
                  size="sm"
                  variant="ghost"
                >
                  <Text>
                    {blockStatus.data
                      ? (unblockMenuLabel ?? "Unblock user")
                      : (blockMenuLabel ?? "Block user")}
                  </Text>
                </Button>
              ) : null}
            </View>
          ) : null}
        </View>
      </Modal>

      {blockMutation.isError && !blockConfirmationOpen ? (
        <Text
          accessibilityLiveRegion="polite"
          className="text-xs text-destructive"
          role="alert"
        >
          Couldn’t update the block. Please try again.
        </Text>
      ) : null}
      {blockStatus.isError ? (
        <Text
          accessibilityLiveRegion="polite"
          className="text-xs text-destructive"
          role="alert"
        >
          Couldn’t load block status. Please try again.
        </Text>
      ) : null}

      {reportOpen ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!reportMutation.isPending) setReportOpen(open);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Report {targetLabel}</DialogTitle>
              <DialogDescription>
                Reports are reviewed by the Revit admin. Choose the closest
                reason and add context if it helps.
              </DialogDescription>
            </DialogHeader>
            <View className="flex-row flex-wrap gap-2">
              {REASONS.map((item) => (
                <Button
                  key={item.value}
                  accessibilityState={{ selected: reason === item.value }}
                  onPress={() => setReason(item.value)}
                  size="sm"
                  variant={reason === item.value ? "default" : "outline"}
                >
                  <Text>{item.label}</Text>
                </Button>
              ))}
            </View>
            <View className="gap-2">
              <Text variant="small">Additional details (optional)</Text>
              <Textarea
                editable={!reportMutation.isPending}
                maxLength={1000}
                onChangeText={setDetails}
                placeholder="Tell us what happened"
                value={details}
              />
            </View>
            {reportError ? (
              <Text
                accessibilityLiveRegion="polite"
                role="alert"
                className="text-sm text-destructive"
              >
                {reportError}
              </Text>
            ) : null}
            <DialogFooter>
              <Button
                disabled={reportMutation.isPending}
                onPress={() => setReportOpen(false)}
                variant="outline"
              >
                <Text>Cancel</Text>
              </Button>
              <Button
                disabled={reportMutation.isPending}
                onPress={() => void submitReport()}
              >
                <Text>
                  {reportMutation.isPending ? "Sending…" : "Submit report"}
                </Text>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {ownerId ? (
        <Dialog
          open={blockConfirmationOpen}
          onOpenChange={(open) => {
            if (!blockMutation.isPending) setBlockConfirmationOpen(open);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Block this user?</DialogTitle>
              <DialogDescription>
                You won’t see each other’s posts or comments, and neither of you
                can follow, rate, or comment on the other’s posts. You can
                unblock this account later.
              </DialogDescription>
            </DialogHeader>
            {blockMutation.isError ? (
              <Text className="text-destructive" variant="small">
                Couldn’t block this user. Please try again.
              </Text>
            ) : null}
            <DialogFooter>
              <Button
                disabled={blockMutation.isPending}
                onPress={() => setBlockConfirmationOpen(false)}
                variant="outline"
              >
                <Text>Cancel</Text>
              </Button>
              <Button
                disabled={blockMutation.isPending}
                onPress={() => void confirmBlock()}
                variant="destructive"
              >
                <Text>
                  {blockMutation.isPending ? "Blocking…" : "Block user"}
                </Text>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
