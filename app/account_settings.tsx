import { router, Stack } from "expo-router";
import { deleteUser, updateEmail } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import React, { useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { auth, db } from "../firebaseConfig";
import { LanguageContext } from "../LanguageContext";
import { translations } from "../translations";

export default function account_settings() {
  const [newEmail, setNewEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [updating, setUpdating] = useState(false);
  const [updatingName, setUpdatingName] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bannerMessage, setBannerMessage] = useState("");

  const context = useContext(LanguageContext);
  
  const isSpanish = context?.isSpanish ?? false;
  const toggleLanguage = context?.toggleLanguage ?? (async () => {});
  const loadingLanguage = context?.loadingLanguage ?? false;

  const currentLang = isSpanish ? "es" : "en";
  const text = translations?.[currentLang] ?? {};

  // Fetch initial name values from Firestore on load
  useEffect(() => {
    const fetchUserProfile = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          if (data.firstName) setFirstName(data.firstName);
          if (data.lastName) setLastName(data.lastName);
        }
      } catch (e) {
        console.error("Error fetching user profile:", e);
      }
    };

    fetchUserProfile();
  }, []);

  // Helper function to update references in the groups collection
  const updateGroupReferences = async (oldEmail: string, cleanEmail: string) => {
    const groupsRef = collection(db, "groups");
    const batch = writeBatch(db);
    let hasUpdates = false;

    // 1. Find and update assignedParents array matches
    const parentQuery = query(groupsRef, where("assignedParents", "array-contains", oldEmail));
    const parentSnaps = await getDocs(parentQuery);

    parentSnaps.forEach((docSnap) => {
      const data = docSnap.data();
      const currentParents: string[] = data.assignedParents || [];
      const updatedParents = currentParents.map((email) =>
        email.toLowerCase() === oldEmail ? cleanEmail : email
      );

      batch.update(docSnap.ref, { 
        assignedParents: updatedParents,
        updatedAt: new Date().toISOString()
      });
      hasUpdates = true;
    });

    // 2. Find and update coordinatorEmail field matches
    const coordQuery = query(groupsRef, where("coordinatorEmail", "==", oldEmail));
    const coordSnaps = await getDocs(coordQuery);

    coordSnaps.forEach((docSnap) => {
      batch.update(docSnap.ref, { 
        coordinatorEmail: cleanEmail,
        updatedAt: new Date().toISOString()
      });
      hasUpdates = true;
    });

    if (hasUpdates) {
      await batch.commit();
    }
  };

  const handleUpdateName = async () => {
    const user = auth.currentUser;
    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();

    if (!user) {
      Alert.alert("Error", "No user logged in.");
      return;
    }

    if (!cleanFirst || !cleanLast) {
      Alert.alert(
        "Error",
        isSpanish
          ? "Por favor ingrese su nombre y apellido."
          : "Please enter both first and last name."
      );
      return;
    }

    try {
      setUpdatingName(true);
      setBannerMessage("");

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        firstName: cleanFirst,
        lastName: cleanLast,
        updatedAt: new Date().toISOString()
      });

      setBannerMessage(
        isSpanish ? "¡Nombre actualizado con éxito!" : "Name updated successfully!"
      );
    } catch (error: any) {
      console.error("Error updating name: ", error);
      Alert.alert("Error", error.message || "Failed to update name.");
    } finally {
      setUpdatingName(false);
    }
  };

  const handleUpdateEmail = async () => {
    const user = auth.currentUser;
    const oldEmail = user?.email?.toLowerCase().trim();
    const cleanEmail = newEmail.trim().toLowerCase();

    if (!user || !oldEmail) {
      Alert.alert("Error", "No user logged in.");
      return;
    }

    if (!cleanEmail) {
      Alert.alert("Error", "Please enter a valid email address.");
      return;
    }

    if (oldEmail === cleanEmail) {
      Alert.alert("Error", "New email must be different from current email.");
      return;
    }

    try {
      setUpdating(true);
      setBannerMessage("");

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      const currentRole = userSnap.exists() ? (userSnap.data().role || "family") : "family";

      // 1. Update Authentication Email
      await updateEmail(user, cleanEmail);

      // 2. Update User Document
      await updateDoc(userRef, {
        email: cleanEmail,
        updatedAt: new Date().toISOString()
      });

      // 3. Update Approved Emails collection
      const newApprovedRef = doc(db, "approvedEmails", cleanEmail);
      const oldApprovedRef = doc(db, "approvedEmails", oldEmail);

      await setDoc(newApprovedRef, { role: currentRole }, { merge: true });
      await deleteDoc(oldApprovedRef);

      // 4. Update Groups Collection References
      await updateGroupReferences(oldEmail, cleanEmail);

      setBannerMessage(isSpanish ? "¡Correo electrónico actualizado con éxito!" : "Email updated successfully!");
      setNewEmail("");
    } catch (error: any) {
      console.error("Error updating email: ", error);
      
      if (error.code === 'auth/requires-recent-login') {
        Alert.alert(
          isSpanish ? "Acción Requerida" : "Security Re-authentication Required",
          isSpanish 
            ? "Por seguridad, debe iniciar sesión de nuevo para cambiar su correo electrónico." 
            : "For your security, please log out and back in again to update your email address."
        );
      } else {
        Alert.alert("Error", error.message || "Failed to update email.");
      }
    } finally {
      setUpdating(false);
    }
  };

  // Trigger confirmation dialog for Apple guideline 5.1.1(v)
  const confirmDeleteAccount = () => {
    Alert.alert(
      isSpanish ? "Eliminar Cuenta" : "Delete Account",
      isSpanish
        ? "¿Está seguro de que desea eliminar su cuenta? Esta acción es permanente y eliminará todos sus datos."
        : "Are you sure you want to delete your account? This action is permanent and will remove all your data.",
      [
        { text: isSpanish ? "Cancelar" : "Cancel", style: "cancel" },
        {
          text: isSpanish ? "Eliminar" : "Delete",
          style: "destructive",
          onPress: processAccountDeletion,
        },
      ]
    );
  };

  const processAccountDeletion = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const userEmail = user.email?.toLowerCase().trim();
    const uid = user.uid;

    try {
      setDeleting(true);

      // 1. Delete user record from Firestore
      await deleteDoc(doc(db, "users", uid));

      // 2. Clean up approvedEmails and group mappings if applicable
      if (userEmail) {
        await deleteDoc(doc(db, "approvedEmails", userEmail));

        const groupsRef = collection(db, "groups");
        const parentQuery = query(groupsRef, where("assignedParents", "array-contains", userEmail));
        const parentSnaps = await getDocs(parentQuery);

        const batch = writeBatch(db);
        parentSnaps.forEach((docSnap) => {
          const data = docSnap.data();
          const currentParents: string[] = data.assignedParents || [];
          const updatedParents = currentParents.filter((email) => email.toLowerCase() !== userEmail);
          batch.update(docSnap.ref, {
            assignedParents: updatedParents,
            updatedAt: new Date().toISOString()
          });
        });

        await batch.commit();
      }

      // 3. Delete Firebase Auth user
      await deleteUser(user);

      Alert.alert(
        isSpanish ? "Cuenta Eliminada" : "Account Deleted",
        isSpanish ? "Su cuenta ha sido eliminada con éxito." : "Your account has been successfully deleted."
      );

      router.replace("/");
    } catch (error: any) {
      console.error("Error deleting account: ", error);

      if (error.code === "auth/requires-recent-login") {
        Alert.alert(
          isSpanish ? "Acción Requerida" : "Security Re-authentication Required",
          isSpanish
            ? "Por seguridad, debe cerrar sesión e iniciar sesión de nuevo antes de eliminar su cuenta."
            : "For your security, please log out and back in again before deleting your account."
        );
      } else {
        Alert.alert("Error", error.message || "Failed to delete account.");
      }
    } finally {
      setDeleting(false);
    }
  };

  if (loadingLanguage) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6699AB" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "" }} />

      <Text style={styles.title}>{text?.settingsTitle ?? "Account Settings"}</Text>

      {bannerMessage !== "" && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{bannerMessage}</Text>
        </View>
      )}

      {/* Language Section Container */}
      <View style={styles.section}>
        <Pressable style={styles.button} onPress={toggleLanguage}>
          <Text style={styles.buttonText}>{text?.changeLanguage ?? "Change Language"}</Text>
        </Pressable>
      </View>

      <View style={styles.separator} />

      {/* Name Management Section */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>
          {isSpanish ? "Actualizar Nombre" : "Update Name"}
        </Text>

        <TextInput
          style={styles.input}
          placeholder={isSpanish ? "Nombre" : "First Name"}
          placeholderTextColor="#888"
          value={firstName}
          onChangeText={setFirstName}
          editable={!updatingName && !deleting}
        />

        <TextInput
          style={styles.input}
          placeholder={isSpanish ? "Apellido" : "Last Name"}
          placeholderTextColor="#888"
          value={lastName}
          onChangeText={setLastName}
          editable={!updatingName && !deleting}
        />

        <Pressable
          style={[styles.button, styles.updateButton, updatingName && styles.disabledButton]}
          onPress={handleUpdateName}
          disabled={updatingName || deleting}
        >
          {updatingName ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.buttonText}>{isSpanish ? "Guardar Nombre" : "Save Name"}</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.separator} />

      {/* Email Management Layout Panel */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>
          {isSpanish ? "Actualizar Correo Electrónico" : "Update Email Address"}
        </Text>
        <Text style={styles.currentEmailText}>
          {(isSpanish ? "Actual: " : "Current: ") + (auth.currentUser?.email ?? "")}
        </Text>
        
        <TextInput 
          style={styles.input}
          placeholder={isSpanish ? "Nuevo correo electrónico" : "New email address"}
          placeholderTextColor="#888"
          value={newEmail}
          onChangeText={setNewEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!updating && !deleting}
        />

        <Pressable 
          style={[styles.button, styles.updateButton, updating && styles.disabledButton]} 
          onPress={handleUpdateEmail}
          disabled={updating || deleting}
        >
          {updating ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.buttonText}>{isSpanish ? "Guardar Correo" : "Save Email"}</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.separator} />

      {/* Danger Zone: Account Deletion */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: "#E74C3C" }]}>
          {isSpanish ? "Zona de Riesgo" : "Danger Zone"}
        </Text>

        <Pressable
          style={[styles.button, styles.deleteButton, deleting && styles.disabledButton]}
          onPress={confirmDeleteAccount}
          disabled={deleting || updating || updatingName}
        >
          {deleting ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.buttonText}>{isSpanish ? "Eliminar Cuenta" : "Delete Account"}</Text>
          )}
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
    marginBottom: 20,
  },
  section: {
    width: "100%",
    alignItems: "center",
    marginVertical: 10,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    alignSelf: "flex-start",
    paddingHorizontal: 35,
    marginBottom: 8,
  },
  currentEmailText: {
    fontSize: 13,
    color: "#666",
    alignSelf: "flex-start",
    paddingHorizontal: 35,
    marginBottom: 10,
  },
  input: {
    width: 260,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: "#000",
    marginBottom: 10,
  },
  button: {
    width: 260,
    backgroundColor: "#6699AB",
    paddingVertical: 16,
    borderRadius: 20,
    marginVertical: 5,
  },
  updateButton: {
    backgroundColor: "#2ECC71",
  },
  deleteButton: {
    backgroundColor: "#E74C3C",
  },
  disabledButton: {
    backgroundColor: "#95A5A6",
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
    marginBottom: 20,
  },
  bannerText: {
    color: "white",
    fontWeight: "600",
  },
  separator: {
    width: 260,
    height: 1,
    backgroundColor: "#eee",
    marginVertical: 15,
  }
});