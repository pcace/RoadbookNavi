# Bundled routing profiles

BRouter profiles: `enduro`, `enduro-easy`, `enduro-medium`, `enduro-hard`, and
`enduro_new`.

`pnpm engine:build` copies them to `native/brouter/resources/profiles2` for
desktop and Android. App updates do not overwrite profile files already present
under the same name. The interface offers the supplied profiles; it has no
user-facing profile import.
