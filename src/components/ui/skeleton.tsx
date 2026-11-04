import * as React from "react";
import type { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { cn } from "@/lib/utils";

const duration = 1000;

type SkeletonProps = React.ComponentPropsWithoutRef<typeof View>;

const Skeleton = React.forwardRef<React.ElementRef<typeof View>, SkeletonProps>(
  function Skeleton({ className, style: callerStyle, ...props }, ref) {
    const sv = useSharedValue(1);

    React.useEffect(() => {
      sv.value = withRepeat(withTiming(0.5, { duration }), -1, true);
    }, [sv]);

    const style = useAnimatedStyle(
      () => ({
        opacity: sv.value,
      }),
      [sv],
    );
    return (
      <Animated.View
        ref={ref}
        style={[callerStyle, style]}
        className={cn("rounded-lg bg-elevated", className)}
        {...props}
      />
    );
  },
);

Skeleton.displayName = "Skeleton";

export { Skeleton };
