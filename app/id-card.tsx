import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  TextInput,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { getMe } from "../src/services/api";
import { getUser } from "../src/services/users";
import { listDepartments } from "../src/services/departments";
import {
  getMyIdCard,
  submitIdCardPhoto,
  hrGetIdCard,
  hrApproveIdCard,
  hrRejectIdCard,
  setMyIdCardFraming,
  hrSetIdCardFraming,
  downloadMyIdCard,
  hrDownloadIdCard,
  BadgeFormat,
  IDCardState,
  IDCardFraming,
  DEFAULT_FRAMING,
} from "../src/services/idCard";

import {
  IDCard,
  CARD_W,
  isCardValid,
  PHOTO_ASPECT,
  PHOTO_RADIUS,
  TARGET_FACE_H,
  TARGET_FACE_Y,
  PHOTO_FRAME_W,
  PHOTO_FRAME_H,
} from "../src/components/IDCard";
import { FilePickButton } from "../src/components/FilePickButton";
import {
  usePhotoFraming,
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_STEP,
} from "../src/components/usePhotoFraming";
import { WebModal, ModalActions } from "../src/components/WebModal";
import { useTheme } from "../src/theme/ThemeProvider";
import { useResponsive, getResponsiveSpacing } from "../src/utils/responsive";
import {
  BottomTabBar,
  BOTTOM_BAR_RESERVED_HEIGHT,
} from "../src/components/BottomTabBar";
import { User, hasRole } from "../src/types";
import { notify, confirmAction } from "../src/utils/confirm";
import { mediaUrl } from "../src/utils/media";

const isWeb = Platform.OS === "web";

