import React, {
  useEffect,
  useState,
  useCallback,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import { ChatThread } from "../../src/components/ChatThread";

import {
  listOfficeMessages,
  sendOfficeMessage,
  deleteOfficeMessage,
} from "../../src/services/chat";

import { getMe } from "../../src/services/api";

import { User } from "../../src/types";

export default function OfficeChat() {

  const router = useRouter();

  const [me, setMe] = useState<User | null>(null);

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      try {
        const user = await getMe(token);
        setMe(user);
      } catch {
        // ignore
      }
    })();
  }, []);

  const fetchMessages = useCallback(async (before?: string) => {
    const token = await AsyncStorage.getItem("token");
    if (!token) return [];
    return listOfficeMessages(token, { before, limit: 50 });
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const token = await AsyncStorage.getItem("token");
    if (!token) throw new Error("Not authenticated");
    return sendOfficeMessage(token, text);
  }, []);

  const removeMessage = useCallback(async (id: string) => {
    const token = await AsyncStorage.getItem("token");
    if (!token) throw new Error("Not authenticated");
    return deleteOfficeMessage(token, id);
  }, []);

  return (
    <SafeAreaView style={styles.safe}>

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Office Chat</Text>
          <Text style={styles.subtitle}>Everyone in the company</Text>
        </View>
      </View>

      <ChatThread
        me={me}
        fetchMessages={fetchMessages}
        sendMessage={sendMessage}
        deleteMessage={removeMessage}
        emptyText="No messages yet. Start the conversation 👋"
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b1220" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 2,
  },
});
