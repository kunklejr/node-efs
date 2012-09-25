var fs = require('fs');
var crypto = require('crypto');
var cryptostream = require('./cryptostream');

var DecryptStream = cryptostream.DecryptStream;
var EncryptStream = cryptostream.EncryptStream;
var fdCache = {};

exports.init = function (algorithm, password) {
  var efs = copy(fs);

  efs.open = function (path, flags, mode, callback) {
    if (flags.indexOf('w') !== 0) {
      return callback(new Error('[node-efs] only supports open for write operations'));
    }

    var args = copyArgs(arguments);

    if (typeof args[args.length - 1] === 'function') {
      callback = args[args.length - 1];
      args[args.length - 1] = onOpen;
    } else {
      callback = function () {};
      args.push(onOpen);
    }

    fs.open.apply(null, args);

    function onOpen(err, fd) {
      if (err) {
        return callback(err);
      }

      fdCache[fd] = crypto.createCipher(algorithm, password);
      callback(null, fd);
    }
  };

  efs.close = function (fd, callback) {
    var data = new Buffer(fdCache[fd].final('binary'), 'binary');
    fs.write(fd, data, 0, data.length, null, onFinalize);

    function onFinalize(err) {
      if (err) {
        return callback(err);
      }
      fs.close(fd, callback);
      delete fdCache[fd];
    }
  };

  efs.openSync = function (path, flags, mode) {
    if (flags.indexOf('w') !== 0) {
      return callback(new Error('[node-efs] only supports open for write operations'));
    }

    var fd = fs.openSync(path, flags, mode);
    fdCache[fd] = crypto.createCipher(algorithm, password);

    return fd;
  };

  efs.closeSync = function (fd) {
    var data = new Buffer(fdCache[fd].final('binary'), 'binary');
    fs.writeSync(fd, data, 0, data.length, null);
    var retVal = fs.closeSync(fd);
    delete fdCache[fd];

    return retVal;
  };

  efs.write = function (fd, buffer, offset, length, position, callback) {
    if (position !== null) {
      throw new Error('[node-efs] Writing to arbitrary positions in the file is not supported.');
    }

    var slice = buffer.slice(offset, offset + length);
    var data = new Buffer(fdCache[fd].update(slice, 'binary', 'binary'), 'binary');
    fs.write(fd, data, 0, data.length, null, callback);
  };

  efs.writeSync = function (fd, buffer, offset, length, position) {
    if (position !== null) {
      throw new Error('[node-efs] Writing to arbitrary positions in the file is not supported.');
    }

    var slice = buffer.slice(offset, offset + length);
    var data = new Buffer(fdCache[fd].update(slice, 'binary', 'binary'), 'binary');
    return fs.writeSync(fd, data, 0, data.length, null);
  };

  efs.read = function() {
    var err = new Error('[node-efs] efs.read is an unsupported operation');

    if (typeof arguments[arguments.length - 1] === 'function') {
      arguments[arguments.length - 1](err);
    } else {
      throw err;
    }
  };

  efs.readSync = function() {
    throw new Error('[node-efs] efs.readSync is an unsupported operation');
  };

  efs.writeFile = function (filename, data, encoding_, callback) {
    var encoding = typeof(encoding_) == 'string' ? encoding_ : 'utf8';
    var callback_ = arguments[arguments.length - 1];
    callback = (typeof(callback_) == 'function' ? callback_ : null);

    try {
      var cipher = crypto.createCipher(algorithm, password);
      var cipherText = cipher.update(data, encoding) + cipher.final();
      return fs.writeFile(filename, cipherText, 'binary', callback);
    } catch (ex) {
      callback(ex);
    }
  };

  efs.writeFileSync = function (filename, data, encoding_) {
    var encoding = typeof(encoding_) == 'string' ? encoding_ : 'utf8';
    var cipher = crypto.createCipher(algorithm, password);
    var cipherText = cipher.update(data, encoding) + cipher.final();
    return fs.writeFileSync(filename, cipherText, 'binary');
  };

  efs.readFile = function (filename, encoding_, callback) {
    var encoding = typeof(encoding_) == 'string' ? encoding_ : 'utf8';
    var callback_ = arguments[arguments.length - 1];
    callback = (typeof(callback_) == 'function' ? callback_ : function () {});

    fs.readFile(filename, 'binary', function (err, data) {
      if (err) {
        return callback(err);
      }

      try {
        var cipher = crypto.createDecipher(algorithm, password);
        var plainText = cipher.update(data, 'binary', encoding) + cipher.final(encoding);
        callback(null, plainText);
      } catch (ex) {
        callback(ex);
      }
    });
  };

  efs.readFileSync = function (filename, encoding) {
    encoding = typeof(encoding) === 'string' ? encoding : 'utf8';
    var cipher = crypto.createDecipher(algorithm, password);
    var cipherText = fs.readFileSync(filename, 'binary');
    return cipher.update(cipherText, 'binary', encoding) + cipher.final(encoding);
  };

  efs.appendFile = function (filename, data, encoding, callback) {
    if (typeof arguments[arguments.length - 1] === 'function') {
      callback = arguments[arguments.length - 1];
    } else {
      callback = function () {};
    }
    if (typeof arguments[2] !== 'string') {
      encoding = 'utf8';
    }

    efs.readFile(filename, encoding, onRead);

    function onRead(err, plainText) {
      if (err) return callback(err);
      efs.writeFile(filename, plainText + data, encoding, callback);
    }
  };

  efs.appendFileSync = function (filename, data, encoding) {
    var plainText = efs.readFileSync(filename, encoding);
    return efs.writeFileSync(filename, plainText + data, encoding);
  };

  efs.createReadStream = function (path, options) {
    options = options || {};
    var encoding = typeof(options.encoding) == 'string' ? options.encoding : 'utf8';
    options.encoding = 'binary';
    var fstream = fs.createReadStream(path, options);

    var cstream = new DecryptStream({
      key: password,
      algorithm: algorithm,
      inputEncoding: 'binary',
      outputEncoding: encoding
    });

    return fstream.pipe(cstream);
  };

  efs.createWriteStream = function (path, options) {
    options = options || {};
    var cipher = crypto.createCipher(algorithm, password);

    var encoding = typeof(options.encoding) == 'string' ? options.encoding : 'utf8';
    options.encoding = 'binary';

    var fstream = fs.createWriteStream(path, options);
    fstream.efsWrite = fstream.write;
    fstream.efsEnd = fstream.end;

    fstream.write = function (data, encoding, fd) {
      this.efsWrite(cipher.update(data, encoding, 'binary'), 'binary', fd);
    };

    fstream.end = function (data, encoding) {
      if (data) {
        this.efsWrite(cipher.update(data, encoding, 'binary'), 'binary');
      }
      this.efsWrite(cipher.final(), 'binary');
      this.efsEnd();
    };

    return fstream;
  };

  efs.truncate = function () {
    var err = new Error('[node-efs] efs.truncate is an unsupported operation');

    if (typeof arguments[arguments.length - 1] === 'function') {
      arguments[arguments.length - 1](err);
    } else {
      throw err;
    }
  };

  efs.truncateSync = function () {
    var err = new Error('[node-efs] efs.truncateSync is an unsupported operation');

    if (typeof arguments[arguments.length - 1] === 'function') {
      arguments[arguments.length - 1](err);
    } else {
      throw err;
    }
  };

  return efs;
};

function copy(obj) {
  var copy = {};
  for (var prop in obj) {
    copy[prop] = obj[prop];
  }
  return copy;
}

function copyArgs(items) {
  var args = [];
  for (var i = 0; i < items.length; i++) {
    args.push(items[i]);
  }
  return args;
}
