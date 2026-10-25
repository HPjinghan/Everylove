// Metro 配置：默认 Expo 配置 + 网页预览补丁（只在 web 平台生效，iOS 构建不受影响）
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const shim = path.resolve(__dirname, 'scripts/web/react-native-shim.js');
const upstream = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // babel-preset-expo 在 web 上会先把 'react-native' 改写成 'react-native-web/dist/index'，两种都接
  const rn = moduleName === 'react-native' || moduleName === 'react-native-web/dist/index';
  if (platform === 'web' && rn && context.originModulePath !== shim) {
    return { type: 'sourceFile', filePath: shim };
  }
  return upstream ? upstream(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
