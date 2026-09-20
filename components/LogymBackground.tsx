import type { ReactNode } from 'react';

import {
  ImageBackground,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function LogymBackground({
  children,
  style,
}: Props) {
  return (
    <ImageBackground
      source={require('../assets/images/background-logym.png')}
      resizeMode="repeat"
      style={[
        styles.container,
        style,
      ]}
      imageStyle={{
        opacity: 0.55,
      }}
    >
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: '#faf8f5',
    overflow: 'hidden',
  },
});