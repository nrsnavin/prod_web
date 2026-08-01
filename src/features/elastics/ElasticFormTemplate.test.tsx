import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ElasticForm } from "./ElasticForm";

// The template can be built while the elastic is being created, so a new
// product does not have to be saved and then reopened to say how it is
// warped.

const onSubmit = vi.fn();

vi.mock("./hooks", () => ({
  useMaterialsByCategory: () => ({
    data: {
      warp: [{ _id: "y1", name: "Nylon 70D" }],
      weft: [{ _id: "w1", name: "Weft A" }],
      rubber: [{ _id: "r1", name: "Rubber 22" }],
      covering: [{ _id: "c1", name: "Covering X" }],
    },
  }),
}));

const renderForm = () =>
  render(<ElasticForm submitting={false} onSubmit={onSubmit} onCancel={() => {}} />);

const pick = async (user: ReturnType<typeof userEvent.setup>, trigger: RegExp, option: RegExp) => {
  await user.click(screen.getByRole("button", { name: trigger }));
  await user.click(await screen.findByRole("option", { name: option }));
};

beforeEach(() => onSubmit.mockClear());

describe("the warping template on the create form", () => {
  it("is offered, and optional", async () => {
    renderForm();
    expect(screen.getByText(/warping plan template/i)).toBeInTheDocument();
    expect(screen.getByText(/optional/i)).toBeInTheDocument();
  });

  it("submits the template alongside the elastic", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/elastic name/i), "20mm");
    await pick(user, /select rubber\/spandex/i, /Rubber 22/);
    await pick(user, /select covering/i, /Covering X/);
    await pick(user, /select weft/i, /Weft A/);
    // Weights are required by the schema.
    for (const w of screen.getAllByLabelText(/^weight$/i)) {
      await user.clear(w);
      await user.type(w, "1");
    }
    await pick(user, /select warp yarn/i, /Nylon 70D/);

    await user.click(screen.getByRole("button", { name: /add beam/i }));
    // The beam's yarn picker is addressed by its own label, not by the
    // placeholder — the composition picker shares that text.
    await pick(user, /warp yarn for beam 1 section 1/i, /Nylon 70D/);
    const ends = screen.getByLabelText(/ends for beam 1 section 1/i);
    await user.clear(ends);
    await user.type(ends, "120");

    await user.click(screen.getByRole("button", { name: /create elastic/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const v = onSubmit.mock.calls[0][0];
    expect(v.warpingPlanTemplate.beams[0].sections[0]).toMatchObject({
      warpYarn: "y1",
      ends: 120,
    });
  });

  it("omits the template entirely when none was built", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/elastic name/i), "20mm");
    await pick(user, /select rubber\/spandex/i, /Rubber 22/);
    await pick(user, /select covering/i, /Covering X/);
    await pick(user, /select weft/i, /Weft A/);
    for (const w of screen.getAllByLabelText(/^weight$/i)) {
      await user.clear(w);
      await user.type(w, "1");
    }
    await pick(user, /select warp yarn/i, /Nylon 70D/);

    await user.click(screen.getByRole("button", { name: /create elastic/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    // An absent template must not arrive as an empty beam list — that
    // would store a template nobody meant to create.
    expect(onSubmit.mock.calls[0][0].warpingPlanTemplate).toBeUndefined();
  });
});
