import type { ReactNode } from "react";
import { openMenu } from "../core/state";
import type { MenuItem } from "../core/view";
import { Btn, Chip, I, Tile } from "./controls";
import type { IconName } from "./icons";

export function RowMenu({
  items,
  label = "Row actions",
}: {
  items: MenuItem[];
  label?: string;
}) {
  return (
    <Btn
      v="muted-ghost"
      sm
      icon
      i="ellipsis"
      aria-label={label}
      onClick={(event) => openMenu(event, items)}
    />
  );
}

export function Source({
  children,
  live,
}: {
  children?: ReactNode;
  live?: boolean;
}) {
  return (
    <div className="source">
      {live ? (
        <Chip k="success" dot>
          Live
        </Chip>
      ) : (
        <I n="clock" s={13} />
      )}
      {children}
    </div>
  );
}

export function Row({
  icon,
  tone,
  title,
  sub,
  end,
  onClick,
  children,
}: {
  icon?: IconName;
  tone?: string;
  title: ReactNode;
  sub?: ReactNode;
  end?: ReactNode;
  onClick?: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      className="row"
      onClick={onClick}
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      {icon && <Tile i={icon} tone={tone} sm plain={!tone} />}
      <div className="row-main">
        <div className="row-title">{title}</div>
        {sub && <div className="row-sub">{sub}</div>}
      </div>
      {children}
      {end && <div className="row-end">{end}</div>}
    </div>
  );
}
