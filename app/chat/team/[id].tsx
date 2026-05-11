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

import {
  useRouter,
  useLocalSearchParams,
} from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import { ChatThread } from "../../../src/components/ChatThread";

import {
  listTeamMessages,
  sendTeamMessage,
  deleteTeamMessage,
} from "../../../src/services/chat";

import {
  getTeam,
  listMyLedTeams,
} from "../../../src/services/teams";

import { getMe } from "../../../src/services/api";

import {
  User,
  Team,
  hasRole,
} from "../../../src/types";

export default function TeamChat() {

  const router = useRouter();

  const params = useLocalSearchParams();
  const teamId = params.id as string;

  const [me, setMe] = useState<User | null>(null);
  const [team, setTeam] = useState<Team | null>(null);

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

        // Try to resolve team name for the header.
        if (hasRole(user, "HR")) {
          try {
            const t = await getTeam(token, teamId);
            setTeam(t);
          } catch {}
        } else {
          try {
            const ledTeams = await listMyLedTeams(token);
            const found = ledTeams.find((x) => x.id === teamId);
            if (found) setTeam(found);
          } catch {}
        }
      } catch {
        // ignore — chat still works without the header label
      }
    })();
  }, [teamId]);

  const fetchMessages = useCallback(
    async (before?: string) => {
      const token = await AsyncStorage.getItem("token");
      if (!token) return [];
      return listTeamMessages(token, teamId, { before, limit: 50 });
    },
    [teamId]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const token = await AsyncStorage.getItem("token");
      if (!token) throw new Error("Not authenticated");
      return sendTeamMessage(token, teamId, text);
    },
    [teamId]
  );

  const removeMessage = useCallback(
    async (id: string) => {
      const token = await AsyncStorage.getItem("token");
      if (!token) throw new Error("Not authenticated");
      return deleteTeamMessage(token, teamId, id);
    },
    [teamId]
  );

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
          <Text style={styles.title}>
            {team?.name || "Team Chat"}
          </Text>
          <Text style={styles.subtitle}>
            {team
              ? `${team.memberIds.length} members`
              : "Loading…"}
          </Text>
        </View>
      </View>

      <ChatThread
        me={me}
        fetchMessages={fetchMessages}
        sendMessage={sendMessage}
        deleteMessage={removeMessage}
        emptyText="No team messages yet. Get the conversation going 💬"
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
