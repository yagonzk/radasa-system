/**
 * Perfis de recorte das CNH-e emitidas em PDF pela CDT/SENATRAN.
 * Coordenadas relativas à página inteira [x1, y1, x2, y2].
 * Os recortes não incluem QR Code, fotografia, filiação nem assinatura.
 * Para novas emissões, acrescente um perfil sem substituir os anteriores.
 */
export type CnhRegiao = readonly [number, number, number, number];
export type CnhPerfil = {
  id: "cnh-e-atual" | "cnh-e-verde";
  nome: string;
  regioes: Readonly<Record<string, CnhRegiao>>;
};

export const PERFIL_CNH_ATUAL: CnhPerfil = {
  id: "cnh-e-atual",
  nome: "CNH-e digital (modelo atual)",
  regioes: {
    nome: [0.122, 0.129, 0.375, 0.142],
    primeiraHabilitacao: [0.381, 0.131, 0.448, 0.142],
    dataNascimento: [0.239, 0.149, 0.441, 0.159],
    cnhEmissao: [0.237, 0.167, 0.297, 0.175],
    cnhValidade: [0.308, 0.167, 0.369, 0.175],
    rg: [0.238, 0.184, 0.440, 0.192],
    cpf: [0.238, 0.196, 0.314, 0.211],
    cnhRegistro: [0.314, 0.195, 0.390, 0.210],
    cnhCategoria: [0.399, 0.196, 0.454, 0.211],
  },
};

export const PERFIL_CNH_VERDE: CnhPerfil = {
  id: "cnh-e-verde",
  nome: "CNH-e digital (modelo verde anterior)",
  regioes: {
    // Frente do documento verde, à esquerda do QR Code.
    nome: [0.112, 0.126, 0.436, 0.138],
    rg: [0.251, 0.145, 0.436, 0.158],
    cpf: [0.251, 0.164, 0.358, 0.180],
    dataNascimento: [0.359, 0.164, 0.435, 0.180],
    cnhCategoria: [0.388, 0.240, 0.436, 0.256],
    cnhRegistro: [0.111, 0.261, 0.250, 0.277],
    cnhValidade: [0.251, 0.261, 0.339, 0.277],
    primeiraHabilitacao: [0.339, 0.261, 0.435, 0.277],
    // Verso verde, dentro da mesma página, abaixo da assinatura.
    // Campo DATA EMISSÃO fica na parte inferior direita do verso verde.
    // Margem mais justa, preservando todos os dígitos e evitando o QR Code.
    cnhEmissao: [0.339, 0.412, 0.431, 0.423],
  },
};

/** Identificação sem OCR: examina somente o fundo verde do documento antigo. */
export function identificarPerfilCnh(canvas: HTMLCanvasElement): CnhPerfil {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return PERFIL_CNH_ATUAL;
  const probes: ReadonlyArray<readonly [number, number]> = [
    [0.26, 0.285], [0.30, 0.30], [0.34, 0.315], [0.36, 0.335],
    [0.22, 0.352], [0.29, 0.34],
  ];
  let greenHits = 0;
  for (const [x, y] of probes) {
    const pixel = context.getImageData(
      Math.min(canvas.width - 1, Math.max(0, Math.floor(x * canvas.width))),
      Math.min(canvas.height - 1, Math.max(0, Math.floor(y * canvas.height))),
      1, 1,
    ).data;
    if (pixel[1] >= 165 && pixel[1] > pixel[0] + 15 && pixel[1] > pixel[2] + 23) greenHits++;
  }
  return greenHits >= 3 ? PERFIL_CNH_VERDE : PERFIL_CNH_ATUAL;
}
