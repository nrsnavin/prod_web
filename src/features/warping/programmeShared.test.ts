import { describe, it, expect } from "vitest";
import { elasticNames } from "./programmeShared";

describe("elasticNames", () => {
  it("returns populated elastic names", () => {
    expect(
      elasticNames([
        { elastic: { _id: "e1", name: "E-100" }, quantity: 10 },
        { elastic: { _id: "e2", name: "E-200" }, quantity: 20 },
      ])
    ).toEqual(["E-100", "E-200"]);
  });

  it("drops unpopulated placeholders (regression: column showed —)", () => {
    // Before the list endpoints populated `elastic`, lines carried a bare
    // id string, which elasticLineName renders as an em dash.
    expect(elasticNames([{ elastic: "rawid", quantity: 10 }])).toEqual([]);
    expect(elasticNames([{ elastic: null, quantity: 10 }])).toEqual([]);
  });

  it("handles missing/empty input", () => {
    expect(elasticNames(undefined)).toEqual([]);
    expect(elasticNames([])).toEqual([]);
  });
});

// ── Tapes on a programme ──────────────────────────────────────────────
// A plan often runs one build several times over. Printed flat, the
// warper cannot see where one tape ends and the next begins — which is
// the whole reason for numbering them.
import { groupBeamsByTape, beamElasticName } from "./programmeShared";

const beam = (beamNo: number, tapeNo: number | null = null) => ({ beamNo, tapeNo });

describe("groupBeamsByTape", () => {
  it("splits beams into their tapes, in order", () => {
    const groups = groupBeamsByTape([
      beam(1, 1), beam(2, 1), beam(3, 2), beam(4, 2),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].tapeNo).toBe(1);
    expect(groups[0].beams.map((b) => b.beamNo)).toEqual([1, 2]);
    expect(groups[1].beams.map((b) => b.beamNo)).toEqual([3, 4]);
  });

  it("prints an untaped plan exactly as before — one untitled group", () => {
    // An old plan must not grow a heading that says nothing.
    const groups = groupBeamsByTape([beam(1), beam(2)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].tapeNo).toBeNull();
    expect(groups[0].beams).toHaveLength(2);
  });

  it("gives nothing for no beams", () => {
    expect(groupBeamsByTape([])).toEqual([]);
  });

  it("keeps a hand-added beam apart from the taped ones", () => {
    const groups = groupBeamsByTape([beam(1, 1), beam(2, 1), beam(3, null)]);
    expect(groups.map((g) => g.tapeNo)).toEqual([1, null]);
    expect(groups[1].beams.map((b) => b.beamNo)).toEqual([3]);
  });

  it("opens a new group when a tape reappears later", () => {
    // The sheet is read in the order the beams are built, so a tape that
    // comes back does not jump backwards into its earlier group.
    const groups = groupBeamsByTape([beam(1, 1), beam(2, 2), beam(3, 1)]);
    expect(groups.map((g) => g.tapeNo)).toEqual([1, 2, 1]);
  });
});

describe("beamElasticName", () => {
  it("reads a populated elastic and ignores a bare id", () => {
    expect(beamElasticName({ elastic: { _id: "e1", name: "20mm" } })).toBe("20mm");
    expect(beamElasticName({ elastic: "e1" })).toBe("");
    expect(beamElasticName({ elastic: null })).toBe("");
    expect(beamElasticName({})).toBe("");
  });
});
