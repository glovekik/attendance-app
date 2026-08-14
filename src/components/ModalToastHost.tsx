/**
 * A <Toast> host to mount INSIDE a React Native <Modal>.
 *
 * Why this has to exist: a Modal is a separate layer on both platforms — a
 * portal on document.body at z-index 9999 under react-native-web, and a
 * separate native window on iOS/Android. The app-root <Toast> in
 * app/_layout.tsx therefore paints UNDERNEATH any open modal, so an error
 * raised by an action inside one was invisible and the action just looked
 * like it did nothing. No z-index can fix that: on web the root toast can't
 * escape its own stacking context, and on native nothing in the JS tree can
 * cross a window boundary.
 *
 * react-native-toast-message keeps a STACK of mounted hosts and routes
 * Toast.show() to the most recent, popping back to the previous one on
 * unmount. So rendering this inside a modal makes toasts land on top while
 * it's open, and hand back to the root host when it closes — no duplicates,
 * no dangling ref.
 *
 * Place it as the LAST child inside the <Modal>, after the content.
 */

import React from "react";
import Toast from "react-native-toast-message";

import { useTheme } from "../theme/ThemeProvider";
import { useResponsive } from "../utils/responsive";
import { toastConfig } from "./toast";

export const ModalToastHost = () => {
  const { theme } = useTheme();
  const { isDesktop } = useResponsive();
  return (
    <Toast
      config={toastConfig(theme.colors)}
      position="top"
      topOffset={isDesktop ? 24 : 48}
    />
  );
};
