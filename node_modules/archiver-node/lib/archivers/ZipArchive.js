import Archiver from "../Archiver.js";
import Zip from "../plugins/zip.js";

export default class ZipArchive extends Archiver {
  constructor(options) {
    super(options);
    this._format = "zip";
    this._module = new Zip(options);
    this._supportsDirectory = true;
    this._supportsSymlink = true;
    this._modulePipe();
  }
}
