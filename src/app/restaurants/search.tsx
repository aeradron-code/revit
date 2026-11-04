import { Redirect, useLocalSearchParams } from "expo-router";

export default function RestaurantSearchRoute() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  return (
    <Redirect href={{ pathname: "/entities/search", params: { returnTo } }} />
  );
}
