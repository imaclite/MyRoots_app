import { useEffect } from "react";
import { Toaster } from "sonner";
import { copy } from "@/lib/tree/copy";
import { useTreeStore } from "@/lib/tree/store";
import { Button } from "@/components/ui/button";
import { ActionDock } from "./action-dock";
import { AppDialogs } from "./dialogs";
import { FanChart } from "./fan-chart";
import { Header } from "./header";
import { HousesView } from "./houses-view";
import { PersonFile } from "./person-file";
import { SidePanels } from "./side-panels";
import { TreeCanvas } from "./tree-canvas";

export function AppShell() {
  const hydrate = useTreeStore((s) => s.hydrate);
  const hydrated = useTreeStore((s) => s.hydrated);
  const view = useTreeStore((s) => s.view);
  const showDemoBanner = useTreeStore((s) => s.showDemoBanner);
  const dismissBanner = useTreeStore((s) => s.dismissBanner);
  const openDialog = useTreeStore((s) => s.openDialog);
  const people = useTreeStore((s) => s.people);
  const empty = Object.keys(people).length === 0;
  const fileId = useTreeStore((s) => s.fileId);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) useTreeStore.getState().redo();
        else useTreeStore.getState().undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-dvh flex-col bg-cream text-ink">
      <Header />
      {showDemoBanner && hydrated ? (
        <div className="z-10 flex flex-wrap items-center justify-center gap-2 border-b border-ink/8 bg-paper px-3 py-2 text-sm">
          <span className="rounded-full bg-cream px-3 py-1 text-ink-soft shadow-[0_0_0_1px_rgba(28,33,28,0.06)]">
            {copy.demoBanner}
          </span>
          <Button size="sm" variant="outline" onClick={() => openDialog("confirm-new")}>
            {copy.startNew}
          </Button>
          <Button size="sm" variant="ghost" onClick={dismissBanner}>
            {copy.dismiss}
          </Button>
        </div>
      ) : null}

      <main className="relative min-h-0 flex-1">
        {empty && view === "tree" ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="text-lg font-semibold">{copy.emptyTree}</p>
            <Button onClick={() => openDialog("first-person")}>{copy.firstPerson}</Button>
          </div>
        ) : view === "tree" ? (
          <TreeCanvas />
        ) : view === "houses" ? (
          <HousesView />
        ) : (
          <FanChart />
        )}
        {view === "tree" && !fileId ? <ActionDock /> : null}
        <PersonFile />
      </main>

      <AppDialogs />
      <SidePanels />
      <Toaster position="top-center" dir="rtl" richColors closeButton />
    </div>
  );
}
