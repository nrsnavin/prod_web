// ══════════════════════════════════════════════════════════════════
//  FROM A PHOTO OF THE TIMER TO A RUN TIME, ASKING WHAT ISN'T CLEAR
//
//  The server (api/timerOcr.js) lists every display the model saw on the
//  loom panel, with its text, kind, confidence and other readings of an
//  unclear digit. This file decides, one step at a time, what the run
//  time is, and when it can't be sure, what to ask the person:
//
//    1. Several displays, none clearly the run time → which one is it?
//    2. A digit could be read two ways → which does the display show?
//    3. A total-hours meter (1234.6 h) → what did it read at the start
//       of the shift? Run time = now − then.
//    4. "7.45" → 7 h 45 min, or 7.45 hours (7 h 27 min)?
//    5. "45:12" is too long for hours → 45 min 12 s?
//    6. Unsure overall → is the run time 7:45:12?
//    7. Longer than a shift → use it anyway?
//
//  Pure: the answers so far go in, the next question (or the run time)
//  comes out, so each answer applies instantly with no second AI call,
//  and every rule is tested on its own (timerReading.test.ts).
// ══════════════════════════════════════════════════════════════════

export type DisplayKind = "run_time" | "hour_meter" | "clock" | "counter" | "other";

export interface TimerDisplay {
  text: string;
  kind: DisplayKind;
  label: string;
  confidence: number;
  alternatives: string[];
}

export interface TimerReading {
  displays: TimerDisplay[];
  primary: number | null;
  problem: "blurry" | "glare" | "cut_off" | "too_dark" | "no_display" | null;
}

export interface Option {
  label: string;
  value: string;
}

export type Question =
  | { id: "display"; text: string; options: Option[] }
  | { id: "digits"; text: string; options: Option[] }
  | { id: "start"; text: string; input: { endHours: number } }
  | { id: "decimal"; text: string; options: Option[] }
  | { id: "mmss"; text: string; options: Option[] }
  | { id: "confirm"; text: string; options: Option[] }
  | { id: "long"; text: string; options: Option[] };

export type Answers = Partial<Record<Question["id"], string>>;

export type Step =
  | { kind: "question"; question: Question; error?: string }
  | { kind: "done"; runTime: string; seconds: number; text: string }
  | { kind: "type"; reason: string };

/** The answer that means "I'll type it myself". */
export const TYPE_IT = "__type__";

const PROBLEM_WORDS: Record<NonNullable<TimerReading["problem"]>, string> = {
  blurry: "The photo is blurry.",
  glare: "There's glare on the display.",
  cut_off: "The display is cut off at the edge of the photo.",
  too_dark: "The photo is too dark.",
  no_display: "No timer could be seen in the photo.",
};

const CONFIDENT = 0.8;

