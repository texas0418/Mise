/**
 * components/AlertHost.tsx — native
 *
 * Nothing to render. On native `appAlert` calls straight through to
 * `Alert.alert`, which the OS draws itself.
 *
 * This file exists so `app/_layout.tsx` can mount `<AlertHost />` once,
 * unconditionally, without a platform check at the call site — the web build
 * resolves `AlertHost.web.tsx` instead, which is where the modal lives.
 */
export default function AlertHost(): null {
  return null;
}
