import React from "react";
import {
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import ScreenWrapper from "./ScreenWrapper";

/**
 * Scrollable screen shell
 */
export default function ScrollScreen({
  children,
  style,
  contentStyle,
  keyboard = false,
  bottomPad = 24,
  variant,
}) {
  const body = (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: bottomPad },
        contentStyle,
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );

  return (
    <ScreenWrapper style={[styles.safe, style]} variant={variant}>
      {keyboard ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
});