export function formatHMS(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** "7 h 45 min", for questions. */
export function spoken(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  return h && m ? `${h} h ${m} min` : h ? `${h} h` : `${m} min`;
}

type Parsed =
  | { type: "colon"; parts: number[] }
  | { type: "decimal"; value: number }
  | { type: "integer"; value: number }
  | null;

export function parseText(text: string): Parsed {
  const t = text.trim().replace(/\s+/g, "").replace(/[hH]$/, "");
  if (/^\d{1,5}(:\d{2}){1,2}$/.test(t)) return { type: "colon", parts: t.split(":").map(Number) };
  if (/^\d+\.\d+$/.test(t)) return { type: "decimal", value: Number(t) };
  if (/^\d+$/.test(t)) return { type: "integer", value: Number(t) };
  return null;
}

const typeIt: Option = { label: "None of these, I'll type it", value: TYPE_IT };

function describe(d: TimerDisplay): string {
  return d.label ? `${d.text}  (${d.label})` : d.text;
}

/** The next thing to ask, or the run time, from the reading and the answers so far. */
export function nextStep(reading: TimerReading, answers: Answers, { shiftHours = 12 } = {}): Step {
  const limit = (shiftHours + 1) * 3600;

  if (reading.problem && reading.displays.length === 0) {
    return { kind: "type", reason: `${PROBLEM_WORDS[reading.problem]} Take another photo, or type the run time.` };
  }
  if (reading.displays.length === 0) return { kind: "type", reason: PROBLEM_WORDS.no_display };

  // 1. Which display.
  const primary = reading.primary != null ? reading.displays[reading.primary] : undefined;
  const runTimes = reading.displays.filter((d) => d.kind === "run_time");
  const clearPrimary = !!primary && primary.kind === "run_time" && primary.confidence >= CONFIDENT && runTimes.length === 1;
  let display: TimerDisplay | undefined;
  if (reading.displays.length === 1) display = reading.displays[0];
  else if (clearPrimary) display = primary;
  else if (answers.display === undefined) {
    return {
      kind: "question",
      question: {
        id: "display",
        text: "The photo shows more than one number. Which is the loom's run time?",
        options: [...reading.displays.map((d, i) => ({ label: describe(d), value: String(i) })), typeIt],
      },
    };
  } else if (answers.display === TYPE_IT) return { kind: "type", reason: "Type the run time from the display." };
  else display = reading.displays[Number(answers.display)];
  if (!display) return { kind: "type", reason: "Type the run time from the display." };

  // 2. Which digits.
  let text = display.text;
  let askedAboutIt = false;
  if (display.alternatives.length > 0) {
    if (answers.digits === undefined) {
      return {
        kind: "question",
        question: {
          id: "digits",
          text: "Some digits are hard to make out. Which does the display show?",
          options: [...[display.text, ...display.alternatives].map((t) => ({ label: t, value: t })), { label: "Neither, I'll type it", value: TYPE_IT }],
        },
      };
    }
    if (answers.digits === TYPE_IT) return { kind: "type", reason: "Type the run time from the display." };
    text = answers.digits;
    askedAboutIt = true;
  }

  // 3–5. What the text means.
  const parsed = parseText(text);
  let seconds: number | null = null;

  if (!parsed) return { kind: "type", reason: `"${text}" doesn't look like a time. Type the run time instead.` };

  if (parsed.type === "colon") {
    const [a, b, c = 0] = parsed.parts;
    if (parsed.parts.length === 2 && a * 3600 > limit) {
      // "45:12" can't be 45 hours in one shift: minutes and seconds?
      if (answers.mmss === undefined) {
        return {
          kind: "question",
          question: {
            id: "mmss",
            text: `"${text}" would be ${a} hours, longer than a shift. Is it ${a} minutes and ${b} seconds?`,
            options: [
              { label: `Yes, ${a} min ${b} s`, value: "yes" },
              { label: "No, I'll type it", value: TYPE_IT },
            ],
          },
        };
      }
      if (answers.mmss !== "yes") return { kind: "type", reason: "Type the run time from the display." };
      seconds = a * 60 + b;
      askedAboutIt = true;
    } else {
      seconds = a * 3600 + b * 60 + c;
    }
  } else if (parsed.type === "decimal" && (display.kind === "hour_meter" || parsed.value * 3600 > limit)) {
    // A total-hours meter: this shift is the difference from the start.
    if (answers.start === undefined) {
      return {
        kind: "question",
        question: {
          id: "start",
          text: `This looks like a total-hours meter reading ${parsed.value} h. What did it read when the shift started?`,
          input: { endHours: parsed.value },
        },
      };
    }
    const start = Number(answers.start);
    const diff = (parsed.value - start) * 3600;
    if (!Number.isFinite(start) || answers.start.trim() === "" || diff <= 0 || diff > limit) {
      return {
        kind: "question",
        question: {
          id: "start",
          text: `This looks like a total-hours meter reading ${parsed.value} h. What did it read when the shift started?`,
          input: { endHours: parsed.value },
        },
        error:
          Number.isFinite(diff) && diff > 0
            ? `That makes ${spoken(diff)}, longer than a shift. Check the start reading.`
            : "The start reading has to be lower than the reading now.",
      };
    }
    seconds = diff;
    askedAboutIt = true;
  } else if (parsed.type === "decimal") {
    // "7.45": a time written with a dot, or decimal hours?
    const [h, frac] = text.trim().split(".");
    const asClock = frac.length === 2 && Number(frac) < 60 ? Number(h) * 3600 + Number(frac) * 60 : null;
    const asHours = parsed.value * 3600;
    if (asClock == null) seconds = asHours;
    else if (answers.decimal === undefined) {
      return {
        kind: "question",
        question: {
          id: "decimal",
          text: `Does ${text} mean ${spoken(asClock)}, or ${text} hours (${spoken(asHours)})?`,
          options: [
            { label: spoken(asClock), value: "clock" },
            { label: `${spoken(asHours)} (${text} hours)`, value: "hours" },
          ],
        },
      };
    } else {
      seconds = answers.decimal === "hours" ? asHours : asClock;
      askedAboutIt = true;
    }
  } else {
    // A bare number: "745" as 7:45, if it can be one.
    const v = parsed.value;
    const hh = Math.floor(v / 100), mm = v % 100;
    if (display.kind === "counter" || v < 100 || v > 2359 || mm >= 60) {
      return { kind: "type", reason: `${text} looks like a counter, not a time. Type the run time instead.` };
    }
    if (answers.confirm === undefined) {
      return {
        kind: "question",
        question: {
          id: "confirm",
          text: `Is ${text} a run time of ${spoken(hh * 3600 + mm * 60)}?`,
          options: [
            { label: "Yes", value: "yes" },
            { label: "No, I'll type it", value: TYPE_IT },
          ],
        },
      };
    }
    if (answers.confirm !== "yes") return { kind: "type", reason: "Type the run time from the display." };
    seconds = hh * 3600 + mm * 60;
    askedAboutIt = true;
  }

  // 6. Unsure overall, and nothing has been asked about it yet.
  if (!askedAboutIt && display.confidence < CONFIDENT) {
    if (answers.confirm === undefined) {
      return {
        kind: "question",
        question: {
          id: "confirm",
          text: `The photo isn't very clear. Is the run time ${formatHMS(seconds)}?`,
          options: [
            { label: "Yes", value: "yes" },
            { label: "No, I'll type it", value: TYPE_IT },
          ],
        },
      };
    }
    if (answers.confirm !== "yes") return { kind: "type", reason: "Type the run time from the display." };
  }

  // 7. Longer than a shift.
  if (seconds > limit) {
    if (answers.long === undefined) {
      return {
        kind: "question",
        question: {
          id: "long",
          text: `${spoken(seconds)} is longer than a ${shiftHours}-hour shift. Use it anyway?`,
          options: [
            { label: "Use it anyway", value: "yes" },
            { label: "No, I'll type it", value: TYPE_IT },
          ],
        },
      };
    }
    if (answers.long !== "yes") return { kind: "type", reason: "Type the run time from the display." };
  }

  return { kind: "done", runTime: formatHMS(seconds), seconds, text };
}
