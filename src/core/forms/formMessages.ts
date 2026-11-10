import { z } from "zod";

// ══════════════════════════════════════════════════════════════════
//  WHAT A FORM SAYS WHEN A FIELD IS WRONG
//
//  Most fields carry their own message ("Name is required"). The ones
//  that do not fall back on the schema library's, and those are written
//  for whoever wrote the schema: "Invalid input: expected number,
//  received NaN", "Too small: expected string to have >=1 characters".
//  This is the fallback in the words of the person filling in the form.
//  A message a field gives for itself always wins.
// ══════════════════════════════════════════════════════════════════

type Issue = {
  code?: string;
  input?: unknown;
  expected?: string;
  origin?: string;
  minimum?: number | bigint;
  maximum?: number | bigint;
  inclusive?: boolean;
  format?: string;
};

const blank = (v: unknown) => v === undefined || v === null || v === "";

/** The fallback message for an issue; undefined leaves the library's own. */
export function formMessage(issue: Issue): string | undefined {
  switch (issue.code) {
    case "invalid_type":
      if (blank(issue.input)) return "Required";
      if (issue.expected === "number") return "Enter a number";
      return undefined;
    case "too_small":
      if (issue.origin === "string") return Number(issue.minimum) <= 1 ? "Required" : `At least ${issue.minimum} characters`;
      if (issue.origin === "number") return `Must be ${issue.inclusive === false ? "more than" : "at least"} ${issue.minimum}`;
      if (issue.origin === "array") return Number(issue.minimum) <= 1 ? "Add at least one" : `Add at least ${issue.minimum}`;
      return undefined;
    case "too_big":
      if (issue.origin === "string") return `At most ${issue.maximum} characters`;
      if (issue.origin === "number") return `Must be ${issue.inclusive === false ? "less than" : "at most"} ${issue.maximum}`;
      if (issue.origin === "array") return `At most ${issue.maximum}`;
      return undefined;
    case "invalid_format":
      return issue.format === "email" ? "Enter a valid email" : undefined;
    case "invalid_value":
      return "Choose one of the options";
    default:
      return undefined;
  }
}

/** Make these the fallback for every schema in the app. Called once, at start-up. */
export function installFormMessages(): void {
  z.config({ customError: (issue) => formMessage(issue as Issue) });
}
