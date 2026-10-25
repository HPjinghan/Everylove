/**
 * 地图的唯一入口：界面从这里拿 MapView / Marker，不直接 import react-native-maps。
 * 网页预览（开发时在浏览器里看界面）走同名的 maps.web.tsx 占位（两份都得是 .tsx：Metro 先按扩展名再按平台找，maps.ts 会盖过 maps.web.tsx）——react-native-maps 没有网页实现，直接引会整页白屏。
 */
export { default, Marker } from 'react-native-maps';
export type { Region } from 'react-native-maps';
