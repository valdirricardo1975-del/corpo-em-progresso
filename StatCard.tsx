import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../constants/theme';

export const StatCard = ({ title, value, helper, icon }: { title: string; value: string; helper: string; icon?: ReactNode }) => (
  <View style={styles.card}>
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {icon}
    </View>
    <Text style={styles.value}>{value}</Text>
    <Text style={styles.helper}>{helper}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 18, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 8, flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.muted, fontSize: 13 },
  value: { color: colors.text, fontSize: 24, fontWeight: '700' },
  helper: { color: colors.muted, fontSize: 12 },
});
