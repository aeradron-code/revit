import type { ReactNode } from "react";

export function AuthenticatedShell({
  children,
}: {
  children: ReactNode;
  enabled: boolean;
}) {
  return children;
}
