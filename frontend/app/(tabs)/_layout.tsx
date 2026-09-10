import { Tabs } from "expo-router";
import { colors } from "@/src/theme";
import { Icon } from "@/src/icon";
import { Platform } from "react-native";

export default function TabsLayout() {
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
          title: "Modèles",
          tabBarIcon: ({ color }) => <Icon name="scissors" color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
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
