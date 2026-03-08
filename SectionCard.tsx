import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../constants/theme';

export const SectionCard = ({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) => (
  <View style={styles.card}>
    <Text style={styles.title}>{title}</Text>
    {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    <View style={{ marginTop: spacing.sm }}>{children}</View>
  </View>
);

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 22, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontWeight: '700', fontSize: 18 },
  subtitle: { color: colors.muted, marginTop: 4 },
});
