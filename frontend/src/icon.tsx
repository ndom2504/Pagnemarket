import Feather from "@react-native-vector-icons/feather";
import React from "react";
import { colors } from "./theme";

type Props = {
  name: React.ComponentProps<typeof Feather>["name"];
  size?: number;
  color?: string;
};

export function Icon({ name, size = 20, color: c }: Props) {
  return <Feather name={name} size={size} color={c ?? colors.onSurface} />;
}
