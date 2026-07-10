import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { PillarFilterProvider } from "./state/pillarFilter";
import { TaskDrawerProvider } from "./state/taskDrawer";
import { BlockDrawerProvider } from "./state/blockDrawer";
import { DurationPromptProvider } from "./state/durationPrompt";
import { DurationPromptDialog } from "./components/DurationPromptDialog";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, refetchOnWindowFocus: false } },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <PillarFilterProvider>
          <BlockDrawerProvider>
            <TaskDrawerProvider>
              <DurationPromptProvider>
                <App />
                <DurationPromptDialog />
              </DurationPromptProvider>
            </TaskDrawerProvider>
          </BlockDrawerProvider>
        </PillarFilterProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
