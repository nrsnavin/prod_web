import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LoomSensors } from "./LoomSensors";

// The admin adds a loom's board and copies its key, shown once.

const get = vi.fn();
const post = vi.fn();
const del = vi.fn();
vi.mock("@/core/http/httpClient", async () => {
  const actual = await vi.importActual<typeof import("@/core/http/httpClient")>("@/core/http/httpClient");
  return { ...actual, httpClient: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a), delete: (...a: unknown[]) => del(...a) } };
});
vi.mock("@/features/machines/api", () => ({ machineService: { list: async () => [{ _id: "m1", ID: "L1" }, { _id: "m2", ID: "L2" }] } }));
const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
let role = "admin";
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user: { role } }) }));

const row = { id: "d1", machine: { id: "m1", ID: "L1" }, name: "By the panel", keyId: "ld_abc", active: true, live: true, lastSeenAt: new Date().toISOString(), lastReading: { at: new Date().toISOString(), runSecondsTotal: 7200 * 50 }, firmware: "loom-sensor 1.0" };
const wrap = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><LoomSensors /></QueryClientProvider>);

beforeEach(() => { get.mockReset(); post.mockReset(); del.mockReset(); toast.mockReset(); role = "admin"; });

describe("loom sensors", () => {
  it("lists the boards, live or quiet, and adds one for a loom without — showing its key once", async () => {
    get.mockResolvedValue({ success: true, devices: [row] });
    wrap();
    const card = await screen.findByLabelText("Loom sensors");
    const line = (await within(card).findByText("L1")).closest("tr")!;
    expect(line).toHaveTextContent("By the panel");
    expect(line).toHaveTextContent("live");
    expect(line).toHaveTextContent("100 h");

    await userEvent.click(within(card).getByRole("button", { name: /add/i }));
    // A loom with a board already is not offered again.
    const select = screen.getByLabelText("Loom");
    expect(within(select).queryByRole("option", { name: "L1" })).not.toBeInTheDocument();
    await userEvent.selectOptions(select, "m2");
    post.mockResolvedValueOnce({ success: true, device: { ...row, id: "d2", machine: { id: "m2", ID: "L2" } }, key: "ld_new.secret123" });
    await userEvent.click(screen.getByRole("button", { name: "Add and show the key" }));
    expect(post).toHaveBeenCalledWith("/loom-sensor/devices", { machine: "m2", name: "" });
    expect(await screen.findByTestId("device-key")).toHaveTextContent("ld_new.secret123");
    expect(screen.getByRole("dialog")).toHaveTextContent("The key for L2");
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByTestId("device-key")).not.toBeInTheDocument());
  });

  it("makes a new key, shown once, and removes a board", async () => {
    get.mockResolvedValue({ success: true, devices: [row] });
    wrap();
    await screen.findByText("L1");
    post.mockResolvedValueOnce({ success: true, device: row, key: "ld_two.other" });
    await userEvent.click(screen.getByRole("button", { name: "New key for L1" }));
    // Retiring a key stops the board: one press only asks.
    expect(post).not.toHaveBeenCalledWith("/loom-sensor/devices/d1/key", {});
    await userEvent.click(screen.getByRole("button", { name: "Make a new key" }));
    expect(post).toHaveBeenCalledWith("/loom-sensor/devices/d1/key", {});
    expect(await screen.findByTestId("device-key")).toHaveTextContent("ld_two.other");
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    del.mockResolvedValueOnce({ success: true });
    await userEvent.click(screen.getByRole("button", { name: "Remove the sensor on L1" }));
    expect(del).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Remove sensor" }));
    expect(del).toHaveBeenCalledWith("/loom-sensor/devices/d1");
  });

  it("is the admin's only", () => {
    role = "production";
    const { container } = wrap();
    expect(container).toBeEmptyDOMElement();
    expect(get).not.toHaveBeenCalled();
  });
});
