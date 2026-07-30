import { describe, it, expect } from "vitest";
import { combineBeams, separateBeam, totalEnds, BeamValues } from "./beamCombine";

const beam = (sections: Array<[string, number]>, over: Partial<BeamValues> = {}): BeamValues => ({
  sections: sections.map(([warpYarn, ends]) => ({ warpYarn, ends, maxMeters: 1000 })),
  ...over,
});

describe("combineBeams", () => {
  it("gives both beams every section from both, with the ends halved", () => {
    const [a, b] = combineBeams([beam([["y1", 400]]), beam([["y2", 200]])], 0, 1);

    // Combining runs the two beams together: each carries the full pattern.
    expect(a.sections).toHaveLength(2);
    expect(b.sections).toHaveLength(2);
    expect(a.sections.map((s) => s.ends)).toEqual([200, 100]);
    expect(b.sections.map((s) => s.ends)).toEqual([200, 100]);
  });

  it("preserves the yarn and length of every section", () => {
    const [a] = combineBeams([beam([["yarn-a", 400]]), beam([["yarn-b", 200]])], 0, 1);
    expect(a.sections.map((s) => s.warpYarn)).toEqual(["yarn-a", "yarn-b"]);
    expect(a.sections.every((s) => s.maxMeters === 1000)).toBe(true);
  });

  it("alternates the spare end so the two beams stay within one end of each other", () => {
    // Three odd sections: without alternating, one beam would take all three
    // spares and end up 3 ends heavier.
    const [a, b] = combineBeams([beam([["y", 101], ["y", 101], ["y", 101]]), beam([])], 0, 1);

    expect(a.sections.map((s) => s.ends)).toEqual([51, 50, 51]);
    expect(b.sections.map((s) => s.ends)).toEqual([50, 51, 50]);
    expect(Math.abs(totalEnds(a) - totalEnds(b))).toBe(1);
  });

  it("splits an even total exactly", () => {
    const [a, b] = combineBeams([beam([["y", 300], ["y", 500]]), beam([["y", 200]])], 0, 1);
    expect(totalEnds(a)).toBe(totalEnds(b));
    expect(totalEnds(a) + totalEnds(b)).toBe(1000);
  });

  it("does not let a section drop to zero ends", () => {
    // A single end cannot be halved onto two beams; both thread one rather
    // than one beam getting an unthreadable section.
    const [a, b] = combineBeams([beam([["y", 1]]), beam([])], 0, 1);
    expect(a.sections[0].ends).toBe(1);
    expect(b.sections[0].ends).toBe(1);
  });

  it("points each beam at the other", () => {
    const [a, b] = combineBeams(
      [beam([["y", 100]], { beamNo: 1 }), beam([["y", 100]], { beamNo: 2 })],
      0,
      1
    );
    expect(a.pairedBeamNo).toBe(2);
    expect(b.pairedBeamNo).toBe(1);
  });

  it("numbers beams by position when they carry no beamNo yet", () => {
    const [, b, c] = combineBeams([beam([["y", 10]]), beam([["y", 10]]), beam([["y", 10]])], 1, 2);
    expect(b.beamNo).toBe(2);
    expect(c.beamNo).toBe(3);
    expect(b.pairedBeamNo).toBe(3);
  });

  it("treats the selection order as irrelevant", () => {
    const beams = [beam([["y", 300]], { beamNo: 1 }), beam([["y", 100]], { beamNo: 2 })];
    expect(combineBeams(beams, 1, 0)).toEqual(combineBeams(beams, 0, 1));
  });

  it("leaves other beams untouched", () => {
    const other = beam([["untouched", 999]], { beamNo: 3 });
    const out = combineBeams([beam([["y", 100]]), beam([["y", 100]]), other], 0, 1);
    expect(out[2]).toBe(other);
  });

  it("does not mutate the beams it was given", () => {
    const beams = [beam([["y", 400]]), beam([["y", 200]])];
    const snapshot = JSON.parse(JSON.stringify(beams));
    combineBeams(beams, 0, 1);
    expect(beams).toEqual(snapshot);
  });

  it("is a no-op for a beam combined with itself or an index out of range", () => {
    const beams = [beam([["y", 100]]), beam([["y", 100]])];
    expect(combineBeams(beams, 1, 1)).toBe(beams);
    expect(combineBeams(beams, 0, 5)).toBe(beams);
    expect(combineBeams(beams, -1, 0)).toBe(beams);
  });
});

describe("separateBeam", () => {
  it("clears the pairing on both sides", () => {
    const paired = combineBeams(
      [beam([["y", 100]], { beamNo: 1 }), beam([["y", 100]], { beamNo: 2 })],
      0,
      1
    );
    const [a, b] = separateBeam(paired, 0);
    expect(a.pairedBeamNo).toBeNull();
    expect(b.pairedBeamNo).toBeNull();
  });

  it("leaves the ends as they were split", () => {
    const paired = combineBeams([beam([["y", 400]]), beam([["y", 200]])], 0, 1);
    const [a] = separateBeam(paired, 0);
    // Un-pairing is bookkeeping; the original division cannot be re-derived.
    expect(a.sections.map((s) => s.ends)).toEqual([200, 100]);
  });

  it("does nothing to a beam that was never paired", () => {
    const beams = [beam([["y", 100]]), beam([["y", 100]])];
    expect(separateBeam(beams, 0)).toBe(beams);
  });

  it("does not disturb an unrelated pair", () => {
    let beams = [
      beam([["y", 100]], { beamNo: 1 }),
      beam([["y", 100]], { beamNo: 2 }),
      beam([["y", 100]], { beamNo: 3 }),
      beam([["y", 100]], { beamNo: 4 }),
    ];
    beams = combineBeams(beams, 0, 1);
    beams = combineBeams(beams, 2, 3);

    const out = separateBeam(beams, 0);
    expect(out[0].pairedBeamNo).toBeNull();
    expect(out[1].pairedBeamNo).toBeNull();
    expect(out[2].pairedBeamNo).toBe(4);
    expect(out[3].pairedBeamNo).toBe(3);
  });
});
