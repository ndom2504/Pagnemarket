import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/src/icon";
import { useNotificationSummary } from "@/src/hooks/use-notification-summary";
import { formatBadgeCount } from "@/src/notifications";
import { colors } from "@/src/theme";

type Props = {
  /** Light icon for dark hero backgrounds */
  light?: boolean;
  testID?: string;
};

export function NotificationBell({ light, testID = "notification-bell" }: Props) {
  const router = useRouter();
  const { unreadNotifications } = useNotificationSummary();
  const badge = formatBadgeCount(unreadNotifications);
  const iconColor = light ? colors.onSurfaceInverse : colors.onSurface;
  const btnBg = light ? "rgba(255,255,255,0.15)" : colors.surfaceTertiary;

  return (
    <Pressable
      testID={testID}
      accessibilityLabel="Notifications"
      onPress={() => router.push("/notifications" as any)}
      style={[styles.btn, { backgroundColor: btnBg }]}
    >
      <Icon name="bell" size={20} color={iconColor} />
      {badge ? (
        <View style={styles.badge} testID={`${testID}-badge`}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 999,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: colors.onBrandSecondary,
    fontSize: 9,
    fontWeight: "700",
  },
});
