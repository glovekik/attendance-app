import React, { useCallback, useState } from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

import { ChatPane } from "../../../src/components/ChatPane";
import { deleteChatGroup } from "../../../src/services/chat";
import { confirmAction, notify } from "../../../src/utils/confirm";
import { useTheme } from "../../../src/theme/ThemeProvider";

/**
 * Ad-hoc group chat — the same pane as office and project chat.
 *
 * The delete control appears only for the HR user who created the group; the
 * server enforces the same rule, so the flag only decides whether to offer it.
 */
export default function GroupChat() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const c = theme.colors;

  const [canDelete, setCanDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const onDelete = useCallback(async () => {
    if (busy || !id) return;
    const ok = await confirmAction({
      title: "Delete this group?",
      message:
        "The group and every message in it will be removed for everyone. This can't be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      setBusy(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await deleteChatGroup(token, id);
      router.replace("/chat");
    } catch (err: any) {
      notify("Couldn't delete group", err?.message || "");
    } finally {
      setBusy(false);
    }
  }, [busy, id, router]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <ChatPane
        channelType="group"
        channelId={id}
        onBack={() =>
          router.canGoBack() ? router.back() : router.replace("/chat")
        }
        onLoaded={({ canDelete: allowed }) => setCanDelete(!!allowed)}
        headerRight={
          canDelete ? (
            <TouchableOpacity
              onPress={onDelete}
              disabled={busy}
              hitSlop={8}
              style={[styles.deleteBtn, { borderColor: c.surfaceBorder }]}
            >
              <Ionicons name="trash-outline" size={17} color={c.dangerText} />
            </TouchableOpacity>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
