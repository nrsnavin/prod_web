/**
 * Combining two warping beams.
 *
 * Port of the mobile app's WarpingController._executeCombine, deliberately
 * kept behaviour-identical so a plan built on the phone and one built on
 * the web produce the same beams.
 *
 * What "combine" means physically: the two beams are run together, so both
 * carry the SAME set of sections — the union of what each had — with the
 * ends of every section split down the middle between them. It is not a
 * merge into one beam, and sections are not consolidated by yarn: two
 * sections of the same yarn stay two sections.
 */

export interface BeamSectionValues {
  warpYarn: string;
  ends: number;
  maxMeters?: number;
}

export interface BeamValues {
  /** 1-based beam number. Undefined on beams created before it was sent. */
  beamNo?: number;
  /** The partner's beamNo once combined; null when the beam runs alone. */
  pairedBeamNo?: number | null;
  sections: BeamSectionValues[];
}

/** Ends carried by a beam. */
export function totalEnds(beam: BeamValues): number {
  return beam.sections.reduce((sum, s) => sum + (Number(s.ends) || 0), 0);
}

/**
 * Split one section's ends across the two beams.
 *
 * An odd count cannot divide evenly, so one side takes the spare end. Which
 * side alternates across odd sections — that is what keeps the two beams'
 * totals within one end of each other instead of letting every remainder
 * pile onto the same beam.
 */
function splitEnds(ends: number, aTakesSpare: boolean): [number, number] {
  const half = Math.floor(ends / 2);
  const odd = ends % 2 !== 0;
  const a = odd && aTakesSpare ? half + 1 : half;
  const b = odd && !aTakesSpare ? half + 1 : half;
  // A section on a planned beam always threads at least one end; a half of
  // zero would otherwise silently produce an unthreadable section. Mirrors
  // the mobile app, which clamps the same way.
  return [a > 0 ? a : 1, b > 0 ? b : 1];
}

/**
 * Combine the beams at `i` and `j`, returning a new array. Both beams come
 * back holding every section from both, each with half the ends, and each
 * pointing at the other via `pairedBeamNo`.
 *
 * Returns the list unchanged when the two indices are the same or either is
 * out of range — combining a beam with itself is a no-op, not an error.
 */
export function combineBeams(beams: BeamValues[], i: number, j: number): BeamValues[] {
  if (i === j) return beams;
  if (i < 0 || j < 0 || i >= beams.length || j >= beams.length) return beams;

  const first = Math.min(i, j);
  const second = Math.max(i, j);
  const beamA = beams[first];
  const beamB = beams[second];

  const allSections = [...beamA.sections, ...beamB.sections];

  const sectionsA: BeamSectionValues[] = [];
  const sectionsB: BeamSectionValues[] = [];
  let aTakesSpare = true;

  for (const section of allSections) {
    const ends = Number(section.ends) || 0;
    const [endsA, endsB] = splitEnds(ends, aTakesSpare);

    sectionsA.push({ ...section, ends: endsA });
    sectionsB.push({ ...section, ends: endsB });

    // Only an odd section consumed a spare end, so only then does the turn pass.
    if (ends % 2 !== 0) aTakesSpare = !aTakesSpare;
  }

  // beamNo may be unset on a plan built before the web sent it; fall back to
  // the 1-based position so the pairing still names something meaningful.
  const noA = beamA.beamNo ?? first + 1;
  const noB = beamB.beamNo ?? second + 1;

  const next = [...beams];
  next[first] = { ...beamA, beamNo: noA, sections: sectionsA, pairedBeamNo: noB };
  next[second] = { ...beamB, beamNo: noB, sections: sectionsB, pairedBeamNo: noA };
  return next;
}

/**
 * Undo a pairing: clears `pairedBeamNo` on the beam and on whichever beam
 * points back at it. The ends stay split — un-pairing is a bookkeeping
 * change, and re-deriving the original division is not possible once the
 * numbers have been edited.
 */
export function separateBeam(beams: BeamValues[], index: number): BeamValues[] {
  const beam = beams[index];
  if (!beam?.pairedBeamNo) return beams;
  const partnerNo = beam.pairedBeamNo;
  const selfNo = beam.beamNo ?? index + 1;

  return beams.map((b, i) => {
    if (i === index) return { ...b, pairedBeamNo: null };
    if ((b.beamNo ?? i + 1) === partnerNo && b.pairedBeamNo === selfNo) {
      return { ...b, pairedBeamNo: null };
    }
    return b;
  });
}
