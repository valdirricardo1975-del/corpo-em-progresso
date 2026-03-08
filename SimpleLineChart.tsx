import Svg, { Line, Polyline, Text as SvgText } from 'react-native-svg';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/theme';

export const SimpleLineChart = ({ data, unit, emptyLabel }: { data: { label: string; value: number }[]; unit: string; emptyLabel: string }) => {
  if (data.length < 2) {
    return <Text style={styles.empty}>{emptyLabel}</Text>;
  }

  const width = 300;
  const height = 180;
  const padding = 24;
  const values = data.map((item) => item.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = (width - padding * 2) / (data.length - 1);

  const points = data
    .map((item, index) => {
      const x = padding + index * stepX;
      const y = height - padding - ((item.value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <View>
      <Svg width="100%" viewBox={`0 0 ${width} ${height}`}>
        <Line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#D0D5DD" strokeWidth="1" />
        <Polyline points={points} fill="none" stroke={colors.primary} strokeWidth="3" />
        {data.map((item, index) => {
          const x = padding + index * stepX;
          const y = height - padding - ((item.value - min) / range) * (height - padding * 2);
          return (
            <SvgText key={`${item.label}-${index}`} x={x} y={height - 8} fontSize="10" textAnchor="middle" fill="#667085">
              {item.label}
            </SvgText>
          );
        })}
      </Svg>
      <Text style={styles.legend}>Faixa observada: {min.toFixed(1).replace('.', ',')}{unit} até {max.toFixed(1).replace('.', ',')}{unit}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  empty: { color: colors.muted },
  legend: { color: colors.muted, fontSize: 12, marginTop: 8 },
});
