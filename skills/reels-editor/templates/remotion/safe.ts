// Safe area para Instagram Reels/Feed (1080x1920): a interface do app cobre o topo,
// a base (legenda/botões) e a lateral direita (curtir, comentar...), e o grid do perfil
// recorta a parte central. Todo texto/gráfico fica dentro desta área.
export const SAFE = {
  top: 300,
  bottom: 480, // folga a partir da base (texto termina em y = 1440)
  side: 130, // simétrico (igual à margem dos ícones do lado direito) para manter tudo centrado em x=540
} as const;