export default function IdCardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string }>();
  const { theme } = useTheme();
  const c = theme.colors;
  const responsive = useResponsive();
  const spacing = getResponsiveSpacing(responsive.breakpoint);
  const styles = useMemo(() => makeStyles(c), [c]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [me, setMe] = useState<User | null>(null);
  const [subject, setSubject] = useState<User | null>(null);
  const [card, setCard] = useState<IDCardState | null>(null);
  const [deptName, setDeptName] = useState<string | undefined>();
  const [denied, setDenied] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [editing, setEditing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [draftFraming, setDraftFraming] =
    useState<IDCardFraming>(DEFAULT_FRAMING);

  const targetId =
    typeof params.userId === "string" && params.userId ? params.userId : null;

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }

      const meRes = await getMe(token);
      setMe(meRes);

      const viewingOther = !!targetId && targetId !== meRes?.id;
      if (viewingOther && !hasRole(meRes, "HR")) {
        setDenied(true);
        setLoading(false);
        return;
      }

      // These three don't depend on each other — only on `viewingOther`,
      // which getMe already settled. Awaiting them one at a time cost four
      // sequential round trips; on a slow link that was the whole load time.
      // listDepartments fetches the full list either way, so the deptId
      // lookup can happen after it arrives rather than gating the request.
      const [who, state, depts] = await Promise.all([
        viewingOther ? getUser(token, targetId!) : Promise.resolve(meRes),
        viewingOther ? hrGetIdCard(token, targetId!) : getMyIdCard(token),
        // Non-fatal: the card just omits the department line.
        listDepartments(token).catch(() => null),
      ]);

      setSubject(who);
      setCard(state);

      const deptId = (who as any)?.departmentId || who?.work?.departmentId;
      if (deptId && depts) {
        setDeptName((depts || []).find((d: any) => d?.id === deptId)?.name);
      }
    } catch (err: any) {
      notify("Couldn't load ID card", err?.message || "");
    } finally {
      setLoading(false);
    }
  }, [router, targetId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // ===== employee: submit / re-submit the photo =====
  const onPhotoUploaded = async (url: string) => {
    if (busy) return;
    try {
      setBusy(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const next = await submitIdCardPhoto(token, url);
      setCard(next);
      notify(
        "Sent for approval",
        "HR will review your photo. Your card appears once it's approved."
      );
    } catch (err: any) {
      notify("Couldn't submit", err?.message || "");
    } finally {
      setBusy(false);
    }
  };

  const confirmReupload = async (): Promise<boolean> => {
    if (card?.status !== "APPROVED") return true;
    return confirmAction({
      title: "Replace your photo?",
      message:
        "Your ID card will be hidden until HR approves the new photo.",
      confirmLabel: "Continue",
    });
  };

  // ===== HR: approve / reject =====
  const onApprove = async () => {
    if (busy || !targetId) return;
    try {
      setBusy(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const next = await hrApproveIdCard(token, targetId);
      setCard(next);
      notify("Approved", "The employee's ID card is now available to them.");
    } catch (err: any) {
      notify("Couldn't approve", err?.message || "");
    } finally {
      setBusy(false);
    }
  };

  const onReject = async () => {
    if (busy || !targetId) return;
    try {
      setBusy(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const next = await hrRejectIdCard(token, targetId, rejectReason.trim());
      setCard(next);
      setRejectOpen(false);
      setRejectReason("");
      notify("Rejected", "The employee has been asked to upload a new photo.");
    } catch (err: any) {
      notify("Couldn't reject", err?.message || "");
    } finally {
      setBusy(false);
    }
  };

  // ===== reposition / zoom the photo inside the frame =====
  const openFramer = () => {
    setDraftFraming(card?.framing || DEFAULT_FRAMING);
    setEditing(true);
  };

  const saveFraming = async () => {
    if (busy) return;
    try {
      setBusy(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const next = !targetId
        ? await setMyIdCardFraming(token, draftFraming)
        : await hrSetIdCardFraming(token, targetId, draftFraming);
      setCard(next);
      setEditing(false);
      notify(
        "Photo updated",
        next.status === "PENDING" && !targetId
          ? "Your card is hidden until HR approves the new framing."
          : "Framing saved."
      );
    } catch (err: any) {
      notify("Couldn't save", err?.message || "");
    } finally {
      setBusy(false);
    }
  };

  // Drag/zoom attached to the REAL card, so you position the photo on the
  // actual badge and watch it update — no detached preview to guess from.
  const framer = usePhotoFraming({
    uri: card?.photoUrl ? mediaUrl(card.photoUrl) : null,
    value: draftFraming,
    onChange: setDraftFraming,
  });

  const onDownload = async (format: BadgeFormat) => {
    if (exporting) return;
    try {
      setExporting(true);
      // Server-rendered so the photo + logo are always embedded and the file
      // is a clean badge (front + back), not a browser screenshot.
      if (targetId && targetId !== me?.id) {
        await hrDownloadIdCard(targetId, format);
      } else {
        await downloadMyIdCard(format);
      }
    } catch (err: any) {
      notify("Couldn't download", err?.message || "Please try again.");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loader, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (denied) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
        <View style={styles.deniedWrap}>
          <Ionicons name="lock-closed-outline" size={40} color={c.textMuted} />
          <Text style={styles.deniedText}>
            Only HR can view another employee&apos;s ID card.
          </Text>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: c.accent }]}
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/")
            }
          >
            <Text style={styles.btnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isOwn = !targetId || targetId === me?.id;

  // While adjusting, show the front of the real card with a live photo.
  const editOverlay = (
    <View pointerEvents="none" style={styles.editOverlay}>
      <View style={styles.guideRing} />
    </View>
  );
  const status = card?.status || "NONE";
  const approved = status === "APPROVED";
  const photo = card?.photoUrl ? mediaUrl(card.photoUrl) : null;

  // The badge always shows the HR-APPROVED photo, not the account avatar.
  const cardUser: User | null =
    subject && approved
      ? ({ ...subject, profilePictureUrl: card?.photoUrl || undefined } as User)
      : null;

  // Employee only: once they've had a card issued, keep showing it while a NEW
  // photo is still PENDING/REJECTED — the card doesn't disappear the moment
  // they re-submit. HR's review view is unaffected (they see the new photo).
  const priorApproved = isOwn && !approved && !!card?.approvedPhotoUrl;
  const priorCardUser: User | null =
    priorApproved && subject
      ? ({
          ...subject,
          profilePictureUrl: card?.approvedPhotoUrl || undefined,
        } as User)
      : null;

  const bottomPadding = responsive.showSidebar
    ? 40
    : BOTTOM_BAR_RESERVED_HEIGHT + 24;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.padding,
          paddingBottom: bottomPadding,
          alignItems: "center",
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/")
            }
            style={[
              styles.iconBtn,
              { backgroundColor: c.surface, borderColor: c.surfaceBorder },
            ]}
          >
            <Ionicons name="chevron-back" size={22} color={c.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.title}>
              {isOwn ? "My ID Card" : "Employee ID Card"}
            </Text>
            <Text style={styles.subtitle}>{subject?.name || ""}</Text>
          </View>
        </View>

        {/* ============ ADJUSTING — on the real card ============ */}
        {editing && subject && !!card?.photoUrl && (
          <>
            {!approved && (
              <View style={styles.previewNote}>
                <Ionicons name="eye-outline" size={15} color={c.textMuted} />
                <Text style={styles.previewNoteText}>
                  Preview while you position the photo — the card is still
                  pending approval.
                </Text>
              </View>
            )}

            <IDCard
              user={
                {
                  ...subject,
                  profilePictureUrl: card?.photoUrl || undefined,
                } as User
              }
              departmentName={deptName}
              side="front"
              framing={draftFraming}
              photoHandlers={framer.handlers}
              photoOverlay={editOverlay}
            />

            <Text style={styles.editHint}>
              {framer.canPan
                ? isWeb
                  ? "Drag the photo on the card · scroll to zoom"
                  : "Drag the photo on the card to position it"
                : "Zoom in to reposition the photo"}
            </Text>

            <View style={styles.toolbar}>
              <TouchableOpacity
                style={styles.toolBtn}
                onPress={() => framer.setZoom(draftFraming.zoom - ZOOM_STEP)}
                disabled={draftFraming.zoom <= ZOOM_MIN + 0.001}
              >
                <Ionicons name="remove" size={20} color={c.text} />
              </TouchableOpacity>

              <View style={styles.track}>
                <View
                  style={[
                    styles.trackFill,
                    {
                      width: `${
                        ((draftFraming.zoom - ZOOM_MIN) /
                          (ZOOM_MAX - ZOOM_MIN)) *
                        100
                      }%`,
                    },
                  ]}
                />
              </View>

              <TouchableOpacity
                style={styles.toolBtn}
                onPress={() => framer.setZoom(draftFraming.zoom + ZOOM_STEP)}
                disabled={draftFraming.zoom >= ZOOM_MAX - 0.001}
              >
                <Ionicons name="add" size={20} color={c.text} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.toolBtn} onPress={framer.reset}>
                <Ionicons name="refresh" size={18} color={c.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.editActions}>
              <TouchableOpacity
                style={[styles.btn, styles.ghostBtn, { flex: 1 }]}
                onPress={() => setEditing(false)}
                disabled={busy}
              >
                <Text style={[styles.btnText, { color: c.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.btn,
                  { backgroundColor: c.accent, flex: 1 },
                  busy && { opacity: 0.6 },
                ]}
                onPress={saveFraming}
                disabled={busy}
              >
                <Text style={styles.btnText}>
                  {busy ? "Saving…" : "Save position"}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ============ STATE: APPROVED → show the card ============ */}
        {!editing && approved && cardUser ? (
          <>
            {!isCardValid(cardUser) && (
              <View style={styles.warnBanner}>
                <Ionicons name="alert-circle" size={18} color="#b45309" />
                <Text style={styles.warnText}>
                  This employee is {cardUser.status} — the badge is marked VOID
                  and must not be used for access.
                </Text>
              </View>
            )}

            <View
              style={[
                styles.cardsRow,
                responsive.isDesktop
                  ? styles.cardsRowWide
                  : styles.cardsRowNarrow,
              ]}
            >
              <IDCard
                user={cardUser}
                departmentName={deptName}
                side="front"
                framing={card?.framing}
              />
              <IDCard
                user={cardUser}
                departmentName={deptName}
                side="back"
              />
            </View>

            {isWeb ? (
              <>
                <View style={styles.dlRow}>
                  <TouchableOpacity
                    style={[
                      styles.btn,
                      { backgroundColor: c.accent, flex: 1 },
                      exporting && { opacity: 0.6 },
                    ]}
                    onPress={() => onDownload("pdf")}
                    disabled={exporting}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={18}
                      color="#fff"
                    />
                    <Text style={styles.btnText}>
                      {exporting ? "Preparing…" : "Download PDF"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.btn,
                      styles.ghostBtn,
                      { flex: 1 },
                      exporting && { opacity: 0.6 },
                    ]}
                    onPress={() => onDownload("jpg")}
                    disabled={exporting}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="image-outline" size={18} color={c.text} />
                    <Text style={[styles.btnText, { color: c.text }]}>
                      Download JPG
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.hint}>
                  Front &amp; back, print-ready, with the photo embedded.
                </Text>
              </>
            ) : (
              <Text style={styles.hint}>
                Open the app on a computer to download this card.
              </Text>
            )}

            {isOwn && (
              <TouchableOpacity
                style={[styles.btn, styles.ghostBtn]}
                onPress={openFramer}
                activeOpacity={0.85}
              >
                <Ionicons name="move-outline" size={18} color={c.text} />
                <Text style={[styles.btnText, { color: c.text }]}>
                  Adjust photo
                </Text>
              </TouchableOpacity>
            )}

            {isOwn && (
              <FilePickButton
                label="Upload a different photo"
                crop
                aspect={PHOTO_ASPECT}
                mimeType="image/*"
                style={styles.uploadBtn}
                onUploaded={async (url) => {
                  if (await confirmReupload()) onPhotoUploaded(url);
                }}
              />
            )}
          </>
        ) : editing ? null : (
          /* ============ STATE: NONE / PENDING / REJECTED ============ */
          <>
          {/* Still-valid issued card, kept on screen while a new photo is
              under review. Shown above the "new photo" status block. */}
          {priorCardUser && (
            <>
              <View style={styles.pendingBanner}>
                <Ionicons
                  name={
                    status === "REJECTED"
                      ? "close-circle-outline"
                      : "hourglass-outline"
                  }
                  size={16}
                  color="#b45309"
                />
                <Text style={styles.pendingBannerText}>
                  {status === "REJECTED"
                    ? "Your new photo was rejected — the ID card below is still valid and stays in use."
                    : "Your new photo is pending HR approval. The ID card below stays active until the new one is approved."}
                </Text>
              </View>

              <View
                style={[
                  styles.cardsRow,
                  responsive.isDesktop
                    ? styles.cardsRowWide
                    : styles.cardsRowNarrow,
                  { marginBottom: 22 },
                ]}
              >
                <IDCard
                  user={priorCardUser}
                  departmentName={deptName}
                  side="front"
                  framing={card?.approvedFraming}
                />
                <IDCard
                  user={priorCardUser}
                  departmentName={deptName}
                  side="back"
                />
              </View>
            </>
          )}

          <View style={styles.stateCard}>
            <View
              style={[
                styles.stateIcon,
                {
                  backgroundColor:
                    status === "PENDING"
                      ? "rgba(245,158,11,0.14)"
                      : status === "REJECTED"
                      ? "rgba(220,38,38,0.12)"
                      : c.accentSoft,
                },
              ]}
            >
              <Ionicons
                name={
                  status === "PENDING"
                    ? "hourglass-outline"
                    : status === "REJECTED"
                    ? "close-circle-outline"
                    : "card-outline"
                }
                size={30}
                color={
                  status === "PENDING"
                    ? "#b45309"
                    : status === "REJECTED"
                    ? "#dc2626"
                    : c.accent
                }
              />
            </View>

            <Text style={styles.stateTitle}>
              {status === "PENDING"
                ? priorApproved
                  ? "New photo — waiting for approval"
                  : "Waiting for HR approval"
                : status === "REJECTED"
                ? priorApproved
                  ? "New photo was rejected"
                  : "Photo was rejected"
                : isOwn
                ? "Get your ID card"
                : "No photo submitted yet"}
            </Text>

            <Text style={styles.stateBody}>
              {status === "PENDING"
                ? isOwn
                  ? priorApproved
                    ? "Your new photo has been sent to HR. The card above updates to it once approved."
                    : "Your photo has been sent to HR. Once it's approved, your ID card will appear here."
                  : "This employee is waiting for their photo to be reviewed."
                : status === "REJECTED"
                ? isOwn
                  ? "HR asked for a different photo. Upload a new one to try again."
                  : "This photo was rejected. The employee needs to upload a new one."
                : isOwn
                ? "Upload a clear passport-style photo. HR reviews it, and once approved your ID card is issued here."
                : "This employee hasn't uploaded a photo for their ID card yet."}
            </Text>

            {status === "REJECTED" && !!card?.rejectionReason && (
              <View style={styles.reasonBox}>
                <Text style={styles.reasonLabel}>REASON FROM HR</Text>
                <Text style={styles.reasonText}>{card.rejectionReason}</Text>
              </View>
            )}

            {/* Submitted photo preview */}
            {!!photo && status !== "NONE" && (
              <View style={styles.previewWrap}>
                <Image source={{ uri: photo }} style={styles.preview} />
                <Text style={styles.previewCaption}>
                  {status === "PENDING"
                    ? "Submitted — under review"
                    : "Rejected photo"}
                </Text>
              </View>
            )}

            {/* Employee action: upload / re-upload */}
            {isOwn && (
              <FilePickButton
                label={
                  status === "NONE"
                    ? "Upload photo"
                    : "Upload a different photo"
                }
                crop
                aspect={PHOTO_ASPECT}
                mimeType="image/*"
                style={styles.uploadBtn}
                onUploaded={onPhotoUploaded}
              />
            )}

            {isOwn && !!card?.photoUrl && status !== "NONE" && (
              <TouchableOpacity
                style={[styles.btn, styles.ghostBtn]}
                onPress={openFramer}
                activeOpacity={0.85}
              >
                <Ionicons name="move-outline" size={18} color={c.text} />
                <Text style={[styles.btnText, { color: c.text }]}>
                  Adjust photo
                </Text>
              </TouchableOpacity>
            )}

            {isOwn && status === "NONE" && (
              <Text style={styles.hint}>
                Tip: face the camera straight on, with a plain background.
              </Text>
            )}
          </View>
          </>
        )}

        {/* ============ HR REVIEW ACTIONS ============ */}
        {!editing && !isOwn && status === "PENDING" && !!card?.photoUrl && (
          <TouchableOpacity
            style={[styles.btn, styles.ghostBtn]}
            onPress={openFramer}
            activeOpacity={0.85}
          >
            <Ionicons name="move-outline" size={18} color={c.text} />
            <Text style={[styles.btnText, { color: c.text }]}>
              Adjust framing
            </Text>
          </TouchableOpacity>
        )}

        {!editing && !isOwn && status === "PENDING" && (
          <View style={styles.hrActions}>
            <TouchableOpacity
              style={[styles.btn, styles.rejectBtn]}
              onPress={() => setRejectOpen((v) => !v)}
              disabled={busy}
            >
              <Ionicons name="close" size={18} color="#dc2626" />
              <Text style={[styles.btnText, { color: "#dc2626" }]}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.btn,
                { backgroundColor: "#16a34a" },
                busy && { opacity: 0.6 },
              ]}
              onPress={onApprove}
              disabled={busy}
            >
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={styles.btnText}>Approve</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isOwn && rejectOpen && status === "PENDING" && (
          <View style={styles.rejectBox}>
            <Text style={styles.reasonLabel}>REASON (shown to employee)</Text>
            <TextInput
              style={styles.reasonInput}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="e.g. Photo is blurry — please retake"
              placeholderTextColor={c.textFaint}
              multiline
            />
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: "#dc2626", marginTop: 10 }]}
              onPress={onReject}
              disabled={busy}
            >
              <Text style={styles.btnText}>
                {busy ? "Sending…" : "Confirm rejection"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>


      <BottomTabBar user={me} />
    </SafeAreaView>
  );
}

