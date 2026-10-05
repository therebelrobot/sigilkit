import { useDialog, useInventory, useUi, useVerbs, useWorld } from "sigilkit/react";
import "@fontsource/silkscreen";
import "./ui.css";

/*
 * A SCUMM-style interface built from sigilkit's hooks: a sentence line, a grid
 * of verbs, and inventory slots. Spoken lines appear over the speakers' heads
 * (<Stage overheadSpeech />), so there's no dialog box.
 */

const VERB_LABELS: Record<string, string> = { walk: "Walk to", look: "Look at", use: "Use", talk: "Talk to", take: "Pick up" };
const ITEM_ICONS: Record<string, string> = { can: "🪣" };

export function ClassicUi() {
  return (
    <div className="classic-ui">
      <Choices />
      <Sentence />
      <div className="classic-panel">
        <Verbs />
        <Inventory />
      </div>
    </div>
  );
}

function Sentence() {
  const world = useWorld();
  const { verb, hover, heldItem, busy } = useUi();
  const item = heldItem ? world.game.items?.[heldItem]?.name : null;
  const action = item ? `Use ${item} with` : (VERB_LABELS[verb] ?? verb);
  return <p className="classic-sentence">{busy ? " " : `${action} ${hover ?? ""}`}</p>;
}

function Verbs() {
  const { verbs, verb, setVerb } = useVerbs();
  return (
    <div className="classic-verbs" role="toolbar" aria-label="Verbs">
      {verbs.map((verbId) => (
        <button type="button" key={verbId} aria-pressed={verbId === verb} onClick={() => setVerb(verbId)}>
          {VERB_LABELS[verbId] ?? verbId}
        </button>
      ))}
    </div>
  );
}

function Inventory() {
  const { items, held, hold } = useInventory();
  const slots = Array.from({ length: 4 }, (_, index) => items[index]);
  return (
    <div className="classic-inventory" role="toolbar" aria-label="Inventory">
      {slots.map((item, index) =>
        item ? (
          <button type="button" key={item.id} title={item.name} aria-pressed={held === item.id} onClick={() => hold(held === item.id ? null : item.id)}>
            <span aria-hidden="true">{ITEM_ICONS[item.icon] ?? "?"}</span>
            <span className="visually-hidden">{item.name}</span>
          </button>
        ) : (
          <span key={`empty-${index}`} className="classic-slot" />
        ),
      )}
    </div>
  );
}

/** Dialog choices, numbered like the old games. */
function Choices() {
  const { choices, choose } = useDialog();
  const { choiceIndex } = useUi();
  if (!choices.length) return null;
  return (
    <ol className="classic-choices">
      {choices.map((choice, index) => (
        <li key={choice.index}>
          <button type="button" aria-current={index === choiceIndex || undefined} onClick={() => choose(choice.index)}>
            {choice.text}
          </button>
        </li>
      ))}
    </ol>
  );
}
