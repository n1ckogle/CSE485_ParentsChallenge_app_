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
  const [formStatuses, setFormStatuses] = useState<Record<string, any>>({});
  const [currentUid, setCurrentUid] = useState<string | null>(auth.currentUser?.uid || null);

  const context = useContext(LanguageContext);
  const isSpanish = context?.isSpanish ?? false;
  const currentLang = isSpanish ? "es" : "en";

  const headerText = translations?.[currentLang]?.formsHeaderText ?? "Forms";
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

  const fetchFirebaseStatus = async (templates: any[]) => {
    const user = auth.currentUser;
    if (!user) {
      setFormStatuses({});
      return {};
    }
    try {
      const submissionsRef = collection(db, "users", user.uid, "formSubmissions");
      const q = query(submissionsRef, where("year", "==", activeYear));
      const querySnapshot = await getDocs(q);

      const updatedStatuses: Record<string, any> = {};
      templates.forEach(t => {
        updatedStatuses[t.id] = { status: "Not Submitted" };
      });

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (updatedStatuses[data.formId]) updatedStatuses[data.formId] = data;
      });

      setFormStatuses(updatedStatuses);
      return updatedStatuses; 
    } catch (error) { return {}; }
  };

  const syncWithJotForm = async (showAlert = false, latestStatuses?: Record<string, any>, activeTemplates?: any[]) => {
    const user = auth.currentUser;
    if (!user || !user.email) return;
    
    const currentCheck = latestStatuses || formStatuses;
    const currentTemplates = activeTemplates || formTemplates;
    const userEmail = user.email.toLowerCase().trim();
    const startYear = activeYear.split("-")[0];
    const cutoffDate = new Date(`${startYear}-07-01T00:00:00`).getTime();

    try {
      let foundNewSubmission = false;

      for (const form of currentTemplates) {
        if (currentCheck[form.id]?.status === "Approved") continue;

        const formIdToFetch = form.jotformId || form.jotformID;
        if (!formIdToFetch) continue;

        const response = await fetch(`https://api.jotform.com/form/${formIdToFetch}/submissions?apiKey=${JOTFORM_API_KEY}`);
        const result = await response.json();
        const contentArray = Array.isArray(result.content) ? result.content : [];

        const matchingSubmission = contentArray.find((submission: any) => {
          const subDate = new Date(submission.created_at).getTime();
          if (subDate < cutoffDate) return false;

          const answers = Object.values(submission.answers || {});
          return answers.some((ans: any) => {
            const val = (ans.answer || ans.value || "").toString().toLowerCase().trim();
            return val === userEmail;
          });
        });

        if (matchingSubmission) {
          const existingData = currentCheck[form.id];

          if (existingData?.status === "Denied" && existingData?.jotformSubmissionId === matchingSubmission.id) {
            continue;
          }

          if (!existingData?.jotformSubmissionId || existingData.jotformSubmissionId !== matchingSubmission.id) {
            foundNewSubmission = true;
            const subDocId = `${form.id}_${activeYear}`;
            const userDoc = await getDoc(doc(db, "users", user.uid));
            
            await setDoc(doc(db, "users", user.uid, "formSubmissions", subDocId), {
              formId: form.id,
              year: activeYear,
              status: "Waiting for Approval",
              jotformSubmissionId: matchingSubmission.id,
              parentEmail: userEmail,
              parentLastName: userDoc.data()?.lastName || "Unknown",
              adminFeedback: "",
              verifiedAt: serverTimestamp()
            });
          }
        }
      }

      if (foundNewSubmission) await fetchFirebaseStatus(currentTemplates);
      if (showAlert) {
        Alert.alert(
          isSpanish ? "Sincronización Completa" : "Sync Complete", 
          isSpanish ? "Estados de formularios actualizados." : "Statuses updated."
        );
      }
    } catch (e) { console.error("Sync Error:", e); }
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (user?.uid !== currentUid) {
      setFormStatuses({});
      setCurrentUid(user?.uid || null);
    }

    const init = async () => {
      setLoading(true);
      await fetchConfig();
      const templates = await fetchTemplates(); 
      const freshStatuses = await fetchFirebaseStatus(templates);
      await syncWithJotForm(false, freshStatuses, templates);
      setLoading(false);
    };
    init();
  }, [currentUid]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConfig();
    const templates = await fetchTemplates();
    const freshStatuses = await fetchFirebaseStatus(templates);
    await syncWithJotForm(true, freshStatuses, templates);
    setRefreshing(false);
  }, [formTemplates, formStatuses]);

  const isWindowOpen = () => {
    if (!config || !config.fallStart || !config.springStart) return false;
    const now = new Date();
    const today = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const formatMD = (str: string) => {
      const parts = str?.split(/[-/]/) ?? [];
      return `${(parts[0] || "").padStart(2, '0')}-${(parts[1] || "").padStart(2, '0')}`;
    };
    return (today >= formatMD(config.fallStart) || today <= formatMD(config.fallEnd)) || 
           (today >= formatMD(config.springStart) && today <= formatMD(config.springEnd));
  };

  const getNextOpeningDate = () => {
    if (!config?.fallStart || !config?.springStart) return "soon";
    const now = new Date();
    const currentYear = now.getFullYear();
    const fallDate = new Date(`${currentYear}/${config.fallStart.replace('-', '/')}`);
    const springDate = new Date(`${currentYear}/${config.springStart.replace('-', '/')}`);
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}><Text style={styles.headerText}>{headerText}</Text></View>
      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {formTemplates.map((form) => {
          const formData = formStatuses?.[form.id];
          const status = formData?.status || "Not Submitted";
          const isOpen = form.isSeasonal ? isWindowOpen() : true;
          const showLink = (status === "Not Submitted" || status === "Denied") && isOpen;
          const currentJotformId = form.jotformId || form.jotformID;

          return (
            <View key={form.id} style={styles.formBlock}>
              <Text style={styles.formTitle}>{form.name}</Text>
              <Text style={styles.statusText}>
                {statusLabel}: <Text style={{ color: getStatusColor(status), fontWeight: "bold" }}>
                    {getTranslatedStatus(status, form.id)}
                </Text>
              </Text>

              {status === "Denied" && formData?.adminFeedback && (
                <View style={styles.feedbackBox}>
                  <Text style={styles.feedbackTitle}>
                    {isSpanish ? "Nota del Administrador:" : "Admin Note:"}
                  </Text>
                  <Text style={styles.feedbackText}>"{formData.adminFeedback}"</Text>
                </View>
              )}

              {showLink ? (
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
                    {status === "Denied" 
                      ? (isSpanish ? "Enviar Nueva Versión" : "Submit New Version") 
                      : viewFormText}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.confirmedText}>
                  {form.isSeasonal && !isOpen && status === "Not Submitted" 
                    ? (isSpanish ? `Plazo cerrado. Próximo plazo abre el ${getNextOpeningDate()}.` : `Window Closed. Next window opens ${getNextOpeningDate()}.`)
                    : status === "Approved" ? (isSpanish ? "✓ Envío procesado." : "✓ Submission processed.") 
                    : status === "Waiting for Approval" ? (isSpanish ? "Esperando verificación..." : "Awaiting verification...") : ""}
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
  header: { backgroundColor: "#6f9bb2", paddingVertical: 22, alignItems: "center" },
  headerText: { color: "#fff", fontSize: 20, fontWeight: "500" },
  content: { padding: 20 },
  formBlock: { marginBottom: 35, backgroundColor: "#fff", padding: 15, borderRadius: 10, elevation: 1 },
  formTitle: { fontSize: 18, fontWeight: "600", marginBottom: 6, color: "#333" },
  statusText: { fontSize: 16, marginBottom: 4, color: "#555" },
  viewForm: { fontSize: 16, color: "#2D9CDB", textDecorationLine: "underline", marginTop: 2, fontWeight: "600" },
  confirmedText: { fontSize: 14, color: "#888", fontStyle: "italic", marginTop: 4 },
  feedbackBox: { backgroundColor: "#FDEDEC", padding: 10, borderRadius: 6, marginTop: 8, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: "#E74C3C" },
  feedbackTitle: { fontSize: 12, fontWeight: "bold", color: "#C0392B" },
  feedbackText: { fontSize: 14, color: "#333", fontStyle: "italic" },
});