# Bundled routing profiles

BRouter profiles: `enduro`, `enduro-easy`, `enduro-medium`, `enduro-hard`, and
`enduro_new`.

`pnpm engine:build` copies them to `native/brouter/resources/profiles2` for
desktop and Android. App updates do not overwrite profiles already imported
under the same name.
