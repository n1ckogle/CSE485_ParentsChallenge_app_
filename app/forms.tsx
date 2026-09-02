import { Stack } from "expo-router";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where
} from "firebase/firestore";
import React, { useCallback, useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { auth, db } from "../firebaseConfig";
import { LanguageContext } from "../LanguageContext";
import { translations } from "../translations";

const JOTFORM_API_KEY = "455badb22001ae363d03b6f3dd46e444";

const getSchoolYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  return now.getMonth() >= 6 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

export default function Forms() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [formTemplates, setFormTemplates] = useState<any[]>([]);
  // Stores lists of submissions per formId
  const [formStatuses, setFormStatuses] = useState<Record<string, any[]>>({});
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isPlatinumParent, setIsPlatinumParent] = useState<boolean>(false);

  const context = useContext(LanguageContext);
  const isSpanish = context?.isSpanish ?? false;
  const currentLang = isSpanish ? "es" : "en";

  const statusLabel = translations?.[currentLang]?.formsStatusText ?? "Status";
  const viewFormText = translations?.[currentLang]?.formsViewFormText ?? "View Form";
  const waitingApprovalText = translations?.[currentLang]?.formsWaitingApprovalText ?? "Waiting for Approval";
  const notSubmittedText = translations?.[currentLang]?.formsNotSubmittedText ?? "Not Submitted";
  const approvedText = translations?.[currentLang]?.formsApprovedText ?? "Approved";

  const activeYear = getSchoolYear();

  const getTranslatedStatus = (status: string, formId?: string) => {
    if (status === "Approved") return approvedText;
    if (status === "Waiting for Approval") return waitingApprovalText;
    if (status === "Denied") return isSpanish ? "Rechazado" : "Denied";
    
    if (formId === "choice") {
      return isSpanish 
        ? "No se ha enviado ninguna actualización de elección recientemente" 
        : "No choice update submitted recently";
    }
    return notSubmittedText;
  };

  const fetchTemplates = async () => {
    try {
      const q = collection(db, "forms");
      const snap = await getDocs(q);
      const templates = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFormTemplates(templates);
      return templates;
    } catch (e) {
      console.error("Template Fetch Error:", e);
      return [];
    }
  };

  const fetchConfig = async () => {
    try {
      const docSnap = await getDoc(doc(db, "settings", "formConfig"));
      if (docSnap.exists()) setConfig(docSnap.data());
    } catch (e) { console.error("Config Fetch Error:", e); }
  };

  const fetchFirebaseStatus = async (user: User | null, templates: any[]) => {
    if (!user) {
      setFormStatuses({});
      return {};
    }
    try {
      const submissionsRef = collection(db, "users", user.uid, "formSubmissions");
      const q = query(submissionsRef, where("year", "==", activeYear));
      const querySnapshot = await getDocs(q);

      const updatedStatuses: Record<string, any[]> = {};
      templates.forEach(t => {
        updatedStatuses[t.id] = [];
      });

      querySnapshot.forEach((doc) => {
        const rawData = doc.data();
        const data = { id: doc.id, ...rawData } as any;

        if (data.formId) {
          if (updatedStatuses[data.formId]) {
            updatedStatuses[data.formId].push(data);
          } else {
            updatedStatuses[data.formId] = [data];
          }
        }
      });

      setFormStatuses(updatedStatuses);
      return updatedStatuses; 
    } catch (error) { return {}; }
  };

  const syncWithJotForm = async (
    showAlert = false, 
    userOverride?: User | null,
    latestStatuses?: Record<string, any[]>, 
    activeTemplates?: any[],
    overrideIsPlatinum?: boolean
  ) => {
    const user = userOverride !== undefined ? userOverride : currentUser;
    if (!user || !user.email) return;
    
    const currentCheck = latestStatuses || formStatuses;
    const currentTemplates = activeTemplates || formTemplates;
    const userEmail = user.email.toLowerCase().trim();
    const startYear = activeYear.split("-")[0];
    
    const cutoffDate = new Date(`${startYear}-05-01T00:00:00`).getTime();
    const isPlatUser = overrideIsPlatinum !== undefined ? overrideIsPlatinum : isPlatinumParent;

    const matchesUserEmail = (target: any): boolean => {
      if (!target) return false;
      if (typeof target === "string" || typeof target === "number") {
        return target.toString().toLowerCase().trim() === userEmail;
      }
      if (typeof target === "object") {
        return Object.values(target).some((val) => matchesUserEmail(val));
      }
      return false;
    };

    try {
      let foundNewSubmission = false;

      const userDocSnap = await getDoc(doc(db, "users", user.uid));
      const parentLastName = userDocSnap.data()?.lastName || "Unknown";

      for (const form of currentTemplates) {
        if (form.isPlatinum && !isPlatUser) continue;

        const formIdToFetch = form.jotformId || form.jotformID;
        if (!formIdToFetch) continue;

        const response = await fetch(
          `https://api.jotform.com/form/${formIdToFetch}/submissions?apiKey=${JOTFORM_API_KEY}&limit=1000`
        );
        const result = await response.json();
        const contentArray = Array.isArray(result.content) ? result.content : [];

        contentArray.sort((a: any, b: any) => {
          const dateA = new Date(String(a.created_at || "").replace(" ", "T")).getTime();
          const dateB = new Date(String(b.created_at || "").replace(" ", "T")).getTime();
          return dateB - dateA;
        });

        const existingSubmissions = currentCheck[form.id] || [];

        // FIX: Find ALL matching submissions for this form
        const matchingSubmissions = contentArray.filter((submission: any) => {
          const formattedDateStr = String(submission.created_at || "").replace(" ", "T");
          const subDate = new Date(formattedDateStr).getTime();
          
          if (!isNaN(subDate) && subDate < cutoffDate) return false;

          const answers = Object.values(submission.answers || {});
          return answers.some((ans: any) => 
            matchesUserEmail(ans?.answer) || matchesUserEmail(ans?.value)
          );
        });

        // FIX: Process and sync every individual matching submission
        for (const matchingSubmission of matchingSubmissions) {
          const subDocId = `${form.id}_${matchingSubmission.id}`;
          const existingData = existingSubmissions.find(
            s => s.jotformSubmissionId === matchingSubmission.id || s.id === subDocId
          );

          if (existingData?.status === "Denied" && existingData?.jotformSubmissionId === matchingSubmission.id) {
            continue;
          }

          if (!existingData) {
            foundNewSubmission = true;
            
            await setDoc(doc(db, "users", user.uid, "formSubmissions", subDocId), {
              formId: form.id,
              year: activeYear,
              status: "Waiting for Approval",
              jotformSubmissionId: matchingSubmission.id,
              parentEmail: userEmail,
              parentLastName: parentLastName,
              adminFeedback: "",
              verifiedAt: serverTimestamp()
            });
          }
        }
      }

      if (foundNewSubmission) await fetchFirebaseStatus(user, currentTemplates);
      if (showAlert) {
        Alert.alert(
          isSpanish ? "Sincronización Completa" : "Sync Complete", 
          isSpanish ? "Estados de formularios actualizados." : "Statuses updated."
        );
      }
    } catch (e) { console.error("Sync Error:", e); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setLoading(true);

      await fetchConfig();

      let platStatus = false;
      if (user && user.email) {
        try {
          const approvedDoc = await getDoc(doc(db, "approvedEmails", user.email.toLowerCase().trim()));
          if (approvedDoc.exists()) {
            platStatus = !!approvedDoc.data()?.isPlatinum;
          }
        } catch (e) {
          console.error("Error checking platinum parent status:", e);
        }
      }
      setIsPlatinumParent(platStatus);

      const templates = await fetchTemplates(); 
      const freshStatuses = await fetchFirebaseStatus(user, templates);
      await syncWithJotForm(false, user, freshStatuses, templates, platStatus);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConfig();

    const user = auth.currentUser;
    let platStatus = false;
    if (user && user.email) {
      try {
        const approvedDoc = await getDoc(doc(db, "approvedEmails", user.email.toLowerCase().trim()));
        if (approvedDoc.exists()) {
          platStatus = !!approvedDoc.data()?.isPlatinum;
        }
      } catch (e) {
        console.error("Error checking platinum parent status on refresh:", e);
      }
    }
    setIsPlatinumParent(platStatus);

    const templates = await fetchTemplates();
    const freshStatuses = await fetchFirebaseStatus(user, templates);
    await syncWithJotForm(true, user, freshStatuses, templates, platStatus);
    setRefreshing(false);
  }, [formTemplates, formStatuses]);

  const isWindowOpen = () => {
    if (!config || !config.fallStart || !config.springStart) return false;
    const now = new Date();
    const today = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const checkWindow = (startStr?: string, endStr?: string) => {
      if (!startStr || !endStr) return false;
      const formatMD = (str: string) => {
        const parts = str.split(/[-/]/);
        return `${(parts[0] || "").padStart(2, '0')}-${(parts[1] || "").padStart(2, '0')}`;
      };
      const start = formatMD(startStr);
      const end = formatMD(endStr);
      
      return start > end 
        ? today >= start || today <= end 
        : today >= start && today <= end;
    };

    return checkWindow(config.fallStart, config.fallEnd) || checkWindow(config.springStart, config.springEnd);
  };

  const getNextOpeningDate = () => {
    if (!config?.fallStart || !config?.springStart) return "soon";
    const now = new Date();
    const currentYear = now.getFullYear();

    const parseDate = (mdStr: string, year: number) => {
      const parts = mdStr.split(/[-/]/);
      const m = parseInt(parts[0] || "1", 10) - 1;
      const d = parseInt(parts[1] || "1", 10);
      return new Date(year, m, d);
    };

    let fallDate = parseDate(config.fallStart, currentYear);
    let springDate = parseDate(config.springStart, currentYear);

    if (now > fallDate) fallDate.setFullYear(currentYear + 1);
    if (now > springDate) springDate.setFullYear(currentYear + 1);
    
    const rawTargetDate = fallDate < springDate ? fallDate : springDate;
    return rawTargetDate.toLocaleDateString(isSpanish ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric' });
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case "Approved": return "#2ECC71";
      case "Waiting for Approval": return "#E69A2F";
      case "Denied": return "#C0392B";
      default: return "#E84C3D";
    }
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#6f9bb2" /></View>;

  const visibleTemplates = formTemplates.filter(form => !form.isPlatinum || isPlatinumParent);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: "", headerShown: true }} />

      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {visibleTemplates.map((form) => {
          const submissions = formStatuses?.[form.id] || [];
          const isOpen = form.isSeasonal ? isWindowOpen() : true;
          const currentJotformId = form.jotformId || form.jotformID;

          return (
            <View key={form.id} style={styles.formBlock}>
              <Text style={styles.formTitle}>{form.name}</Text>

              {submissions.length === 0 ? (
                <View style={{ marginBottom: 8 }}>
                  <Text style={styles.statusText}>
                    {statusLabel}: <Text style={{ color: getStatusColor("Not Submitted"), fontWeight: "bold" }}>
                        {getTranslatedStatus("Not Submitted", form.id)}
                    </Text>
                  </Text>
                </View>
              ) : (
                submissions.map((sub, idx) => (
                  <View key={sub.id || idx} style={{ marginBottom: 10, paddingBottom: 6, borderBottomWidth: submissions.length > 1 ? 1 : 0, borderBottomColor: '#eee' }}>
                    <Text style={styles.statusText}>
                      {submissions.length > 1 ? `Submission #${idx + 1} ${statusLabel}: ` : `${statusLabel}: `}
                      <Text style={{ color: getStatusColor(sub.status || "Not Submitted"), fontWeight: "bold" }}>
                          {getTranslatedStatus(sub.status || "Not Submitted", form.id)}
                      </Text>
                    </Text>

                    {sub.status === "Denied" && sub.adminFeedback ? (
                      <View style={styles.feedbackBox}>
                        <Text style={styles.feedbackTitle}>
                          {isSpanish ? "Nota del Administrador:" : "Admin Note:"}
                        </Text>
                        <Text style={styles.feedbackText}>"{sub.adminFeedback}"</Text>
                      </View>
                    ) : null}
                  </View>
                ))
              )}

              {isOpen ? (
                <TouchableOpacity 
                  onPress={() => {
                    if (!currentJotformId) {
                      Alert.alert(
                        isSpanish ? "Error" : "Error", 
                        isSpanish ? "Falta el ID del formulario." : "Form ID is missing."
                      );
                      return;
                    }
                    Linking.openURL(`https://form.jotform.com/${currentJotformId.toString().trim()}`);
                  }}
                >
                  <Text style={styles.viewForm}>
                    {submissions.length > 0 
                      ? (isSpanish ? "+ Enviar Otra Versión" : "+ Submit Another Entry") 
                      : viewFormText}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.confirmedText}>
                  {form.isSeasonal && !isOpen && submissions.length === 0 
                    ? (isSpanish ? `Plazo cerrado. Próximo plazo abre el ${getNextOpeningDate()}.` : `Window Closed. Next window opens ${getNextOpeningDate()}.`)
                    : ""}
                </Text>
              )}
            </View>
          );
        })}
        <TouchableOpacity style={{ marginTop: 20, marginBottom: 40 }} onPress={() => syncWithJotForm(true)}>
          <Text style={[styles.viewForm, { textAlign: "center", color: "#6f9bb2", textDecorationLine: "none" }]}>
            {isSpanish ? "🔄 Actualizar Estado" : "🔄 Refresh Status"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f2f2f2" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { padding: 20 },
  formBlock: { marginBottom: 35, backgroundColor: "#fff", padding: 15, borderRadius: 10, elevation: 1 },
  formTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8, color: "#333" },
  statusText: { fontSize: 16, marginBottom: 4, color: "#555" },
  viewForm: { fontSize: 16, color: "#2D9CDB", textDecorationLine: "underline", marginTop: 4, fontWeight: "600" },
  confirmedText: { fontSize: 14, color: "#888", fontStyle: "italic", marginTop: 4 },
  feedbackBox: { backgroundColor: "#FDEDEC", padding: 10, borderRadius: 6, marginTop: 6, marginBottom: 6, borderLeftWidth: 4, borderLeftColor: "#E74C3C" },
  feedbackTitle: { fontSize: 12, fontWeight: "bold", color: "#C0392B" },
  feedbackText: { fontSize: 14, color: "#333", fontStyle: "italic" },
});