import React from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {

  state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.log("ErrorBoundary caught:", error, info);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {

    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>

          <View style={styles.iconWrap}>
            <Ionicons
              name="warning-outline"
              size={48}
              color="#fbbf24"
            />
          </View>

          <Text style={styles.title}>
            Something went wrong
          </Text>

          <Text style={styles.subtitle}>
            The screen hit an unexpected error. You can try again, or restart the app if it keeps happening.
          </Text>

          {this.state.error && (
            <View style={styles.errBox}>
              <Text style={styles.errText}>
                {this.state.error.name}: {this.state.error.message}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.btn}
            onPress={this.reset}
          >
            <Ionicons
              name="refresh-outline"
              size={18}
              color="#fff"
            />
            <Text style={styles.btnText}>Try again</Text>
          </TouchableOpacity>

        </ScrollView>
      </View>
    );
  }
}

// Class component — can't use hooks. Use neutral dark fallback styling
// so the error UI is consistent regardless of the user's theme.
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b1220",
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 30,
  },
  iconWrap: {
    alignItems: "center",
    marginBottom: 18,
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 22,
  },
  errBox: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#7f1d1d",
    marginBottom: 22,
  },
  errText: {
    color: "#fca5a5",
    fontSize: 12,
    fontFamily: "monospace",
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  btnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
