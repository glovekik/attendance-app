import { useEffect, useState } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, ActivityIndicator } from "react-native";

export default function RootLayout() {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const checkAuth = async () => {
      const t = await AsyncStorage.getItem("token");
      setToken(t);
      setLoading(false);
    };

    checkAuth();
  }, []);

  useEffect(() => {
    if (loading) return;

    const isLoginPage = segments[0] === "login";

    if (!token && !isLoginPage) {
      router.replace("/login");
    }

    if (token && isLoginPage) {
      router.replace("/");
    }
  }, [token, loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Slot />;
}