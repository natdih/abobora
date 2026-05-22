## `8.0.1` // 23.02.2026

* Forked the `master` branch of the [original repo](https://github.com/archiverjs/node-archiver/) in response to an [npm security vulnerability issue](https://github.com/archiverjs/node-archiver/issues/819) not having been fixed for more than a year due to the original package apparently having been abandoned for an unknown reason. The fork is branched off the same code that was released as the latest known version `7.0.1` with a single additional commit by the original author called ["`esm` refactoring"](https://github.com/archiverjs/node-archiver/pull/790/changes).

* The changes in the aforementioned "`esm` refactoring" commit:
  * Added `prettier` to automatically format the code during build. Replaced single quotes with double quotes after introducing `prettier`.
	* The CommonJS code was rewritten as ESM. Because the package has no `build` script, it means that this package can only be `import`ed now and cannot be `require()`d.
  * Added named exports: `ZipArchive`, `TarArchive`, `JsonArchive`. Use them instead of the default export.
	  * Old approach: `import archiver from 'archiver'` and `const zipArchive = archiver('zip', options)`.
		* New approach: `import { ZipArchive } from 'archiver'` and `new ZipArchive(options)`.
	* Added named export `Archiver`. It could be used to add new types of archives. Use it instead of the default export (which has been removed).
	  * Old approach: `import archiver from 'archiver'` and `const zipArchive = archiver('zip', options)`.
		* New approach: `import { Archiver } from 'archiver'` and `class ZipArchive extends Archiver { ... see index.js ... }` and `new ZipArchive(options)`.
	* Removed exported functions: `registerFormat`, `isRegisteredFormat`, `create`.
	* Updated `zip-stream` dependency from `6.x` to `7.x`.
	  * (breaking change) Node.js 18+ is now required.
	* Downgraded `readdir-glob` dependency from `2.x` to `1.x` for an unknown reason.
	  * Perhaps it was because `readdir-glob@2.x` updated `minimatch` dependency to `10.x` which [broke](https://github.com/Yqnn/node-readdir-glob/issues/24) Node.js 16+ support and introduced a Node.js 20+ requirement.

* Updated `is-stream` dependency from `3.x` to `4.x`
  * (breaking change) Node.js 18+ is now required.
	* (breaking change) The `isStream()` method now also ensures that the stream is not closed. One can pass [`{canOpen: false}`](https://github.com/sindresorhus/is-stream/pull/20) to bring back the old behavior.
	  * Added the `{canOpen: false}` option mentioned above in `./lib/utils.js` in the `archiver` code in order for this to not be a breaking change or something.

* Reverted the downgrade of `readdir-glob` dependency which was for unspecified reason. Now it's at version `2.x` again.
  * (breaking change) Node.js 18+ is now required.
  * Updated `./lib/core.js` [accordingly](https://github.com/Yqnn/node-readdir-glob/issues/28)

* Removed `lazystream` dependency because that package doesn't seem to be [maintained](https://github.com/archiverjs/archiver-utils/issues/191) anymore and [depends](https://github.com/jpommerening/node-lazystream/issues/7) on an old version of `readable-stream`.
  * Replaced it with a simple function.

* Added `esbuild` development dependency and added a `build` step that creates a CommonJS version of the package that can be `require()`d and not only `import`ed.

* Added TypeScript definition file.
  * Copied it from [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/archiver).

* Fixed `website/docs/quickstart.md` and `website/docs/archiver_api.md`.

## Older versions

See [CHANGELOG.md](https://github.com/archiverjs/node-archiver/blob/master/CHANGELOG.md) of the original package for more info on the older versions.