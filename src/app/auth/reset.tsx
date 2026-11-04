import { Redirect } from "expo-router";

export default function ResetRedirect() {
  return <Redirect href="/auth/forgot-password" />;
}
