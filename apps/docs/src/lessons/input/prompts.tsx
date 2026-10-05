import { inputMode, type InputMode } from "sigilkit/input";
import { useUi } from "sigilkit/react";
import { useSyncExternalStore } from "react";

/** Button names per device, so prompts match whatever the player last touched. */
const GLYPHS: Record<InputMode, { act: string; look: string; cycle: string; hum: string }> = {
  keyboard: { act: "Enter", look: "L", cycle: "[ ]", hum: "H" },
  gamepad: { act: "Ⓐ", look: "Ⓧ", cycle: "LB RB", hum: "Ⓨ" },
  pointer: { act: "Click", look: "Right-click", cycle: "", hum: "" },
};

export function Prompts() {
  const { mode } = useSyncExternalStore(inputMode.subscribe, inputMode.get, inputMode.get);
  const { focus } = useUi();
  const glyphs = GLYPHS[mode];
  return (
    <p className="input-prompts">
      <span className="input-mode">{mode}</span>
      {mode === "pointer" ? (
        <span>Click to walk and act; right-click or long-press for verbs. Press a key or a pad button to switch.</span>
      ) : (
        <span>
          <kbd>{glyphs.act}</kbd> {focus ? `use ${focus}` : "act"} · <kbd>{glyphs.look}</kbd> look · <kbd>{glyphs.cycle}</kbd> next target ·{" "}
          <kbd>{glyphs.hum}</kbd> hum
        </span>
      )}
    </p>
  );
}
