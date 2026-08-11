FIRST AND FOREMOST: make sure the code you add stays in line with good modern software development principles

# Secret-handling policy

Never read, open, search inside, summarize, quote, infer, or transform files matching:
- .env
- .env.*
- .env*
- .envrc
- dev.env
- local.env
- .dev.vars
- .dev.vars.*
- secrets.yml
- secrets.yaml
- secret.yaml
- secret.yml
- *.pem
- *.key
- *.cert
- *.crt
- .npmrc
- .pypirc
- .netrc
- credentials.json
- service-account*.json
UNLESS I EXPLICITELY tell you to use a specific credential,password,key,or secrets file inside a specific file and tell you it's okay to do so, or say 'PERMISSIONS OVERRIDE GIVEN'

If a task requires secret values, ask for redacted placeholders instead.

THe project has a .venv at the root, use that for any and all python commands.
pytest is installed here: .venv/bin/pytest

- Make as small of a dif as possible!!
- Do not go outside the scope of your assigned task in any way!
- Do not do any refactoring, style fixing, or any alterations unless explicitely asked to do so.
- Prioritize simple, concise solutions to complex large changes and features.
- Do not use icons or emojis anywhere.


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



###

make sure the code you add stays in line with good modern software development principles, SOLID, DRY,
and follows best practices IN ALL SITUATIONS, AT ALL TIMES, FOR ALL CHANGES, REGARDLESS OF HOW SMALL OR LARGE THE ASK IS. However, what is extremely important is that you do not add any bloat to this. I dont want any
new features, functionality, or complexity that I didn't explicitly ask for!
---
If the request involves re-factoring things, then you should be looking to delete as much of the old code as possible rather than including them as fallbacks or duplicate junk. You should never try to increase the amount of code if possible, but always look to reduce code size if possible. ANY AND ALL ORPHANED CODE YOU CREATE MUST ALWAYS BE DELETED, OR MADE KNOWN TO ME IN LARGE BOLD GIGANTIC FONT NO LESS THAN 5 TIMES IN 5 SEPERATE PLACES SO I DONT MISS THIS FACT WHEN IM SKIMMING YOUR OUTPUT.

---
if you're missing some files/code that is critical to finishing this IN A ROBUST, PROPER, BEST PRACTICES,
ENTERPRISE FASHION then DO NOT GUESS! DO NOT WORK AROUND WHAT YOUR MISSING! DO NOT COMPRIMISE FOLLOWING
ARCHITECTURAL BEST PRACTICES, DO NOT COMPRIMISE FOLLOWING SOLID, DRY, PROPER, MODERN DESIGN PRINCIPLES OR PATTERNS;

Follow best modern development practices!

Before writing any code, think of every file you need to do this properly!
If even one is missing, stop and ask for it in this format:
"filename.html"
"subfolder-of-repo-root/filename2.html"
— output nothing else that turn, but an explanation of why you cannot solve the problem without violating a best practice, or providing a less than optimal solution.
 DO NOT PROCEED UNTIL YOU HAVE WHAT YOU NEED TO DO THIS PROPERLY! OTHERWISE IF YOU HAVE EVERYTHING YOU NEED, PROCEED.

A workaround to is a failure, not a partial answer. Specifically banned (this is not an exclusive list by any stretch):
- Parsing or regexing a string the backend built for display
- Re-creating a color, constant, enum, style, or function that likely exists elsewhere
- Presentation logic in the backend; domain logic in JS, CSS in html
- Merging responsibilities that belong apart because you lack the other file
- Other shortcuts and half measures which violate modern best practices in any way...

---
Before outputting your solution, ask yourself if this code is in allignment with modern architectural design and developmental best practices (like DRY, SOLID); for the language, framework, library, etc. if your code is not of a quality that could be used in official documentation demonstrating one of the most robust ways of solving the particular problem while utilizing principal level developer quality, then you need to reconsider your approach, or ask for explicit approval from me allowing you to return less than best quality code. Otherwise assume it is not acceptable and re-design your solution accordingly.

FIRST, LAST, ALWAYS AND FOREMOST: make sure the code you add stays in line with good modern software development principles

UPON COMPLETION, DOUBLE-CHECK THAT: the code you add stays in line with good modern software development principles. IF NOT, CONSIDER THE CODE PRODUCED UNACCEPTABLE AND DELETE ANY AND ALL OF IT THAT DOESN'T MEET THAT STANDARD WITHOUT ANY HESITATION.