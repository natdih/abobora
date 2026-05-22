import Archiver from "../Archiver.js";
import Tar from "../plugins/tar.js";

export default class TarArchive extends Archiver {
  constructor(options) {
    super(options);
    this._format = "tar";
    this._module = new Tar(options);
    this._supportsDirectory = true;
    this._supportsSymlink = true;
    this._modulePipe();
  }
}