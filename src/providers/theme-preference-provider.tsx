import * as SecureStore from "expo-secure-store";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Platform } from "react-native";
import { Uniwind } from "uniwind";

type ThemePreference = "light" | "dark";
type ThemePreferenceContextValue = {
  preference: ThemePreference | null;
  setPreference: (preference: ThemePreference) => void;
};

const STORAGE_KEY = "revit:theme-preference";
const ThemePreferenceContext =
  createContext<ThemePreferenceContextValue | null>(null);

async function readPreference(): Promise<ThemePreference | null> {
  try {
    const value =
      Platform.OS === "web"
        ? (globalThis.localStorage?.getItem(STORAGE_KEY) ?? null)
        : await SecureStore.getItemAsync(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

async function writePreference(value: ThemePreference) {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(STORAGE_KEY, value);
    return;
  }
  await SecureStore.setItemAsync(STORAGE_KEY, value);
}

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference | null>(
    null,
  );

  useEffect(() => {
    let mounted = true;
    void readPreference().then((savedPreference) => {
      if (!mounted) return;
      setPreferenceState(savedPreference);
      if (savedPreference) Uniwind.setTheme(savedPreference);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const setPreference = useCallback((value: ThemePreference) => {
    setPreferenceState(value);
    Uniwind.setTheme(value);
    void writePreference(value).catch(() => undefined);
  }, []);

  return (
    <ThemePreferenceContext.Provider value={{ preference, setPreference }}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  const value = useContext(ThemePreferenceContext);
  if (!value)
    throw new Error(
      "useThemePreference must be used within ThemePreferenceProvider",
    );
  return value;
}
