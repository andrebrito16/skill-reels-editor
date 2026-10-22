import { loadFont } from "@remotion/google-fonts/Montserrat";

// Montserrat ExtraBold: cobre acentos do português e símbolos como @ e _
export const { fontFamily: UI_FONT } = loadFont("normal", {
  weights: ["800"],
  subsets: ["latin", "latin-ext"],
});
