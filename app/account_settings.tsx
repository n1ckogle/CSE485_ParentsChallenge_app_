import React, { useContext } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LanguageContext } from "../LanguageContext";
import { translations } from "../translations";

export default function account_settings() {
  const [bannerMessage, setBannerMessage] = React.useState("");

  const context = useContext(LanguageContext);
  
  const isSpanish = context?.isSpanish ?? false;
  const toggleLanguage = context?.toggleLanguage ?? (async () => {});
  const loadingLanguage = context?.loadingLanguage ?? false;

  const currentLang = isSpanish ? "es" : "en";
  
  const text = translations?.[currentLang] ?? {};

  if (loadingLanguage) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6699AB" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{text?.settingsTitle ?? "Account Settings"}</Text>

      {bannerMessage !== "" && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{bannerMessage}</Text>
        </View>
      )}

      <View>
        <Pressable style={styles.button} onPress={toggleLanguage}>
          <Text style={styles.buttonText}>{text?.changeLanguage ?? "Change Language"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 12,
  },
  button: {
    width: 260,
    backgroundColor: "#6699AB",
    paddingVertical: 16,
    borderRadius: 20,
    marginVertical: 10,
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  banner: {
    backgroundColor: "green",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  bannerText: {
    color: "white",
    fontWeight: "600",
  },
});