const makeStyles = (c: any) =>
  StyleSheet.create({
    safe: { flex: 1 },
    loader: { flex: 1, alignItems: "center", justifyContent: "center" },

    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "stretch",
      marginBottom: 18,
    },
    iconBtn: {
      width: 42,
      height: 42,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { fontSize: 24, fontWeight: "800", color: c.text },
    subtitle: { fontSize: 13, marginTop: 2, color: c.textMuted },

    warnBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      alignSelf: "stretch",
      backgroundColor: "rgba(245,158,11,0.12)",
      borderColor: "rgba(245,158,11,0.4)",
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
    },
    warnText: { flex: 1, color: "#b45309", fontSize: 12.5, lineHeight: 18 },

    pendingBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      alignSelf: "stretch",
      maxWidth: 680,
      backgroundColor: "rgba(245,158,11,0.12)",
      borderColor: "rgba(245,158,11,0.4)",
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
    },
    pendingBannerText: {
      flex: 1,
      color: "#b45309",
      fontSize: 12.5,
      lineHeight: 18,
      fontWeight: "600",
    },

    cardsRow: { gap: 24, alignItems: "center" },
    dlRow: {
      flexDirection: "row",
      gap: 10,
      alignSelf: "stretch",
      maxWidth: 420,
      marginTop: 4,
    },
    cardsRowWide: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
    },
    cardsRowNarrow: { flexDirection: "column" },

    // ===== empty / pending / rejected state =====
    stateCard: {
      width: "100%",
      maxWidth: 420,
      alignItems: "center",
      backgroundColor: c.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      padding: 26,
    },
    stateIcon: {
      width: 62,
      height: 62,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    stateTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: c.text,
      textAlign: "center",
    },
    stateBody: {
      fontSize: 13,
      lineHeight: 19,
      color: c.textMuted,
      textAlign: "center",
      marginTop: 8,
    },

    reasonBox: {
      alignSelf: "stretch",
      backgroundColor: "rgba(220,38,38,0.08)",
      borderColor: "rgba(220,38,38,0.3)",
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      marginTop: 16,
    },
    reasonLabel: {
      fontSize: 9.5,
      fontWeight: "800",
      letterSpacing: 1,
      color: c.textMuted,
      marginBottom: 5,
    },
    reasonText: { color: c.text, fontSize: 13, lineHeight: 18 },

    previewWrap: { alignItems: "center", marginTop: 18 },
    preview: {
      width: 132,
      height: 176,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      backgroundColor: c.surfaceMuted,
    },
    previewCaption: {
      fontSize: 11.5,
      color: c.textMuted,
      marginTop: 8,
      fontWeight: "600",
    },

    uploadBtn: { alignSelf: "center", marginTop: 20 },

    btn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      paddingHorizontal: 22,
      borderRadius: 14,
      marginTop: 20,
      minWidth: 170,
      ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
    },
    btnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
    // ===== in-place photo adjusting =====
    editOverlay: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "flex-start",
      ...(Platform.OS === "web" ? { cursor: "grab" as any } : {}),
    },
    // Sits exactly where auto-framing places the face, derived from the same
    // constants the card and the backend use.
    guideRing: {
      position: "absolute",
      width: `${(TARGET_FACE_H * PHOTO_FRAME_H * 100) / PHOTO_FRAME_W}%`,
      height: `${TARGET_FACE_H * 100}%`,
      top: `${(TARGET_FACE_Y - TARGET_FACE_H / 2) * 100}%`,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: "rgba(255,255,255,0.75)",
      borderStyle: "dashed",
    },
    previewNote: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      alignSelf: "stretch",
      backgroundColor: c.surfaceMuted,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
      marginBottom: 14,
    },
    previewNoteText: { flex: 1, color: c.textMuted, fontSize: 12, lineHeight: 16 },
    editHint: {
      marginTop: 14,
      fontSize: 12.5,
      fontWeight: "600",
      color: c.textMuted,
      textAlign: "center",
    },
    toolbar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 12,
      width: CARD_W,
      maxWidth: "100%",
    },
    toolBtn: {
      width: 40,
      height: 40,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
    },
    track: {
      flex: 1,
      height: 5,
      borderRadius: 3,
      backgroundColor: c.surfaceMuted,
      overflow: "hidden",
    },
    trackFill: { height: "100%", backgroundColor: c.accent },
    editActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 8,
      width: CARD_W,
      maxWidth: "100%",
    },

    ghostBtn: {
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderColor: c.surfaceBorder,
    },

    modalBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    modalBtnGhost: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: c.surfaceBorder,
    },
    modalBtnText: { fontSize: 14, fontWeight: "800" },
    framerWarn: {
      marginTop: 14,
      fontSize: 12,
      lineHeight: 17,
      color: "#b45309",
      textAlign: "center",
    },

    hrActions: {
      flexDirection: "row",
      gap: 12,
      marginTop: 4,
      flexWrap: "wrap",
      justifyContent: "center",
    },
    rejectBtn: {
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderColor: "#dc2626",
    },
    rejectBox: {
      width: "100%",
      maxWidth: 420,
      marginTop: 16,
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      padding: 14,
    },
    reasonInput: {
      backgroundColor: c.surfaceMuted,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      padding: 12,
      color: c.text,
      minHeight: 70,
      textAlignVertical: "top",
    },

    hint: {
      marginTop: 12,
      fontSize: 12,
      lineHeight: 17,
      color: c.textMuted,
      textAlign: "center",
      maxWidth: 340,
    },

    deniedWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      padding: 32,
    },
    deniedText: {
      color: c.textMuted,
      fontSize: 14,
      fontWeight: "600",
      textAlign: "center",
    },
  });
