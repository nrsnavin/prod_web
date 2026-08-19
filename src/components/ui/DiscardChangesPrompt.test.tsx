import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "./Modal";
import { FormScreen } from "./FormScreen";

// ══════════════════════════════════════════════════════════════════
//  DISCARDING WORK, ASKED IN THE APP'S OWN VOICE
//
//  Both shared dialogs guarded a dirty dismissal with window.confirm —
//  the one dialog in the app that could not be styled, could not be
//  read in the app's voice, and could not be tested. It was also
//  bolted to the top of the browser window rather than attached to the
//  form it was about.
//
//  What these hold, in order of what it costs to get wrong:
//
//    • "Keep editing" really does keep the work. A guard whose safe
//      answer still closes is worse than no guard, because it teaches
//      people the question is decoration.
//    • the question only appears when there IS something to lose. Ask
//      on every dismissal and it gets clicked through unread.
//    • Escape backs out of the QUESTION, not out of the form —
//      otherwise the key somebody is pressing to cancel discards their
//      work on its second press.
//    • the safe answer holds focus, so a reflexive Enter is safe.
// ══════════════════════════════════════════════════════════════════

const onClose = vi.fn();

const showModal = () =>
  render(
    <Modal open onClose={onClose} title="Edit thing">
      <input aria-label="Name" />
    </Modal>
  );

const showFormScreen = () =>
  render(
    <FormScreen open onClose={onClose} title="Edit thing">
      <input aria-label="Name" />
    </FormScreen>
  );

const dirty = () => userEvent.type(screen.getByLabelText("Name"), "typed");
const close = () => userEvent.click(screen.getByRole("button", { name: /close/i }));
const asked = () => screen.queryByText(/discard your changes\?/i);

beforeEach(() => onClose.mockReset());

describe.each([
  ["Modal", showModal],
  ["FormScreen", showFormScreen],
])("%s", (_name, show) => {
  it("closes straight away when nothing has been typed", async () => {
    show();
    await close();

    expect(asked()).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });

  it("asks once there is something to lose", async () => {
    show();
    await dirty();
    await close();

    expect(asked()).toBeInTheDocument();
    // Crucially, it has NOT closed yet.
    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps the work when the answer is to keep editing", async () => {
    // The load-bearing one.
    show();
    await dirty();
    await close();
    await userEvent.click(screen.getByRole("button", { name: /keep editing/i }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Name")).toHaveValue("typed");
    expect(asked()).not.toBeInTheDocument();
  });

  it("closes when the answer is to discard", async () => {
    show();
    await dirty();
    await close();
    await userEvent.click(screen.getByRole("button", { name: /^discard$/i }));

    expect(onClose).toHaveBeenCalled();
  });

  it("says what is actually at stake", async () => {
    show();
    await dirty();
    await close();

    expect(screen.getByText(/no way to get it back/i)).toBeInTheDocument();
  });

  it("puts focus on the safe answer", async () => {
    // So a reflexive Enter or Space does not throw the work away.
    show();
    await dirty();
    await close();

    expect(screen.getByRole("button", { name: /keep editing/i })).toHaveFocus();
  });

  it("backs out of the question on Escape, not out of the form", async () => {
    // Escape is what somebody presses to cancel the question. Falling
    // through to the dialog's own handler would discard the work.
    show();
    await dirty();
    await close();
    await userEvent.keyboard("{Escape}");

    expect(asked()).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Name")).toHaveValue("typed");
  });

  it("is announced as a dialog that has taken over", async () => {
    show();
    await dirty();
    await close();

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});

describe("Modal, with the guard switched off", () => {
  it("closes without asking", async () => {
    // The command palette sets this: typing there is a search, not a
    // form, and asking would be nonsense.
    render(
      <Modal open onClose={onClose} title="Search" confirmDirtyClose={false}>
        <input aria-label="Name" />
      </Modal>
    );
    await dirty();
    await close();

    expect(asked()).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });
});
