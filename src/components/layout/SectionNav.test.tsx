import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Section, SectionNav } from "./SectionNav";

describe("SectionNav", () => {
  it("scrolls to the section without putting a hash in the URL", async () => {
    render(
      <>
        <SectionNav sections={[{ id: "jobs", label: "Jobs" }, { id: "lots", label: "Dye lots" }]} />
        <Section id="jobs"><h3>Jobs</h3></Section>
        <Section id="lots"><h3>Dye lots</h3></Section>
      </>
    );
    const target = document.getElementById("lots")!;
    const scroll = vi.fn();
    target.scrollIntoView = scroll;
    const before = window.location.hash;
    await userEvent.click(screen.getByRole("link", { name: "Dye lots" }));
    expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ block: "start" }));
    expect(window.location.hash).toBe(before);
  });

  it("names itself for screen readers", () => {
    render(<SectionNav sections={[{ id: "a", label: "A" }]} />);
    expect(screen.getByRole("navigation", { name: "On this page" })).toBeInTheDocument();
  });
});
