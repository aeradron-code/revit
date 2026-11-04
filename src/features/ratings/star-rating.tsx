import { Star, StarHalf } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Animated, Platform, View, type ViewStyle } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useTheme } from "@/hooks/use-theme";

type StarRatingProps = {
  value: number | null;
  onChange?: (score: number) => void;
  disabled?: boolean;
  readOnly?: boolean;
  allowHalf?: boolean;
  animated?: boolean;
  starSize?: number;
  gap?: number;
  marginHorizontal?: ViewStyle["marginHorizontal"];
  marginVertical?: ViewStyle["marginVertical"];
  paddingHorizontal?: ViewStyle["paddingHorizontal"];
  paddingVertical?: ViewStyle["paddingVertical"];
  accessibilityLabel?: string;
};

const SCORES = [1, 2, 3, 4, 5] as const;

export function StarRating({
  value,
  onChange,
  disabled = false,
  readOnly = false,
  allowHalf = false,
  animated = true,
  starSize = 20,
  gap = 8,
  marginHorizontal = 0,
  marginVertical = 0,
  paddingHorizontal = 0,
  paddingVertical = 0,
  accessibilityLabel,
}: StarRatingProps) {
  const theme = useTheme();
  const [hoveredScore, setHoveredScore] = useState<number | null>(null);
  const activeCount =
    value === null ? 0 : Math.max(0, Math.min(5, Math.round(value)));
  const displayValue =
    allowHalf && value !== null ? Math.max(0, Math.min(5, value)) : activeCount;
  const displayedCount = hoveredScore ?? activeCount;
  const shouldAnimate = animated && !readOnly;
  const animationValues = useRef(
    SCORES.map((score) => new Animated.Value(score <= activeCount ? 1 : 0)),
  ).current;
  const previousCount = useRef(displayedCount);
  const hoverResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const previous = previousCount.current;
    previousCount.current = displayedCount;

    if (!shouldAnimate) {
      animationValues.forEach((animation, index) => {
        animation.stopAnimation();
        animation.setValue(index < displayedCount ? 1 : 0);
      });
      return;
    }

    const fillingAnimations = animationValues
      .slice(previous, displayedCount)
      .map((animation) => {
        animation.stopAnimation();
        animation.setValue(0);
        return Animated.sequence([
          Animated.spring(animation, {
            toValue: 1.12,
            speed: 28,
            bounciness: 4,
            useNativeDriver: true,
          }),
          Animated.spring(animation, {
            toValue: 1,
            speed: 24,
            bounciness: 2,
            useNativeDriver: true,
          }),
        ]);
      });

    animationValues.slice(displayedCount, previous).forEach((animation) => {
      animation.stopAnimation();
      Animated.timing(animation, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }).start();
    });

    if (fillingAnimations.length)
      Animated.stagger(45, fillingAnimations).start();
  }, [animationValues, displayedCount, shouldAnimate]);

  useEffect(
    () => () => {
      if (hoverResetTimer.current) clearTimeout(hoverResetTimer.current);
    },
    [],
  );

  const isEditable = !readOnly && Boolean(onChange);
  const selectedLabel =
    accessibilityLabel ??
    (value === null
      ? "Not rated"
      : `${Number.isInteger(value) ? value : value.toFixed(1)} out of 5 stars`);
  const accessibilityStep = allowHalf ? 0.5 : 1;

  const onAccessibilityAction = ({
    nativeEvent,
  }: {
    nativeEvent: { actionName: string };
  }) => {
    if (!isEditable || disabled || !onChange) return;
    const currentValue = value ?? 0;
    if (nativeEvent.actionName === "increment") {
      onChange(
        currentValue === 0
          ? accessibilityStep
          : Math.min(5, currentValue + accessibilityStep),
      );
    } else if (nativeEvent.actionName === "decrement" && currentValue > 0) {
      onChange(Math.max(accessibilityStep, currentValue - accessibilityStep));
    }
  };

  return (
    <View
      accessibilityLabel={selectedLabel}
      accessible
      accessibilityRole={isEditable ? "adjustable" : "text"}
      accessibilityValue={{
        min: 0,
        max: 5,
        now: value ?? 0,
        text: selectedLabel,
      }}
      accessibilityActions={
        isEditable ? [{ name: "increment" }, { name: "decrement" }] : undefined
      }
      accessibilityState={isEditable ? { disabled } : undefined}
      onAccessibilityAction={isEditable ? onAccessibilityAction : undefined}
      className="flex-row items-center"
      style={{
        gap,
        marginHorizontal,
        marginVertical,
        paddingHorizontal,
        paddingVertical,
      }}
    >
      {SCORES.map((score, index) => {
        const isFull = score <= displayValue;
        const isHalf = allowHalf && !isFull && displayValue >= score - 0.5;
        const fillProgress = animationValues[index];
        const scale = shouldAnimate
          ? fillProgress.interpolate({
              inputRange: [0, 1, 1.12],
              outputRange: [0.92, 1, 1.12],
              extrapolate: "clamp",
            })
          : 1;
        const star = (
          <View className="items-center justify-center">
            <Icon
              as={Star}
              className="text-rating"
              size={starSize}
              stroke={theme.rating}
              strokeWidth={1.8}
              fill="none"
            />
            <Animated.View
              pointerEvents="none"
              className="absolute"
              style={{
                transform: [{ scale }],
                opacity: shouldAnimate
                  ? fillProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 1],
                      extrapolate: "clamp",
                    })
                  : isFull || isHalf
                    ? 1
                    : 0,
              }}
            >
              <Icon
                as={isHalf ? StarHalf : Star}
                className="text-rating"
                size={starSize}
                fill={theme.rating}
                stroke={theme.rating}
                strokeWidth={1.8}
              />
            </Animated.View>
          </View>
        );

        if (readOnly || !onChange) return <View key={score}>{star}</View>;

        return (
          <Button
            key={score}
            accessibilityLabel={`Rate ${score} out of 5 stars`}
            accessibilityState={{ selected: value === score }}
            className="-m-2 p-2"
            disabled={disabled}
            size="icon"
            onPress={() => onChange(score)}
            onHoverIn={() => {
              if (hoverResetTimer.current)
                clearTimeout(hoverResetTimer.current);
              setHoveredScore(score);
            }}
            onHoverOut={() => {
              hoverResetTimer.current = setTimeout(() => {
                hoverResetTimer.current = null;
                setHoveredScore(null);
              }, 60);
            }}
            {...(Platform.OS === "web" ? {} : { hitSlop: 12 })}
            variant="link"
          >
            {star}
          </Button>
        );
      })}
    </View>
  );
}
