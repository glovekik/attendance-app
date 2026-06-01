import React, {
  useEffect,
  useState,
  useCallback, useMemo} from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

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
  markChatRead,
} from "../../../src/services/chat";

import {
  getTeam,
  listMyLedTeams,
} from "../../../src/services/teams";

import { getMe } from "../../../src/services/api";

import { useTheme } from "../../../src/theme/ThemeProvider";
import {
  User,
  Team,
  hasRole,
} from "../../../src/types";

export default function TeamChat() {

  const router = useRouter();

  const { theme } = useTheme();

  const c = theme.colors;

  const styles = useMemo(() => makeStyles(c), [c]);

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
      // Opening a team chat clears the dashboard unread badge.
      markChatRead(token).catch(() => {});
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
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        >
          <Ionicons name="chevron-back" size={22} color={c.text} />
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

const makeStyles = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceBorder,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: c.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: c.surfaceBorder,
  },
  title: {
    color: c.text,
    fontSize: 18,
    fontWeight: "800",
  },
  subtitle: {
    color: c.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
});
