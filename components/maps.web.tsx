/**
 * 网页预览用的地图占位（只给开发时在浏览器里看界面用，App 里走 maps.tsx 的真地图）：一块浅底，Marker 不画。
 */
import { Component, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Romance } from '@/constants/theme';

export default class MapView extends Component<{ style?: StyleProp<ViewStyle>; children?: ReactNode }> {
  animateToRegion() {}
  render() {
    return <View style={[{ backgroundColor: Romance.line }, this.props.style]} />;
  }
}

export function Marker() {
  return null;
}
