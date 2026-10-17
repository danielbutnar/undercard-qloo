// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import fixture from "../../fixtures/lineup.synthetic.json";
import { ActCard } from "@/components/act-card";
import type { BuildEvent } from "@/lib/build-events";
import { LineupSchema } from "@/lib/lineup";
import { roomKind } from "@/lib/place-kinds";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { createToolbox } from "@/server/agent-tools";
import { createQlooClient } from "@/server/qloo";
import { createMemoryCache } from "@/server/qloo-cache";
import { fakeFetch, params, syntheticId, syntheticQloo } from "../m2/fake-qloo";

afterEach(cleanup);

const kind = (slug: string) => ({
  id: `urn:tag:category:place:${slug}`,
  name: slug,
  type: "urn:tag:category:place",
});

describe("what kind of place a room is", () => {
  it("names parks, arenas, stadiums and sports grounds, and nothing else", () => {
    expect(roomKind([kind("playground"), kind("park")])).toBe(
      "an outdoor festival site",
    );
    expect(roomKind([kind("arena"), kind("sports_complex")])).toBe("an arena");
    expect(roomKind([kind("stadium"), kind("baseball_field")])).toBe(
      "a stadium",
    );
    expect(roomKind([kind("car_racing_track")])).toBe("a sports ground");
    expect(
      roomKind([
        kind("live_music_bar"),
        kind("beer_garden"),
        kind("concert_hall"),
        kind("museum"),
      ]),
    ).toBeNull();
  });
});

describe("an anchor that isn't a club", () => {
  const { acts } = LineupSchema.parse(fixture);

  it("says so on the act's card", () => {
    const act = {
      ...acts[0],
      anchorVenue: { ...acts[0].anchorVenue, kind: "an outdoor festival site" },
    };
    render(<ActCard act={act} city="Duluth" />);
    expect(
      screen.getByText(
        `${act.anchorVenue.name} is an outdoor festival site, not a club.`,
      ),
    ).toBeTruthy();
  });

  it("says nothing on a club's card", () => {
    render(<ActCard act={acts[0]} />);
    expect(screen.queryByText(/not a club/)).toBeNull();
  });

  it("says so on its trace line, and books the same acts as it would unlabelled", async () => {
    const park = {
      entity_id: syntheticId(201),
      name: "The Lantern Room",
      popularity: 0.8,
      tags: [kind("park"), kind("live_music_venue")],
    };
    // The synthetic Lantern Room, refiled by Qloo as a park: its crowd and its ranking don't change.
    const fake = fakeFetch((url) => {
      const body = syntheticQloo(url) as {
        results?: { entities?: { entity_id: string }[] };
      };
      if (
        params(url)["filter.type"] === "urn:entity:place" &&
        body.results?.entities
      )
        return {
          ...body,
          results: {
            entities: body.results.entities.map((entity) =>
              entity.entity_id === park.entity_id ? park : entity,
            ),
          },
        };
      return body;
    });
    const events: BuildEvent[] = [];
    const toolbox = createToolbox({
      festival: SAGEBRUSH_SOUND,
      qloo: createQlooClient({
        apiKey: "k",
        cache: createMemoryCache(),
        fetch: fake.fetch,
      }),
      emit: (event) => events.push(event),
    });
    await toolbox.run("search_artist", { name: "Khruangbin" });
    await toolbox.run("search_artist", { name: "Japanese Breakfast" });
    await toolbox.run("find_venues", {
      tag_id: "urn:tag:genre:place:live_music_venue",
    });
    await toolbox.run("baseline_artists", { band: "mid" });
    await toolbox.run("venue_artists", {
      band: "mid",
      venue_id: park.entity_id,
    });
    const line = events.flatMap((event) =>
      event.type === "call" && event.call.tool === "venue_artists"
        ? [event.call.summary]
        : [],
    )[0];
    expect(line).toContain("The Lantern Room (an outdoor festival site)");
    expect(toolbox.state.venueRuns[0].venue).toMatchObject({
      entityId: park.entity_id,
      kind: "an outdoor festival site",
    });
  });
});

describe("the label on a whole build", () => {
  it("reaches the act's anchor venue and doesn't change who's booked", async () => {
    const { handleUndercardBuild } = await import("@/server/undercard-build");
    const { createBuildStore } = await import("@/server/build-store");
    const { createMemoryLimiter } = await import("@/server/rate-limit");
    const { readEvents, scriptedPlanner } = await import("../m3/scripted");
    const lantern = syntheticId(201);
    async function lineupWith(route: (url: URL) => unknown) {
      const cache = createMemoryCache();
      const events = await readEvents(
        await handleUndercardBuild({
          festival: SAGEBRUSH_SOUND,
          limiter: createMemoryLimiter(),
          ip: "203.0.113.7",
          qloo: () =>
            createQlooClient({
              apiKey: "k",
              cache,
              fetch: fakeFetch(route).fetch,
            }),
          model: () => scriptedPlanner().model,
          store: createBuildStore(cache),
          fresh: true,
        }),
      );
      const lineup = events.find((event) => event.type === "lineup");
      return lineup?.type === "lineup" ? lineup.lineup.acts : [];
    }
    const plain = await lineupWith(syntheticQloo);
    const asPark = await lineupWith((url) => {
      const body = syntheticQloo(url) as {
        results?: { entities?: { entity_id: string; tags?: unknown[] }[] };
      };
      if (
        params(url)["filter.type"] === "urn:entity:place" &&
        body.results?.entities
      )
        return {
          ...body,
          results: {
            entities: body.results.entities.map((entity) =>
              entity.entity_id === lantern
                ? { ...entity, tags: [...(entity.tags ?? []), kind("park")] }
                : entity,
            ),
          },
        };
      return body;
    });
    expect(plain.length).toBeGreaterThan(0);
    expect(asPark.map((act) => act.entityId)).toEqual(
      plain.map((act) => act.entityId),
    );
    const atLantern = asPark.filter(
      (act) => act.anchorVenue.entityId === lantern,
    );
    expect(atLantern.length).toBeGreaterThan(0);
    expect(
      atLantern.every(
        (act) => act.anchorVenue.kind === "an outdoor festival site",
      ),
    ).toBe(true);
    expect(plain.every((act) => act.anchorVenue.kind === undefined)).toBe(true);
  });
});
