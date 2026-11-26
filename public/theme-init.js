(() => {
  const storageKey = "revit:theme-preference";
  let savedTheme = null;

  try {
    savedTheme = window.localStorage.getItem(storageKey);
  } catch {
    // Storage may be unavailable in private browsing or locked-down contexts.
  }

  const systemPrefersDark =
    window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  const isDark =
    savedTheme === "dark" || (savedTheme !== "light" && systemPrefersDark);
  const root = document.documentElement;

  root.classList.toggle("dark", isDark);
  root.classList.toggle("light", !isDark);
})();
