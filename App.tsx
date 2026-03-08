import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SectionCard } from './components/SectionCard';
import { SimpleLineChart } from './components/SimpleLineChart';
import { StatCard } from './components/StatCard';
import { colors, spacing } from './constants/theme';
import { copyPhotoToApp, exportBackupJson, importBackupJson, initialData, loadAppData, removeEntryPhoto, saveAppData } from './storage';
import { AppData, Entry, ProfileKey } from './types';
import { formatDate, formatValue, generateId, today, toNumber } from './utils/format';
import { chartPoints, getImc, getVariation, latestEntry, sortDesc } from './utils/stats';

type TabKey = 'painel' | 'registro' | 'historico' | 'fotos' | 'perfil';

const emptyForm = {
  date: today(),
  peso: '',
  gordura: '',
  cintura: '',
  quadril: '',
  braco: '',
  coxa: '',
  observacoes: '',
  photoUri: undefined as string | undefined,
};

export default function App() {
  const [data, setData] = useState<AppData>(initialData);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('painel');
  const [form, setForm] = useState(emptyForm);
  const [nome, setNome] = useState('');
  const [altura, setAltura] = useState('');
  const [meta, setMeta] = useState('');

  useEffect(() => {
    (async () => {
      const stored = await loadAppData();
      setData(stored);
      setLoading(false);
    })();
  }, []);

  const activeKey = data.activeProfile;
  const profile = data.profiles[activeKey];
  const entries = sortDesc(data.entries[activeKey] || []);
  const latest = latestEntry(entries);
  const imc = getImc(latest?.peso, profile.alturaCm);
  const variacao = getVariation(entries);

  useEffect(() => {
    setNome(profile.nome || '');
    setAltura(profile.alturaCm ? String(profile.alturaCm) : '');
    setMeta(profile.metaPeso ? String(profile.metaPeso) : '');
  }, [activeKey]);

  const persist = async (next: AppData) => {
    setData(next);
    await saveAppData(next);
  };

  const switchProfile = async (next: ProfileKey) => {
    await persist({ ...data, activeProfile: next });
    setTab('painel');
  };

  const saveProfile = async () => {
    await persist({
      ...data,
      profiles: {
        ...data.profiles,
        [activeKey]: {
          ...data.profiles[activeKey],
          nome: nome.trim() || (activeKey === 'voce' ? 'Você' : 'Esposa'),
          alturaCm: toNumber(altura),
          metaPeso: toNumber(meta),
        },
      },
    });
    Alert.alert('Perfil atualizado', 'Os dados do perfil foram salvos.');
  };

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Autorize o acesso às fotos para adicionar imagens de evolução.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled) return;
    const localUri = await copyPhotoToApp(result.assets[0].uri);
    setForm((current) => ({ ...current, photoUri: localUri }));
  };

  const saveEntry = async () => {
    const entry: Entry = {
      id: generateId(),
      date: form.date,
      peso: toNumber(form.peso),
      gordura: toNumber(form.gordura),
      cintura: toNumber(form.cintura),
      quadril: toNumber(form.quadril),
      braco: toNumber(form.braco),
      coxa: toNumber(form.coxa),
      observacoes: form.observacoes.trim() || undefined,
      photoUri: form.photoUri,
      createdAt: new Date().toISOString(),
    };

    const hasData = [entry.peso, entry.gordura, entry.cintura, entry.quadril, entry.braco, entry.coxa].some((v) => typeof v === 'number');
    if (!hasData && !entry.photoUri) {
      Alert.alert('Registro vazio', 'Preencha ao menos um campo ou adicione uma foto.');
      return;
    }

    await persist({
      ...data,
      entries: {
        ...data.entries,
        [activeKey]: [entry, ...data.entries[activeKey]],
      },
    });

    setForm({ ...emptyForm, date: today() });
    setTab('historico');
  };

  const deleteEntry = (entry: Entry) => {
    Alert.alert('Excluir registro', 'Deseja remover este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await removeEntryPhoto(entry);
          await persist({
            ...data,
            entries: {
              ...data.entries,
              [activeKey]: data.entries[activeKey].filter((item) => item.id !== entry.id),
            },
          });
        },
      },
    ]);
  };

  const exportBackup = async () => {
    const uri = await exportBackupJson(data);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri);
    } else {
      Alert.alert('Backup gerado', uri);
    }
  };

  const importBackup = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
    if (result.canceled) return;
    try {
      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const text = await response.text();
      const imported = await importBackupJson(text);
      await persist(imported);
      Alert.alert('Backup importado', 'Os dados do app foram restaurados.');
    } catch {
      Alert.alert('Erro', 'Não foi possível importar este arquivo.');
    }
  };

  const cards = (
    <View style={styles.grid}>
      <StatCard title="Peso atual" value={formatValue(latest?.peso, ' kg')} helper={latest ? `Último registro em ${formatDate(latest.date)}` : 'Sem registro'} icon={<Ionicons name="barbell-outline" size={18} color={colors.primary} />} />
      <StatCard title="IMC" value={formatValue(imc)} helper={profile.alturaCm ? 'Baseado na altura do perfil' : 'Cadastre a altura'} icon={<Ionicons name="body-outline" size={18} color={colors.success} />} />
      <StatCard title="Variação" value={variacao === undefined ? '—' : `${variacao > 0 ? '+' : ''}${formatValue(variacao, ' kg')}`} helper="Do primeiro ao último peso" icon={<Ionicons name="swap-vertical-outline" size={18} color={colors.warning} />} />
      <StatCard title="Meta" value={formatValue(profile.metaPeso, ' kg')} helper="Peso alvo do perfil" icon={<Ionicons name="flag-outline" size={18} color={colors.danger} />} />
    </View>
  );

  if (loading) {
    return <SafeAreaView style={styles.center}><Text>Carregando...</Text><StatusBar style="dark" /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View>
            <Text style={styles.small}>Corpo em Progresso</Text>
            <Text style={styles.title}>{profile.nome}</Text>
          </View>
          <View style={styles.switchWrap}>
            <SwitchButton label="Você" active={activeKey === 'voce'} onPress={() => switchProfile('voce')} />
            <SwitchButton label="Esposa" active={activeKey === 'esposa'} onPress={() => switchProfile('esposa')} />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {tab === 'painel' && (
            <View style={styles.gap}>
              <SectionCard title="Resumo" subtitle="Visão rápida do perfil ativo">
                {cards}
              </SectionCard>
              <SectionCard title="Peso" subtitle="Últimos registros">
                <SimpleLineChart data={chartPoints(entries, 'peso')} unit=" kg" emptyLabel="Cadastre ao menos dois pesos para visualizar o gráfico." />
              </SectionCard>
              <SectionCard title="Cintura" subtitle="Acompanhamento das medidas">
                <SimpleLineChart data={chartPoints(entries, 'cintura')} unit=" cm" emptyLabel="Cadastre ao menos duas medidas de cintura para visualizar o gráfico." />
              </SectionCard>
            </View>
          )}

          {tab === 'registro' && (
            <View style={styles.gap}>
              <SectionCard title="Novo registro" subtitle="Peso, medidas, observações e foto">
                <FormField label="Data" value={form.date} onChangeText={(date) => setForm((c) => ({ ...c, date }))} placeholder="AAAA-MM-DD" />
                <FormField label="Peso (kg)" value={form.peso} onChangeText={(peso) => setForm((c) => ({ ...c, peso }))} placeholder="Ex.: 82,4" keyboardType="decimal-pad" />
                <FormField label="Gordura corporal (%)" value={form.gordura} onChangeText={(gordura) => setForm((c) => ({ ...c, gordura }))} placeholder="Ex.: 18,6" keyboardType="decimal-pad" />
                <FormField label="Cintura (cm)" value={form.cintura} onChangeText={(cintura) => setForm((c) => ({ ...c, cintura }))} placeholder="Ex.: 92" keyboardType="decimal-pad" />
                <FormField label="Quadril (cm)" value={form.quadril} onChangeText={(quadril) => setForm((c) => ({ ...c, quadril }))} placeholder="Ex.: 101" keyboardType="decimal-pad" />
                <FormField label="Braço (cm)" value={form.braco} onChangeText={(braco) => setForm((c) => ({ ...c, braco }))} placeholder="Ex.: 34" keyboardType="decimal-pad" />
                <FormField label="Coxa (cm)" value={form.coxa} onChangeText={(coxa) => setForm((c) => ({ ...c, coxa }))} placeholder="Ex.: 58" keyboardType="decimal-pad" />
                <FormField label="Observações" value={form.observacoes} onChangeText={(observacoes) => setForm((c) => ({ ...c, observacoes }))} placeholder="Como se sentiu hoje?" multiline />
                <Pressable style={styles.secondaryButton} onPress={pickPhoto}>
                  <Ionicons name="image-outline" size={18} color={colors.primary} />
                  <Text style={styles.secondaryButtonText}>{form.photoUri ? 'Trocar foto' : 'Adicionar foto de evolução'}</Text>
                </Pressable>
                {form.photoUri && <Image source={{ uri: form.photoUri }} style={styles.preview} />}
                <Pressable style={styles.primaryButton} onPress={saveEntry}><Text style={styles.primaryButtonText}>Salvar registro</Text></Pressable>
              </SectionCard>
            </View>
          )}

          {tab === 'historico' && (
            <View style={styles.gap}>
              <SectionCard title="Histórico" subtitle="Registros mais recentes primeiro">
                {entries.length === 0 ? <Text style={styles.muted}>Ainda não há registros neste perfil.</Text> : entries.map((entry) => (
                  <View key={entry.id} style={styles.entryCard}>
                    <View style={styles.entryTop}>
                      <Text style={styles.entryDate}>{formatDate(entry.date)}</Text>
                      <Pressable onPress={() => deleteEntry(entry)}><Ionicons name="trash-outline" size={18} color={colors.danger} /></Pressable>
                    </View>
                    <Text style={styles.entryText}>Peso: {formatValue(entry.peso, ' kg')}  •  Gordura: {formatValue(entry.gordura, '%')}</Text>
                    <Text style={styles.entryText}>Cintura: {formatValue(entry.cintura, ' cm')}  •  Quadril: {formatValue(entry.quadril, ' cm')}</Text>
                    <Text style={styles.entryText}>Braço: {formatValue(entry.braco, ' cm')}  •  Coxa: {formatValue(entry.coxa, ' cm')}</Text>
                    {!!entry.observacoes && <Text style={styles.note}>{entry.observacoes}</Text>}
                    {!!entry.photoUri && <Image source={{ uri: entry.photoUri }} style={styles.historyImage} />}
                  </View>
                ))}
              </SectionCard>
            </View>
          )}

          {tab === 'fotos' && (
            <View style={styles.gap}>
              <SectionCard title="Fotos de evolução" subtitle="Comparação visual do perfil ativo">
                <Text style={styles.muted}>Total de fotos: {entries.filter((item) => !!item.photoUri).length}</Text>
                <View style={styles.photoGrid}>
                  {entries.filter((item) => !!item.photoUri).map((item) => (
                    <View key={item.id} style={styles.photoCard}>
                      <Image source={{ uri: item.photoUri }} style={styles.photoThumb} />
                      <Text style={styles.photoLabel}>{formatDate(item.date)}</Text>
                    </View>
                  ))}
                </View>
                {entries.filter((item) => !!item.photoUri).length < 2 && <Text style={styles.muted}>Adicione pelo menos duas fotos para comparar a evolução.</Text>}
              </SectionCard>
            </View>
          )}

          {tab === 'perfil' && (
            <View style={styles.gap}>
              <SectionCard title="Perfil" subtitle="Dados individuais do perfil ativo">
                <FormField label="Nome" value={nome} onChangeText={setNome} placeholder="Nome do perfil" />
                <FormField label="Altura (cm)" value={altura} onChangeText={setAltura} placeholder="Ex.: 175" keyboardType="decimal-pad" />
                <FormField label="Meta de peso (kg)" value={meta} onChangeText={setMeta} placeholder="Ex.: 78" keyboardType="decimal-pad" />
                <Pressable style={styles.primaryButton} onPress={saveProfile}><Text style={styles.primaryButtonText}>Salvar perfil</Text></Pressable>
              </SectionCard>
              <SectionCard title="Backup" subtitle="Exporte ou importe os dados do app">
                <Pressable style={styles.secondaryButton} onPress={exportBackup}><Text style={styles.secondaryButtonText}>Exportar backup em JSON</Text></Pressable>
                <View style={{ height: 10 }} />
                <Pressable style={styles.secondaryButton} onPress={importBackup}><Text style={styles.secondaryButtonText}>Importar backup em JSON</Text></Pressable>
                <Text style={[styles.muted, { marginTop: 10 }]}>Nesta primeira versão, o backup exporta os dados do app. As fotos continuam armazenadas localmente dentro do aplicativo.</Text>
              </SectionCard>
            </View>
          )}
        </ScrollView>

        <View style={styles.tabbar}>
          <TabItem icon="home-outline" label="Painel" active={tab === 'painel'} onPress={() => setTab('painel')} />
          <TabItem icon="add-circle-outline" label="Registro" active={tab === 'registro'} onPress={() => setTab('registro')} />
          <TabItem icon="time-outline" label="Histórico" active={tab === 'historico'} onPress={() => setTab('historico')} />
          <TabItem icon="images-outline" label="Fotos" active={tab === 'fotos'} onPress={() => setTab('fotos')} />
          <TabItem icon="person-outline" label="Perfil" active={tab === 'perfil'} onPress={() => setTab('perfil')} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FormField(props: { label: string; value: string; onChangeText: (text: string) => void; placeholder?: string; keyboardType?: any; multiline?: boolean }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        keyboardType={props.keyboardType}
        multiline={props.multiline}
        style={[styles.input, props.multiline && { minHeight: 90, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

function SwitchButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.switchButton, active && styles.switchButtonActive]}><Text style={[styles.switchText, active && styles.switchTextActive]}>{label}</Text></Pressable>;
}

function TabItem({ icon, label, active, onPress }: { icon: any; label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.tabItem}>
      <Ionicons name={icon} size={20} color={active ? colors.primary : colors.muted} />
      <Text style={[styles.tabText, active && { color: colors.primary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  small: { color: colors.muted, fontSize: 12 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  switchWrap: { flexDirection: 'row', backgroundColor: '#EEF2F6', padding: 4, borderRadius: 14, gap: 4 },
  switchButton: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  switchButtonActive: { backgroundColor: colors.card },
  switchText: { color: colors.muted, fontSize: 13 },
  switchTextActive: { color: colors.text, fontWeight: '700' },
  content: { padding: spacing.md, paddingBottom: 120 },
  gap: { gap: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  label: { color: colors.text, marginBottom: 6, fontWeight: '600' },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: colors.text },
  primaryButton: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '700' },
  secondaryButton: { backgroundColor: colors.primarySoft, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  secondaryButtonText: { color: colors.primary, fontWeight: '700' },
  preview: { width: '100%', height: 220, borderRadius: 16, marginTop: 12 },
  muted: { color: colors.muted },
  tabbar: { position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 20, flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10 },
  tabItem: { alignItems: 'center', gap: 2 },
  tabText: { color: colors.muted, fontSize: 11 },
  entryCard: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  entryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  entryDate: { color: colors.text, fontWeight: '700' },
  entryText: { color: colors.text, fontSize: 13, marginTop: 2 },
  note: { color: colors.muted, marginTop: 8 },
  historyImage: { width: '100%', height: 180, borderRadius: 14, marginTop: 10 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  photoCard: { width: '48%' },
  photoThumb: { width: '100%', height: 160, borderRadius: 14 },
  photoLabel: { color: colors.text, marginTop: 6, fontSize: 12 },
});
