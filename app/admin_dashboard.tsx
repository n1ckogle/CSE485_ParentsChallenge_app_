import * as DocumentPicker from 'expo-document-picker';
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import {
  collectionGroup,
  doc,
  getDocs,
  query,
  updateDoc,
  writeBatch
} from "firebase/firestore";
import Papa from 'papaparse';
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { auth, db } from "../firebaseConfig";

export default function AdminDashboard() {
  const [groupedSubmissions, setGroupedSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const [importModalVisible, setImportModalVisible] = useState(false);
  const [pendingCsvData, setPendingCsvData] = useState<any[]>([]);
  
  const [denyModalVisible, setDenyModalVisible] = useState(false);
  const [denialReason, setDenialReason] = useState("");
  const [activeSub, setActiveSub] = useState<{path: string, email: string} | null>(null);

  useEffect(() => { 
    fetchAllSubmissions(); 
  }, []);

  const fetchAllSubmissions = async () => {
    try {
      setLoading(true);
      const submissionsQuery = query(collectionGroup(db, "formSubmissions"));
      const querySnapshot = await getDocs(submissionsQuery);
      const allData = querySnapshot.docs.map(doc => ({ 
        id: doc.id, 
        fullPath: doc.ref.path, 
        ...doc.data() 
      })) as any[];
      
      const groups: Record<string, any> = {};
      allData.forEach((sub) => {
        const email = sub.parentEmail || "unknown@test.com";
        if (!groups[email]) groups[email] = { 
            email, 
            lastName: sub.parentLastName || "Unknown", 
            submissions: [] 
        };
        groups[email].submissions.push(sub);
      });

      const allUsers = Object.values(groups);

      const pendingUsers = allUsers
        .filter(u => u.submissions.some((s: any) => s.status === "Waiting for Approval"))
        .sort((a, b) => a.lastName.localeCompare(b.lastName))
        .map(u => ({ ...u, isPriority: true }));

      const otherUsers = allUsers
        .filter(u => !u.submissions.some((s: any) => s.status === "Waiting for Approval"))
        .sort((a, b) => a.lastName.localeCompare(b.lastName));

      const finalData = [
        ...(pendingUsers.length > 0 ? [{ isHeader: true, title: "Needs Review" }] : []),
        ...pendingUsers,
        { isHeader: true, title: "All Families" },
        ...otherUsers
      ];
      
      setGroupedSubmissions(finalData);
    } catch (error) { 
        console.error(error); 
    } finally { 
        setLoading(false); 
        setRefreshing(false); 
    }
  };

  const handlePickCSV = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'text/comma-separated-values' });
      if (result.canceled) return;
      const fileUri = result.assets[0].uri;
      const response = await fetch(fileUri);
      const csvText = await response.text();
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results: any) => {
          setPendingCsvData(results.data);
          setImportModalVisible(true);
        },
        error: () => Alert.alert("Error", "Could not parse CSV.")
      });
    } catch (e) {
      Alert.alert("Error", "File selection failed.");
    }
  };

  const processBulkAction = async (mode: 'ADD' | 'DELETE') => {
    setImportModalVisible(false);
    setIsUploading(true);
    try {
      const batch = writeBatch(db);
      let count = 0;
      for (const row of pendingCsvData) {
        const email = row.email?.trim().toLowerCase();
        if (!email) continue;
        const approvedRef = doc(db, "approvedEmails", email);
        const userRef = doc(db, "users", email);
        if (mode === 'ADD') {
          const role = row.role?.trim().toLowerCase() || 'family';
          let approvedParentsArray: string[] = [];
          if (role === 'coordinator' && row.assignedParents) {
            approvedParentsArray = row.assignedParents.split(',').map((p: string) => p.trim().toLowerCase());
          }
          batch.set(approvedRef, { role, approvedParents: approvedParentsArray });
        } else {
          batch.delete(approvedRef);
          batch.delete(userRef); 
        }
        count++;
      }
      await batch.commit();
      Alert.alert("Success", `${mode === 'ADD' ? 'Authorized' : 'Deleted'} ${count} records.`);
      fetchAllSubmissions();
    } catch (e) {
      Alert.alert("Database Error", "One or more actions failed.");
    } finally {
      setIsUploading(false);
      setPendingCsvData([]);
    }
  };

  const handleApprove = async (docPath: string) => {
    try {
      await updateDoc(doc(db, docPath), { status: "Approved", adminFeedback: "" });
      fetchAllSubmissions();
    } catch (e) { Alert.alert("Error", "Update failed."); }
  };

  const submitDenial = async () => {
    if (!activeSub) return;
    try {
      await updateDoc(doc(db, activeSub.path), { status: "Denied", adminFeedback: denialReason || "No reason provided." });
      setDenyModalVisible(false);
      fetchAllSubmissions();
    } catch (e) { Alert.alert("Error", "Update failed."); }
  };

  const handleLogout = async () => { 
    try { await signOut(auth); router.replace("/"); } catch (e) { Alert.alert("Error", "Logout failed."); } 
  };

  const renderSubmission = (sub: any, userEmail: string) => (
    <View key={sub.id} style={styles.subItem}>
      <View style={styles.subRow}>
        <Text style={styles.subTitle}>{sub.formId.toUpperCase()}</Text>
        <Text style={[styles.subStatus, { color: sub.status === "Approved" ? "#2ECC71" : "#E69A2F" }]}>
            {sub.status}
        </Text>
      </View>
      {sub.adminFeedback && <Text style={styles.existingFeedback}>Note: {sub.adminFeedback}</Text>}
      <View style={styles.subActions}>
        <TouchableOpacity style={styles.smallBtn} onPress={() => Linking.openURL(`https://www.jotform.com/submission/${sub.jotformSubmissionId}`)}>
            <Text style={styles.btnText}>View Form</Text>
        </TouchableOpacity>
        {sub.status === "Waiting for Approval" && (
          <>
            <TouchableOpacity style={[styles.smallBtn, { backgroundColor: "#2ECC71" }]} onPress={() => handleApprove(sub.fullPath)}>
                <Text style={styles.btnText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.smallBtn, { backgroundColor: "#E74C3C" }]} onPress={() => { setActiveSub({ path: sub.fullPath, email: userEmail }); setDenialReason(""); setDenyModalVisible(true); }}>
                <Text style={styles.btnText}>Deny</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Admin Panel</Text>
        <View style={styles.headerActions}>
           <TouchableOpacity style={[styles.actionBtn, { borderColor: "#6f9bb2" }]} onPress={() => router.push("/uplanding")}>
            <Text style={[styles.actionBtnText, { color: "#6f9bb2" }]}>Parent View</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { borderColor: "#2D9CDB" }]} onPress={handlePickCSV} disabled={isUploading}>
            <Text style={[styles.actionBtnText, { color: "#2D9CDB" }]}>CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { borderColor: "#E74C3C" }]} onPress={handleLogout}>
            <Text style={[styles.actionBtnText, { color: "#E74C3C" }]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color="#6f9bb2" style={{ marginTop: 50 }} />
      ) : (
        <FlatList 
            data={groupedSubmissions}
            renderItem={({ item }) => {
                if (item.isHeader) {
                    return (
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionHeaderText}>{item.title}</Text>
                        </View>
                    );
                }

                const isExpanded = expandedUser === item.email;
                const pendingCount = item.submissions.filter((s: any) => s.status === "Waiting for Approval").length;
                
                return (
                    <View style={[styles.userCard, item.isPriority && styles.priorityCard]}>
                        <TouchableOpacity style={styles.userHeader} onPress={() => setExpandedUser(isExpanded ? null : item.email)}>
                            <View>
                                <Text style={styles.userName}>{item.lastName.toUpperCase()}</Text>
                                <Text style={styles.userEmail}>{item.email}</Text>
                            </View>
                            {pendingCount > 0 && (
                                <View style={styles.alertBadge}>
                                    <Text style={styles.alertText}>{pendingCount} PENDING</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        {isExpanded && <View style={styles.expandedContent}>{item.submissions.map((sub: any) => renderSubmission(sub, item.email))}</View>}
                    </View>
                );
            }}
            keyExtractor={(item, idx) => item.isHeader ? `h-${idx}` : item.email}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchAllSubmissions} />}
        />
      )}

      {/* Modals for CSV Import and Denial Reason */}
      <Modal visible={importModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>CSV Import</Text>
            <Text style={styles.modalSubtitle}>Found {pendingCsvData.length} records.</Text>
            <TouchableOpacity style={[styles.bulkBtn, { backgroundColor: '#2ECC71' }]} onPress={() => processBulkAction('ADD')}>
              <Text style={styles.btnText}>Add/Update Users</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.bulkBtn, { backgroundColor: '#E74C3C', marginTop: 10 }]} onPress={() => processBulkAction('DELETE')}>
              <Text style={styles.btnText}>Bulk Delete Users</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setImportModalVisible(false); setPendingCsvData([]); }}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={denyModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reason for Denial</Text>
            <TextInput style={styles.textInput} multiline placeholder="Feedback..." placeholderTextColor="#888" value={denialReason} onChangeText={setDenialReason} />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDenyModalVisible(false)}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.submitDenyBtn} onPress={submitDenial}><Text style={styles.btnText}>Submit Denial</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f7f6", padding: 15 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 40, marginBottom: 20 },
  headerActions: { flexDirection: "row", gap: 8 },
  title: { fontSize: 22, fontWeight: "bold", color: "#000" },
  sectionHeader: { marginTop: 15, marginBottom: 8, paddingHorizontal: 5 },
  sectionHeaderText: { fontSize: 13, fontWeight: "800", color: "#888", textTransform: "uppercase", letterSpacing: 1.2 },
  actionBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: "#fff", borderWidth: 1 },
  actionBtnText: { fontWeight: "bold", fontSize: 12 },
  userCard: { backgroundColor: "#fff", borderRadius: 10, marginBottom: 10, elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  priorityCard: { borderLeftWidth: 5, borderLeftColor: "#E69A2F" },
  userHeader: { padding: 15, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  userName: { fontSize: 18, fontWeight: "bold", color: "#000" },
  userEmail: { fontSize: 13, color: "#666" },
  alertBadge: { backgroundColor: "#E69A2F", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5 },
  alertText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  expandedContent: { backgroundColor: "#fafafa", padding: 10, borderTopWidth: 1, borderTopColor: "#eee" },
  subItem: { padding: 12, backgroundColor: "#fff", borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: "#eee" },
  subRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  subTitle: { fontWeight: "bold", color: "#34495e", fontSize: 14 },
  subStatus: { fontSize: 11, fontWeight: "800" },
  existingFeedback: { fontSize: 12, color: "#C0392B", fontStyle: "italic", marginBottom: 8 },
  subActions: { flexDirection: "row", gap: 8, marginTop: 5 },
  smallBtn: { backgroundColor: "#34495E", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
  btnText: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 15, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 5, color: "#000" },
  modalSubtitle: { fontSize: 13, color: '#666', marginBottom: 15 },
  textInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, height: 100, textAlignVertical: 'top', marginBottom: 20, color: "#000" },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { padding: 12, alignItems: 'center' },
  cancelBtnText: { color: '#666', fontWeight: 'bold' },
  submitDenyBtn: { backgroundColor: '#E74C3C', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  bulkBtn: { padding: 15, borderRadius: 8, alignItems: 'center' }
});