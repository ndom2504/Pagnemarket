import { Tabs } from "expo-router";
import { colors } from "@/src/theme";
import { Icon } from "@/src/icon";
import { Platform } from "react-native";
import { useNotificationSummary } from "@/src/hooks/use-notification-summary";
import { formatBadgeCount } from "@/src/notifications";

export default function TabsLayout() {
  const { unreadMessages } = useNotificationSummary();
  const badge = formatBadgeCount(unreadMessages);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.divider,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Accueil",
          tabBarIcon: ({ color }) => <Icon name="home" color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: "Boutique",
          tabBarIcon: ({ color }) => <Icon name="shopping-bag" color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="models"
        options={{
          title: "Tailleurs",
          tabBarIcon: ({ color }) => <Icon name="scissors" color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarBadge: badge,
          tabBarBadgeStyle: {
            backgroundColor: colors.brandSecondary,
            color: colors.onBrandSecondary,
            fontSize: 10,
            fontWeight: "700",
          },
          tabBarIcon: ({ color }) => <Icon name="message-circle" color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color }) => <Icon name="user" color={color} size={22} />,
        }}
      />
    </Tabs>
  );
}
