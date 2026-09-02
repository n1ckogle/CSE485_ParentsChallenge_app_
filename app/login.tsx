import { router, Stack } from "expo-router"; // Imported Stack here
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import React, { useContext, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../firebaseConfig";
import { LanguageContext } from "../LanguageContext";
import { translations } from "../translations";

export default function Login() {
  const context = useContext(LanguageContext);
  const isSpanish = context?.isSpanish ?? false;

  const [isCreateAccount, setIsCreateAccount] = useState(false);
  const [showPassword, setShowPassword] = useState(false); 

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [statusMessage, setStatusMessage] = useState("");

  const titleLogin = translations?.[isSpanish ? "es" : "en"]?.loginTitleLogin ?? "Login";
  const titleCreate = translations?.[isSpanish ? "es" : "en"]?.loginTitleCreate ?? "Create Account";
  const emailPlaceholder = translations?.[isSpanish ? "es" : "en"]?.loginEmailPlaceholder ?? "Email Address";
  const passwordPlaceholder = translations?.[isSpanish ? "es" : "en"]?.loginPasswordPlaceholder ?? "Password";
  
  const createAccountButtonText = translations?.[isSpanish ? "es" : "en"]?.loginCreateAccountButton ?? "Create Account";
  const loginButtonText = translations?.[isSpanish ? "es" : "en"]?.loginButton ?? "Login";
  
  const alreadyAccountText = translations?.[isSpanish ? "es" : "en"]?.loginAlreadyAccountText ?? "Already have an account? Login";
  const needAccountText = translations?.[isSpanish ? "es" : "en"]?.loginNeedAccountText ?? "Need an account? Create one";
  const fillFieldsText = translations?.[isSpanish ? "es" : "en"]?.loginFillFieldsText ?? "Please fill out all fields.";
  
  const accountCreatedText = translations?.[isSpanish ? "es" : "en"]?.loginAccountCreatedText ?? "Account created! Please log in.";
  const emailInUseText = translations?.[isSpanish ? "es" : "en"]?.loginEmailInUseText ?? "Email already in use.";
  const weakPasswordText = translations?.[isSpanish ? "es" : "en"]?.loginWeakPasswordText ?? "Password too weak.";
  const signupFailedText = translations?.[isSpanish ? "es" : "en"]?.loginSignupFailedText ?? "Signup failed.";

  const firstNamePlaceholder = isSpanish ? "Nombre" : "First Name";
  const lastNamePlaceholder = isSpanish ? "Apellido" : "Last Name";
  const confirmPasswordPlaceholder = isSpanish ? "Confirmar contraseña" : "Confirm Password";
  const forgotPasswordLabel = isSpanish ? "¿Olvidó su contraseña?" : "Forgot Password?";
  const visibilityShowText = isSpanish ? "VER" : "SHOW";
  const visibilityHideText = isSpanish ? "OCULTAR" : "HIDE";

  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setStatusMessage(fillFieldsText);
      return;
    }

    try {
      setStatusMessage("");
      const email = loginEmail.trim().toLowerCase();
      
      const userCredential = await signInWithEmailAndPassword(auth, email, loginPassword);
      const uid = userCredential.user.uid;

      const emailRef = doc(db, "approvedEmails", email);
      const emailSnap = await getDoc(emailRef);

      if (!emailSnap.exists()) {
        setStatusMessage(isSpanish ? "Acceso denegado: Correo electrónico no aprobado." : "Access Denied: Email not approved.");
        await auth.signOut();
        return; 
      }

      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        const role = userDoc.data().role;
        router.replace(role === "admin" ? "/admin_dashboard" : "/uplanding");
      } else {
        setStatusMessage(isSpanish ? "Perfil de usuario no encontrado." : "User profile not found.");
      }
    } catch (error: any) {
      console.warn("Auth Exception Root Cause:", error?.code, error?.message);
      
      if (error?.code === "auth/invalid-credential" || error?.code === "auth/user-not-found" || error?.code === "auth/wrong-password") {
        setStatusMessage(isSpanish ? "Correo electrónico o contraseña inválidos" : "Invalid email or password");
      } else {
        setStatusMessage(error?.message || "Authentication error encountered.");
      }
    }
  };

  const handleCreateAccount = async () => {
    if (!firstName.trim() || !lastName.trim() || !signupEmail.trim() || !signupPassword.trim()) {
      setStatusMessage(fillFieldsText);
      return;
    }

    if (signupPassword !== confirmPassword) {
      setStatusMessage(isSpanish ? "Las contraseñas no coinciden." : "Passwords do not match.");
      return;
    }

    const emailLower = signupEmail.toLowerCase().trim();
    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    try {
      const approvedRef = doc(db, "approvedEmails", emailLower);
      const approvedSnap = await getDoc(approvedRef);

      if (!approvedSnap.exists()) {
        setStatusMessage(isSpanish ? "Este correo no está autorizado. Contacte a un admin." : "This email is not authorized. Contact an admin.");
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, emailLower, signupPassword);
      await setDoc(doc(db, "users", userCredential.user.uid), {
        uid: userCredential.user.uid,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: emailLower,
        role: approvedSnap.data().role || "family",
        isActive: true,
      });

      await updateProfile(userCredential.user, { displayName: fullName });
      setStatusMessage(accountCreatedText);
      setIsCreateAccount(false);
      setConfirmPassword("");
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        setStatusMessage(emailInUseText);
      } else if (error.code === 'auth/weak-password') {
        setStatusMessage(weakPasswordText);
      } else {
        setStatusMessage(signupFailedText);
      }
    }
  };

  const handleForgotPassword = async () => {
    if (!loginEmail.trim()) {
      setStatusMessage(isSpanish ? "Ingrese su correo electrónico primero." : "Enter your email first.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, loginEmail.trim());
      setStatusMessage(isSpanish ? "¡Enlace de reinicio enviado!" : "Reset link sent!");
    } catch (e) { 
      setStatusMessage(isSpanish ? "Error al enviar el correo de restablecimiento." : "Error sending reset email."); 
    }
  };

  return (
    <View style={styles.container}>
      {/* Clears header text at the very top but keeps the back button */}
      <Stack.Screen options={{ title: "", headerShown: true }} />

      <Text style={styles.title}>{isCreateAccount ? titleCreate : titleLogin}</Text>

      {statusMessage !== "" && <Text style={styles.statusText}>{statusMessage}</Text>}

      <View style={styles.formContainer}>
        {isCreateAccount ? (
          <>
            <TextInput style={styles.input} placeholder={firstNamePlaceholder} placeholderTextColor="#888" value={firstName} onChangeText={setFirstName} />
            <TextInput style={styles.input} placeholder={lastNamePlaceholder} placeholderTextColor="#888" value={lastName} onChangeText={setLastName} />
            <TextInput style={styles.input} placeholder={emailPlaceholder} placeholderTextColor="#888" value={signupEmail} onChangeText={setSignupEmail} autoCapitalize="none" keyboardType="email-address" />
            
            <View style={styles.passwordWrapper}>
              <TextInput 
                style={[styles.input, { marginBottom: 0 }]} 
                placeholder={passwordPlaceholder} 
                placeholderTextColor="#888" 
                value={signupPassword} 
                onChangeText={setSignupPassword} 
                secureTextEntry={!showPassword} 
              />
              <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
                <Text style={styles.eyeText}>{showPassword ? visibilityHideText : visibilityShowText}</Text>
              </TouchableOpacity>
            </View>

            <TextInput 
              style={[styles.input, { marginTop: 12 }]} 
              placeholder={confirmPasswordPlaceholder} 
              placeholderTextColor="#888" 
              value={confirmPassword} 
              onChangeText={setConfirmPassword} 
              secureTextEntry={!showPassword} 
            />

            <TouchableOpacity style={styles.primaryButton} onPress={handleCreateAccount}>
              <Text style={styles.primaryButtonText}>{createAccountButtonText}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput style={styles.input} placeholder={emailPlaceholder} placeholderTextColor="#888" value={loginEmail} onChangeText={setLoginEmail} autoCapitalize="none" keyboardType="email-address" />
            
            <View style={styles.passwordWrapper}>
              <TextInput 
                style={[styles.input, { marginBottom: 0 }]} 
                placeholder={passwordPlaceholder} 
                placeholderTextColor="#888" 
                value={loginPassword} 
                onChangeText={setLoginPassword} 
                secureTextEntry={!showPassword}
                autoCorrect={false} 
              />
              <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
                <Text style={styles.eyeText}>{showPassword ? visibilityHideText : visibilityShowText}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotPasswordContainer}>
              <Text style={styles.forgotPasswordText}>{forgotPasswordLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryButton} onPress={handleLogin}>
              <Text style={styles.primaryButtonText}>{loginButtonText}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => {
          setIsCreateAccount((prev) => !prev);
          setStatusMessage("");
          setShowPassword(false);
        }}
      >
        <Text style={styles.secondaryButtonText}>
          {isCreateAccount ? alreadyAccountText : needAccountText}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const BUTTON_COLOR = "#4a90e2";

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24, backgroundColor: "#fff" },
  formContainer: { width: '100%' },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 12 },
  statusText: { fontSize: 14, marginBottom: 16, color: 'red', textAlign: 'center' },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 16,
    color: "#000",
    backgroundColor: "#fff",
  },
  passwordWrapper: {
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 12,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    height: '100%',
    justifyContent: 'center',
  },
  eyeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: BUTTON_COLOR,
  },
  primaryButton: { width: "100%", backgroundColor: BUTTON_COLOR, paddingVertical: 12, borderRadius: 8, alignItems: "center", marginTop: 10 },
  primaryButtonText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  secondaryButton: { marginTop: 20 },
  secondaryButtonText: { color: BUTTON_COLOR, fontSize: 14, fontWeight: "500" },
  forgotPasswordContainer: { alignSelf: "flex-end", marginBottom: 15, marginTop: 5 },
  forgotPasswordText: { color: BUTTON_COLOR, fontSize: 14, fontWeight: "500", textDecorationLine: "underline" },
});