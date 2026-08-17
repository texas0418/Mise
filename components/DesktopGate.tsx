/**
 * components/DesktopGate.tsx
 *
 * On a device, there is no gate: the app is the app.
 *
 * The desktop build requires a subscription (see the .web variant), but a
 * phone or iPad has its own per-feature entitlement and a free tier that has
 * always worked. Gating the whole native app behind Pro would take Mise away
 * from people who already use it for free, which is a different decision
 * entirely and not one anyone made.
 */
import React from 'react';

export default function DesktopGate({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
