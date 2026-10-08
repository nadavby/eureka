import { ReactNode } from "react";

/** Centered card on paper, with a manila tag edge along the top. */
export const AuthLayout = ({ title, lead, children, footer }: { title: string; lead: string; children: ReactNode; footer: ReactNode }) => (
  <div className="mx-auto flex w-full max-w-md flex-col px-4 py-10 sm:py-16">
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div aria-hidden className="h-2 bg-manila" />
      <div className="p-6 sm:p-8">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{lead}</p>
        <div className="mt-6">{children}</div>
      </div>
    </div>
    <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
  </div>
);
