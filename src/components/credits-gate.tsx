import { Link } from "@tanstack/react-router";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Coins } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import placdaiLogo from "@/assets/trimmy-PlacdAI-logo-official.png";

/**
 * Drop <CreditsGateProvider> once near the root (alongside
 * <AuthGateProvider> in __root.tsx — doesn't need to be inside
 * AuthProvider, since it's only ever reached by someone already signed
 * in with a credit balance).
 *
 * Two things any credit-spending action needs, both exposed via
 * useCreditsGate():
 *
 *   confirmSpend(action, opts?)
 *     Shows a "this uses 1 credit" confirmation first. Only runs
 *     `action` if the user confirms. Use this for anything NOT already
 *     warned about elsewhere in the UI (e.g. the Retry button) — the
 *     main Generate button doesn't need this, its cost is already
 *     obvious from the flow.
 *
 *   showOutOfCredits()
 *     Call this directly whenever a /api/consume-credit call actually
 *     comes back 402. Pops the same-styled "buy more" dialog instead of
 *     a toast + silent redirect, so it doesn't feel like the click just
 *     did nothing.
 */

type CreditsGateContextValue = {
  confirmSpend: (action: () => void | Promise<void>, opts?: { reason?: string }) => void;
  showOutOfCredits: () => void;
};

const CreditsGateContext = createContext<CreditsGateContextValue | null>(null);

export function useCreditsGate() {
  const ctx = useContext(CreditsGateContext);
  if (!ctx) throw new Error("useCreditsGate must be used within <CreditsGateProvider>");
  return ctx;
}

export function CreditsGateProvider({ children }: { children: ReactNode }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmReason, setConfirmReason] = useState<string | undefined>(undefined);
  const [outOfCreditsOpen, setOutOfCreditsOpen] = useState(false);
  const pendingAction = useRef<(() => void | Promise<void>) | null>(null);

  const confirmSpend = useCallback((action: () => void | Promise<void>, opts?: { reason?: string }) => {
    pendingAction.current = action;
    setConfirmReason(opts?.reason);
    setConfirmOpen(true);
  }, []);

  const showOutOfCredits = useCallback(() => setOutOfCreditsOpen(true), []);

  const runPending = () => {
    setConfirmOpen(false);
    const run = pendingAction.current;
    pendingAction.current = null;
    if (run) void run();
  };

  return (
    <CreditsGateContext.Provider value={{ confirmSpend, showOutOfCredits }}>
      {children}
      <ConfirmSpendDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        reason={confirmReason}
        onConfirm={runPending}
      />
      <OutOfCreditsDialog open={outOfCreditsOpen} onOpenChange={setOutOfCreditsOpen} />
    </CreditsGateContext.Provider>
  );
}

function ConfirmSpendDialog({
  open,
  onOpenChange,
  reason,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason?: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl border-[#E8E8E4] p-8 text-center sm:max-w-sm">
        <DialogHeader className="items-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#8BA888]/15">
            <Coins className="h-5 w-5 text-[#8BA888]" />
          </div>
          <DialogTitle className="text-2xl font-semibold tracking-[-0.02em] text-[#1C1C1C]">
            Use 1 credit?
          </DialogTitle>
          <DialogDescription className="text-[14.5px] text-gray-500">
            {reason ?? "Retrying this item will use 1 credit from your balance."}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 flex gap-3">
          <Button variant="outline" className="flex-1 rounded-full border-[#E8E8E4] py-6 text-[15px] font-medium text-[#1C1C1C]" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="flex-1 rounded-full bg-[#1C1C1C] py-6 text-[15px] font-semibold text-white hover:bg-[#2d2d2d]" onClick={onConfirm}>
            Use 1 credit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OutOfCreditsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl border-[#E8E8E4] p-8 text-center sm:max-w-sm">
        <DialogHeader className="items-center">
          <div className="mb-5 flex items-center gap-2.5">
            <img src={placdaiLogo} alt="" className="h-8 w-8" />
            <span className="text-xl font-semibold tracking-[-0.01em] text-[#1C1C1C]">
              Placd<span className="text-[#8BA888]">AI</span>
            </span>
          </div>
          <DialogTitle className="text-2xl font-semibold tracking-[-0.02em] text-[#1C1C1C]">
            You're out of credits
          </DialogTitle>
          <DialogDescription className="text-[14.5px] text-gray-500">
            Pick a credit pack to keep designing — credits never expire.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6">
          <Button asChild size="lg" className="w-full rounded-full bg-[#1C1C1C] py-6 text-[15px] font-semibold text-white hover:bg-[#2d2d2d]">
            <Link to="/buy-credits" onClick={() => onOpenChange(false)}>
              View pricing
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}