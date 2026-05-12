// ═══════════════════════════════════════════════════════════
//  TEMA DE COLORS — AI Bookmarks
//  Edita aquí els colors per mode clar i mode fosc
// ═══════════════════════════════════════════════════════════

export const theme = {
  // ── Pàgina principal ─────────────────────────────────────
  page:        'min-h-screen bg-[#f0f0f0] dark:bg-[#e8e0d0] text-black pb-20',

  // ── Capçalera ─────────────────────────────────────────────
  header:      'bg-white dark:bg-[#d4c9b0] border-b-4 border-black p-6 shadow-md',

  // ── Nav sticky de categories ──────────────────────────────
  stickyNav:   'hidden md:block sticky top-0 z-40 bg-[#f0f0f0]/95 dark:bg-[#e8e0d0]/95 backdrop-blur border-b-2 border-black py-3 px-6 shadow-sm',

  // ── Pantalla de càrrega inicial ───────────────────────────
  loadingPage:    'min-h-screen bg-[#f0f0f0] dark:bg-[#e8e0d0] flex flex-col items-center justify-center gap-4',
  loadingSpinner: 'w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin',
  loadingText:    'font-mono font-bold uppercase text-sm text-black',
}
