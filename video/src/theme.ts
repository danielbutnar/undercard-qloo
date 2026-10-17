// The approved tokens from docs/design-brief.md, so the video looks like the app.
import { loadFont as loadDisplay } from "@remotion/google-fonts/BigShoulders";
import { loadFont as loadBody } from "@remotion/google-fonts/LibreFranklin";

const display = loadDisplay("normal", { weights: ["800"], subsets: ["latin"] });
const body = loadBody("normal", {
  weights: ["400", "600"],
  subsets: ["latin"],
});

export const theme = {
  bg: "#CDB38A", // kraft page
  text: "#1C1611", // black ink
  muted: "#54412F", // worn ink
  accent: "#1F3F8C", // blue second ink: Qloo data
  captionBg: "rgba(28, 22, 17, 0.9)", // ink
  captionText: "#F1E5CD", // on-accent stock
  captionDim: "rgba(241, 229, 205, 0.55)",
  displayFont: display.fontFamily,
  bodyFont: body.fontFamily,
};
