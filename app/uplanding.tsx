import { router } from "expo-router";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import React, { useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../firebaseConfig";
import { LanguageContext } from "../LanguageContext";
import { translations } from "../translations";

export default function UPLanding() {
  const [parentName, setParentName] = useState("Parent");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const context = useContext(LanguageContext);
  const isSpanish = context?.isSpanish ?? false;
  const currentLang = isSpanish ? "es" : "en";

  const helloText = translations?.[currentLang]?.upLandingHelloText ?? "Hello";
  const viewFormsText = translations?.[currentLang]?.upLandingViewFormsText ?? "View Forms";
  const eventScheduleText = translations?.[currentLang]?.upLandingEventScheduleText ?? "Event Schedule";
  const accountSettingsText = translations?.[currentLang]?.upLandingAccountSettingsText ?? "Account Settings";

  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setParentName(data.firstName || "Parent");
            setUserRole(data.role || "family");
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/");
    } catch (error) {
      Alert.alert(
        isSpanish ? "Error" : "Error", 
        isSpanish ? "No se pudo cerrar la sesión. Inténtelo de nuevo." : "Could not log out. Please try again."
      );
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#6f9bb2" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.topSpacer} />

        <View style={styles.header}>
          <Text style={styles.headerText}>{helloText}, {parentName}!</Text>
        </View>

        <View style={styles.buttonContainer}>
          
          {userRole === "admin" && (
            <TouchableOpacity
              style={[styles.cardButton, styles.adminReturnButton]}
              onPress={() => router.replace("/admin_dashboard" as any)}
            >
              <Text style={styles.adminReturnText}>
                {isSpanish ? "← Volver al Panel de Admin" : "← Return to Admin Panel"}
              </Text>
            </TouchableOpacity>
          )}

          {userRole === "coordinator" && (
            <TouchableOpacity
              style={[styles.cardButton, styles.coordinatorButton]}
              onPress={() => router.push("/coordinator_dashboard" as any)}
            >
              <Text style={[styles.cardText, styles.coordinatorText]}>
                {isSpanish ? "Portal del Coordinador" : "Coordinator Portal"}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.cardButton}
            onPress={() => router.push("/forms")}
          >
            <Text style={styles.cardText}>{viewFormsText}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cardButton}
            onPress={() => router.push("/event_schedule")}
          >
            <Text style={styles.cardText}>{eventScheduleText}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cardButton}
            onPress={() => router.push("/account_settings")}
          >
            <Text style={styles.cardText}>{accountSettingsText}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cardButton, styles.logoutButton]}
            onPress={handleLogout}
          >
            <Text style={[styles.cardText, styles.logoutText]}>
              {isSpanish ? "Cerrar Sesión" : "Log Out"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f2f2f2",
  },
  topSpacer: {
    height: 40,
  },
  header: {
    backgroundColor: "#6f9bb2",
    paddingVertical: 28,
    alignItems: "center",
    marginBottom: 40,
  },
  headerText: {
    color: "white",
    fontSize: 22,
    fontWeight: "600",
  },
  buttonContainer: {
    alignItems: "center",
    paddingBottom: 40, 
  },
  cardButton: {
    width: "85%",
    backgroundColor: "#fff",
    paddingVertical: 22,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: "#e0e0e0"
  },
  cardText: {
    fontSize: 18,
    color: "#000",
    fontWeight: "500",
  },
  adminReturnButton: {
    backgroundColor: "#2D9CDB",
    borderColor: "#1b82bd",
    marginBottom: 30,
  },
  adminReturnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  coordinatorButton: {
    backgroundColor: "#3F6F80", 
    borderColor: "#345c6a",
    marginBottom: 30,
  },
  coordinatorText: {
    color: "#fff",
    fontWeight: "700",
  },
  logoutButton: {
    backgroundColor: "#E84C3D", 
    marginTop: 20,
    borderColor: "#c0392b"
  },
  logoutText: {
    color: "#fff",
    fontWeight: "bold"
  },
});