import React from "react";
import { View } from "react-native";
import Svg, { Circle, G, Line, Path } from "react-native-svg";

type BrandMarkProps = {
  size?: number;
  primary?: string;
  gold?: string;
  background?: string;
};

export function BrandMark({
  size = 112,
  primary = "#FFF8E9",
  gold = "#E5B554",
  background = "rgba(255,255,255,0.08)"
}: BrandMarkProps) {
  const center = size / 2;
  const rayStart = size * 0.39;
  const rayEnd = size * 0.46;

  return (
    <View
      accessibilityLabel="Daily Vedic Astro symbol"
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: background }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={center} cy={center} r={size * 0.31} stroke={gold} strokeWidth={2} fill="none" />
        <G stroke={gold} strokeWidth={2} strokeLinecap="round">
          {Array.from({ length: 12 }).map((_, index) => {
            const angle = (index * Math.PI) / 6 - Math.PI / 2;
            return (
              <Line
                key={index}
                x1={center + Math.cos(angle) * rayStart}
                y1={center + Math.sin(angle) * rayStart}
                x2={center + Math.cos(angle) * rayEnd}
                y2={center + Math.sin(angle) * rayEnd}
              />
            );
          })}
        </G>
        <Path
          d={`M ${size * 0.31} ${size * 0.58} Q ${center} ${size * 0.74} ${size * 0.69} ${size * 0.58} Q ${center} ${size * 0.63} ${size * 0.31} ${size * 0.58} Z`}
          fill={gold}
        />
        <Path
          d={`M ${center} ${size * 0.28} C ${size * 0.43} ${size * 0.40}, ${size * 0.43} ${size * 0.50}, ${center} ${size * 0.54} C ${size * 0.57} ${size * 0.48}, ${size * 0.57} ${size * 0.39}, ${center} ${size * 0.28} Z`}
          fill={primary}
        />
        <Circle cx={center} cy={center} r={size * 0.255} stroke={primary} strokeWidth={1} opacity={0.35} />
      </Svg>
    </View>
  );
}
