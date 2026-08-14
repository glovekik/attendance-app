/**
 * Tap-a-person profile card, opened from a chat message.
 *
 * Shows the large avatar and the handful of work details a colleague
 * legitimately needs — the WhatsApp "tap the sender" gesture. The data comes
 * from GET /users/{id}/card, which is a narrow allow-list on the server:
 * no salary, bank details, statutory IDs or home address.
 *
 * Opens with whatever the caller already knows (name + avatar from the chat
 * message) so the sheet paints instantly, then fills in the rest when the
 * fetch lands. Waiting on the network to show a name the caller already had
 * would make a tap feel broken.
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { WebModal } from "./WebModal";
import { Avatar } from "./Avatar";
import { useTheme } from "../theme/ThemeProvider";
import { getUserCard, UserCard } from "../services/users";

export interface ProfileSeed {
  id: string;
  name?: string;
  profilePictureUrl?: string;
}

interface Props {
  person: ProfileSeed | null;
  onClose: () => void;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2024-04-20" -> "20 Apr 2024" */
const prettyDate = (v?: string | null): string | null => {
  if (!v) return null;
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return v;
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

/** "04-20" -> "20 Apr" (no year — age isn't ours to publish) */
const prettyBirthday = (v?: string | null): string | null => {
  if (!v) return null;
  const [m, d] = v.split("-").map(Number);
  if (!m || !d) return null;
  return `${d} ${MONTHS[m - 1]}`;
};

const Row = ({
  icon,
  label,
  value,
  onPress,
  c,
  styles,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress?: () => void;
  c: any;
  styles: any;
}) => {
  const body = (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={16} color={c.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text
          style={[styles.rowValue, !!onPress && { color: c.accent }]}
          numberOfLines={2}
        >
          {value}
        </Text>
      </View>
    </View>
  );
  return onPress ? (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      {body}
    </TouchableOpacity>
  ) : (
    body
  );
};

export const UserProfileSheet = ({ person, onClose }: Props) => {
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = React.useMemo(() => makeStyles(c), [c]);

  const [card, setCard] = useState<UserCard | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!person?.id) {
      setCard(null);
      return;
    }
    let active = true;
    setLoading(true);
    setCard(null);
    (async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) return;
        const data = await getUserCard(token, person.id);
        if (active) setCard(data);
      } catch {
        /* keep the seed values — the sheet still shows name + avatar */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [person?.id]);

  const name = card?.name || person?.name || "User";
  const avatar = card?.profilePictureUrl || person?.profilePictureUrl;
  const subtitle = [card?.designation, card?.department]
    .filter(Boolean)
    .join(" · ");

  const mail = (to: string) => Linking.openURL(`mailto:${to}`);
  const call = (num: string) => Linking.openURL(`tel:${num}`);

  return (
    <WebModal
      visible={!!person}
      onClose={onClose}
      title="Profile"
      size="sm"
      scrollable
    >
      <View style={styles.head}>
        <Avatar name={name} uri={avatar} size={96} />
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        {!!card?.employeeCode && (
          <View style={styles.codePill}>
            <Text style={styles.codeText}>{card.employeeCode}</Text>
          </View>
        )}
      </View>

      {loading && (
        <ActivityIndicator color={c.accent} style={{ marginTop: 14 }} />
      )}

      <View style={styles.rows}>
        {!!card?.email && (
          <Row
            icon="mail-outline"
            label="Email"
            value={card.email}
            onPress={() => mail(card.email!)}
            c={c}
            styles={styles}
          />
        )}
        {!!card?.workPhone && (
          <Row
            icon="call-outline"
            label="Work phone"
            value={card.workPhone}
            onPress={() => call(card.workPhone!)}
            c={c}
            styles={styles}
          />
        )}
        {!!card?.workLocation && (
          <Row
            icon="location-outline"
            label="Location"
            value={card.workLocation}
            c={c}
            styles={styles}
          />
        )}
        {!!prettyDate(card?.joiningDate) && (
          <Row
            icon="briefcase-outline"
            label="Joined"
            value={prettyDate(card?.joiningDate)!}
            c={c}
            styles={styles}
          />
        )}
        {!!prettyBirthday(card?.birthday) && (
          <Row
            icon="gift-outline"
            label="Birthday"
            value={prettyBirthday(card?.birthday)!}
            c={c}
            styles={styles}
          />
        )}
      </View>
    </WebModal>
  );
};

const makeStyles = (c: any) =>
  StyleSheet.create({
    head: { alignItems: "center", gap: 8, paddingBottom: 6 },
    name: {
      color: c.text,
      fontSize: 19,
      fontWeight: "800",
      textAlign: "center",
      marginTop: 4,
    },
    subtitle: {
      color: c.textMuted,
      fontSize: 13,
      textAlign: "center",
    },
    codePill: {
      backgroundColor: c.accentSoft,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 999,
      marginTop: 2,
    },
    codeText: { color: c.accentText, fontSize: 11, fontWeight: "800" },
    rows: { marginTop: 12, gap: 2 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: c.surfaceBorder,
    },
    rowIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.accentSoft,
    },
    rowLabel: { color: c.textMuted, fontSize: 11, fontWeight: "600" },
    rowValue: {
      color: c.text,
      fontSize: 14,
      fontWeight: "600",
      marginTop: 1,
      ...(Platform.OS === "web" ? { wordBreak: "break-word" as any } : {}),
    },
  });
