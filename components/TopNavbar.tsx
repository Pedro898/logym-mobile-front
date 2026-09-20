import {
  usePathname,
  useRouter,
} from 'expo-router';

import {
  Image,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function TopNavbar() {
  const router = useRouter();

  const pathname = usePathname();

  function irParaInicio() {
    if (
      pathname === '/login' ||
      pathname === '/'
    ) {
      return;
    }

    router.replace(
      '/academias'
    );
  }

  return (
    <View
      style={{
        width: '100%',

        backgroundColor:
          '#000000',

        borderBottomWidth: 1,

        borderBottomColor:
          '#151515',
      }}
    >
      <View
        style={{
          width: '100%',

          minHeight: 68,

          alignSelf: 'center',

          flexDirection: 'row',

          alignItems: 'center',

          paddingHorizontal: 16,
        }}
      >
        <TouchableOpacity
          onPress={irParaInicio}
          activeOpacity={
            pathname ===
                '/login' ||
            pathname === '/'
              ? 1
              : 0.82
          }
          style={{
            flexDirection: 'row',

            alignItems: 'center',

            alignSelf: 'stretch',
          }}
        >
          <Image
            source={require('../assets/images/logo-navbar.png')}
            resizeMode="contain"
            style={{
              width: 45,

              height: 52,
            }}
          />

          <Text
            style={{
              color: '#ffffff',

              fontSize: 30,

              lineHeight: 34,

              fontWeight: '900',

              letterSpacing: 0.8,

              marginLeft: 9,

              fontFamily:
                Platform.OS ===
                'android'
                  ? 'sans-serif-condensed'
                  : undefined,
            }}
          >
            LOGYM
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}