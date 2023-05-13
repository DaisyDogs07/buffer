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
  const kTypes = [
    'string',
    'function',
    'number',
    'object',
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
    if (value == null)
      return '' + value;
    if (typeof value === 'function' && value.name)
      return `function ${value.name}`;
    if (typeof value === 'object') {
      if (value.constructor?.name)
        return `an instance of ${value.constructor.name}`;
      return inspect(value);
    }
    let inspected = inspect(value);
    if (inspected.length > 28)
      inspected = `${inspected.slice(0, 25)}...`;
    return `type ${typeof value} (${inspected})`;
  }

  function formatList(array, type = 'and') {
    return array.length < 3
      ? array.join(` ${type} `)
      : `${array.slice(0, -1).join(', ')}, ${type} ${array[array.length - 1]}`;
  }

  function ERR_INVALID_ARG_TYPE(name, expected, actual) {
    if (!Array.isArray(expected))
      expected = [expected];

    let msg = 'The ';
    if (name.endsWith(' argument'))
      msg += `${name} `;
    else {
      const type = name.includes('.') ? 'property' : 'argument';
      msg += `"${name}" ${type} `;
    }
    msg += 'must be ';

    const types = [];
    const instances = [];
    const other = [];

    for (const value of expected) {
      if (kTypes.includes(value))
        types.push(value.toLowerCase());
      else if (classRegExp.exec(value) !== null)
        instances.push(value);
      else other.push(value);
    }

    if (instances.length > 0) {
      const pos = types.indexOf('object');
      if (pos !== -1) {
        types.splice(pos, 1);
        instances.push('Object');
      }
    }

    if (types.length > 0) {
      msg += `${types.length > 1 ? 'one of type' : 'of type'} ${formatList(types, 'or')}`;
      if (instances.length > 0 || other.length > 0)
        msg += ' or ';
    }

    if (instances.length > 0) {
      msg += `an instance of ${formatList(instances, 'or')}`;
      if (other.length > 0)
        msg += ' or ';
    }

    if (other.length > 0) {
      if (other.length > 1)
        msg += `one of ${formatList(other, 'or')}`;
      else {
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
    if (inspected.length > 128)
      inspected = `${inspected.slice(0, 128)}...`;
    const type = name.includes('.') ? 'property' : 'argument';
    return new TypeError(`The ${type} '${name}' ${reason}. Received ${inspected}`);
  }

  function ERR_INVALID_BUFFER_SIZE(s) {
    return new RangeError('Buffer size must be a multiple of ' + s);
  }

  function addNumericalSeparator(val) {
    let res = '';
    let i = val.length;
    const start = val[0] === '-' ? 1 : 0;
    for (; i >= start + 4; i -= 3)
      res = `_${val.slice(i - 3, i)}${res}`;
    return `${val.slice(0, i)}${res}`;
  }

  function ERR_OUT_OF_RANGE(str, range, input, replaceDefaultBoolean = false) {
    let msg = replaceDefaultBoolean
      ? str
      : `The value of "${str}" is out of range.`;
    let received;
    if (Number.isInteger(input) && Math.abs(input) > 2 ** 32)
      received = addNumericalSeparator(String(input));
    else if (typeof input === 'bigint') {
      received = String(input);
      if (input > 2n ** 32n || input < -(2n ** 32n))
        received = addNumericalSeparator(received);
      received += 'n';
    } else received = inspect(input);
    msg += ` It must be ${range}. Received ${received}`;
    return new RangeError(msg);
  }

  function ERR_UNKNOWN_ENCODING(e) {
    return new TypeError('Unknown encoding: ' + e);
  }

  function validateArray(value, name, minLength = 0) {
    if (!Array.isArray(value))
      throw new ERR_INVALID_ARG_TYPE(name, 'Array', value);
    if (value.length < minLength) {
      const reason = `must be longer than ${minLength}`;
      throw new ERR_INVALID_ARG_VALUE(name, value, reason);
    }
  }

  function validateBuffer(buffer, name = 'buffer') {
    if (!ArrayBuffer.isView(buffer))
      throw new ERR_INVALID_ARG_TYPE(name,
                                     ['Buffer', 'TypedArray', 'DataView'],
                                     buffer);
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
        ((min != null || max != null) && Number.isNaN(value)))
      throw new ERR_OUT_OF_RANGE(
        name,
        `${min != null ? `>= ${min}` : ''}${min != null && max != null ? ' && ' : ''}${max != null ? `<= ${max}` : ''}`,
        value);
  }

  function validateString(value, name) {
    if (typeof value !== 'string')
      throw new ERR_INVALID_ARG_TYPE(name, 'string', value);
  }

  const validateOffset = (value, name, min = 0, max = Number.MAX_SAFE_INTEGER) =>
    validateInteger(value, name, min, max);

  class FastBuffer extends Uint8Array {
    constructor(bufferOrLength, byteOffset, length) {
      super(bufferOrLength, byteOffset, length);
    }
  }

  function byteLengthUtf8(string) {
    let len = 0;
    let prev = null;
    for (let i = 0; i !== string.length; ++i) {
      const c = string.charCodeAt(i);
      if (c <= 0x7F)
        len += 1;
      else if (c <= 0x7FF)
        len += 2;
      else if (c <= 0xFFFF) {
        if (prev !== null && ((prev & 0xfc00) == 0xd800 && (c & 0xfc00) == 0xdc00))
          len += 1;
        else len += 3;
      } else len += 4;
      prev = c;
    }
    return len;
  };

  function normalizeCompareVal(val, aLen, bLen) {
    if (val === 0) {
      if (aLen > bLen)
        return 1;
      else if (aLen < bLen)
        return -1;
    } else {
      if (val > 0)
        return 1;
      else return -1;
    }
    return val;
  }

  function _compare(source, target) {
    const sourceLen = source.length;
    const targetLen = target.length;
    const len = Math.min(sourceLen, targetLen);
    if (len)
      for (let i = 0; i !== len; ++i) {
        const a = source[i];
        const b = target[i];
        if (a !== b) {
          if (a > b)
            return 1;
          return -1;
        }
      }
    return normalizeCompareVal(0, sourceLen, targetLen);
  }

  function compareOffset(source, target, targetStart = 0, sourceStart = 0, targetEnd = buf1.length, sourceEnd = buf2.length) {
    const sourceLen = sourceEnd - sourceStart;
    const targetLen = targetEnd - targetStart;
    const len = Math.min(sourceLen, targetLen, source.length - sourceStart);
    if (len)
      for (let i = 0; i !== len; ++i) {
        const a = source[i + sourceStart];
        const b = target[i + targetStart];
        if (a !== b) {
          if (a > b)
            return 1;
          return -1;
        }
      }
    return normalizeCompareVal(0, sourceLen, targetLen);
  }

  function indexOfBuffer(buffer, val, byteOffset, encoding, dir) {
    let indexSize = 1;
    let bufLen = buffer.length;
    let valLen = val.length;
    if (encoding !== undefined) {
      encoding = normalizeEncoding(encoding);
      if (encoding === 'utf16le') {
        if (buffer.length < 2 || val.length < 2)
          return -1;
        indexSize = 2;
        bufLen /= 2;
        valLen /= 2;
        byteOffset /= 2;
      }
    }

    function read(buf, i) {
      return indexSize === 1 ? buf[i] : buf.readUInt16BE(i * indexSize);
    }

    let i;
    if (dir) {
      let foundIndex = -1;
      for (i = byteOffset; i !== bufLen - valLen; ++i) {
        if (read(buffer, i) === read(val, 0)) {
          foundIndex = i;
          break;
        }
      }
      if (foundIndex >= 0) {
        for (let j = 1; j !== valLen; ++j) {
          if (read(buffer, i + j) !== read(val, j)) {
            foundIndex = -1;
            break;
          }
        }
        if (foundIndex >= 0)
          return foundIndex * indexSize;
      }
    } else {
      if (byteOffset + valLen > bufLen)
        byteOffset = bufLen - valLen;
      for (i = byteOffset; i !== 0; --i) {
        let found = true;
        for (let j = 0; j !== valLen; ++j) {
          if (read(buffer, i + j) !== read(val, j)) {
            found = false;
            break;
          }
        }
        if (found)
          return i * indexSize;
      }
    }
    return -1;
  }

  function normalizeEncoding(enc) {
    if (enc == null || enc === 'utf8' || enc === 'utf-8')
      return 'utf8';
    return slowCases(enc);
  }
  
  function slowCases(enc) {
    enc = `${enc}`.toLowerCase();
    switch (enc) {
      case '':
      case 'utf8':
      case 'utf-8':
        return 'utf8';
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return 'utf16le';
      case 'latin1':
      case 'binary':
        return 'latin1';
      case 'ascii':
      case 'base64':
      case 'base64url':
      case 'hex':
        return enc;
    }
  }

  function isAnyArrayBuffer(obj) {
    return obj instanceof ArrayBuffer;
  }

  function isUint8Array(obj) {
    return obj instanceof Uint8Array;
  }

  function isTypedArray(obj) {
    return obj instanceof Reflect.getPrototypeOf(Uint8Array);
  }

  FastBuffer.prototype.constructor = Buffer;
  Buffer.prototype = FastBuffer.prototype;

  const float32Array = new Float32Array(1);
  const uInt8Float32Array = new Uint8Array(float32Array.buffer);
  const float64Array = new Float64Array(1);
  const uInt8Float64Array = new Uint8Array(float64Array.buffer);

  float32Array[0] = -1;
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
        if (min === 0 || min === 0n)
          range = `>= 0${n} and < 2${n} ** ${(byteLength + 1) * 8}${n}`;
        else range = `>= -(2${n} ** ${(byteLength + 1) * 8 - 1}${n}) and < 2${n} ** ${(byteLength + 1) * 8 - 1}${n}`;
      } else range = `>= ${min}${n} and <= ${max}${n}`;
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
      (last << 24);
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

    const val = (first << 24) +
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

  function readUInt48LE(buf, offset = 0) {
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

  function readUInt40LE(buf, offset = 0) {
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

  function readUInt24LE(buf, offset = 0) {
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

  function readUInt48BE(buf, offset = 0) {
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

  function readUInt40BE(buf, offset = 0) {
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

  function readUInt24BE(buf, offset = 0) {
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

  function readInt48LE(buf, offset = 0) {
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

  function readInt40LE(buf, offset = 0) {
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
      (last << 24);
  }

  function readInt24LE(buf, offset = 0) {
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

  function readInt48BE(buf, offset = 0) {
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

  function readInt40BE(buf, offset = 0) {
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

    return (first << 24) +
      this[++offset] * 2 ** 16 +
      this[++offset] * 2 ** 8 +
      last;
  }

  function readInt24BE(buf, offset = 0) {
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

  Buffer.prototype.readFloatLE = bigEndian ? readFloatBackwards : readFloatForwards;
  Buffer.prototype.readFloatBE = bigEndian ? readFloatForwards : readFloatBackwards;
  Buffer.prototype.readDoubleLE = bigEndian ? readDoubleBackwards : readDoubleForwards;
  Buffer.prototype.readDoubleBE = bigEndian ? readDoubleForwards : readDoubleBackwards;

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
    validateNumber(offset, 'offset');
    if (value > max || value < min)
      throw new ERR_OUT_OF_RANGE('value', `>= ${min} and <= ${max}`, value);
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

  Buffer.prototype.writeDoubleLE = bigEndian ? writeDoubleBackwards : writeDoubleForwards;
  Buffer.prototype.writeDoubleBE = bigEndian ? writeDoubleForwards : writeDoubleBackwards;
  Buffer.prototype.writeFloatLE = bigEndian ? writeFloatBackwards : writeFloatForwards;
  Buffer.prototype.writeFloatBE = bigEndian ? writeFloatForwards : writeFloatBackwards;

  Buffer.prototype.asciiSlice = function asciiSlice(start = 0, end = this.length) {
    if (start < 0 || start > this.length || end > this.length)
      throw new RangeError('Index out of range');
    if (end < start)
      end = start;
    let res = '';
    for (let i = start; i !== end; ++i)
      res += String.fromCharCode(this[i] & 0x7f);
    return res;
  }

  Buffer.prototype.asciiWrite = function asciiWrite(string, offset = 0, length = string.length) {
    if (typeof string !== 'string')
      throw new TypeError('argument must be a string');
    if (offset < 0 || length < 0)
      throw new RangeError('Index out of range');
    if (offset > this.length)
      throw new RangeError('"offset" is outside of buffer bounds');
    length = Math.min(this.length - offset, string.length, length);
    for (let i = 0; i !== length; ++i)
      this[offset++] = string.charCodeAt(i) & 0xFF;
    return length;
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

  Buffer.prototype.utf8Write = function utf8Write(string, offset = 0, length = byteLengthUtf8(string)) {
    if (typeof string !== 'string')
      throw new TypeError('argument must be a string');
    if (offset < 0)
      throw new RangeError('Index out of range');
    if (offset > this.length)
      throw new RangeError('"offset" is outside of buffer bounds');
    if (length < 0)
      throw new RangeError('Index out of range');
    length = Math.min(this.length - offset, byteLengthUtf8(string), length);
    let written = 0;
    let lead = null;
    for (let i = 0; i !== string.length; ++i) {
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

  Buffer.prototype.ucs2Write = function ucs2Write(string, offset = 0, length = string.length * 2) {
    if (typeof string !== 'string')
      throw new TypeError('argument must be a string');
    if (offset < 0)
      throw new RangeError('Index out of range');
    if (offset > this.length)
      throw new RangeError('"offset" is outside of buffer bounds');
    if (length < 0)
      throw new RangeError('Index out of range');
    length = Math.min(this.length - offset, string.length * 2, length);
    let written = 0;
    for (let i = 0; i !== string.length; ++i) {
      if ((length -= 2) < 0)
        break;
      const c = string.charCodeAt(i);
      this[offset++] = c & 0xFF;
      this[offset++] = c >> 8;
      written += 2;
    }
    return written;
  }

  Buffer.prototype.latin1Slice = function latin1Slice(start = 0, end = this.length) {
    if (start < 0 || start > this.length || end > this.length)
      throw new RangeError('Index out of range');
    if (end < start)
      end = start;
    let ret = '';
    for (let i = start; i !== end; ++i)
      ret += String.fromCharCode(this[i]);
    return ret;
  }

  Buffer.prototype.latin1Write = function latin1Write(string, offset = 0, length = string.length) {
    if (typeof string !== 'string')
      throw new TypeError('argument must be a string');
    if (offset < 0 || length < 0)
      throw new RangeError('Index out of range');
    if (offset > this.length)
      throw new RangeError('"offset" is outside of buffer bounds');
    length = Math.min(this.length - offset, string.length, length);
    for (let i = 0; i !== length; ++i)
      this[offset++] = string.charCodeAt(i) & 0xFF;
    return length;
  }

  const kBase64EncMap = [
    0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4A, 0x4B,
    0x4C, 0x4D, 0x4E, 0x4F, 0x50, 0x51, 0x52, 0x53, 0x54, 0x55, 0x56,
    0x57, 0x58, 0x59, 0x5A, 0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67,
    0x68, 0x69, 0x6A, 0x6B, 0x6C, 0x6D, 0x6E, 0x6F, 0x70, 0x71, 0x72,
    0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7A, 0x30, 0x31, 0x32,
    0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x2B, 0x2F
  ];
  const kBase64DecMap = [
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x3E, 0x00, 0x00, 0x00, 0x3F,
    0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x3B, 0x3C, 0x3D, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06,
    0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F, 0x10, 0x11, 0x12,
    0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x1A, 0x1B, 0x1C, 0x1D, 0x1E, 0x1F, 0x20, 0x21, 0x22, 0x23, 0x24,
    0x25, 0x26, 0x27, 0x28, 0x29, 0x2A, 0x2B, 0x2C, 0x2D, 0x2E, 0x2F, 0x30,
    0x31, 0x32, 0x33, 0x00, 0x00, 0x00, 0x00, 0x00
  ];

  function base64Encode(data) {
    const dataLen = data.length;
    const out = [];
    let sidx = 0;
    let didx = 0;

    if (dataLen > 1) {
      while (sidx < dataLen - 2) {
        out[didx++] = kBase64EncMap[(data.charCodeAt(sidx) >> 2) & 63];
        out[didx++] = kBase64EncMap[((data.charCodeAt(sidx + 1) >> 4) & 15) | ((data.charCodeAt(sidx) << 4) & 63)];
        out[didx++] = kBase64EncMap[((data.charCodeAt(sidx + 2) >> 6) & 3) | ((data.charCodeAt(sidx + 1) << 2) & 63)];
        out[didx++] = kBase64EncMap[data.charCodeAt(sidx + 2) & 63];
        sidx += 3;
      }
    }
  
    if (sidx < dataLen) {
      out[didx++] = kBase64EncMap[(data.charCodeAt(sidx) >> 2) & 63];
      if (sidx < dataLen - 1) {
        out[didx++] = kBase64EncMap[((data.charCodeAt(sidx + 1) >> 4) & 15) | ((data.charCodeAt(sidx) << 4) & 63)];
        out[didx++] = kBase64EncMap[(data.charCodeAt(sidx + 1) << 2) & 63];
      } else out[didx++] = kBase64EncMap[(data.charCodeAt(sidx) << 4) & 63];
    }

    while (out.length % 4 !== 0)
      out[didx++] = 0x3D;
    return out.map(c => String.fromCharCode(c)).join('');
  }

  function base64Decode(data) {
    const dataLen = data.length;
    if (!dataLen)
      return '';
    let out = [];
    let equalsSignCount = 0;
    let outLength = 0;
    let hadError = false;
    for (let idx = 0; idx < dataLen; ++idx) {
      const ch = data[idx];
      if (ch == '=') {
        ++equalsSignCount;
        if (equalsSignCount > 2) {
          hadError = true;
          break;
        }
      } else if (('0' <= ch && ch <= '9') || ('A' <= ch && ch <= 'Z') ||
                 ('a' <= ch && ch <= 'z') || ch == '+' || ch == '/') {
        if (equalsSignCount) {
          hadError = true;
          break;
        }
        out[outLength++] = kBase64DecMap[ch.charCodeAt(0)];
      } else {
        if (ch <= ' ' && (ch == ' ' || ch == '\n' || ch == '\t' || ch == '\r' || ch == '\f'))
          continue;
        hadError = true;
        break;
      }
    }
    if (outLength < out.length)
      out = out.slice(0, outLength);
    if (hadError)
      return '';
    if (!outLength) {
      if (!equalsSignCount)
        return out.map(c => String.fromCharCode(c)).join('');
      else return '';
    }
    if (equalsSignCount && (outLength + equalsSignCount) % 4)
      return '';
    if ((outLength % 4) == 1)
      return '';
    outLength -= Math.floor((outLength + 3) / 4);
    if (!outLength)
      return '';
    let sidx = 0;
    let didx = 0;
    if (outLength > 1)
      while (didx < outLength - 2) {
        out[didx++] = (((out[sidx] << 2) & 255) | ((out[sidx + 1] >> 4) & 3));
        out[didx++] = (((out[sidx + 1] << 4) & 255) | ((out[sidx + 2] >> 2) & 15));
        out[didx++] = (((out[sidx + 2] << 6) & 255) | (out[sidx + 3] & 63));
        sidx += 4;
      }
    if (didx < outLength) {
      out[didx++] = (((out[sidx] << 2) & 255) | ((out[sidx + 1] >> 4) & 3));
      if (didx < outLength)
        out[didx] = (((out[sidx + 1] << 4) & 255) | ((out[sidx + 2] >> 2) & 15));
    }
    if (outLength < out.length)
      out = out.slice(0, outLength);
    return out.map(c => String.fromCharCode(c)).join('');
  }

  Buffer.prototype.base64Slice = function base64Slice(start = 0, end = this.length) {
    if (start < 0 || start > this.length || end > this.length)
      throw new RangeError('Index out of range');
    if (end < start)
      end = start;
    return base64Encode(this.toString('latin1', start, end));
  }

  Buffer.prototype.base64Write = function base64Write(string, offset = 0, length = base64ByteLength(string, string.length)) {
    if (typeof string !== 'string')
      throw new TypeError('argument must be a string');
    if (offset < 0 || length < 0)
      throw new RangeError('Index out of range');
    if (offset > this.length)
      throw new RangeError('"offset" is outside of buffer bounds');
    return this.latin1Write(base64Decode(string.trim().replace(/[^A-Za-z0-9\+\/\=]/g, '').replace(/=[\S\s]*?$/, '')), offset);
  }

  Buffer.prototype.base64urlSlice = function base64urlSlice(start = 0, end = this.length) {
    return this.base64Slice(start, end).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  Buffer.prototype.base64urlWrite = function base64urlWrite(string, offset = 0, length = base64ByteLength(string, string.length)) {
    return this.base64Write(string.replace(/-/g, '+').replace(/_/g, '/'), offset, length);
  }

  Buffer.prototype.hexSlice = function hexSlice(start = 0, end = this.length) {
    if (start < 0 || start > this.length || end > this.length)
      throw new RangeError('Index out of range');
    if (end < start)
      end = start;
    let res = '';
    for (let i = start; i !== end; ++i)
      res += this[i].toString(16).padStart(2, '0');
    return res;
  }

  Buffer.prototype.hexWrite = function hexWrite(string, offset = 0, length = string.length >>> 1) {
    if (typeof string !== 'string')
      throw new TypeError('argument must be a string');
    if (offset < 0 || length < 0)
      throw new RangeError('Index out of range');
    if (offset > this.length)
      throw new RangeError('"offset" is outside of buffer bounds');
    length = Math.min(this.length - offset, string.length >>> 1, length);
    for (let i = 0; i !== length; ++i) {
      const code = parseInt(string.slice(i * 2, i * 2 + 1), 16);
      if (Number.isNaN(code))
        return i;
      this[offset++] = code;
    }
    return length;
  }

  const encodings = [
    'ascii',
    'utf8',
    'base64',
    'base64url',
    'utf16le',
    'hex',
    'buffer',
    'latin1'
  ];
  const encodingsMap = {};
  for (let i = 0; i !== encodings.length; ++i)
    encodingsMap[encodings[i]] = i;

  let bufferWarningAlreadyEmitted = false;
  const bufferWarning = 'Buffer() is deprecated due to security and usability ' +
                        'issues. Please use the Buffer.alloc(), ' +
                        'Buffer.allocUnsafe(), or Buffer.from() methods instead.';

  function showFlaggedDeprecation() {
    if (bufferWarningAlreadyEmitted)
      return;

    setTimeout(() => console.warn('[DEP0005] DeprecationWarning: ' + bufferWarning));
    bufferWarningAlreadyEmitted = true;
  }

  function toInteger(n, defaultVal) {
    n = +n;
    if (!Number.isNaN(n) &&
        n >= Number.MIN_SAFE_INTEGER &&
        n <= Number.MAX_SAFE_INTEGER)
      return ((n % 1) === 0 ? n : Math.floor(n));
    return defaultVal;
  }

  function _copy(source, target, targetStart, sourceStart, sourceEnd) {
    if (!isUint8Array(source))
      throw new ERR_INVALID_ARG_TYPE('source', ['Buffer', 'Uint8Array'], source);
    if (!isUint8Array(target))
      throw new ERR_INVALID_ARG_TYPE('target', ['Buffer', 'Uint8Array'], target);

    if (targetStart === undefined)
      targetStart = 0;
    else {
      targetStart = toInteger(targetStart, 0);
      if (targetStart < 0)
        throw new ERR_OUT_OF_RANGE('targetStart', '>= 0', targetStart);
    }
  
    if (sourceStart === undefined)
      sourceStart = 0;
    else {
      sourceStart = toInteger(sourceStart, 0);
      if (sourceStart < 0 || sourceStart > source.length)
        throw new ERR_OUT_OF_RANGE('sourceStart', `>= 0 && <= ${source.length}`, sourceStart);
    }
  
    if (sourceEnd === undefined)
      sourceEnd = source.length;
    else {
      sourceEnd = toInteger(sourceEnd, 0);
      if (sourceEnd < 0)
        throw new ERR_OUT_OF_RANGE('sourceEnd', '>= 0', sourceEnd);
    }

    if (targetStart >= target.length || sourceStart >= sourceEnd)
      return 0;

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

    Uint8Array.prototype.set.call(target, source, targetStart);

    return nb;
  }

  function Buffer(arg, encodingOrOffset, length) {
    showFlaggedDeprecation();
    if (typeof arg === 'number') {
      if (typeof encodingOrOffset === 'string')
        throw new ERR_INVALID_ARG_TYPE('string', 'string', arg);
      return Buffer.alloc(arg);
    }
    return Buffer.from(arg, encodingOrOffset, length);
  }

  Object.defineProperty(Buffer, Symbol.species, {
    __proto__: null,
    enumerable: false,
    configurable: true,
    get() { return FastBuffer; }
  });

  Buffer.from = function from(value, encodingOrOffset, length) {
    if (typeof value === 'string')
      return fromString(value, encodingOrOffset);

    if (typeof value === 'object' && value !== null) {
      if (isAnyArrayBuffer(value))
        return fromArrayBuffer(value, encodingOrOffset, length);

      const valueOf = value.valueOf && value.valueOf();
      if (valueOf != null &&
          valueOf !== value &&
          (typeof valueOf === 'string' || typeof valueOf === 'object'))
        return from(valueOf, encodingOrOffset, length);

      const b = fromObject(value);
      if (b)
        return b;

      if (typeof value[Symbol.toPrimitive] === 'function') {
        const primitive = value[Symbol.toPrimitive]('string');
        if (typeof primitive === 'string')
          return fromString(primitive, encodingOrOffset);
      }
    }

    throw new ERR_INVALID_ARG_TYPE(
      'first argument',
      ['string', 'Buffer', 'ArrayBuffer', 'Array', 'Array-like Object'],
      value,
    );
  };

  Buffer.copyBytesFrom = function copyBytesFrom(view, offset, length) {
    if (!isTypedArray(view))
      throw new ERR_INVALID_ARG_TYPE('view', ['TypedArray'], view);

    const viewLength = view.length;
    if (viewLength === 0)
      return Buffer.alloc(0);

    if (offset !== undefined || length !== undefined) {
      if (offset !== undefined) {
        validateInteger(offset, 'offset', 0);
        if (offset >= viewLength) return Buffer.alloc(0);
      } else offset = 0;
      let end;
      if (length !== undefined) {
        validateInteger(length, 'length', 0);
        end = offset + length;
      } else end = viewLength;

      view = view.slice(offset, end);
    }

    return fromArrayLike(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
  };

  const of = (...items) => {
    const newObj = new FastBuffer(items.length);
    for (let k = 0; k < items.length; k++)
      newObj[k] = items[k];
    return newObj;
  };
  Buffer.of = of;

  Object.setPrototypeOf(Buffer, Uint8Array);

  Buffer.alloc = function alloc(size, fill, encoding) {
    validateNumber(size, 'size', 0, Number.MAX_SAFE_INTEGER);
    if (fill !== undefined && fill !== 0 && size > 0) {
      const buf = new FastBuffer(size);
      return _fill(buf, fill, 0, buf.length, encoding);
    }
    return new FastBuffer(size);
  };

  Buffer.allocUnsafe = function allocUnsafe(size) {
    validateNumber(size, 'size', 0, Number.MAX_SAFE_INTEGER);
    return allocate(size);
  };

  Buffer.allocUnsafeSlow = function allocUnsafeSlow(size) {
    validateNumber(size, 'size', 0, Number.MAX_SAFE_INTEGER);
    return new FastBuffer(size);
  };

  function allocate(size) {
    if (size <= 0)
      return new FastBuffer();
    return new FastBuffer(size);
  }

  function fromStringFast(string, ops) {
    const length = ops.byteLength(string);
    let b = new FastBuffer(length);
    const actual = ops.write(b, string, 0, length);
    if (actual !== length)
      return new FastBuffer(b.buffer, 0, actual);
    return b;
  }

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
    return fromStringFast(string, ops);
  }

  function fromArrayBuffer(obj, byteOffset, length) {
    if (byteOffset === undefined)
      byteOffset = 0;
    else {
      byteOffset = +byteOffset;
      if (Number.isNaN(byteOffset))
        byteOffset = 0;
    }

    const maxLength = obj.byteLength - byteOffset;

    if (maxLength < 0)
      throw new ERR_BUFFER_OUT_OF_BOUNDS('offset');

    if (length === undefined)
      length = maxLength;
    else {
      length = +length;
      if (length > 0) {
        if (length > maxLength)
          throw new ERR_BUFFER_OUT_OF_BOUNDS('length');
      } else length = 0;
    }

    return new FastBuffer(obj, byteOffset, length);
  }

  function fromArrayLike(obj) {
    if (obj.length <= 0)
      return new FastBuffer();
    return new FastBuffer(obj);
  }

  function fromObject(obj) {
    if (obj.length !== undefined || isAnyArrayBuffer(obj.buffer)) {
      if (typeof obj.length !== 'number')
        return new FastBuffer();
      return fromArrayLike(obj);
    }

    if (obj.type === 'Buffer' && Array.isArray(obj.data))
      return fromArrayLike(obj.data);
  }

  Buffer.isBuffer = function isBuffer(b) {
    return b instanceof Buffer;
  };

  Buffer.compare = function compare(buf1, buf2) {
    if (!isUint8Array(buf1))
      throw new ERR_INVALID_ARG_TYPE('buf1', ['Buffer', 'Uint8Array'], buf1);

    if (!isUint8Array(buf2))
      throw new ERR_INVALID_ARG_TYPE('buf2', ['Buffer', 'Uint8Array'], buf2);

    if (buf1 === buf2)
      return 0;

    return _compare(buf1, buf2);
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
      for (let i = 0; i < list.length; i++)
        if (list[i].length)
          length += list[i].length;
    } else validateOffset(length, 'length');

    const buffer = Buffer.allocUnsafe(length);
    let pos = 0;
    for (let i = 0; i < list.length; i++) {
      const buf = list[i];
      if (!isUint8Array(buf))
        throw new ERR_INVALID_ARG_TYPE(`list[${i}]`, ['Buffer', 'Uint8Array'], list[i]);
      pos += _copyActual(buf, buffer, pos, 0, buf.length);
    }

    if (pos < length)
      Uint8Array.prototype.fill.call(buffer, 0, pos, length);

    return buffer;
  };

  function base64ByteLength(str, bytes) {
    if (str.charCodeAt(bytes - 1) === 0x3D)
      bytes--;
    if (bytes > 1 && str.charCodeAt(bytes - 1) === 0x3D)
      bytes--;

    return (bytes * 3) >>> 2;
  }

  const encodingOps = {
    utf8: {
      encoding: 'utf8',
      encodingVal: encodingsMap.utf8,
      byteLength: byteLengthUtf8,
      write: (buf, string, offset, len) => buf.utf8Write(string, offset, len),
      slice: (buf, start, end) => buf.utf8Slice(start, end),
      indexOf: (buf, val, byteOffset, dir) =>
        indexOfBuffer(buf, Buffer.from(val, 'utf8'), byteOffset, encodingsMap.utf8, dir),
    },
    ucs2: {
      encoding: 'ucs2',
      encodingVal: encodingsMap.utf16le,
      byteLength: (string) => string.length * 2,
      write: (buf, string, offset, len) => buf.ucs2Write(string, offset, len),
      slice: (buf, start, end) => buf.ucs2Slice(start, end),
      indexOf: (buf, val, byteOffset, dir) =>
        indexOfBuffer(buf, Buffer.from(val, 'utf16le'), byteOffset, encodingsMap.utf16le, dir),
    },
    utf16le: {
      encoding: 'utf16le',
      encodingVal: encodingsMap.utf16le,
      byteLength: (string) => string.length * 2,
      write: (buf, string, offset, len) => buf.ucs2Write(string, offset, len),
      slice: (buf, start, end) => buf.ucs2Slice(start, end),
      indexOf: (buf, val, byteOffset, dir) =>
        indexOfBuffer(buf, Buffer.from(val, 'utf16le'), byteOffset, encodingsMap.utf16le, dir),
    },
    latin1: {
      encoding: 'latin1',
      encodingVal: encodingsMap.latin1,
      byteLength: (string) => string.length,
      write: (buf, string, offset, len) => buf.latin1Write(string, offset, len),
      slice: (buf, start, end) => buf.latin1Slice(start, end),
      indexOf: (buf, val, byteOffset, dir) =>
        indexOfBuffer(buf, Buffer.from(val, 'latin1'), byteOffset, encodingsMap.latin1, dir),
    },
    ascii: {
      encoding: 'ascii',
      encodingVal: encodingsMap.ascii,
      byteLength: (string) => string.length,
      write: (buf, string, offset, len) => buf.asciiWrite(string, offset, len),
      slice: (buf, start, end) => buf.asciiSlice(start, end),
      indexOf: (buf, val, byteOffset, dir) =>
        indexOfBuffer(buf,
                      fromStringFast(val, encodingOps.ascii),
                      byteOffset,
                      encodingsMap.ascii,
                      dir),
    },
    base64: {
      encoding: 'base64',
      encodingVal: encodingsMap.base64,
      byteLength: (string) => base64ByteLength(string, string.length),
      write: (buf, string, offset, len) => buf.base64Write(string, offset, len),
      slice: (buf, start, end) => buf.base64Slice(start, end),
      indexOf: (buf, val, byteOffset, dir) =>
        indexOfBuffer(buf,
                      fromStringFast(val, encodingOps.base64),
                      byteOffset,
                      encodingsMap.base64,
                      dir),
    },
    base64url: {
      encoding: 'base64url',
      encodingVal: encodingsMap.base64url,
      byteLength: (string) => base64ByteLength(string, string.length),
      write: (buf, string, offset, len) =>
        buf.base64urlWrite(string, offset, len),
      slice: (buf, start, end) => buf.base64urlSlice(start, end),
      indexOf: (buf, val, byteOffset, dir) =>
        indexOfBuffer(buf,
                      fromStringFast(val, encodingOps.base64url),
                      byteOffset,
                      encodingsMap.base64url,
                      dir),
    },
    hex: {
      encoding: 'hex',
      encodingVal: encodingsMap.hex,
      byteLength: (string) => string.length >>> 1,
      write: (buf, string, offset, len) => buf.hexWrite(string, offset, len),
      slice: (buf, start, end) => buf.hexSlice(start, end),
      indexOf: (buf, val, byteOffset, dir) =>
        indexOfBuffer(buf,
                      fromStringFast(val, encodingOps.hex),
                      byteOffset,
                      encodingsMap.hex,
                      dir),
    },
  };
  function getEncodingOps(encoding) {
    switch (encoding + '') {
      case 'utf8':
      case 'utf-8':
        return encodingOps.utf8;
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return encodingOps.utf16le;
      case 'binary':
      case 'latin1':
        return encodingOps.latin1;
      case 'ascii':
      case 'base64':
      case 'base64url':
      case 'hex':
        return encodingOps[encoding];
    }
  }

  function byteLength(string, encoding) {
    if (typeof string !== 'string') {
      if (ArrayBuffer.isView(string) || isAnyArrayBuffer(string))
        return string.byteLength;

      throw new ERR_INVALID_ARG_TYPE(
        'string', ['string', 'Buffer', 'ArrayBuffer'], string,
      );
    }

    const len = string.length;
    if (len === 0)
      return 0;

    if (encoding) {
      const ops = getEncodingOps(encoding);
      if (ops)
        return ops.byteLength(string);
    }
    return byteLengthUtf8(string);
  }

  Buffer.byteLength = byteLength;

  Object.defineProperty(Buffer.prototype, 'parent', {
    __proto__: null,
    enumerable: true,
    get() {
      if (!(this instanceof Buffer))
        return undefined;
      return this.buffer;
    },
  });
  Object.defineProperty(Buffer.prototype, 'offset', {
    __proto__: null,
    enumerable: true,
    get() {
      if (!(this instanceof Buffer))
        return undefined;
      return this.byteOffset;
    },
  });

  Buffer.prototype.copy =
    function copy(target, targetStart, sourceStart, sourceEnd) {
      return _copy(this, target, targetStart, sourceStart, sourceEnd);
    };

  Buffer.prototype.toString = function toString(encoding, start, end) {
    if (arguments.length === 0)
      return this.utf8Slice();

    const len = this.length;

    if (start <= 0)
      start = 0;
    else if (start >= len)
      return '';
    else start |= 0;

    if (end === undefined || end > len)
      end = len;
    else end |= 0;

    if (end <= start)
      return '';

    if (encoding === undefined)
      return this.utf8Slice(start, end);

    const ops = getEncodingOps(encoding);
    if (ops === undefined)
      throw new ERR_UNKNOWN_ENCODING(encoding);

    return ops.slice(this, start, end);
  };

  Buffer.prototype.equals = function equals(otherBuffer) {
    if (!isUint8Array(otherBuffer))
      throw new ERR_INVALID_ARG_TYPE(
        'otherBuffer', ['Buffer', 'Uint8Array'], otherBuffer);

    if (this === otherBuffer)
      return true;

    if (this.byteLength !== otherBuffer.byteLength)
      return false;

    return this.byteLength === 0 || _compare(this, otherBuffer) === 0;
  };

  Buffer.prototype.inspect = function inspect() {
    const max = Math.min(50, this.length);
    const remaining = this.length - 50;
    let str = this.hexSlice(0, max).replace(/(.{2})/g, '$1 ').trim();
    if (remaining > 0)
      str += ` ... ${remaining} more byte${remaining > 1 ? 's' : ''}`;
    return `<${this.constructor.name} ${str}>`;
  };

  Buffer.prototype.compare = function compare(target,
                                              targetStart,
                                              targetEnd,
                                              sourceStart,
                                              sourceEnd) {
    if (!isUint8Array(target))
      throw new ERR_INVALID_ARG_TYPE('target', ['Buffer', 'Uint8Array'], target);
    if (arguments.length === 1)
      return _compare(this, target);

    if (targetStart === undefined)
      targetStart = 0;
    else validateOffset(targetStart, 'targetStart');
  
    if (targetEnd === undefined)
      targetEnd = target.length;
    else validateOffset(targetEnd, 'targetEnd', 0, target.length);
  
    if (sourceStart === undefined)
      sourceStart = 0;
    else validateOffset(sourceStart, 'sourceStart');
  
    if (sourceEnd === undefined)
      sourceEnd = this.length;
    else validateOffset(sourceEnd, 'sourceEnd', 0, this.length);

    if (sourceStart >= sourceEnd)
      return (targetStart >= targetEnd ? 0 : -1);
    if (targetStart >= targetEnd)
      return 1;

    return compareOffset(this, target, targetStart, sourceStart, targetEnd,
                        sourceEnd);
  };

  function bidirectionalIndexOf(buffer, val, byteOffset, encoding, dir) {
    validateBuffer(buffer);

    if (typeof byteOffset === 'string') {
      encoding = byteOffset;
      byteOffset = undefined;
    } else if (byteOffset > 0x7fffffff)
      byteOffset = 0x7fffffff;
    else if (byteOffset < -0x80000000)
      byteOffset = -0x80000000;
    byteOffset = +byteOffset;
    if (Number.isNaN(byteOffset))
      byteOffset = dir ? 0 : (buffer.length || buffer.byteLength);

    if (typeof val === 'number')
      return dir
        ? Uint8Array.prototype.indexOf.call(buffer, val >>> 0, byteOffset)
        : Uint8Array.prototype.lastIndexOf.call(buffer, val >>> 0, byteOffset);

    let ops;
    if (encoding === undefined)
      ops = encodingOps.utf8;
    else ops = getEncodingOps(encoding);

    if (typeof val === 'string') {
      if (ops === undefined)
        throw new ERR_UNKNOWN_ENCODING(encoding);
      val = Buffer.from(val, encoding);
    }

    if (isUint8Array(val)) {
      const encodingVal =
        (ops === undefined ? encodingsMap.utf8 : ops.encodingVal);
      return indexOfBuffer(buffer, val, byteOffset, encodingVal, dir);
    }

    throw new ERR_INVALID_ARG_TYPE(
      'value', ['number', 'string', 'Buffer', 'Uint8Array'], val,
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

  Buffer.prototype.fill = function fill(value, offset, end, encoding) {
    return _fill(this, value, offset, end, encoding);
  };

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

      if (value.length === 0)
        value = 0;
      else if (value.length === 1) {
        if (normalizedEncoding === 'utf8') {
          const code = value.charCodeAt(0);
          if (code < 128)
            value = code;
        } else if (normalizedEncoding === 'latin1')
          value = value.charCodeAt(0);
      }
    } else encoding = undefined;

    if (offset === undefined) {
      offset = 0;
      end = buf.length;
    } else {
      validateOffset(offset, 'offset');
      if (end === undefined)
        end = buf.length;
      else validateOffset(end, 'end', 0, buf.length);
      if (offset >= end)
        return buf;
    }


    if (typeof value === 'number') {
      const byteLen = new Uint8Array(buf.buffer).byteLength;
      const fillLength = end - offset;
      if (offset > end || fillLength + offset > byteLen)
        throw new ERR_BUFFER_OUT_OF_BOUNDS();

      Uint8Array.prototype.fill.call(buf, value, offset, end);
    } else {
      if (!Buffer.isBuffer(value))
        value = Buffer.from(value, encoding);
      const fillLength = end - offset;
      for (let i = 0; i !== fillLength; ++i)
        buf[offset++] = value[i % value.length];
    }

    return buf;
  }

  Buffer.prototype.write = function write(string, offset, length, encoding) {
    if (offset === undefined)
      return this.utf8Write(string, 0, this.length);

    if (length === undefined && typeof offset === 'string') {
      encoding = offset;
      length = this.length;
      offset = 0;
    } else {
      validateOffset(offset, 'offset', 0, this.length);
      const remaining = this.length - offset;

      if (length === undefined)
        length = remaining;
      else if (typeof length === 'string') {
        encoding = length;
        length = remaining;
      } else {
        validateOffset(length, 'length', 0, this.length);
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
    offset = Math.trunc(offset);
    if (offset === 0)
      return 0;
    if (offset < 0) {
      offset += length;
      return offset > 0 ? offset : 0;
    }
    if (offset < length)
      return offset;
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
    const len = this.length;
    if (len % 2 !== 0)
      throw new ERR_INVALID_BUFFER_SIZE('16-bits');
    for (let i = 0; i < len; i += 2)
      swap(this, i, i + 1);
    return this;
  };

  Buffer.prototype.swap32 = function swap32() {
    const len = this.length;
    if (len % 4 !== 0)
      throw new ERR_INVALID_BUFFER_SIZE('32-bits');
    for (let i = 0; i < len; i += 4) {
      swap(this, i, i + 3);
      swap(this, i + 1, i + 2);
    }
    return this;
  };

  Buffer.prototype.swap64 = function swap64() {
    const len = this.length;
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

  window.Buffer = Buffer;
})();