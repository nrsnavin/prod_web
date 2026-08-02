import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { JobShiftSummary } from "./JobShiftSummary";
import type { JobShiftSummary as Summary } from "./types";

const summary = (over: Partial<Summary> = {}): Summary => ({
  shifts: 4,
  produced: 3200,
  workedMinutes: 2610, // 43h 30m
  byShift: { DAY: 2000, NIGHT: 1200 },
  closed: 3,
  awaitingVerification: 1,
  open: 0,
  metresPerHour: 73.6,
  firstDate: "2026-06-10T00:00:00.000Z",
  lastDate: "2026-06-14T00:00:00.000Z",
  firstDateLabel: "10 Jun 2026",
  lastDateLabel: "14 Jun 2026",
  ...over,
});

describe("the shift summary on a job", () => {
  it("totals the shifts, the metres and the time", () => {
    render(<JobShiftSummary summary={summary()} />);

    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("3,200 m")).toBeInTheDocument();
    expect(screen.getByText("43h 30m")).toBeInTheDocument();
  });

  it("splits day from night", () => {
    render(<JobShiftSummary summary={summary()} />);
    expect(screen.getByText(/day 2,000 · night 1,200/)).toBeInTheDocument();
  });

  it("names the span the shifts cover", () => {
    render(<JobShiftSummary summary={summary()} />);
    expect(screen.getByText("10 Jun 2026 – 14 Jun 2026")).toBeInTheDocument();
  });

  it("does not print a range when every shift is on one day", () => {
    render(
      <JobShiftSummary
        summary={summary({ firstDateLabel: "10 Jun 2026", lastDateLabel: "10 Jun 2026" })}
      />
    );
    expect(screen.getByText("10 Jun 2026")).toBeInTheDocument();
    expect(screen.queryByText(/–/)).not.toBeInTheDocument();
  });

  it("says how much of the total is still unverified", () => {
    // The total includes submitted-but-unchecked shifts, because leaving
    // them out makes a running job look idle. Saying so is what keeps
    // that from being a lie.
    render(<JobShiftSummary summary={summary()} />);

    expect(screen.getByText("3 verified")).toBeInTheDocument();
    expect(screen.getByText("1 awaiting verification")).toBeInTheDocument();
    expect(
      screen.getByText(/counted at what the operator submitted/i)
    ).toBeInTheDocument();
  });

  it("stays quiet about verification when there is nothing pending", () => {
    render(<JobShiftSummary summary={summary({ closed: 4, awaitingVerification: 0 })} />);
    expect(screen.queryByText(/awaiting verification/)).not.toBeInTheDocument();
    expect(screen.queryByText(/operator submitted/i)).not.toBeInTheDocument();
  });

  it("reports output per hour worked", () => {
    render(<JobShiftSummary summary={summary()} />);
    expect(screen.getByText("Per hour worked")).toBeInTheDocument();
    expect(screen.getByText("73.6 m")).toBeInTheDocument();
  });

  it("renders nothing for a job that has not run a shift", () => {
    // A row of zeroes is noise on a job still in preparatory.
    const { container } = render(
      <JobShiftSummary summary={summary({ shifts: 0, produced: 0, workedMinutes: 0 })} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the server sends no summary at all", () => {
    const { container } = render(<JobShiftSummary summary={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
