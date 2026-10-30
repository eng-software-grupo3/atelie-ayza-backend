export enum StatusPedido {
  EM_ANALISE = 'em_analise',
  RECUSADO = 'recusado',
  ESPERANDO_1_PAG = 'esperando_1_pag',
  EM_PRODUCAO = 'em_producao',
  ESPERANDO_2_PAG = 'esperando_2_pag',
  ENVIADO = 'enviado',
  CONCLUIDO = 'concluido',
  CANCELADO = 'cancelado',
}

export enum ModalidadeFrete {
  PADRAO = 'padrao',
  SEDEX = 'sedex',
}

export enum Tamanho {
  PP = 'PP',
  P = 'P',
  M = 'M',
  G = 'G',
  GG = 'GG',
}
