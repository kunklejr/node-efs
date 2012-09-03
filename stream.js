var crypto = require('crypto');
var util = require('util');
var Stream = require('stream').Stream;

exports.ReadStream = ReadStream;
exports.WriteStream = WriteStream;

function ReadStream(fstream, encoding, algorithm, password) {
  Stream.call(this);

  var self = this;
  this.fstream = fstream;

  this.__defineGetter__('readable', function () {
    return fstream.readable;
  });

  var cipher = crypto.createDecipher(algorithm, password);

  this.fstream.on('data', function (data) {
    self.emit('data', cipher.update(data, 'binary', encoding));
  });

  this.fstream.on('end', function () {
    self.emit('data', cipher.final(encoding));
    self.emit('end');
  });

  this.fstream.on('close', function() {
    self.emit.bind(self, 'close').apply(self, arguments);
  });

  this.fstream.on('open', function() {
    self.emit.bind(self, 'open').apply(self, arguments);
  });

  this.fstream.on('error', function(err) {
    self.emit.bind(self, 'error').apply(self, arguments);
  });
}
util.inherits(ReadStream, Stream);

ReadStream.prototype.pause = function () {
  this.fstream.pause.apply(this.fstream, arguments);
};

ReadStream.prototype.resume = function () {
  this.fstream.resume.apply(this.fstream, arguments);
};

ReadStream.prototype.destroy = function () {
  this.fstream.destroy.apply(this.fstream, arguments);
};


function WriteStream(fstream, encoding, algorithm, password) {
  Stream.call(this);

  var self = this;
  this.fstream = fstream;
  this.cipher = crypto.createCipher(algorithm, password);

  this.__defineGetter__('writable', function () {
    return fstream.writable;
  });

  this.__defineGetter__('bytesWritten', function () {
    return fstream.bytesWritten;
  });

  this.fstream.on('drain', function (data) {
    self.emit.bind(self, 'drain').apply(self, arguments);
  });

  this.fstream.on('pipe', function () {
    self.emit.bind(self, 'pipe').apply(self, arguments);
  });

  this.fstream.on('close', function() {
    self.emit.bind(self, 'close').apply(self, arguments);
  });

  this.fstream.on('open', function() {
    self.emit.bind(self, 'open').apply(self, arguments);
  });

  this.fstream.on('error', function(err) {
    self.emit.bind(self, 'error').apply(self, arguments);
  });
}
util.inherits(WriteStream, Stream);

WriteStream.prototype.write = function (data) {
  var args = copyArgs(arguments);
  var encoding = 'binary';
  var callback;

  if (typeof(args[args.length - 1]) == 'function') {
    callback = args[args.length - 1];
  }

  if (!Buffer.isBuffer(data)) {
    encoding = 'utf8';
    if (typeof(arguments[1]) == 'string') {
      encoding = arguments[1];
    }
  }

  data = this.cipher.update(data, encoding);

  return this.fstream.write(data, 'binary', callback);
};

WriteStream.prototype.end = function (data) {
  var self = this;
  var args = copyArgs(arguments);
  var callback = function() {};

  if (typeof(data) === 'function') {
    callback = data;
    data = undefined;
  }

  if (typeof(args[args.length - 1]) === 'function') {
    callback = args[args.length - 1];
    args[args.length - 1] = finalize;
  } else {
    args.push(finalize);
  }

  if (data) {
    this.write.apply(this, args);
  } else {
    finalize();
  }

  function finalize() {
    self.write(self.cipher.final(), onEnd);
  };

  function onEnd() {
    self.fstream.end(callback);
  };
};

WriteStream.prototype.destroy = function () {
  return this.fstream.destroy.apply(this.fstream, arguments);
};

WriteStream.prototype.destroySoon = function () {
  return this.fstream.destroySoon.apply(this.fstream, arguments);
};

WriteStream.prototype.flush = function () {
  return this.fstream.flush.apply(this.fstream, arguments);
};

function copyArgs() {
  var args = [];
  for (var i = 0; i < arguments.length; i++) {
    args.push(arguments[i]);
  }
  return args;
}
