// Copy-pasted from `DefinitelyTyped` on 23.02.2026:
// https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/archiver/index.d.ts

import * as fs from "fs";
import * as stream from "stream";
import * as ReaddirGlob from "readdir-glob";
import { ZlibOptions } from "zlib";

// This library adds `cwd` to the options
type GlobOptions = ReaddirGlob.Options & { cwd?: string };

interface EntryData {
	/** Sets the entry name including internal path */
	name: string;
	/** Sets the entry date */
	date?: Date | string | undefined;
	/** Sets the entry permissions */
	mode?: number | undefined;
	/**
	 * Sets a path prefix for the entry name.
	 * Useful when working with methods like `directory` or `glob`
	 */
	prefix?: string | undefined;
	/**
	 * Sets the fs stat data for this entry allowing
	 * for reduction of fs stat calls when stat data is already known
	 */
	stats?: fs.Stats | undefined;
}

interface ZipEntryData {
	/** Sets the compression method to STORE */
	store?: boolean | undefined;
}

interface TarEntryData {}
interface JsonEntryData {}

interface ProgressData {
	entries: {
		total: number;
		processed: number;
	};
	fs: {
		totalBytes: number;
		processedBytes: number;
	};
}

/** A function that lets you either opt out of including an entry (by returning false), or modify the contents of an entry as it is added (by returning an EntryData) */
type EntryDataFunction = (entry: EntryData) => false | EntryData;

declare class ArchiverError extends Error {
	code: string; // Since archiver format support is modular, we cannot enumerate all possible error codes, as the modules can throw arbitrary ones.
	data: any;
	path?: any;

	constructor(code: string, data: any);
}

type ArchiverOptions = CoreOptions & TransformOptions;

interface CoreOptions {
	statConcurrency?: number | undefined;
}

interface TransformOptions {
	allowHalfOpen?: boolean | undefined;
	readableObjectMode?: boolean | undefined;
	writeableObjectMode?: boolean | undefined;
	decodeStrings?: boolean | undefined;
	encoding?: string | undefined;
	highWaterMark?: number | undefined;
	objectmode?: boolean | undefined;
}

export interface ZipOptions {
	comment?: string | undefined;
	forceLocalTime?: boolean | undefined;
	forceZip64?: boolean | undefined;
	/** @default false */
	namePrependSlash?: boolean | undefined;
	store?: boolean | undefined;
	zlib?: ZlibOptions | undefined;
}

interface TarOptions {
	gzip?: boolean | undefined;
	gzipOptions?: ZlibOptions | undefined;
}

interface JsonOptions {}

declare class Module<Options, AdditionalEntryData> {
  constructor(options?: Options);

  append(
		source: Buffer | stream.Readable,
		data: EntryData & AdditionalEntryData,
		// If there's an `error` argument, it doesn't pass the `data` argument.
		// Otherwise, when `error` argument is `null`, it does pass the `same `data` argument
		// that was passed when calling the `append()` function, with potential modifications to it
		// such as setting the values of some of its properties.
		callback: (error: Error | null, data?: EntryData & AdditionalEntryData) => void
	): void;

  on(event: "end", listener: () => void): void;
  on(event: "error", listener: (error: Error) => void): void;

  finalize(): void;
  pipe(): void;
  unpipe(): void;
}

export class Archiver<
	ModuleOptions extends Record<string, any>,
	AdditionalEntryData extends Record<string, any>
> extends stream.Transform {
	_format: string;
	_module: Module<ModuleOptions, AdditionalEntryData>;
	_supportsDirectory: boolean;
	_supportsSymlink: boolean;
	_modulePipe: () => void;

	constructor(options?: ArchiverOptions & ModuleOptions);

	abort(): this;
	append(source: stream.Readable | Buffer | string, data?: EntryData & AdditionalEntryData): this;

	/** if false is passed for destpath, the path of a chunk of data in the archive is set to the root */
	directory(dirpath: string, destpath: false | string, data?: Partial<EntryData & AdditionalEntryData> | EntryDataFunction): this;
	file(filename: string, data: EntryData & AdditionalEntryData): this;
	glob(pattern: string, options?: GlobOptions, data?: Partial<EntryData & AdditionalEntryData>): this;
	finalize(): Promise<void>;

	setFormat(format: string): this;
	// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
	setModule(module: Function): this;

	pointer(): number;
	// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
	use(plugin: Function): this;

	symlink(filepath: string, target: string, mode?: number): this;

	on(event: "error" | "warning", listener: (error: ArchiverError) => void): this;
	on(event: "data", listener: (data: Buffer) => void): this;
	on(event: "progress", listener: (progress: ProgressData) => void): this;
	on(event: "close" | "drain" | "finish", listener: () => void): this;
	on(event: "pipe" | "unpipe", listener: (src: stream.Readable) => void): this;
	on(event: "entry", listener: (entry: EntryData & AdditionalEntryData) => void): this;
	on(event: string, listener: (...args: any[]) => void): this;
}

export class ZipArchive extends Archiver<ZipOptions, ZipEntryData> {}
export class TarArchive extends Archiver<TarOptions, TarEntryData> {}
export class JsonArchive extends Archiver<JsonOptions, JsonEntryData> {}