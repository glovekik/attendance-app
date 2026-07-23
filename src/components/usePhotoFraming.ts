import { useEffect, useMemo, useRef, useState } from "react";
import { Image, PanResponder, Platform } from "react-native";

import { IDCardFraming } from "../services/idCard";
import { PHOTO_FRAME_W, PHOTO_FRAME_H } from "./IDCard";

const isWeb = Platform.OS === "web";

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;
export const ZOOM_STEP = 0.12;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/**
 * Drag + zoom behaviour for the ID card photo, as a hook so it can be attached
 * to the REAL card rather than a detached preview — you position the photo on
 * the actual badge and watch it update, instead of guessing in a modal.
 *
 * Web uses real DOM mouse events: react-native-web's PanResponder is driven by
 * the touch responder system and doesn't reliably see a desktop mouse drag.
 * Native keeps PanResponder.
 *
 * Transform maths: RN-web emits `translateX() translateY() scale()`, which CSS
 * applies right-to-left — scale first, then translate. So offsets are in FINAL
 * card pixels and are NOT divided by zoom. The pan range comes from the image's
 * true intrinsic size, so the photo can never be dragged past its own edge.
 * The backend's auto-framing uses this identical model.
 */
export function usePhotoFraming({
  uri,
  value,
  onChange,
  scale = 1,
}: {
  uri?: string | null;
  value: IDCardFraming;
  onChange: (next: IDCardFraming) => void;
  /** Set if the card is rendered smaller than its true size. */
  scale?: number;
}) {
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!uri) return;
    let alive = true;
    Image.getSize(
      uri,
      (w, h) => alive && setNat({ w, h }),
      () => alive && setNat(null)
    );
    return () => {
      alive = false;
    };
  }, [uri]);

  const valueRef = useRef(value);
  valueRef.current = value;
  const startRef = useRef(value);

  /** Max offset before the image's own edge would enter the frame. */
  const limitsFor = (zoom: number) => {
    const FW = PHOTO_FRAME_W;
    const FH = PHOTO_FRAME_H;
    if (!nat || !nat.w || !nat.h) {
      // Fallback when getSize() fails (auth'd / CORS media on web).
      const slack = (zoom - 1) / 2;
      return { x: FW * slack, y: FH * slack };
    }
    const cover = Math.max(FW / nat.w, FH / nat.h);
    return {
      x: Math.max(0, (nat.w * cover * zoom - FW) / 2),
      y: Math.max(0, (nat.h * cover * zoom - FH) / 2),
    };
  };

  const apply = (next: IDCardFraming) => {
    const lim = limitsFor(next.zoom);
    onChange({
      zoom: next.zoom,
      offsetX: clamp(next.offsetX, -lim.x, lim.x),
      offsetY: clamp(next.offsetY, -lim.y, lim.y),
    });
  };

  const moveBy = (dx: number, dy: number) => {
    const s = startRef.current;
    apply({
      zoom: s.zoom,
      offsetX: s.offsetX + dx / scale,
      offsetY: s.offsetY + dy / scale,
    });
  };

  const setZoom = (z: number) => {
    startRef.current = valueRef.current;
    apply({ ...valueRef.current, zoom: clamp(z, ZOOM_MIN, ZOOM_MAX) });
  };

  const reset = () => onChange({ zoom: 1, offsetX: 0, offsetY: 0 });

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          startRef.current = valueRef.current;
          setDragging(true);
        },
        onPanResponderMove: (_e, g) => moveBy(g.dx, g.dy),
        onPanResponderRelease: () => setDragging(false),
        onPanResponderTerminate: () => setDragging(false),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scale, nat]
  );

  const onMouseDown = (e: any) => {
    e?.preventDefault?.();
    startRef.current = valueRef.current;
    setDragging(true);
    const sx = e.clientX;
    const sy = e.clientY;
    const onMove = (ev: MouseEvent) => moveBy(ev.clientX - sx, ev.clientY - sy);
    const onUp = () => {
      setDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const onWheel = (e: any) => {
    e?.preventDefault?.();
    const dir = (e.deltaY ?? 0) > 0 ? -1 : 1;
    setZoom(valueRef.current.zoom + dir * ZOOM_STEP);
  };

  const lim = limitsFor(value.zoom);

  return {
    /** Spread onto the card's photo container to make it draggable. */
    handlers: (isWeb ? { onMouseDown, onWheel } : pan.panHandlers) as any,
    dragging,
    setZoom,
    reset,
    canPan: lim.x > 0.5 || lim.y > 0.5,
  };
}
