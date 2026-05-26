import { Ionicons } from "@expo/vector-icons";
import React, { useContext } from "react";
import {
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LanguageContext } from "../LanguageContext";
import { translations } from "../translations";

export default function Contact() {
  const context = useContext(LanguageContext);
  const isSpanish = context?.isSpanish ?? false;

  const contactTitle = translations?.[isSpanish ? "es" : "en"]?.contactTitle ?? "Contact Us";

  const socialLinks = [
    {
      name: "logo-facebook",
      appUrl: "fb://page/ParentsChallenge",
      webUrl: "https://facebook.com/ParentsChallenge",
    },
    {
      name: "globe-outline",
      appUrl: "https://parentschallenge.org/contact/",
      webUrl: "https://parentschallenge.org/contact/",
    },
    {
      name: "logo-twitter",
      appUrl: "twitter://user?screen_name=ParentsChallnge",
      webUrl: "https://x.com/ParentsChallnge",
    },
    {
      name: "logo-instagram",
      appUrl: "instagram://user?username=parentschallenge",
      webUrl: "https://instagram.com/parentschallenge",
    },
    {
      name: "logo-linkedin",
      appUrl: "linkedin://in/deborah-hendrix-3595899",
      webUrl: "https://linkedin.com/in/deborah-hendrix-3595899",
    },
    {
      name: "logo-youtube",
      appUrl: "vnd.youtube://channel/UCQ-QKYDWD2Ld0I5YZdgOQ9A",
      webUrl: "https://youtube.com/channel/UCQ-QKYDWD2Ld0I5YZdgOQ9A",
    },
  ] as const;

  const openLink = async (appUrl: string, webUrl: string) => {
    const canOpen = await Linking.canOpenURL(appUrl);
    if (canOpen) {
      Linking.openURL(appUrl);
    } else {
      Linking.openURL(webUrl);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{contactTitle}</Text>

      <View style={styles.iconRow}>
        {socialLinks.map((link) => (
          <TouchableOpacity
            key={link.webUrl}
            onPress={() => openLink(link.appUrl, link.webUrl)}
            style={styles.iconButton}
          >
            <Ionicons name={link.name} size={40} color="#364057" />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 30,
    color: "#364057",
  },
  iconRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 20,
  },
  iconButton: {
    padding: 10,
  },
});