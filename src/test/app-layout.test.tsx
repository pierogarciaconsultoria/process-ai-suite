import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth } }));
vi.mock("@/components/AppSidebar", () => ({ AppSidebar: () => <aside>Sidebar</aside> }));

import { AppLayout } from "@/components/AppLayout";

function CurrentLocation() {
  const location = useLocation();
  return <div>{`${location.pathname}${location.search}`}</div>;
}

function renderLayout(path = "/processos?tab=recentes") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<CurrentLocation />} />
        <Route element={<AppLayout />}>
          <Route path="/processos" element={<div>Conteúdo protegido</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("AppLayout authentication", () => {
  beforeEach(() => {
    auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });

  it("redirects an anonymous visitor and preserves the safe destination", async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    renderLayout();
    expect(await screen.findByText("/login?redirect=%2Fprocessos%3Ftab%3Drecentes")).toBeInTheDocument();
  });

  it("renders protected content for an authenticated user", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: "user-a" } } }, error: null });
    renderLayout();
    expect(await screen.findByText("Conteúdo protegido")).toBeInTheDocument();
  });

  it("finishes loading and redirects when session lookup fails", async () => {
    auth.getSession.mockRejectedValue(new Error("network"));
    renderLayout();
    await waitFor(() => expect(screen.queryByText("Verificando sessão...")).not.toBeInTheDocument());
    expect(screen.getByText(/\/login\?redirect=/)).toBeInTheDocument();
  });
});
