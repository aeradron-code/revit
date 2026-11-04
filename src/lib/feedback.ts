import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export function selectionFeedback() {
  if (Platform.OS === "web") return;
  void Haptics.selectionAsync().catch(() => undefined);
}

export function successFeedback() {
  if (Platform.OS === "web") return;
  void Haptics.notificationAsync(
    Haptics.NotificationFeedbackType.Success,
  ).catch(() => undefined);
}
