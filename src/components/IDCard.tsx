import React from "react";

import { View, Text, StyleSheet, Image, Platform } from "react-native";

import { User } from "../types";
import { mediaUrl } from "../utils/media";

/**
 * Employee ID card (badge) — ONE design, built to the approved reference:
 *   framed logo at the top, inset rounded photo, large centred name, role in a
 *   solid navy pill, left-aligned `label : value` rows, navy shape bottom-right.
 *
 * There is deliberately no template choice. Two competing badge layouts is two
 * things to keep correct and a company whose staff don't all carry the same
 * card; the design is a company decision, not a per-person preference.
 *
 * The card deliberately ignores the app's light/dark theme — it represents a
 * physical printed card, so what you see on screen is what prints.
 *
 * Sensitive statutory data (PAN / Aadhaar / bank) is never rendered here —
 * a badge gets photographed and left on desks. Blood group, department and
 * emergency contact live on the BACK for the same reason.
 */

// CR80 badge proportions (54mm x 85.6mm), portrait — standard for lanyards.
export const CARD_W = 320;
export const CARD_H = Math.round(CARD_W * (85.6 / 54)); // 507

// Sampled from assets/images/logo.jpg — 4SightAI's own blues.
const NAVY = "#10305F";
const INK = "#3D4658";
const MUTED = "#9AA3AE";
const HAIRLINE = "#EEF0F3";

const COMPANY = "4SightAI";
const ADDRESS_LINES = [
  "1-1-565/307, Golconda X Road, Bakaram,",
  "Musheerabad (ND), Hyderabad – 500020, Telangana",
];

const LOGO = require("../../assets/images/logo.jpg");

// The logo now sits in its own framed box at the TOP of the card, so it no
// longer has to be notched into the photo's corner — the reference design
// gives it the full width of the card head.
const LOGO_BOX_W = 206;
const LOGO_BOX_PAD = 7;
const LOGO_W = 190;
const LOGO_H = 56; // logo.jpg's true 3.395:1 aspect
// +2 for the hairline: RN heights include the border, so without it the box's
// content area is 2px short of the logo and clips it.
const LOGO_BOX_H = LOGO_H + LOGO_BOX_PAD * 2 + 2;

// Photo geometry. SQUARE frame: the reference places a near-square photo, and
// square is also the honest choice for a face — a landscape frame cover-fits a
// portrait phone photo (~0.79) by throwing away a third of its height.
const PHOTO_SIZE = 190;
const PHOTO_M = (CARD_W - PHOTO_SIZE) / 2; // 65 either side
// Exported so the "Adjust photo" preview can render an identical frame.
export const PHOTO_FRAME_W = PHOTO_SIZE;
export const PHOTO_FRAME_H = PHOTO_SIZE;

/**
 * The aspect uploads must be cropped to. It MUST equal the card's photo frame
 * — cropping to a different aspect silently bins whatever doesn't cover-fit.
 * Derived, never hand-written, so the two can't drift apart.
 */
export const PHOTO_ASPECT: [number, number] = [PHOTO_FRAME_W, PHOTO_FRAME_H];

/** Photo corner radius — exported so the adjuster can't drift from the card. */
export const PHOTO_RADIUS = 20;

/**
 * Where auto-framing places the face. MUST match TARGET_FACE_H / TARGET_FACE_Y
 * in backend utils/face_frame.py — the adjuster draws its guide from these, so
 * aligning by hand lands in the same place the automatic pass would.
 */
export const TARGET_FACE_H = 0.45;
export const TARGET_FACE_Y = 0.4;

