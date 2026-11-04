import { Redirect, useLocalSearchParams } from "expo-router";

export default function RestaurantDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: "/entities/[id]", params: { id } }} />;
}
