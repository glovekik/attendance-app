import React from "react";
import { Platform, ScrollView, ScrollViewProps } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

type Props = ScrollViewProps & {
  /** Native-only: extra space kept below the focused input. */
  bottomOffset?: number;
  children?: React.ReactNode;
};

/**
 * Scroll container that is keyboard-aware on native but a plain ScrollView
 * on web. react-native-keyboard-controller's KeyboardAwareScrollView does
 * not scroll reliably on web (the scroll bar / wheel stop working), so on
 * web we render a normal ScrollView inside a flex:1 host — which scrolls —
 * and keep the keyboard-aware behaviour on iOS/Android.
 */
export const KbAwareScroll = ({
  bottomOffset,
  style,
  children,
  ...rest
}: Props) => {
  if (Platform.OS === "web") {
    return (
      <ScrollView style={[{ flex: 1 }, style]} {...rest}>
        {children}
      </ScrollView>
    );
  }
  return (
    <KeyboardAwareScrollView bottomOffset={bottomOffset} style={style} {...rest}>
      {children}
    </KeyboardAwareScrollView>
  );
};
