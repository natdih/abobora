// Copy-pasted from an unmerged pull request in `lazystream` repo on 23.02.2026:
// https://github.com/jpommerening/node-lazystream/pull/9/changes
//
// That pull request fixes the dependency on `readable-stream` library.
// https://github.com/jpommerening/node-lazystream/issues/7
// It wasn't merged because it would have to be a "breaking change" in term of Node.js version requirement
// and also `lazystream` package seems to no longer be maintained anyway.

import { PassThrough } from 'stream';

// Patch the given method of instance so that the callback
// is executed once, before the actual method is called the
// first time.
function beforeFirstCall(instance, method, callback) {
  instance[method] = function(...args) {
    delete instance[method];
    callback.apply(this, args);
    return this[method].apply(this, args);
  };
}

export class Readable extends PassThrough {
  constructor(fn, options) {
    super(options);

    // Support calling without new
    if (!(this instanceof Readable)) {
      return new Readable(fn, options);
    }

    beforeFirstCall(this, '_read', function() {
      const source = fn.call(this, options);
      const emit = this.emit.bind(this, 'error');
      source.on('error', emit);
      source.pipe(this);
    });

    this.emit('readable');
  }
}

export class Writable extends PassThrough {
  constructor(fn, options) {
    super(options);

    // Support calling without new
    if (!(this instanceof Writable)) {
      return new Writable(fn, options);
    }

    beforeFirstCall(this, '_write', function() {
      const destination = fn.call(this, options);
      const emit = this.emit.bind(this, 'error');
      destination.on('error', emit);
      this.pipe(destination);
    });

    this.emit('writable');
  }
}

// An alternative suggested by Google AI:
//
// function createLazyReadStream(filePath) {
//   const passthrough = new PassThrough();
//   let underlyingStream = null;
//
//   // This function is called only when the stream is first consumed (e.g., piped or 'data' event listener added)
//   const initializeStream = () => {
//     if (!underlyingStream) {
//       underlyingStream = fs.createReadStream(filePath);
//       // Pipe the real stream's data through the passthrough stream
//       underlyingStream.pipe(passthrough);
//
//       // Forward error events
//       underlyingStream.on('error', (err) => passthrough.emit('error', err));
//     }
//   };
//
//   // Intercept the 'data' event listener or 'pipe' method to initialize the stream
//   passthrough.on('newListener', (event) => {
//     if (event === 'data' || event === 'pipe') {
//       initializeStream();
//     }
//   });
//
//   // You also need to handle cases where 'read()' is called directly.
//   // This is a bit more complex, but the 'newListener' approach covers most common use cases.
//
//   return passthrough;
// }