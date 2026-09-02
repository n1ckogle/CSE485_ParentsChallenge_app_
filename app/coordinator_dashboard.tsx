import { router, Stack } from "expo-router";
import {
  collection,
  collectionGroup,
  getDocs,
  query,
  where
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { auth, db } from "../firebaseConfig";

const getSchoolYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  return now.getMonth() >= 6 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

const getBaseFormId = (formId: string | undefined): string => {
  if (!formId) return "";
  return formId
    .replace(/_(?:\d{4})(?:[-_/]\d{4})?$/, "")
    .trim()
    .toLowerCase();
};

export default function CoordinatorDashboard() {
  const [groupedSubmissions, setGroupedSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [groupIdDisplay, setGroupIdDisplay] = useState<string>("Loading Group...");

  const activeYear = getSchoolYear();

  const fetchCoordinatorSubmissions = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user || !user.email) return;

      const groupsRef = collection(db, "groups");
      const groupQuery = query(groupsRef, where("coordinatorEmail", "==", user.email.toLowerCase().trim()));
      const groupSnap = await getDocs(groupQuery);

      if (groupSnap.empty) {
        setGroupedSubmissions([]);
        setGroupIdDisplay("No Group Assigned");
        return;
      }

      let assignedEmails: string[] = [];
      groupSnap.docs.forEach(gDoc => {
        const gData = gDoc.data();
        if (gData.assignedParents && Array.isArray(gData.assignedParents)) {
          assignedEmails = [...assignedEmails, ...gData.assignedParents];
        }
      });

      setGroupIdDisplay(`Group ID: ${groupSnap.docs[0].id}`);

      if (assignedEmails.length === 0) {
        setGroupedSubmissions([]);
        return;
      }

      const formsSnapshot = await getDocs(collection(db, "forms"));
      const dynamicTemplates = formsSnapshot.docs.map(d => ({ 
        id: d.id, 
        ...d.data() 
      })) as any[];

      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "in", assignedEmails));
      const userSnap = await getDocs(q);

      const groupsObj: Record<string, any> = {};

      userSnap.docs.forEach(uDoc => {
        const uData = uDoc.data();
        const userEmail = uData.email ? uData.email.toLowerCase().trim() : "";
        if (!userEmail) return;

        groupsObj[userEmail] = {
          email: userEmail,
          userId: uDoc.id,
          lastName: uData.lastName ?? "Unknown",
          submissions: []
        };
      });

      const submissionsQuery = query(collectionGroup(db, "formSubmissions"));
      const querySnapshot = await getDocs(submissionsQuery);
      
      const realSubmissions = querySnapshot.docs
        .map(doc => ({ 
          id: doc.id, 
          fullPath: doc.ref.path, 
          ...doc.data() 
        }))
        .filter((sub: any) => sub.year === activeYear) as any[];

      realSubmissions.forEach((sub) => {
        const email = sub.parentEmail?.trim().toLowerCase();
        if (email && groupsObj[email]) {
          groupsObj[email].submissions.push(sub);
        }
      });

      const allUsers = Object.values(groupsObj).map((parent: any) => {
        const structuralSubs = dynamicTemplates.map((form: any) => {
          const formDocId = form.id?.toLowerCase().trim();
          const formName = form.name?.toLowerCase().trim();
          const jotformId = form.jotformId?.toString().toLowerCase().trim();

          const match = parent.submissions.find((s: any) => {
            const savedBaseId = getBaseFormId(s.formId);
            return (
              savedBaseId === formDocId ||
              savedBaseId === formName ||
              savedBaseId === jotformId
            );
          });

          if (match) {
            return {
              ...match,
              displayName: form.name || form.id || "Untitled Form"
            };
          }

          return {
            id: `placeholder-${form.id}`,
            formId: form.id || "unknown",
            displayName: form.name || form.id || "Untitled Form",
            status: "Not Submitted",
            parentEmail: parent.email,
            parentLastName: parent.lastName,
            jotformSubmissionId: "",
            adminFeedback: ""
          };
        });

        return { ...parent, submissions: structuralSubs };
      });

      const sortedGroups = allUsers.sort((a, b) => 
        (a.lastName || "").localeCompare(b.lastName || "")
      );
      setGroupedSubmissions(sortedGroups);
    } catch (error) {
      console.error("Fetch Error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchCoordinatorSubmissions(); }, []);

  const renderHeader = () => (
    <View>
      <View style={styles.rosterSection}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Group Roster</Text>
            <Text style={styles.groupSubLabel}>{groupIdDisplay}</Text>
          </View>
        </View>

        <View style={styles.rosterContainer}>
          {groupedSubmissions.map((parent) => (
            <View key={parent.email || Math.random().toString()} style={styles.rosterRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rosterName}>
                  {(parent.lastName || "UNKNOWN").toUpperCase()}
                </Text>
                <Text style={styles.rosterEmail}>{parent.email || "No Email"}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.listHeaderContainer}>
        <Text style={styles.listHeaderText}>SUBMISSION TRACKING ({activeYear})</Text>
        <View style={styles.listHeaderLine} />
      </View>
    </View>
  );

  const renderSubmission = (sub: any) => {
    const isIncomeForm = 
      sub.formId?.toLowerCase().includes("income") || 
      sub.displayName?.toLowerCase().includes("income");
    const isNotSubmitted = sub.status === "Not Submitted";
    
    // Defensive String Conversion
    const titleText = (sub.displayName || sub.formId || "UNTITLED FORM").toUpperCase();

    return (
      <View key={sub.id || Math.random().toString()} style={[styles.subItem, isNotSubmitted && styles.subItemUnsubmitted]}>
        <View style={styles.subRow}>
          <Text style={[styles.subTitle, isNotSubmitted && styles.subTitleUnsubmitted]}>
            {titleText}
          </Text>
          <Text 
            style={[
              styles.subStatus, 
              { 
                color: sub.status === "Approved" 
                  ? "#2ECC71" 
                  : sub.status === "Denied" 
                  ? "#E74C3C" 
                  : isNotSubmitted 
                  ? "#7F8C8D" 
                  : "#E69A2F" 
              }
            ]}
          >
            {sub.status || "Unknown"}
          </Text>
        </View>
        {sub.adminFeedback ? <Text style={styles.existingFeedback}>Note: {sub.adminFeedback}</Text> : null}
        
        <View style={styles.subActions}>
          {isNotSubmitted ? (
            <View style={[styles.smallBtn, { backgroundColor: "#BDC3C7" }]}>
              <Text style={styles.btnText}>No Submission</Text>
            </View>
          ) : isIncomeForm ? (
            <View style={styles.privacyBadge}>
              <Text style={styles.privacyText}>Restricted (Admin Only)</Text>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.smallBtn} 
              onPress={() => {
                if (sub.jotformSubmissionId) {
                  Linking.openURL(`https://www.jotform.com/submission/${sub.jotformSubmissionId}`);
                }
              }}
            >
              <Text style={styles.btnText}>View Data</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderGroup = ({ item }: { item: any }) => {
    const isExpanded = expandedUser === item.email;
    const pendingCount = item.submissions?.filter((s: any) => s.status === "Waiting for Approval").length ?? 0;
    const displayName = (item.lastName || "UNKNOWN").toUpperCase();

    return (
      <View style={styles.userCard}>
        <TouchableOpacity style={styles.userHeader} onPress={() => setExpandedUser(isExpanded ? null : item.email)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.userEmail}>{item.email || "No Email"}</Text>
          </View>
          {pendingCount > 0 && (
            <View style={styles.alertBadge}><Text style={styles.alertText}>{pendingCount} PENDING</Text></View>
          )}
        </TouchableOpacity>
        {isExpanded && (
          <View style={styles.expandedContent}>
            {item.submissions && item.submissions.length > 0 ? (
                item.submissions.map((sub: any) => renderSubmission(sub))
            ) : (
                <Text style={styles.noSubText}>No forms configured in the database.</Text>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "", headerShown: true }} />

      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Coordinator</Text>
          <Text style={styles.subtitle}>{groupedSubmissions.length} assigned families</Text>
        </View>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color="#6f9bb2" style={{ marginTop: 50 }} />
      ) : (
        <FlatList 
          data={groupedSubmissions}
          renderItem={renderGroup}
          ListHeaderComponent={renderHeader}
          keyExtractor={(item) => item.email || Math.random().toString()}
          ListEmptyComponent={<Text style={styles.emptyText}>No parents assigned to your group configuration.</Text>}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchCoordinatorSubmissions} />}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f7f6", padding: 15 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 40, marginBottom: 15 },
  title: { fontSize: 24, fontWeight: "bold", color: "#333" },
  subtitle: { fontSize: 14, color: "#666" },
  backBtn: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8, backgroundColor: "#6f9bb2" },
  backBtnText: { color: "#fff", fontWeight: "bold" },
  
  rosterSection: { backgroundColor: '#fff', padding: 15, borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 16, fontWeight: "bold", color: "#2c3e50" },
  groupSubLabel: { fontSize: 12, color: "#7f8c8d", marginTop: 2, fontWeight: "600" },
  rosterContainer: { marginTop: 5 },
  rosterRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f9f9f9' },
  rosterName: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  rosterEmail: { fontSize: 12, color: '#7f8c8d' },

  listHeaderContainer: { marginTop: 35, marginBottom: 15, paddingHorizontal: 5, flexDirection: 'row', alignItems: 'center' },
  listHeaderText: { fontSize: 12, fontWeight: "800", color: "#8e8e93", letterSpacing: 1.2 },
  listHeaderLine: { flex: 1, height: 1, backgroundColor: "#dcdcdc", marginLeft: 15 },

  userCard: { backgroundColor: "#fff", borderRadius: 10, marginBottom: 10, elevation: 2 },
  userHeader: { padding: 15, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  userName: { fontSize: 18, fontWeight: "bold", color: "#2c3e50" },
  userEmail: { fontSize: 13, color: "#7f8c8d" },
  alertBadge: { backgroundColor: "#E69A2F", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5 },
  alertText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  expandedContent: { backgroundColor: "#fafafa", padding: 12, borderTopWidth: 1, borderTopColor: "#eee" },
  
  subItem: { padding: 12, backgroundColor: "#fff", borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: "#eee" },
  subItemUnsubmitted: { backgroundColor: "#fbfbfb", borderColor: "#e6e6e6", borderStyle: "dashed" },
  subRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  subTitle: { fontWeight: "bold", color: "#34495e", fontSize: 14 },
  subTitleUnsubmitted: { color: "#7f8c8d", fontWeight: "600" },
  subStatus: { fontSize: 12, fontWeight: "800" },
  existingFeedback: { fontSize: 12, color: "#C0392B", marginBottom: 8 },
  
  subActions: { flexDirection: "row", gap: 8, marginTop: 5 },
  smallBtn: { backgroundColor: "#34495E", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
  btnText: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  privacyBadge: { backgroundColor: "#F2F2F2", alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  privacyText: { color: "#7F8C8D", fontSize: 11, fontStyle: "italic" },
  
  noSubText: { textAlign: 'center', color: '#999', fontSize: 12, fontStyle: 'italic' },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#999', fontSize: 16 }
});