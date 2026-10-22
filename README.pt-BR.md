# reels-editor

> Uma skill para agentes que edita **Reels do Instagram** verticais de ponta a ponta: transcrição, cortes de silêncio, color grading S-Log3, rotoscopia, legendas, SFX, mix de música, safe area do Instagram e exportação VBR 2 passes. Feita para o [Claude Code](https://claude.com/claude-code) e o [Remotion](https://www.remotion.dev).

🇺🇸 [Read in English](README.md) · 📘 [Guia detalhado](docs/GUIA.pt-BR.md) · 📘 [Detailed guide (EN)](docs/GUIDE.md)

---

## O que ela faz

Você entrega ao agente o seu material (e, se quiser, B-rolls, um vídeo de referência e uma música). A skill conduz um pipeline testado e mantém você no controle:

1. **Briefing** – faz as perguntas certas antes de começar (objetivo, duração, gancho, @, música…).
2. **Transcreve** com Whisper.cpp (local) e corrige o que o Whisper erra.
3. **Corta** silêncios sem comer o final das palavras e mostra um **plano de cortes** antes de montar qualquer coisa.
4. **Color grading** de **Sony S-Log3 / S-Gamut3.Cine** para Rec.709 com look cinematográfico, cuidando de pele e dentes (conferidos com números, não só no olho).
5. **Limpa a voz** (EQ de lapela + compressão leve, sem denoise destrutivo) e normaliza em −14 LUFS.
6. **Rotoscopia** da pessoa (Apple Vision) para colocar prints, locais ou vídeos de referência *atrás* de você.
7. **Monta no Remotion**: cutaways de B-roll, legendas (2 a 4 palavras, simples, centralizadas), lower thirds, **correções** em tela (quando você falou a palavra errada), SFX e cama de música.
8. **Respeita a safe area do Instagram** em todo texto e gráfico.
9. **Preview em 540p** e, depois, exporta em **H.264 High, VBR 2 passes (12/16 Mbps), GOP fechado, BT.709, AAC 48 kHz, −14 LUFS**.

Tipos de reel cobertos: **talking-head / unboxing / review**, **react reels** (layouts `stack`, `pip` e `cutout`) e **tutoriais com B-roll**.

## Instalação

> Quer ver os requisitos antes? Veja [Requisitos](#requisitos) ou rode `./install.sh --check`.

**Opção A – CLI `skills`**

```bash
npx skills add andrebrito16/skill-reels-editor          # no projeto; use -g para o usuário
```

**Opção B – script instalador (recomendado: ele confere suas ferramentas)**

```bash
git clone https://github.com/andrebrito16/skill-reels-editor.git
cd skill-reels-editor

./install.sh                      # para o seu usuário → ~/.claude/skills/reels-editor
./install.sh --project ~/meus-reels # para um projeto → ~/meus-reels/.claude/skills/reels-editor
./install.sh --link               # link simbólico em vez de cópia (git pull = atualizar)
./install.sh --check              # só verifica os requisitos
./install.sh --uninstall          # remove
```

**Opção C – manual**

```bash
cp -R skills/reels-editor ~/.claude/skills/            # pessoal
# ou
cp -R skills/reels-editor <seu-projeto>/.claude/skills/
```

Depois abra o Claude Code no seu projeto Remotion e rode:

```
/reels-editor
```

ou apenas diga *"edite esse reel com a skill reels-editor"*.

### Prepare o projeto Remotion (uma vez)

```bash
npx create-video@latest          # template em branco com TypeScript
cd meus-reels
npx remotion add @remotion/media
npx remotion add @remotion/google-fonts
npx remotion add @remotion/captions
npx remotion add @remotion/install-whisper-cpp
```

## Requisitos

| Preciso de | Detalhes |
|---|---|
| **Agente** | [Claude Code](https://claude.com/claude-code) (ou qualquer agente que carregue skills `SKILL.md`) |
| **Node.js** | `^20.19`, `^22.13` ou `>=24` (exigência do Remotion 4.0.x) |
| **Projeto Remotion** | Remotion 4.0.x com `@remotion/media`, `@remotion/google-fonts`, `@remotion/captions`, `@remotion/install-whisper-cpp` |
| **FFmpeg + FFprobe** | Build completo com `libx264`, AAC e os filtros `lut3d, loudnorm, alimiter, acompressor, asoftclip, acrusher, aecho, equalizer, highshelf, silencedetect, alphamerge, curves, gblur` (ex.: `brew install ffmpeg`) |
| **Toolchain C** | `make` + compilador C/C++ — o Whisper.cpp é compilado na primeira transcrição (download do modelo `medium`, ≈1,5 GB) |
| **macOS + Swift** *(opcional)* | A rotoscopia usa o Apple Vision (`xcode-select --install`). No Linux/Windows todo o resto funciona; traga seus próprios PNGs com alpha para o roto |
| **Disco** | Conte com dezenas de GB: clipes 4K, ~450 MB de render intermediário a cada ~100 s, PNGs de rotoscopia ≈ 2 MB por frame |

Testado em macOS 26 · Node 24 · FFmpeg 9.0.1 · Remotion 4.0.537 · Swift 6.4. Detalhes completos: [docs/GUIA.pt-BR.md](docs/GUIA.pt-BR.md#2-requisitos).

## O que tem dentro

```
skills/reels-editor/
├── SKILL.md              # regras, padrões e o fluxo de 11 passos (o que o agente lê)
├── references/           # pipeline, react reels, cor, áudio, legendas e safe area, roto, export, armadilhas
├── scripts/              # transcribe · silence-cuts · make-lut · build-master · align-captions · group-captions · roto · encode-instagram · patch
├── templates/remotion/   # Captions, LowerThird, Correction, RotoFrame, SfxMusic, ReactReel, safe area, paleta, fonte
└── examples/             # config, faixas de corte e correções de legenda de um reel real (anonimizado)
install.sh                # instalador + verificador de requisitos
docs/                     # guias detalhados (EN / pt-BR)
```

## Deixe do seu jeito

Os padrões vêm do canal do mantenedor (legendas em português, Sony S-Log3, Montserrat, uma paleta específica). Cada coisa muda em um só lugar:

- Paleta / fonte / safe area → `templates/remotion/palette.ts`, `font.ts`, `safe.ts`
- Look → `scripts/make-lut.mjs` (variáveis: `EXPO`, `CONTRAST`, `SAT`, `SKIN_DESAT`, `WHITES_DESAT`…)
- Preferências aplicadas pelo agente (estilo de legenda, política de SFX, loudness…) → seção **Creator defaults** do `SKILL.md`
- Bitrate / GOP da exportação → `scripts/encode-instagram.sh`

Veja [docs/GUIA.pt-BR.md](docs/GUIA.pt-BR.md#8-personalização).

## Limitações (sem enrolação)

- O agente **não consegue ouvir**: ele confere o áudio com medições de loudness/RMS e diz o que não verificou. Sempre ouça o preview.
- O LUT de cor foi feito para **Sony S-Log3 / S-Gamut3.Cine**. Outras câmeras precisam de outra transformação (ou pule o LUT em material já Rec.709).
- A rotoscopia só roda no macOS por padrão.
- O `ReactReel.tsx` passa no typecheck e está documentado, mas ainda não foi testado a fundo em material real. Feedback é bem-vindo.
- Reutilizar vídeos de outros criadores pode fazer o Instagram silenciar ou limitar o Reel; use trechos curtos, dê crédito e comente.

## Contribuindo

Issues e PRs são bem-vindos — principalmente: LUTs para outras câmeras, rotoscopia fora do macOS (ex.: RVM/SAM2 → PNG com alpha), novos tipos de reel e traduções dos padrões.

## Créditos e licença

Construído sobre [Remotion](https://www.remotion.dev), [whisper.cpp](https://github.com/ggml-org/whisper.cpp), [FFmpeg](https://ffmpeg.org) e o framework Vision da Apple. Fontes: [Montserrat](https://fonts.google.com/specimen/Montserrat) (SIL OFL).

Distribuído sob a [Licença MIT](LICENSE).
