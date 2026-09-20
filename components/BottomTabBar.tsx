import { Ionicons } from '@expo/vector-icons';

import {
  usePathname,
  useRouter,
} from 'expo-router';

import {
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { Usuario } from '@/lib/api';

import {
  ehAdministrativo,
} from '@/lib/permissoes';

type RotaPrincipal =
  | '/academias'
  | '/favoritos'
  | '/painel'
  | '/perfil';

type Aba = {
  nome: string;

  rota: RotaPrincipal;

  iconeAtivo: string;

  iconeInativo: string;
};

type BottomTabBarProps = {
  usuario?: Usuario | null;
};

// ================================================================
// USER
// ================================================================

const abasUsuario: Aba[] = [
  {
    nome: 'Academias',

    rota: '/academias',

    iconeAtivo: 'barbell',

    iconeInativo: 'barbell-outline',
  },

  {
    nome: 'Favoritos',

    rota: '/favoritos',

    iconeAtivo: 'star',

    iconeInativo: 'star-outline',
  },

  {
    nome: 'Perfil',

    rota: '/perfil',

    iconeAtivo: 'person',

    iconeInativo: 'person-outline',
  },
];

// ================================================================
// MANAGER / ADMIN
// ================================================================

const abasAdministrativas: Aba[] = [
  {
    nome: 'Academias',

    rota: '/academias',

    iconeAtivo: 'barbell',

    iconeInativo: 'barbell-outline',
  },

  {
    nome: 'Painel',

    rota: '/painel',

    iconeAtivo: 'grid',

    iconeInativo: 'grid-outline',
  },

  {
    nome: 'Perfil',

    rota: '/perfil',

    iconeAtivo: 'person',

    iconeInativo: 'person-outline',
  },
];

export default function BottomTabBar({
  usuario,
}: BottomTabBarProps) {
  const router = useRouter();

  const pathname = usePathname();

  // ==============================================================
  // ENQUANTO /usuarios/me AINDA NÃO TERMINOU
  // ==============================================================

  const abasSemNivel: Aba[] = [
    abasUsuario[0],
    abasUsuario[2],
  ];

  // ==============================================================
  // DEFINE AS ABAS
  // ==============================================================

  const abas = usuario
    ? ehAdministrativo(usuario)
      ? abasAdministrativas
      : abasUsuario
    : abasSemNivel;

  // ==============================================================
  // NAVEGAÇÃO
  // ==============================================================

  function irParaAba(
    rota: RotaPrincipal
  ) {
    if (pathname === rota) {
      return;
    }

    router.replace(rota);
  }

  return (
    <View
      style={{
        // ========================================================
        // IMPORTANTE
        //
        // absolute mantém a navbar DENTRO do container do app.
        //
        // NÃO usar:
        //
        // position: fixed
        // createPortal
        // document.body
        //
        // ========================================================

        position: 'absolute',

        left: 0,
        right: 0,
        bottom: 0,

        zIndex: 50,

        minHeight: 72,

        backgroundColor: '#000',

        borderTopWidth: 1,

        borderTopColor: '#242424',

        paddingTop: 8,

        paddingBottom: 10,

        paddingHorizontal: 8,

        flexDirection: 'row',

        justifyContent: 'space-around',

        shadowColor: '#000',

        shadowOffset: {
          width: 0,
          height: -3,
        },

        shadowOpacity: 0.18,

        shadowRadius: 8,

        elevation: 18,
      }}
    >
      {abas.map((aba) => {
        const ativo =
          pathname === aba.rota;

        return (
          <TouchableOpacity
            key={aba.rota}
            onPress={() =>
              irParaAba(
                aba.rota
              )
            }
            activeOpacity={0.8}
            style={{
              flex: 1,

              alignItems: 'center',

              justifyContent: 'center',

              paddingVertical: 5,
            }}
          >
            <Ionicons
              name={
                ativo
                  ? (aba.iconeAtivo as any)
                  : (aba.iconeInativo as any)
              }
              size={23}
              color={
                ativo
                  ? '#f97316'
                  : '#fff'
              }
            />

            <Text
              style={{
                color:
                  ativo
                    ? '#f97316'
                    : '#fff',

                fontSize: 11,

                fontWeight:
                  ativo
                    ? '900'
                    : '700',

                marginTop: 3,
              }}
            >
              {aba.nome}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}