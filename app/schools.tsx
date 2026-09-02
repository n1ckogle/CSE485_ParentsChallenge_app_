import { Stack } from "expo-router"; // Imported Stack here
import React, { useContext } from "react";
import {
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LanguageContext } from "../LanguageContext";
import { translations } from "../translations";

type SchoolOption = {
  title: string;
  color: string;
  url: string;
};

export default function Schools() {
  const context = useContext(LanguageContext);
  const isSpanish = context?.isSpanish ?? false;
  const currentLang = isSpanish ? "es" : "en";

  const descriptionText1 = translations?.[currentLang]?.schoolsDescriptionText1 ?? "";
  const descriptionText2 = translations?.[currentLang]?.schoolsDescriptionText2 ?? "";
  const easternCountyText = translations?.[currentLang]?.schoolsEasternCountyText ?? "Eastern El Paso County";
  const puebloCountyText = translations?.[currentLang]?.schoolsPuebloCountyText ?? "Pueblo County";
  const pikesPeakText = translations?.[currentLang]?.schoolsPikesPeakText ?? "Pikes Peak Region";
  const tellerCountyText = translations?.[currentLang]?.schoolsTellerCountyText ?? "Teller County";
  const onlineHomeschoolText = translations?.[currentLang]?.schoolsOnlineHomeschoolText ?? "Online / Homeschool";

  const OPTIONS: SchoolOption[] = [
    {
      title: easternCountyText,
      color: "#C62828",
      url: "https://parentschallenge.org/choice-options/eastern-el-paso-county/", 
    },
    {
      title: puebloCountyText,
      color: "#0B7D0B",
      url: "https://parentschallenge.org/choice-options/pueblo-county/",
    },
    {
      title: pikesPeakText,
      color: "#0B5A88",
      url: "https://parentschallenge.org/choice-options/pikes-peak-region/",
    },
    {
      title: tellerCountyText,
      color: "#D8742E",
      url: "https://parentschallenge.org/choice-options/teller-county/",
    },
    {
      title: onlineHomeschoolText,
      color: "#F4C430",
      url: "https://parentschallenge.org/choice-options/online-homeschool/",
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {/* Clears header text at the very top but keeps the back button */}
      <Stack.Screen options={{ title: "", headerShown: true }} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Removed internal headerText view so there is no repetitive text */}
        <View style={styles.descriptionBox}>
          <Text style={styles.descriptionText}>{descriptionText1}</Text>
          <Text style={styles.descriptionText}>{descriptionText2}</Text>
        </View>

        {OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.url}
            style={[styles.card, { backgroundColor: option.color }]}
            onPress={() => Linking.openURL(option.url)}
            activeOpacity={0.85}
          >
            <Text style={styles.cardText}>{option.title}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  descriptionBox: {
    borderWidth: 2,
    borderColor: "#B7C2B8",
    padding: 16,
    marginBottom: 24,
  },
  descriptionText: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 12,
    lineHeight: 20,
  },
  card: {
    height: 120,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  cardText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
});