import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { type ReactNode } from "react";

import appCss from "../styles.css?url";
import { AuthProvider } from "../lib/auth";
import { AuthGateProvider } from "../components/auth-gate";
import { CreditsGateProvider } from "../components/credits-gate";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "PlacdAI — Shop the AI Look" },
      { name: "description", content: "Upload a photo of your room, pick a style, and PlacdAI generates a redesigned version plus real buyable products to match the look." },
      { name: "author", content: "PlacdAI" },
      { property: "og:title", content: "PlacdAI — Shop the AI Look" },
      { property: "og:description", content: "Upload a photo of your room, pick a style, and PlacdAI generates a redesigned version plus real buyable products to match the look." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      // IMPORTANT: this points at a file in public/ (not src/assets), so
      // the URL is always exactly "/favicon.png" — it never changes on
      // rebuild. Google's favicon guidelines explicitly require a STABLE
      // url; a hashed src/assets import (e.g. /assets/foo-C1AvCtR1.png)
      // changes on every edit, which looks like a brand new resource to
      // Google each time and resets its favicon cache. Do not switch
      // this back to an imported asset, and do not rename this file —
      // if you ever need to change the logo image itself, overwrite
      // public/favicon.png in place and keep this exact path.
      { rel: "icon", href: "/favicon.png", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* Needs to be inside AuthProvider (reads useAuth) and outside
            Outlet (one dialog instance for the whole app — any route can
            call useAuthGate() to gate an action behind signup). */}
        <AuthGateProvider>
          <CreditsGateProvider>
            {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
            <Outlet />
          </CreditsGateProvider>
        </AuthGateProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}