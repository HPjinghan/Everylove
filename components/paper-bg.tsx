/**
 * 纸面背景图案（D-100；规格在 constants/design.ts 的 Pattern）：只做背景暗纹，不进内容区。
 * - DiamondBackground：paper 底上的 ±45° 菱格（accent 7%、线距 14）——桌面 / 交友 / onboarding / 登录 / 缔结；锁屏传 白 8%。
 * - ChatWallpaper：聊天流底——accentSoft + 120px 平铺涂鸦（心 / 环 / 钻石 / 十字），accent 线 1.4、16%。
 * 都是绝对铺满的 SVG：放在容器的第一个子节点（RN 默认 position relative），后面的内容自然压在上面。
 */

import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, G, Line, Path, Pattern, Rect } from 'react-native-svg';

import { Pattern as PatternSpec } from '@/constants/design';
import { Romance } from '@/constants/theme';

function patternId(prefix: string, raw: string): string {
  return prefix + raw.replace(/[^a-zA-Z0-9]/g, '');
}

export function DiamondBackground({ color, alpha }: { color?: string; alpha?: number }) {
  const id = patternId('dm', useId());
  const stroke = color ?? Romance.accentStrong;
  const opacity = alpha ?? PatternSpec.diamond.alpha;
  // 设计稿是 repeating-linear-gradient(±45deg, 线 1px, 周期 14px)：线与线的垂直距离 14
  // → 正方形平铺单元边长 14√2、两条对角线各一条，跨单元连续
  const side = PatternSpec.diamond.cell * Math.SQRT2;
  const w = PatternSpec.diamond.line;
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <Pattern id={id} patternUnits="userSpaceOnUse" width={side} height={side}>
          <Line x1={0} y1={0} x2={side} y2={side} stroke={stroke} strokeOpacity={opacity} strokeWidth={w} />
          <Line x1={0} y1={side} x2={side} y2={0} stroke={stroke} strokeOpacity={opacity} strokeWidth={w} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/** 聊天流壁纸：底色 accentSoft + 涂鸦；SVG 源自设计稿 data URI（心、环、钻石、十字） */
export function ChatWallpaper() {
  const id = patternId('cw', useId());
  const tile = PatternSpec.chatWallpaper.tile;
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <Pattern id={id} patternUnits="userSpaceOnUse" width={tile} height={tile} viewBox={`0 0 ${tile} ${tile}`}>
          <G
            fill="none"
            stroke={Romance.accentStrong}
            strokeWidth={PatternSpec.chatWallpaper.line}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={PatternSpec.chatWallpaper.alpha}>
            <Path d="M20 26c-3-6 5-10 8-4 3-6 11-2 8 4-2 4-8 8-8 8s-6-4-8-8z" />
            <Circle cx={70} cy={20} r={6} />
            <Path d="M96 30l4-8 4 8-4 3z" />
            <Path d="M14 70h12M20 64v12" />
            <Circle cx={56} cy={66} r={9} />
            <Path d="M92 62c-3-6 5-10 8-4 3-6 11-2 8 4-2 4-8 8-8 8s-6-4-8-8z" />
            <Path d="M30 104l6-6 6 6-6 6z" />
            <Circle cx={78} cy={104} r={4} />
            <Path d="M104 96v12M98 102h12" />
          </G>
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill={Romance.accentSoft} />
      <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}
