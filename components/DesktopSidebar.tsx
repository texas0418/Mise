/**
 * components/DesktopSidebar.tsx — native
 *
 * Nothing to render. On a phone or tablet the navigation is the tab bar that
 * `app/(tabs)/_layout.tsx` already draws, and it behaves correctly: opening a
 * tool is a push onto a stack, and the way back is the back button.
 *
 * The web build resolves `DesktopSidebar.web.tsx` instead, which is where the
 * persistent version lives and why it has to exist at all.
 */
export default function DesktopSidebar(): null {
  return null;
}
