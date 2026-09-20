import AsyncStorage from '@react-native-async-storage/async-storage';

// ================================================================
// COMPARAÇÃO DE ACADEMIAS
//
// O Web atual guarda no máximo 3 academias selecionadas para
// comparação. No Mobile usamos AsyncStorage apenas para preservar a
// seleção enquanto o usuário navega entre Home, Detalhes e a tela de
// comparação.
// ================================================================

export const COMPARACAO_STORAGE_KEY = 'logym_comparacao_academias';

export type AcademiaSelecionadaComparacao = {
  id: string | number;
  nome: string;
};

function normalizarAcademiasSelecionadas(valor: unknown) {
  if (!Array.isArray(valor)) {
    return [] as AcademiaSelecionadaComparacao[];
  }

  const ids = new Set<string>();

  return valor.reduce<AcademiaSelecionadaComparacao[]>((selecionadas, academia) => {
    if (
      !academia ||
      typeof academia !== 'object' ||
      !('id' in academia) ||
      academia.id === null ||
      academia.id === undefined
    ) {
      return selecionadas;
    }

    const id = String(academia.id);

    if (!id || ids.has(id)) {
      return selecionadas;
    }

    ids.add(id);

    selecionadas.push({
      id: academia.id as string | number,
      nome:
        'nome' in academia && typeof academia.nome === 'string' && academia.nome.trim()
          ? academia.nome.trim()
          : 'Academia selecionada',
    });

    return selecionadas;
  }, []).slice(0, 3);
}

export async function buscarAcademiasSelecionadasComparacao() {
  try {
    const valorSalvo = await AsyncStorage.getItem(COMPARACAO_STORAGE_KEY);

    if (!valorSalvo) {
      return [] as AcademiaSelecionadaComparacao[];
    }

    return normalizarAcademiasSelecionadas(JSON.parse(valorSalvo));
  } catch {
    return [] as AcademiaSelecionadaComparacao[];
  }
}

async function salvarAcademiasSelecionadasComparacao(
  academias: AcademiaSelecionadaComparacao[]
) {
  const normalizadas = normalizarAcademiasSelecionadas(academias);

  await AsyncStorage.setItem(
    COMPARACAO_STORAGE_KEY,
    JSON.stringify(normalizadas)
  );

  return normalizadas;
}

export function academiaEstaSelecionadaParaComparacao(
  academias: AcademiaSelecionadaComparacao[],
  academiaId?: string | number | null
) {
  if (academiaId === null || academiaId === undefined) {
    return false;
  }

  return academias.some(
    (academia) => String(academia.id) === String(academiaId)
  );
}

export async function alternarAcademiaNaComparacao(academia: {
  id: string | number;
  nome?: string;
}) {
  const selecionadas = await buscarAcademiasSelecionadasComparacao();
  const jaSelecionada = academiaEstaSelecionadaParaComparacao(
    selecionadas,
    academia.id
  );

  if (jaSelecionada) {
    const atualizadas = selecionadas.filter(
      (item) => String(item.id) !== String(academia.id)
    );

    return {
      academias: await salvarAcademiasSelecionadasComparacao(atualizadas),
      limiteAtingido: false,
    };
  }

  if (selecionadas.length >= 3) {
    return {
      academias: selecionadas,
      limiteAtingido: true,
    };
  }

  const atualizadas = [
    ...selecionadas,
    {
      id: academia.id,
      nome: academia.nome?.trim() || 'Academia selecionada',
    },
  ];

  return {
    academias: await salvarAcademiasSelecionadasComparacao(atualizadas),
    limiteAtingido: false,
  };
}

export async function removerAcademiaDaComparacao(
  academiaId: string | number
) {
  const selecionadas = await buscarAcademiasSelecionadasComparacao();
  const atualizadas = selecionadas.filter(
    (academia) => String(academia.id) !== String(academiaId)
  );

  return salvarAcademiasSelecionadasComparacao(atualizadas);
}

export async function limparComparacao() {
  await AsyncStorage.removeItem(COMPARACAO_STORAGE_KEY);
  return [] as AcademiaSelecionadaComparacao[];
}
