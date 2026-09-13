import React from 'react';
import { View, ScrollView } from 'react-native';
import ScreenWrapper from './ScreenWrapper';
import FundiPageHeader from './FundiPageHeader';
import { fundiStyles } from '../fundiTheme';

export default function FundiThemedScreen({
  title,
  subtitle,
  onBack,
  rightIcon,
  onRightPress,
  rightElement,
  children,
  scroll = true,
  edges = ['top', 'left', 'right'],
  contentStyle,
}) {
  const body = scroll ? (
    <ScrollView
      style={fundiStyles.body}
      contentContainerStyle={[fundiStyles.scroll, contentStyle]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[fundiStyles.body, { flex: 1 }, contentStyle]}>{children}</View>
  );

  return (
    <ScreenWrapper variant="fundi" edges={edges}>
      {title ? (
        <FundiPageHeader
          title={title}
          subtitle={subtitle}
          onBack={onBack}
          rightIcon={rightIcon}
          onRightPress={onRightPress}
          rightElement={rightElement}
        />
      ) : null}
      {body}
    </ScreenWrapper>
  );
}
