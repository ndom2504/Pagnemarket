import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, Platform, View } from "react-native";
import { useAuth } from "@/src/auth";
import { Icon } from "@/src/icon";
import { useNotificationSummary } from "@/src/hooks/use-notification-summary";
import { formatBadgeCount } from "@/src/notifications";
import { colors } from "@/src/theme";

export default function TailorLayout() {
  const { user, loading } = useAuth();
  const { unreadMessages } = useNotificationSummary();
  const badge = formatBadgeCount(unreadMessages);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }
  if (!user?.roles?.includes("tailor") && !user?.roles?.includes("admin")) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: colors.divider,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "500" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Atelier",
          tabBarIcon: ({ color }) => <Icon name="home" color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="creations"
        options={{
          title: "Créations",
          tabBarIcon: ({ color }) => <Icon name="camera" color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Commandes",
          tabBarIcon: ({ color }) => <Icon name="clipboard" color={color} size={22} />,
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
        name="more"
        options={{
          title: "Menu",
          tabBarIcon: ({ color }) => <Icon name="grid" color={color} size={22} />,
        }}
      />
      <Tabs.Screen name="creation-form" options={{ href: null }} />
      <Tabs.Screen name="clients" options={{ href: null }} />
      <Tabs.Screen name="measurements" options={{ href: null }} />
      <Tabs.Screen name="calendar" options={{ href: null }} />
      <Tabs.Screen name="reviews" options={{ href: null }} />
      <Tabs.Screen name="revenue" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
