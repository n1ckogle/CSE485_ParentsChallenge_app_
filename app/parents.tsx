import { Stack, useRouter } from "expo-router"; // Imported Stack here
import { doc, getDoc } from "firebase/firestore";
import React, { useContext, useEffect, useState } from "react";
import {
  Alert,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { db } from "../firebaseConfig";
import { LanguageContext } from "../LanguageContext";
import { translations } from "../translations";

export default function Parents() {
  const router = useRouter();
  const [empowermentLink, setEmpowermentLink] = useState<string | null>(null);

  const context = useContext(LanguageContext);
  const isSpanish = context?.isSpanish ?? false;
  const currentLang = isSpanish ? "es" : "en";

  const empowermentSessionsText = translations?.[currentLang]?.parentsEmpowermentSessionsText ?? "Empowerment Sessions";
  const videosText = translations?.[currentLang]?.parentsVideosText ?? "Videos";

  useEffect(() => {
    const fetchLink = async () => {
      try {
        const docRef = doc(db, "settings", "canvaLink");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          // Updated to target the correct string field requested
          setEmpowermentLink(docSnap.data().empowermentSessionsSnapshot);
        }
      } catch (error) {
        console.error("Error fetching empowerment sessions link:", error);
      }
    };
    fetchLink();
  }, []);

  const handleEmpowermentPress = () => {
    if (empowermentLink) {
      Linking.openURL(empowermentLink);
    } else {
      Alert.alert(
        isSpanish ? "Cargando" : "Loading", 
        isSpanish 
          ? "Todavía se está obteniendo el enlace de las sesiones. Por favor, inténtelo de nuevo en un segundo." 
          : "Still fetching the session link. Please try again in a second."
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Configuration to remove top header text while preserving the native back button */}
      <Stack.Screen options={{ title: "", headerShown: true }} />

      {/* Empowerment Sessions Button (Dynamic Link) */}
      <TouchableOpacity
        style={styles.button}
        onPress={handleEmpowermentPress}
      >
        <Text style={styles.buttonText}>{empowermentSessionsText}</Text>
      </TouchableOpacity>

      {/* Videos Button */}
      <TouchableOpacity
        style={styles.button}
        onPress={() =>
          Linking.openURL(
            "https://www.youtube.com/channel/UCQ-QKYDWD2Ld0I5YZdgOQ9A/videos",
          )
        }
      >
        <Text style={styles.buttonText}>{videosText}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    paddingHorizontal: 20,
  },
  button: {
    width: "80%",
    backgroundColor: "#6699AB",
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
    marginVertical: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});