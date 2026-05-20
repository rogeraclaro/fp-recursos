export interface SkinDef {
	id: string
	name: string
	description: string
	accentColor: string
}

export const SKINS: SkinDef[] = [
	{ id: 'brutal', name: 'Brutal', description: 'Neubrutalist clàssic', accentColor: '#fb923c' },
	{ id: 'pastel90s', name: 'Pastels 90s', description: 'Estil 90s amb colors pastel', accentColor: '#f472b6' },
	{
		id: 'wabi',
		name: 'Wabi',
		description: 'Inspirat en el wabi-sabi japonès, amb colors terrosos i tipografia serif',
		accentColor: '#4a6741',
	},
	{
		id: 'cyber',
		name: 'Cyber',
		description: 'Estil cyberpunk amb colors neon',
		accentColor: '#00ffe7',
	},
	{
		id: 'corp',
		name: 'Corp',
		description: 'Estil corporate amb colors neutres',
		accentColor: '#2563eb',
	},

	// Afegir nous skins aquí + bloc CSS a index.css
]
