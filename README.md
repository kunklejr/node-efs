# efs

An fs module stand-in for reading and writing encrypted files

## Installation

    $ npm install efs

## Usage

`efs` attempts to be as similar to `fs` as possible. The one place where
it differs is in how it needs to be required.

```javascript
var efs = require('efs').init('aes-128-cbc', 'password');

// encrypt and write file
efs.writeFileSync('/tmp/example', 'hello world');

// decrypt and read file
efs.readFileSync('/tmp/example');
```

## API

There's only one API method in `efs` that differs from Node's `fs`
module. Please see [Node's fs docs](http://nodejs.org/api/fs.html)
for how to use all the other methods.

### init(algorithm, password)

Initializes the `efs` module with the given encryption algorithm and
derives the encryption key from the given password.

__Arguments__

* algorithm - the encryption algorithm to use. It is dependent on the
available algorithms supported by the version of OpenSSL on the platform.
Examples are 'aes-128-cbc', 'aes192', etc. On recent releases,
`openssl list-cipher-algorithms` will display the available ciphers.
* password - the password used to derive the encryption/decryption key

## Caveats/Exceptions

Although most `fs` modules have been implemented in `efs`, there are
some exceptions:

* `efs.open` only supports opening a file for writing.
* `efs.read` and `efs.readSync` is not supported.
* Writing to arbitrary positions in a file using `efs.write` is not
  supported.
* `efs.truncate` and `efs.truncateSync` are not supported.
* `efs.appendFile` and `efs.appendFileSync` are supported but not
  terribly efficient. They result in reading and decrypting the entire
  file and then re-encrypting and writing it back out.

## License

(The MIT License)

Copyright (c) 2012 Jeff Kunkle

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
