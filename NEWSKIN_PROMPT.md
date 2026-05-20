# Prompt per generar una nova skin

Copia el bloc de sota, substitueix la secció **"Skin que vull"** i enganxa-ho a qualsevol LLM.

---

```
Genera el bloc CSS per a una nova skin de l'aplicació fp-recursos.

## Sistema de variables

L'aplicació usa CSS custom properties. Una skin és UN BLOC que sobreescriu
totes les variables següents. Cap altra modificació.

## Skin de referència (brutal — la que ja existeix)

[data-skin="brutal"] {
  --skin-accent:        #fb923c;   /* color principal de marca (botons, badges, destacats) */
  --skin-accent-hover:  #fdba74;   /* variant més clara de l'accent (hover, secundari) */
  --skin-accent-active: #f97316;   /* variant més fosca de l'accent (active) */
  --skin-bg-page:       #f0f0f0;   /* fons de la pàgina */
  --skin-bg-surface:    #ffffff;   /* fons de cards, modals, inputs */
  --skin-text:          #000000;   /* text principal */
  --skin-text-muted:    #6b7280;   /* text secundari/fosc */
  --skin-border-color:  #000000;   /* color de tots els bordes */
  --skin-border-width:  2px;       /* amplada dels bordes (0 = sense borde) */
  --skin-radius:        0px;       /* border-radius global (0 = cantons rectes) */
  --skin-shadow-sm:     4px 4px 0px 0px #000000;          /* ombra petita (botons) */
  --skin-shadow-md:     6px 6px 0px 0px rgba(0,0,0,1);    /* ombra mitjana */
  --skin-shadow-lg:     8px 8px 0px 0px #000000;          /* ombra gran (modals) */
  --skin-shadow-card:   6px 6px 0px 0px rgba(0,0,0,1);    /* ombra de les cards */
  --skin-font-body:     ui-monospace, SFMono-Regular, Menlo, monospace;
  --skin-font-display:  ui-monospace, SFMono-Regular, Menlo, monospace;
}

## Restriccions

- NO canviis cap classe CSS, HTML ni JSX. NOMÉS les variables.
- Les ombres amb offset 0px i color transparent eliminen l'ombra.
- Si vols una font externa (ex: Google Fonts), afegeix l'@import corresponent JUST ABANS del bloc.
- --skin-bg-page i --skin-bg-surface han de tenir contrast llegible amb --skin-text.
- Tria un nom d'id curt, en minúscules i sense espais (ex: "dark", "cafe", "soft").

## Skin que vull

[DESCRIU AQUÍ: estil, colors, referència visual, to, inspiració...]

## Format de resposta

Torna ÚNICAMENT:
1. L'@import de la font (si cal)
2. El bloc CSS [data-skin="NOM-SKIN"] { ... } complet, amb totes les variables
3. L'entrada JS per al registre:
   { id: 'nom-skin', name: 'Nom visible', description: 'Una frase', accentColor: '#hexcolor' }
```

---

## Com aplicar el resultat

Un cop el model et retorni el codi, dues accions:

**1. `src/index.css`** — afegeix el bloc CSS al final del fitxer, just després del bloc `[data-skin="brutal"]`:

```css
/* Si porta @import, afegeix-lo a dalt de tot del fitxer */

[data-skin="nom-skin"] {
  /* ... variables generades ... */
}
```

**2. `src/skins/index.ts`** — afegeix l'entrada a l'array `SKINS`:

```ts
export const SKINS: SkinDef[] = [
  { id: 'brutal', name: 'Brutal', description: 'Neubrutalist clàssic', accentColor: '#fb923c' },
  { id: 'nom-skin', name: 'Nom visible', description: 'Una frase', accentColor: '#hexcolor' }, // ← nou
]
```

La skin apareixerà automàticament al selector. Cap altre canvi necessari.

---

## Exemples de descripcions que funcionen bé

- *"Minimalista japonès: fons crema càlid, sense ombres, bordes 1px grisos, accent verd fosc apagat, font serif"*
- *"Dark mode cyberpunk: fons gairebé negre, accent cyan neó, ombres de color en comptes de negre"*
- *"Pastels 90s: fons lila clar, accent rosa, ombres de color rosa, bordes arrodonits 8px, font sans-serif"*
- *"Corporate clean: fons blanc, accent blau, ombres grises subtils, bordes 1px, font sans-serif"*
