import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmployeeForm } from "./EmployeeForm";

// ══════════════════════════════════════════════════════════════════
//  THE SALARY ON THE EMPLOYEE FORM
//
//  The form shows pay as a 12-hour DAY shift's salary and stores it as
//  rupees an hour. Two things were wrong with it:
//
//    • every save sent the rate back as (rate × 12) ÷ 12, which is not
//      always the rate. ₹85.35 an hour was shown as 1024.1999999999998
//      and stored again as 85.34999999999998 by an edit that only
//      corrected a phone number;
//
//    • it was shown to, and sent by, every login that can open
//      Employees. Pay is the admin's and accounts' to set (the server
//      now refuses anyone else), so a floor supervisor's form has no
//      salary on it and sends no rate.
// ══════════════════════════════════════════════════════════════════

vi.mock("./api", () => ({ employeeService: { checkAadhaarQr: vi.fn() } }));
vi.mock("@/features/floor/QrScanner", () => ({ QrScanner: () => null }));
vi.mock("@/features/common/PhotoFill", () => ({ PhotoFillButton: () => null }));

const loaded = { name: "Murugan R", department: "weaving", phoneNumber: "9800000001", hourlyRate: 85.35 };

const open = (props: Partial<Parameters<typeof EmployeeForm>[0]> = {}) => {
  const onSubmit = vi.fn();
  render(<EmployeeForm initial={loaded} employeeId="e1" submitting={false} onSubmit={onSubmit} onCancel={() => {}} {...props} />);
  return onSubmit;
};
const save = () => userEvent.click(screen.getByRole("button", { name: "Save changes" }));

describe("the salary on the employee form", () => {
  it("is shown to the paisa, and goes back as the rate it was loaded with", async () => {
    const onSubmit = open();
    // Before: 1024.1999999999998.
    expect(screen.getByLabelText(/shift salary/i)).toHaveValue(1024.2);
    await save();
    // Before: 85.34999999999998.
    expect(onSubmit.mock.calls[0][0].hourlyRate).toBe(85.35);
  });

  it("a new salary is the new rate", async () => {
    const onSubmit = open();
    const field = screen.getByLabelText(/shift salary/i);
    await userEvent.clear(field);
    await userEvent.type(field, "1200");
    await save();
    expect(onSubmit.mock.calls[0][0].hourlyRate).toBe(100);
  });

  it("is not on the form, and no rate is sent, for a login that cannot set pay", async () => {
    const onSubmit = open({ canEditPay: false });
    expect(screen.queryByLabelText(/shift salary/i)).not.toBeInTheDocument();
    await save();
    const sent = onSubmit.mock.calls[0][0];
    expect(sent).not.toHaveProperty("hourlyRate");
    expect(sent.name).toBe("Murugan R");
  });

  it("a new employee with no salary typed is sent with none (₹0)", async () => {
    const onSubmit = vi.fn();
    render(<EmployeeForm submitting={false} onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText(/full name|^name/i), "New Hand");
    await userEvent.click(screen.getByRole("button", { name: "Add employee" }));
    expect(onSubmit.mock.calls[0][0].hourlyRate).toBe(0);
  });
});
