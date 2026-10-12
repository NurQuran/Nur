export function haptic(kind: string) {
  try {
    if (window.NurAndroid?.performHaptic) { window.NurAndroid.performHaptic(kind); return; }
    if (!navigator.vibrate) return;
    navigator.vibrate(kind === "warning" ? [18, 32, 24] : kind === "medium" ? 18 : 8);
  } catch {}
}
