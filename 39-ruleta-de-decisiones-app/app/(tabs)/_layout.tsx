import React from "react";
import { Text } from "react-native";
import { Tabs } from "expo-router";

function TabEmoji({ symbol }: { symbol: string }) {
  return <Text style={{ fontSize: 18 }}>{symbol}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#0F172A" },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: { fontWeight: "700" },
        tabBarActiveTintColor: "#0F766E",
        tabBarInactiveTintColor: "#64748B",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Ruleta",
          tabBarLabel: "Ruleta",
          tabBarIcon: () => <TabEmoji symbol="🎡" />,
        }}
      />
      <Tabs.Screen
        name="listas"
        options={{
          title: "Mis Listas y Sync",
          tabBarLabel: "Listas",
          tabBarIcon: () => <TabEmoji symbol="📋" />,
        }}
      />
      <Tabs.Screen
        name="historial"
        options={{
          title: "Historial y Estadísticas",
          tabBarLabel: "Historial",
          tabBarIcon: () => <TabEmoji symbol="📊" />,
        }}
      />
    </Tabs>
  );
}
