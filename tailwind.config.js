/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                accent:         'var(--skin-accent)',
                'accent-hover': 'var(--skin-accent-hover)',
                page:           'var(--skin-bg-page)',
                surface:        'var(--skin-bg-surface)',
            }
        }
    },
    plugins: [],
}