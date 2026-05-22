import Archiver from "../Archiver.js";
import Json from "../plugins/json.js";

export default class JsonArchive extends Archiver {
  constructor(options) {
    super(options);
    this._format = "json";
    this._module = new Json(options);
    this._supportsDirectory = true;
    this._supportsSymlink = true;
    this._modulePipe();
  }
}