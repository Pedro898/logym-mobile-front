import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type {
  AcademiaSelecionadaComparacao,
} from '@/lib/comparacao';

type ComparisonBarProps = {
  academiasSelecionadas:
    AcademiaSelecionadaComparacao[];

  onRemover:
    (
      academiaId:
        | string
        | number
    ) => void | Promise<void>;

  onLimpar:
    () => void | Promise<void>;

  onComparar:
    () => void;

  bottom?: number;
};

export default function ComparisonBar({
  academiasSelecionadas,

  onRemover,

  onLimpar,

  onComparar,

  bottom = 88,
}: ComparisonBarProps) {
  if (
    academiasSelecionadas.length ===
    0
  ) {
    return null;
  }

  const podeComparar =
    academiasSelecionadas.length >=
    2;

  return (
    <View
      style={{
        // ========================================================
        // Assim como a navbar inferior, a comparação fica DENTRO
        // do container da tela.
        // ========================================================

        position: 'absolute',

        left: 10,
        right: 10,

        bottom,

        zIndex: 998,

        backgroundColor: '#111111',

        borderWidth: 1,

        borderColor: '#2e2e2e',

        borderRadius: 14,

        paddingHorizontal: 12,

        paddingVertical: 10,

        shadowColor: '#000',

        shadowOffset: {
          width: 0,
          height: 6,
        },

        shadowOpacity: 0.28,

        shadowRadius: 12,

        elevation: 17,
      }}
    >
      <Text
        style={{
          color: '#ffffff',

          fontSize: 13,

          fontWeight: '900',

          marginBottom: 7,
        }}
      >
        Comparação (
        {academiasSelecionadas.length}
        /3)
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={
          false
        }
        contentContainerStyle={{
          gap: 6,

          paddingBottom: 8,
        }}
      >
        {academiasSelecionadas.map(
          (academia) => (
            <View
              key={String(
                academia.id
              )}
              style={{
                maxWidth: 190,

                flexDirection:
                  'row',

                alignItems:
                  'center',

                backgroundColor:
                  '#2b2b2b',

                borderRadius: 999,

                paddingVertical: 5,

                paddingLeft: 9,

                paddingRight: 5,
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  color: '#fff',

                  fontSize: 11,

                  fontWeight:
                    '700',

                  maxWidth: 135,
                }}
              >
                {academia.nome}
              </Text>

              <TouchableOpacity
                onPress={() =>
                  onRemover(
                    academia.id
                  )
                }
                accessibilityLabel={`Remover ${academia.nome} da comparação`}
                style={{
                  width: 23,

                  height: 23,

                  alignItems:
                    'center',

                  justifyContent:
                    'center',

                  marginLeft: 3,
                }}
              >
                <Text
                  style={{
                    color: '#fff',

                    fontSize: 18,

                    lineHeight: 20,

                    fontWeight:
                      '800',
                  }}
                >
                  ×
                </Text>
              </TouchableOpacity>
            </View>
          )
        )}
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',

          justifyContent:
            'flex-end',

          alignItems: 'center',

          gap: 8,
        }}
      >
        <TouchableOpacity
          onPress={onLimpar}
          style={{
            paddingVertical: 8,

            paddingHorizontal: 8,
          }}
        >
          <Text
            style={{
              color: '#fff',

              fontSize: 12,

              fontWeight: '800',
            }}
          >
            Limpar
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onComparar}
          disabled={!podeComparar}
          style={{
            backgroundColor:
              '#f97316',

            borderWidth: 1,

            borderColor:
              '#f97316',

            borderRadius: 7,

            paddingVertical: 9,

            paddingHorizontal: 12,

            opacity:
              podeComparar
                ? 1
                : 0.55,
          }}
        >
          <Text
            style={{
              color: '#000',

              fontSize: 12,

              fontWeight: '900',
            }}
          >
            Comparar agora
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}