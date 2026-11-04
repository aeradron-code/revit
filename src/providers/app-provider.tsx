import {
  focusManager,
  onlineManager,
  QueryClientProvider,
} from "@tanstack/react-query";
import * as Network from "expo-network";
import { type ReactNode, useEffect } from "react";
import { AppState, Platform } from "react-native";

import { queryClient } from "@/lib/query/query-client";

export function AppProvider({ children }: { children: ReactNode }) {
  useQueryLifecycle();

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function useQueryLifecycle() {
  useEffect(() => {
    let didReceiveNetworkUpdate = false;
    const appStateSubscription =
      Platform.OS === "web"
        ? undefined
        : AppState.addEventListener("change", (status) => {
            focusManager.setFocused(status === "active");
          });
    if (Platform.OS !== "web") {
      focusManager.setFocused(AppState.currentState === "active");
    }
    const networkSubscription = Network.addNetworkStateListener((state) => {
      didReceiveNetworkUpdate = true;
      onlineManager.setOnline(
        state.isConnected !== false && state.isInternetReachable !== false,
      );
    });

    void Network.getNetworkStateAsync()
      .then((state) => {
        if (didReceiveNetworkUpdate) return;
        onlineManager.setOnline(
          state.isConnected !== false && state.isInternetReachable !== false,
        );
      })
      .catch(() => {
        if (!didReceiveNetworkUpdate) onlineManager.setOnline(true);
      });

    return () => {
      appStateSubscription?.remove();
      networkSubscription.remove();
    };
  }, []);
}
