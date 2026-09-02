import { Stack, useRouter } from "expo-router"; // Imported Stack here
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { boardMembers } from "../../constants/boardMembers";

export default function Board() {
  const router = useRouter();

  const renderMember = ({ item }) => (
    <View style={styles.card}>
      {item.image ? (
        <Image source={item.image} style={styles.photo} />
      ) : (
        <View style={styles.photoPlaceholder}>
          <Text style={styles.photoPlaceholderText}>Photo</Text>
        </View>
      )}

      <Text style={styles.name}>{item.name}</Text>

      <Text style={[styles.years, !item.years && styles.hidden]}>
        {item.years ?? " "}
      </Text>

      <Text style={[styles.subtitle, !item.subtitle && styles.hidden]}>
        {item.subtitle ?? " "}
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push(`/board/${item.id}`)}
      >
        <Text style={styles.buttonText}>Read More</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* This configuration removes the file/folder name from the header but keeps the back button */}
      <Stack.Screen options={{ title: "" }} />

      <Text style={styles.title}>Meet the Parents Challenge</Text>
      <Text style={styles.heading}>Board of Directors</Text>

      <FlatList
        data={boardMembers}
        keyExtractor={(item) => item.id}
        renderItem={renderMember}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 32,
    paddingHorizontal: 16,
    backgroundColor: "#ffffff",
  },
  title: {
    fontSize: 16,
    textAlign: "center",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#4B5563",
  },
  heading: {
    fontSize: 28,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
    fontWeight: "700",
  },
  grid: {
    paddingBottom: 32,
  },
  row: {
    justifyContent: "space-between",
  },
  card: {
    flex: 1,
    marginBottom: 24,
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 2,
  },
  photo: {
    width: 110,
    height: 110,
    borderRadius: 12,
    marginBottom: 10,
  },
  photoPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  photoPlaceholderText: {
    color: "#6B7280",
    fontSize: 12,
  },
  name: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  years: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  subtitle: {
    fontSize: 11,
    color: "#4B5563",
    textAlign: "center",
    marginTop: 4,
  },
  button: {
    marginTop: 10,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#374151",
  },
  hidden: {
    opacity: 0,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
});