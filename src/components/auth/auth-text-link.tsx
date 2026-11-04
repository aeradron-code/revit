import { Link, type Href } from "expo-router";

import { Text } from "@/components/ui/text";

export function AuthTextLink({
  href,
  children,
}: {
  href: Href;
  children: string;
}) {
  return (
    <Link href={href} className="self-center">
      <Text className="text-center text-sm text-muted-foreground hover:text-blue-500">
        {children}
      </Text>
    </Link>
  );
}
