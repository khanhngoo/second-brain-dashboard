import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { PillarFilterProvider } from "../state/pillarFilter";
import { TaskDrawerProvider } from "../state/taskDrawer";
import { BlockDrawerProvider } from "../state/blockDrawer";
import { BlockDrawer } from "../components/BlockDrawer";

export function renderWithProviders(ui: ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <PillarFilterProvider>
          <BlockDrawerProvider>
            <TaskDrawerProvider>
              {children}
              <BlockDrawer />
            </TaskDrawerProvider>
          </BlockDrawerProvider>
        </PillarFilterProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(ui, { wrapper: Wrapper });
}
