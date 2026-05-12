// Supabase — substituir pels valors reals del projecte Supabase
export const SUPABASE_URL = 'https://placeholder.supabase.co'
export const SUPABASE_ANON_KEY = 'placeholder-anon-key'
export const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/suggest-resource`

export const ERRORS = {
	NO_TITLE: 'El títol no pot estar buit',
	TITLE_TOO_LONG: 'El títol no pot superar els 80 caràcters',
	DUPLICATE: 'Aquest enllaç ja està guardat',
	API_ERROR: 'Error de connexió amb el servidor',
	UNKNOWN: 'Error desconegut. Torna-ho a intentar.',
	AUTH_FAILED: 'Credencials incorrectes. Comprova email i contrasenya.',
}

export const UI_STRINGS = {
	TITLE: 'FP Recursos',
	LOADING: 'Carregant informació...',
	SAVE: 'Guardar recurs',
	CANCEL: 'Cancel·lar',
	CLOSE: 'Tancar',
	RETRY: 'Reintentar',
	LABEL_TITLE: 'Títol:',
	LABEL_DESCRIPTION: 'Descripció:',
	LABEL_AUTHOR: 'Autor:',
	LABEL_URL: 'URL:',
	LABEL_CATEGORIES: 'Categories:',
	SUCCESS: 'Recurs guardat correctament!',
	DUPLICATE_WARNING: 'Aquest recurs ja existeix!',
	DUPLICATE_MESSAGE: 'Aquesta pàgina ja està guardada a la teva col·lecció.',

	TABS_HEADING: 'Pestanyes Obertes',
	TABS_SAVE_THIS_PAGE: 'Guardar pàgina',
	TABS_FILTER_ALL: 'Totes',
	TABS_FILTER_UNGROUPED: 'Sense grup',
	TABS_SELECT_ALL: 'Seleccionar-ho tot',
	TABS_DESELECT_ALL: 'Desseleccionar tot',
	TABS_SAVE_BUTTON: (n: number) => `Guardar ${n} pestanyes`,
	TABS_CONFIRM_TITLE: 'Confirmar guardat',
	TABS_CONFIRM_MESSAGE: (n: number) => `Segur que vols guardar ${n} pestanyes?`,
	TABS_CONFIRM_YES: 'Guardar',
	TABS_CONFIRM_CANCEL: 'Cancel·lar',
	TABS_SAVING_HEADING: 'Guardant pestanyes...',
	TABS_SUMMARY_HEADING: 'Guardat completat',
	TABS_SUMMARY_SAVED: (n: number) => `${n} guardats ✓`,
	TABS_SUMMARY_FAILED: (n: number) => `${n} fallits ✗`,
	TABS_RETRY_FAILED: (n: number) => `Reintentar ${n} fallits`,
	TABS_CLOSE: 'Tancar',
	TABS_ALREADY_SAVED_BADGE: '✓ guardat',
	TABS_LOADING: 'Carregant pestanyes...',
	TABS_EMPTY: 'No hi ha pestanyes obertes',
	TABS_CATEGORIZING_HEADING: 'Categoritzant amb IA...',
	TABS_REVIEW_HEADING: 'Revisa les categories',
	TABS_REVIEW_ADD_PLACEHOLDER: 'Afegir categoria...',
	TABS_REVIEW_SAVE_BUTTON: (n: number) => `Guardar ${n} pestanyes`,
	TABS_REVIEW_NO_CATEGORIES: 'Sense categoria',
	TABS_REVIEW_OPEN_TAB: 'Obrir pestanya',
}
