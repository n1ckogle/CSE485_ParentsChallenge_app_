import { Stack } from "expo-router"; // Imported Stack here
import React, { useContext, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { LanguageContext } from "../LanguageContext";
import { translations } from "../translations";

const aboutUs = () => {
  const context = useContext(LanguageContext);
  const isSpanish = context?.isSpanish ?? false;
  const currentLang = isSpanish ? "es" : "en";

  const titleText = translations?.[currentLang]?.aboutTitleText ?? "About Us";
  const whoWeAreText = translations?.[currentLang]?.aboutWhoWeAreText ?? "Who We Are";
  const missionText = translations?.[currentLang]?.aboutMissionText ?? "Our Mission";
  const makingADifference1 = translations?.[currentLang]?.aboutMakingADifference1 ?? "";

  const [backButton, setBackButton] = useState(false);

  const ourFoundingPrinciplesBullets = [
    "All children have the right to be educated.",
    "Parents know what is best for their children.",
    "Schools must be accountable to the children and their parents.",
    "Empowering parents with “choice” means a better education for all.",
    "Parents must be engaged in the education of their children.",
    "Most importantly, we are committed to making these beliefs real and available to families in Colorado Springs and, ultimately, across the country.",
  ];

  return (
    <SafeAreaProvider>
      {/* This configuration removes the file/folder name from the header but keeps the back button */}
      <Stack.Screen options={{ title: "" }} />

      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.titleContainer}>
            <Text style={styles.titleText}>{titleText}</Text>
          </View>

          <View style={styles.bodyContainer}>
            <Text style={styles.makingADifference1}>{makingADifference1}</Text>
          </View>

          <View style={styles.titleContainer}>
            <Text style={styles.whoWeAre}>{whoWeAreText}</Text>
          </View>

          <View style={styles.bodyContainer}>
            <Text style={styles.makingADifference1}>{missionText}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 40,
    paddingHorizontal: 20,
    backgroundColor: "#ffffff",
  },
  scrollContainer: {
    paddingBottom: 40,
  },
  titleContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
  },
  titleText: {
    fontSize: 32,
    fontWeight: "bold",
  },
  bodyContainer: {
    backgroundColor: "#6596ab",
    borderRadius: 5,
    alignSelf: "stretch",
    padding: 20,
    marginBottom: 12,
  },
  makingADifference1: {
    fontSize: 16,
    color: "#ffffff",
    textAlign: "left",
  },
  whoWeAre: {
    fontSize: 25,
    fontWeight: "bold",
  },
});

export default aboutUs;