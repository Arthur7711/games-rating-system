import type { Tier } from "../types";
import { DropArea } from "./DropArea";
import { DownIcon, GearIcon, UpIcon } from "./icons";

type Props = {
  tier: Tier;
  ids: string[];
  urls: Record<string, string>;
  highlight: boolean;
  onSettings: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDeleteItem: (id: string) => void;
  onHover: (id: string | null) => void;
};

export function TierRow({ tier, ids, urls, highlight, onSettings, onMoveUp, onMoveDown, onDeleteItem, onHover }: Props) {
  return (
    <div className="tier">
      <div className="tier-label" style={{ background: tier.color }} title="Нажмите, чтобы изменить" onClick={onSettings}>
        {tier.label}
      </div>

      <DropArea id={tier.id} ids={ids} urls={urls} highlight={highlight} onDeleteItem={onDeleteItem} onHover={onHover} />

      <div className="tier-controls">
        <button className="icon-btn" title="Настройки" onClick={onSettings}>
          <GearIcon />
        </button>
        <div className="arrows">
          <button className="icon-btn" title="Вверх" onClick={onMoveUp}>
            <UpIcon />
          </button>
          <button className="icon-btn" title="Вниз" onClick={onMoveDown}>
            <DownIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
