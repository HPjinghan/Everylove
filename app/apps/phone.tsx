/**
 * 电话（D-030）：显示可通话的人 = 加好友（缔结契约）的 TA 们。
 * 语音模型接入后开放真实通话（OPEN_QUESTIONS #6 语音供应商）；当前拨打为占位。
 */

import { FlatList, Pressable, StyleSheet, Text, View, Alert } from 'react-native';
import { useRouter } from 'expo-router';

import { AppScreen } from '@/components/app-screen';
import { CharAvatar } from '@/components/char-avatar';
import { MingCute } from '@/components/mingcute';
import { Romance, themed } from '@/constants/theme';
import { levelInfo } from '@/lib/bond';
import { t } from '@/lib/i18n';
import { findCharacter, useAppStore } from '@/store/app-store';

export default function PhoneScreen() {
  const router = useRouter();
  const bonds = useAppStore((s) => s.bonds);

  const call = (name: string) => {
    Alert.alert(t('呼叫{name}…', { name }), t('电话还没接通这个世界。快了。'));
  };

  return (
    <AppScreen title={t("电话")}>
      {bonds.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <MingCute name="phone" size={34} color="#3EB489" />
          </View>
          <Text style={styles.emptyText}>
            {t('还没有可通话的人。')}{'\n'}{t('先去「交友」认识、加上好友。')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={bonds}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const c = findCharacter(item.characterId);
            return (
              <View style={styles.row}>
                <Pressable
                  style={styles.rowMain}
                  onPress={() =>
                    router.push({ pathname: '/bond/[bondId]', params: { bondId: item.id } })
                  }>
                  <CharAvatar
                    name={item.name}
                    color={c?.color ?? Romance.accent}
                    size={48}
                    characterId={item.characterId}
                  />
                  <View style={styles.rowText}>
                    <Text style={styles.rowName}>{item.name}</Text>
                    <Text style={styles.rowSub}>{`${t('羁绊')} LV${levelInfo(item.affinity).level} · ${t(levelInfo(item.affinity).name)}`}</Text>
                  </View>
                </Pressable>
                <Pressable style={styles.callBtn} onPress={() => call(item.name)} hitSlop={6}>
                  <MingCute name="phone" size={22} color="#FFFFFF" />
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </AppScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    list: { padding: 14 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: '#FFFFFF',
      borderRadius: 20,
      padding: 12,
      marginBottom: 8,
    },
    rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    rowText: { flex: 1 },
    rowName: { fontSize: 15, fontWeight: '600', color: Romance.ink },
    rowSub: { fontSize: 12, color: Romance.sub, marginTop: 2 },
    callBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: '#3EB489',
      alignItems: 'center',
      justifyContent: 'center',
    },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80, gap: 14 },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 24,
      backgroundColor: '#D5F2E3',
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: { fontSize: 13, color: Romance.sub, textAlign: 'center', lineHeight: 20 },
  })
);
