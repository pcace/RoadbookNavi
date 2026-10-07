## [1.39.0](https://github.com/pcace/RoadbookNavi/compare/v1.38.5...v1.39.0) (2026-10-07)

### New features

- load map and routing data on demand ([#9](https://github.com/pcace/RoadbookNavi/issues/9)) ([e261a98](https://github.com/pcace/RoadbookNavi/commit/e261a98cf57d65778a0c8dad40cb95aa13f372fe)), closes [#4](https://github.com/pcace/RoadbookNavi/issues/4) [#5](https://github.com/pcace/RoadbookNavi/issues/5)
- **map:** use on-demand OpenFreeMap and BRouter data ([61116e3](https://github.com/pcace/RoadbookNavi/commit/61116e33fd4088137060d18642df8d4dc635cba2))
- **obf-bridge:** resident OBF query service with vendored sources and build script ([baaf442](https://github.com/pcace/RoadbookNavi/commit/baaf442a377742288b05d0eaf24602c87e25e972))
- **obf-bridge:** rust bridge client with end-to-end test against real OBF ([56ab3ea](https://github.com/pcace/RoadbookNavi/commit/56ab3eab3a925f8675316b6b4117ec490406b8f5))
- **obf:** rebuild storage, catalogue and install around OBF bridge; drop legacy import pipeline ([b5658da](https://github.com/pcace/RoadbookNavi/commit/b5658da967e343823b4c5f84f42ac30566628ebb))
- **settings:** add GitHub release update check ([4cc28c6](https://github.com/pcace/RoadbookNavi/commit/4cc28c6b1d8bd949773c57200873443fe5c28ec7))

### Bug fixes

- :bug: windows routing problems ([f1738cc](https://github.com/pcace/RoadbookNavi/commit/f1738ccf9e3bc98797ed3baeb5ef5842b2cebd96))
- **route-builder:** remove obsolete distance limits ([616c058](https://github.com/pcace/RoadbookNavi/commit/616c05830611fa0acc4bb715f3476d0d43eaf702))
- synchronize main with current dev ([99f0384](https://github.com/pcace/RoadbookNavi/commit/99f03843a421570c3d415c2842f2b5d9bcecc494))
- **windows:** normalize routing engine paths ([f260d46](https://github.com/pcace/RoadbookNavi/commit/f260d46026fad020490d6d77cee2b04b50580f72))

### Documentation

- **obf-spike:** license assessment for OBF data, jars and download endpoint ([9160248](https://github.com/pcace/RoadbookNavi/commit/9160248b89306ec04996f1020c7c095a3e4fc017))
- **region-format:** document OsmAnd OBF spike results and reproduction ([c6e2bda](https://github.com/pcace/RoadbookNavi/commit/c6e2bda130d5b55bebb87d031e8d6f0b6ac2edd1))

### Build and dependencies

- close pull requests with malformed titles ([#4](https://github.com/pcace/RoadbookNavi/issues/4)) ([#5](https://github.com/pcace/RoadbookNavi/issues/5)) ([8172144](https://github.com/pcace/RoadbookNavi/commit/8172144a5c7c47d2759f2ecbb638c3862a56f4bd))

## [1.39.0-beta.5](https://github.com/pcace/RoadbookNavi/compare/v1.39.0-beta.4...v1.39.0-beta.5) (2026-10-04)

### Bug fixes

- **route-builder:** remove obsolete distance limits ([616c058](https://github.com/pcace/RoadbookNavi/commit/616c05830611fa0acc4bb715f3476d0d43eaf702))

## [1.39.0-beta.4](https://github.com/pcace/RoadbookNavi/compare/v1.39.0-beta.3...v1.39.0-beta.4) (2026-10-04)

### Bug fixes

- **windows:** normalize routing engine paths ([f260d46](https://github.com/pcace/RoadbookNavi/commit/f260d46026fad020490d6d77cee2b04b50580f72))

## [1.39.0-beta.3](https://github.com/pcace/RoadbookNavi/compare/v1.39.0-beta.2...v1.39.0-beta.3) (2026-10-04)

### Bug fixes

- :bug: windows routing problems ([f1738cc](https://github.com/pcace/RoadbookNavi/commit/f1738ccf9e3bc98797ed3baeb5ef5842b2cebd96))

## [1.39.0-beta.2](https://github.com/pcace/RoadbookNavi/compare/v1.39.0-beta.1...v1.39.0-beta.2) (2026-10-03)

### New features

- **settings:** add GitHub release update check ([4cc28c6](https://github.com/pcace/RoadbookNavi/commit/4cc28c6b1d8bd949773c57200873443fe5c28ec7))

## [1.39.0-beta.1](https://github.com/pcace/RoadbookNavi/compare/v1.38.5...v1.39.0-beta.1) (2026-10-01)

### New features

- **map:** use on-demand OpenFreeMap and BRouter data ([61116e3](https://github.com/pcace/RoadbookNavi/commit/61116e33fd4088137060d18642df8d4dc635cba2))
- **obf-bridge:** resident OBF query service with vendored sources and build script ([baaf442](https://github.com/pcace/RoadbookNavi/commit/baaf442a377742288b05d0eaf24602c87e25e972))
- **obf-bridge:** rust bridge client with end-to-end test against real OBF ([56ab3ea](https://github.com/pcace/RoadbookNavi/commit/56ab3eab3a925f8675316b6b4117ec490406b8f5))
- **obf:** rebuild storage, catalogue and install around OBF bridge; drop legacy import pipeline ([b5658da](https://github.com/pcace/RoadbookNavi/commit/b5658da967e343823b4c5f84f42ac30566628ebb))

### Documentation

- **obf-spike:** license assessment for OBF data, jars and download endpoint ([9160248](https://github.com/pcace/RoadbookNavi/commit/9160248b89306ec04996f1020c7c095a3e4fc017))
- **region-format:** document OsmAnd OBF spike results and reproduction ([c6e2bda](https://github.com/pcace/RoadbookNavi/commit/c6e2bda130d5b55bebb87d031e8d6f0b6ac2edd1))

### Build and dependencies

- close pull requests with malformed titles ([#4](https://github.com/pcace/RoadbookNavi/issues/4)) ([#5](https://github.com/pcace/RoadbookNavi/issues/5)) ([8172144](https://github.com/pcace/RoadbookNavi/commit/8172144a5c7c47d2759f2ecbb638c3862a56f4bd))

## [1.38.5](https://github.com/pcace/RoadbookNavi/compare/v1.38.4...v1.38.5) (2026-09-29)

### Bug fixes

- **macos:** request location permission ([#7](https://github.com/pcace/RoadbookNavi/issues/7)) ([ff23ede](https://github.com/pcace/RoadbookNavi/commit/ff23ede3af872278fbc007d73f8e90296fd3d73f))

### Build and dependencies

- close pull requests with malformed titles ([#4](https://github.com/pcace/RoadbookNavi/issues/4)) ([e4d6540](https://github.com/pcace/RoadbookNavi/commit/e4d65409952bbd156acd97cc6944e971680f9cff))
- format generated changelog ([ed24eeb](https://github.com/pcace/RoadbookNavi/commit/ed24eeb7d777564d7ed26707c0f5985dd90df18b))

## [1.38.4](https://github.com/pcace/RoadbookNavi/compare/v1.38.3...v1.38.4) (2026-09-29)

### Bug fixes

- use package manager version in workflows ([b209774](https://github.com/pcace/RoadbookNavi/commit/b2097741e1c7ba2f817cd2823e44d966804c0f56))

### Build and dependencies

- configure stable and beta releases ([499a7ad](https://github.com/pcace/RoadbookNavi/commit/499a7ad00abd55867a409cc983a728f7e4625a10))
- use compatible changelog preset ([bfdfbc6](https://github.com/pcace/RoadbookNavi/commit/bfdfbc6a9fc9bc7880a429858817ba3c5b1eac19))

# Changelog

RoadbookNavi is now maintained as a local-first native application. Earlier
server and website release history was removed together with those components.
Future releases are recorded here by Release Please.
