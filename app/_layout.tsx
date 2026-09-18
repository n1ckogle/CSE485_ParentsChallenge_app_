import { Stack } from "expo-router";
import React from "react";
import { LanguageProvider } from "../LanguageContext";

export default function RootLayout() {
  return (
    <LanguageProvider>
      <Stack
        screenOptions={{
          headerBackTitle: "", 
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{ 
            title: "Home",
          }} 
        />
      </Stack>
    </LanguageProvider>
  );
}