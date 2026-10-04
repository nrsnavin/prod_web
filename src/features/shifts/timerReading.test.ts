import { describe, expect, it } from "vitest";
import { TYPE_IT, TimerDisplay, TimerReading, formatHMS, nextStep, parseText } from "./timerReading";

// Each rule for turning a photo's reading into a run time, and each
// question it asks when it can't be sure.

const d = (text: string, over: Partial<TimerDisplay> = {}): TimerDisplay => ({
  text, kind: "run_time", label: "", confidence: 0.95, alternatives: [], ...over,
});
const reading = (displays: TimerDisplay[], primary: number | null = 0, problem: TimerReading["problem"] = null): TimerReading =>
  ({ displays, primary, problem });

describe("a clear reading", () => {
  it("is used straight away", () => {
    expect(nextStep(reading([d("07:45:12")]), {})).toMatchObject({ kind: "done", runTime: "7:45:12" });
    expect(nextStep(reading([d("7:45")]), {})).toMatchObject({ kind: "done", runTime: "7:45:00" });
  });

  it("is used even beside other numbers when it is clearly the run time", () => {
    const r = reading([d("06:30"), d("58213", { kind: "counter", label: "PICK" })], 0);
    expect(nextStep(r, {})).toMatchObject({ kind: "done", runTime: "6:30:00" });
  });
});

describe("questions", () => {
  it("asks which display when there are several and none is clearly the run time", () => {
    const r = reading([d("06:30", { confidence: 0.6 }), d("14:05", { kind: "clock", label: "TIME" })], 0);
    const s = nextStep(r, {});
    expect(s).toMatchObject({ kind: "question", question: { id: "display" } });
    if (s.kind !== "question" || !("options" in s.question)) throw new Error();
    expect(s.question.options.map((o) => o.label)).toEqual(["06:30", "14:05  (TIME)", "None of these, I'll type it"]);
    expect(nextStep(r, { display: "0" })).toMatchObject({ kind: "question", question: { id: "confirm" } }); // low confidence
    // Picking the clock is the person's call, but 14 hours is no shift's
    // run time, so "14:05" is questioned: minutes and seconds?
    expect(nextStep(r, { display: "1" })).toMatchObject({ kind: "question", question: { id: "mmss" } });
    expect(nextStep(r, { display: TYPE_IT })).toMatchObject({ kind: "type" });
  });

  it("asks which digits when one could be read two ways", () => {
    const r = reading([d("07:45:12", { alternatives: ["01:45:12"] })]);
    expect(nextStep(r, {})).toMatchObject({ kind: "question", question: { id: "digits" } });
    expect(nextStep(r, { digits: "01:45:12" })).toMatchObject({ kind: "done", runTime: "1:45:12" });
  });

  it("asks for the start reading of a total-hours meter, and takes the difference", () => {
    const r = reading([d("1234.6", { kind: "hour_meter", label: "HRS" })]);
    expect(nextStep(r, {})).toMatchObject({ kind: "question", question: { id: "start", input: { endHours: 1234.6 } } });
    expect(nextStep(r, { start: "1226.85" })).toMatchObject({ kind: "done", runTime: "7:45:00" });
  });

  it("refuses a start reading that makes no sense, and says why", () => {
    const r = reading([d("1234.6", { kind: "hour_meter" })]);
    expect(nextStep(r, { start: "1240" })).toMatchObject({ kind: "question", error: expect.stringMatching(/lower than/) });
    expect(nextStep(r, { start: "1200" })).toMatchObject({ kind: "question", error: expect.stringMatching(/longer than a shift/) });
    expect(nextStep(r, { start: "" })).toMatchObject({ kind: "question", error: expect.any(String) });
  });

  it("treats a big decimal as a meter even when the model didn't say so", () => {
    expect(nextStep(reading([d("4821.3", { kind: "other" })]), {})).toMatchObject({ question: { id: "start" } });
  });

  it("asks whether 7.45 is 7 h 45 min or 7.45 hours", () => {
    const r = reading([d("7.45")]);
    const s = nextStep(r, {});
    expect(s).toMatchObject({ kind: "question", question: { id: "decimal", text: "Does 7.45 mean 7 h 45 min, or 7.45 hours (7 h 27 min)?" } });
    expect(nextStep(r, { decimal: "clock" })).toMatchObject({ runTime: "7:45:00" });
    expect(nextStep(r, { decimal: "hours" })).toMatchObject({ runTime: "7:27:00" });
  });

  it("does not ask about 7.5, which can only be hours", () => {
    expect(nextStep(reading([d("7.5")]), {})).toMatchObject({ kind: "done", runTime: "7:30:00" });
  });

  it("asks whether 45:12 is minutes and seconds, since 45 hours can't be one shift", () => {
    const r = reading([d("45:12")]);
    expect(nextStep(r, {})).toMatchObject({ question: { id: "mmss" } });
    expect(nextStep(r, { mmss: "yes" })).toMatchObject({ runTime: "0:45:12" });
  });

  it("asks before reading 745 as 7:45", () => {
    const r = reading([d("745", { kind: "other" })]);
    expect(nextStep(r, {})).toMatchObject({ question: { id: "confirm", text: "Is 745 a run time of 7 h 45 min?" } });
    expect(nextStep(r, { confirm: "yes" })).toMatchObject({ runTime: "7:45:00" });
  });

  it("confirms a reading it isn't sure of", () => {
    const r = reading([d("07:45", { confidence: 0.5 })]);
    expect(nextStep(r, {})).toMatchObject({ question: { id: "confirm", text: expect.stringMatching(/Is the run time 7:45:00\?/) } });
    expect(nextStep(r, { confirm: "yes" })).toMatchObject({ kind: "done" });
    expect(nextStep(r, { confirm: TYPE_IT })).toMatchObject({ kind: "type" });
  });

  it("checks a run time longer than a shift", () => {
    const r = reading([d("13:30")]);
    expect(nextStep(r, {}, { shiftHours: 12 })).toMatchObject({ question: { id: "long" } });
    expect(nextStep(r, { long: "yes" })).toMatchObject({ runTime: "13:30:00" });
  });
});

describe("when it can't be read", () => {
  it("says what is wrong with the photo", () => {
    expect(nextStep(reading([], null, "glare"), {})).toMatchObject({ kind: "type", reason: expect.stringMatching(/glare/) });
    expect(nextStep(reading([], null, null), {})).toMatchObject({ kind: "type" });
  });

  it("won't treat a counter as a time", () => {
    expect(nextStep(reading([d("58213", { kind: "counter" })]), {})).toMatchObject({ kind: "type", reason: expect.stringMatching(/counter/) });
  });

  it("won't guess at text that isn't a number", () => {
    expect(nextStep(reading([d("7h45m?")]), {})).toMatchObject({ kind: "type" });
  });
});

describe("helpers", () => {
  it("format and parse", () => {
    expect(formatHMS(27912)).toBe("7:45:12");
    expect(parseText(" 07:45 ")).toEqual({ type: "colon", parts: [7, 45] });
    expect(parseText("1234.6h")).toEqual({ type: "decimal", value: 1234.6 });
  });
});
