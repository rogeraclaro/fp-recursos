export interface SkinDef {
  id: string
  name: string
  description: string
  accentColor: string
}

export const SKINS: SkinDef[] = [
  { id: 'brutal', name: 'Brutal', description: 'Neubrutalist clàssic', accentColor: '#fb923c' },
  // Afegir nous skins aquí + bloc CSS a index.css
]
