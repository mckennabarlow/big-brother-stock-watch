// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PlayerAvatar } from "../../src/components/PlayerAvatar";
import type { Player } from "../../src/types";

afterEach(cleanup);

function player(nickname = "Ace"): Player {
  return {
    season: "test",
    player_id: 1,
    first_name: "Alice",
    last_name: "Example",
    nickname,
    slug: "alice",
    status: "active",
    eviction_week: null,
    image_url: "https://example.test/alice.jpg",
  };
}

describe("PlayerAvatar", () => {
  it.each([
    ["Ace", "Ace Example"],
    ["", "Alice Example"],
  ])("uses the preferred name %j in the accessible image name", (nickname, name) => {
    render(<PlayerAvatar player={player(nickname)} />);

    expect(screen.getByRole("img", { name })).toHaveAttribute("alt", name);
  });

  it("switches from the local WebP to the remote image after the first error", () => {
    render(<PlayerAvatar player={player()} />);
    const image = screen.getByRole("img", { name: "Ace Example" });

    expect(image.getAttribute("src")).toContain(
      "players/test/alice.webp",
    );
    fireEvent.error(image);

    expect(screen.getByRole("img", { name: "Ace Example" })).toHaveAttribute(
      "src",
      "https://example.test/alice.jpg",
    );
  });

  it("shows uppercase initials after both image sources fail", () => {
    render(<PlayerAvatar player={player()} />);

    fireEvent.error(screen.getByRole("img", { name: "Ace Example" }));
    fireEvent.error(screen.getByRole("img", { name: "Ace Example" }));

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("AC")).toBeInTheDocument();
  });

  it("applies eviction grayscale unless color preservation is requested", () => {
    const { rerender } = render(
      <PlayerAvatar player={player()} evicted square ringColor="#123456" />,
    );
    let image = screen.getByRole("img", { name: "Ace Example" });

    expect(image).toHaveClass("grayscale");
    expect(image.parentElement).toHaveClass("rounded-none");
    expect(image.parentElement).toHaveStyle({
      boxShadow: "0 0 0 2px #123456",
    });

    rerender(
      <PlayerAvatar
        player={player()}
        evicted
        preserveColor
        square
        ringColor="#123456"
      />,
    );
    image = screen.getByRole("img", { name: "Ace Example" });
    expect(image).not.toHaveClass("grayscale");
  });
});
