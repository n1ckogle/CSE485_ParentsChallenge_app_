import * as DocumentPicker from 'expo-document-picker';
import { router, Stack } from "expo-router";
import { signOut } from "firebase/auth";
import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  query,
  setDoc,
  where,
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
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { auth, db } from "../firebaseConfig";

export default function AdminDashboard() {
  const [groupedSubmissions, setGroupedSubmissions] = useState<any[]>([]);
  const [pendingParents, setPendingParents] = useState<any[]>([]);
  const [formStats, setFormStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Accordion state
  const [expandedCoordinators, setExpandedCoordinators] = useState<Record<string, boolean>>({});
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const [showCoordinatorToggle, setShowCoordinatorToggle] = useState(false);

  const [importModalVisible, setImportModalVisible] = useState(false);
  const [pendingCsvData, setPendingCsvData] = useState<any[]>([]);
  
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [pendingGroupData, setPendingGroupData] = useState<any[]>([]);

  const [denyModalVisible, setDenyModalVisible] = useState(false);
  const [denialReason, setDenialReason] = useState("");
  const [activeSub, setActiveSub] = useState<{path: string, email: string, formId?: string, userId?: string} | null>(null);

  useEffect(() => { 
    checkOverlapRole();
    fetchAllSubmissions(); 
  }, []);

  const checkOverlapRole = async () => {
    try {
      const currentEmail = auth.currentUser?.email?.trim().toLowerCase();
      if (!currentEmail) return;

      const groupsRef = collection(db, "groups");
      const q = query(groupsRef, where("coordinatorEmail", "==", currentEmail));
      const querySnap = await getDocs(q);
      
      if (!querySnap.empty) {
        setShowCoordinatorToggle(true);
      }
    } catch (e) {
      console.error("Error verifying overlap roles:", e);
    }
  };

  const fetchAllSubmissions = async () => {
    try {
      setLoading(true);

      // Fetch forms, users, submissions, and coordinator groups concurrently
      const [formsSnapshot, usersSnapshot, submissionsQuery, groupsSnapshot] = await Promise.all([
        getDocs(collection(db, "forms")),
        getDocs(collection(db, "users")),
        getDocs(query(collectionGroup(db, "formSubmissions"))),
        getDocs(collection(db, "groups"))
      ]);

      const dynamicTemplates = formsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const userProfiles = usersSnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      const realSubmissions = submissionsQuery.docs.map(doc => ({ 
        id: doc.id, 
        fullPath: doc.ref.path, 
        ...doc.data() 
      })) as any[];

      // Create lookup map of user email -> user profile (for coordinator last names)
      const userByEmail: Record<string, any> = {};
      userProfiles.forEach((u) => {
        const email = String(u.email || "").trim().toLowerCase();
        if (email) {
          userByEmail[email] = u;
        }
      });

      // 1. Build lookup map: parent email -> coordinator email
      const parentToCoordinator: Record<string, string> = {};

      groupsSnapshot.docs.forEach((gDoc) => {
        const coordEmail = String(gDoc.data().coordinatorEmail || gDoc.id).trim().toLowerCase();
        const assigned = Array.isArray(gDoc.data().assignedParents)
          ? gDoc.data().assignedParents.map((p: any) => String(p || "").trim().toLowerCase()).filter(Boolean)
          : [];

        assigned.forEach((pEmail: string) => {
          parentToCoordinator[pEmail] = coordEmail;
        });
      });

      // 2. Map submissions to parent user profiles
      const groupsMap: Record<string, any> = {};

      userProfiles.forEach((user) => {
        const email = String(user.email || "").trim().toLowerCase();
        if (!email) return;

        const userRole = String(user.role || "").trim().toLowerCase();
        if (userRole === 'admin') return;

        const coordEmail = parentToCoordinator[email] || "Unassigned";
        const coordLastName = coordEmail !== "Unassigned" ? (userByEmail[coordEmail]?.lastName || "") : "";

        groupsMap[email] = {
          email,
          userId: user.uid || user.id,
          lastName: user.lastName || "Unknown",
          coordinatorEmail: coordEmail,
          coordinatorLastName: coordLastName,
          submissions: []
        };
      });

      realSubmissions.forEach((sub) => {
        const email = String(sub.parentEmail || "").trim().toLowerCase() || "unknown@test.com";
        if (!groupsMap[email]) return;
        groupsMap[email].submissions.push(sub);
      });

      // 3. Preserve multiple submissions per form & insert placeholders for unsubmitted forms
      const allUsers = Object.values(groupsMap).map((user: any) => {
        const structuralSubs = dynamicTemplates.flatMap((form: any) => {
          const matches = user.submissions.filter((s: any) => 
            String(s.formId || "").toLowerCase() === String(form.id || "").toLowerCase()
          );

          if (matches.length > 0) {
            return matches;
          }

          return [{
            id: `placeholder-${form.id || Math.random()}`,
            formId: form.id || "",
            status: "Not Submitted",
            parentEmail: user.email,
            parentLastName: user.lastName,
            jotformSubmissionId: "",
            adminFeedback: "",
            fullPath: `users/${user.userId}/formSubmissions/${form.id}_current` 
          }];
        });

        return { ...user, submissions: structuralSubs };
      });

      // 4. Calculate total form completion stats
      const totalParentsCount = allUsers.length;
      const formSummaries = dynamicTemplates.map((form: any) => {
        const fId = String(form.id || "").toLowerCase();
        let submittedCount = 0;

        allUsers.forEach((u: any) => {
          const hasSubmitted = u.submissions.some(
            (s: any) => String(s.formId || "").toLowerCase() === fId && s.status && s.status !== "Not Submitted"
          );
          if (hasSubmitted) submittedCount++;
        });

        return {
          formId: form.id,
          title: String(form.id || "FORM").toUpperCase(),
          submittedCount,
          totalCount: totalParentsCount
        };
      });

      setFormStats(formSummaries);

      // 5. Extract parents with pending form approvals for top section
      const pendingList = allUsers
        .filter((user) =>
          user.submissions.some((s: any) => s.status === "Waiting for Approval")
        )
        .sort((a, b) => String(a.lastName || "").localeCompare(String(b.lastName || "")));

      setPendingParents(pendingList);

      // 6. Group families into master coordinator buckets
      const coordinatorBuckets: Record<string, any[]> = {};

      allUsers.forEach((user) => {
        const coordEmail = user.coordinatorEmail;
        if (!coordinatorBuckets[coordEmail]) {
          coordinatorBuckets[coordEmail] = [];
        }
        coordinatorBuckets[coordEmail].push(user);
      });

      // 7. Structure data for rendering coordinator folders with local form breakdown
      const finalCoordinatorList = Object.keys(coordinatorBuckets)
        .map((coordEmail) => {
          const parents = coordinatorBuckets[coordEmail].sort((a, b) =>
            String(a.lastName || "").localeCompare(String(b.lastName || ""))
          );

          const coordLastName = coordEmail !== "Unassigned" ? (userByEmail[coordEmail]?.lastName || "") : "";

          const totalPending = parents.reduce((sum, parent) => {
            const pendingInParent = parent.submissions.filter(
              (s: any) => s.status === "Waiting for Approval"
            ).length;
            return sum + pendingInParent;
          }, 0);

          // Calculate form completion breakdown specifically for this coordinator group
          const groupFormStats = dynamicTemplates.map((form: any) => {
            const fId = String(form.id || "").toLowerCase();
            let submittedCount = 0;

            parents.forEach((p: any) => {
              const hasSubmitted = p.submissions.some(
                (s: any) => String(s.formId || "").toLowerCase() === fId && s.status && s.status !== "Not Submitted"
              );
              if (hasSubmitted) submittedCount++;
            });

            return {
              formId: form.id,
              title: String(form.id || "FORM").toUpperCase(),
              submittedCount,
              totalCount: parents.length
            };
          });

          return {
            coordinatorEmail: coordEmail,
            coordinatorLastName: coordLastName,
            parents,
            totalPending,
            totalParents: parents.length,
            formStats: groupFormStats
          };
        })
        .sort((a, b) => {
          if (a.coordinatorEmail === "Unassigned") return 1;
          if (b.coordinatorEmail === "Unassigned") return -1;
          const nameA = a.coordinatorLastName || a.coordinatorEmail;
          const nameB = b.coordinatorLastName || b.coordinatorEmail;
          return nameA.localeCompare(nameB);
        });

      setGroupedSubmissions(finalCoordinatorList);
    } catch (error) { 
      console.error("Error fetching submissions:", error); 
    } finally { 
      setLoading(false); 
      setRefreshing(false); 
    }
  };

  const toggleCoordinator = (coordEmail: string) => {
    setExpandedCoordinators(prev => ({
      ...prev,
      [coordEmail]: !prev[coordEmail]
    }));
  };

  const handleExportReport = () => {
    try {
      const allParents: any[] = [];
      groupedSubmissions.forEach((coordGroup) => {
        if (Array.isArray(coordGroup.parents)) {
          coordGroup.parents.forEach((parent: any) => {
            allParents.push({
              ...parent,
              coordinatorEmail: coordGroup.coordinatorEmail,
              coordinatorLastName: coordGroup.coordinatorLastName
            });
          });
        }
      });

      if (allParents.length === 0) {
        Alert.alert("No Data", "There are no parent records to export.");
        return;
      }

      const allFormIds = new Set<string>();
      allParents.forEach((parent) => {
        if (Array.isArray(parent.submissions)) {
          parent.submissions.forEach((sub: any) => {
            if (sub.formId) {
              allFormIds.add(String(sub.formId).toUpperCase());
            }
          });
        }
      });

      const sortedFormIds = Array.from(allFormIds).sort();

      const reportRows = allParents.map((parent) => {
        const coordDisplay = parent.coordinatorLastName 
          ? `${parent.coordinatorLastName} (${parent.coordinatorEmail})` 
          : (parent.coordinatorEmail || "Unassigned");

        const row: Record<string, string> = {
          "Coordinator": coordDisplay,
          "Last Name": parent.lastName || "Unknown",
          "Email": parent.email || "",
        };

        const subsByForm: Record<string, any[]> = {};
        if (Array.isArray(parent.submissions)) {
          parent.submissions.forEach((sub: any) => {
            const fId = String(sub.formId || "UNKNOWN").toUpperCase();
            if (!subsByForm[fId]) subsByForm[fId] = [];
            subsByForm[fId].push(sub);
          });
        }

        sortedFormIds.forEach((fId) => {
          const formColumnHeader = `Form: ${fId}`;
          const formSubs = subsByForm[fId] || [];

          if (formSubs.length === 0) {
            row[formColumnHeader] = "Not Submitted";
          } else {
            const summaries = formSubs.map((sub) => {
              const status = sub.status || "Not Submitted";
              const subId = sub.jotformSubmissionId ? ` (#${String(sub.jotformSubmissionId).slice(-4)})` : "";
              return `${status}${subId}`;
            });

            row[formColumnHeader] = summaries.join(" | ");
          }
        });

        return row;
      });

      const csvString = Papa.unparse(reportRows);

      if (Platform.OS === 'web') {
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `parent_form_statuses_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        Alert.alert("Export Ready", "CSV generated successfully.");
      }
    } catch (e) {
      console.error("Error generating report:", e);
      Alert.alert("Error", "Could not generate report CSV.");
    }
  };

  const handlePickUserCSV = async () => {
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
          setPendingCsvData(Array.isArray(results.data) ? results.data : []);
          setImportModalVisible(true);
        },
        error: () => Alert.alert("Error", "Could not parse CSV.")
      });
    } catch (e) {
      Alert.alert("Error", "File selection failed.");
    }
  };

  const handlePickGroupCSV = async () => {
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
          setPendingGroupData(Array.isArray(results.data) ? results.data : []);
          setGroupModalVisible(true);
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

      if (mode === 'DELETE') {
        const emailsToDelete = new Set(
          pendingCsvData
            .map(row => String(row.email || "").trim().toLowerCase())
            .filter(Boolean)
        );

        const groupsSnap = await getDocs(collection(db, "groups"));
        groupsSnap.forEach((groupDoc) => {
          const data = groupDoc.data();
          const currentParents: string[] = Array.isArray(data.assignedParents) ? data.assignedParents : [];
          const cleanedParents = currentParents.filter(
            p => !emailsToDelete.has(String(p || "").trim().toLowerCase())
          );

          if (cleanedParents.length !== currentParents.length) {
            batch.update(doc(db, "groups", groupDoc.id), {
              assignedParents: cleanedParents,
              updatedAt: new Date().toISOString()
            });
          }
        });

        for (const email of emailsToDelete) {
          const approvedRef = doc(db, "approvedEmails", email);
          const userRef = doc(db, "users", email);
          batch.delete(approvedRef);
          batch.delete(userRef);
          count++;
        }
      } else {
        for (const row of pendingCsvData) {
          const email = String(row.email || "").trim().toLowerCase();
          if (!email) continue;
          const approvedRef = doc(db, "approvedEmails", email);
          const role = String(row.role || "").trim().toLowerCase() || 'family';
          
          const isPlatinumValue = String(row.isPlatinum || "").trim().toLowerCase();
          const isPlatinum = isPlatinumValue === 'true' || isPlatinumValue === '1' || isPlatinumValue === 'yes';

          batch.set(approvedRef, { 
            role, 
            isPlatinum 
          }, { merge: true });
          count++;
        }
      }

      await batch.commit();
      Alert.alert("Success", `${mode === 'ADD' ? 'Authorized' : 'Deleted'} ${count} records.`);
      fetchAllSubmissions();
    } catch (e) {
      console.error(e);
      Alert.alert("Database Error", "One or more actions failed.");
    } finally {
      setIsUploading(false);
      setPendingCsvData([]);
    }
  };

  const processGroupAction = async () => {
    setGroupModalVisible(false);
    setIsUploading(true);
    try {
      const batch = writeBatch(db);
      let count = 0;

      const groupsSnap = await getDocs(collection(db, "groups"));
      const existingGroups: Record<string, string[]> = {};
      
      groupsSnap.forEach((gDoc) => {
        const data = gDoc.data();
        const cEmail = String(data.coordinatorEmail || gDoc.id).trim().toLowerCase();
        const parents = Array.isArray(data.assignedParents)
          ? data.assignedParents.map((p: any) => String(p || "").trim().toLowerCase()).filter(Boolean)
          : [];
        existingGroups[cEmail] = parents;
      });

      const parentsAssignedInImport: Record<string, string> = {};

      for (const row of pendingGroupData) {
        const coordinatorEmail = String(row.coordinatorEmail || "").trim().toLowerCase();
        if (!coordinatorEmail) continue;

        const assignedParentsArray = row.assignedParents 
          ? String(row.assignedParents)
              .split(',')
              .map((p: string) => String(p || "").trim().toLowerCase())
              .filter(Boolean)
          : [];

        existingGroups[coordinatorEmail] = assignedParentsArray;

        assignedParentsArray.forEach((parent) => {
          parentsAssignedInImport[parent] = coordinatorEmail;
        });

        count++;
      }

      Object.keys(existingGroups).forEach((cEmail) => {
        const currentParents = existingGroups[cEmail];
        const cleanedParents = currentParents.filter((parent) => {
          const targetCoordinator = parentsAssignedInImport[parent];
          if (targetCoordinator) {
            return cEmail === targetCoordinator;
          }
          return true;
        });

        const groupRef = doc(db, "groups", cEmail);
        batch.set(groupRef, {
          coordinatorEmail: cEmail,
          assignedParents: Array.from(new Set(cleanedParents)),
          updatedAt: new Date().toISOString()
        }, { merge: true });
      });

      await batch.commit();
      Alert.alert("Success", `Updated ${count} coordinator groups.`);
      fetchAllSubmissions();
    } catch (e) {
      console.error(e);
      Alert.alert("Database Error", "Failed to update groups.");
    } finally {
      setIsUploading(false);
      setPendingGroupData([]);
    }
  };

  const handleApprove = async (sub: any) => {
    if (!sub?.fullPath) return;
    try {
      await setDoc(doc(db, sub.fullPath), { 
        status: "Approved", 
        adminFeedback: "",
        formId: sub.formId || "",
        parentEmail: sub.parentEmail || "",
        parentLastName: sub.parentLastName || "",
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      fetchAllSubmissions();
    } catch (e) { Alert.alert("Error", "Update failed."); }
  };

  const submitDenial = async () => {
    if (!activeSub) return;
    try {
      await setDoc(doc(db, activeSub.path), { 
        status: "Denied", 
        adminFeedback: denialReason || "No reason provided.",
        formId: activeSub.formId || "",
        parentEmail: activeSub.email || "",
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setDenyModalVisible(false);
      fetchAllSubmissions();
    } catch (e) { Alert.alert("Error", "Update failed."); }
  };

  const handleLogout = async () => { 
    try { await signOut(auth); router.replace("/"); } catch (e) { Alert.alert("Error", "Logout failed."); } 
  };

  const renderSubmission = (sub: any, userEmail: string) => (
    <View key={sub.id || sub.fullPath || Math.random().toString()} style={styles.subItem}>
      <View style={styles.subRow}>
        <Text style={styles.subTitle}>
          {String(sub.formId || "FORM").toUpperCase()}
          {sub.jotformSubmissionId ? ` (#${String(sub.jotformSubmissionId).slice(-4)})` : ""}
        </Text>
        <Text 
          style={[
            styles.subStatus, 
            { 
              color: sub.status === "Approved" ? "#2ECC71" : sub.status === "Denied" ? "#E74C3C" : sub.status === "Not Submitted" ? "#7F8C8D" : "#E69A2F" 
            }
          ]}
        >
            {sub.status || "Not Submitted"}
        </Text>
      </View>
      {sub.adminFeedback ? <Text style={styles.existingFeedback}>Note: {sub.adminFeedback}</Text> : null}
      
      <View style={styles.subActions}>
        {sub.jotformSubmissionId ? (
          <TouchableOpacity style={styles.smallBtn} onPress={() => Linking.openURL(`https://www.jotform.com/submission/${sub.jotformSubmissionId}`)}>
              <Text style={styles.btnText}>View Form</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.smallBtn, { backgroundColor: "#BDC3C7" }]}>
              <Text style={styles.btnText}>No Submission</Text>
          </View>
        )}

        {sub.status !== "Approved" && (
          <TouchableOpacity style={[styles.smallBtn, { backgroundColor: "#2ECC71" }]} onPress={() => handleApprove(sub)}>
              <Text style={styles.btnText}>Approve</Text>
          </TouchableOpacity>
        )}

        {sub.status !== "Denied" && (
          <TouchableOpacity style={[styles.smallBtn, { backgroundColor: "#E74C3C" }]} onPress={() => { setActiveSub({ path: sub.fullPath, email: userEmail, formId: sub.formId }); setDenialReason(sub.adminFeedback || ""); setDenyModalVisible(true); }}>
              <Text style={styles.btnText}>Deny</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "", headerShown: true }} />

      <View style={styles.headerRow}>
        <Text style={styles.title}>Admin Panel</Text>
        <View style={styles.headerActions}>
          {showCoordinatorToggle ? (
            <TouchableOpacity style={[styles.actionBtn, { borderColor: "#9B59B6" }]} onPress={() => router.push("/coordinator_dashboard")}>
              <Text style={[styles.actionBtnText, { color: "#9B59B6" }]}>Coordinator View</Text>
            </TouchableOpacity>
          ) : null}
           <TouchableOpacity style={[styles.actionBtn, { borderColor: "#6f9bb2" }]} onPress={() => router.push("/uplanding")}>
            <Text style={[styles.actionBtnText, { color: "#6f9bb2" }]}>Parent View</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { borderColor: "#27ae60" }]} onPress={handleExportReport}>
            <Text style={[styles.actionBtnText, { color: "#27ae60" }]}>Run Report</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { borderColor: "#2D9CDB" }]} onPress={handlePickUserCSV} disabled={isUploading}>
            <Text style={[styles.actionBtnText, { color: "#2D9CDB" }]}>Users CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { borderColor: "#E69A2F" }]} onPress={handlePickGroupCSV} disabled={isUploading}>
            <Text style={[styles.actionBtnText, { color: "#E69A2F" }]}>Groups CSV</Text>
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
          keyExtractor={(item) => item.coordinatorEmail}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchAllSubmissions} />}
          ListHeaderComponent={
            <View style={{ marginBottom: 15 }}>
              {/* Overall Form Submission Breakdown */}
              {formStats.length > 0 && (
                <View style={styles.statsContainer}>
                  <Text style={styles.sectionHeaderTitle}>📊 GLOBAL FORM SUBMISSION OVERVIEW</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
                    {formStats.map((stat) => {
                      const percent = stat.totalCount > 0 ? Math.round((stat.submittedCount / stat.totalCount) * 100) : 0;
                      return (
                        <View key={stat.formId} style={styles.statCard}>
                          <Text style={styles.statFormId} numberOfLines={1}>{stat.title}</Text>
                          <Text style={styles.statMainNumber}>
                            {stat.submittedCount} / {stat.totalCount}
                          </Text>
                          <Text style={styles.statPercent}>{percent}% Submitted</Text>
                          <View style={styles.statBarBackground}>
                            <View style={[styles.statBarFill, { width: `${percent}%` }]} />
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Top Pinned Section: Single Parent Folders with Pending Forms */}
              {pendingParents.length > 0 && (
                <View style={styles.pendingContainer}>
                  <Text style={styles.sectionHeaderTitle}>
                    ⚠️ PENDING APPROVALS ({pendingParents.length})
                  </Text>
                  
                  {pendingParents.map((parent) => {
                    const isUserExpanded = expandedUser === parent.email;
                    const pendingCount = parent.submissions?.filter(
                      (s: any) => s.status === "Waiting for Approval"
                    ).length ?? 0;

                    const coordLabel = parent.coordinatorLastName 
                      ? `${parent.coordinatorLastName} (${parent.coordinatorEmail})`
                      : parent.coordinatorEmail;

                    return (
                      <View key={`pending-${parent.email}`} style={[styles.userCard, styles.priorityCard]}>
                        <TouchableOpacity 
                          style={styles.userHeader} 
                          onPress={() => setExpandedUser(isUserExpanded ? null : parent.email)}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.userName}>{String(parent.lastName || "UNKNOWN").toUpperCase()}</Text>
                            <Text style={styles.userEmail}>{parent.email || ""}</Text>
                            <Text style={styles.userCoordSub}>Coord: {coordLabel}</Text>
                          </View>
                          
                          <View style={styles.alertBadge}>
                            <Text style={styles.alertText}>{pendingCount} PENDING</Text>
                          </View>

                          <Text style={{ marginLeft: 8, color: '#666', fontSize: 12 }}>
                            {isUserExpanded ? "▲" : "▼"}
                          </Text>
                        </TouchableOpacity>
                        
                        {isUserExpanded && (
                          <View style={styles.expandedContent}>
                            {parent.submissions?.map((sub: any) => renderSubmission(sub, parent.email))}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              <Text style={[styles.sectionHeaderTitle, { marginTop: pendingParents.length > 0 ? 10 : 0 }]}>
                📁 ALL COORDINATOR DIRECTORIES
              </Text>
            </View>
          }
          renderItem={({ item: group }) => {
            const isCoordExpanded = !!expandedCoordinators[group.coordinatorEmail];

            const coordHeaderTitle = group.coordinatorLastName 
              ? `${group.coordinatorLastName.toUpperCase()} (${group.coordinatorEmail.toUpperCase()})` 
              : group.coordinatorEmail.toUpperCase();

            return (
              <View style={styles.coordFolder}>
                <TouchableOpacity 
                  style={styles.coordHeader} 
                  onPress={() => toggleCoordinator(group.coordinatorEmail)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.coordTitle}>
                      📁 {coordHeaderTitle}
                    </Text>
                    <Text style={styles.coordSubtitle}>
                      {group.totalParents} {group.totalParents === 1 ? "Family" : "Families"}
                    </Text>
                  </View>
                  
                  {group.totalPending > 0 && (
                    <View style={styles.alertBadge}>
                      <Text style={styles.alertText}>{group.totalPending} PENDING</Text>
                    </View>
                  )}

                  <Text style={styles.expandChevron}>{isCoordExpanded ? "▲" : "▼"}</Text>
                </TouchableOpacity>

                {isCoordExpanded && (
                  <View style={styles.coordContent}>
                    {/* Coordinator-level Group Form Submission Breakdown */}
                    {group.formStats && group.formStats.length > 0 && (
                      <View style={styles.coordStatsContainer}>
                        <Text style={styles.coordStatsTitle}>GROUP FORM SUBMISSIONS</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                          {group.formStats.map((stat: any) => {
                            const percent = stat.totalCount > 0 ? Math.round((stat.submittedCount / stat.totalCount) * 100) : 0;
                            return (
                              <View key={`coord-stat-${stat.formId}`} style={styles.coordStatCard}>
                                <Text style={styles.coordStatFormId} numberOfLines={1}>{stat.title}</Text>
                                <Text style={styles.coordStatMainNumber}>
                                  {stat.submittedCount} / {stat.totalCount}
                                </Text>
                                <Text style={styles.coordStatPercent}>{percent}% Submitted</Text>
                                <View style={styles.statBarBackground}>
                                  <View style={[styles.statBarFill, { width: `${percent}%` }]} />
                                </View>
                              </View>
                            );
                          })}
                        </ScrollView>
                      </View>
                    )}

                    {/* Assigned Parent Cards */}
                    {group.parents.map((parent: any) => {
                      const isUserExpanded = expandedUser === parent.email;
                      const pendingCount = parent.submissions?.filter(
                        (s: any) => s.status === "Waiting for Approval"
                      ).length ?? 0;

                      return (
                        <View key={parent.email} style={[styles.userCard, pendingCount > 0 && styles.priorityCard]}>
                          <TouchableOpacity 
                            style={styles.userHeader} 
                            onPress={() => setExpandedUser(isUserExpanded ? null : parent.email)}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={styles.userName}>{String(parent.lastName || "UNKNOWN").toUpperCase()}</Text>
                              <Text style={styles.userEmail}>{parent.email || ""}</Text>
                            </View>
                            {pendingCount > 0 && (
                              <View style={styles.alertBadge}>
                                <Text style={styles.alertText}>{pendingCount} PENDING</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                          
                          {isUserExpanded && (
                            <View style={styles.expandedContent}>
                              {parent.submissions?.map((sub: any) => renderSubmission(sub, parent.email))}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      {/* Modal 1: User CSV Actions */}
      <Modal visible={importModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>User List Import</Text>
            <Text style={styles.modalSubtitle}>Found {pendingCsvData.length} entries. (Supports: email, role, isPlatinum)</Text>
            <TouchableOpacity style={[styles.bulkBtn, { backgroundColor: '#2ECC71' }]} onPress={() => processBulkAction('ADD')}>
              <Text style={styles.btnText}>Add / Update Whitelist</Text>
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

      {/* Modal 2: Coordinator Groups CSV Confirmation */}
      <Modal visible={groupModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Coordinator Groups Import</Text>
            <Text style={styles.modalSubtitle}>Found {pendingGroupData.length} group assignment mappings.</Text>
            <TouchableOpacity style={[styles.bulkBtn, { backgroundColor: '#E69A2F' }]} onPress={processGroupAction}>
              <Text style={styles.btnText}>Populate / Update Groups</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setGroupModalVisible(false); setPendingGroupData([]); }}>
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
  actionBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: "#fff", borderWidth: 1 },
  actionBtnText: { fontWeight: "bold", fontSize: 11 },
  
  // Stats Breakdown Header
  statsContainer: {
    marginBottom: 15,
  },
  statCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    width: 140,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  statFormId: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#2C3E50",
    marginBottom: 4,
  },
  statMainNumber: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#34495E",
  },
  statPercent: {
    fontSize: 11,
    color: "#7F8C8D",
    marginTop: 2,
    marginBottom: 6,
  },
  statBarBackground: {
    height: 6,
    backgroundColor: "#EAEAEA",
    borderRadius: 3,
    overflow: "hidden",
  },
  statBarFill: {
    height: "100%",
    backgroundColor: "#2ECC71",
    borderRadius: 3,
  },

  // Section Headers & Pending Container
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#2C3E50",
    marginBottom: 10,
    letterSpacing: 0.5
  },
  pendingContainer: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: "#FFF8EC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F39C12",
  },
  userCoordSub: {
    fontSize: 11,
    color: "#7F8C8D",
    marginTop: 2,
    fontStyle: "italic",
  },

  // Master Coordinator Folder Styles
  coordFolder: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  coordHeader: {
    padding: 16,
    backgroundColor: "#2C3E50",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  coordTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#fff",
  },
  coordSubtitle: {
    fontSize: 12,
    color: "#BDC3C7",
    marginTop: 2,
  },
  expandChevron: {
    color: "#fff",
    fontSize: 11,
    marginLeft: 10,
  },
  coordContent: {
    padding: 12,
    backgroundColor: "#F8F9FA",
  },

  // Coordinator Level Local Breakdown
  coordStatsContainer: {
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EAEAEA",
  },
  coordStatsTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#555",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  coordStatCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
    width: 125,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  coordStatFormId: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#2C3E50",
    marginBottom: 2,
  },
  coordStatMainNumber: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#34495E",
  },
  coordStatPercent: {
    fontSize: 10,
    color: "#7F8C8D",
    marginTop: 1,
    marginBottom: 5,
  },

  // Family Card Styles
  userCard: { backgroundColor: "#fff", borderRadius: 10, marginBottom: 10, elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1, borderWidth: 1, borderColor: "#EAEAEA" },
  priorityCard: { borderLeftWidth: 5, borderLeftColor: "#E69A2F" },
  userHeader: { padding: 15, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  userName: { fontSize: 16, fontWeight: "bold", color: "#000" },
  userEmail: { fontSize: 12, color: "#666" },
  alertBadge: { backgroundColor: "#E69A2F", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, marginRight: 8 },
  alertText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  expandedContent: { backgroundColor: "#fafafa", padding: 10, borderTopWidth: 1, borderTopColor: "#eee" },
  
  // Form Submission Item Styles
  subItem: { padding: 12, backgroundColor: "#fff", borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: "#eee" },
  subRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  subTitle: { fontWeight: "bold", color: "#34495e", fontSize: 14 },
  subStatus: { fontSize: 11, fontWeight: "800" },
  existingFeedback: { fontSize: 12, color: "#C0392B", fontStyle: "italic", marginBottom: 8 },
  subActions: { flexDirection: "row", gap: 8, marginTop: 5 },
  smallBtn: { backgroundColor: "#34495E", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
  btnText: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  
  // Modal Styles
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