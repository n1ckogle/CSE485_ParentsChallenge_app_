import { Stack } from "expo-router";
import React from "react";
import { LanguageProvider } from "../LanguageContext";

export default function RootLayout() {
  return (
    <LanguageProvider>
      <Stack>
        <Stack.Screen name="index" />
      </Stack>
    </LanguageProvider>
  );
}