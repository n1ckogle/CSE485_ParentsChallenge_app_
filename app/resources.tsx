import * as Linking from "expo-linking";
import { Stack } from "expo-router"; // Imported Stack here
import React, { useContext } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LanguageContext } from "../LanguageContext";
import { translations } from "../translations";

export default function Other_Resources() {
  const context = useContext(LanguageContext);
  const isSpanish = context?.isSpanish ?? false;
  const currentLang = isSpanish ? "es" : "en";

  const tutoringText = translations?.[currentLang]?.otherResourcesTutoring ?? "Tutoring Resources";
  const sportsText = translations?.[currentLang]?.otherResourcesSports ?? "Sports Resources";
  const mentalHealthText = translations?.[currentLang]?.otherResourcesMentalHealth ?? "Mental Health Resources";
  const moreResourcesText = translations?.[currentLang]?.otherResourcesMoreResources ?? "More Resources";

  return (
    <View style={styles.container}>
      {/* Clears header text at the very top but keeps the back button */}
      <Stack.Screen options={{ title: "", headerShown: true }} />

      <Pressable
        style={styles.button}
        onPress={() =>
          Linking.openURL("https://parentschallenge.org/parents/tutoring/")
        }
      >
        <Text style={styles.buttonText}>{tutoringText}</Text>
      </Pressable>

      <Pressable
        style={styles.button}
        onPress={() =>
          Linking.openURL("https://parentschallenge.org/sports-resources/")
        }
      >
        <Text style={styles.buttonText}>{sportsText}</Text>
      </Pressable>

      <Pressable
        style={styles.button}
        onPress={() =>
          Linking.openURL(
            "https://parentschallenge.org/mental-health-resources/",
          )
        }
      >
        <Text style={styles.buttonText}>{mentalHealthText}</Text>
      </Pressable>

      <Pressable
        style={styles.button}
        onPress={() =>
          Linking.openURL("https://parentschallenge.org/parents/resources/")
        }
      >
        <Text style={styles.buttonText}>{moreResourcesText}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  button: {
    width: 260,
    backgroundColor: "#6699AB",
    paddingVertical: 16,
    borderRadius: 20,
    marginVertical: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
});