const prettyDate = (ymd?: string | null): string => {
  if (!ymd) return "—";
  const d = new Date(ymd.length <= 10 ? `${ymd}T00:00:00` : ymd);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const initialsOf = (name?: string): string =>
  (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase() || "?";

/** A card is only valid while the employee is Active. */
export const isCardValid = (user: User): boolean =>
  (user.status || "Active") === "Active";

const jobTitleOf = (user: User): string =>
  user.work?.jobTitle || user.work?.jobPosition || user.tag || "Employee";

/** Turn stored framing into the transform the photo renders with. */
export const framingStyle = (f?: PhotoFraming | null) =>
  !f || (f.zoom === 1 && f.offsetX === 0 && f.offsetY === 0)
    ? null
    : {
        transform: [
          { translateX: f.offsetX },
          { translateY: f.offsetY },
          { scale: f.zoom },
        ],
      };

const phoneOf = (user: User): string =>
  user.workPhone || user.personal?.phone || "—";

export interface PhotoFraming {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export function IDCard({
  user,
  departmentName,
  side = "front",
  framing,
  photoHandlers,
  photoOverlay,
}: {
  user: User;
  departmentName?: string;
  side?: "front" | "back";
  /** How the photo sits in the frame. Defaults to untransformed. */
  framing?: PhotoFraming | null;
  /** Spread onto the photo so it can be dragged ON the real card. */
  photoHandlers?: any;
  /** Rendered over the photo while adjusting (guide ring, grab cursor). */
  photoOverlay?: React.ReactNode;
}) {
  const valid = isCardValid(user);
  const photo = user.profilePictureUrl
    ? mediaUrl(user.profilePictureUrl) || null
    : null;

  return (
    <View style={styles.card}>
      {side === "front" ? (
        <Front
          user={user}
          photo={photo}
          framing={framing}
          photoHandlers={photoHandlers}
          photoOverlay={photoOverlay}
        />
      ) : (
        <Back user={user} departmentName={departmentName} />
      )}

      {!valid && (
        <View style={styles.voidWrap} pointerEvents="none">
          <Text style={styles.voidText}>VOID</Text>
        </View>
      )}
    </View>
  );
}

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.dRow}>
    <Text style={styles.dKey}>{label}</Text>
    <Text style={styles.dColon}>:</Text>
    <Text style={styles.dVal} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

const Front = ({
  user,
  photo,
  framing,
  photoHandlers,
  photoOverlay,
}: {
  user: User;
  photo: string | null;
  framing?: PhotoFraming | null;
  photoHandlers?: any;
  photoOverlay?: React.ReactNode;
}) => (
  <>
    <View style={styles.logoBox}>
      <Image source={LOGO} style={styles.logo} resizeMode="contain" />
    </View>

    <View style={styles.photo} {...(photoHandlers || {})}>
      {photo ? (
        <Image
          source={{ uri: photo }}
          style={[styles.photoImg, framingStyle(framing)]}
        />
      ) : (
        <View style={styles.photoFallback}>
          <Text style={styles.photoInitials}>{initialsOf(user.name)}</Text>
        </View>
      )}
      {photoOverlay}
    </View>

    <Text style={styles.name} numberOfLines={2} adjustsFontSizeToFit>
      {user.name}
    </Text>

    <View style={styles.pillWrap}>
      <View style={styles.pill}>
        <Text style={styles.pillText} numberOfLines={1}>
          {jobTitleOf(user)}
        </Text>
      </View>
    </View>

    {/* Takes up the slack, so a name that wraps to two lines eats this gap
        instead of pushing the detail rows down into the navy shape. */}
    <View style={styles.spacer} />

    <View style={styles.details}>
      <DetailRow label="ID No" value={user.employeeCode || "—"} />
      <DetailRow label="Email" value={user.email || "—"} />
      <DetailRow label="Phone" value={phoneOf(user)} />
    </View>

    <View style={styles.blob} />
  </>
);

const Back = ({
  user,
  departmentName,
}: {
  user: User;
  departmentName?: string;
}) => {
  const ec = user.emergencyContact;
  const rows: { label: string; value: string }[] = [
    { label: "Employee ID", value: user.employeeCode || "—" },
    { label: "Department", value: departmentName || "—" },
    { label: "Date of joining", value: prettyDate(user.joiningDate) },
    { label: "Blood group", value: user.personal?.bloodGroup || "—" },
  ];

  return (
    <>
      {/* Same framed wordmark as the front, so the pair reads as one card. */}
      <View style={[styles.logoBox, styles.backLogoBox]}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
      </View>

      <View style={styles.backHead}>
        <Text style={styles.backTitle}>Cardholder details</Text>
      </View>

      <View style={styles.backRows}>
        {rows.map((r) => (
          <View key={r.label} style={styles.bRow}>
            <Text style={styles.bKey}>{r.label}</Text>
            <Text style={styles.bVal} numberOfLines={1}>
              {r.value}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.emergency}>
        <Text style={styles.emKey}>IN CASE OF EMERGENCY</Text>
        {ec?.contactName ? (
          <>
            <Text style={styles.emName}>
              {ec.contactName}
              {ec.relationship ? ` · ${ec.relationship}` : ""}
            </Text>
            {!!ec.phone && <Text style={styles.emPhone}>{ec.phone}</Text>}
          </>
        ) : (
          <Text style={styles.emNone}>Not provided</Text>
        )}
      </View>

      <View style={styles.spacer} />

      <View style={styles.addr}>
        <Text style={styles.addrKey}>IF FOUND, RETURN TO</Text>
        <Text style={styles.addrVal}>
          {COMPANY} — {ADDRESS_LINES[0]}
          {"\n"}
          {ADDRESS_LINES[1]}
        </Text>
      </View>

      <Text style={styles.terms}>
        Property of {COMPANY}. Must be surrendered on request. Valid while
        employed.
      </Text>

      <View style={styles.blobBack} />
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    height: CARD_H,
    backgroundColor: "#ffffff",
    borderRadius: 19,
    overflow: "hidden",
    position: "relative",
    ...(Platform.OS === "web"
      ? { boxShadow: "0 18px 40px rgba(16,22,30,0.16)" as any }
      : {
          shadowColor: "#0f172a",
          shadowOpacity: 0.18,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 9 },
          elevation: 7,
        }),
  },

  // ===== front =====
  // Framed wordmark at the head of the card. logo.jpg carries its own white
  // background, so a white box with a hairline reads as an intentional frame
  // rather than an image that failed to knock out.
  logoBox: {
    alignSelf: "center",
    marginTop: 16,
    width: LOGO_BOX_W,
    height: LOGO_BOX_H,
    padding: LOGO_BOX_PAD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DCE3ED",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: LOGO_W, height: LOGO_H },

  photo: {
    alignSelf: "center",
    marginTop: 12,
    marginHorizontal: PHOTO_M,
    width: PHOTO_FRAME_W,
    height: PHOTO_FRAME_H,
    borderRadius: PHOTO_RADIUS,
    overflow: "hidden",
    backgroundColor: "#E4E8EC",
  },
  photoImg: { width: "100%", height: "100%" },
  photoFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3D4457",
  },
  photoInitials: { fontSize: 54, fontWeight: "800", color: "#fff" },

  name: {
    marginTop: 12,
    marginHorizontal: 16,
    textAlign: "center",
    fontSize: 25,
    lineHeight: 28,
    fontWeight: "800",
    color: NAVY,
    letterSpacing: -0.5,
  },

  pillWrap: { alignItems: "center", marginTop: 8 },
  pill: {
    backgroundColor: NAVY,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 7,
    maxWidth: CARD_W - 48,
  },
  pillText: { color: "#fff", fontSize: 11.5, fontWeight: "700" },

  // Left-aligned, sitting low on the card per the reference — the navy shape
  // takes the bottom-right corner, so they stop well clear of it.
  details: { marginLeft: 36, marginRight: 20, marginBottom: 50 },
  dRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  dKey: { width: 48, fontSize: 12, fontWeight: "800", color: NAVY },
  dColon: { width: 12, fontSize: 12, color: NAVY },
  dVal: { flexShrink: 1, fontSize: 12, fontWeight: "500", color: INK },

  blob: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 170,
    height: 42,
    backgroundColor: NAVY,
    borderTopLeftRadius: 46,
  },

  // ===== back =====
  backLogoBox: { marginTop: 20 },
  backHead: { marginTop: 18, marginHorizontal: 24 },
  backTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: NAVY,
  },
  backRows: { marginTop: 14, marginHorizontal: 24 },
  bRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
    gap: 12,
  },
  bKey: { fontSize: 11.5, fontWeight: "700", color: NAVY },
  bVal: { fontSize: 12, fontWeight: "500", color: INK, flexShrink: 1 },

  emergency: {
    marginTop: 16,
    marginHorizontal: 24,
    backgroundColor: "#FDF3F3",
    borderRadius: 12,
    padding: 12,
  },
  emKey: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#C0392B",
  },
  emName: { fontSize: 12.5, fontWeight: "700", color: NAVY, marginTop: 6 },
  emPhone: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#C0392B",
    marginTop: 2,
    letterSpacing: 0.3,
  },
  emNone: { fontSize: 12, color: MUTED, fontStyle: "italic", marginTop: 6 },

  spacer: { flex: 1 },

  addr: { marginHorizontal: 24 },
  addrKey: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: NAVY,
  },
  addrVal: { fontSize: 8.6, lineHeight: 12.5, color: INK, marginTop: 4 },

  terms: {
    marginTop: 9,
    marginHorizontal: 24,
    marginBottom: 44,
    fontSize: 7.8,
    lineHeight: 11.5,
    color: MUTED,
  },

  blobBack: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 98,
    height: 38,
    backgroundColor: NAVY,
    borderTopLeftRadius: 34,
  },

  voidWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.62)",
  },
  voidText: {
    fontSize: 64,
    fontWeight: "900",
    color: "rgba(220,38,38,0.6)",
    letterSpacing: 7,
    transform: [{ rotate: "-22deg" }],
  },
});
