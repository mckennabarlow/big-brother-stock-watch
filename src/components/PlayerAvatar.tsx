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
  const name = player.nickname || player.first_name;
  const localImage = `${import.meta.env.BASE_URL}players/${player.season}/${player.slug}.webp`;
  const [source, setSource] = useState(localImage);
  const [failed, setFailed] = useState(false);

  function handleImageError() {
    if (source === localImage) {
      setSource(player.image_url);
      return;
    }
    setFailed(true);
  }

  return (
    <div
      className={clsx(
        "relative shrink-0 overflow-hidden bg-neutral-bg4",
        square ? "rounded-none" : "rounded-full",
        className,
      )}
      style={{
        boxShadow: evicted
          ? "0 0 0 2px #FB7185"
          : ringColor
            ? `0 0 0 2px ${ringColor}`
            : undefined,
      }}
    >
      {failed ? (
        <div className="flex h-full w-full items-center justify-center text-sm font-bold text-text-secondary">
          {name.slice(0, 2).toUpperCase()}
        </div>
      ) : (
        <img
          src={source}
          alt={`${name} ${player.last_name}`}
          className="h-full w-full object-cover object-top"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={handleImageError}
        />
      )}
    </div>
  );
}
