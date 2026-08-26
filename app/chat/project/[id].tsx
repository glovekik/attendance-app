import React from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ChatPane } from "../../../src/components/ChatPane";
import { useTheme } from "../../../src/theme/ThemeProvider";

/** Project chat as its own route — the same pane the desktop layout embeds. */
export default function ProjectChat() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.bg }]}>
      <ChatPane
        channelType="project"
        channelId={id}
        onBack={() =>
          router.canGoBack() ? router.back() : router.replace("/chat")
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1 } });
