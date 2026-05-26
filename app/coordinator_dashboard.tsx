import { router } from "expo-router";
import {
    arrayRemove,
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    updateDoc,
    where
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Linking,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { auth, db } from "../firebaseConfig";

export default function CoordinatorDashboard() {
  const [groupedSubmissions, setGroupedSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const fetchCoordinatorSubmissions = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user || !user.email) return;

      const coordDocRef = doc(db, "approvedEmails", user.email);
      const coordDocSnap = await getDoc(coordDocRef);
      const assignedEmails = coordDocSnap.data()?.approvedParents || [];

      if (assignedEmails.length === 0) {
        setGroupedSubmissions([]);
        return;
      }

      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "in", assignedEmails));
      const userSnap = await getDocs(q);

      const groups: Record<string, any> = {};

      userSnap.docs.forEach(uDoc => {
        const uData = uDoc.data();
        groups[uData.email] = {
          email: uData.email,
          lastName: uData.lastName || "Unknown",
          submissions: []
        };
      });

      const fetchPromises = userSnap.docs.map(async (userDoc) => {
        const subRef = collection(db, `users/${userDoc.id}/formSubmissions`);
        const subSnap = await getDocs(subRef);
        subSnap.forEach((d) => {
          groups[userDoc.data().email].submissions.push({
            id: d.id,
            ...d.data()
          });
        });
      });

      await Promise.all(fetchPromises);
      const sortedGroups = Object.values(groups).sort((a, b) => a.lastName.localeCompare(b.lastName));
      setGroupedSubmissions(sortedGroups);
    } catch (error) {
      console.error("Fetch Error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRemoveParent = (parentEmail: string, lastName: string) => {
    Alert.alert(
      "PERMANENT REMOVAL",
      `Are you sure you want to remove ${lastName.toUpperCase()} from your group?\n\nThis cannot be undone by you. You will need to contact a System Admin to add this parent back.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove Parent", 
          style: "destructive", 
          onPress: async () => {
            try {
              const user = auth.currentUser;
              if (!user?.email) return;
              const coordDocRef = doc(db, "approvedEmails", user.email);
              await updateDoc(coordDocRef, { approvedParents: arrayRemove(parentEmail) });
              fetchCoordinatorSubmissions();
            } catch (e) {
              Alert.alert("Error", "Could not remove parent.");
            }
          } 
        }
      ]
    );
  };

  useEffect(() => { fetchCoordinatorSubmissions(); }, []);

  const renderHeader = () => (
    <View>
      <View style={styles.rosterSection}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Group Roster</Text>
          <TouchableOpacity 
            style={[styles.editToggle, isEditMode && styles.editToggleActive]} 
            onPress={() => setIsEditMode(!isEditMode)}
          >
            <Text style={[styles.editToggleText, isEditMode && { color: '#fff' }]}>
              {isEditMode ? "Exit Management" : "Manage Roster"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.rosterContainer}>
          {groupedSubmissions.map((parent) => (
            <View key={parent.email} style={[styles.rosterRow, isEditMode && styles.rosterRowEdit]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rosterName}>{parent.lastName.toUpperCase()}</Text>
                <Text style={styles.rosterEmail}>{parent.email}</Text>
              </View>
              {isEditMode && (
                <TouchableOpacity 
                  style={styles.dangerBtn}
                  onPress={() => handleRemoveParent(parent.email, parent.lastName)}
                >
                  <Text style={styles.dangerBtnText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      </View>

      {/* Styled Section Header for the List */}
      <View style={styles.listHeaderContainer}>
        <Text style={styles.listHeaderText}>SUBMISSION TRACKING</Text>
        <View style={styles.listHeaderLine} />
      </View>
    </View>
  );

  const renderSubmission = (sub: any) => {
    const isIncomeForm = sub.formId?.toLowerCase().includes("income");
    return (
      <View key={sub.id} style={styles.subItem}>
        <View style={styles.subRow}>
          <Text style={styles.subTitle}>{sub.formId.toUpperCase()}</Text>
          <Text style={[styles.subStatus, { color: sub.status === "Approved" ? "#2ECC71" : "#E69A2F" }]}>
            {sub.status}
          </Text>
        </View>
        {sub.adminFeedback && <Text style={styles.existingFeedback}>Note: {sub.adminFeedback}</Text>}
        <View style={styles.subActions}>
          {isIncomeForm ? (
            <View style={styles.privacyBadge}><Text style={styles.privacyText}>Restricted (Admin Only)</Text></View>
          ) : (
            <TouchableOpacity 
              style={styles.smallBtn} 
              onPress={() => Linking.openURL(`https://www.jotform.com/submission/${sub.jotformSubmissionId}`)}
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
    const pendingCount = item.submissions.filter((s: any) => s.status === "Waiting for Approval").length;

    return (
      <View style={styles.userCard}>
        <TouchableOpacity style={styles.userHeader} onPress={() => setExpandedUser(isExpanded ? null : item.email)}>
          <View>
            <Text style={styles.userName}>{item.lastName.toUpperCase()}</Text>
            <Text style={styles.userEmail}>{item.email}</Text>
          </View>
          {pendingCount > 0 && (
            <View style={styles.alertBadge}><Text style={styles.alertText}>{pendingCount} PENDING</Text></View>
          )}
        </TouchableOpacity>
        {isExpanded && (
          <View style={styles.expandedContent}>
            {item.submissions.length > 0 ? (
                item.submissions.map((sub: any) => renderSubmission(sub))
            ) : (
                <Text style={styles.noSubText}>No activity for this school year.</Text>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
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
          keyExtractor={(item) => item.email}
          ListEmptyComponent={<Text style={styles.emptyText}>No parents assigned to your group.</Text>}
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
  
  // Roster Management Section
  rosterSection: { backgroundColor: '#fff', padding: 15, borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 16, fontWeight: "bold", color: "#2c3e50" },
  editToggle: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#ddd' },
  editToggleActive: { backgroundColor: '#34495e', borderColor: '#34495e' },
  editToggleText: { fontSize: 12, fontWeight: '700', color: '#333' },
  rosterContainer: { marginTop: 5 },
  rosterRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f9f9f9' },
  rosterRowEdit: { backgroundColor: '#fff5f5', paddingHorizontal: 8, borderRadius: 6, marginBottom: 4 },
  rosterName: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  rosterEmail: { fontSize: 12, color: '#7f8c8d' },
  dangerBtn: { backgroundColor: '#E74C3C', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  dangerBtnText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },

  // List Section Header
  listHeaderContainer: { marginTop: 35, marginBottom: 15, paddingHorizontal: 5, flexDirection: 'row', alignItems: 'center' },
  listHeaderText: { fontSize: 12, fontWeight: "800", color: "#8e8e93", letterSpacing: 1.2 },
  listHeaderLine: { flex: 1, height: 1, backgroundColor: "#dcdcdc", marginLeft: 15 },

  // List Items
  userCard: { backgroundColor: "#fff", borderRadius: 10, marginBottom: 10, elevation: 2 },
  userHeader: { padding: 15, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  userName: { fontSize: 18, fontWeight: "bold", color: "#2c3e50" },
  userEmail: { fontSize: 13, color: "#7f8c8d" },
  alertBadge: { backgroundColor: "#E69A2F", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5 },
  alertText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  expandedContent: { backgroundColor: "#fafafa", padding: 12, borderTopWidth: 1, borderTopColor: "#eee" },
  subItem: { padding: 12, backgroundColor: "#fff", borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: "#eee" },
  subRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  subTitle: { fontWeight: "bold", color: "#34495e", fontSize: 14 },
  subStatus: { fontSize: 12, fontWeight: "800" },
  existingFeedback: { fontSize: 12, color: "#C0392B", marginBottom: 8 },
  subActions: { marginTop: 5 },
  smallBtn: { backgroundColor: "#34495E", alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  btnText: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  privacyBadge: { backgroundColor: "#F2F2F2", alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  privacyText: { color: "#7F8C8D", fontSize: 11, fontStyle: "italic" },
  noSubText: { textAlign: 'center', color: '#999', fontSize: 12, fontStyle: 'italic' },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#999', fontSize: 16 }
});