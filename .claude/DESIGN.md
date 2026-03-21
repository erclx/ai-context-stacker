# Design

Capture visual intent and the decisions behind it: the why behind how things look. Not a style guide, component spec, or framework reference. Update this doc when a visual decision is made or a rule changes.

What belongs:

- Tokens described as intent ("mid gray, muted text"), not computed values; exact values live in code
- Layout constraints and sizing rules not obvious from wireframes
- Visual rules a developer could get wrong without guidance
- Non-obvious omissions ("no motion", "no custom icons") that prevent scope creep

What does not belong:

- CSS classes, computed values, component filenames, or prop names; those live in code
- UX copy and interaction flows, which live in WIREFRAMES.md
- Anything that requires updating every time the code is refactored

Use tables for token systems, one row per token. Use short bullets for component rules, one decision per line. Plain English over technical notation. If a section could be removed and the developer would still build it correctly from wireframes and code alone, remove it.

## Personality

Lean and utilitarian. The extension is a tool, not a feature showcase. It should look like a natural part of VS Code, not a product bolted onto it.

## Color

Use VS Code theme tokens exclusively. No hardcoded colors anywhere in the extension. The one exception is token count severity: use VS Code's semantic warning and error colors (not custom values) to signal file weight.

| Token                  | Intent                                             |
| ---------------------- | -------------------------------------------------- |
| Default text           | File names, track names, counts                    |
| Muted/description text | Placeholder copy, secondary labels                 |
| Warning color          | File token count above the large-file threshold    |
| Error color            | File token count above 2x the large-file threshold |

## Typography

VS Code defaults throughout. No custom font sizes, weights, or families.

## Spacing

VS Code tree item defaults throughout. No custom padding or margin overrides.

## Borders

None added. VS Code panel chrome handles all structural separation.

## Motion

None. No animations, transitions, or loading spinners. Tree updates render immediately; token count placeholders replace in place when analysis completes.

## Icons

Use VS Code Codicons exclusively. No custom SVG icons in the tree or toolbar, except the activity bar icon which is required by the extension manifest.
