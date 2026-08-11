import { Link } from "@tanstack/react-router";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import placdaiLogo from "@/assets/trimmy-PlacdAI-logo-official.png";

/**
 * Drop <AuthGateProvider> once near the root of the app (e.g. in
 * src/routes/__root.tsx, wrapping the outlet/children — right next to
 * wherever your other top-level providers already live).
 *
 * Then anywhere deeper in the tree — the dashboard, the upload button,
 * a "generate" click handler, etc. — call:
 *
 *   const { requireAuth } = useAuthGate();
 *
 *   <Button onClick={() => requireAuth(() => startUpload(file))}>
 *     Upload
 *   </Button>
 *
 * If the user is already signed in, requireAuth runs the callback
 * immediately. If not, it opens the signup dialog in place — no route
 * change, no losing their spot on the dashboard — and only runs the
 * callback after they actually sign up (dialog closes itself on success
 * via useAuth's user state changing).
 */

type AuthGateContextValue = {
  requireAuth: (action: () => void, opts?: { reason?: string }) => void;
};

const AuthGateContext = createContext<AuthGateContextValue | null>(null);

export function useAuthGate() {
  const ctx = useContext(AuthGateContext);
  if (!ctx) throw new Error("useAuthGate must be used within <AuthGateProvider>");
  return ctx;
}

export function AuthGateProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | undefined>(undefined);
  // holds the action to run once the user signs up, without re-rendering on every keystroke
  const pendingAction = useRef<(() => void) | null>(null);

  const requireAuth = useCallback(
    (action: () => void, opts?: { reason?: string }) => {
      if (user) {
        action();
        return;
      }
      pendingAction.current = action;
      setReason(opts?.reason);
      setOpen(true);
    },
    [user],
  );

  // If the user becomes authenticated while the dialog is open (e.g. they
  // signed up in it), fire the pending action and close. This has to be
  // an effect, not code in the render body — running setState directly
  // during render works by accident most of the time, but React's dev-mode
  // double-render can invoke it twice before either update commits, which
  // was firing the pending action (e.g. buy()) twice in a row.
  useEffect(() => {
    if (user && open) {
      setOpen(false);
      const run = pendingAction.current;
      pendingAction.current = null;
      if (run) run();
    }
  }, [user, open]);

  return (
    <AuthGateContext.Provider value={{ requireAuth }}>
      {children}
      <SignUpDialog open={open} onOpenChange={setOpen} reason={reason} />
    </AuthGateContext.Provider>
  );
}

function SignUpDialog({
  open,
  onOpenChange,
  reason,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason?: string;
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
            Sign up to continue
          </DialogTitle>
          <DialogDescription className="text-[14.5px] text-gray-500">
            {reason ?? "Create a free account to save this design and unlock your first free generation — no card required."}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 flex flex-col gap-3">
          <Button asChild size="lg" className="rounded-full bg-[#1C1C1C] py-6 text-[15px] font-semibold text-white hover:bg-[#2d2d2d]">
            <Link to="/login" search={{ mode: "signup" }} onClick={() => onOpenChange(false)}>
              Sign up
            </Link>
          </Button>
          <Button asChild variant="ghost" className="text-[13.5px] text-gray-500 hover:text-[#1C1C1C]">
            <Link to="/login" search={{ mode: "login" }} onClick={() => onOpenChange(false)}>
              Already have an account? Log in
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}