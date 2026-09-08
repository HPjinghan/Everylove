/**
 * 电话（D-030；D-077 真通话；D-100 纸面）：显示可通话的人 = 加好友（缔结契约）的 TA 们。
 * 白卡描边行：头像 48、名 15/600、副文 12 muted（LV 数字 Fredoka）、右侧 42 primary + 1.5 描边方块内 phoneSimple 20 白。
 * 拨打 → 全屏通话页 app/call/[characterId]（管线式：识别 → 引擎通话模式 → 合成，见 lib/call.ts）。
 */

import { useRouter } from 'expo-router';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { Card } from '@/components/card';
import { CharAvatar } from '@/components/char-avatar';
import { MingCute } from '@/components/mingcute';
import { Shape, Space } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { levelInfo } from '@/lib/bond';
import { callReady } from '@/lib/call';
import { t } from '@/lib/i18n';
import { findCharacter, useAppStore } from '@/store/app-store';

export default function PhoneScreen() {
  const router = useRouter();
  const bonds = useAppStore((s) => s.bonds);

  const call = (characterId: string) => {
    if (!callReady()) {
      Alert.alert(t('AI 不可用'), t('通话需要语音与聊天模型：在 .env.local 配置千帆 key，或登录后走服务端代理。'));
      return;
    }
    router.push({ pathname: '/call/[characterId]', params: { characterId } });
  };

  return (
    <AppScreen title={t('电话')}>
      {bonds.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyTile}>
            <MingCute name="phoneSimple" size={Space.iconTile} color={Romance.ink} />
          </View>
          <Text style={styles.emptyText}>{t('还没有可通话的人。')}</Text>
        </View>
      ) : (
        <FlatList
          data={bonds}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const c = findCharacter(item.characterId);
            const lv = levelInfo(item.affinity);
            return (
              <Card style={styles.row}>
                <Pressable
                  style={styles.rowMain}
                  onPress={() => router.push({ pathname: '/bond/[bondId]', params: { bondId: item.id } })}>
                  <CharAvatar
                    name={item.name}
                    color={c?.color ?? Romance.accent}
                    size={48}
                    characterId={item.characterId}
                  />
                  <View style={styles.rowText}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {t('羁绊')} <Text style={styles.rowSubNum}>LV{lv.level}</Text> · {t(lv.name)}
                    </Text>
                  </View>
                </Pressable>
                <Pressable style={styles.callBtn} onPress={() => call(item.characterId)} hitSlop={6}>
                  <MingCute name="phoneSimple" size={20} color="#FFFFFF" />
                </Pressable>
              </Card>
            );
          }}
        />
      )}
    </AppScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    list: { padding: Space.screen, paddingBottom: 40, gap: 8 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    rowText: { flex: 1 },
    rowName: { fontSize: 15, fontWeight: '600', color: Romance.ink },
    rowSub: { fontSize: 12, color: Romance.sub, marginTop: 2 },
    rowSubNum: { fontFamily: Fonts.label },
    // 拨打：primary 底 + 1.5 描边的方块（主动作，和主按钮同一套描边）
    callBtn: {
      width: 42,
      height: 42,
      borderRadius: Shape.radius,
      backgroundColor: Romance.accent,
      borderWidth: Shape.stroke,
      borderColor: Romance.stroke,
      alignItems: 'center',
      justifyContent: 'center',
    },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80, gap: 14 },
    emptyTile: {
      width: 64,
      height: 64,
      borderRadius: Shape.radius,
      backgroundColor: Romance.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: { fontSize: 13, color: Romance.sub, textAlign: 'center', lineHeight: 20 },
  })
);
