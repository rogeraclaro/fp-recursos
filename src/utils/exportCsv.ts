import type { Bookmark } from '../types/database'

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

export function exportBookmarksToCsv(bookmarks: Bookmark[]): void {
  const headers = ['Títol', 'URL', 'Descripció', 'Categories', 'Data', 'Autor']
  const rows = bookmarks.map((b) => [
    csvCell(b.title),
    csvCell(b.url),
    csvCell(b.description),
    csvCell(b.categories.join('; ')),
    csvCell(formatDate(b.created_at)),
    csvCell(b.profiles?.username ?? ''),
  ])

  const csv = [headers.map(csvCell), ...rows].map((r) => r.join(',')).join('\r\n')

  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = now.getFullYear()
  const filename = `recursosFP-Masellas-${dd}-${mm}-${yyyy}.csv`

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
