# reels-editor — guia detalhado

🇺🇸 [English version](GUIDE.md) · ← [Voltar ao README](../README.pt-BR.md)

**Sumário**
1. [Visão geral](#1-visão-geral)
2. [Requisitos](#2-requisitos)
3. [Instalação](#3-instalação)
4. [Prepare seu projeto](#4-prepare-seu-projeto)
5. [Como funciona](#5-como-funciona)
6. [Como usar](#6-como-usar)
7. [Scripts e templates](#7-scripts-e-templates)
8. [Personalização](#8-personalização)
9. [Solução de problemas](#9-solução-de-problemas)
10. [Privacidade, licenças e limites](#10-privacidade-licenças-e-limites)
11. [Contribuindo](#11-contribuindo)

---

## 1. Visão geral

`reels-editor` é uma **skill**: uma pasta com um `SKILL.md` (as instruções que o agente lê), documentos de referência, scripts auxiliares e templates Remotion. Quando você pede ao Claude Code para editar um reel, ele carrega a skill e segue sempre o mesmo fluxo disciplinado:

- **Planejar antes de editar.** Ele analisa o material, transcreve e apresenta um plano de cortes com as dúvidas em aberto antes de montar qualquer coisa.
- **Preview antes do final.** Um preview em 540p com uma folha de contato dos quadros-chave; o render final só quando você pedir.
- **Medir, não chutar.** Um agente não assiste nem ouve em tempo real; por isso ele confere loudness (`ebur128`), cor de pele e dentes (Lab/HSV), centralização do texto (varredura de pixels) e diz o que *não* conseguiu verificar.
- **Pronto para o Instagram.** Gráficos respeitando a safe area e exportação H.264 VBR 2 passes.

A skill foi extraída de projetos reais de reels e guarda as lições aprendidas em `references/pitfalls.md`.

## 2. Requisitos

### 2.1 Resumo

| Componente | Obrigatório? | Versão / observações |
|---|---|---|
| Claude Code (ou outro agente que carregue skills `SKILL.md`) | **Sim** | Skills ficam em `~/.claude/skills/` ou `<projeto>/.claude/skills/` |
| Node.js | **Sim** | `^20.19.0 \|\| ^22.13.0 \|\| >=24` |
| Um projeto Remotion | **Sim** | Remotion **4.0.x** (testado na 4.0.537) |
| `@remotion/media`, `@remotion/google-fonts`, `@remotion/captions`, `@remotion/install-whisper-cpp` | **Sim** | Mesma versão do `remotion`. O `@remotion/media` pode vir de carona, mas o template em branco **não** o declara — adicione explicitamente |
| FFmpeg + FFprobe | **Sim** | Build completo, testado na 9.0.1. Precisa de `libx264`, `aac` e dos filtros: `lut3d loudnorm alimiter acompressor asoftclip acrusher aecho equalizer highshelf silencedetect alphamerge curves gblur` |
| Toolchain C (`make`, `cc`) | **Sim** (para transcrever) | O Whisper.cpp 1.6.0 é compilado no primeiro uso |
| Internet (primeiros usos) | **Sim** | Modelo do Whisper (`medium` ≈ 1,5 GB), Chrome headless do Remotion, Google Fonts no render |
| macOS + Swift (Xcode Command Line Tools) | Opcional | Rotoscopia via Apple Vision (`scripts/roto.sh`). Testado no macOS 26 / Swift 6.4 |
| Bun ou npm | Recomendado | Para rodar o Remotion e os atalhos `reel:*` |
| Espaço em disco | — | Dezenas de GB: clipes 4K; ≈ 450 MB de render intermediário a cada ~100 s; PNGs de roto ≈ 2 MB/frame (só os segundos que usam roto) |

### 2.2 Instalando as ferramentas

**macOS**
```bash
xcode-select --install          # compilador + Swift (roto)
brew install node ffmpeg        # ou use fnm/nvm para o Node
```

**Ubuntu / Debian**
```bash
sudo apt update
sudo apt install ffmpeg build-essential git
# Node 20.19+/22.13+/24: use https://github.com/Schniz/fnm ou nvm
```
A rotoscopia (`roto.sh`) não roda; veja [Personalização → rotoscopia sem macOS](#rotoscopia-sem-macos).

**Windows** — use o **WSL2** (Ubuntu) e siga os passos do Ubuntu. Rode o Claude Code dentro do WSL.

### 2.3 Verificar

```bash
./install.sh --check
```

Ele confirma a versão do Node, encoders/filtros do FFmpeg, Swift (opcional), o gerenciador de pacotes, a toolchain C e — com `--project <pasta>` — os pacotes Remotion que faltam no seu projeto.

### 2.4 Premissas sobre o material gravado

- A transformação de cor mira **Sony S-Log3 / S-Gamut3.Cine**. Para material Rec.709 (celular, vídeos de referência) pule o LUT. Para outras câmeras log adapte o `scripts/make-lut.mjs` (veja [Personalização](#8-personalização)).
- Arquivos de câmera com **tag de rotação** são tratados (o FFmpeg gira sozinho). Confira com um único frame antes de planejar recortes.
- Áudio: funciona com qualquer microfone; os padrões assumem **lapela** e **safety track** no canal 2 (usa-se o canal 1; o canal 2 é reserva).

## 3. Instalação

Escolha **uma**:

### A. CLI `skills`
```bash
npx skills add andrebrito16/skill-reels-editor
```
Siga as perguntas da CLI (global ou projeto). Veja a documentação dela para as opções.

### B. Script instalador (recomendado)
```bash
git clone https://github.com/andrebrito16/skill-reels-editor.git
cd skill-reels-editor
./install.sh                         # → ~/.claude/skills/reels-editor
./install.sh --project ~/meus-reels  # → ~/meus-reels/.claude/skills/reels-editor
./install.sh --link                  # link simbólico: `git pull` atualiza a skill
./install.sh --check                 # só os requisitos
./install.sh --uninstall [--project PASTA]
./install.sh --force                 # instala mesmo faltando ferramenta obrigatória
```
`CLAUDE_HOME=/caminho ./install.sh` instala em `/caminho/skills/` (útil para testes ou setups fora do padrão).

### C. Manual
Copie `skills/reels-editor/` para `~/.claude/skills/` (todos os projetos) ou `<projeto>/.claude/skills/` (um projeto). Alguns setups mantêm as skills em `.agents/skills/` com `.claude/skills` como link simbólico — ambos funcionam.

### Conferir se carregou
Abra o Claude Code no projeto e digite `/reels-editor` (ou abra a lista de skills). Atualizar = `git pull` + reinstalar (ou nada, se usou `--link`).

## 4. Prepare seu projeto

```bash
npx create-video@latest            # escolha o template em branco com TypeScript
cd meus-reels
npx remotion add @remotion/media
npx remotion add @remotion/google-fonts
npx remotion add @remotion/captions
npx remotion add @remotion/install-whisper-cpp
```

Estrutura sugerida (a skill usa essas convenções):

```
meus-reels/
├─ public/                  # o que o Remotion serve: master.mp4, music.mp3, sfx/, roto/, brolls/, imagens
├─ src/<NomeDoReel>/        # sua composição (copiada dos templates) + data/captions.ts, timeline.ts
├─ <nome-do-reel>/
│  ├─ assets/{clips,brolls,images}   # material bruto — nunca é modificado
│  └─ work/                 # wavs, transcrições, cuts.json, LUTs, segmentos renderizados, máscaras, frames de teste
└─ out/                     # preview, intermediário e exportações finais
```

Notas
- O `tsconfig` do template usa `lib: ["es2015"]`; os templates da skill evitam APIs mais novas (`padStart`, `flatMap`).
- `Config.setVideoImageFormat("jpeg")` serve para previews; o render final usa `--jpeg-quality=100`.
- Coloque `out/`, `public/roto/`, `public/master.mp4`, `whisper.cpp/` e `*/work/` no `.gitignore`.

## 5. Como funciona

O agente segue 11 passos (detalhes em `references/pipeline.md`):

| # | Passo | O que acontece |
|---|---|---|
| 0 | **Briefing** | Pergunta: objetivo, CTA, duração-alvo, qual clipe é o principal/B-roll, materiais extras, música, @, idioma, algo dito errado, ideia de gancho |
| 1 | **Análise** | `ffprobe` (rotação, fps, canais) + níveis de áudio |
| 2 | **Transcrição** | Extrai áudio mono 16 kHz → Whisper.cpp (local). Retranscreve trechos amplificados onde o Whisper falha; confere o RMS para achar onde há fala de verdade; detecta instruções ditas ao editor e textos alucinados |
| 3 | **Plano de cortes** | `silence-cuts.mjs` (−40 dB, ≥ 0,3 s, margem de entrada 0,09 s / saída 0,15 s) + montagem manual para cenas de ação sem fala. **Você aprova o plano antes** |
| 4 | **Cor** | `make-lut.mjs` gera um `.cube` 65³: S-Log3 → S-Gamut3.Cine → Rec.709, ombro filmico, curva em S, split-toning, tratamento seletivo de pele / dentes / parede magenta. 3–4 frames de teste + checagem numérica |
| 5 | **Master** | `build-master.mjs`: cor + cadeia de voz por segmento, concat, `loudnorm` em dois passos → `public/master.mp4` + `timeline.json` |
| 6 | **Legendas** | Transcreve o **master** (os tempos batem com o corte final) → `group-captions.mjs` gera páginas de 2–4 palavras, com correções de nomes, falas retemporizadas e zonas sem legenda |
| 7 | **Rotoscopia** | Só nos segundos que precisam (gráfico atrás de você, local atrás de você, cutout do react) |
| 8 | **Composição** | Remotion: vídeo base, camadas de roto, cutaways de B-roll, legendas, lower third, título de correção, SFX, cama de música |
| 9 | **Preview** | Render 540p, folha de contato de ~16 frames, loudness, duração vs. alvo; você revisa |
| 10 | **Final** | Intermediário de alta qualidade → `encode-instagram.sh` (VBR 2 passes) |

### Padrões aplicados pela skill
- **Formato:** 1080×1920, 30 fps.
- **Safe area:** textos/gráficos dentro de x ∈ [130, 950], y ∈ [300, 1440] (topo 300 px, base 480 px, laterais simétricas de 130 px) para tudo ficar centralizado em x = 540.
- **Legendas:** 2–4 palavras, caixa mista, ~54 px Montserrat ExtraBold, branca com contorno escuro, **sem animação, sem emoji, sem cor por palavra**; nenhuma em momentos mudos ou de efeito.
- **Áudio:** voz em −14 LUFS; cama de música ≈ −27 LUFS com leve subida quando ninguém fala e fade-out de 3 s; SFX só em transições/gráficos, nunca em cenas de manuseio; true peak ≤ −1,5 dBFS.
- **Correções:** palavra errada na câmera → título em tela, não corte.
- **Cores:** saturação da bochecha ≈ 0,35–0,55 e b\* dos dentes (Lab) ≈ 20–30 (conferidos com `scripts/patch.mjs`).
- **Exportação:** H.264 High L4.2, alvo de 12 Mbps / máx. 16 Mbps, 2 passes, GOP fechado a cada 2 s, BT.709, AAC-LC 256 kbps 48 kHz.

## 6. Como usar

Abra o Claude Code no seu projeto Remotion.

**Talking-head / unboxing**
> `/reels-editor` — Edite o clipe de `meu-reel/assets/clips/` num reel 9:16. O material é S-Log3. Use os B-rolls de `assets/brolls/`, mostre o print `assets/images/comentario.png` atrás de mim na intro, alvo de ~1:15. Mostre o plano primeiro.

**React reel**
> Faça um react reel: eu reagindo a `referencia.mp4` (crédito `@criador_original`), layout `stack`, pause nos quadros mais engraçados e comente. Mantenha os trechos curtos.

**Iterando**
> "As legendas estão grandes." · "Minha pele está muito vermelha." · "Tire os SFX do unboxing." · "Coloque uma correção: falei Y, é L." · "Renderize o final."

O agente deve responder no seu idioma, perguntar antes de supor e sempre dizer o que verificou e o que não verificou.

## 7. Scripts e templates

Rode da raiz do projeto. `S=.claude/skills/reels-editor`.

| Script | Para quê | Exemplo |
|---|---|---|
| `transcribe.mjs` | Whisper.cpp → JSON com tempo por palavra | `node $S/scripts/transcribe.mjs work/a.wav work/captions.json --lang pt --model medium` |
| `silence-cuts.mjs` | Trechos de fala sem pausas | `node $S/scripts/silence-cuts.mjs --wav work/a.wav --ranges work/ranges.json --out work/cuts.json` |
| `make-lut.mjs` | Gera o LUT de cor `.cube` | `node $S/scripts/make-lut.mjs work/lut/grade.cube` · `… grade_bw.cube --bw` |
| `build-master.mjs` | Master com cor + cortes + áudio, a partir de um JSON | `node $S/scripts/build-master.mjs work/reel.config.json [--reuse]` |
| `align-captions.mjs` | Realinha os tempos do Whisper pela energia do áudio (o Whisper erra até ~0,4 s) | `node $S/scripts/align-captions.mjs work/master.mp4 work/captions-master.json work/captions-aligned.json` |
| `group-captions.mjs` | Palavras → páginas de legenda de 2–4 palavras (`.ts`) | `node $S/scripts/group-captions.mjs --words work/captions-aligned.json --fixes work/fixes.json --out src/MeuReel/data/captions.ts` |
| `roto.sh` | Recorte da pessoa → PNG com alpha (macOS) | `bash $S/scripts/roto.sh public/master.mp4 0 6 public/roto` (`REMERGE=1` reaproveita as máscaras) |
| `patch.mjs` | Cor de um trecho de pixels (RGB/Lab/HSV) | `node $S/scripts/patch.mjs frame.png 440 900 40 40` |
| `encode-instagram.sh` | Exportação Instagram VBR 2 passes | `bash $S/scripts/encode-instagram.sh out/intermediate.mp4 out/reel.mp4` |

Templates (`templates/remotion/`, copie para `src/<NomeDoReel>/`): `Captions`, `LowerThird`, `Correction`, `RotoFrame`, `SfxMusic` (lista de SFX + cama de música), `ReactReel`, além de `safe.ts`, `palette.ts` e `font.ts`. A pasta `examples/` guarda a config, as faixas de corte e as correções de legenda reais do projeto de origem.

## 8. Personalização

| O quê | Onde |
|---|---|
| Paleta da marca | `templates/remotion/palette.ts` |
| Fonte de legenda / UI | `templates/remotion/font.ts` (usa `@remotion/google-fonts`; troque a Montserrat por qualquer fonte com os glifos do seu idioma) |
| Safe area | `templates/remotion/safe.ts` |
| Visual da legenda | `templates/remotion/Captions.tsx` |
| Look de cor | `scripts/make-lut.mjs` — variáveis: `EXPO`, `CONTRAST`, `SAT`, `SKIN_DESAT`, `SKIN_HUE`, `WHITES_DESAT`; ex.: `SKIN_DESAT=0.3 node make-lut.mjs saida.cube` |
| Idioma / modelo do Whisper | `transcribe.mjs --lang en --model small` (use modelos multilíngues, não `*.en`, fora do inglês) |
| Cadeias de voz / megafone | `"filters"` no `reel.config.json` |
| Bitrate / GOP da exportação | `scripts/encode-instagram.sh` |
| Preferências seguidas pelo agente | Seção **Creator defaults** do `SKILL.md` — reescreva para o seu canal (estilo de legenda, política de SFX, loudness, hábitos de duração) |

### Outras câmeras
O `make-lut.mjs` decodifica o S-Log3 com a fórmula oficial e converte S-Gamut3.Cine → Rec.709 com uma matriz 3×3. Para outra câmera troque `slog3ToLinear` e a matriz `M` (ex.: Canon C-Log3 / Cinema Gamut, Panasonic V-Log / V-Gamut) e mantenha o resto do pipeline de look. Ou aponte `lut` na config para o `.cube` oficial do fabricante.

### Rotoscopia sem macOS
Qualquer ferramenta que gere **frames PNG com alpha** chamados `p_00000.png…` (numerados desde o início do master) funciona: Robust Video Matting, SAM 2, Magic Mask do DaVinci etc. Coloque em `public/roto/` e use o `RotoFrame`.

## 9. Solução de problemas

| Sintoma | Causa / solução |
|---|---|
| `install.sh` diz que o FFmpeg não tem filtros | Instale um build completo (`brew install ffmpeg`, `apt install ffmpeg`) |
| A compilação do Whisper falha | Instale a toolchain C (`xcode-select --install` / `build-essential`) |
| A transcrição perde palavras ou inventa texto em trechos baixos/ruidosos | Esperado no Whisper; a skill retranscreve trechos amplificados e confere o RMS. Grafia de nomes próprios: pergunte ao usuário |
| A pessoa recortada (roto) não aparece | O `<Img>` precisa estar dentro de `<AbsoluteFill>` (o template `RotoFrame` já faz isso). WebM com alpha **não** funciona — use PNG |
| Legendas com glifos errados | A fonte não tem acentos/símbolos — use Montserrat ou outra fonte latina completa |
| O render está "macio" | O render final precisa de `--jpeg-quality=100` |
| Picos acima de 0 dBFS no render | Sempre passe pelo `encode-instagram.sh` (loudnorm + limitador) |
| Erros de typecheck em `padStart` / `flatMap` | O `lib` é ES2015 no template; use os padrões dos templates |
| Um render em segundo plano "terminou" na hora | Marcador antigo no log; limpe o log antes de começar ou renderize em primeiro plano |
| Opções do ffmpeg guardadas em variável não funcionam no zsh | O zsh não separa palavras; use os scripts fornecidos (arrays do bash) |
| Cores diferentes entre camadas após mudar o grade | Refaça na ordem: LUT → master → B-rolls graduados → PNGs de roto (`REMERGE=1`) → render → encode |

Mais em `skills/reels-editor/references/pitfalls.md`.

## 10. Privacidade, licenças e limites

- **Local por padrão.** Transcrição, cor, rotoscopia e codificação rodam na sua máquina. Uso de rede: instalação de pacotes, download do modelo do Whisper, download do Chrome do Remotion, Google Fonts no render e (opcionalmente) SFX gratuitos do `remotion.media`, que você pode copiar para `public/sfx/` para renderizar offline.
- **O agente não ouve.** Sempre escute o preview.
- **Música e material de terceiros:** a responsabilidade pelas licenças é sua. O Instagram pode silenciar ou limitar Reels que reutilizam conteúdo de outros criadores ou músicas sem licença.
- Os exemplos da skill vêm de um reel real (anonimizados); troque pelos seus.
- Licença MIT (veja `LICENSE`).

## 11. Contribuindo

Ideias: LUTs para outras câmeras, rotoscopia fora do macOS, presets de exportação para YouTube Shorts / TikTok, novos tipos de reel (cortes de podcast, carrossel-para-vídeo, demos de produto), traduções dos padrões. Abra uma issue antes de mudanças grandes; mantenha os scripts leves em dependências (built-ins do Node + FFmpeg).
