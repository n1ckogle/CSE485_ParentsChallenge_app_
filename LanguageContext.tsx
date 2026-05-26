import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import React, { createContext, useEffect, useState } from "react";
import { auth, db } from "./firebaseConfig";

interface LanguageContextType {
  isSpanish: boolean;
  toggleLanguage: () => Promise<void>;
  loadingLanguage: boolean;
}

export const LanguageContext = createContext<LanguageContextType | null>(null);

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [isSpanish, setIsSpanish] = useState<boolean>(false);
  const [loadingLanguage, setLoadingLanguage] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists() && userDocSnap.data().language === "es") {
            setIsSpanish(true);
          } else {
            setIsSpanish(false);
          }
        } catch (e) {
          console.error("Error reading language choice from DB:", e);
        }
      }
      setLoadingLanguage(false);
    });

    return unsubscribe;
  }, []);

  const toggleLanguage = async () => {
    const nextValue = !isSpanish;
    
    setIsSpanish(nextValue);

    const user = auth.currentUser;
    if (user) {
      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          await updateDoc(userDocRef, {
            language: nextValue ? "es" : "en"
          });
        } else {
          await setDoc(userDocRef, {
            language: nextValue ? "es" : "en",
            email: user.email || ""
          }, { merge: true });
        }
      } catch (e) {
        console.error("Failed to write language to remote DB:", e);
      }
    }
  };

  return (
    <LanguageContext.Provider value={{ isSpanish, toggleLanguage, loadingLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};