var fs = require('fs');
var path = require('path');
var vows = require('vows');
var assert = require('assert');
var efs = require('../efs').init('aes-128-cbc', 'password');
var tmpdir = path.join(__dirname, '..', 'temp');

var writeFilePath = path.join(tmpdir, 'writeFile.txt');
var readFilePath = path.join(tmpdir, 'readFile.txt');
var readStreamPath = path.join(tmpdir, 'readStream.txt');
var writeStreamPath = path.join(tmpdir, 'writeStream.txt');
var openWriteClosePath = path.join(tmpdir, 'openWriteClose.txt');
var openWriteClosePathSync = path.join(tmpdir, 'openWriteCloseSync.txt');

vows.describe('efs').addBatch({
  '#writeFile': {
    topic: function () {
      efs.writeFile(writeFilePath, 'hello world', this.callback);
    },

    'should encrypt the file contents': function(err) {
      assert.isUndefined(err);
      var content = fs.readFileSync(writeFilePath);
      assert.notEqual(content.toString(), 'hello world');
    },

    'should create output that is able to be decrypted': function () {
      var content = efs.readFileSync(writeFilePath);
      assert.equal(content, 'hello world');
    },

    teardown: function() {
      efs.unlink(writeFilePath, this.callback);
    }
  },

  '#writeFileSync': {
    topic: function () {
      efs.writeFileSync(writeFilePath, 'hello world');
      this.callback();
    },

    'should encrypt the file contents': function() {
      var content = fs.readFileSync(writeFilePath);
      assert.notEqual(content.toString(), 'hello world');
    },

    'should create output that is able to be decrypted': function () {
      var content = efs.readFileSync(writeFilePath);
      assert.equal(content, 'hello world');
    },

    teardown: function() {
      efs.unlink(writeFilePath, this.callback);
    }
  },

  '#readFile': {
    topic: function () {
      efs.writeFileSync(readFilePath, 'hello world');
      efs.readFile(readFilePath, this.callback);
    },

    'should decrypt the file contents': function (err, data) {
      assert.isNull(err);
      assert.equal(data, 'hello world');
    },

    teardown: function() {
      efs.unlink(readFilePath, this.callback);
    }
  },

  '#readFileSync': {
    topic: function () {
      efs.writeFileSync(readFilePath, 'hello world');
      var contents = efs.readFileSync(readFilePath);
      this.callback(null, contents);
    },

    'should decrypt the file contents': function (data) {
      assert.equal(data, 'hello world');
    },

    teardown: function() {
      efs.unlink(readFilePath, this.callback);
    }
  },

  '#createReadStream': {
    topic: function () {
      efs.writeFileSync(readStreamPath, 'hello world');
      var str = '';
      var efstream = efs.createReadStream(readStreamPath);
      efstream.on('data', function (data) {
        str = str + data;
      });
      efstream.on('end', function () {
        this.callback(null, str);
      }.bind(this));
      efstream.on('error', this.callback);
    },

    'should decrypt the contents': function (data) {
      assert.equal(data, 'hello world');
    },

    teardown: function() {
      efs.unlink(readStreamPath, this.callback);
    }
  },

  //'#createWriteStream': {
    //topic: function () {
      //var efstream = efs.createWriteStream(writeStreamPath);
      //efstream.on('end', efs.readFile.bind(this, writeStreamPath, this.callback));
      //efstream.write('hello world');
      //efstream.end();
    //},

    //'should encrypt the contents': function (data) {
      //assert.equal(data, 'hello world');
    //},

    //teardown: function() {
      //efs.unlink(writeStreamPath, this.callback);
    //}
  //}

  '#open / #write / #close': {
    topic: function () {
      var fd;
      var self = this;
      efs.open(openWriteClosePath, 'w', '0666', onOpen);

      function onOpen(err, returnedFd) {
        if (err) return self.callback(err);
        fd = returnedFd;
        var buff = new Buffer('hello world', 'utf8');
        efs.write(fd, buff, 0, buff.length, null, onWrite);
      }

      function onWrite(err) {
        if (err) return self.callback(err);
        efs.close(fd, onClose);
      }

      function onClose(err) {
        if (err) return self.callback(err);
        efs.readFile(openWriteClosePath, self.callback);
      }
    },

    'should encrypt the contents': function (data) {
      assert.equal(data, 'hello world');
    },

    teardown: function() {
      efs.unlink(openWriteClosePath, this.callback);
    }
  },

  '#openSync / #writeSync / #closeSync': {
    topic: function () {
      var buff = new Buffer('hello world', 'utf8');
      var fd = efs.openSync(openWriteClosePath, 'w', '0666');
      efs.writeSync(fd, buff, 0, buff.length, null);
      efs.closeSync(fd);
      efs.readFile(openWriteClosePath, this.callback);
    },

    'should encrypt the contents': function (data) {
      assert.equal(data, 'hello world');
    },

    teardown: function() {
      efs.unlink(openWriteClosePathSync, this.callback);
    }
  },
}).export(module);

function ticks(num, func) {
  if (num == 0) {
    func();
  } else {
    process.nextTick(ticks.bind(this, num - 1, func));
  }
}
