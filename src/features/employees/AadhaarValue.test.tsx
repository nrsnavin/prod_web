import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/components/ui/Toast";
import { AadhaarValue } from "./AadhaarValue";
import { EmployeeForm } from "./EmployeeForm";

// The full Aadhaar number never comes to the browser unless an admin
// asks for it, and an edit never sends the masked value back.

const reveal = vi.fn();
vi.mock("./api", () => ({ employeeService: { revealAadhaar: (id: string) => reveal(id) } }));

beforeEach(() => vi.clearAllMocks());

const renderValue = (canReveal: boolean, masked = "XXXX XXXX 9012") =>
  render(
    <ToastProvider>
      <AadhaarValue empId="e1" masked={masked} canReveal={canReveal} />
    </ToastProvider>
  );

describe("the Aadhaar on the employee page", () => {
  it("is masked, and an admin can show and hide it", async () => {
    reveal.mockResolvedValue("1234 5678 9012");
    renderValue(true);
    expect(screen.getByText("XXXX XXXX 9012")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /show/i }));
    expect(await screen.findByText("1234 5678 9012")).toBeInTheDocument();
    expect(reveal).toHaveBeenCalledWith("e1");
    await userEvent.click(screen.getByRole("button", { name: /hide/i }));
    expect(screen.getByText("XXXX XXXX 9012")).toBeInTheDocument();
  });

  it("has no Show for anyone else", () => {
    renderValue(false);
    expect(screen.queryByRole("button", { name: /show/i })).not.toBeInTheDocument();
  });

  it("says plainly when there is none", () => {
    renderValue(true, "Not Provided");
    expect(screen.getByText("Not provided")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("editing an employee", () => {
  const renderForm = (canEditAadhaar: boolean, onSubmit = vi.fn()) => {
    render(
      <EmployeeForm
        initial={{ name: "Ravi", department: "weaving" }}
        aadhaarOnFile="XXXX XXXX 9012"
        canEditAadhaar={canEditAadhaar}
        submitting={false}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />
    );
    return onSubmit;
  };

  it("keeps the number on file when the field is left alone", async () => {
    const onSubmit = renderForm(true);
    expect(screen.getByLabelText(/aadhaar/i)).toHaveAttribute("placeholder", "XXXX XXXX 9012");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("aadhar");
  });

  it("sends a new number an admin types", async () => {
    const onSubmit = renderForm(true);
    await userEvent.type(screen.getByLabelText(/aadhaar/i), "999988887777");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(onSubmit.mock.calls[0][0].aadhar).toBe("999988887777"));
  });

  it("is not editable by anyone else", () => {
    renderForm(false);
    expect(screen.getByLabelText(/aadhaar/i)).toBeDisabled();
    expect(screen.getByText(/only an admin can change this/i)).toBeInTheDocument();
  });
});
