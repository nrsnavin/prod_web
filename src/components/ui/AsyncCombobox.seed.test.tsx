import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AsyncCombobox } from "./AsyncCombobox";

// ══════════════════════════════════════════════════════════════════
//  A VALUE SET FROM OUTSIDE, SHOWING AS AN EMPTY BOX
//
//  "Add from an elastic group" on the order form sets several line
//  values at once, and passes the group's elastics as `seedOptions` so
//  those lines can show a name they were never searched for.
//
//  It showed nothing. The value was set — the form would have submitted
//  correctly — but every box read "Select elastic", so the operator saw
//  the group do nothing and typed the lines in by hand.
//
//  The cause is a render-ordering trap rather than a missing feature.
//  The labels were folded into a ref:
//
//      const labelCache = useRef(new Map());
//      useEffect(() => { for (const o of seedOptions ?? []) …set… },
//                [seedOptions]);
//      const selectedLabel = useMemo(
//        () => labelCache.current.get(value) ?? null, [value, options, seedOptions]);
//
//  Two things have to be true at once and cannot be. An effect runs
//  AFTER the render that needs its result, and writing to a ref
//  schedules no re-render — so on any combobox whose first render
//  already has a value, the memo reads an empty map and nothing ever
//  makes it look again.
//
//  Which is exactly what "add from group" produces: react-hook-form's
//  replace()/append() give the rows new keys, so React MOUNTS fresh
//  comboboxes with the value already in place. The edit-prefill path
//  has the same shape.
// ══════════════════════════════════════════════════════════════════

const loadNothing = () => Promise.resolve([]);

describe("a value that arrives with its label in seedOptions", () => {
  it("shows the label on first render", async () => {
    // The "add from group" case: the component mounts with the value
    // already set, and its label only in the seed.
    render(
      <AsyncCombobox
        value="e1"
        onChange={vi.fn()}
        loadOptions={loadNothing}
        seedOptions={[{ value: "e1", label: "20mm Elastic" }]}
        placeholder="Select elastic"
      />
    );

    expect(await screen.findByText("20mm Elastic")).toBeInTheDocument();
    expect(screen.queryByText("Select elastic")).not.toBeInTheDocument();
  });

  it("shows it without the user ever opening the list", async () => {
    // Nothing may depend on the dropdown being opened — the whole point
    // of the shortcut is that the lines arrive ready to submit.
    const load = vi.fn(loadNothing);
    render(
      <AsyncCombobox
        value="e2"
        onChange={vi.fn()}
        loadOptions={load}
        seedOptions={[{ value: "e2", label: "32mm Elastic" }]}
      />
    );

    expect(await screen.findByText("32mm Elastic")).toBeInTheDocument();
    expect(load).not.toHaveBeenCalled();
  });

  it("still falls back to the placeholder for a value nothing knows", async () => {
    render(
      <AsyncCombobox
        value="ghost"
        onChange={vi.fn()}
        loadOptions={loadNothing}
        seedOptions={[{ value: "e1", label: "20mm Elastic" }]}
        placeholder="Select elastic"
      />
    );

    expect(await screen.findByText("Select elastic")).toBeInTheDocument();
  });

  it("shows the label when the seed arrives after mount", async () => {
    // The order form's seed is built from a query, so it is empty on the
    // first paint and fills in when the groups load.
    const { rerender } = render(
      <AsyncCombobox value="e3" onChange={vi.fn()} loadOptions={loadNothing}
        seedOptions={[]} placeholder="Select elastic" />
    );
    expect(screen.getByText("Select elastic")).toBeInTheDocument();

    rerender(
      <AsyncCombobox value="e3" onChange={vi.fn()} loadOptions={loadNothing}
        seedOptions={[{ value: "e3", label: "45mm Elastic" }]} placeholder="Select elastic" />
    );

    expect(await screen.findByText("45mm Elastic")).toBeInTheDocument();
  });

  it("shows the label when the value arrives after the seed", async () => {
    // And the other order: seed first, then the group pick sets values.
    const seed = [{ value: "e4", label: "50mm Elastic" }];
    const { rerender } = render(
      <AsyncCombobox value="" onChange={vi.fn()} loadOptions={loadNothing}
        seedOptions={seed} placeholder="Select elastic" />
    );
    expect(screen.getByText("Select elastic")).toBeInTheDocument();

    rerender(
      <AsyncCombobox value="e4" onChange={vi.fn()} loadOptions={loadNothing}
        seedOptions={seed} placeholder="Select elastic" />
    );

    expect(await screen.findByText("50mm Elastic")).toBeInTheDocument();
  });
});
