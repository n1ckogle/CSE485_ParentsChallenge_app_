import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import React, { useContext, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  Linking,
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

const { width } = Dimensions.get("window");
const CAROUSEL_WIDTH = width - 40;

export default function Index() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const router = useRouter();

  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const carouselImages = [
    require("../assets/images/carouselpic1.jpeg"),
    require("../assets/images/carouselpic2.jpeg"),
    require("../assets/images/carouselpic3.jpeg"),
    require("../assets/images/carouselpic4.jpeg"),
    require("../assets/images/carouselpic5.jpeg"),
    require("../assets/images/carouselpic6.jpeg"),
    require("../assets/images/carouselpic7.jpeg"),
    require("../assets/images/carouselpic8.jpeg"),
    require("../assets/images/carouselpic9.jpeg"),
    require("../assets/images/carouselpic10.jpeg"),
    require("../assets/images/carouselpic11.jpeg"),
  ];

  const context = useContext(LanguageContext);
  const isSpanish = context?.isSpanish ?? false;
  const currentLang = isSpanish ? "es" : "en";

  const loginTextTranslation = translations?.[currentLang]?.homeLoginText ?? "Login";
  const parentsText = translations?.[currentLang]?.homeParentsText ?? "Parents";
  const schoolsText = translations?.[currentLang]?.homeSchoolsText ?? "Schools";
  const resourcesText = translations?.[currentLang]?.homeResourcesText ?? "Resources";
  const contactText = translations?.[currentLang]?.homeContactText ?? "Contact";
  const settingsText = translations?.[currentLang]?.homeSettingsText ?? "Settings";
  const bannerText = translations?.[currentLang]?.homeBannerText ?? "";
  const aboutText = translations?.[currentLang]?.homeAboutText ?? "About";
  const boardText = translations?.[currentLang]?.homeBoardText ?? "Board";
  const eventsText = translations?.[currentLang]?.homeEventsText ?? "Events";
  const programsText = translations?.[currentLang]?.homeProgramsText ?? "Programs";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsLoggedIn(true);
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role);
        }
      } else {
        setIsLoggedIn(false);
        setUserRole(null);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const nextIndex = (activeIndex + 1) % carouselImages.length;
      setActiveIndex(nextIndex);

      scrollRef.current?.scrollTo({
        x: nextIndex * CAROUSEL_WIDTH,
        animated: true,
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [activeIndex]);

  const handleAuthAction = () => {
    if (isLoggedIn) {
      if (userRole === "admin") {
        router.push("/admin_dashboard" as any);
      } else {
        router.push("/uplanding" as any);
      }
    } else {
      router.push("/login" as any);
    }
  };

  const getDynamicAuthButtonText = () => {
    if (!isLoggedIn) return loginTextTranslation;
    if (userRole === "admin") return isSpanish ? "Admin" : "Admin";
    return isSpanish ? "Panel" : "Dashboard";
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setMenuOpen(!menuOpen)}>
            <Ionicons name="menu" size={32} color="black" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginButton} onPress={handleAuthAction}>
            <Text style={styles.loginText}>{getDynamicAuthButtonText()}</Text>
          </TouchableOpacity>
        </View>

        {menuOpen && (
          <View style={styles.menu}>
            {[
              { name: parentsText, route: "/parents" },
              { name: schoolsText, route: "/schools" },
              { name: resourcesText, route: "/resources" },
              { name: contactText, route: "/contact" },
              ...(isLoggedIn ? [{ name: settingsText, route: "/account_settings" }] : []),
            ].map((item) => (
              <TouchableOpacity
                key={item.route}
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  router.push(item.route as any);
                }}
              >
                <Text style={styles.menuText}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Image
          source={require("../assets/images/PC_Location-Logo_CO-100.jpg")}
          style={styles.topImage}
          resizeMode="contain"
        />

        <View style={styles.carouselContainer}>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(
                event.nativeEvent.contentOffset.x / CAROUSEL_WIDTH
              );
              setActiveIndex(index);
            }}
          >
            {carouselImages.map((image, index) => (
              <Image
                key={index}
                source={image}
                style={styles.carouselImage}
                resizeMode="cover"
              />
            ))}
          </ScrollView>

          <View style={styles.dotsContainer}>
            {carouselImages.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  activeIndex === index && styles.activeDot,
                ]}
              />
            ))}
          </View>
        </View>

        <LinearGradient colors={["#6696AB", "#3F6F80"]} style={styles.banner}>
          <Text style={styles.bannerText}>{bannerText}</Text>
        </LinearGradient>

        <View style={styles.buttonGrid}>
          <TouchableOpacity style={styles.button} onPress={() => router.push("/about")}>
            <Text style={styles.buttonText}>{aboutText}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => router.push("/board")}>
            <Text style={styles.buttonText}>{boardText}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={() => Linking.openURL("https://parentschallenge.org/events-activities/")}
          >
            <Text style={styles.buttonText}>{eventsText}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => router.push("/programs")}>
            <Text style={styles.buttonText}>{programsText}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    zIndex: 20,
  },
  loginButton: {
    backgroundColor: "#6696AB",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 90,
    alignItems: "center",
  },
  loginText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  menu: {
    position: "absolute",
    top: 60,
    left: 0,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 15,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 30,
  },
  menuItem: { paddingVertical: 10, paddingHorizontal: 5 },
  menuText: { fontSize: 18, color: "#333" },
  topImage: { 
    width: "70%", 
    height: 120,
    marginVertical: 10 
  },
  carouselContainer: {
    width: "100%",
    marginBottom: 20,
    alignItems: "center",
  },
  carouselImage: {
    width: CAROUSEL_WIDTH,
    height: 180,
    borderRadius: 12,
  },
  dotsContainer: {
    flexDirection: "row",
    marginTop: 10,
    justifyContent: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#c4c4c4",
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: "#6696AB",
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  banner: { 
    marginVertical: 15, 
    padding: 20, 
    width: "110%",
    alignItems: "center" 
  },
  bannerText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
  },
  buttonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 15,
    marginTop: 10,
  },
  button: {
    width: "45%", 
    backgroundColor: "#6696AB",
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});