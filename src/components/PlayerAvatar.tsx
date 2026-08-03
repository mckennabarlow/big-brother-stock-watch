import { useState } from "react";
import clsx from "clsx";
import type { Player } from "../types";

interface PlayerAvatarProps {
  player: Player;
  className?: string;
  ringColor?: string;
  square?: boolean;
  evicted?: boolean;
}

export function PlayerAvatar({
  player,
  className,
  ringColor,
  square = false,
  evicted = false,
}: PlayerAvatarProps) {
  const [failed, setFailed] = useState(false);
  const name = player.nickname || player.first_name;

  return (
    <div
      className={clsx(
        "relative shrink-0 overflow-hidden bg-neutral-bg4",
        square ? "rounded-none" : "rounded-full",
        className,
      )}
      style={{ boxShadow: ringColor ? `0 0 0 2px ${ringColor}` : undefined }}
    >
      {failed ? (
        <div className="flex h-full w-full items-center justify-center text-sm font-bold text-text-secondary">
          {name.slice(0, 2).toUpperCase()}
        </div>
      ) : (
        <img
          src={player.image_url}
          alt={`${name} ${player.last_name}`}
          className={clsx(
            "h-full w-full object-cover object-top",
            evicted && "grayscale",
          )}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      )}
      {evicted && (
        <div className="absolute inset-0 bg-neutral-bg1/35">
          <span className="absolute bottom-0.5 right-0.5 rounded-full bg-status-error px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white">
            Out
          </span>
        </div>
      )}
    </div>
  );
}
