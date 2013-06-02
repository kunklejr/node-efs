var fs = require('fs');
var path = require('path');
var assert = require('chai').assert;
var efs = require('../efs').init('aes-128-cbc', 'password');
var tmpdir = path.join(__dirname, '..', 'temp');

var writeFilePath = path.join(tmpdir, 'writeFile.txt');
var readFilePath = path.join(tmpdir, 'readFile.txt');
var readStreamPath = path.join(tmpdir, 'readStream.txt');
var writeStreamPath = path.join(tmpdir, 'writeStream.txt');
var openWriteClosePath = path.join(tmpdir, 'openWriteClose.txt');
var openWriteClosePathSync = path.join(tmpdir, 'openWriteCloseSync.txt');
var appendFilePath = path.join(tmpdir, 'appendFile.txt');
var appendFileSyncPath = path.join(tmpdir, 'appendFileSync.txt');

describe('efs', function() {
	describe('#writeFile', function() {
		it('should encrypt the file contents', function(done) {
      efs.writeFile(writeFilePath, 'hello world', function(err) {
				assert.isNull(err);
				var content = fs.readFileSync(writeFilePath);
				assert.notEqual(content.toString(), 'hello world');
				done();
			});
		});

		it('should create output that is able to be decrypted', function(done) {
      efs.writeFile(writeFilePath, 'hello world', function(err) {
				assert.isNull(err);
				var content = efs.readFileSync(writeFilePath);
				assert.equal(content, 'hello world');
				done();
			});
		});

		afterEach(function(done) {
      efs.unlink(writeFilePath, done);
		})
	});

	describe('#writeFileSync', function() {
		it('should encrypt the file contents', function() {
      efs.writeFileSync(writeFilePath, 'hello world');
      var content = fs.readFileSync(writeFilePath);
      assert.notEqual(content.toString(), 'hello world');
		});

    it('should create output that is able to be decrypted', function () {
      efs.writeFileSync(writeFilePath, 'hello world');
      var content = efs.readFileSync(writeFilePath);
      assert.equal(content, 'hello world');
    });

		afterEach(function(done) {
      efs.unlink(writeFilePath, done);
		})
	});

	describe('#readFile', function() {
		it('should decrypt the file contents', function(done) {
      efs.writeFileSync(readFilePath, 'hello world');
      efs.readFile(readFilePath, function(err, data) {
				assert.isNull(err);
				assert.equal(data, 'hello world');
				done();
			});
		});

		afterEach(function(done) {
      efs.unlink(readFilePath, done);
		})
	});

	describe('#readFileSync', function() {
		it('should decrypt the file contents', function() {
      efs.writeFileSync(readFilePath, 'hello world');
      var data = efs.readFileSync(readFilePath);
      assert.equal(data, 'hello world');
		});

		afterEach(function(done) {
      efs.unlink(readFilePath, done);
		})
	});

	describe('#createReadStream', function() {
		it('should decrypt the contents', function(done) {
      efs.writeFileSync(readStreamPath, 'hello world');
      var str = '';
      var efstream = efs.createReadStream(readStreamPath);
      efstream.on('data', function (data) {
        str = str + data;
      });
      efstream.on('end', function () {
				assert.equal(str, 'hello world');
				done();
      });
      efstream.on('error', done.bind(null, new Error()));
		});

		afterEach(function(done) {
      efs.unlink(readStreamPath, done);
		});
	});

	describe('#createWriteStream', function() {
		it('should encrypt the contents', function(done) {
      var efstream = efs.createWriteStream(writeStreamPath);
      efstream.write('hello world');
      efstream.end();
      process.nextTick(efs.readFile.bind(this, writeStreamPath, 'utf8', function(err, data) {
				assert.isNull(err);
				assert.equal(data, 'hello world');
				done();
			}));
		});

		afterEach(function(done) {
      efs.unlink(writeStreamPath, done);
		});
	});

	describe('#open / #write / #close', function() {
		it('should encrypt the contents', function(done) {
      var fd;
      var self = this;
      efs.open(openWriteClosePath, 'w', '0666', onOpen);

      function onOpen(err, returnedFd) {
        if (err) return done(err);
        fd = returnedFd;
        var buff = new Buffer('hello world', 'utf8');
        efs.write(fd, buff, 0, buff.length, null, onWrite);
      }

      function onWrite(err) {
        if (err) return done(err);
        efs.close(fd, onClose);
      }

      function onClose(err) {
        if (err) return done(err);
        efs.readFile(openWriteClosePath, verify);
      }

			function verify(err, data) {
        if (err) return done(err);
				assert.equal(data, 'hello world');
				done();
			}
		});

		afterEach(function(done) {
      efs.unlink(openWriteClosePath, done);
		});
	});

	describe('#openSync / #writeSync / #closeSync', function() {
		it('should encrypt the contents', function(done) {
      var buff = new Buffer('hello world', 'utf8');
      var fd = efs.openSync(openWriteClosePathSync, 'w', '0666');
      efs.writeSync(fd, buff, 0, buff.length, null);
      efs.closeSync(fd);
      efs.readFile(openWriteClosePathSync, function(err, data) {
				assert.equal(data, 'hello world');
				done();
			});
		});

		afterEach(function(done) {
      efs.unlink(openWriteClosePathSync, done);
		});
	});

	describe('#read', function() {
		it('should return an error', function(done) {
			efs.read(function(err, data) {
				assert.isNotNull(err);
				done();
			});
		});
	});

	describe('#read without callback', function() {
		it('should throw an error', function() {
			assert.throws(efs.read);
		});
	});

	describe('#read sync without an argument', function() {
		it('should throw an eror', function() {
      assert.throws(efs.readSync);
		});
	});

	describe('#appendFile', function() {
		it('should properly append to an encrypted file', function(done) {
      var onAppend = function (err) {
        if (err) { return done(err); }
        process.nextTick(efs.readFile.bind(this, appendFilePath, function(err, data) {
					assert.equal(data, 'hello world');
					done();
				}));
      }.bind(this)

      efs.writeFileSync(appendFilePath, 'hello');
      efs.appendFile(appendFilePath, ' world', onAppend);
		});

		afterEach(function(done) {
      efs.unlink(appendFilePath, done);
		});
	});

	describe('#appendFileSync', function() {
		it('should properly append to an encrypted file', function() {
      efs.writeFileSync(appendFileSyncPath, 'hello');
      efs.appendFileSync(appendFileSyncPath, ' world');
      var data = efs.readFileSync(appendFileSyncPath);
      assert.equal(data, 'hello world');
		});

		afterEach(function(done) {
      efs.unlink(appendFileSyncPath, done);
		});
	});

	describe('#truncate', function() {
		it('should return an error', function(done) {
      efs.truncate(function(err) {
				assert.isNotNull(err);
				done();
			});
		})
	});

	describe('#truncate without callback', function() {
		it('should throw an error', function() {
      assert.throws(efs.truncate);
		});
	});

	describe('#truncateSync', function() {
		it('should throw an error', function() {
      assert.throws(efs.truncateSync);
		});
	});
});

