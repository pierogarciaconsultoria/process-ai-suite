import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: auth.getSession, onAuthStateChange: auth.onAuthStateChange },
    functions: { invoke: auth.invoke },
  },
}));

import SupportWidget from "@/components/SupportWidget";

describe("SupportWidget authentication", () => {
  beforeEach(() => {
    auth.invoke.mockClear();
    auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });

  it("does not expose or call the AI help function for anonymous visitors", async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    render(<SupportWidget />);
    await waitFor(() => expect(auth.getSession).toHaveBeenCalled());
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(auth.invoke).not.toHaveBeenCalled();
  });

  it("shows the help trigger for an authenticated user", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: "user-a" } } }, error: null });
    render(<SupportWidget />);
    expect(await screen.findByRole("button")).toBeInTheDocument();
  });
});
