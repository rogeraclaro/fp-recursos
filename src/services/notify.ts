export async function notifyWhatsApp(text: string): Promise<void> {
  const phone = import.meta.env.VITE_CALLMEBOT_PHONE
  const apikey = import.meta.env.VITE_CALLMEBOT_APIKEY
  if (!phone || !apikey) return
  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(text)}&apikey=${apikey}`
  try {
    await fetch(url, { mode: 'no-cors' })
  } catch {
    // best-effort
  }
}
