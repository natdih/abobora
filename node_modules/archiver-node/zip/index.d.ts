import * as stream from 'stream'

import { ZipOptions } from '../index.d.js';

export default class ZipArchive {
	constructor(options?: ZipOptions);
	add(content: stream.Readable | Buffer | string, internalPath: string): void;
	includeFile(pathToFile: string, internalPath: string): void;
	includeFilesByMatch(pathToDirectory: string, filePathPattern: string): void;
	includeDirectory(pathToDirectory: string, internalPath?: string): void;
	write(): stream.Readable;
	promise: Promise<void>;
	size?: number;
}
