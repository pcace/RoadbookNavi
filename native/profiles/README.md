# Bundled routing profiles

RoadbookNavi ships five BRouter profiles: `enduro`, `enduro-easy`,
`enduro-medium`, `enduro-hard`, and `enduro_new`. The engine preparation script
copies these files to `native/brouter/resources/profiles2`, so desktop and Android
builds use the same routing rules.

`enduro` and `enduro_new` use the canonical `railway=abandoned` value expected by
the bundled BRouter lookup data. This is equivalent to the upstream `disused`
alias and does not change the profiles' routing preferences.

The profiles have been exercised with the bundled engine and local RD5 data.
These smoke tests establish parser and data compatibility; they do not guarantee
route quality in every region. An app update does not overwrite profiles that a
user has already imported under the same name.
