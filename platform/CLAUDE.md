# Mutabaa platform

## Release numbers (every change that ships)

Every update that reaches production gets a new version, shown in the footer of every page and on `/changelog`.

- **Small update** (fixes, polish, one modest feature): raise the number after the dot, e.g. 3.3 → 3.4.
- **Major update** (a new module, a redesign, a large set of features): raise the whole number and reset the decimal, e.g. 3.4 → 4.0.

To release:

1. Add an entry at the top of `RELEASES` in `src/lib/releases.ts`: `version`, Riyadh `date`, `kind` (`minor` or `major`), and notes in Arabic (`ar`) and English (`en`) with the same number of lines.
2. Set `"version"` in `package.json` and both root `"version"` fields in `package-lock.json` to `<version>.0`.
3. `npm test` checks the numbering rules and that `package.json` matches.
