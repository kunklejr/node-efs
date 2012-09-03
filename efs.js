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
      return callback(new Error('[node-efs] does not support open for read operations'));
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
  }

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
  }

  efs.openSync = function (path, flags, mode) {
    if (flags.indexOf('w') !== 0) {
      return callback(new Error('[node-efs] does not support open for read operations'));
    }

    var fd = fs.openSync(path, flags, mode);
    fdCache[fd] = crypto.createCipher(algorithm, password);

    return fd;
  }

  efs.closeSync = function (fd) {
    var data = new Buffer(fdCache[fd].final('binary'), 'binary');
    fs.writeSync(fd, data, 0, data.length, null);
    var retVal = fs.closeSync(fd);
    delete fdCache[fd];

    return retVal;
  }

  efs.write = function (fd, buffer, offset, length, position, callback) {
    if (position !== null) {
      throw new Error('Writing to arbitrary positions in the file is not supported.');
    }

    var slice = buffer.slice(offset, offset + length);
    var data = new Buffer(fdCache[fd].update(slice, 'binary', 'binary'), 'binary');
    fs.write(fd, data, 0, data.length, null, callback);
  }

  efs.writeSync = function (fd, buffer, offset, length, position) {
    if (position !== null) {
      throw new Error('Writing to arbitrary positions in the file is not supported.');
    }

    var slice = buffer.slice(offset, offset + length);
    var data = new Buffer(fdCache[fd].update(slice, 'binary', 'binary'), 'binary');
    return fs.writeSync(fd, data, 0, data.length, null);
  }

  efs.read = function() {
    var err = new Error('unsupported operation');
    if (typeof arguments[arguments.length - 1] === 'function') {
      arguments[arguments.length - 1](err);
    } else {
      throw err;
    }
  }

  efs.readSync = function() {
    throw new Error('unsupported operation');
  }

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
  }

  efs.writeFileSync = function (filename, data, encoding) {
    var encoding = typeof(encoding_) == 'string' ? encoding_ : 'utf8';
    var cipher = crypto.createCipher(algorithm, password);
    var cipherText = cipher.update(data, encoding) + cipher.final();
    return fs.writeFileSync(filename, cipherText, 'binary');
  }

  efs.read = function (fd, buffer, offset, length, position, callback) {
    throw new Error('Unsupported Operation');
  }

  efs.readSync = function (fd, buffer, offset, length, position) {
    throw new Error('Unsupported Operation');
  }

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
  }

  efs.readFileSync = function (filename, encoding_) {
    var encoding = typeof(encoding_) == 'string' ? encoding_ : 'utf8';
    var cipher = crypto.createDecipher(algorithm, password);
    var cipherText = fs.readFileSync(filename, 'binary');
    var plainText = cipher.update(cipherText, 'binary', encoding) + cipher.final(encoding);
    return plainText;
  }

  efs.appendFile = function (filename, data, encoding_, callback) {
    throw new Error('not yet implemented');
  }

  efs.appendFileSync = function (filename, data, encoding) {
    throw new Error('not yet implemented');
  }

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
  }

  efs.createWriteStream = function (path, options) {
    throw new Error('not yet implemented');
  }

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
