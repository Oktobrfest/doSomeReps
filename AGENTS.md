## Button styling architecture

Standard design-token architecture with base + modifier composition.
Prior art: Bootstrap 5 buttons, GitHub Primer.

References:
- W3C Design Tokens spec — https://tr.designtokens.org/format/
- ITCSS layering — https://csswizardry.com/2018/11/itcss-scalable-and-maintainable-css-architecture/
- BEM modifiers — https://getbem.com/naming/
- CSS Modules `composes:` — https://github.com/css-modules/css-modules
- Bootstrap 5 buttons — https://getbootstrap.com/docs/5.3/components/buttons/
- Every Layout "Cluster" — https://every-layout.dev/layouts/cluster/

### Our implementation

Tokens (`--rep-*`): `frontend/src/styles/global.css` `:root` only.
  Two-tier: `--rep-btn-height-md` (primitive) → `--rep-btn-height` (semantic alias).
Base + modifiers: `frontend/src/styles/shared.module.css`
  Base: `.actionButton` (46px), `.button` (small/dialog)
  Size: `.buttonSm`  |  Intent: `.btnRed .btnBlue .btnCyan .btnAmber .btnSlate`
  Layout: `.actionRow`, `.actionCluster`
Audio tiles are a separate scale (`--rep-tile-*`), intentionally not `--rep-btn-*`.

### Rules
1. No px/rem for button geometry outside global.css `:root`.
2. Base classes contain zero literals and set no color.
3. Size modifiers rebind the semantic aliases only; no geometry of their own.
4. Intent modifiers set background-color + color only.
5. Components compose base + modifiers and add zero geometry.
6. Component CSS sets flow only (display/gap/flex), never control size.
7. No @media or @container rules that change button size.

### Never
- Never introduce a hex, rgb, or rgba literal in any file outside `global.css` `:root`.
  If the colour you need has no token, add one. That is a one-line change.
- Never add `border`, `padding`, `font-size`, `font-weight`, `border-radius`,
  `box-shadow`, `width`, `height`, or `white-space` to a class that composes
  `.actionButton` or `.button`. Flow only: `margin*`, `order`, `flex*`, `gap`,
  `display`, `align-*`, `justify-*`.
- UNLESS TOTALLY UNAVOIDABLE- dont use `!important` in a CSS Module. If a rule seems to need it, the cascade
  is wrong; fix the cascade.
- Never implement hover with `onMouseEnter`/`onMouseLeave`. Use `:hover` in CSS.
- Never put `backgroundColor`, `borderRadius`, `boxShadow`, `padding`, `fontSize`,
  or `transition` in a React inline `style={{}}` on any control.

### Missing variant
If the size, intent, or colour you need does not exist, DO NOT approximate it
inline. Add it: token(s) to `global.css` `:root`, one modifier rule in
`shared.module.css`, then use it.
