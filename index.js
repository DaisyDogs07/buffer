// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

(() => {
  'use strict';

  function ERR_BUFFER_OUT_OF_BOUNDS(name) {
    if (name)
      return new RangeError(`"${name}" is outside of buffer bounds`);
    return new RangeError('Attempt to access memory outside buffer bounds');
  }
  const classRegExp = /^([A-Z][a-z0-9]*)+$/;
  // Sorted by a rough estimate on most frequently used entries.
  const kTypes = [
    'string',
    'function',
    'number',
    'object',
    // Accept 'Function' and 'Object' as alternative to the lower cased version.
    'Function',
    'Object',
    'boolean',
    'bigint',
    'symbol',
  ];
  function inspect(value) {
    return value.toString ? value.toString() : Object.prototype.toString.call(value);
  }
  function determineSpecificType(value) {
    if (value == null) {
      return '' + value;
    }
    if (typeof value === 'function' && value.name) {
      return `function ${value.name}`;
    }
    if (typeof value === 'object') {
      if (value.constructor?.name) {
        return `an instance of ${value.constructor.name}`;
      }
      return inspect(value);
    }
    let inspected = inspect(value);
    if (inspected.length > 28) { inspected = `${inspected.slice(0, 25)}...`; }
    return `type ${typeof value} (${inspected})`;
  }
  function ERR_INVALID_ARG_TYPE(name, expected, actual) {
    if (!Array.isArray(expected)) {
      expected = [expected];
    }

    let msg = 'The ';
    if (name.endsWith(' argument')) {
      // For cases like 'first argument'
      msg += `${name} `;
    } else {
      const type = name.includes('.') ? 'property' : 'argument';
      msg += `"${name}" ${type} `;
    }
    msg += 'must be ';

    const types = [];
    const instances = [];
    const other = [];

    for (const value of expected) {
      if (kTypes.includes(value)) {
        types.push(value.toLowerCase());
      } else if (classRegExp.exec(value) !== null) {
        instances.push(value);
      } else {
        other.push(value);
      }
    }

    // Special handle `object` in case other instances are allowed to outline
    // the differences between each other.
    if (instances.length > 0) {
      const pos = types.indexOf('object');
      if (pos !== -1) {
        types.splice(pos, 1);
        instances.push('Object');
      }
    }

    if (types.length > 0) {
      if (types.length > 2) {
        const last = types.pop();
        msg += `one of type ${types.join(', ')}, or ${last}`;
      } else if (types.length === 2) {
        msg += `one of type ${types[0]} or ${types[1]}`;
      } else {
        msg += `of type ${types[0]}`;
      }
      if (instances.length > 0 || other.length > 0)
        msg += ' or ';
    }

    if (instances.length > 0) {
      if (instances.length > 2) {
        const last = instances.pop();
        msg +=
          `an instance of ${instances.join(', ')}, or ${last}`;
      } else {
        msg += `an instance of ${instances[0]}`;
        if (instances.length === 2) {
          msg += ` or ${instances[1]}`;
        }
      }
      if (other.length > 0)
        msg += ' or ';
    }

    if (other.length > 0) {
      if (other.length > 2) {
        const last = other.pop();
        msg += `one of ${other.join(', ')}, or ${last}`;
      } else if (other.length === 2) {
        msg += `one of ${other[0]} or ${other[1]}`;
      } else {
        if (other[0].toLowerCase() !== other[0])
          msg += 'an ';
        msg += `${other[0]}`;
      }
    }

    msg += `. Received ${determineSpecificType(actual)}`;

    return new TypeError(msg);
  }
  function ERR_INVALID_ARG_VALUE(name, value, reason = 'is invalid') {
    let inspected = inspect(value);
    if (inspected.length > 128) {
      inspected = `${inspected.slice(0, 128)}...`;
    }
    const type = name.includes('.') ? 'property' : 'argument';
    return new TypeError(`The ${type} '${name}' ${reason}. Received ${inspected}`);
  }
  ERR_INVALID_ARG_VALUE.RangeError = function ERR_INVALID_ARG_VALUE(name, value, reason = 'is invalid') {
    let inspected = inspect(value);
    if (inspected.length > 128) {
      inspected = `${inspected.slice(0, 128)}...`;
    }
    const type = name.includes('.') ? 'property' : 'argument';
    return new RangeError(`The ${type} '${name}' ${reason}. Received ${inspected}`);
  }
  function ERR_INVALID_BUFFER_SIZE(s) {
    return new RangeError('Buffer size must be a multiple of ' + inspect(s));
  }
  function addNumericalSeparator(val) {
    let res = '';
    let i = val.length;
    const start = val[0] === '-' ? 1 : 0;
    for (; i >= start + 4; i -= 3) {
      res = `_${val.slice(i - 3, i)}${res}`;
    }
    return `${val.slice(0, i)}${res}`;
  }
  function ERR_OUT_OF_RANGE(str, range, input, replaceDefaultBoolean = false) {
    let msg = replaceDefaultBoolean ? str :
      `The value of "${str}" is out of range.`;
    let received;
    if (Number.isInteger(input) && Math.abs(input) > 2 ** 32) {
      received = addNumericalSeparator(String(input));
    } else if (typeof input === 'bigint') {
      received = String(input);
      if (input > 2n ** 32n || input < -(2n ** 32n)) {
        received = addNumericalSeparator(received);
      }
      received += 'n';
    } else {
      received = String(input);
    }
    msg += ` It must be ${range}. Received ${received}`;
    return new RangeError(msg);
  }
  function ERR_MISSING_ARGS(...args) {
    let msg = 'The ';
    const len = args.length;
    const wrap = (a) => `"${a}"`;
    args = args.map((a) => (Array.isArray(a) ?
        a.map(wrap).join(' or ') :
        wrap(a))
    );
    switch (len) {
      case 1:
        msg += `${args[0]} argument`;
        break;
      case 2:
        msg += `${args[0]} and ${args[1]} arguments`;
        break;
      default:
        msg += args.slice(0, len - 1).join(', ');
        msg += `, and ${args[len - 1]} arguments`;
        break;
    }
    return new TypeError(`${msg} must be specified`);
  }
  function ERR_UNKNOWN_ENCODING(e) {
    return new TypeError('Unknown encoding: ' + inspect(e));
  }

  function validateArray(value, name, minLength = 0) {
    if (!Array.isArray(value)) {
      throw new ERR_INVALID_ARG_TYPE(name, 'Array', value);
    }
    if (value.length < minLength) {
      const reason = `must be longer than ${minLength}`;
      throw new ERR_INVALID_ARG_VALUE(name, value, reason);
    }
  }

  function validateBuffer(buffer, name = 'buffer') {
    if (!ArrayBuffer.isView(buffer)) {
      throw new ERR_INVALID_ARG_TYPE(name,
                                    ['Buffer', 'TypedArray', 'DataView'],
                                    buffer);
    }
  }

  function validateInteger(value, name, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
    if (typeof value !== 'number')
      throw new ERR_INVALID_ARG_TYPE(name, 'number', value);
    if (!Number.isInteger(value))
      throw new ERR_OUT_OF_RANGE(name, 'an integer', value);
    if (value < min || value > max)
      throw new ERR_OUT_OF_RANGE(name, `>= ${min} && <= ${max}`, value);
  }

  function validateNumber(value, name, min, max) {
    if (typeof value !== 'number')
      throw new ERR_INVALID_ARG_TYPE(name, 'number', value);
    if ((min != null && value < min) || (max != null && value > max) ||
        ((min != null || max != null) && Number.isNaN(value))) {
      throw new ERR_OUT_OF_RANGE(
        name,
        `${min != null ? `>= ${min}` : ''}${min != null && max != null ? ' && ' : ''}${max != null ? `<= ${max}` : ''}`,
        value);
    }
  }

  function validateString(value, name) {
    if (typeof value !== 'string')
      throw new ERR_INVALID_ARG_TYPE(name, 'string', value);
  }

  class FastBuffer extends Uint8Array {
    // Using an explicit constructor here is necessary to avoid relying on
    // `Array.prototype[Symbol.iterator]`, which can be mutated by users.
    // eslint-disable-next-line no-useless-constructor
    constructor(bufferOrLength, byteOffset, length) {
      super(bufferOrLength, byteOffset, length);
    }
  }

  let bufferWarningAlreadyEmitted = false;
  const bufferWarning = '[DEP0005] DeprecationWarning: Buffer() is deprecated ' +
                        'due to security and usability issues. ' +
                        'Please use the Buffer.alloc(), Buffer.allocUnsafe(), ' +
                        'or Buffer.from() methods instead.';

  /**
   * The Buffer() constructor is deprecated in documentation and should not be
   * used moving forward. Rather, developers should use one of the three new
   * factory APIs: Buffer.from(), Buffer.allocUnsafe() or Buffer.alloc() based on
   * their specific needs. There is no runtime deprecation because of the extent
   * to which the Buffer constructor is used in the ecosystem currently -- a
   * runtime deprecation would introduce too much breakage at this time. It's not
   * likely that the Buffer constructors would ever actually be removed.
   * Deprecation Code: DEP0005
   */
  function Buffer(arg, encodingOrOffset, length) {
    if (!bufferWarningAlreadyEmitted) {
      setTimeout(() => console.warn(bufferWarning));
      bufferWarningAlreadyEmitted = true;
    }
    // Common case.
    if (typeof arg === 'number') {
      if (typeof encodingOrOffset === 'string') {
        throw new ERR_INVALID_ARG_TYPE('string', 'string', arg);
      }
      return Buffer.alloc(arg);
    }
    return Buffer.from(arg, encodingOrOffset, length);
  }

  FastBuffer.prototype.constructor = Buffer;
  Buffer.prototype = FastBuffer.prototype;

  Object.defineProperty(Buffer, Symbol.species, {
    __proto__: null,
    enumerable: false,
    configurable: true,
    get() { return FastBuffer; }
  });

  // For backwards compatibility.
  Object.defineProperty(Buffer.prototype, 'parent', {
    __proto__: null,
    enumerable: true,
    get() {
      if (!(this instanceof Buffer))
        return undefined;
      return this.buffer;
    }
  });
  Object.defineProperty(Buffer.prototype, 'offset', {
    __proto__: null,
    enumerable: true,
    get() {
      if (!(this instanceof Buffer))
        return undefined;
      return this.byteOffset;
    }
  });

  function fromString(string, encoding) {
    let ops;
    if (typeof encoding !== 'string' || encoding.length === 0) {
      if (string.length === 0)
        return new FastBuffer();
      ops = encodingOps.utf8;
      encoding = undefined;
    } else {
      ops = getEncodingOps(encoding);
      if (ops === undefined)
        throw new ERR_UNKNOWN_ENCODING(encoding);
      if (string.length === 0)
        return new FastBuffer();
    }
    const ret = Buffer.alloc(ops.byteLength(string));
    ops.write(ret, string, 0, ret.length);
    return ret;
  }

  function fromArrayBuffer(obj, byteOffset, length) {
    // Convert byteOffset to integer
    if (byteOffset === undefined) {
      byteOffset = 0;
    } else {
      byteOffset = +byteOffset;
      if (Number.isNaN(byteOffset))
        byteOffset = 0;
    }

    const maxLength = obj.byteLength - byteOffset;

    if (maxLength < 0)
      throw new ERR_BUFFER_OUT_OF_BOUNDS('offset');

    if (length === undefined) {
      length = maxLength;
    } else {
      // Convert length to non-negative integer.
      length = +length;
      if (length > 0) {
        if (length > maxLength)
          throw new ERR_BUFFER_OUT_OF_BOUNDS('length');
      } else {
        length = 0;
      }
    }

    return new FastBuffer(obj, byteOffset, length);
  }

  function fromArrayLike(obj) {
    if (obj.length <= 0)
      return new FastBuffer();
    return new FastBuffer(obj);
  }

  function fromObject(obj) {
    if (obj.length !== undefined || obj.buffer instanceof ArrayBuffer) {
      if (typeof obj.length !== 'number') {
        return new FastBuffer();
      }
      return fromArrayLike(obj);
    }

    if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
      return fromArrayLike(obj.data);
    }
  }

  /**
   * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
   * if value is a number.
   * Buffer.from(str[, encoding])
   * Buffer.from(array)
   * Buffer.from(buffer)
   * Buffer.from(arrayBuffer[, byteOffset[, length]])
   */
  Buffer.from = function from(value, encodingOrOffset, length) {
    if (typeof value === 'string')
      return fromString(value, encodingOrOffset);

    if (typeof value === 'object' && value !== null) {
      if (value instanceof ArrayBuffer)
        return fromArrayBuffer(value, encodingOrOffset, length);

      const valueOf = value.valueOf && value.valueOf();
      if (valueOf != null &&
          valueOf !== value &&
          (typeof valueOf === 'string' || typeof valueOf === 'object')) {
        return from(valueOf, encodingOrOffset, length);
      }

      const b = fromObject(value);
      if (b)
        return b;

      if (typeof value[Symbol.toPrimitive] === 'function') {
        const primitive = value[Symbol.toPrimitive]('string');
        if (typeof primitive === 'string') {
          return fromString(primitive, encodingOrOffset);
        }
      }
    }

    throw new ERR_INVALID_ARG_TYPE(
      'first argument',
      ['string', 'Buffer', 'ArrayBuffer', 'Array', 'Array-like Object'],
      value
    );
  };

  // Identical to the built-in %TypedArray%.of(), but avoids using the deprecated
  // Buffer() constructor. Must use arrow function syntax to avoid automatically
  // adding a `prototype` property and making the function a constructor.
  //
  // Refs: https://tc39.github.io/ecma262/#sec-%typedarray%.of
  // Refs: https://esdiscuss.org/topic/isconstructor#content-11
  const of = (...items) => {
    const newObj = new FastBuffer(items.length);
    for (let k = 0; k < items.length; k++)
      newObj[k] = items[k];
    return newObj;
  };
  Buffer.of = of;

  Object.setPrototypeOf(Buffer, Uint8Array);

  // Return undefined if there is no match.
  // Move the "slow cases" to a separate function to make sure this function gets
  // inlined properly. That prioritizes the common case.
  function normalizeEncoding(enc) {
    if (enc == null || enc === 'utf8' || enc === 'utf-8') return 'utf8';
    return slowCases(enc);
  }
  function slowCases(enc) {
    switch (enc.length) {
      case 4:
        if (enc === 'UTF8') return 'utf8';
        if (enc === 'ucs2' || enc === 'UCS2') return 'utf16le';
        enc = `${enc}`.toLowerCase();
        if (enc === 'utf8') return 'utf8';
        if (enc === 'ucs2') return 'utf16le';
        break;
      case 3:
        if (enc === 'hex' || enc === 'HEX' ||
            `${enc}`.toLowerCase() === 'hex')
          return 'hex';
        break;
      case 5:
        if (enc === 'ascii') return 'ascii';
        if (enc === 'ucs-2') return 'utf16le';
        if (enc === 'UTF-8') return 'utf8';
        if (enc === 'ASCII') return 'ascii';
        if (enc === 'UCS-2') return 'utf16le';
        enc = `${enc}`.toLowerCase();
        if (enc === 'utf-8') return 'utf8';
        if (enc === 'ascii') return 'ascii';
        if (enc === 'ucs-2') return 'utf16le';
        break;
      case 6:
        if (enc === 'base64') return 'base64';
        if (enc === 'latin1' || enc === 'binary') return 'latin1';
        if (enc === 'BASE64') return 'base64';
        if (enc === 'LATIN1' || enc === 'BINARY') return 'latin1';
        enc = `${enc}`.toLowerCase();
        if (enc === 'base64') return 'base64';
        if (enc === 'latin1' || enc === 'binary') return 'latin1';
        break;
      case 7:
        if (enc === 'utf16le' || enc === 'UTF16LE' ||
            `${enc}`.toLowerCase() === 'utf16le')
          return 'utf16le';
        break;
      case 8:
        if (enc === 'utf-16le' || enc === 'UTF-16LE' ||
          `${enc}`.toLowerCase() === 'utf-16le')
          return 'utf16le';
        break;
      case 9:
        if (enc === 'base64url' || enc === 'BASE64URL' ||
            `${enc}`.toLowerCase() === 'base64url')
          return 'base64url';
        break;
      default:
        if (enc === '') return 'utf8';
    }
  }

  function _fill(buf, value, offset, end, encoding) {
    if (typeof value === 'string') {
      if (offset === undefined || typeof offset === 'string') {
        encoding = offset;
        offset = 0;
        end = buf.length;
      } else if (typeof end === 'string') {
        encoding = end;
        end = buf.length;
      }

      const normalizedEncoding = normalizeEncoding(encoding);
      if (normalizedEncoding === undefined) {
        validateString(encoding, 'encoding');
        throw new ERR_UNKNOWN_ENCODING(encoding);
      }

      if (value.length === 0) {
        // If value === '' default to zero.
        value = 0;
      } else if (value.length === 1) {
        // Fast path: If `value` fits into a single byte, use that numeric value.
        if (normalizedEncoding === 'utf8') {
          const code = value.charCodeAt(0);
          if (code < 128) {
            value = code;
          }
        } else if (normalizedEncoding === 'latin1') {
          value = value.charCodeAt(0);
        }
      }
    } else {
      encoding = undefined;
    }

    if (offset === undefined) {
      offset = 0;
      end = buf.length;
    } else {
      validateInteger(offset, 'offset');
      // Invalid ranges are not set to a default, so can range check early.
      if (end === undefined) {
        end = buf.length;
      } else {
        validateInteger(end, 'end', 0, buf.length);
      }
      if (offset >= end)
        return buf;
    }

    if (typeof value === 'number')
      Uint8Array.prototype.fill.call(buf, value, offset, end);
    else {
      if (!Buffer.isBuffer(value))
        value = Buffer.from(value, encoding)
      for (let i = 0; i < end - offset; ++i)
        buf[i + start] = val[i % value.length];
    }

    return buf;
  }

  Buffer.prototype.fill = function fill(value, offset, end, encoding) {
    return _fill(this, value, offset, end, encoding);
  };

  /**
   * Creates a new filled Buffer instance.
   * alloc(size[, fill[, encoding]])
   */
  Buffer.alloc = function alloc(size, fill, encoding) {
    validateNumber(size, 'size');
    if (fill !== undefined && fill !== 0 && size > 0) {
      const buf = new FastBuffer(size);
      return _fill(buf, fill, 0, buf.length, encoding);
    }
    return new FastBuffer(size);
  };

  /**
   * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer
   * instance. If `--zero-fill-buffers` is set, will zero-fill the buffer.
   */
  Buffer.allocUnsafe = function allocUnsafe(size) {
    validateNumber(size, 'size');
    return allocate(size);
  };

  function allocate(size) {
    if (size <= 0)
      return new FastBuffer();
    return new FastBuffer(size);
  }

  function toInteger(n, defaultVal) {
    n = +n;
    if (!Number.isNaN(n) &&
        n >= Number.MIN_SAFE_INTEGER &&
        n <= Number.MAX_SAFE_INTEGER) {
      return ((n % 1) === 0 ? n : Math.floor(n));
    }
    return defaultVal;
  }

  function _copy(source, target, targetStart, sourceStart, sourceEnd) {
    if (!(source instanceof Uint8Array))
      throw new ERR_INVALID_ARG_TYPE('source', ['Buffer', 'Uint8Array'], source);
    if (!(target instanceof Uint8Array))
      throw new ERR_INVALID_ARG_TYPE('target', ['Buffer', 'Uint8Array'], target);

    if (targetStart === undefined) {
      targetStart = 0;
    } else {
      targetStart = toInteger(targetStart, 0);
      if (targetStart < 0)
        throw new ERR_OUT_OF_RANGE('targetStart', '>= 0', targetStart);
    }

    if (sourceStart === undefined) {
      sourceStart = 0;
    } else {
      sourceStart = toInteger(sourceStart, 0);
      if (sourceStart < 0)
        throw new ERR_OUT_OF_RANGE('sourceStart', '>= 0', sourceStart);
    }

    if (sourceEnd === undefined) {
      sourceEnd = source.length;
    } else {
      sourceEnd = toInteger(sourceEnd, 0);
      if (sourceEnd < 0)
        throw new ERR_OUT_OF_RANGE('sourceEnd', '>= 0', sourceEnd);
    }

    if (targetStart >= target.length || sourceStart >= sourceEnd)
      return 0;

    if (sourceStart > source.length) {
      throw new ERR_OUT_OF_RANGE('sourceStart',
                                `<= ${source.length}`,
                                sourceStart);
    }

    return _copyActual(source, target, targetStart, sourceStart, sourceEnd);
  }

  function _copyActual(source, target, targetStart, sourceStart, sourceEnd) {
    if (sourceEnd - sourceStart > target.length - targetStart)
      sourceEnd = sourceStart + target.length - targetStart;

    let nb = sourceEnd - sourceStart;
    const sourceLen = source.length - sourceStart;
    if (nb > sourceLen)
      nb = sourceLen;

    if (sourceStart !== 0 || sourceEnd < source.length)
      source = new Uint8Array(source.buffer, source.byteOffset + sourceStart, nb);

    target.set(source, targetStart);

    return nb;
  }

  Buffer.prototype.copy = function copy(target, targetStart, sourceStart, sourceEnd) {
    return _copy(this, target, targetStart, sourceStart, sourceEnd);
  };

  Buffer.isBuffer = function isBuffer(b) {
    return b instanceof Buffer;
  };

  function _compare(buf1, buf2) {
    if (buf1.length < buf2.length)
      return -1;
    if (buf1.length > buf2.length)
      return 1;
    for (let i = 0; i < buf1.length; ++i) {
      const c1 = buf1[i];
      const c2 = buf2[i];
      if (c1 < c2)
        return -1;
      if (c1 > c2)
        return 1;
    }
    return 0;
  }

  Buffer.compare = function compare(buf1, buf2) {
    if (!(buf1 instanceof Uint8Array)) {
      throw new ERR_INVALID_ARG_TYPE('buf1', ['Buffer', 'Uint8Array'], buf1);
    }

    if (!(buf2 instanceof Uint8Array)) {
      throw new ERR_INVALID_ARG_TYPE('buf2', ['Buffer', 'Uint8Array'], buf2);
    }

    if (buf1 === buf2)
      return 0;

    return _compare(buf1, buf2);
  };

  Buffer.prototype.equals = function equals(otherBuffer) {
    if (!(otherBuffer instanceof Uint8Array)) {
      throw new ERR_INVALID_ARG_TYPE(
        'otherBuffer', ['Buffer', 'Uint8Array'], otherBuffer);
    }

    if (this === otherBuffer)
      return true;

    if (this.byteLength !== otherBuffer.byteLength)
      return false;

    return this.byteLength === 0 || _compare(this, otherBuffer) === 0;
  };

  Buffer.isEncoding = function isEncoding(encoding) {
    return typeof encoding === 'string' && encoding.length !== 0 &&
          normalizeEncoding(encoding) !== undefined;
  };
  Buffer[Symbol.for('kIsEncodingSymbol')] = Buffer.isEncoding;

  Buffer.concat = function concat(list, length) {
    validateArray(list, 'list');

    if (list.length === 0)
      return new FastBuffer();

    if (length === undefined) {
      length = 0;
      for (let i = 0; i < list.length; i++) {
        if (list[i].length) {
          length += list[i].length;
        }
      }
    } else {
      validateInteger(length, 'length');
    }

    const buffer = Buffer.allocUnsafe(length);
    let pos = 0;
    for (let i = 0; i < list.length; i++) {
      const buf = list[i];
      if (!(buf instanceof Uint8Array)) {
        // TODO(BridgeAR): This should not be of type ERR_INVALID_ARG_TYPE.
        // Instead, find the proper error code for this.
        throw new ERR_INVALID_ARG_TYPE(
          `list[${i}]`, ['Buffer', 'Uint8Array'], list[i]);
      }
      pos += _copyActual(buf, buffer, pos, 0, buf.length);
    }

    // Note: `length` is always equal to `buffer.length` at this point
    if (pos < length) {
      // Zero-fill the remaining bytes if the specified `length` was more than
      // the actual total length, i.e. if we have some remaining allocated bytes
      // there were not initialized.
      Uint8Array.prototype.fill.call(buffer, 0, pos, length);
    }

    return buffer;
  };

  const customInspectSymbol = Symbol.for('nodejs.util.inspect.custom');

  let INSPECT_MAX_BYTES = 50;
  Buffer.prototype[customInspectSymbol] = function inspect(recurseTimes, ctx) {
    const max = INSPECT_MAX_BYTES;
    const actualMax = Math.min(max, this.length);
    const remaining = this.length - max;
    let str = this.hexSlice(0, actualMax).replace(/(.{2})/g, '$1 ').trim();
    if (remaining > 0)
      str += ` ... ${remaining} more byte${remaining > 1 ? 's' : ''}`;
    return `<${this.constructor.name} ${str}>`;
  };
  Buffer.prototype.inspect = Buffer.prototype[customInspectSymbol];

  Object.defineProperty(Buffer, 'INSPECT_MAX_BYTES', {
    __proto__: null,
    configurable: true,
    enumerable: true,
    get() { return INSPECT_MAX_BYTES; },
    set(val) { INSPECT_MAX_BYTES = val; }
  });

  // Raw errors are intentional
  Buffer.prototype.asciiWrite = function asciiWrite(string, offset, length) {
    if (typeof string !== 'string')
      throw new TypeError('argument must be a string');
    if (typeof offset === 'undefined')
      offset = 0;
    if (typeof length === 'undefined')
      length = string.length;
    if (offset < 0 || length < 0)
      throw new RangeError('Index out of range');
    if (offset > this.length)
      throw new RangeError('"offset" is outside of buffer bounds');
    length = Math.min(this.length - offset, string.length, length);
    let i;
    for (i = 0; i < length; ++i)
      this[offset++] = string.charCodeAt(i) & 0xFF;
    return i;
  }

  Buffer.prototype.asciiSlice = function asciiSlice(start = 0, end = this.length) {
    if (start < 0 || start > this.length || end > this.length)
      throw new RangeError('Index out of range');
    if (end < start)
      end = start;
    let ret = '';
    for (let i = start; i < end; ++i)
      ret += String.fromCharCode(this[i] & 0x7F);
    return ret;
  }

  function isLeadSurrogate(codePoint) {
    return (codePoint & 0xfc00) == 0xd800;
  }

  function isTrailSurrogate(codePoint) {
    return (codePoint & 0xfc00) == 0xdc00;
  }

  function byteLengthUtf8(string) {
    let byteLength = 0;
    let previous = null;
    for (let i = 0; i < string.length; ++i) {
      const c = string.charCodeAt(i);
      if (c <= 0x7f) {
        byteLength += 1;
      } else if (c <= 0x7ff) {
        byteLength += 2;
      } else if (c <= 0xffff) {
        if (previous !== null && (isLeadSurrogate(previous) && isTrailSurrogate(c))) {
          byteLength += 1;
        } else byteLength += 3;
      } else {
        byteLength += 4;
      }
      previous = c;
    }
    return byteLength;
  };

  Buffer.prototype.utf8Write = function utf8Write(string, offset, length) {
    if (typeof string !== 'string')
      throw new TypeError('argument must be a string');
    if (typeof offset === 'undefined')
      offset = 0;
    if (typeof length === 'undefined')
      length = byteLengthUtf8(string);
    if (offset < 0)
      throw new RangeError('Index out of range');
    if (offset > this.length)
      throw new RangeError('"offset" is outside of buffer bounds');
    if (length < 0)
      throw new RangeError('Index out of range');
    length = Math.min(this.length - offset, byteLengthUtf8(string), length);
    let written = 0;
    let lead = null;
    for (let i = 0; i != string.length; ++i) {
      let code = string.charCodeAt(i);
      if (code > 0xD7FF && code < 0xE000) {
        if (!lead) {
          if (code > 0xDBFF || i + 1 === string.length) {
            if ((length -= 3) > -1) {
              this[offset++] = 0xEF;
              this[offset++] = 0xBF;
              this[offset++] = 0xBD;
              written += 3;
            }
          } else lead = code;
          continue;
        }
        if (code < 0xDC00) {
          if ((length -= 3) > -1) {
            this[offset++] = 0xEF;
            this[offset++] = 0xBF;
            this[offset++] = 0xBD;
            written += 3;
          }
          lead = code;
          continue;
        }
        code = 0x10000 + ((lead & 0x3ff) << 10) + (code & 0x3ff);
      } else if (lead && (length -= 3) > -1) {
        this[offset++] = 0xEF;
        this[offset++] = 0xBF;
        this[offset++] = 0xBD;
        written += 3;
      }
      lead = null;
      if (code < 0x80) {
        if ((length -= 1) < 0)
          break;
        this[offset++] = code;
        ++written;
      } else if (code < 0x800) {
        if ((length -= 2) < 0)
          break;
        this[offset++] = code >> 0x6 | 0xC0;
        this[offset++] = code & 0x3F | 0x80;
        written += 2;
      } else if (code < 0x10000) {
        if ((length -= 3) < 0)
          break;
        this[offset++] = code >> 0xC | 0xE0;
        this[offset++] = code >> 0x6 & 0x3F | 0x80;
        this[offset++] = code & 0x3F | 0x80;
        written += 3;
      } else if (code < 0x110000) {
        if ((length -= 4) < 0)
          break;
        this[offset++] = code >> 0x12 | 0xF0;
        this[offset++] = code >> 0xC & 0x3F | 0x80;
        this[offset++] = code >> 0x6 & 0x3F | 0x80;
        this[offset++] = code & 0x3F | 0x80;
        written += 4;
      }
    }
    return written;
  }

  Buffer.prototype.utf8Slice = function utf8Slice(start = 0, end = this.length) {
    if (start < 0 || start > this.length || end > this.length)
      throw new RangeError('Index out of range');
    if (end < start)
      end = start;
    let res = '';
    let i = start;
    while (i < end) {
      const first = this[i];
      let code = null;
      if (first <= 0xBF) {
        if (i + 1 <= end) {
          if (first < 0x80) {
            code = first;
            ++i;
          }
        }
      } else if (first <= 0xDF) {
        if (i + 2 <= end) {
          const second = this[i + 1];
          if ((second & 0xC0) === 0x80) {
            const tmp = (first & 0x1F) << 0x6 | (second & 0x3F);
            if (tmp > 0x7F) {
              code = tmp;
              i += 2;
            }
          }
        }
      } else if (first <= 0xEF) {
        if (i + 3 <= end) {
          const second = this[i + 1];  
          const third = this[i + 2];
          if ((second & 0xC0) === 0x80 && (third & 0xC0) === 0x80) {
            const tmp = (first & 0xF) << 0xC | (second & 0x3F) << 0x6 | (third & 0x3F);
            if (tmp > 0x7FF && (tmp < 0xD800 || tmp > 0xDFFF)) {
              code = tmp;
              i += 3;
            }
          }
        }
      } else if (i + 4 <= end) {
        const second = this[i + 1];
        const third = this[i + 2];
        const fourth = this[i + 3];
        if ((second & 0xC0) === 0x80 && (third & 0xC0) === 0x80 && (fourth & 0xC0) === 0x80) {
          const tmp = (first & 0xF) << 0x12 | (second & 0x3F) << 0xC | (third & 0x3F) << 0x6 | (fourth & 0x3F);
          if (tmp > 0xFFFF && tmp < 0x110000) {
            code = tmp;
            i += 4;
          }
        }
      }
      if (code === null) {
        res += '\uFFFD';
        ++i;
        continue;
      }
      if (code > 0xFFFF) {
        code -= 0x10000;
        res += String.fromCharCode(0xd800 + (((code - 0x10000) >> 10) & 0x3ff));
        code = 0xdc00 + (code & 0x3ff);
      }
      res += String.fromCharCode(code);
    }
    return res;
  }

  Buffer.prototype.ucs2Write = function ucs2Write(string, offset, length) {
    if (typeof string !== 'string')
      throw new TypeError('argument must be a string');
    if (typeof offset === 'undefined')
      offset = 0;
    if (typeof length === 'undefined')
      length = string.length * 2;
    if (offset < 0)
      throw new RangeError('Index out of range');
    if (offset > this.length)
      throw new RangeError('"offset" is outside of buffer bounds');
    if (length < 0)
      throw new RangeError('Index out of range');
    length = Math.min(this.length - offset, string.length * 2, length);
    let written = 0;
    for (let i = 0; i < string.length; ++i) {
      if ((length -= 2) < 0)
        break;
      const c = string.charCodeAt(i);
      this[offset++] = c & 0xFF;
      this[offset++] = c >> 8;
      written += 2;
    }
    return written;
  }

  Buffer.prototype.ucs2Slice = function ucs2Slice(start = 0, end = this.length) {
    if (start < 0 || start > this.length || end > this.length)
      throw new RangeError('Index out of range');
    if (end < start)
      end = start;
    let res = '';
    for (let i = start; i < end - 1; i += 2)
      res += String.fromCharCode((this[i + 1] << 8) + this[i]);
    return res;
  }

  Buffer.prototype.latin1Write = function latin1Write(string, offset, length) {
    if (typeof string !== 'string')
      throw new TypeError('argument must be a string');
    if (typeof offset === 'undefined')
      offset = 0;
    if (typeof length === 'undefined')
      length = string.length;
    if (offset < 0 || length < 0)
      throw new RangeError('Index out of range');
    if (offset > this.length)
      throw new RangeError('"offset" is outside of buffer bounds');
    length = Math.min(this.length - offset, string.length, length);
    let i;
    for (i = 0; i < length; ++i)
      this[offset++] = string.charCodeAt(i) & 0xFF;
    return i;
  }

  Buffer.prototype.latin1Slice = function latin1Slice(start = 0, end = this.length) {
    if (start < 0 || start > this.length || end > this.length)
      throw new RangeError('Index out of range');
    if (end < start)
      end = start;
    let ret = '';
    for (let i = start; i < end; ++i)
      ret += String.fromCharCode(this[i]);
    return ret;
  }

  function base64ByteLength(str, bytes) {
    // Handle padding
    if (str.charCodeAt(bytes - 1) === 0x3D)
      bytes--;
    if (bytes > 1 && str.charCodeAt(bytes - 1) === 0x3D)
      bytes--;

    // Base64 ratio: 3/4
    return (bytes * 3) >>> 2;
  }

  Buffer.prototype.base64Write = function base64Write(string, offset, length) {
    if (typeof string !== 'string')
      throw new TypeError('argument must be a string');
    if (typeof offset === 'undefined')
      offset = 0;
    if (typeof length === 'undefined')
      length = base64ByteLength(string);
    if (offset < 0)
      throw new RangeError('Index out of range');
    if (offset > this.length)
      throw new RangeError('"offset" is outside of buffer bounds');
    if (length < 0)
      throw new RangeError('Index out of range');
    length = Math.min(this.length - offset, base64ByteLength(string, string.length), length);
    const decoded = atob(string.trim());
    return this.latin1Write(decoded, offset, length);
  }

  Buffer.prototype.base64Slice = function base64Slice(start = 0, end = this.length) {
    if (start < 0 || start > this.length || end > this.length)
      throw new RangeError('Index out of range');
    if (end < start)
      end = start;
    return btoa(this.toString('latin1', start, end));
  }

  Buffer.prototype.base64urlWrite = function base64urlWrite(string, offset, length) {
    if (typeof string !== 'string')
      throw new TypeError('argument must be a string');
    if (typeof offset === 'undefined')
      offset = 0;
    if (typeof length === 'undefined')
      length = base64ByteLength(string);
    if (offset < 0)
      throw new RangeError('Index out of range');
    if (offset > this.length)
      throw new RangeError('"offset" is outside of buffer bounds');
    if (length < 0)
      throw new RangeError('Index out of range');
    length = Math.min(this.length - offset, base64ByteLength(string, string.length), length);
    const decoded = atob(string.trim().replace(/-/g, '+').replace(/_/g, '/'));
    return this.latin1Write(decoded, offset, length);
  }

  Buffer.prototype.base64urlSlice = function base64urlSlice(start = 0, end = this.length) {
    if (start < 0 || start > this.length || end > this.length)
      throw new RangeError('Index out of range');
    if (end < start)
      end = start;
    return btoa(this.toString('latin1', start, end)).replace(/\+/g, '-').replace(/\//g, '_');
  }

  Buffer.prototype.hexWrite = function hexWrite(string, offset, length) {
    if (typeof string !== 'string')
      throw new TypeError('argument must be a string');
    if (typeof offset === 'undefined')
      offset = 0;
    if (typeof length === 'undefined')
      length = string.length >>> 1;
    if (offset < 0)
      throw new RangeError('Index out of range');
    if (offset > this.length)
      throw new RangeError('"offset" is outside of buffer bounds');
    if (length < 0)
      throw new RangeError('Index out of range');
    length = Math.min(this.length - offset, string.length >>> 1, length);
    let i;
    for (i = 0; i < length; ++i) {
      const code = parseInt(string.slice(i * 2, i * 2 + 1), 16);
      if (Number.isNaN(code))
        return i;
      this[offset++] = code;
    }
    return i;
  }

  Buffer.prototype.hexSlice = function hexSlice(start = 0, end = this.length) {
    if (start < 0 || start > this.length || end > this.length)
      throw new RangeError('Index out of range');
    if (end < start)
      end = start;
    let res = '';
    for (let i = start; i < end; ++i)
      res += this[i].toString(16);
    return res;
  }

  const encodingOps = {
    utf8: {
      encoding: 'utf8',
      byteLength: byteLengthUtf8,
      write: (buf, string, offset, len) => buf.utf8Write(string, offset, len),
      slice: (buf, start, end) => buf.utf8Slice(start, end)
    },
    ucs2: {
      encoding: 'ucs2',
      byteLength: (string) => string.length * 2,
      write: (buf, string, offset, len) => buf.ucs2Write(string, offset, len),
      slice: (buf, start, end) => buf.ucs2Slice(start, end)
    },
    utf16le: {
      encoding: 'utf16le',
      byteLength: (string) => string.length * 2,
      write: (buf, string, offset, len) => buf.ucs2Write(string, offset, len),
      slice: (buf, start, end) => buf.ucs2Slice(start, end)
    },
    latin1: {
      encoding: 'latin1',
      byteLength: (string) => string.length,
      write: (buf, string, offset, len) => buf.latin1Write(string, offset, len),
      slice: (buf, start, end) => buf.latin1Slice(start, end)
    },
    ascii: {
      encoding: 'ascii',
      byteLength: (string) => string.length,
      write: (buf, string, offset, len) => buf.asciiWrite(string, offset, len),
      slice: (buf, start, end) => buf.asciiSlice(start, end)
    },
    base64: {
      encoding: 'base64',
      byteLength: (string) => base64ByteLength(string, string.length),
      write: (buf, string, offset, len) => buf.base64Write(string, offset, len),
      slice: (buf, start, end) => buf.base64Slice(start, end)
    },
    base64url: {
      encoding: 'base64url',
      byteLength: (string) => base64ByteLength(string, string.length),
      write: (buf, string, offset, len) =>
        buf.base64urlWrite(string, offset, len),
      slice: (buf, start, end) => buf.base64urlSlice(start, end)
    },
    hex: {
      encoding: 'hex',
      byteLength: (string) => string.length >>> 1,
      write: (buf, string, offset, len) => buf.hexWrite(string, offset, len),
      slice: (buf, start, end) => buf.hexSlice(start, end)
    }
  };
  function getEncodingOps(encoding) {
    encoding += '';
    switch (encoding.length) {
      case 4:
        if (encoding === 'utf8') return encodingOps.utf8;
        if (encoding === 'ucs2') return encodingOps.ucs2;
        encoding = encoding.toLowerCase();
        if (encoding === 'utf8') return encodingOps.utf8;
        if (encoding === 'ucs2') return encodingOps.ucs2;
        break;
      case 5:
        if (encoding === 'utf-8') return encodingOps.utf8;
        if (encoding === 'ascii') return encodingOps.ascii;
        if (encoding === 'ucs-2') return encodingOps.ucs2;
        encoding = encoding.toLowerCase();
        if (encoding === 'utf-8') return encodingOps.utf8;
        if (encoding === 'ascii') return encodingOps.ascii;
        if (encoding === 'ucs-2') return encodingOps.ucs2;
        break;
      case 7:
        if (encoding === 'utf16le' ||
            encoding.toLowerCase() === 'utf16le')
          return encodingOps.utf16le;
        break;
      case 8:
        if (encoding === 'utf-16le' ||
            encoding.toLowerCase() === 'utf-16le')
          return encodingOps.utf16le;
        break;
      case 6:
        if (encoding === 'latin1' || encoding === 'binary')
          return encodingOps.latin1;
        if (encoding === 'base64') return encodingOps.base64;
        encoding = encoding.toLowerCase();
        if (encoding === 'latin1' || encoding === 'binary')
          return encodingOps.latin1;
        if (encoding === 'base64') return encodingOps.base64;
        break;
      case 3:
        if (encoding === 'hex' || encoding.toLowerCase() === 'hex')
          return encodingOps.hex;
        break;
      case 9:
        if (encoding === 'base64url' ||
            encoding.toLowerCase() === 'base64url')
          return encodingOps.base64url;
        break;
    }
  }

  function arrayIndexOf(arr, val, byteOffset, encoding, dir) {
    let indexSize = 1;
    let arrLength = arr.length;
    let valLength = val.length;

    if (encoding !== undefined) {
      encoding = `${encoding}`.toLowerCase();
      if (encoding === 'ucs2' || encoding === 'ucs-2' ||
          encoding === 'utf16le' || encoding === 'utf-16le') {
        if (arr.length < 2 || val.length < 2)
          return -1;
        indexSize = 2;
        arrLength /= 2;
        valLength /= 2;
        byteOffset /= 2;
      }
    }

    function read(buf, i) {
      if (indexSize === 1) {
        return buf[i];
      } else {
        return buf.readUInt16BE(i * indexSize);
      }
    }

    let i;
    if (dir) {
      let foundIndex = -1;
      for (i = byteOffset; i < arrLength; i++) {
        if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
          if (foundIndex === -1)
            foundIndex = i;
          if (i - foundIndex + 1 === valLength)
            return foundIndex * indexSize;
        } else {
          if (foundIndex !== -1)
            i -= i - foundIndex;
          foundIndex = -1;
        }
      }
    } else {
      if (byteOffset + valLength > arrLength)
        byteOffset = arrLength - valLength;
      for (i = byteOffset; i >= 0; i--) {
        let found = true;
        for (let j = 0; j < valLength; j++) {
          if (read(arr, i + j) !== read(val, j)) {
            found = false;
            break;
          }
        }
        if (found)
          return i;
      }
    }
    return -1;
  }

  // Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
  // OR the last index of `val` in `buffer` at offset <= `byteOffset`.
  //
  // Arguments:
  // - buffer - a Buffer to search
  // - val - a string, Buffer, or number
  // - byteOffset - an index into `buffer`; will be clamped to an int32
  // - encoding - an optional encoding, relevant if val is a string
  // - dir - true for indexOf, false for lastIndexOf
  function bidirectionalIndexOf(buffer, val, byteOffset, encoding, dir) {
    validateBuffer(buffer);

    if (typeof byteOffset === 'string') {
      encoding = byteOffset;
      byteOffset = undefined;
    } else if (byteOffset > 0x7fffffff) {
      byteOffset = 0x7fffffff;
    } else if (byteOffset < -0x80000000) {
      byteOffset = -0x80000000;
    }
    // Coerce to Number. Values like null and [] become 0.
    byteOffset = +byteOffset;
    // If the offset is undefined, "foo", {}, coerces to NaN, search whole buffer.
    if (Number.isNaN(byteOffset)) {
      byteOffset = dir ? 0 : (buffer.length || buffer.byteLength);
    }

    if (typeof val === 'number')
      return dir
        ? Uint8Array.prototype.indexOf.call(buffer, val & 0xFF, byteOffset)
        : Uint8Array.prototype.lastIndexOf.call(buffer, val & 0xFF, byteOffset);

    if (typeof val === 'string')
      val = Buffer.from(val, encoding);

    if (val instanceof Uint8Array)
      return arrayIndexOf(buffer, val, byteOffset, encoding, dir);

    throw new ERR_INVALID_ARG_TYPE(
      'value', ['number', 'string', 'Buffer', 'Uint8Array'], val
    );
  }

  Buffer.prototype.indexOf = function indexOf(val, byteOffset, encoding) {
    return bidirectionalIndexOf(this, val, byteOffset, encoding, true);
  };

  Buffer.prototype.lastIndexOf = function lastIndexOf(val, byteOffset, encoding) {
    return bidirectionalIndexOf(this, val, byteOffset, encoding, false);
  };

  Buffer.prototype.includes = function includes(val, byteOffset, encoding) {
    return this.indexOf(val, byteOffset, encoding) !== -1;
  };

  Buffer.prototype.write = function write(string, offset, length, encoding) {
    // Buffer#write(string);
    if (offset === undefined) {
      return this.utf8Write(string, 0, this.length);
    }
    // Buffer#write(string, encoding)
    if (length === undefined && typeof offset === 'string') {
      encoding = offset;
      length = this.length;
      offset = 0;

    // Buffer#write(string, offset[, length][, encoding])
    } else {
      validateInteger(offset, 'offset', 0, this.length);

      const remaining = this.length - offset;

      if (length === undefined) {
        length = remaining;
      } else if (typeof length === 'string') {
        encoding = length;
        length = remaining;
      } else {
        validateInteger(length, 'length', 0, this.length);
        if (length > remaining)
          length = remaining;
      }
    }

    if (!encoding)
      return this.utf8Write(string, offset, length);

    const ops = getEncodingOps(encoding);
    if (ops === undefined)
      throw new ERR_UNKNOWN_ENCODING(encoding);
    return ops.write(this, string, offset, length);
  };

  // No need to verify that "buf.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.
  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  Buffer.prototype.toString = function toString(encoding, start, end) {
    if (arguments.length === 0) {
      return this.utf8Slice(0, this.length);
    }

    const len = this.length;

    if (start <= 0)
      start = 0;
    else if (start >= len)
      return '';
    else
      start |= 0;

    if (end === undefined || end > len)
      end = len;
    else
      end |= 0;

    if (end <= start)
      return '';

    if (encoding === undefined)
      return this.utf8Slice(start, end);

    const ops = getEncodingOps(encoding);
    if (ops === undefined)
      throw new ERR_UNKNOWN_ENCODING(encoding);

    return ops.slice(this, start, end);
  };

  Buffer.prototype.toJSON = function toJSON() {
    if (this.length > 0) {
      const data = new Array(this.length);
      for (let i = 0; i < this.length; ++i)
        data[i] = this[i];
      return { type: 'Buffer', data };
    }
    return { type: 'Buffer', data: [] };
  };

  function adjustOffset(offset, length) {
    // Use Math.trunc() to convert offset to an integer value that can be larger
    // than an Int32. Hence, don't use offset | 0 or similar techniques.
    offset = Math.trunc(offset);
    if (offset === 0) {
      return 0;
    }
    if (offset < 0) {
      offset += length;
      return offset > 0 ? offset : 0;
    }
    if (offset < length) {
      return offset;
    }
    return Number.isNaN(offset) ? 0 : length;
  }

  Buffer.prototype.subarray = function subarray(start, end) {
    const srcLength = this.length;
    start = adjustOffset(start, srcLength);
    end = end !== undefined ? adjustOffset(end, srcLength) : srcLength;
    const newLength = end > start ? end - start : 0;
    return new FastBuffer(this.buffer, this.byteOffset + start, newLength);
  };

  Buffer.prototype.slice = function slice(start, end) {
    return this.subarray(start, end);
  };

  function swap(b, n, m) {
    const i = b[n];
    b[n] = b[m];
    b[m] = i;
  }

  Buffer.prototype.swap16 = function swap16() {
    if (len % 2 !== 0)
      throw new ERR_INVALID_BUFFER_SIZE('16-bits');
    for (let i = 0; i < len; i += 2)
      swap(this, i, i + 1);
    return this;
  };

  Buffer.prototype.swap32 = function swap32() {
    if (len % 4 !== 0)
      throw new ERR_INVALID_BUFFER_SIZE('32-bits');
    for (let i = 0; i < len; i += 4) {
      swap(this, i, i + 3);
      swap(this, i + 1, i + 2);
    }
    return this;
  };

  Buffer.prototype.swap64 = function swap64() {
    if (len % 8 !== 0)
      throw new ERR_INVALID_BUFFER_SIZE('64-bits');
    for (let i = 0; i < len; i += 8) {
      swap(this, i, i + 7);
      swap(this, i + 1, i + 6);
      swap(this, i + 2, i + 5);
      swap(this, i + 3, i + 4);
    }
    return this;
  };

  Buffer.prototype.toLocaleString = Buffer.prototype.toString;

  // Temporary buffers to convert numbers.
  const float32Array = new Float32Array(1);
  const uInt8Float32Array = new Uint8Array(float32Array.buffer);
  const float64Array = new Float64Array(1);
  const uInt8Float64Array = new Uint8Array(float64Array.buffer);

  // Check endianness.
  float32Array[0] = -1; // 0xBF800000
  // Either it is [0, 0, 128, 191] or [191, 128, 0, 0]. It is not possible to
  // check this with `os.endianness()` because that is determined at compile time.
  const bigEndian = uInt8Float32Array[3] === 0;

  function checkBounds(buf, offset, byteLength) {
    validateNumber(offset, 'offset');
    if (buf[offset] === undefined || buf[offset + byteLength] === undefined)
      boundsError(offset, buf.length - (byteLength + 1));
  }

  function checkInt(value, min, max, buf, offset, byteLength) {
    if (value > max || value < min) {
      const n = typeof min === 'bigint' ? 'n' : '';
      let range;
      if (byteLength > 3) {
        if (min === 0 || min === 0n) {
          range = `>= 0${n} and < 2${n} ** ${(byteLength + 1) * 8}${n}`;
        } else {
          range = `>= -(2${n} ** ${(byteLength + 1) * 8 - 1}${n}) and ` +
                  `< 2${n} ** ${(byteLength + 1) * 8 - 1}${n}`;
        }
      } else {
        range = `>= ${min}${n} and <= ${max}${n}`;
      }
      throw new ERR_OUT_OF_RANGE('value', range, value);
    }
    checkBounds(buf, offset, byteLength);
  }

  function boundsError(value, length, type) {
    if (Math.floor(value) !== value) {
      validateNumber(value, type);
      throw new ERR_OUT_OF_RANGE(type || 'offset', 'an integer', value);
    }

    if (length < 0)
      throw new ERR_BUFFER_OUT_OF_BOUNDS();

    throw new ERR_OUT_OF_RANGE(type || 'offset',
                              `>= ${type ? 1 : 0} and <= ${length}`,
                              value);
  }

  // Read integers.
  Buffer.prototype.readBigUInt64LE = function readBigUInt64LE(offset = 0) {
    validateNumber(offset, 'offset');
    const first = this[offset];
    const last = this[offset + 7];
    if (first === undefined || last === undefined)
      boundsError(offset, this.length - 8);

    const lo = first +
      this[++offset] * 2 ** 8 +
      this[++offset] * 2 ** 16 +
      this[++offset] * 2 ** 24;

    const hi = this[++offset] +
      this[++offset] * 2 ** 8 +
      this[++offset] * 2 ** 16 +
      last * 2 ** 24;

    return BigInt(lo) + (BigInt(hi) << 32n);
  }

  Buffer.prototype.readBigUInt64BE = function readBigUInt64BE(offset = 0) {
    validateNumber(offset, 'offset');
    const first = this[offset];
    const last = this[offset + 7];
    if (first === undefined || last === undefined)
      boundsError(offset, this.length - 8);

    const hi = first * 2 ** 24 +
      this[++offset] * 2 ** 16 +
      this[++offset] * 2 ** 8 +
      this[++offset];

    const lo = this[++offset] * 2 ** 24 +
      this[++offset] * 2 ** 16 +
      this[++offset] * 2 ** 8 +
      last;

    return (BigInt(hi) << 32n) + BigInt(lo);
  }

  Buffer.prototype.readBigInt64LE = function readBigInt64LE(offset = 0) {
    validateNumber(offset, 'offset');
    const first = this[offset];
    const last = this[offset + 7];
    if (first === undefined || last === undefined)
      boundsError(offset, this.length - 8);

    const val = this[offset + 4] +
      this[offset + 5] * 2 ** 8 +
      this[offset + 6] * 2 ** 16 +
      (last << 24); // Overflow
    return (BigInt(val) << 32n) +
      BigInt(first +
      this[++offset] * 2 ** 8 +
      this[++offset] * 2 ** 16 +
      this[++offset] * 2 ** 24);
  }

  Buffer.prototype.readBigInt64BE = function readBigInt64BE(offset = 0) {
    validateNumber(offset, 'offset');
    const first = this[offset];
    const last = this[offset + 7];
    if (first === undefined || last === undefined)
      boundsError(offset, this.length - 8);

    const val = (first << 24) + // Overflow
      this[++offset] * 2 ** 16 +
      this[++offset] * 2 ** 8 +
      this[++offset];
    return (BigInt(val) << 32n) +
      BigInt(this[++offset] * 2 ** 24 +
      this[++offset] * 2 ** 16 +
      this[++offset] * 2 ** 8 +
      last);
  }

  Buffer.prototype.readUIntLE = function readUIntLE(offset, byteLength) {
    if (offset === undefined)
      throw new ERR_INVALID_ARG_TYPE('offset', 'number', offset);
    if (byteLength === 6)
      return readUInt48LE(this, offset);
    if (byteLength === 5)
      return readUInt40LE(this, offset);
    if (byteLength === 3)
      return readUInt24LE(this, offset);
    if (byteLength === 4)
      return this.readUInt32LE(offset);
    if (byteLength === 2)
      return this.readUInt16LE(offset);
    if (byteLength === 1)
      return this.readUInt8(offset);

    boundsError(byteLength, 6, 'byteLength');
  }

  Buffer.prototype.readUInt48LE = function readUInt48LE(buf, offset = 0) {
    validateNumber(offset, 'offset');
    const first = buf[offset];
    const last = buf[offset + 5];
    if (first === undefined || last === undefined)
      boundsError(offset, buf.length - 6);

    return first +
      buf[++offset] * 2 ** 8 +
      buf[++offset] * 2 ** 16 +
      buf[++offset] * 2 ** 24 +
      (buf[++offset] + last * 2 ** 8) * 2 ** 32;
  }

  Buffer.prototype.readUInt40LE = function readUInt40LE(buf, offset = 0) {
    validateNumber(offset, 'offset');
    const first = buf[offset];
    const last = buf[offset + 4];
    if (first === undefined || last === undefined)
      boundsError(offset, buf.length - 5);

    return first +
      buf[++offset] * 2 ** 8 +
      buf[++offset] * 2 ** 16 +
      buf[++offset] * 2 ** 24 +
      last * 2 ** 32;
  }

  Buffer.prototype.readUInt32LE = function readUInt32LE(offset = 0) {
    validateNumber(offset, 'offset');
    const first = this[offset];
    const last = this[offset + 3];
    if (first === undefined || last === undefined)
      boundsError(offset, this.length - 4);

    return first +
      this[++offset] * 2 ** 8 +
      this[++offset] * 2 ** 16 +
      last * 2 ** 24;
  }

  Buffer.prototype.readUInt24LE = function readUInt24LE(buf, offset = 0) {
    validateNumber(offset, 'offset');
    const first = buf[offset];
    const last = buf[offset + 2];
    if (first === undefined || last === undefined)
      boundsError(offset, buf.length - 3);

    return first + buf[++offset] * 2 ** 8 + last * 2 ** 16;
  }

  Buffer.prototype.readUInt16LE = function readUInt16LE(offset = 0) {
    validateNumber(offset, 'offset');
    const first = this[offset];
    const last = this[offset + 1];
    if (first === undefined || last === undefined)
      boundsError(offset, this.length - 2);

    return first + last * 2 ** 8;
  }

  Buffer.prototype.readUInt8 = function readUInt8(offset = 0) {
    validateNumber(offset, 'offset');
    const val = this[offset];
    if (val === undefined)
      boundsError(offset, this.length - 1);

    return val;
  }

  Buffer.prototype.readUIntBE = function readUIntBE(offset, byteLength) {
    if (offset === undefined)
      throw new ERR_INVALID_ARG_TYPE('offset', 'number', offset);
    if (byteLength === 6)
      return readUInt48BE(this, offset);
    if (byteLength === 5)
      return readUInt40BE(this, offset);
    if (byteLength === 3)
      return readUInt24BE(this, offset);
    if (byteLength === 4)
      return this.readUInt32BE(offset);
    if (byteLength === 2)
      return this.readUInt16BE(offset);
    if (byteLength === 1)
      return this.readUInt8(offset);

    boundsError(byteLength, 6, 'byteLength');
  }

  Buffer.prototype.readUInt48BE = function readUInt48BE(buf, offset = 0) {
    validateNumber(offset, 'offset');
    const first = buf[offset];
    const last = buf[offset + 5];
    if (first === undefined || last === undefined)
      boundsError(offset, buf.length - 6);

    return (first * 2 ** 8 + buf[++offset]) * 2 ** 32 +
      buf[++offset] * 2 ** 24 +
      buf[++offset] * 2 ** 16 +
      buf[++offset] * 2 ** 8 +
      last;
  }

  Buffer.prototype.readUInt40BE = function readUInt40BE(buf, offset = 0) {
    validateNumber(offset, 'offset');
    const first = buf[offset];
    const last = buf[offset + 4];
    if (first === undefined || last === undefined)
      boundsError(offset, buf.length - 5);

    return first * 2 ** 32 +
      buf[++offset] * 2 ** 24 +
      buf[++offset] * 2 ** 16 +
      buf[++offset] * 2 ** 8 +
      last;
  }

  Buffer.prototype.readUInt32BE = function readUInt32BE(offset = 0) {
    validateNumber(offset, 'offset');
    const first = this[offset];
    const last = this[offset + 3];
    if (first === undefined || last === undefined)
      boundsError(offset, this.length - 4);

    return first * 2 ** 24 +
      this[++offset] * 2 ** 16 +
      this[++offset] * 2 ** 8 +
      last;
  }

  Buffer.prototype.readUInt24BE = function readUInt24BE(buf, offset = 0) {
    validateNumber(offset, 'offset');
    const first = buf[offset];
    const last = buf[offset + 2];
    if (first === undefined || last === undefined)
      boundsError(offset, buf.length - 3);

    return first * 2 ** 16 + buf[++offset] * 2 ** 8 + last;
  }

  Buffer.prototype.readUInt16BE = function readUInt16BE(offset = 0) {
    validateNumber(offset, 'offset');
    const first = this[offset];
    const last = this[offset + 1];
    if (first === undefined || last === undefined)
      boundsError(offset, this.length - 2);

    return first * 2 ** 8 + last;
  }

  Buffer.prototype.readIntLE = function readIntLE(offset, byteLength) {
    if (offset === undefined)
      throw new ERR_INVALID_ARG_TYPE('offset', 'number', offset);
    if (byteLength === 6)
      return readInt48LE(this, offset);
    if (byteLength === 5)
      return readInt40LE(this, offset);
    if (byteLength === 3)
      return readInt24LE(this, offset);
    if (byteLength === 4)
      return this.readInt32LE(offset);
    if (byteLength === 2)
      return this.readInt16LE(offset);
    if (byteLength === 1)
      return this.readInt8(offset);

    boundsError(byteLength, 6, 'byteLength');
  }

  Buffer.prototype.readInt48LE = function readInt48LE(buf, offset = 0) {
    validateNumber(offset, 'offset');
    const first = buf[offset];
    const last = buf[offset + 5];
    if (first === undefined || last === undefined)
      boundsError(offset, buf.length - 6);

    const val = buf[offset + 4] + last * 2 ** 8;
    return (val | (val & 2 ** 15) * 0x1fffe) * 2 ** 32 +
      first +
      buf[++offset] * 2 ** 8 +
      buf[++offset] * 2 ** 16 +
      buf[++offset] * 2 ** 24;
  }

  Buffer.prototype.readInt40LE = function readInt40LE(buf, offset = 0) {
    validateNumber(offset, 'offset');
    const first = buf[offset];
    const last = buf[offset + 4];
    if (first === undefined || last === undefined)
      boundsError(offset, buf.length - 5);

    return (last | (last & 2 ** 7) * 0x1fffffe) * 2 ** 32 +
      first +
      buf[++offset] * 2 ** 8 +
      buf[++offset] * 2 ** 16 +
      buf[++offset] * 2 ** 24;
  }

  Buffer.prototype.readInt32LE = function readInt32LE(offset = 0) {
    validateNumber(offset, 'offset');
    const first = this[offset];
    const last = this[offset + 3];
    if (first === undefined || last === undefined)
      boundsError(offset, this.length - 4);

    return first +
      this[++offset] * 2 ** 8 +
      this[++offset] * 2 ** 16 +
      (last << 24); // Overflow
  }

  Buffer.prototype.readInt24LE = function readInt24LE(buf, offset = 0) {
    validateNumber(offset, 'offset');
    const first = buf[offset];
    const last = buf[offset + 2];
    if (first === undefined || last === undefined)
      boundsError(offset, buf.length - 3);

    const val = first + buf[++offset] * 2 ** 8 + last * 2 ** 16;
    return val | (val & 2 ** 23) * 0x1fe;
  }

  Buffer.prototype.readInt16LE = function readInt16LE(offset = 0) {
    validateNumber(offset, 'offset');
    const first = this[offset];
    const last = this[offset + 1];
    if (first === undefined || last === undefined)
      boundsError(offset, this.length - 2);

    const val = first + last * 2 ** 8;
    return val | (val & 2 ** 15) * 0x1fffe;
  }

  Buffer.prototype.readInt8 = function readInt8(offset = 0) {
    validateNumber(offset, 'offset');
    const val = this[offset];
    if (val === undefined)
      boundsError(offset, this.length - 1);

    return val | (val & 2 ** 7) * 0x1fffffe;
  }

  Buffer.prototype.readIntBE = function readIntBE(offset, byteLength) {
    if (offset === undefined)
      throw new ERR_INVALID_ARG_TYPE('offset', 'number', offset);
    if (byteLength === 6)
      return readInt48BE(this, offset);
    if (byteLength === 5)
      return readInt40BE(this, offset);
    if (byteLength === 3)
      return readInt24BE(this, offset);
    if (byteLength === 4)
      return this.readInt32BE(offset);
    if (byteLength === 2)
      return this.readInt16BE(offset);
    if (byteLength === 1)
      return this.readInt8(offset);

    boundsError(byteLength, 6, 'byteLength');
  }

  Buffer.prototype.readInt48BE = function readInt48BE(buf, offset = 0) {
    validateNumber(offset, 'offset');
    const first = buf[offset];
    const last = buf[offset + 5];
    if (first === undefined || last === undefined)
      boundsError(offset, buf.length - 6);

    const val = buf[++offset] + first * 2 ** 8;
    return (val | (val & 2 ** 15) * 0x1fffe) * 2 ** 32 +
      buf[++offset] * 2 ** 24 +
      buf[++offset] * 2 ** 16 +
      buf[++offset] * 2 ** 8 +
      last;
  }

  Buffer.prototype.readInt40BE = function readInt40BE(buf, offset = 0) {
    validateNumber(offset, 'offset');
    const first = buf[offset];
    const last = buf[offset + 4];
    if (first === undefined || last === undefined)
      boundsError(offset, buf.length - 5);

    return (first | (first & 2 ** 7) * 0x1fffffe) * 2 ** 32 +
      buf[++offset] * 2 ** 24 +
      buf[++offset] * 2 ** 16 +
      buf[++offset] * 2 ** 8 +
      last;
  }

  Buffer.prototype.readInt32BE = function readInt32BE(offset = 0) {
    validateNumber(offset, 'offset');
    const first = this[offset];
    const last = this[offset + 3];
    if (first === undefined || last === undefined)
      boundsError(offset, this.length - 4);

    return (first << 24) + // Overflow
      this[++offset] * 2 ** 16 +
      this[++offset] * 2 ** 8 +
      last;
  }

  Buffer.prototype.readInt24BE = function readInt24BE(buf, offset = 0) {
    validateNumber(offset, 'offset');
    const first = buf[offset];
    const last = buf[offset + 2];
    if (first === undefined || last === undefined)
      boundsError(offset, buf.length - 3);

    const val = first * 2 ** 16 + buf[++offset] * 2 ** 8 + last;
    return val | (val & 2 ** 23) * 0x1fe;
  }

  Buffer.prototype.readInt16BE = function readInt16BE(offset = 0) {
    validateNumber(offset, 'offset');
    const first = this[offset];
    const last = this[offset + 1];
    if (first === undefined || last === undefined)
      boundsError(offset, this.length - 2);

    const val = first * 2 ** 8 + last;
    return val | (val & 2 ** 15) * 0x1fffe;
  }

  // Read floats
  function readFloatBackwards(offset = 0) {
    validateNumber(offset, 'offset');
    const first = this[offset];
    const last = this[offset + 3];
    if (first === undefined || last === undefined)
      boundsError(offset, this.length - 4);

    uInt8Float32Array[3] = first;
    uInt8Float32Array[2] = this[++offset];
    uInt8Float32Array[1] = this[++offset];
    uInt8Float32Array[0] = last;
    return float32Array[0];
  }

  function readFloatForwards(offset = 0) {
    validateNumber(offset, 'offset');
    const first = this[offset];
    const last = this[offset + 3];
    if (first === undefined || last === undefined)
      boundsError(offset, this.length - 4);

    uInt8Float32Array[0] = first;
    uInt8Float32Array[1] = this[++offset];
    uInt8Float32Array[2] = this[++offset];
    uInt8Float32Array[3] = last;
    return float32Array[0];
  }
  Buffer.prototype.readFloatLE = bigEndian ? readFloatBackwards : readFloatForwards;
  Buffer.prototype.readFloatBE = bigEndian ? readFloatForwards : readFloatBackwards;

  function readDoubleBackwards(offset = 0) {
    validateNumber(offset, 'offset');
    const first = this[offset];
    const last = this[offset + 7];
    if (first === undefined || last === undefined)
      boundsError(offset, this.length - 8);

    uInt8Float64Array[7] = first;
    uInt8Float64Array[6] = this[++offset];
    uInt8Float64Array[5] = this[++offset];
    uInt8Float64Array[4] = this[++offset];
    uInt8Float64Array[3] = this[++offset];
    uInt8Float64Array[2] = this[++offset];
    uInt8Float64Array[1] = this[++offset];
    uInt8Float64Array[0] = last;
    return float64Array[0];
  }

  function readDoubleForwards(offset = 0) {
    validateNumber(offset, 'offset');
    const first = this[offset];
    const last = this[offset + 7];
    if (first === undefined || last === undefined)
      boundsError(offset, this.length - 8);

    uInt8Float64Array[0] = first;
    uInt8Float64Array[1] = this[++offset];
    uInt8Float64Array[2] = this[++offset];
    uInt8Float64Array[3] = this[++offset];
    uInt8Float64Array[4] = this[++offset];
    uInt8Float64Array[5] = this[++offset];
    uInt8Float64Array[6] = this[++offset];
    uInt8Float64Array[7] = last;
    return float64Array[0];
  }
  Buffer.prototype.readDoubleLE = bigEndian ? readDoubleBackwards : readDoubleForwards;
  Buffer.prototype.readDoubleBE = bigEndian ? readDoubleForwards : readDoubleBackwards;

  // Write integers.
  function writeBigU_Int64LE(buf, value, offset, min, max) {
    checkInt(value, min, max, buf, offset, 7);

    let lo = Number(value & 0xffffffffn);
    buf[offset++] = lo;
    lo = lo >> 8;
    buf[offset++] = lo;
    lo = lo >> 8;
    buf[offset++] = lo;
    lo = lo >> 8;
    buf[offset++] = lo;
    let hi = Number(value >> 32n & 0xffffffffn);
    buf[offset++] = hi;
    hi = hi >> 8;
    buf[offset++] = hi;
    hi = hi >> 8;
    buf[offset++] = hi;
    hi = hi >> 8;
    buf[offset++] = hi;
    return offset;
  }

  Buffer.prototype.writeBigUInt64LE = function writeBigUInt64LE(value, offset = 0) {
    return writeBigU_Int64LE(this, value, offset, 0n, 0xffffffffffffffffn);
  }

  function writeBigU_Int64BE(buf, value, offset, min, max) {
    checkInt(value, min, max, buf, offset, 7);

    let lo = Number(value & 0xffffffffn);
    buf[offset + 7] = lo;
    lo = lo >> 8;
    buf[offset + 6] = lo;
    lo = lo >> 8;
    buf[offset + 5] = lo;
    lo = lo >> 8;
    buf[offset + 4] = lo;
    let hi = Number(value >> 32n & 0xffffffffn);
    buf[offset + 3] = hi;
    hi = hi >> 8;
    buf[offset + 2] = hi;
    hi = hi >> 8;
    buf[offset + 1] = hi;
    hi = hi >> 8;
    buf[offset] = hi;
    return offset + 8;
  }

  Buffer.prototype.writeBigUInt64BE = function writeBigUInt64BE(value, offset = 0) {
    return writeBigU_Int64BE(this, value, offset, 0n, 0xffffffffffffffffn);
  }

  Buffer.prototype.writeBigInt64LE = function writeBigInt64LE(value, offset = 0) {
    return writeBigU_Int64LE(
      this, value, offset, -0x8000000000000000n, 0x7fffffffffffffffn);
  }

  Buffer.prototype.writeBigInt64BE = function writeBigInt64BE(value, offset = 0) {
    return writeBigU_Int64BE(
      this, value, offset, -0x8000000000000000n, 0x7fffffffffffffffn);
  }

  Buffer.prototype.writeUIntLE = function writeUIntLE(value, offset, byteLength) {
    if (byteLength === 6)
      return writeU_Int48LE(this, value, offset, 0, 0xffffffffffff);
    if (byteLength === 5)
      return writeU_Int40LE(this, value, offset, 0, 0xffffffffff);
    if (byteLength === 3)
      return writeU_Int24LE(this, value, offset, 0, 0xffffff);
    if (byteLength === 4)
      return writeU_Int32LE(this, value, offset, 0, 0xffffffff);
    if (byteLength === 2)
      return writeU_Int16LE(this, value, offset, 0, 0xffff);
    if (byteLength === 1)
      return writeU_Int8(this, value, offset, 0, 0xff);

    boundsError(byteLength, 6, 'byteLength');
  }

  function writeU_Int48LE(buf, value, offset, min, max) {
    value = +value;
    checkInt(value, min, max, buf, offset, 5);

    const newVal = Math.floor(value * 2 ** -32);
    buf[offset++] = value;
    value = value >>> 8;
    buf[offset++] = value;
    value = value >>> 8;
    buf[offset++] = value;
    value = value >>> 8;
    buf[offset++] = value;
    buf[offset++] = newVal;
    buf[offset++] = (newVal >>> 8);
    return offset;
  }

  function writeU_Int40LE(buf, value, offset, min, max) {
    value = +value;
    checkInt(value, min, max, buf, offset, 4);

    const newVal = value;
    buf[offset++] = value;
    value = value >>> 8;
    buf[offset++] = value;
    value = value >>> 8;
    buf[offset++] = value;
    value = value >>> 8;
    buf[offset++] = value;
    buf[offset++] = Math.floor(newVal * 2 ** -32);
    return offset;
  }

  function writeU_Int32LE(buf, value, offset, min, max) {
    value = +value;
    checkInt(value, min, max, buf, offset, 3);

    buf[offset++] = value;
    value = value >>> 8;
    buf[offset++] = value;
    value = value >>> 8;
    buf[offset++] = value;
    value = value >>> 8;
    buf[offset++] = value;
    return offset;
  }

  Buffer.prototype.writeUInt32LE = function writeUInt32LE(value, offset = 0) {
    return writeU_Int32LE(this, value, offset, 0, 0xffffffff);
  }

  function writeU_Int24LE(buf, value, offset, min, max) {
    value = +value;
    checkInt(value, min, max, buf, offset, 2);

    buf[offset++] = value;
    value = value >>> 8;
    buf[offset++] = value;
    value = value >>> 8;
    buf[offset++] = value;
    return offset;
  }

  function writeU_Int16LE(buf, value, offset, min, max) {
    value = +value;
    checkInt(value, min, max, buf, offset, 1);

    buf[offset++] = value;
    buf[offset++] = (value >>> 8);
    return offset;
  }

  Buffer.prototype.writeUInt16LE = function writeUInt16LE(value, offset = 0) {
    return writeU_Int16LE(this, value, offset, 0, 0xffff);
  }

  function writeU_Int8(buf, value, offset, min, max) {
    value = +value;
    // `checkInt()` can not be used here because it checks two entries.
    validateNumber(offset, 'offset');
    if (value > max || value < min) {
      throw new ERR_OUT_OF_RANGE('value', `>= ${min} and <= ${max}`, value);
    }
    if (buf[offset] === undefined)
      boundsError(offset, buf.length - 1);

    buf[offset] = value;
    return offset + 1;
  }

  Buffer.prototype.writeUInt8 = function writeUInt8(value, offset = 0) {
    return writeU_Int8(this, value, offset, 0, 0xff);
  }

  Buffer.prototype.writeUIntBE = function writeUIntBE(value, offset, byteLength) {
    if (byteLength === 6)
      return writeU_Int48BE(this, value, offset, 0, 0xffffffffffff);
    if (byteLength === 5)
      return writeU_Int40BE(this, value, offset, 0, 0xffffffffff);
    if (byteLength === 3)
      return writeU_Int24BE(this, value, offset, 0, 0xffffff);
    if (byteLength === 4)
      return writeU_Int32BE(this, value, offset, 0, 0xffffffff);
    if (byteLength === 2)
      return writeU_Int16BE(this, value, offset, 0, 0xffff);
    if (byteLength === 1)
      return writeU_Int8(this, value, offset, 0, 0xff);

    boundsError(byteLength, 6, 'byteLength');
  }

  function writeU_Int48BE(buf, value, offset, min, max) {
    value = +value;
    checkInt(value, min, max, buf, offset, 5);

    const newVal = Math.floor(value * 2 ** -32);
    buf[offset++] = (newVal >>> 8);
    buf[offset++] = newVal;
    buf[offset + 3] = value;
    value = value >>> 8;
    buf[offset + 2] = value;
    value = value >>> 8;
    buf[offset + 1] = value;
    value = value >>> 8;
    buf[offset] = value;
    return offset + 4;
  }

  function writeU_Int40BE(buf, value, offset, min, max) {
    value = +value;
    checkInt(value, min, max, buf, offset, 4);

    buf[offset++] = Math.floor(value * 2 ** -32);
    buf[offset + 3] = value;
    value = value >>> 8;
    buf[offset + 2] = value;
    value = value >>> 8;
    buf[offset + 1] = value;
    value = value >>> 8;
    buf[offset] = value;
    return offset + 4;
  }

  function writeU_Int32BE(buf, value, offset, min, max) {
    value = +value;
    checkInt(value, min, max, buf, offset, 3);

    buf[offset + 3] = value;
    value = value >>> 8;
    buf[offset + 2] = value;
    value = value >>> 8;
    buf[offset + 1] = value;
    value = value >>> 8;
    buf[offset] = value;
    return offset + 4;
  }

  Buffer.prototype.writeUInt32BE = function writeUInt32BE(value, offset = 0) {
    return writeU_Int32BE(this, value, offset, 0, 0xffffffff);
  }

  function writeU_Int24BE(buf, value, offset, min, max) {
    value = +value;
    checkInt(value, min, max, buf, offset, 2);

    buf[offset + 2] = value;
    value = value >>> 8;
    buf[offset + 1] = value;
    value = value >>> 8;
    buf[offset] = value;
    return offset + 3;
  }

  function writeU_Int16BE(buf, value, offset, min, max) {
    value = +value;
    checkInt(value, min, max, buf, offset, 1);

    buf[offset++] = (value >>> 8);
    buf[offset++] = value;
    return offset;
  }

  Buffer.prototype.writeUInt16BE = function writeUInt16BE(value, offset = 0) {
    return writeU_Int16BE(this, value, offset, 0, 0xffff);
  }

  Buffer.prototype.writeIntLE = function writeIntLE(value, offset, byteLength) {
    if (byteLength === 6)
      return writeU_Int48LE(this, value, offset, -0x800000000000, 0x7fffffffffff);
    if (byteLength === 5)
      return writeU_Int40LE(this, value, offset, -0x8000000000, 0x7fffffffff);
    if (byteLength === 3)
      return writeU_Int24LE(this, value, offset, -0x800000, 0x7fffff);
    if (byteLength === 4)
      return writeU_Int32LE(this, value, offset, -0x80000000, 0x7fffffff);
    if (byteLength === 2)
      return writeU_Int16LE(this, value, offset, -0x8000, 0x7fff);
    if (byteLength === 1)
      return writeU_Int8(this, value, offset, -0x80, 0x7f);

    boundsError(byteLength, 6, 'byteLength');
  }

  Buffer.prototype.writeInt32LE = function writeInt32LE(value, offset = 0) {
    return writeU_Int32LE(this, value, offset, -0x80000000, 0x7fffffff);
  }

  Buffer.prototype.writeInt16LE = function writeInt16LE(value, offset = 0) {
    return writeU_Int16LE(this, value, offset, -0x8000, 0x7fff);
  }

  Buffer.prototype.writeInt8 = function writeInt8(value, offset = 0) {
    return writeU_Int8(this, value, offset, -0x80, 0x7f);
  }

  Buffer.prototype.writeIntBE = function writeIntBE(value, offset, byteLength) {
    if (byteLength === 6)
      return writeU_Int48BE(this, value, offset, -0x800000000000, 0x7fffffffffff);
    if (byteLength === 5)
      return writeU_Int40BE(this, value, offset, -0x8000000000, 0x7fffffffff);
    if (byteLength === 3)
      return writeU_Int24BE(this, value, offset, -0x800000, 0x7fffff);
    if (byteLength === 4)
      return writeU_Int32BE(this, value, offset, -0x80000000, 0x7fffffff);
    if (byteLength === 2)
      return writeU_Int16BE(this, value, offset, -0x8000, 0x7fff);
    if (byteLength === 1)
      return writeU_Int8(this, value, offset, -0x80, 0x7f);

    boundsError(byteLength, 6, 'byteLength');
  }

  Buffer.prototype.writeInt32BE = function writeInt32BE(value, offset = 0) {
    return writeU_Int32BE(this, value, offset, -0x80000000, 0x7fffffff);
  }

  Buffer.prototype.writeInt16BE = function writeInt16BE(value, offset = 0) {
    return writeU_Int16BE(this, value, offset, -0x8000, 0x7fff);
  }

  // Write floats.
  function writeFloatForwards(val, offset = 0) {
    val = +val;
    checkBounds(this, offset, 3);

    float32Array[0] = val;
    this[offset++] = uInt8Float32Array[0];
    this[offset++] = uInt8Float32Array[1];
    this[offset++] = uInt8Float32Array[2];
    this[offset++] = uInt8Float32Array[3];
    return offset;
  }

  function writeFloatBackwards(val, offset = 0) {
    val = +val;
    checkBounds(this, offset, 3);

    float32Array[0] = val;
    this[offset++] = uInt8Float32Array[3];
    this[offset++] = uInt8Float32Array[2];
    this[offset++] = uInt8Float32Array[1];
    this[offset++] = uInt8Float32Array[0];
    return offset;
  }
  Buffer.prototype.writeFloatLE = bigEndian ? writeFloatBackwards : writeFloatForwards;
  Buffer.prototype.writeFloatBE = bigEndian ? writeFloatForwards : writeFloatBackwards;

  function writeDoubleForwards(val, offset = 0) {
    val = +val;
    checkBounds(this, offset, 7);

    float64Array[0] = val;
    this[offset++] = uInt8Float64Array[0];
    this[offset++] = uInt8Float64Array[1];
    this[offset++] = uInt8Float64Array[2];
    this[offset++] = uInt8Float64Array[3];
    this[offset++] = uInt8Float64Array[4];
    this[offset++] = uInt8Float64Array[5];
    this[offset++] = uInt8Float64Array[6];
    this[offset++] = uInt8Float64Array[7];
    return offset;
  }

  function writeDoubleBackwards(val, offset = 0) {
    val = +val;
    checkBounds(this, offset, 7);

    float64Array[0] = val;
    this[offset++] = uInt8Float64Array[7];
    this[offset++] = uInt8Float64Array[6];
    this[offset++] = uInt8Float64Array[5];
    this[offset++] = uInt8Float64Array[4];
    this[offset++] = uInt8Float64Array[3];
    this[offset++] = uInt8Float64Array[2];
    this[offset++] = uInt8Float64Array[1];
    this[offset++] = uInt8Float64Array[0];
    return offset;
  }

  Buffer.prototype.writeDoubleLE = bigEndian ? writeDoubleBackwards : writeDoubleForwards;
  Buffer.prototype.writeDoubleBE = bigEndian ? writeDoubleForwards : writeDoubleBackwards;

  window.Buffer = Buffer;
})();