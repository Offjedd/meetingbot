"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            "group bg-card text-card-foreground border border-border rounded-lg shadow-lg",
          description: "text-muted-foreground",
        },
      }}
    />
  );
}
