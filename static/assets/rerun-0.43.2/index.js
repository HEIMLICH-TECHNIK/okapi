var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// compat.ts
var FIELD_NAMES = {
  "active_store_id": "activeStoreId",
  "allow_blocking_native_modal": "allowBlockingNativeModal",
  "allow_fullscreen": "allowFullscreen",
  "application_id": "applicationId",
  "asset_id": "assetId",
  "asset_ids": "assetIds",
  "base_url": "baseUrl",
  "blocking_native_modal": "blockingNativeModal",
  "blueprint_id": "blueprintId",
  "catalog_url": "catalogUrl",
  "check_for_updates_on_startup": "checkForUpdatesOnStartup",
  "component_type": "componentType",
  "container_id": "containerId",
  "container_name": "containerName",
  "current_time": "currentTime",
  "dataset_url": "datasetUrl",
  "display_name": "displayName",
  "duration_nanos": "durationNanos",
  "edge_filter": "edgeFilter",
  "enable_history": "enableHistory",
  "entity_path": "entityPath",
  "fallback_token": "fallbackToken",
  "frame_filter": "frameFilter",
  "has_static": "hasStatic",
  "hide_welcome_screen": "hideWelcomeScreen",
  "include_transforms": "includeTransforms",
  "include_unavailable": "includeUnavailable",
  "instance_id": "instanceId",
  "manifest_url": "manifestUrl",
  "max_entities": "maxEntities",
  "max_size": "maxSize",
  "memory_limit": "memoryLimit",
  "omitted_entities": "omittedEntities",
  "panel_state_overrides": "panelStateOverrides",
  "partition_id": "segmentId",
  "paths_only": "pathsOnly",
  "play_state": "playState",
  "recording_id": "recordingId",
  "render_backend": "renderBackend",
  "segment_id": "segmentId",
  "server_origin": "serverOrigin",
  "signed_in_url": "signedInUrl",
  "signed_out_url": "signedOutUrl",
  "store_id": "storeId",
  "store_ids": "storeIds",
  "table_url": "tableUrl",
  "time_range": "timeRange",
  "time_type": "timeType",
  "timestamp_nanos": "timestampNanos",
  "video_decoder": "videoDecoder",
  "view_id": "viewId",
  "view_name": "viewName",
  "viewer_base_url": "viewerBaseUrl",
  "viewer_version": "viewerVersion"
};
var NESTED_FIELDS = [
  "components",
  "currentTime",
  "entities",
  "entries",
  "items",
  "loading",
  "login",
  "recordings",
  "reports",
  "servers",
  "timeRange",
  "timelines",
  "views"
];
var nestedFields = new Set(NESTED_FIELDS);
function normalizeOptions(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
  const result = { ...value };
  for (const [legacy, canonical] of Object.entries(FIELD_NAMES)) {
    if (result[canonical] === void 0 && legacy in result) {
      result[canonical] = result[legacy];
    }
    delete result[legacy];
  }
  for (const key of nestedFields) {
    if (key in result) {
      const child = result[key];
      result[key] = Array.isArray(child) ? child.map(normalizeOptions) : normalizeOptions(child);
    }
  }
  return result;
}
__name(normalizeOptions, "normalizeOptions");
function withLegacyFields(value) {
  if (Array.isArray(value)) return value.map(withLegacyFields);
  if (value === null || typeof value !== "object") return value;
  const result = value;
  for (const key of nestedFields) {
    if (key in result) {
      result[key] = withLegacyFields(result[key]);
    }
  }
  for (const [legacy, canonical] of Object.entries(FIELD_NAMES)) {
    if (canonical in result) {
      Object.defineProperty(result, legacy, {
        enumerable: false,
        configurable: true,
        get: /* @__PURE__ */ __name(() => result[canonical], "get"),
        set: /* @__PURE__ */ __name((value2) => {
          result[canonical] = value2;
        }, "set")
      });
    }
  }
  return value;
}
__name(withLegacyFields, "withLegacyFields");

// ../node_modules/@bufbuild/protobuf/dist/esm/is-message.js
function isMessage(arg, schema) {
  const isMessage2 = arg !== null && typeof arg == "object" && "$typeName" in arg && typeof arg.$typeName == "string";
  if (!isMessage2) {
    return false;
  }
  if (schema === void 0) {
    return true;
  }
  return schema.typeName === arg.$typeName;
}
__name(isMessage, "isMessage");

// ../node_modules/@bufbuild/protobuf/dist/esm/descriptors.js
var ScalarType;
(function(ScalarType2) {
  ScalarType2[ScalarType2["DOUBLE"] = 1] = "DOUBLE";
  ScalarType2[ScalarType2["FLOAT"] = 2] = "FLOAT";
  ScalarType2[ScalarType2["INT64"] = 3] = "INT64";
  ScalarType2[ScalarType2["UINT64"] = 4] = "UINT64";
  ScalarType2[ScalarType2["INT32"] = 5] = "INT32";
  ScalarType2[ScalarType2["FIXED64"] = 6] = "FIXED64";
  ScalarType2[ScalarType2["FIXED32"] = 7] = "FIXED32";
  ScalarType2[ScalarType2["BOOL"] = 8] = "BOOL";
  ScalarType2[ScalarType2["STRING"] = 9] = "STRING";
  ScalarType2[ScalarType2["BYTES"] = 12] = "BYTES";
  ScalarType2[ScalarType2["UINT32"] = 13] = "UINT32";
  ScalarType2[ScalarType2["SFIXED32"] = 15] = "SFIXED32";
  ScalarType2[ScalarType2["SFIXED64"] = 16] = "SFIXED64";
  ScalarType2[ScalarType2["SINT32"] = 17] = "SINT32";
  ScalarType2[ScalarType2["SINT64"] = 18] = "SINT64";
})(ScalarType || (ScalarType = {}));

// ../node_modules/@bufbuild/protobuf/dist/esm/wire/varint.js
function varint64read() {
  const buf = this.buf;
  let pos = this.pos;
  let lo = 0;
  let hi = 0;
  for (let shift = 0; shift < 28; shift += 7) {
    const b = buf[pos++];
    lo |= (b & 127) << shift;
    if ((b & 128) == 0) {
      this.pos = pos;
      this.assertBounds();
      this.varint64Lo = lo;
      this.varint64Hi = hi;
      return;
    }
  }
  const middleByte = buf[pos++];
  lo |= (middleByte & 15) << 28;
  hi = (middleByte & 112) >> 4;
  if ((middleByte & 128) == 0) {
    this.pos = pos;
    this.assertBounds();
    this.varint64Lo = lo;
    this.varint64Hi = hi;
    return;
  }
  for (let shift = 3; shift <= 31; shift += 7) {
    const b = buf[pos++];
    hi |= (b & 127) << shift;
    if ((b & 128) == 0) {
      this.pos = pos;
      this.assertBounds();
      this.varint64Lo = lo;
      this.varint64Hi = hi;
      return;
    }
  }
  throw new Error("invalid varint");
}
__name(varint64read, "varint64read");
var TWO_PWR_32_DBL = 4294967296;
function int64FromString(dec) {
  const minus = dec[0] === "-";
  if (minus) {
    dec = dec.slice(1);
  }
  const base = 1e6;
  let lowBits = 0;
  let highBits = 0;
  function add1e6digit(begin, end) {
    const digit1e6 = Number(dec.slice(begin, end));
    highBits *= base;
    lowBits = lowBits * base + digit1e6;
    if (lowBits >= TWO_PWR_32_DBL) {
      highBits = highBits + (lowBits / TWO_PWR_32_DBL | 0);
      lowBits = lowBits % TWO_PWR_32_DBL;
    }
  }
  __name(add1e6digit, "add1e6digit");
  add1e6digit(-24, -18);
  add1e6digit(-18, -12);
  add1e6digit(-12, -6);
  add1e6digit(-6);
  return minus ? negate(lowBits, highBits) : newBits(lowBits, highBits);
}
__name(int64FromString, "int64FromString");
function int64ToString(lo, hi) {
  let bits = newBits(lo, hi);
  const negative = bits.hi & 2147483648;
  if (negative) {
    bits = negate(bits.lo, bits.hi);
  }
  const result = uInt64ToString(bits.lo, bits.hi);
  return negative ? "-" + result : result;
}
__name(int64ToString, "int64ToString");
function uInt64ToString(lo, hi) {
  ({ lo, hi } = toUnsigned(lo, hi));
  if (hi <= 2097151) {
    return String(TWO_PWR_32_DBL * hi + lo);
  }
  const low = lo & 16777215;
  const mid = (lo >>> 24 | hi << 8) & 16777215;
  const high = hi >> 16 & 65535;
  let digitA = low + mid * 6777216 + high * 6710656;
  let digitB = mid + high * 8147497;
  let digitC = high * 2;
  const base = 1e7;
  if (digitA >= base) {
    digitB += Math.floor(digitA / base);
    digitA %= base;
  }
  if (digitB >= base) {
    digitC += Math.floor(digitB / base);
    digitB %= base;
  }
  return digitC.toString() + decimalFrom1e7WithLeadingZeros(digitB) + decimalFrom1e7WithLeadingZeros(digitA);
}
__name(uInt64ToString, "uInt64ToString");
function toUnsigned(lo, hi) {
  return { lo: lo >>> 0, hi: hi >>> 0 };
}
__name(toUnsigned, "toUnsigned");
function newBits(lo, hi) {
  return { lo: lo | 0, hi: hi | 0 };
}
__name(newBits, "newBits");
function negate(lowBits, highBits) {
  highBits = ~highBits;
  if (lowBits) {
    lowBits = ~lowBits + 1;
  } else {
    highBits += 1;
  }
  return newBits(lowBits, highBits);
}
__name(negate, "negate");
var decimalFrom1e7WithLeadingZeros = /* @__PURE__ */ __name((digit1e7) => {
  const partial = String(digit1e7);
  return "0000000".slice(partial.length) + partial;
}, "decimalFrom1e7WithLeadingZeros");
function varint32write(value, bytes) {
  if (value >>> 0 < 128) {
    bytes.push(value);
    return;
  }
  if (value >= 0) {
    while (value > 127) {
      bytes.push(value & 127 | 128);
      value = value >>> 7;
    }
    bytes.push(value);
  } else {
    for (let i = 0; i < 9; i++) {
      bytes.push(value & 127 | 128);
      value = value >> 7;
    }
    bytes.push(1);
  }
}
__name(varint32write, "varint32write");
function varint32read() {
  let b = this.buf[this.pos++];
  if ((b & 128) === 0) {
    this.assertBounds();
    return b;
  }
  let result = b & 127;
  b = this.buf[this.pos++];
  result |= (b & 127) << 7;
  if ((b & 128) === 0) {
    this.assertBounds();
    return result;
  }
  b = this.buf[this.pos++];
  result |= (b & 127) << 14;
  if ((b & 128) === 0) {
    this.assertBounds();
    return result;
  }
  b = this.buf[this.pos++];
  result |= (b & 127) << 21;
  if ((b & 128) === 0) {
    this.assertBounds();
    return result;
  }
  b = this.buf[this.pos++];
  result |= (b & 15) << 28;
  for (let readBytes = 5; (b & 128) !== 0 && readBytes < 10; readBytes++)
    b = this.buf[this.pos++];
  if ((b & 128) !== 0)
    throw new Error("invalid varint");
  this.assertBounds();
  return result >>> 0;
}
__name(varint32read, "varint32read");

// ../node_modules/@bufbuild/protobuf/dist/esm/proto-int64.js
var protoInt64 = /* @__PURE__ */ makeInt64Support();
function makeInt64Support() {
  const dv = new DataView(new ArrayBuffer(8));
  const ok = typeof BigInt === "function" && typeof dv.getBigInt64 === "function" && typeof dv.getBigUint64 === "function" && typeof dv.setBigInt64 === "function" && typeof dv.setBigUint64 === "function" && (!!globalThis.Deno || !!globalThis.Bun || typeof process != "object" || typeof process.env != "object" || process.env.BUF_BIGINT_DISABLE !== "1");
  if (ok) {
    const MIN = BigInt("-9223372036854775808");
    const MAX = BigInt("9223372036854775807");
    const UMIN = BigInt("0");
    const UMAX = BigInt("18446744073709551615");
    return {
      zero: BigInt(0),
      supported: true,
      parse(value) {
        const bi = typeof value == "bigint" ? value : BigInt(value);
        if (bi > MAX || bi < MIN) {
          throw new Error(`invalid int64: ${value}`);
        }
        return bi;
      },
      uParse(value) {
        const bi = typeof value == "bigint" ? value : BigInt(value);
        if (bi > UMAX || bi < UMIN) {
          throw new Error(`invalid uint64: ${value}`);
        }
        return bi;
      },
      enc(value) {
        dv.setBigInt64(0, this.parse(value), true);
        return {
          lo: dv.getInt32(0, true),
          hi: dv.getInt32(4, true)
        };
      },
      uEnc(value) {
        dv.setBigInt64(0, this.uParse(value), true);
        return {
          lo: dv.getInt32(0, true),
          hi: dv.getInt32(4, true)
        };
      },
      dec(lo, hi) {
        dv.setInt32(0, lo, true);
        dv.setInt32(4, hi, true);
        return dv.getBigInt64(0, true);
      },
      uDec(lo, hi) {
        dv.setInt32(0, lo, true);
        dv.setInt32(4, hi, true);
        return dv.getBigUint64(0, true);
      }
    };
  }
  return {
    zero: "0",
    supported: false,
    parse(value) {
      if (typeof value != "string") {
        value = value.toString();
      }
      assertInt64String(value);
      return value;
    },
    uParse(value) {
      if (typeof value != "string") {
        value = value.toString();
      }
      assertUInt64String(value);
      return value;
    },
    enc(value) {
      if (typeof value != "string") {
        value = value.toString();
      }
      assertInt64String(value);
      return int64FromString(value);
    },
    uEnc(value) {
      if (typeof value != "string") {
        value = value.toString();
      }
      assertUInt64String(value);
      return int64FromString(value);
    },
    dec(lo, hi) {
      return int64ToString(lo, hi);
    },
    uDec(lo, hi) {
      return uInt64ToString(lo, hi);
    }
  };
}
__name(makeInt64Support, "makeInt64Support");
function assertInt64String(value) {
  if (!/^-?[0-9]+$/.test(value)) {
    throw new Error("invalid int64: " + value);
  }
}
__name(assertInt64String, "assertInt64String");
function assertUInt64String(value) {
  if (!/^[0-9]+$/.test(value)) {
    throw new Error("invalid uint64: " + value);
  }
}
__name(assertUInt64String, "assertUInt64String");

// ../node_modules/@bufbuild/protobuf/dist/esm/reflect/scalar.js
function scalarZeroValue(type, longAsString) {
  switch (type) {
    case ScalarType.STRING:
      return "";
    case ScalarType.BOOL:
      return false;
    case ScalarType.DOUBLE:
    case ScalarType.FLOAT:
      return 0;
    case ScalarType.INT64:
    case ScalarType.UINT64:
    case ScalarType.SFIXED64:
    case ScalarType.FIXED64:
    case ScalarType.SINT64:
      return longAsString ? "0" : protoInt64.zero;
    case ScalarType.BYTES:
      return new Uint8Array(0);
    default:
      return 0;
  }
}
__name(scalarZeroValue, "scalarZeroValue");

// ../node_modules/@bufbuild/protobuf/dist/esm/reflect/unsafe.js
var unsafeLocal = Symbol.for("reflect unsafe local");
function unsafeIsSetExplicit(target, localName) {
  return Object.prototype.hasOwnProperty.call(target, localName) && target[localName] !== void 0;
}
__name(unsafeIsSetExplicit, "unsafeIsSetExplicit");
function setOwn(obj, key, value) {
  if (key === "__proto__") {
    Object.defineProperty(obj, "__proto__", {
      value,
      writable: true,
      enumerable: true,
      configurable: true
    });
  } else {
    obj[key] = value;
  }
}
__name(setOwn, "setOwn");

// ../node_modules/@bufbuild/protobuf/dist/esm/reflect/guard.js
function isObject(arg) {
  return arg !== null && typeof arg == "object" && !Array.isArray(arg);
}
__name(isObject, "isObject");

// ../node_modules/@bufbuild/protobuf/dist/esm/wkt/wrappers.js
function isWrapperDesc(messageDesc2) {
  const f = messageDesc2.fields[0];
  return isWrapperTypeName(messageDesc2.typeName) && f !== void 0 && f.fieldKind == "scalar" && f.name == "value" && f.number == 1;
}
__name(isWrapperDesc, "isWrapperDesc");
var wrapperTypeNames = /* @__PURE__ */ new Set([
  "google.protobuf.DoubleValue",
  "google.protobuf.FloatValue",
  "google.protobuf.Int64Value",
  "google.protobuf.UInt64Value",
  "google.protobuf.Int32Value",
  "google.protobuf.UInt32Value",
  "google.protobuf.BoolValue",
  "google.protobuf.StringValue",
  "google.protobuf.BytesValue"
]);
function isWrapperTypeName(name) {
  return wrapperTypeNames.has(name);
}
__name(isWrapperTypeName, "isWrapperTypeName");

// ../node_modules/@bufbuild/protobuf/dist/esm/create.js
var EDITION_PROTO3 = 999;
var EDITION_PROTO2 = 998;
var IMPLICIT = 2;
function create(schema, init) {
  if (isMessage(init, schema)) {
    return init;
  }
  return compiledCreate(schema)(init);
}
__name(create, "create");
var compiledCreates = /* @__PURE__ */ new WeakMap();
function compiledCreate(desc) {
  let compiled = compiledCreates.get(desc);
  if (compiled === void 0) {
    compiled = compileCreate(desc);
    compiledCreates.set(desc, compiled);
  }
  return compiled;
}
__name(compiledCreate, "compiledCreate");
var INIT_SINGULAR = 0;
var INIT_LIST = 1;
var INIT_MAP = 2;
var INIT_ONEOF = 3;
function compileCreate(desc) {
  const typeName = desc.typeName;
  const { properties, prototype } = compileInitMessage(desc);
  return (init) => {
    let message;
    if (prototype !== void 0) {
      message = Object.create(prototype);
      message.$typeName = typeName;
    } else {
      message = { $typeName: typeName };
    }
    for (let i = 0; i < properties.length; i++) {
      const property = properties[i];
      const name = property.name;
      const initValue = init === null || init === void 0 ? void 0 : init[name];
      switch (property.kind) {
        case INIT_SINGULAR:
          if (initValue != null) {
            message[name] = property.convert !== void 0 ? property.convert(initValue) : initValue;
          } else if (property.constant !== void 0) {
            message[name] = property.constant;
          }
          break;
        case INIT_LIST:
          message[name] = property.convert !== void 0 && Array.isArray(initValue) ? initValue.map(property.convert) : initValue !== null && initValue !== void 0 ? initValue : [];
          break;
        case INIT_MAP:
          if (property.convert === void 0 || !isObject(initValue)) {
            message[name] = initValue !== null && initValue !== void 0 ? initValue : {};
          } else {
            const converted = {};
            const keys = Object.keys(initValue);
            for (let k = 0; k < keys.length; k++) {
              setOwn(converted, keys[k], property.convert(initValue[keys[k]]));
            }
            message[name] = converted;
          }
          break;
        case INIT_ONEOF: {
          const oneofValue = initValue;
          if ((oneofValue === null || oneofValue === void 0 ? void 0 : oneofValue.case) != null) {
            const convert = property.convert.get(oneofValue.case);
            if (convert !== void 0) {
              message[name] = {
                case: oneofValue.case,
                value: convert(oneofValue.value)
              };
              break;
            }
          }
          message[name] = { case: void 0 };
          break;
        }
      }
    }
    return message;
  };
}
__name(compileCreate, "compileCreate");
function compileInitMessage(desc) {
  var _a, _b;
  const properties = [];
  const prototype = {};
  const usePrototype = needsPrototypeChain(desc);
  for (const member of desc.members) {
    const name = member.localName;
    if (member.kind == "oneof") {
      properties.push({
        name,
        kind: INIT_ONEOF,
        constant: void 0,
        convert: compileConvertOneof(member)
      });
      continue;
    }
    switch (member.fieldKind) {
      case "message": {
        properties.push({
          name,
          kind: INIT_SINGULAR,
          constant: void 0,
          convert: compileConvertMessage(member)
        });
        break;
      }
      case "list": {
        properties.push({
          name,
          kind: INIT_LIST,
          constant: void 0,
          convert: member.listKind == "message" ? (_a = compileConvertMessage(member)) !== null && _a !== void 0 ? _a : (value) => value : member.scalar == ScalarType.BYTES ? toU8Arr : void 0
        });
        break;
      }
      case "map": {
        properties.push({
          name,
          kind: INIT_MAP,
          constant: void 0,
          convert: member.mapKind == "message" ? (_b = compileConvertMessage(member)) !== null && _b !== void 0 ? _b : (value) => value : member.scalar == ScalarType.BYTES ? toU8Arr : void 0
        });
        break;
      }
      default: {
        const zeroValue = createZeroValue(member);
        properties.push({
          name,
          kind: INIT_SINGULAR,
          constant: member.presence == IMPLICIT ? zeroValue : void 0,
          convert: member.fieldKind == "scalar" && member.scalar == ScalarType.BYTES ? toU8Arr : void 0
        });
        if (usePrototype) {
          prototype[name] = zeroValue;
        }
        break;
      }
    }
  }
  return {
    properties,
    prototype: usePrototype ? prototype : void 0
  };
}
__name(compileInitMessage, "compileInitMessage");
function compileConvertOneof(oneof) {
  const converters = /* @__PURE__ */ new Map();
  for (const field of oneof.fields) {
    let convert;
    if (field.fieldKind == "message") {
      convert = compileConvertMessage(field);
    } else if (field.fieldKind == "scalar" && field.scalar == ScalarType.BYTES) {
      convert = toU8Arr;
    }
    converters.set(field.localName, convert !== null && convert !== void 0 ? convert : (value) => value);
  }
  return converters;
}
__name(compileConvertOneof, "compileConvertOneof");
function compileConvertMessage(field) {
  if (field.fieldKind == "message" && !field.oneof && isWrapperDesc(field.message)) {
    return field.message.fields[0].scalar == ScalarType.BYTES ? toU8Arr : void 0;
  }
  if (field.message.typeName == "google.protobuf.Struct" && field.parent.typeName !== "google.protobuf.Value") {
    return void 0;
  }
  const messageDesc2 = field.message;
  let compiled;
  return (value) => {
    if (!isObject(value) || isMessage(value, messageDesc2)) {
      return value;
    }
    compiled !== null && compiled !== void 0 ? compiled : compiled = compiledCreate(messageDesc2);
    return compiled(value);
  };
}
__name(compileConvertMessage, "compileConvertMessage");
function toU8Arr(value) {
  return Array.isArray(value) ? new Uint8Array(value) : value;
}
__name(toU8Arr, "toU8Arr");
function needsPrototypeChain(desc) {
  switch (desc.file.edition) {
    case EDITION_PROTO3:
      return false;
    case EDITION_PROTO2:
      return true;
    default:
      return desc.fields.some((f) => f.presence != IMPLICIT && f.fieldKind != "message" && !f.oneof);
  }
}
__name(needsPrototypeChain, "needsPrototypeChain");
function createZeroValue(field) {
  const defaultValue = field.getDefaultValue();
  if (defaultValue !== void 0) {
    return field.fieldKind == "scalar" && field.longAsString ? defaultValue.toString() : defaultValue;
  }
  return field.fieldKind == "scalar" ? scalarZeroValue(field.scalar, field.longAsString) : field.enum.values[0].number;
}
__name(createZeroValue, "createZeroValue");

// ../node_modules/@bufbuild/protobuf/dist/esm/reflect/error.js
var FieldError = class extends Error {
  static {
    __name(this, "FieldError");
  }
  constructor(fieldOrOneof, message, name = "FieldValueInvalidError") {
    super(message);
    this.name = name;
    this.field = () => fieldOrOneof;
  }
};

// ../node_modules/@bufbuild/protobuf/dist/esm/wire/text-encoding.js
var te;
function configureTextEncoding(textEncoding) {
  var _a;
  te = Object.assign(Object.assign({}, textEncoding), { encodeUtf8Into: (_a = textEncoding.encodeUtf8Into) !== null && _a !== void 0 ? _a : emulateEncodeInto(textEncoding.encodeUtf8.bind(textEncoding)) });
}
__name(configureTextEncoding, "configureTextEncoding");
function getTextEncoding() {
  if (!te) {
    const globals = globalThis;
    if (!globals.TextEncoder || !globals.TextDecoder) {
      throw new Error("encoding API missing: install TextEncoder and TextDecoder on globalThis");
    }
    const textEncoder = new globals.TextEncoder();
    const textDecoder = new globals.TextDecoder();
    let textDecoderStrict;
    const config = {
      encodeUtf8(text) {
        return textEncoder.encode(text);
      },
      decodeUtf8(bytes, strict) {
        if (strict) {
          if (!textDecoderStrict) {
            textDecoderStrict = new globals.TextDecoder("utf-8", {
              fatal: true
            });
          }
          return textDecoderStrict.decode(bytes);
        }
        return textDecoder.decode(bytes);
      },
      checkUtf8(text) {
        try {
          encodeURIComponent(text);
          return true;
        } catch (_) {
          return false;
        }
      }
    };
    if (textEncoder.encodeInto) {
      config.encodeUtf8Into = textEncoder.encodeInto.bind(textEncoder);
    }
    const nativeStringIsWellFormed = String.prototype.isWellFormed;
    if (nativeStringIsWellFormed) {
      config.checkUtf8 = (text) => {
        return nativeStringIsWellFormed.call(text);
      };
    }
    configureTextEncoding(config);
  }
  return te;
}
__name(getTextEncoding, "getTextEncoding");
function emulateEncodeInto(encodeUtf8) {
  return (text, dest) => {
    const bytes = encodeUtf8(text);
    dest.set(bytes);
    return { written: bytes.byteLength };
  };
}
__name(emulateEncodeInto, "emulateEncodeInto");

// ../node_modules/@bufbuild/protobuf/dist/esm/wire/binary-encoding.js
var WireType;
(function(WireType2) {
  WireType2[WireType2["Varint"] = 0] = "Varint";
  WireType2[WireType2["Bit64"] = 1] = "Bit64";
  WireType2[WireType2["LengthDelimited"] = 2] = "LengthDelimited";
  WireType2[WireType2["StartGroup"] = 3] = "StartGroup";
  WireType2[WireType2["EndGroup"] = 4] = "EndGroup";
  WireType2[WireType2["Bit32"] = 5] = "Bit32";
})(WireType || (WireType = {}));
var UINT32_MAX = 4294967295;
var INT32_MAX = 2147483647;
var INT32_MIN = -2147483648;
var BinaryWriter = class {
  static {
    __name(this, "BinaryWriter");
  }
  constructor(encodeUtf8) {
    this.stackPos = [];
    this.encodeUtf8Into = encodeUtf8 ? emulateEncodeInto(encodeUtf8) : getTextEncoding().encodeUtf8Into;
    this.buffer = EMPTY_BUFFER;
    this.viewCache = EMPTY_VIEW;
    this.pos = 0;
  }
  ensureCapacity(size) {
    const required = this.pos + size;
    if (required > this.buffer.length) {
      let newLen = this.buffer.length || INITIAL_SIZE;
      while (newLen < required)
        newLen *= 2;
      const newBuf = new Uint8Array(newLen);
      if (this.pos > 0)
        newBuf.set(this.buffer);
      this.buffer = newBuf;
    }
  }
  /**
   * The DataView over `buffer`, rebuilt only if the buffer has grown since it
   * was last used.
   */
  view() {
    const bytes = this.buffer;
    const view = this.viewCache;
    if (view.byteLength === bytes.byteLength)
      return view;
    const newView = new DataView(bytes.buffer);
    this.viewCache = newView;
    return newView;
  }
  /**
   * Return all bytes written and reset this writer.
   */
  finish() {
    const result = this.buffer.slice(0, this.pos);
    this.pos = 0;
    this.stackPos = [];
    return result;
  }
  /**
   * Start a new fork for length-delimited data like a message
   * or a packed repeated field.
   *
   * Must be joined later with `join()`.
   */
  fork() {
    this.stackPos.push(this.pos);
    this.ensureCapacity(DEFAULT_LEN_PREFIX_SIZE);
    this.buffer[this.pos++] = 0;
    return this;
  }
  /**
   * Join the last fork. Write its length and bytes, then
   * return to the previous state.
   */
  join() {
    const forkPos = this.stackPos.pop();
    if (forkPos === void 0)
      throw new Error("invalid state, fork stack empty");
    const len = this.pos - forkPos - DEFAULT_LEN_PREFIX_SIZE;
    const lenPrefixSize = varint32Size(len);
    if (lenPrefixSize > DEFAULT_LEN_PREFIX_SIZE) {
      this.ensureCapacity(lenPrefixSize - DEFAULT_LEN_PREFIX_SIZE);
      this.buffer.copyWithin(forkPos + lenPrefixSize, forkPos + DEFAULT_LEN_PREFIX_SIZE, this.pos);
    }
    this.pos = forkPos;
    this.uint32(len);
    this.pos += len;
    return this;
  }
  /**
   * Writes a tag (field number and wire type).
   *
   * Equivalent to `uint32( (fieldNo << 3 | type) >>> 0 )`.
   *
   * Generated code should compute the tag ahead of time and call `uint32()`.
   */
  tag(fieldNo, type) {
    return this.uint32((fieldNo << 3 | type) >>> 0);
  }
  /**
   * Write a chunk of raw bytes.
   */
  raw(chunk) {
    this.ensureCapacity(chunk.length);
    this.buffer.set(chunk, this.pos);
    this.pos += chunk.length;
    return this;
  }
  /**
   * Write a `uint32` value, an unsigned 32 bit varint.
   */
  uint32(value) {
    assertUInt32(value);
    this.ensureCapacity(5);
    if (value < 128) {
      this.buffer[this.pos++] = value;
      return this;
    }
    while (value > 127) {
      this.buffer[this.pos++] = value & 127 | 128;
      value >>>= 7;
    }
    this.buffer[this.pos++] = value;
    return this;
  }
  /**
   * Write a `int32` value, a signed 32 bit varint.
   */
  int32(value) {
    assertInt32(value);
    if (value >= 0) {
      return this.uint32(value);
    }
    this.ensureCapacity(10);
    for (let i = 0; i < 9; i++) {
      this.buffer[this.pos++] = value & 127 | 128;
      value >>= 7;
    }
    this.buffer[this.pos++] = 1;
    return this;
  }
  /**
   * Write a `bool` value, a varint.
   */
  bool(value) {
    this.ensureCapacity(1);
    this.buffer[this.pos++] = value ? 1 : 0;
    return this;
  }
  /**
   * Write a `bytes` value, length-delimited arbitrary data.
   */
  bytes(value) {
    this.uint32(value.byteLength);
    return this.raw(value);
  }
  /**
   * Write a `string` value, length-delimited data converted to UTF-8 text.
   */
  string(value) {
    if (typeof value !== "string") {
      value = String(value);
    }
    const len = value.length;
    if (len <= ASCII_MAX_LENGTH) {
      this.ensureCapacity(len + 1);
      const ascii = this.buffer;
      let pos = this.pos;
      ascii[pos++] = len;
      let i = 0;
      for (; i < len; i++) {
        const code = value.charCodeAt(i);
        if (code > 127)
          break;
        ascii[pos++] = code;
      }
      if (i == len) {
        this.pos = pos;
        return this;
      }
    }
    this.ensureCapacity(len * 3 + 5);
    const lenPrefixSizeGuess = varint32Size(len);
    const buf = this.buffer;
    const start = this.pos;
    const { written } = this.encodeUtf8Into(value, buf.subarray(start + lenPrefixSizeGuess));
    const lenPrefixSize = varint32Size(written);
    if (lenPrefixSize != lenPrefixSizeGuess) {
      buf.copyWithin(start + lenPrefixSize, start + lenPrefixSizeGuess, start + lenPrefixSizeGuess + written);
    }
    this.uint32(written);
    this.pos += written;
    return this;
  }
  /**
   * Write a `float` value, 32-bit floating point number.
   */
  float(value) {
    assertFloat32(value);
    this.ensureCapacity(4);
    this.view().setFloat32(this.pos, value, true);
    this.pos += 4;
    return this;
  }
  /**
   * Write a `double` value, a 64-bit floating point number.
   */
  double(value) {
    this.ensureCapacity(8);
    this.view().setFloat64(this.pos, value, true);
    this.pos += 8;
    return this;
  }
  /**
   * Write a `fixed32` value, an unsigned, fixed-length 32-bit integer.
   */
  fixed32(value) {
    assertUInt32(value);
    this.ensureCapacity(4);
    this.view().setUint32(this.pos, value, true);
    this.pos += 4;
    return this;
  }
  /**
   * Write a `sfixed32` value, a signed, fixed-length 32-bit integer.
   */
  sfixed32(value) {
    assertInt32(value);
    this.ensureCapacity(4);
    this.view().setInt32(this.pos, value, true);
    this.pos += 4;
    return this;
  }
  /**
   * Write a `sint32` value, a signed, zigzag-encoded 32-bit varint.
   */
  sint32(value) {
    assertInt32(value);
    return this.uint32((value << 1 ^ value >> 31) >>> 0);
  }
  /**
   * Write a `sfixed64` value, a signed, fixed-length 64-bit integer.
   */
  sfixed64(value) {
    const tc = protoInt64.enc(value);
    this.ensureCapacity(8);
    const view = this.view();
    view.setInt32(this.pos, tc.lo, true);
    view.setInt32(this.pos + 4, tc.hi, true);
    this.pos += 8;
    return this;
  }
  /**
   * Write a `fixed64` value, an unsigned, fixed-length 64 bit integer.
   */
  fixed64(value) {
    const tc = protoInt64.uEnc(value);
    this.ensureCapacity(8);
    const view = this.view();
    view.setInt32(this.pos, tc.lo, true);
    view.setInt32(this.pos + 4, tc.hi, true);
    this.pos += 8;
    return this;
  }
  /**
   * Write a `int64` value, a signed 64-bit varint.
   */
  int64(value) {
    const tc = protoInt64.enc(value);
    return this.writeVarint64(tc.lo, tc.hi);
  }
  /**
   * Write a `sint64` value, a signed, zig-zag-encoded 64-bit varint.
   */
  sint64(value) {
    const tc = protoInt64.enc(value), sign = tc.hi >> 31, lo = tc.lo << 1 ^ sign, hi = (tc.hi << 1 | tc.lo >>> 31) ^ sign;
    return this.writeVarint64(lo, hi);
  }
  /**
   * Write a `uint64` value, an unsigned 64-bit varint.
   */
  uint64(value) {
    const tc = protoInt64.uEnc(value);
    return this.writeVarint64(tc.lo, tc.hi);
  }
  /**
   * Write a 64-bit varint directly into the buffer. Accepts the value as
   * split low/high 32-bit words.
   *
   * Ported from varint64write() to avoid the intermediate number[] buffer.
   * See https://github.com/protocolbuffers/protobuf/blob/8a71927d74a4ce34efe2d8769fda198f52d20d12/js/experimental/runtime/kernel/writer.js#L344
   */
  writeVarint64(lo, hi) {
    this.ensureCapacity(10);
    const buf = this.buffer;
    let pos = this.pos;
    for (let i = 0; i < 28; i = i + 7) {
      const shift = lo >>> i;
      const hasNext = !(shift >>> 7 == 0 && hi == 0);
      buf[pos++] = (hasNext ? shift | 128 : shift) & 255;
      if (!hasNext) {
        this.pos = pos;
        return this;
      }
    }
    const splitBits = lo >>> 28 & 15 | (hi & 7) << 4;
    const hasMoreBits = !(hi >> 3 == 0);
    buf[pos++] = (hasMoreBits ? splitBits | 128 : splitBits) & 255;
    if (!hasMoreBits) {
      this.pos = pos;
      return this;
    }
    for (let i = 3; i < 31; i = i + 7) {
      const shift = hi >>> i;
      const hasNext = !(shift >>> 7 == 0);
      buf[pos++] = (hasNext ? shift | 128 : shift) & 255;
      if (!hasNext) {
        this.pos = pos;
        return this;
      }
    }
    buf[pos++] = hi >>> 31 & 1;
    this.pos = pos;
    return this;
  }
};
var INITIAL_SIZE = 128;
var DEFAULT_LEN_PREFIX_SIZE = 1;
var EMPTY_BUFFER = new Uint8Array(0);
var EMPTY_VIEW = new DataView(EMPTY_BUFFER.buffer);
var ASCII_MAX_LENGTH = 32;
function varint32Size(value) {
  if (value < 128)
    return 1;
  if (value < 16384)
    return 2;
  if (value < 2097152)
    return 3;
  if (value < 268435456)
    return 4;
  return 5;
}
__name(varint32Size, "varint32Size");
var BinaryReader = class {
  static {
    __name(this, "BinaryReader");
  }
  constructor(buf, decodeUtf8 = getTextEncoding().decodeUtf8) {
    this.decodeUtf8 = decodeUtf8;
    this.varint64Lo = 0;
    this.varint64Hi = 0;
    this.varint64 = varint64read;
    this.uint32 = varint32read;
    this.buf = buf;
    this.len = buf.length;
    this.pos = 0;
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  /**
   * Reads a tag - field number and wire type. Tags are uint32 varints; values
   * that do not fit in uint32 are rejected.
   */
  tag() {
    const start = this.pos;
    const tag = this.uint32();
    const bytesRead = this.pos - start;
    if (bytesRead > 5 || bytesRead == 5 && this.buf[this.pos - 1] > 15) {
      throw new Error("illegal tag: varint overflows uint32");
    }
    const fieldNo = tag >>> 3;
    const wireType = tag & 7;
    if (fieldNo <= 0 || wireType > 5) {
      throw new Error("illegal tag: field no " + fieldNo + " wire type " + wireType);
    }
    return [fieldNo, wireType];
  }
  /**
   * Skip one element and return the skipped data.
   *
   * When skipping StartGroup, provide the tags field number to check for
   * matching field number in the EndGroup tag. Recursion into nested groups
   * is guarded by the `recursionLimit` argument: When the limit is reached,
   * this method throws.
   */
  skip(wireType, fieldNo, recursionLimit = 100) {
    let start = this.pos;
    switch (wireType) {
      case WireType.Varint:
        while (this.buf[this.pos++] & 128) {
        }
        break;
      // @ts-ignore TS7029: Fallthrough case in switch -- ignore instead of expect-error for compiler settings without noFallthroughCasesInSwitch: true
      case WireType.Bit64:
        this.pos += 4;
      case WireType.Bit32:
        this.pos += 4;
        break;
      case WireType.LengthDelimited:
        let len = this.uint32();
        this.pos += len;
        break;
      case WireType.StartGroup:
        if (recursionLimit <= 0) {
          throw new Error("maximum recursion depth reached");
        }
        for (; ; ) {
          const [fn, wt] = this.tag();
          if (wt === WireType.EndGroup) {
            if (fieldNo !== void 0 && fn !== fieldNo) {
              throw new Error("invalid end group tag");
            }
            break;
          }
          this.skip(wt, fn, recursionLimit - 1);
        }
        break;
      default:
        throw new Error("cant skip wire type " + wireType);
    }
    this.assertBounds();
    return this.buf.subarray(start, this.pos);
  }
  /**
   * Throws error if position in byte array is out of range.
   */
  assertBounds() {
    if (this.pos > this.len)
      throw new RangeError("premature EOF");
  }
  /**
   * Read a `int32` field, a signed 32 bit varint.
   */
  int32() {
    return this.uint32() | 0;
  }
  /**
   * Read a `sint32` field, a signed, zigzag-encoded 32-bit varint.
   */
  sint32() {
    let zze = this.uint32();
    return zze >>> 1 ^ -(zze & 1);
  }
  /**
   * Read a `int64` field, a signed 64-bit varint.
   */
  int64() {
    this.varint64();
    return protoInt64.dec(this.varint64Lo, this.varint64Hi);
  }
  /**
   * Read a `uint64` field, an unsigned 64-bit varint.
   */
  uint64() {
    this.varint64();
    return protoInt64.uDec(this.varint64Lo, this.varint64Hi);
  }
  /**
   * Read a `sint64` field, a signed, zig-zag-encoded 64-bit varint.
   */
  sint64() {
    this.varint64();
    let lo = this.varint64Lo;
    let hi = this.varint64Hi;
    let s = -(lo & 1);
    lo = (lo >>> 1 | (hi & 1) << 31) ^ s;
    hi = hi >>> 1 ^ s;
    return protoInt64.dec(lo, hi);
  }
  /**
   * Read a `bool` field, a variant.
   */
  bool() {
    const b = this.buf[this.pos];
    if (b < 128) {
      this.pos++;
      return b !== 0;
    }
    this.varint64();
    return this.varint64Lo !== 0 || this.varint64Hi !== 0;
  }
  /**
   * Read a `fixed32` field, an unsigned, fixed-length 32-bit integer.
   */
  fixed32() {
    return this.view.getUint32((this.pos += 4) - 4, true);
  }
  /**
   * Read a `sfixed32` field, a signed, fixed-length 32-bit integer.
   */
  sfixed32() {
    return this.view.getInt32((this.pos += 4) - 4, true);
  }
  /**
   * Read a `fixed64` field, an unsigned, fixed-length 64 bit integer.
   */
  fixed64() {
    return protoInt64.uDec(this.sfixed32(), this.sfixed32());
  }
  /**
   * Read a `fixed64` field, a signed, fixed-length 64-bit integer.
   */
  sfixed64() {
    return protoInt64.dec(this.sfixed32(), this.sfixed32());
  }
  /**
   * Read a `float` field, 32-bit floating point number.
   */
  float() {
    return this.view.getFloat32((this.pos += 4) - 4, true);
  }
  /**
   * Read a `double` field, a 64-bit floating point number.
   */
  double() {
    return this.view.getFloat64((this.pos += 8) - 8, true);
  }
  /**
   * Read a `bytes` field, length-delimited arbitrary data.
   */
  bytes() {
    let len = this.uint32(), start = this.pos;
    this.pos += len;
    this.assertBounds();
    return this.buf.subarray(start, start + len);
  }
  /**
   * Read a `string` field, length-delimited data converted to UTF-8 text. If
   * `strict` is true, throw on invalid UTF-8 instead of substituting U+FFFD.
   */
  string(strict) {
    const bytes = this.bytes();
    const len = bytes.length;
    if (len <= ASCII_MAX_LENGTH) {
      const codes = new Array(len);
      for (let i = 0; i < len; i++) {
        const byte = bytes[i];
        if (byte > 127) {
          return this.decodeUtf8(bytes, strict);
        }
        codes[i] = byte;
      }
      return String.fromCharCode.apply(String, codes);
    }
    return this.decodeUtf8(bytes, strict);
  }
};
function assertInt32(arg) {
  if (typeof arg == "string") {
    arg = Number(arg);
  } else if (typeof arg != "number") {
    throw new Error("invalid int32: " + typeof arg);
  }
  if (!Number.isInteger(arg) || arg > INT32_MAX || arg < INT32_MIN)
    throw new Error("invalid int32: " + arg);
}
__name(assertInt32, "assertInt32");
function assertUInt32(arg) {
  if (typeof arg == "string") {
    arg = Number(arg);
  } else if (typeof arg != "number") {
    throw new Error("invalid uint32: " + typeof arg);
  }
  if (!Number.isInteger(arg) || arg > UINT32_MAX || arg < 0)
    throw new Error("invalid uint32: " + arg);
}
__name(assertUInt32, "assertUInt32");
function assertFloat32(arg) {
  if (typeof arg == "string") {
    const o = arg;
    arg = Number(arg);
    if (Number.isNaN(arg) && o !== "NaN") {
      throw new Error("invalid float32: " + o);
    }
  } else if (typeof arg != "number") {
    throw new Error("invalid float32: " + typeof arg);
  }
  if (!Number.isFinite(Math.fround(arg)) && Number.isFinite(arg)) {
    throw new Error("invalid float32: " + arg);
  }
}
__name(assertFloat32, "assertFloat32");

// ../node_modules/@bufbuild/protobuf/dist/esm/reflect/message.js
var NULL_VALUE = 0;
function localMessageMapper(field) {
  if (usesJsonRepresentation(field)) {
    return {
      toMessage: /* @__PURE__ */ __name((local) => wktStructToReflect(local), "toMessage"),
      toLocal: /* @__PURE__ */ __name((message) => wktStructToLocal(message), "toLocal")
    };
  }
  if (field.fieldKind == "message" && !field.oneof && isWrapperDesc(field.message)) {
    const wrapperDesc = field.message;
    const valueLocalName = wrapperDesc.fields[0].localName;
    return {
      toMessage: /* @__PURE__ */ __name((local) => {
        const message = create(wrapperDesc);
        if (local !== void 0) {
          message[valueLocalName] = local;
        }
        return message;
      }, "toMessage"),
      toLocal: /* @__PURE__ */ __name((message) => message[valueLocalName], "toLocal")
    };
  }
  const childDesc = field.message;
  return {
    toMessage: /* @__PURE__ */ __name((local) => local === void 0 ? create(childDesc) : local, "toMessage"),
    toLocal: /* @__PURE__ */ __name((message) => message, "toLocal")
  };
}
__name(localMessageMapper, "localMessageMapper");
function usesJsonRepresentation(field) {
  return field.message.typeName == "google.protobuf.Struct" && field.parent.typeName != "google.protobuf.Value";
}
__name(usesJsonRepresentation, "usesJsonRepresentation");
function wktStructToReflect(json) {
  const struct = {
    $typeName: "google.protobuf.Struct",
    fields: {}
  };
  if (isObject(json)) {
    for (const k of Object.keys(json)) {
      setOwn(struct.fields, k, wktValueToReflect(json[k]));
    }
  }
  return struct;
}
__name(wktStructToReflect, "wktStructToReflect");
function wktStructToLocal(val) {
  const json = {};
  for (const k of Object.keys(val.fields)) {
    setOwn(json, k, wktValueToLocal(val.fields[k]));
  }
  return json;
}
__name(wktStructToLocal, "wktStructToLocal");
function wktValueToLocal(val) {
  switch (val.kind.case) {
    case "structValue":
      return wktStructToLocal(val.kind.value);
    case "listValue":
      return val.kind.value.values.map(wktValueToLocal);
    case "nullValue":
    case void 0:
      return null;
    default:
      return val.kind.value;
  }
}
__name(wktValueToLocal, "wktValueToLocal");
function wktValueToReflect(json) {
  const value = {
    $typeName: "google.protobuf.Value",
    kind: { case: void 0 }
  };
  switch (typeof json) {
    case "number":
      value.kind = { case: "numberValue", value: json };
      break;
    case "string":
      value.kind = { case: "stringValue", value: json };
      break;
    case "boolean":
      value.kind = { case: "boolValue", value: json };
      break;
    case "object":
      if (json === null) {
        value.kind = { case: "nullValue", value: NULL_VALUE };
      } else if (Array.isArray(json)) {
        const listValue = {
          $typeName: "google.protobuf.ListValue",
          values: []
        };
        if (Array.isArray(json)) {
          for (const e of json) {
            listValue.values.push(wktValueToReflect(e));
          }
        }
        value.kind = {
          case: "listValue",
          value: listValue
        };
      } else {
        value.kind = {
          case: "structValue",
          value: wktStructToReflect(json)
        };
      }
      break;
  }
  return value;
}
__name(wktValueToReflect, "wktValueToReflect");

// ../node_modules/@bufbuild/protobuf/dist/esm/wire/base64-encoding.js
var nativeSetFromBase64 = Uint8Array.prototype.setFromBase64;
function base64Decode(base64Str) {
  const len = base64Str.length;
  let size = len - (len + 3 >> 2);
  if ((len & 3) == 0 && base64Str[len - 1] == "=") {
    size -= base64Str[len - 2] == "=" ? 2 : 1;
  }
  const bytes = new Uint8Array(size);
  let written = -1;
  if (nativeSetFromBase64) {
    try {
      const result = nativeSetFromBase64.call(bytes, base64Str);
      if (result.read == len) {
        written = result.written;
      }
    } catch (_a) {
    }
  }
  if (written < 0) {
    written = setFromBase64(bytes, base64Str);
  }
  return written == size ? bytes : bytes.subarray(0, written);
}
__name(base64Decode, "base64Decode");
function setFromBase64(bytes, base64Str) {
  const table = getDecodeTable();
  let bytePos = 0, groupPos = 0, b, p = 0;
  for (let i = 0; i < base64Str.length; i++) {
    b = table[base64Str.charCodeAt(i)];
    if (b === void 0) {
      switch (base64Str[i]) {
        // @ts-ignore TS7029: Fallthrough case in switch -- ignore instead of expect-error for compiler settings without noFallthroughCasesInSwitch: true
        case "=":
          groupPos = 0;
        // reset state when padding found
        case "\n":
        case "\r":
        case "	":
        case " ":
          continue;
        // skip white-space, and padding
        default:
          throw Error("invalid base64 string");
      }
    }
    switch (groupPos) {
      case 0:
        p = b;
        groupPos = 1;
        break;
      case 1:
        bytes[bytePos++] = p << 2 | (b & 48) >> 4;
        p = b;
        groupPos = 2;
        break;
      case 2:
        bytes[bytePos++] = (p & 15) << 4 | (b & 60) >> 2;
        p = b;
        groupPos = 3;
        break;
      case 3:
        bytes[bytePos++] = (p & 3) << 6 | b;
        groupPos = 0;
        break;
    }
  }
  if (groupPos == 1)
    throw Error("invalid base64 string");
  return bytePos;
}
__name(setFromBase64, "setFromBase64");
var nativeToBase64 = Uint8Array.prototype.toBase64;
var encodeTableStd;
var encodeTableUrl;
var decodeTable;
function getEncodeTable(encoding) {
  if (!encodeTableStd) {
    encodeTableStd = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split("");
    encodeTableUrl = encodeTableStd.slice(0, -2).concat("-", "_");
  }
  return encoding == "url" ? (
    // biome-ignore lint/style/noNonNullAssertion: TS fails to narrow down
    encodeTableUrl
  ) : encodeTableStd;
}
__name(getEncodeTable, "getEncodeTable");
function getDecodeTable() {
  if (!decodeTable) {
    decodeTable = [];
    const encodeTable = getEncodeTable("std");
    for (let i = 0; i < encodeTable.length; i++)
      decodeTable[encodeTable[i].charCodeAt(0)] = i;
    decodeTable["-".charCodeAt(0)] = encodeTable.indexOf("+");
    decodeTable["_".charCodeAt(0)] = encodeTable.indexOf("/");
  }
  return decodeTable;
}
__name(getDecodeTable, "getDecodeTable");

// ../node_modules/@bufbuild/protobuf/dist/esm/reflect/names.js
function protoCamelCase(snakeCase) {
  let capNext = false;
  const b = [];
  for (let i = 0; i < snakeCase.length; i++) {
    let c = snakeCase.charAt(i);
    switch (c) {
      case "_":
        capNext = true;
        break;
      case "0":
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
        b.push(c);
        capNext = false;
        break;
      default:
        if (capNext) {
          capNext = false;
          c = c.toUpperCase();
        }
        b.push(c);
        break;
    }
  }
  return b.join("");
}
__name(protoCamelCase, "protoCamelCase");
var reservedObjectProperties = /* @__PURE__ */ new Set([
  // names reserved by JavaScript
  "constructor",
  "toString",
  "toJSON",
  "valueOf"
]);
function safeObjectProperty(name) {
  return reservedObjectProperties.has(name) ? name + "$" : name;
}
__name(safeObjectProperty, "safeObjectProperty");

// ../node_modules/@bufbuild/protobuf/dist/esm/codegenv2/restore-json-names.js
function restoreJsonNames(message) {
  for (const f of message.field) {
    if (!unsafeIsSetExplicit(f, "jsonName")) {
      f.jsonName = protoCamelCase(f.name);
    }
  }
  message.nestedType.forEach(restoreJsonNames);
}
__name(restoreJsonNames, "restoreJsonNames");

// ../node_modules/@bufbuild/protobuf/dist/esm/wire/text-format.js
function parseTextFormatEnumValue(descEnum, value) {
  const enumValue = descEnum.values.find((v) => v.name === value);
  if (!enumValue) {
    throw new Error(`cannot parse ${descEnum} default value: ${value}`);
  }
  return enumValue.number;
}
__name(parseTextFormatEnumValue, "parseTextFormatEnumValue");
function parseTextFormatScalarValue(type, value) {
  switch (type) {
    case ScalarType.STRING:
      return value;
    case ScalarType.BYTES: {
      const u = unescapeBytesDefaultValue(value);
      if (u === false) {
        throw new Error(`cannot parse ${ScalarType[type]} default value: ${value}`);
      }
      return u;
    }
    case ScalarType.INT64:
    case ScalarType.SFIXED64:
    case ScalarType.SINT64:
      return protoInt64.parse(value);
    case ScalarType.UINT64:
    case ScalarType.FIXED64:
      return protoInt64.uParse(value);
    case ScalarType.DOUBLE:
    case ScalarType.FLOAT:
      switch (value) {
        case "inf":
          return Number.POSITIVE_INFINITY;
        case "-inf":
          return Number.NEGATIVE_INFINITY;
        case "nan":
          return Number.NaN;
        default:
          return parseFloat(value);
      }
    case ScalarType.BOOL:
      return value === "true";
    case ScalarType.INT32:
    case ScalarType.UINT32:
    case ScalarType.SINT32:
    case ScalarType.FIXED32:
    case ScalarType.SFIXED32:
      return parseInt(value, 10);
  }
}
__name(parseTextFormatScalarValue, "parseTextFormatScalarValue");
function unescapeBytesDefaultValue(str) {
  const b = [];
  const input = {
    tail: str,
    c: "",
    next() {
      if (this.tail.length == 0) {
        return false;
      }
      this.c = this.tail[0];
      this.tail = this.tail.substring(1);
      return true;
    },
    take(n) {
      if (this.tail.length >= n) {
        const r = this.tail.substring(0, n);
        this.tail = this.tail.substring(n);
        return r;
      }
      return false;
    }
  };
  while (input.next()) {
    switch (input.c) {
      case "\\":
        if (input.next()) {
          switch (input.c) {
            case "\\":
              b.push(input.c.charCodeAt(0));
              break;
            case "b":
              b.push(8);
              break;
            case "f":
              b.push(12);
              break;
            case "n":
              b.push(10);
              break;
            case "r":
              b.push(13);
              break;
            case "t":
              b.push(9);
              break;
            case "v":
              b.push(11);
              break;
            case "0":
            case "1":
            case "2":
            case "3":
            case "4":
            case "5":
            case "6":
            case "7": {
              const s = input.c;
              const t = input.take(2);
              if (t === false) {
                return false;
              }
              const n = parseInt(s + t, 8);
              if (Number.isNaN(n)) {
                return false;
              }
              b.push(n);
              break;
            }
            case "x": {
              const s = input.c;
              const t = input.take(2);
              if (t === false) {
                return false;
              }
              const n = parseInt(s + t, 16);
              if (Number.isNaN(n)) {
                return false;
              }
              b.push(n);
              break;
            }
            case "u": {
              const s = input.c;
              const t = input.take(4);
              if (t === false) {
                return false;
              }
              const n = parseInt(s + t, 16);
              if (Number.isNaN(n)) {
                return false;
              }
              const chunk = new Uint8Array(4);
              const view = new DataView(chunk.buffer);
              view.setInt32(0, n, true);
              b.push(chunk[0], chunk[1], chunk[2], chunk[3]);
              break;
            }
            case "U": {
              const s = input.c;
              const t = input.take(8);
              if (t === false) {
                return false;
              }
              const tc = protoInt64.uEnc(s + t);
              const chunk = new Uint8Array(8);
              const view = new DataView(chunk.buffer);
              view.setInt32(0, tc.lo, true);
              view.setInt32(4, tc.hi, true);
              b.push(chunk[0], chunk[1], chunk[2], chunk[3], chunk[4], chunk[5], chunk[6], chunk[7]);
              break;
            }
          }
        }
        break;
      default:
        b.push(input.c.charCodeAt(0));
    }
  }
  return new Uint8Array(b);
}
__name(unescapeBytesDefaultValue, "unescapeBytesDefaultValue");

// ../node_modules/@bufbuild/protobuf/dist/esm/reflect/nested-types.js
function* nestedTypes(desc) {
  switch (desc.kind) {
    case "file":
      for (const message of desc.messages) {
        yield message;
        yield* nestedTypes(message);
      }
      yield* desc.enums;
      yield* desc.services;
      yield* desc.extensions;
      break;
    case "message":
      for (const message of desc.nestedMessages) {
        yield message;
        yield* nestedTypes(message);
      }
      yield* desc.nestedEnums;
      yield* desc.nestedExtensions;
      break;
  }
}
__name(nestedTypes, "nestedTypes");

// ../node_modules/@bufbuild/protobuf/dist/esm/registry.js
function createFileRegistry(...args) {
  const registry = createBaseRegistry();
  if (!args.length) {
    return registry;
  }
  if ("$typeName" in args[0] && args[0].$typeName == "google.protobuf.FileDescriptorSet") {
    for (const file of args[0].file) {
      addFile(file, registry);
    }
    return registry;
  }
  if ("$typeName" in args[0]) {
    let recurseDeps = function(file) {
      const deps = [];
      for (const protoFileName of file.dependency) {
        if (registry.getFile(protoFileName) != void 0) {
          continue;
        }
        if (seen.has(protoFileName)) {
          continue;
        }
        const dep = resolve(protoFileName);
        if (!dep) {
          throw new Error(`Unable to resolve ${protoFileName}, imported by ${file.name}`);
        }
        if ("kind" in dep) {
          registry.addFile(dep, false, true);
        } else {
          seen.add(dep.name);
          deps.push(dep);
        }
      }
      return deps.concat(...deps.map(recurseDeps));
    };
    __name(recurseDeps, "recurseDeps");
    const input = args[0];
    const resolve = args[1];
    const seen = /* @__PURE__ */ new Set();
    for (const file of [input, ...recurseDeps(input)].reverse()) {
      addFile(file, registry);
    }
  } else {
    for (const fileReg of args) {
      for (const file of fileReg.files) {
        registry.addFile(file);
      }
    }
  }
  return registry;
}
__name(createFileRegistry, "createFileRegistry");
function createBaseRegistry() {
  const types = /* @__PURE__ */ new Map();
  const extendees = /* @__PURE__ */ new Map();
  const files = /* @__PURE__ */ new Map();
  return {
    kind: "registry",
    types,
    extendees,
    [Symbol.iterator]() {
      return types.values();
    },
    get files() {
      return files.values();
    },
    addFile(file, skipTypes, withDeps) {
      files.set(file.proto.name, file);
      if (!skipTypes) {
        for (const type of nestedTypes(file)) {
          this.add(type);
        }
      }
      if (withDeps) {
        for (const f of file.dependencies) {
          this.addFile(f, skipTypes, withDeps);
        }
      }
    },
    add(desc) {
      if (desc.kind == "extension") {
        let numberToExt = extendees.get(desc.extendee.typeName);
        if (!numberToExt) {
          extendees.set(
            desc.extendee.typeName,
            // biome-ignore lint/suspicious/noAssignInExpressions: no
            numberToExt = /* @__PURE__ */ new Map()
          );
        }
        numberToExt.set(desc.number, desc);
      }
      types.set(desc.typeName, desc);
    },
    get(typeName) {
      return types.get(typeName);
    },
    getFile(fileName) {
      return files.get(fileName);
    },
    getMessage(typeName) {
      const t = types.get(typeName);
      return (t === null || t === void 0 ? void 0 : t.kind) == "message" ? t : void 0;
    },
    getEnum(typeName) {
      const t = types.get(typeName);
      return (t === null || t === void 0 ? void 0 : t.kind) == "enum" ? t : void 0;
    },
    getExtension(typeName) {
      const t = types.get(typeName);
      return (t === null || t === void 0 ? void 0 : t.kind) == "extension" ? t : void 0;
    },
    getExtensionFor(extendee, no) {
      var _a;
      return (_a = extendees.get(extendee.typeName)) === null || _a === void 0 ? void 0 : _a.get(no);
    },
    getService(typeName) {
      const t = types.get(typeName);
      return (t === null || t === void 0 ? void 0 : t.kind) == "service" ? t : void 0;
    }
  };
}
__name(createBaseRegistry, "createBaseRegistry");
var EDITION_PROTO22 = 998;
var EDITION_PROTO32 = 999;
var EDITION_UNSTABLE = 9999;
var TYPE_STRING = 9;
var TYPE_GROUP = 10;
var TYPE_MESSAGE = 11;
var TYPE_BYTES = 12;
var TYPE_ENUM = 14;
var LABEL_REPEATED = 3;
var LABEL_REQUIRED = 2;
var JS_STRING = 1;
var IDEMPOTENCY_UNKNOWN = 0;
var EXPLICIT = 1;
var IMPLICIT2 = 2;
var LEGACY_REQUIRED = 3;
var PACKED = 1;
var DELIMITED = 2;
var OPEN = 1;
var VERIFY = 2;
var maximumEdition = 1002;
var featureDefaults = {
  // EDITION_PROTO2
  998: {
    fieldPresence: 1,
    // EXPLICIT,
    enumType: 2,
    // CLOSED,
    repeatedFieldEncoding: 2,
    // EXPANDED,
    utf8Validation: 3,
    // NONE,
    messageEncoding: 1,
    // LENGTH_PREFIXED,
    jsonFormat: 2,
    // LEGACY_BEST_EFFORT,
    enforceNamingStyle: 2,
    // STYLE_LEGACY,
    defaultSymbolVisibility: 1,
    // EXPORT_ALL,
    enforceProtoLimits: 1
    // LEGACY_NO_EXPLICIT_LIMITS,
  },
  // EDITION_PROTO3
  999: {
    fieldPresence: 2,
    // IMPLICIT,
    enumType: 1,
    // OPEN,
    repeatedFieldEncoding: 1,
    // PACKED,
    utf8Validation: 2,
    // VERIFY,
    messageEncoding: 1,
    // LENGTH_PREFIXED,
    jsonFormat: 1,
    // ALLOW,
    enforceNamingStyle: 2,
    // STYLE_LEGACY,
    defaultSymbolVisibility: 1,
    // EXPORT_ALL,
    enforceProtoLimits: 1
    // LEGACY_NO_EXPLICIT_LIMITS,
  },
  // EDITION_2023
  1e3: {
    fieldPresence: 1,
    // EXPLICIT,
    enumType: 1,
    // OPEN,
    repeatedFieldEncoding: 1,
    // PACKED,
    utf8Validation: 2,
    // VERIFY,
    messageEncoding: 1,
    // LENGTH_PREFIXED,
    jsonFormat: 1,
    // ALLOW,
    enforceNamingStyle: 2,
    // STYLE_LEGACY,
    defaultSymbolVisibility: 1,
    // EXPORT_ALL,
    enforceProtoLimits: 1
    // LEGACY_NO_EXPLICIT_LIMITS,
  },
  // EDITION_2024
  1001: {
    fieldPresence: 1,
    // EXPLICIT,
    enumType: 1,
    // OPEN,
    repeatedFieldEncoding: 1,
    // PACKED,
    utf8Validation: 2,
    // VERIFY,
    messageEncoding: 1,
    // LENGTH_PREFIXED,
    jsonFormat: 1,
    // ALLOW,
    enforceNamingStyle: 1,
    // STYLE2024,
    defaultSymbolVisibility: 2,
    // EXPORT_TOP_LEVEL,
    enforceProtoLimits: 1
    // LEGACY_NO_EXPLICIT_LIMITS,
  },
  // EDITION_2026
  1002: {
    fieldPresence: 1,
    // EXPLICIT,
    enumType: 1,
    // OPEN,
    repeatedFieldEncoding: 1,
    // PACKED,
    utf8Validation: 2,
    // VERIFY,
    messageEncoding: 1,
    // LENGTH_PREFIXED,
    jsonFormat: 1,
    // ALLOW,
    enforceNamingStyle: 3,
    // STYLE2026,
    defaultSymbolVisibility: 4,
    // STRICT,
    enforceProtoLimits: 2
    // PROTO_LIMITS2026,
  }
};
function addFile(proto, reg) {
  var _a, _b;
  const file = {
    kind: "file",
    proto,
    deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : false,
    edition: getFileEdition(proto),
    name: proto.name.replace(/\.proto$/, ""),
    dependencies: findFileDependencies(proto, reg),
    enums: [],
    messages: [],
    extensions: [],
    services: [],
    toString() {
      return `file ${proto.name}`;
    }
  };
  const mapEntriesStore = /* @__PURE__ */ new Map();
  const mapEntries = {
    get(typeName) {
      return mapEntriesStore.get(typeName);
    },
    add(desc) {
      var _a2;
      assert(((_a2 = desc.proto.options) === null || _a2 === void 0 ? void 0 : _a2.mapEntry) === true);
      mapEntriesStore.set(desc.typeName, desc);
    }
  };
  for (const enumProto of proto.enumType) {
    addEnum(enumProto, file, void 0, reg);
  }
  for (const messageProto of proto.messageType) {
    addMessage(messageProto, file, void 0, reg, mapEntries);
  }
  for (const serviceProto of proto.service) {
    addService(serviceProto, file, reg);
  }
  addExtensions(file, reg);
  for (const mapEntry of mapEntriesStore.values()) {
    addFields(mapEntry, reg, mapEntries);
  }
  for (const message of file.messages) {
    addFields(message, reg, mapEntries);
    addExtensions(message, reg);
  }
  reg.addFile(file, true);
}
__name(addFile, "addFile");
function addExtensions(desc, reg) {
  switch (desc.kind) {
    case "file":
      for (const proto of desc.proto.extension) {
        const ext = newField(proto, desc, reg);
        desc.extensions.push(ext);
        reg.add(ext);
      }
      break;
    case "message":
      for (const proto of desc.proto.extension) {
        const ext = newField(proto, desc, reg);
        desc.nestedExtensions.push(ext);
        reg.add(ext);
      }
      for (const message of desc.nestedMessages) {
        addExtensions(message, reg);
      }
      break;
  }
}
__name(addExtensions, "addExtensions");
function addFields(message, reg, mapEntries) {
  const allOneofs = message.proto.oneofDecl.map((proto) => newOneof(proto, message));
  const oneofsSeen = /* @__PURE__ */ new Set();
  for (const proto of message.proto.field) {
    const oneof = findOneof(proto, allOneofs);
    const field = newField(proto, message, reg, oneof, mapEntries);
    message.fields.push(field);
    message.field[field.localName] = field;
    if (oneof === void 0) {
      message.members.push(field);
    } else {
      oneof.fields.push(field);
      if (!oneofsSeen.has(oneof)) {
        oneofsSeen.add(oneof);
        message.members.push(oneof);
      }
    }
  }
  for (const oneof of allOneofs.filter((o) => oneofsSeen.has(o))) {
    message.oneofs.push(oneof);
  }
  for (const child of message.nestedMessages) {
    addFields(child, reg, mapEntries);
  }
}
__name(addFields, "addFields");
function addEnum(proto, file, parent, reg) {
  var _a, _b, _c, _d, _e, _f;
  const sharedPrefix = findEnumSharedPrefix(proto.name, proto.value);
  const desc = {
    kind: "enum",
    proto,
    deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : false,
    file,
    parent,
    open: true,
    name: proto.name,
    typeName: makeTypeName(proto, parent, file),
    value: {},
    values: [],
    sharedPrefix,
    toString() {
      return `enum ${this.typeName}`;
    }
  };
  desc.open = isEnumOpen(desc);
  reg.add(desc);
  for (const p of proto.value) {
    const name = p.name;
    desc.values.push(
      // biome-ignore lint/suspicious/noAssignInExpressions: no
      desc.value[p.number] = {
        kind: "enum_value",
        proto: p,
        deprecated: (_d = (_c = p.options) === null || _c === void 0 ? void 0 : _c.deprecated) !== null && _d !== void 0 ? _d : false,
        parent: desc,
        name,
        localName: safeObjectProperty(sharedPrefix == void 0 ? name : name.substring(sharedPrefix.length)),
        number: p.number,
        jsonName: (_e = findEnumValueJsonName(p)) !== null && _e !== void 0 ? _e : name,
        toString() {
          return `enum value ${desc.typeName}.${name}`;
        }
      }
    );
  }
  ((_f = parent === null || parent === void 0 ? void 0 : parent.nestedEnums) !== null && _f !== void 0 ? _f : file.enums).push(desc);
}
__name(addEnum, "addEnum");
function addMessage(proto, file, parent, reg, mapEntries) {
  var _a, _b, _c, _d;
  const desc = {
    kind: "message",
    proto,
    deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : false,
    file,
    parent,
    name: proto.name,
    typeName: makeTypeName(proto, parent, file),
    fields: [],
    field: {},
    oneofs: [],
    members: [],
    nestedEnums: [],
    nestedMessages: [],
    nestedExtensions: [],
    toString() {
      return `message ${this.typeName}`;
    }
  };
  if (((_c = proto.options) === null || _c === void 0 ? void 0 : _c.mapEntry) === true) {
    mapEntries.add(desc);
  } else {
    ((_d = parent === null || parent === void 0 ? void 0 : parent.nestedMessages) !== null && _d !== void 0 ? _d : file.messages).push(desc);
    reg.add(desc);
  }
  for (const enumProto of proto.enumType) {
    addEnum(enumProto, file, desc, reg);
  }
  for (const messageProto of proto.nestedType) {
    addMessage(messageProto, file, desc, reg, mapEntries);
  }
}
__name(addMessage, "addMessage");
function addService(proto, file, reg) {
  var _a, _b;
  const desc = {
    kind: "service",
    proto,
    deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : false,
    file,
    name: proto.name,
    typeName: makeTypeName(proto, void 0, file),
    methods: [],
    method: {},
    toString() {
      return `service ${this.typeName}`;
    }
  };
  file.services.push(desc);
  reg.add(desc);
  for (const methodProto of proto.method) {
    const method = newMethod(methodProto, desc, reg);
    desc.methods.push(method);
    desc.method[method.localName] = method;
  }
}
__name(addService, "addService");
function newMethod(proto, parent, reg) {
  var _a, _b, _c, _d;
  let methodKind;
  if (proto.clientStreaming && proto.serverStreaming) {
    methodKind = "bidi_streaming";
  } else if (proto.clientStreaming) {
    methodKind = "client_streaming";
  } else if (proto.serverStreaming) {
    methodKind = "server_streaming";
  } else {
    methodKind = "unary";
  }
  const input = reg.getMessage(trimLeadingDot(proto.inputType));
  const output = reg.getMessage(trimLeadingDot(proto.outputType));
  assert(input, `invalid MethodDescriptorProto: input_type ${proto.inputType} not found`);
  assert(output, `invalid MethodDescriptorProto: output_type ${proto.inputType} not found`);
  const name = proto.name;
  return {
    kind: "rpc",
    proto,
    deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : false,
    parent,
    name,
    localName: safeObjectProperty(name.length ? safeObjectProperty(name[0].toLowerCase() + name.substring(1)) : name),
    methodKind,
    input,
    output,
    idempotency: (_d = (_c = proto.options) === null || _c === void 0 ? void 0 : _c.idempotencyLevel) !== null && _d !== void 0 ? _d : IDEMPOTENCY_UNKNOWN,
    toString() {
      return `rpc ${parent.typeName}.${name}`;
    }
  };
}
__name(newMethod, "newMethod");
function newOneof(proto, parent) {
  return {
    kind: "oneof",
    proto,
    deprecated: false,
    parent,
    fields: [],
    name: proto.name,
    localName: safeObjectProperty(protoCamelCase(proto.name)),
    toString() {
      return `oneof ${parent.typeName}.${this.name}`;
    }
  };
}
__name(newOneof, "newOneof");
function newField(proto, parentOrFile, reg, oneof, mapEntries) {
  var _a, _b, _c;
  const isExtension = mapEntries === void 0;
  const field = {
    kind: "field",
    proto,
    deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : false,
    name: proto.name,
    number: proto.number,
    scalar: void 0,
    message: void 0,
    enum: void 0,
    presence: getFieldPresence(proto, oneof, isExtension, parentOrFile),
    utf8Validation: isUtf8Validated(proto, parentOrFile),
    listKind: void 0,
    mapKind: void 0,
    mapKey: void 0,
    delimitedEncoding: void 0,
    packed: void 0,
    longAsString: false,
    getDefaultValue: void 0
  };
  let toStr;
  if (isExtension) {
    const file = parentOrFile.kind == "file" ? parentOrFile : parentOrFile.file;
    const parent = parentOrFile.kind == "file" ? void 0 : parentOrFile;
    const typeName = makeTypeName(proto, parent, file);
    field.kind = "extension";
    field.file = file;
    field.parent = parent;
    field.oneof = void 0;
    field.typeName = typeName;
    field.jsonName = `[${typeName}]`;
    toStr = /* @__PURE__ */ __name(() => `extension ${typeName}`, "toStr");
    const extendee = reg.getMessage(trimLeadingDot(proto.extendee));
    assert(extendee, `invalid FieldDescriptorProto: extendee ${proto.extendee} not found`);
    field.extendee = extendee;
  } else {
    const parent = parentOrFile;
    assert(parent.kind == "message");
    field.parent = parent;
    field.oneof = oneof;
    field.localName = oneof ? protoCamelCase(proto.name) : safeObjectProperty(protoCamelCase(proto.name));
    field.jsonName = proto.jsonName;
    toStr = /* @__PURE__ */ __name(() => `field ${parent.typeName}.${proto.name}`, "toStr");
  }
  Object.defineProperty(field, "toString", {
    value: toStr,
    writable: true,
    enumerable: true,
    configurable: true
  });
  const label = proto.label;
  const type = proto.type;
  const jstype = (_c = proto.options) === null || _c === void 0 ? void 0 : _c.jstype;
  if (label === LABEL_REPEATED) {
    const mapEntry = type == TYPE_MESSAGE ? mapEntries === null || mapEntries === void 0 ? void 0 : mapEntries.get(trimLeadingDot(proto.typeName)) : void 0;
    if (mapEntry) {
      field.fieldKind = "map";
      const { key, value } = findMapEntryFields(mapEntry);
      field.mapKey = key.scalar;
      field.mapKind = value.fieldKind;
      field.message = value.message;
      field.delimitedEncoding = false;
      field.enum = value.enum;
      field.scalar = value.scalar;
      return field;
    }
    field.fieldKind = "list";
    switch (type) {
      case TYPE_MESSAGE:
      case TYPE_GROUP:
        field.listKind = "message";
        field.message = reg.getMessage(trimLeadingDot(proto.typeName));
        assert(field.message);
        field.delimitedEncoding = isDelimitedEncoding(proto, parentOrFile);
        break;
      case TYPE_ENUM:
        field.listKind = "enum";
        field.enum = reg.getEnum(trimLeadingDot(proto.typeName));
        assert(field.enum);
        break;
      default:
        field.listKind = "scalar";
        field.scalar = type;
        field.longAsString = jstype == JS_STRING;
        break;
    }
    field.packed = isPackedField(proto, parentOrFile);
    return field;
  }
  switch (type) {
    case TYPE_MESSAGE:
    case TYPE_GROUP:
      field.fieldKind = "message";
      field.message = reg.getMessage(trimLeadingDot(proto.typeName));
      assert(field.message, `invalid FieldDescriptorProto: type_name ${proto.typeName} not found`);
      field.delimitedEncoding = isDelimitedEncoding(proto, parentOrFile);
      field.getDefaultValue = () => void 0;
      break;
    case TYPE_ENUM: {
      const enumeration = reg.getEnum(trimLeadingDot(proto.typeName));
      assert(enumeration !== void 0, `invalid FieldDescriptorProto: type_name ${proto.typeName} not found`);
      field.fieldKind = "enum";
      field.enum = reg.getEnum(trimLeadingDot(proto.typeName));
      field.getDefaultValue = () => {
        return unsafeIsSetExplicit(proto, "defaultValue") ? parseTextFormatEnumValue(enumeration, proto.defaultValue) : void 0;
      };
      break;
    }
    default: {
      field.fieldKind = "scalar";
      field.scalar = type;
      field.longAsString = jstype == JS_STRING;
      field.getDefaultValue = () => {
        return unsafeIsSetExplicit(proto, "defaultValue") ? parseTextFormatScalarValue(type, proto.defaultValue) : void 0;
      };
      break;
    }
  }
  return field;
}
__name(newField, "newField");
function getFileEdition(proto) {
  switch (proto.syntax) {
    case "":
    case "proto2":
      return EDITION_PROTO22;
    case "proto3":
      return EDITION_PROTO32;
    case "editions":
      if (proto.edition === EDITION_UNSTABLE) {
        return maximumEdition;
      }
      if (proto.edition in featureDefaults) {
        return proto.edition;
      }
      throw new Error(`${proto.name}: unsupported edition`);
    default:
      throw new Error(`${proto.name}: unsupported syntax "${proto.syntax}"`);
  }
}
__name(getFileEdition, "getFileEdition");
function findFileDependencies(proto, reg) {
  return proto.dependency.map((wantName) => {
    const dep = reg.getFile(wantName);
    if (!dep) {
      throw new Error(`Cannot find ${wantName}, imported by ${proto.name}`);
    }
    return dep;
  });
}
__name(findFileDependencies, "findFileDependencies");
function findEnumSharedPrefix(enumName, values) {
  const prefix = camelToSnakeCase(enumName) + "_";
  for (const value of values) {
    if (!value.name.toLowerCase().startsWith(prefix)) {
      return void 0;
    }
    const shortName = value.name.substring(prefix.length);
    if (shortName.length == 0) {
      return void 0;
    }
    if (/^\d/.test(shortName)) {
      return void 0;
    }
  }
  return prefix;
}
__name(findEnumSharedPrefix, "findEnumSharedPrefix");
function findEnumValueJsonName(proto) {
  var _a, _b;
  const extensionNumber = 998;
  const fieldNumber = 1;
  let jsonName;
  for (const uf of (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.$unknown) !== null && _b !== void 0 ? _b : []) {
    if (uf.no !== extensionNumber || uf.wireType !== WireType.LengthDelimited) {
      continue;
    }
    const reader = new BinaryReader(new BinaryReader(uf.data).bytes());
    while (reader.pos < reader.len) {
      const [no, wireType] = reader.tag();
      if (no === fieldNumber && wireType === WireType.LengthDelimited) {
        jsonName = reader.string();
      } else {
        reader.skip(wireType, no);
      }
    }
  }
  return jsonName;
}
__name(findEnumValueJsonName, "findEnumValueJsonName");
function camelToSnakeCase(camel) {
  return (camel.substring(0, 1) + camel.substring(1).replace(/[A-Z]/g, (c) => "_" + c)).toLowerCase();
}
__name(camelToSnakeCase, "camelToSnakeCase");
function makeTypeName(proto, parent, file) {
  let typeName;
  if (parent) {
    typeName = `${parent.typeName}.${proto.name}`;
  } else if (file.proto.package.length > 0) {
    typeName = `${file.proto.package}.${proto.name}`;
  } else {
    typeName = `${proto.name}`;
  }
  return typeName;
}
__name(makeTypeName, "makeTypeName");
function trimLeadingDot(typeName) {
  return typeName.startsWith(".") ? typeName.substring(1) : typeName;
}
__name(trimLeadingDot, "trimLeadingDot");
function findOneof(proto, allOneofs) {
  if (!unsafeIsSetExplicit(proto, "oneofIndex")) {
    return void 0;
  }
  if (proto.proto3Optional) {
    return void 0;
  }
  const oneof = allOneofs[proto.oneofIndex];
  assert(oneof, `invalid FieldDescriptorProto: oneof #${proto.oneofIndex} for field #${proto.number} not found`);
  return oneof;
}
__name(findOneof, "findOneof");
function getFieldPresence(proto, oneof, isExtension, parent) {
  if (proto.label == LABEL_REQUIRED) {
    return LEGACY_REQUIRED;
  }
  if (proto.label == LABEL_REPEATED) {
    return IMPLICIT2;
  }
  if (!!oneof || proto.proto3Optional) {
    return EXPLICIT;
  }
  if (isExtension) {
    return EXPLICIT;
  }
  const resolved = resolveFeature("fieldPresence", { proto, parent });
  if (resolved == IMPLICIT2 && (proto.type == TYPE_MESSAGE || proto.type == TYPE_GROUP)) {
    return EXPLICIT;
  }
  return resolved;
}
__name(getFieldPresence, "getFieldPresence");
function isPackedField(proto, parent) {
  if (proto.label != LABEL_REPEATED) {
    return false;
  }
  switch (proto.type) {
    case TYPE_STRING:
    case TYPE_BYTES:
    case TYPE_GROUP:
    case TYPE_MESSAGE:
      return false;
  }
  const o = proto.options;
  if (o && unsafeIsSetExplicit(o, "packed")) {
    return o.packed;
  }
  return PACKED == resolveFeature("repeatedFieldEncoding", {
    proto,
    parent
  });
}
__name(isPackedField, "isPackedField");
function findMapEntryFields(mapEntry) {
  const key = mapEntry.fields.find((f) => f.number === 1);
  const value = mapEntry.fields.find((f) => f.number === 2);
  assert(key && key.fieldKind == "scalar" && key.scalar != ScalarType.BYTES && key.scalar != ScalarType.FLOAT && key.scalar != ScalarType.DOUBLE && value && value.fieldKind != "list" && value.fieldKind != "map");
  return { key, value };
}
__name(findMapEntryFields, "findMapEntryFields");
function isEnumOpen(desc) {
  var _a;
  return OPEN == resolveFeature("enumType", {
    proto: desc.proto,
    parent: (_a = desc.parent) !== null && _a !== void 0 ? _a : desc.file
  });
}
__name(isEnumOpen, "isEnumOpen");
function isDelimitedEncoding(proto, parent) {
  if (proto.type == TYPE_GROUP) {
    return true;
  }
  return DELIMITED == resolveFeature("messageEncoding", {
    proto,
    parent
  });
}
__name(isDelimitedEncoding, "isDelimitedEncoding");
function isUtf8Validated(proto, parent) {
  return VERIFY == resolveFeature("utf8Validation", {
    proto,
    parent
  });
}
__name(isUtf8Validated, "isUtf8Validated");
function resolveFeature(name, ref) {
  var _a, _b;
  const featureSet = (_a = ref.proto.options) === null || _a === void 0 ? void 0 : _a.features;
  if (featureSet) {
    const val = featureSet[name];
    if (val != 0) {
      return val;
    }
  }
  if ("kind" in ref) {
    if (ref.kind == "message") {
      return resolveFeature(name, (_b = ref.parent) !== null && _b !== void 0 ? _b : ref.file);
    }
    const editionDefaults = featureDefaults[ref.edition];
    if (!editionDefaults) {
      throw new Error(`feature default for edition ${ref.edition} not found`);
    }
    return editionDefaults[name];
  }
  return resolveFeature(name, ref.parent);
}
__name(resolveFeature, "resolveFeature");
function assert(condition, msg) {
  if (!condition) {
    throw new Error(msg);
  }
}
__name(assert, "assert");

// ../node_modules/@bufbuild/protobuf/dist/esm/codegenv2/boot.js
function boot(boot2) {
  const root = bootFileDescriptorProto(boot2);
  root.messageType.forEach(restoreJsonNames);
  const reg = createFileRegistry(root, () => void 0);
  return reg.getFile(root.name);
}
__name(boot, "boot");
function bootFileDescriptorProto(init) {
  const proto = /* @__PURE__ */ Object.create({
    syntax: "",
    edition: 0
  });
  return Object.assign(proto, Object.assign(Object.assign({ $typeName: "google.protobuf.FileDescriptorProto", dependency: [], publicDependency: [], weakDependency: [], optionDependency: [], service: [], extension: [] }, init), { messageType: init.messageType.map(bootDescriptorProto), enumType: init.enumType.map(bootEnumDescriptorProto) }));
}
__name(bootFileDescriptorProto, "bootFileDescriptorProto");
function bootDescriptorProto(init) {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  const proto = /* @__PURE__ */ Object.create({
    visibility: 0
  });
  return Object.assign(proto, {
    $typeName: "google.protobuf.DescriptorProto",
    name: init.name,
    field: (_b = (_a = init.field) === null || _a === void 0 ? void 0 : _a.map(bootFieldDescriptorProto)) !== null && _b !== void 0 ? _b : [],
    extension: [],
    nestedType: (_d = (_c = init.nestedType) === null || _c === void 0 ? void 0 : _c.map(bootDescriptorProto)) !== null && _d !== void 0 ? _d : [],
    enumType: (_f = (_e = init.enumType) === null || _e === void 0 ? void 0 : _e.map(bootEnumDescriptorProto)) !== null && _f !== void 0 ? _f : [],
    extensionRange: (_h = (_g = init.extensionRange) === null || _g === void 0 ? void 0 : _g.map((e) => Object.assign({ $typeName: "google.protobuf.DescriptorProto.ExtensionRange" }, e))) !== null && _h !== void 0 ? _h : [],
    oneofDecl: [],
    reservedRange: [],
    reservedName: []
  });
}
__name(bootDescriptorProto, "bootDescriptorProto");
function bootFieldDescriptorProto(init) {
  const proto = /* @__PURE__ */ Object.create({
    label: 1,
    typeName: "",
    extendee: "",
    defaultValue: "",
    oneofIndex: 0,
    jsonName: "",
    proto3Optional: false
  });
  return Object.assign(proto, Object.assign(Object.assign({ $typeName: "google.protobuf.FieldDescriptorProto" }, init), { options: init.options ? bootFieldOptions(init.options) : void 0 }));
}
__name(bootFieldDescriptorProto, "bootFieldDescriptorProto");
function bootFieldOptions(init) {
  var _a, _b, _c;
  const proto = /* @__PURE__ */ Object.create({
    ctype: 0,
    packed: false,
    jstype: 0,
    lazy: false,
    unverifiedLazy: false,
    deprecated: false,
    weak: false,
    debugRedact: false,
    retention: 0
  });
  return Object.assign(proto, Object.assign(Object.assign({ $typeName: "google.protobuf.FieldOptions" }, init), { targets: (_a = init.targets) !== null && _a !== void 0 ? _a : [], editionDefaults: (_c = (_b = init.editionDefaults) === null || _b === void 0 ? void 0 : _b.map((e) => Object.assign({ $typeName: "google.protobuf.FieldOptions.EditionDefault" }, e))) !== null && _c !== void 0 ? _c : [], uninterpretedOption: [] }));
}
__name(bootFieldOptions, "bootFieldOptions");
function bootEnumDescriptorProto(init) {
  const proto = /* @__PURE__ */ Object.create({
    visibility: 0
  });
  return Object.assign(proto, {
    $typeName: "google.protobuf.EnumDescriptorProto",
    name: init.name,
    reservedName: [],
    reservedRange: [],
    value: init.value.map((e) => Object.assign({ $typeName: "google.protobuf.EnumValueDescriptorProto" }, e))
  });
}
__name(bootEnumDescriptorProto, "bootEnumDescriptorProto");

// ../node_modules/@bufbuild/protobuf/dist/esm/codegenv2/message.js
function messageDesc(file, path, ...paths) {
  return paths.reduce((acc, cur) => acc.nestedMessages[cur], file.messages[path]);
}
__name(messageDesc, "messageDesc");

// ../node_modules/@bufbuild/protobuf/dist/esm/wkt/google/protobuf/descriptor_pb.js
var file_google_protobuf_descriptor = /* @__PURE__ */ boot({ "name": "google/protobuf/descriptor.proto", "package": "google.protobuf", "messageType": [{ "name": "FileDescriptorSet", "field": [{ "name": "file", "number": 1, "type": 11, "label": 3, "typeName": ".google.protobuf.FileDescriptorProto" }], "extensionRange": [{ "start": 536e6, "end": 536000001 }] }, { "name": "FileDescriptorProto", "field": [{ "name": "name", "number": 1, "type": 9, "label": 1 }, { "name": "package", "number": 2, "type": 9, "label": 1 }, { "name": "dependency", "number": 3, "type": 9, "label": 3 }, { "name": "public_dependency", "number": 10, "type": 5, "label": 3 }, { "name": "weak_dependency", "number": 11, "type": 5, "label": 3 }, { "name": "option_dependency", "number": 15, "type": 9, "label": 3 }, { "name": "message_type", "number": 4, "type": 11, "label": 3, "typeName": ".google.protobuf.DescriptorProto" }, { "name": "enum_type", "number": 5, "type": 11, "label": 3, "typeName": ".google.protobuf.EnumDescriptorProto" }, { "name": "service", "number": 6, "type": 11, "label": 3, "typeName": ".google.protobuf.ServiceDescriptorProto" }, { "name": "extension", "number": 7, "type": 11, "label": 3, "typeName": ".google.protobuf.FieldDescriptorProto" }, { "name": "options", "number": 8, "type": 11, "label": 1, "typeName": ".google.protobuf.FileOptions" }, { "name": "source_code_info", "number": 9, "type": 11, "label": 1, "typeName": ".google.protobuf.SourceCodeInfo" }, { "name": "syntax", "number": 12, "type": 9, "label": 1 }, { "name": "edition", "number": 14, "type": 14, "label": 1, "typeName": ".google.protobuf.Edition" }] }, { "name": "DescriptorProto", "field": [{ "name": "name", "number": 1, "type": 9, "label": 1 }, { "name": "field", "number": 2, "type": 11, "label": 3, "typeName": ".google.protobuf.FieldDescriptorProto" }, { "name": "extension", "number": 6, "type": 11, "label": 3, "typeName": ".google.protobuf.FieldDescriptorProto" }, { "name": "nested_type", "number": 3, "type": 11, "label": 3, "typeName": ".google.protobuf.DescriptorProto" }, { "name": "enum_type", "number": 4, "type": 11, "label": 3, "typeName": ".google.protobuf.EnumDescriptorProto" }, { "name": "extension_range", "number": 5, "type": 11, "label": 3, "typeName": ".google.protobuf.DescriptorProto.ExtensionRange" }, { "name": "oneof_decl", "number": 8, "type": 11, "label": 3, "typeName": ".google.protobuf.OneofDescriptorProto" }, { "name": "options", "number": 7, "type": 11, "label": 1, "typeName": ".google.protobuf.MessageOptions" }, { "name": "reserved_range", "number": 9, "type": 11, "label": 3, "typeName": ".google.protobuf.DescriptorProto.ReservedRange" }, { "name": "reserved_name", "number": 10, "type": 9, "label": 3 }, { "name": "visibility", "number": 11, "type": 14, "label": 1, "typeName": ".google.protobuf.SymbolVisibility" }], "nestedType": [{ "name": "ExtensionRange", "field": [{ "name": "start", "number": 1, "type": 5, "label": 1 }, { "name": "end", "number": 2, "type": 5, "label": 1 }, { "name": "options", "number": 3, "type": 11, "label": 1, "typeName": ".google.protobuf.ExtensionRangeOptions" }] }, { "name": "ReservedRange", "field": [{ "name": "start", "number": 1, "type": 5, "label": 1 }, { "name": "end", "number": 2, "type": 5, "label": 1 }] }] }, { "name": "ExtensionRangeOptions", "field": [{ "name": "uninterpreted_option", "number": 999, "type": 11, "label": 3, "typeName": ".google.protobuf.UninterpretedOption" }, { "name": "declaration", "number": 2, "type": 11, "label": 3, "typeName": ".google.protobuf.ExtensionRangeOptions.Declaration", "options": { "retention": 2 } }, { "name": "features", "number": 50, "type": 11, "label": 1, "typeName": ".google.protobuf.FeatureSet" }, { "name": "verification", "number": 3, "type": 14, "label": 1, "typeName": ".google.protobuf.ExtensionRangeOptions.VerificationState", "defaultValue": "UNVERIFIED", "options": { "retention": 2 } }], "nestedType": [{ "name": "Declaration", "field": [{ "name": "number", "number": 1, "type": 5, "label": 1 }, { "name": "full_name", "number": 2, "type": 9, "label": 1 }, { "name": "type", "number": 3, "type": 9, "label": 1 }, { "name": "reserved", "number": 5, "type": 8, "label": 1 }, { "name": "repeated", "number": 6, "type": 8, "label": 1 }] }], "enumType": [{ "name": "VerificationState", "value": [{ "name": "DECLARATION", "number": 0 }, { "name": "UNVERIFIED", "number": 1 }] }], "extensionRange": [{ "start": 990, "end": 999 }, { "start": 1e3, "end": 536870912 }] }, { "name": "FieldDescriptorProto", "field": [{ "name": "name", "number": 1, "type": 9, "label": 1 }, { "name": "number", "number": 3, "type": 5, "label": 1 }, { "name": "label", "number": 4, "type": 14, "label": 1, "typeName": ".google.protobuf.FieldDescriptorProto.Label" }, { "name": "type", "number": 5, "type": 14, "label": 1, "typeName": ".google.protobuf.FieldDescriptorProto.Type" }, { "name": "type_name", "number": 6, "type": 9, "label": 1 }, { "name": "extendee", "number": 2, "type": 9, "label": 1 }, { "name": "default_value", "number": 7, "type": 9, "label": 1 }, { "name": "oneof_index", "number": 9, "type": 5, "label": 1 }, { "name": "json_name", "number": 10, "type": 9, "label": 1 }, { "name": "options", "number": 8, "type": 11, "label": 1, "typeName": ".google.protobuf.FieldOptions" }, { "name": "proto3_optional", "number": 17, "type": 8, "label": 1 }], "enumType": [{ "name": "Type", "value": [{ "name": "TYPE_DOUBLE", "number": 1 }, { "name": "TYPE_FLOAT", "number": 2 }, { "name": "TYPE_INT64", "number": 3 }, { "name": "TYPE_UINT64", "number": 4 }, { "name": "TYPE_INT32", "number": 5 }, { "name": "TYPE_FIXED64", "number": 6 }, { "name": "TYPE_FIXED32", "number": 7 }, { "name": "TYPE_BOOL", "number": 8 }, { "name": "TYPE_STRING", "number": 9 }, { "name": "TYPE_GROUP", "number": 10 }, { "name": "TYPE_MESSAGE", "number": 11 }, { "name": "TYPE_BYTES", "number": 12 }, { "name": "TYPE_UINT32", "number": 13 }, { "name": "TYPE_ENUM", "number": 14 }, { "name": "TYPE_SFIXED32", "number": 15 }, { "name": "TYPE_SFIXED64", "number": 16 }, { "name": "TYPE_SINT32", "number": 17 }, { "name": "TYPE_SINT64", "number": 18 }] }, { "name": "Label", "value": [{ "name": "LABEL_OPTIONAL", "number": 1 }, { "name": "LABEL_REPEATED", "number": 3 }, { "name": "LABEL_REQUIRED", "number": 2 }] }] }, { "name": "OneofDescriptorProto", "field": [{ "name": "name", "number": 1, "type": 9, "label": 1 }, { "name": "options", "number": 2, "type": 11, "label": 1, "typeName": ".google.protobuf.OneofOptions" }] }, { "name": "EnumDescriptorProto", "field": [{ "name": "name", "number": 1, "type": 9, "label": 1 }, { "name": "value", "number": 2, "type": 11, "label": 3, "typeName": ".google.protobuf.EnumValueDescriptorProto" }, { "name": "options", "number": 3, "type": 11, "label": 1, "typeName": ".google.protobuf.EnumOptions" }, { "name": "reserved_range", "number": 4, "type": 11, "label": 3, "typeName": ".google.protobuf.EnumDescriptorProto.EnumReservedRange" }, { "name": "reserved_name", "number": 5, "type": 9, "label": 3 }, { "name": "visibility", "number": 6, "type": 14, "label": 1, "typeName": ".google.protobuf.SymbolVisibility" }], "nestedType": [{ "name": "EnumReservedRange", "field": [{ "name": "start", "number": 1, "type": 5, "label": 1 }, { "name": "end", "number": 2, "type": 5, "label": 1 }] }] }, { "name": "EnumValueDescriptorProto", "field": [{ "name": "name", "number": 1, "type": 9, "label": 1 }, { "name": "number", "number": 2, "type": 5, "label": 1 }, { "name": "options", "number": 3, "type": 11, "label": 1, "typeName": ".google.protobuf.EnumValueOptions" }] }, { "name": "ServiceDescriptorProto", "field": [{ "name": "name", "number": 1, "type": 9, "label": 1 }, { "name": "method", "number": 2, "type": 11, "label": 3, "typeName": ".google.protobuf.MethodDescriptorProto" }, { "name": "options", "number": 3, "type": 11, "label": 1, "typeName": ".google.protobuf.ServiceOptions" }] }, { "name": "MethodDescriptorProto", "field": [{ "name": "name", "number": 1, "type": 9, "label": 1 }, { "name": "input_type", "number": 2, "type": 9, "label": 1 }, { "name": "output_type", "number": 3, "type": 9, "label": 1 }, { "name": "options", "number": 4, "type": 11, "label": 1, "typeName": ".google.protobuf.MethodOptions" }, { "name": "client_streaming", "number": 5, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "server_streaming", "number": 6, "type": 8, "label": 1, "defaultValue": "false" }] }, { "name": "FileOptions", "field": [{ "name": "java_package", "number": 1, "type": 9, "label": 1 }, { "name": "java_outer_classname", "number": 8, "type": 9, "label": 1 }, { "name": "java_multiple_files", "number": 10, "type": 8, "label": 1, "defaultValue": "false", "options": {} }, { "name": "java_generate_equals_and_hash", "number": 20, "type": 8, "label": 1, "options": { "deprecated": true } }, { "name": "java_string_check_utf8", "number": 27, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "optimize_for", "number": 9, "type": 14, "label": 1, "typeName": ".google.protobuf.FileOptions.OptimizeMode", "defaultValue": "SPEED" }, { "name": "go_package", "number": 11, "type": 9, "label": 1 }, { "name": "cc_generic_services", "number": 16, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "java_generic_services", "number": 17, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "py_generic_services", "number": 18, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "deprecated", "number": 23, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "cc_enable_arenas", "number": 31, "type": 8, "label": 1, "defaultValue": "true", "options": {} }, { "name": "objc_class_prefix", "number": 36, "type": 9, "label": 1 }, { "name": "csharp_namespace", "number": 37, "type": 9, "label": 1 }, { "name": "swift_prefix", "number": 39, "type": 9, "label": 1 }, { "name": "php_class_prefix", "number": 40, "type": 9, "label": 1 }, { "name": "php_namespace", "number": 41, "type": 9, "label": 1 }, { "name": "php_metadata_namespace", "number": 44, "type": 9, "label": 1 }, { "name": "ruby_package", "number": 45, "type": 9, "label": 1 }, { "name": "features", "number": 50, "type": 11, "label": 1, "typeName": ".google.protobuf.FeatureSet" }, { "name": "uninterpreted_option", "number": 999, "type": 11, "label": 3, "typeName": ".google.protobuf.UninterpretedOption" }], "enumType": [{ "name": "OptimizeMode", "value": [{ "name": "SPEED", "number": 1 }, { "name": "CODE_SIZE", "number": 2 }, { "name": "LITE_RUNTIME", "number": 3 }] }], "extensionRange": [{ "start": 990, "end": 999 }, { "start": 1e3, "end": 536870912 }] }, { "name": "MessageOptions", "field": [{ "name": "message_set_wire_format", "number": 1, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "no_standard_descriptor_accessor", "number": 2, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "deprecated", "number": 3, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "map_entry", "number": 7, "type": 8, "label": 1 }, { "name": "deprecated_legacy_json_field_conflicts", "number": 11, "type": 8, "label": 1, "options": { "deprecated": true } }, { "name": "features", "number": 12, "type": 11, "label": 1, "typeName": ".google.protobuf.FeatureSet" }, { "name": "uninterpreted_option", "number": 999, "type": 11, "label": 3, "typeName": ".google.protobuf.UninterpretedOption" }], "extensionRange": [{ "start": 990, "end": 999 }, { "start": 1e3, "end": 536870912 }] }, { "name": "FieldOptions", "field": [{ "name": "ctype", "number": 1, "type": 14, "label": 1, "typeName": ".google.protobuf.FieldOptions.CType", "defaultValue": "STRING" }, { "name": "packed", "number": 2, "type": 8, "label": 1 }, { "name": "jstype", "number": 6, "type": 14, "label": 1, "typeName": ".google.protobuf.FieldOptions.JSType", "defaultValue": "JS_NORMAL" }, { "name": "lazy", "number": 5, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "unverified_lazy", "number": 15, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "deprecated", "number": 3, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "weak", "number": 10, "type": 8, "label": 1, "defaultValue": "false", "options": { "deprecated": true } }, { "name": "debug_redact", "number": 16, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "retention", "number": 17, "type": 14, "label": 1, "typeName": ".google.protobuf.FieldOptions.OptionRetention" }, { "name": "targets", "number": 19, "type": 14, "label": 3, "typeName": ".google.protobuf.FieldOptions.OptionTargetType" }, { "name": "edition_defaults", "number": 20, "type": 11, "label": 3, "typeName": ".google.protobuf.FieldOptions.EditionDefault" }, { "name": "features", "number": 21, "type": 11, "label": 1, "typeName": ".google.protobuf.FeatureSet" }, { "name": "feature_support", "number": 22, "type": 11, "label": 1, "typeName": ".google.protobuf.FieldOptions.FeatureSupport" }, { "name": "uninterpreted_option", "number": 999, "type": 11, "label": 3, "typeName": ".google.protobuf.UninterpretedOption" }], "nestedType": [{ "name": "EditionDefault", "field": [{ "name": "edition", "number": 3, "type": 14, "label": 1, "typeName": ".google.protobuf.Edition" }, { "name": "value", "number": 2, "type": 9, "label": 1 }] }, { "name": "FeatureSupport", "field": [{ "name": "edition_introduced", "number": 1, "type": 14, "label": 1, "typeName": ".google.protobuf.Edition" }, { "name": "edition_deprecated", "number": 2, "type": 14, "label": 1, "typeName": ".google.protobuf.Edition" }, { "name": "deprecation_warning", "number": 3, "type": 9, "label": 1 }, { "name": "edition_removed", "number": 4, "type": 14, "label": 1, "typeName": ".google.protobuf.Edition" }, { "name": "removal_error", "number": 5, "type": 9, "label": 1 }] }], "enumType": [{ "name": "CType", "value": [{ "name": "STRING", "number": 0 }, { "name": "CORD", "number": 1 }, { "name": "STRING_PIECE", "number": 2 }] }, { "name": "JSType", "value": [{ "name": "JS_NORMAL", "number": 0 }, { "name": "JS_STRING", "number": 1 }, { "name": "JS_NUMBER", "number": 2 }] }, { "name": "OptionRetention", "value": [{ "name": "RETENTION_UNKNOWN", "number": 0 }, { "name": "RETENTION_RUNTIME", "number": 1 }, { "name": "RETENTION_SOURCE", "number": 2 }] }, { "name": "OptionTargetType", "value": [{ "name": "TARGET_TYPE_UNKNOWN", "number": 0 }, { "name": "TARGET_TYPE_FILE", "number": 1 }, { "name": "TARGET_TYPE_EXTENSION_RANGE", "number": 2 }, { "name": "TARGET_TYPE_MESSAGE", "number": 3 }, { "name": "TARGET_TYPE_FIELD", "number": 4 }, { "name": "TARGET_TYPE_ONEOF", "number": 5 }, { "name": "TARGET_TYPE_ENUM", "number": 6 }, { "name": "TARGET_TYPE_ENUM_ENTRY", "number": 7 }, { "name": "TARGET_TYPE_SERVICE", "number": 8 }, { "name": "TARGET_TYPE_METHOD", "number": 9 }] }], "extensionRange": [{ "start": 990, "end": 999 }, { "start": 1e3, "end": 536870912 }] }, { "name": "OneofOptions", "field": [{ "name": "features", "number": 1, "type": 11, "label": 1, "typeName": ".google.protobuf.FeatureSet" }, { "name": "uninterpreted_option", "number": 999, "type": 11, "label": 3, "typeName": ".google.protobuf.UninterpretedOption" }], "extensionRange": [{ "start": 990, "end": 999 }, { "start": 1e3, "end": 536870912 }] }, { "name": "EnumOptions", "field": [{ "name": "allow_alias", "number": 2, "type": 8, "label": 1 }, { "name": "deprecated", "number": 3, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "deprecated_legacy_json_field_conflicts", "number": 6, "type": 8, "label": 1, "options": { "deprecated": true } }, { "name": "features", "number": 7, "type": 11, "label": 1, "typeName": ".google.protobuf.FeatureSet" }, { "name": "uninterpreted_option", "number": 999, "type": 11, "label": 3, "typeName": ".google.protobuf.UninterpretedOption" }], "extensionRange": [{ "start": 990, "end": 999 }, { "start": 1e3, "end": 536870912 }] }, { "name": "EnumValueOptions", "field": [{ "name": "deprecated", "number": 1, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "features", "number": 2, "type": 11, "label": 1, "typeName": ".google.protobuf.FeatureSet" }, { "name": "debug_redact", "number": 3, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "feature_support", "number": 4, "type": 11, "label": 1, "typeName": ".google.protobuf.FieldOptions.FeatureSupport" }, { "name": "uninterpreted_option", "number": 999, "type": 11, "label": 3, "typeName": ".google.protobuf.UninterpretedOption" }], "extensionRange": [{ "start": 990, "end": 999 }, { "start": 1e3, "end": 536870912 }] }, { "name": "ServiceOptions", "field": [{ "name": "features", "number": 34, "type": 11, "label": 1, "typeName": ".google.protobuf.FeatureSet" }, { "name": "deprecated", "number": 33, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "uninterpreted_option", "number": 999, "type": 11, "label": 3, "typeName": ".google.protobuf.UninterpretedOption" }], "extensionRange": [{ "start": 990, "end": 999 }, { "start": 1e3, "end": 536870912 }] }, { "name": "MethodOptions", "field": [{ "name": "deprecated", "number": 33, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "idempotency_level", "number": 34, "type": 14, "label": 1, "typeName": ".google.protobuf.MethodOptions.IdempotencyLevel", "defaultValue": "IDEMPOTENCY_UNKNOWN" }, { "name": "features", "number": 35, "type": 11, "label": 1, "typeName": ".google.protobuf.FeatureSet" }, { "name": "uninterpreted_option", "number": 999, "type": 11, "label": 3, "typeName": ".google.protobuf.UninterpretedOption" }], "enumType": [{ "name": "IdempotencyLevel", "value": [{ "name": "IDEMPOTENCY_UNKNOWN", "number": 0 }, { "name": "NO_SIDE_EFFECTS", "number": 1 }, { "name": "IDEMPOTENT", "number": 2 }] }], "extensionRange": [{ "start": 990, "end": 999 }, { "start": 1e3, "end": 536870912 }] }, { "name": "UninterpretedOption", "field": [{ "name": "name", "number": 2, "type": 11, "label": 3, "typeName": ".google.protobuf.UninterpretedOption.NamePart" }, { "name": "identifier_value", "number": 3, "type": 9, "label": 1 }, { "name": "positive_int_value", "number": 4, "type": 4, "label": 1 }, { "name": "negative_int_value", "number": 5, "type": 3, "label": 1 }, { "name": "double_value", "number": 6, "type": 1, "label": 1 }, { "name": "string_value", "number": 7, "type": 12, "label": 1 }, { "name": "aggregate_value", "number": 8, "type": 9, "label": 1 }], "nestedType": [{ "name": "NamePart", "field": [{ "name": "name_part", "number": 1, "type": 9, "label": 2 }, { "name": "is_extension", "number": 2, "type": 8, "label": 2 }] }] }, { "name": "FeatureSet", "field": [{ "name": "field_presence", "number": 1, "type": 14, "label": 1, "typeName": ".google.protobuf.FeatureSet.FieldPresence", "options": { "retention": 1, "targets": [4, 1], "editionDefaults": [{ "value": "EXPLICIT", "edition": 900 }, { "value": "IMPLICIT", "edition": 999 }, { "value": "EXPLICIT", "edition": 1e3 }] } }, { "name": "enum_type", "number": 2, "type": 14, "label": 1, "typeName": ".google.protobuf.FeatureSet.EnumType", "options": { "retention": 1, "targets": [6, 1], "editionDefaults": [{ "value": "CLOSED", "edition": 900 }, { "value": "OPEN", "edition": 999 }] } }, { "name": "repeated_field_encoding", "number": 3, "type": 14, "label": 1, "typeName": ".google.protobuf.FeatureSet.RepeatedFieldEncoding", "options": { "retention": 1, "targets": [4, 1], "editionDefaults": [{ "value": "EXPANDED", "edition": 900 }, { "value": "PACKED", "edition": 999 }] } }, { "name": "utf8_validation", "number": 4, "type": 14, "label": 1, "typeName": ".google.protobuf.FeatureSet.Utf8Validation", "options": { "retention": 1, "targets": [4, 1], "editionDefaults": [{ "value": "NONE", "edition": 900 }, { "value": "VERIFY", "edition": 999 }] } }, { "name": "message_encoding", "number": 5, "type": 14, "label": 1, "typeName": ".google.protobuf.FeatureSet.MessageEncoding", "options": { "retention": 1, "targets": [4, 1], "editionDefaults": [{ "value": "LENGTH_PREFIXED", "edition": 900 }] } }, { "name": "json_format", "number": 6, "type": 14, "label": 1, "typeName": ".google.protobuf.FeatureSet.JsonFormat", "options": { "retention": 1, "targets": [3, 6, 1], "editionDefaults": [{ "value": "LEGACY_BEST_EFFORT", "edition": 900 }, { "value": "ALLOW", "edition": 999 }] } }, { "name": "enforce_naming_style", "number": 7, "type": 14, "label": 1, "typeName": ".google.protobuf.FeatureSet.EnforceNamingStyle", "options": { "retention": 2, "targets": [1, 2, 3, 4, 5, 6, 7, 8, 9], "editionDefaults": [{ "value": "STYLE_LEGACY", "edition": 900 }, { "value": "STYLE2024", "edition": 1001 }, { "value": "STYLE2026", "edition": 1002 }] } }, { "name": "default_symbol_visibility", "number": 8, "type": 14, "label": 1, "typeName": ".google.protobuf.FeatureSet.VisibilityFeature.DefaultSymbolVisibility", "options": { "retention": 2, "targets": [1], "editionDefaults": [{ "value": "EXPORT_ALL", "edition": 900 }, { "value": "EXPORT_TOP_LEVEL", "edition": 1001 }, { "value": "STRICT", "edition": 1002 }] } }, { "name": "enforce_proto_limits", "number": 9, "type": 14, "label": 1, "typeName": ".google.protobuf.FeatureSet.ProtoLimitsFeature.EnforceProtoLimits", "options": { "retention": 2, "targets": [6, 3, 4, 5], "editionDefaults": [{ "value": "LEGACY_NO_EXPLICIT_LIMITS", "edition": 900 }, { "value": "PROTO_LIMITS2026", "edition": 1002 }] } }], "nestedType": [{ "name": "VisibilityFeature", "enumType": [{ "name": "DefaultSymbolVisibility", "value": [{ "name": "DEFAULT_SYMBOL_VISIBILITY_UNKNOWN", "number": 0 }, { "name": "EXPORT_ALL", "number": 1 }, { "name": "EXPORT_TOP_LEVEL", "number": 2 }, { "name": "LOCAL_ALL", "number": 3 }, { "name": "STRICT", "number": 4 }] }] }, { "name": "ProtoLimitsFeature", "enumType": [{ "name": "EnforceProtoLimits", "value": [{ "name": "PROTO_LIMITS_UNKNOWN", "number": 0 }, { "name": "LEGACY_NO_EXPLICIT_LIMITS", "number": 1 }, { "name": "PROTO_LIMITS2026", "number": 2 }] }] }], "enumType": [{ "name": "FieldPresence", "value": [{ "name": "FIELD_PRESENCE_UNKNOWN", "number": 0 }, { "name": "EXPLICIT", "number": 1 }, { "name": "IMPLICIT", "number": 2 }, { "name": "LEGACY_REQUIRED", "number": 3 }] }, { "name": "EnumType", "value": [{ "name": "ENUM_TYPE_UNKNOWN", "number": 0 }, { "name": "OPEN", "number": 1 }, { "name": "CLOSED", "number": 2 }] }, { "name": "RepeatedFieldEncoding", "value": [{ "name": "REPEATED_FIELD_ENCODING_UNKNOWN", "number": 0 }, { "name": "PACKED", "number": 1 }, { "name": "EXPANDED", "number": 2 }] }, { "name": "Utf8Validation", "value": [{ "name": "UTF8_VALIDATION_UNKNOWN", "number": 0 }, { "name": "VERIFY", "number": 2 }, { "name": "NONE", "number": 3 }] }, { "name": "MessageEncoding", "value": [{ "name": "MESSAGE_ENCODING_UNKNOWN", "number": 0 }, { "name": "LENGTH_PREFIXED", "number": 1 }, { "name": "DELIMITED", "number": 2 }] }, { "name": "JsonFormat", "value": [{ "name": "JSON_FORMAT_UNKNOWN", "number": 0 }, { "name": "ALLOW", "number": 1 }, { "name": "LEGACY_BEST_EFFORT", "number": 2 }] }, { "name": "EnforceNamingStyle", "value": [{ "name": "ENFORCE_NAMING_STYLE_UNKNOWN", "number": 0 }, { "name": "STYLE2024", "number": 1 }, { "name": "STYLE_LEGACY", "number": 2 }, { "name": "STYLE2026", "number": 3 }] }], "extensionRange": [{ "start": 1e3, "end": 9995 }, { "start": 9995, "end": 1e4 }, { "start": 1e4, "end": 10001 }] }, { "name": "FeatureSetDefaults", "field": [{ "name": "defaults", "number": 1, "type": 11, "label": 3, "typeName": ".google.protobuf.FeatureSetDefaults.FeatureSetEditionDefault" }, { "name": "minimum_edition", "number": 4, "type": 14, "label": 1, "typeName": ".google.protobuf.Edition" }, { "name": "maximum_edition", "number": 5, "type": 14, "label": 1, "typeName": ".google.protobuf.Edition" }], "nestedType": [{ "name": "FeatureSetEditionDefault", "field": [{ "name": "edition", "number": 3, "type": 14, "label": 1, "typeName": ".google.protobuf.Edition" }, { "name": "overridable_features", "number": 4, "type": 11, "label": 1, "typeName": ".google.protobuf.FeatureSet" }, { "name": "fixed_features", "number": 5, "type": 11, "label": 1, "typeName": ".google.protobuf.FeatureSet" }] }] }, { "name": "SourceCodeInfo", "field": [{ "name": "location", "number": 1, "type": 11, "label": 3, "typeName": ".google.protobuf.SourceCodeInfo.Location" }], "nestedType": [{ "name": "Location", "field": [{ "name": "path", "number": 1, "type": 5, "label": 3, "options": { "packed": true } }, { "name": "span", "number": 2, "type": 5, "label": 3, "options": { "packed": true } }, { "name": "leading_comments", "number": 3, "type": 9, "label": 1 }, { "name": "trailing_comments", "number": 4, "type": 9, "label": 1 }, { "name": "leading_detached_comments", "number": 6, "type": 9, "label": 3 }] }], "extensionRange": [{ "start": 536e6, "end": 536000001 }] }, { "name": "GeneratedCodeInfo", "field": [{ "name": "annotation", "number": 1, "type": 11, "label": 3, "typeName": ".google.protobuf.GeneratedCodeInfo.Annotation" }], "nestedType": [{ "name": "Annotation", "field": [{ "name": "path", "number": 1, "type": 5, "label": 3, "options": { "packed": true } }, { "name": "source_file", "number": 2, "type": 9, "label": 1 }, { "name": "begin", "number": 3, "type": 5, "label": 1 }, { "name": "end", "number": 4, "type": 5, "label": 1 }, { "name": "semantic", "number": 5, "type": 14, "label": 1, "typeName": ".google.protobuf.GeneratedCodeInfo.Annotation.Semantic" }], "enumType": [{ "name": "Semantic", "value": [{ "name": "NONE", "number": 0 }, { "name": "SET", "number": 1 }, { "name": "ALIAS", "number": 2 }] }] }] }], "enumType": [{ "name": "Edition", "value": [{ "name": "EDITION_UNKNOWN", "number": 0 }, { "name": "EDITION_LEGACY", "number": 900 }, { "name": "EDITION_PROTO2", "number": 998 }, { "name": "EDITION_PROTO3", "number": 999 }, { "name": "EDITION_2023", "number": 1e3 }, { "name": "EDITION_2024", "number": 1001 }, { "name": "EDITION_2026", "number": 1002 }, { "name": "EDITION_UNSTABLE", "number": 9999 }, { "name": "EDITION_1_TEST_ONLY", "number": 1 }, { "name": "EDITION_2_TEST_ONLY", "number": 2 }, { "name": "EDITION_99997_TEST_ONLY", "number": 99997 }, { "name": "EDITION_99998_TEST_ONLY", "number": 99998 }, { "name": "EDITION_99999_TEST_ONLY", "number": 99999 }, { "name": "EDITION_MAX", "number": 2147483647 }] }, { "name": "SymbolVisibility", "value": [{ "name": "VISIBILITY_UNSET", "number": 0 }, { "name": "VISIBILITY_LOCAL", "number": 1 }, { "name": "VISIBILITY_EXPORT", "number": 2 }] }] });
var FileDescriptorProtoSchema = /* @__PURE__ */ messageDesc(file_google_protobuf_descriptor, 1);
var ExtensionRangeOptions_VerificationState;
(function(ExtensionRangeOptions_VerificationState2) {
  ExtensionRangeOptions_VerificationState2[ExtensionRangeOptions_VerificationState2["DECLARATION"] = 0] = "DECLARATION";
  ExtensionRangeOptions_VerificationState2[ExtensionRangeOptions_VerificationState2["UNVERIFIED"] = 1] = "UNVERIFIED";
})(ExtensionRangeOptions_VerificationState || (ExtensionRangeOptions_VerificationState = {}));
var FieldDescriptorProto_Type;
(function(FieldDescriptorProto_Type2) {
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["DOUBLE"] = 1] = "DOUBLE";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["FLOAT"] = 2] = "FLOAT";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["INT64"] = 3] = "INT64";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["UINT64"] = 4] = "UINT64";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["INT32"] = 5] = "INT32";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["FIXED64"] = 6] = "FIXED64";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["FIXED32"] = 7] = "FIXED32";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["BOOL"] = 8] = "BOOL";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["STRING"] = 9] = "STRING";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["GROUP"] = 10] = "GROUP";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["MESSAGE"] = 11] = "MESSAGE";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["BYTES"] = 12] = "BYTES";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["UINT32"] = 13] = "UINT32";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["ENUM"] = 14] = "ENUM";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["SFIXED32"] = 15] = "SFIXED32";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["SFIXED64"] = 16] = "SFIXED64";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["SINT32"] = 17] = "SINT32";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["SINT64"] = 18] = "SINT64";
})(FieldDescriptorProto_Type || (FieldDescriptorProto_Type = {}));
var FieldDescriptorProto_Label;
(function(FieldDescriptorProto_Label2) {
  FieldDescriptorProto_Label2[FieldDescriptorProto_Label2["OPTIONAL"] = 1] = "OPTIONAL";
  FieldDescriptorProto_Label2[FieldDescriptorProto_Label2["REPEATED"] = 3] = "REPEATED";
  FieldDescriptorProto_Label2[FieldDescriptorProto_Label2["REQUIRED"] = 2] = "REQUIRED";
})(FieldDescriptorProto_Label || (FieldDescriptorProto_Label = {}));
var FileOptions_OptimizeMode;
(function(FileOptions_OptimizeMode2) {
  FileOptions_OptimizeMode2[FileOptions_OptimizeMode2["SPEED"] = 1] = "SPEED";
  FileOptions_OptimizeMode2[FileOptions_OptimizeMode2["CODE_SIZE"] = 2] = "CODE_SIZE";
  FileOptions_OptimizeMode2[FileOptions_OptimizeMode2["LITE_RUNTIME"] = 3] = "LITE_RUNTIME";
})(FileOptions_OptimizeMode || (FileOptions_OptimizeMode = {}));
var FieldOptions_CType;
(function(FieldOptions_CType2) {
  FieldOptions_CType2[FieldOptions_CType2["STRING"] = 0] = "STRING";
  FieldOptions_CType2[FieldOptions_CType2["CORD"] = 1] = "CORD";
  FieldOptions_CType2[FieldOptions_CType2["STRING_PIECE"] = 2] = "STRING_PIECE";
})(FieldOptions_CType || (FieldOptions_CType = {}));
var FieldOptions_JSType;
(function(FieldOptions_JSType2) {
  FieldOptions_JSType2[FieldOptions_JSType2["JS_NORMAL"] = 0] = "JS_NORMAL";
  FieldOptions_JSType2[FieldOptions_JSType2["JS_STRING"] = 1] = "JS_STRING";
  FieldOptions_JSType2[FieldOptions_JSType2["JS_NUMBER"] = 2] = "JS_NUMBER";
})(FieldOptions_JSType || (FieldOptions_JSType = {}));
var FieldOptions_OptionRetention;
(function(FieldOptions_OptionRetention2) {
  FieldOptions_OptionRetention2[FieldOptions_OptionRetention2["RETENTION_UNKNOWN"] = 0] = "RETENTION_UNKNOWN";
  FieldOptions_OptionRetention2[FieldOptions_OptionRetention2["RETENTION_RUNTIME"] = 1] = "RETENTION_RUNTIME";
  FieldOptions_OptionRetention2[FieldOptions_OptionRetention2["RETENTION_SOURCE"] = 2] = "RETENTION_SOURCE";
})(FieldOptions_OptionRetention || (FieldOptions_OptionRetention = {}));
var FieldOptions_OptionTargetType;
(function(FieldOptions_OptionTargetType2) {
  FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2["TARGET_TYPE_UNKNOWN"] = 0] = "TARGET_TYPE_UNKNOWN";
  FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2["TARGET_TYPE_FILE"] = 1] = "TARGET_TYPE_FILE";
  FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2["TARGET_TYPE_EXTENSION_RANGE"] = 2] = "TARGET_TYPE_EXTENSION_RANGE";
  FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2["TARGET_TYPE_MESSAGE"] = 3] = "TARGET_TYPE_MESSAGE";
  FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2["TARGET_TYPE_FIELD"] = 4] = "TARGET_TYPE_FIELD";
  FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2["TARGET_TYPE_ONEOF"] = 5] = "TARGET_TYPE_ONEOF";
  FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2["TARGET_TYPE_ENUM"] = 6] = "TARGET_TYPE_ENUM";
  FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2["TARGET_TYPE_ENUM_ENTRY"] = 7] = "TARGET_TYPE_ENUM_ENTRY";
  FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2["TARGET_TYPE_SERVICE"] = 8] = "TARGET_TYPE_SERVICE";
  FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2["TARGET_TYPE_METHOD"] = 9] = "TARGET_TYPE_METHOD";
})(FieldOptions_OptionTargetType || (FieldOptions_OptionTargetType = {}));
var MethodOptions_IdempotencyLevel;
(function(MethodOptions_IdempotencyLevel2) {
  MethodOptions_IdempotencyLevel2[MethodOptions_IdempotencyLevel2["IDEMPOTENCY_UNKNOWN"] = 0] = "IDEMPOTENCY_UNKNOWN";
  MethodOptions_IdempotencyLevel2[MethodOptions_IdempotencyLevel2["NO_SIDE_EFFECTS"] = 1] = "NO_SIDE_EFFECTS";
  MethodOptions_IdempotencyLevel2[MethodOptions_IdempotencyLevel2["IDEMPOTENT"] = 2] = "IDEMPOTENT";
})(MethodOptions_IdempotencyLevel || (MethodOptions_IdempotencyLevel = {}));
var FeatureSet_VisibilityFeature_DefaultSymbolVisibility;
(function(FeatureSet_VisibilityFeature_DefaultSymbolVisibility2) {
  FeatureSet_VisibilityFeature_DefaultSymbolVisibility2[FeatureSet_VisibilityFeature_DefaultSymbolVisibility2["DEFAULT_SYMBOL_VISIBILITY_UNKNOWN"] = 0] = "DEFAULT_SYMBOL_VISIBILITY_UNKNOWN";
  FeatureSet_VisibilityFeature_DefaultSymbolVisibility2[FeatureSet_VisibilityFeature_DefaultSymbolVisibility2["EXPORT_ALL"] = 1] = "EXPORT_ALL";
  FeatureSet_VisibilityFeature_DefaultSymbolVisibility2[FeatureSet_VisibilityFeature_DefaultSymbolVisibility2["EXPORT_TOP_LEVEL"] = 2] = "EXPORT_TOP_LEVEL";
  FeatureSet_VisibilityFeature_DefaultSymbolVisibility2[FeatureSet_VisibilityFeature_DefaultSymbolVisibility2["LOCAL_ALL"] = 3] = "LOCAL_ALL";
  FeatureSet_VisibilityFeature_DefaultSymbolVisibility2[FeatureSet_VisibilityFeature_DefaultSymbolVisibility2["STRICT"] = 4] = "STRICT";
})(FeatureSet_VisibilityFeature_DefaultSymbolVisibility || (FeatureSet_VisibilityFeature_DefaultSymbolVisibility = {}));
var FeatureSet_ProtoLimitsFeature_EnforceProtoLimits;
(function(FeatureSet_ProtoLimitsFeature_EnforceProtoLimits2) {
  FeatureSet_ProtoLimitsFeature_EnforceProtoLimits2[FeatureSet_ProtoLimitsFeature_EnforceProtoLimits2["PROTO_LIMITS_UNKNOWN"] = 0] = "PROTO_LIMITS_UNKNOWN";
  FeatureSet_ProtoLimitsFeature_EnforceProtoLimits2[FeatureSet_ProtoLimitsFeature_EnforceProtoLimits2["LEGACY_NO_EXPLICIT_LIMITS"] = 1] = "LEGACY_NO_EXPLICIT_LIMITS";
  FeatureSet_ProtoLimitsFeature_EnforceProtoLimits2[FeatureSet_ProtoLimitsFeature_EnforceProtoLimits2["PROTO_LIMITS2026"] = 2] = "PROTO_LIMITS2026";
})(FeatureSet_ProtoLimitsFeature_EnforceProtoLimits || (FeatureSet_ProtoLimitsFeature_EnforceProtoLimits = {}));
var FeatureSet_FieldPresence;
(function(FeatureSet_FieldPresence2) {
  FeatureSet_FieldPresence2[FeatureSet_FieldPresence2["FIELD_PRESENCE_UNKNOWN"] = 0] = "FIELD_PRESENCE_UNKNOWN";
  FeatureSet_FieldPresence2[FeatureSet_FieldPresence2["EXPLICIT"] = 1] = "EXPLICIT";
  FeatureSet_FieldPresence2[FeatureSet_FieldPresence2["IMPLICIT"] = 2] = "IMPLICIT";
  FeatureSet_FieldPresence2[FeatureSet_FieldPresence2["LEGACY_REQUIRED"] = 3] = "LEGACY_REQUIRED";
})(FeatureSet_FieldPresence || (FeatureSet_FieldPresence = {}));
var FeatureSet_EnumType;
(function(FeatureSet_EnumType2) {
  FeatureSet_EnumType2[FeatureSet_EnumType2["ENUM_TYPE_UNKNOWN"] = 0] = "ENUM_TYPE_UNKNOWN";
  FeatureSet_EnumType2[FeatureSet_EnumType2["OPEN"] = 1] = "OPEN";
  FeatureSet_EnumType2[FeatureSet_EnumType2["CLOSED"] = 2] = "CLOSED";
})(FeatureSet_EnumType || (FeatureSet_EnumType = {}));
var FeatureSet_RepeatedFieldEncoding;
(function(FeatureSet_RepeatedFieldEncoding2) {
  FeatureSet_RepeatedFieldEncoding2[FeatureSet_RepeatedFieldEncoding2["REPEATED_FIELD_ENCODING_UNKNOWN"] = 0] = "REPEATED_FIELD_ENCODING_UNKNOWN";
  FeatureSet_RepeatedFieldEncoding2[FeatureSet_RepeatedFieldEncoding2["PACKED"] = 1] = "PACKED";
  FeatureSet_RepeatedFieldEncoding2[FeatureSet_RepeatedFieldEncoding2["EXPANDED"] = 2] = "EXPANDED";
})(FeatureSet_RepeatedFieldEncoding || (FeatureSet_RepeatedFieldEncoding = {}));
var FeatureSet_Utf8Validation;
(function(FeatureSet_Utf8Validation2) {
  FeatureSet_Utf8Validation2[FeatureSet_Utf8Validation2["UTF8_VALIDATION_UNKNOWN"] = 0] = "UTF8_VALIDATION_UNKNOWN";
  FeatureSet_Utf8Validation2[FeatureSet_Utf8Validation2["VERIFY"] = 2] = "VERIFY";
  FeatureSet_Utf8Validation2[FeatureSet_Utf8Validation2["NONE"] = 3] = "NONE";
})(FeatureSet_Utf8Validation || (FeatureSet_Utf8Validation = {}));
var FeatureSet_MessageEncoding;
(function(FeatureSet_MessageEncoding2) {
  FeatureSet_MessageEncoding2[FeatureSet_MessageEncoding2["MESSAGE_ENCODING_UNKNOWN"] = 0] = "MESSAGE_ENCODING_UNKNOWN";
  FeatureSet_MessageEncoding2[FeatureSet_MessageEncoding2["LENGTH_PREFIXED"] = 1] = "LENGTH_PREFIXED";
  FeatureSet_MessageEncoding2[FeatureSet_MessageEncoding2["DELIMITED"] = 2] = "DELIMITED";
})(FeatureSet_MessageEncoding || (FeatureSet_MessageEncoding = {}));
var FeatureSet_JsonFormat;
(function(FeatureSet_JsonFormat2) {
  FeatureSet_JsonFormat2[FeatureSet_JsonFormat2["JSON_FORMAT_UNKNOWN"] = 0] = "JSON_FORMAT_UNKNOWN";
  FeatureSet_JsonFormat2[FeatureSet_JsonFormat2["ALLOW"] = 1] = "ALLOW";
  FeatureSet_JsonFormat2[FeatureSet_JsonFormat2["LEGACY_BEST_EFFORT"] = 2] = "LEGACY_BEST_EFFORT";
})(FeatureSet_JsonFormat || (FeatureSet_JsonFormat = {}));
var FeatureSet_EnforceNamingStyle;
(function(FeatureSet_EnforceNamingStyle2) {
  FeatureSet_EnforceNamingStyle2[FeatureSet_EnforceNamingStyle2["ENFORCE_NAMING_STYLE_UNKNOWN"] = 0] = "ENFORCE_NAMING_STYLE_UNKNOWN";
  FeatureSet_EnforceNamingStyle2[FeatureSet_EnforceNamingStyle2["STYLE2024"] = 1] = "STYLE2024";
  FeatureSet_EnforceNamingStyle2[FeatureSet_EnforceNamingStyle2["STYLE_LEGACY"] = 2] = "STYLE_LEGACY";
  FeatureSet_EnforceNamingStyle2[FeatureSet_EnforceNamingStyle2["STYLE2026"] = 3] = "STYLE2026";
})(FeatureSet_EnforceNamingStyle || (FeatureSet_EnforceNamingStyle = {}));
var GeneratedCodeInfo_Annotation_Semantic;
(function(GeneratedCodeInfo_Annotation_Semantic2) {
  GeneratedCodeInfo_Annotation_Semantic2[GeneratedCodeInfo_Annotation_Semantic2["NONE"] = 0] = "NONE";
  GeneratedCodeInfo_Annotation_Semantic2[GeneratedCodeInfo_Annotation_Semantic2["SET"] = 1] = "SET";
  GeneratedCodeInfo_Annotation_Semantic2[GeneratedCodeInfo_Annotation_Semantic2["ALIAS"] = 2] = "ALIAS";
})(GeneratedCodeInfo_Annotation_Semantic || (GeneratedCodeInfo_Annotation_Semantic = {}));
var Edition;
(function(Edition2) {
  Edition2[Edition2["EDITION_UNKNOWN"] = 0] = "EDITION_UNKNOWN";
  Edition2[Edition2["EDITION_LEGACY"] = 900] = "EDITION_LEGACY";
  Edition2[Edition2["EDITION_PROTO2"] = 998] = "EDITION_PROTO2";
  Edition2[Edition2["EDITION_PROTO3"] = 999] = "EDITION_PROTO3";
  Edition2[Edition2["EDITION_2023"] = 1e3] = "EDITION_2023";
  Edition2[Edition2["EDITION_2024"] = 1001] = "EDITION_2024";
  Edition2[Edition2["EDITION_2026"] = 1002] = "EDITION_2026";
  Edition2[Edition2["EDITION_UNSTABLE"] = 9999] = "EDITION_UNSTABLE";
  Edition2[Edition2["EDITION_1_TEST_ONLY"] = 1] = "EDITION_1_TEST_ONLY";
  Edition2[Edition2["EDITION_2_TEST_ONLY"] = 2] = "EDITION_2_TEST_ONLY";
  Edition2[Edition2["EDITION_99997_TEST_ONLY"] = 99997] = "EDITION_99997_TEST_ONLY";
  Edition2[Edition2["EDITION_99998_TEST_ONLY"] = 99998] = "EDITION_99998_TEST_ONLY";
  Edition2[Edition2["EDITION_99999_TEST_ONLY"] = 99999] = "EDITION_99999_TEST_ONLY";
  Edition2[Edition2["EDITION_MAX"] = 2147483647] = "EDITION_MAX";
})(Edition || (Edition = {}));
var SymbolVisibility;
(function(SymbolVisibility2) {
  SymbolVisibility2[SymbolVisibility2["VISIBILITY_UNSET"] = 0] = "VISIBILITY_UNSET";
  SymbolVisibility2[SymbolVisibility2["VISIBILITY_LOCAL"] = 1] = "VISIBILITY_LOCAL";
  SymbolVisibility2[SymbolVisibility2["VISIBILITY_EXPORT"] = 2] = "VISIBILITY_EXPORT";
})(SymbolVisibility || (SymbolVisibility = {}));

// ../node_modules/@bufbuild/protobuf/dist/esm/from-binary.js
function makeReadContext(options) {
  return Object.assign(Object.assign({ readUnknownFields: true, recursionLimit: 100 }, options), { depth: 0 });
}
__name(makeReadContext, "makeReadContext");
function fromBinary(schema, bytes, options) {
  const message = create(schema);
  compiledReader(schema).read(message, new BinaryReader(bytes), makeReadContext(options), bytes.byteLength);
  return message;
}
__name(fromBinary, "fromBinary");
var compiledReaders = /* @__PURE__ */ new WeakMap();
function compiledReader(desc) {
  let compiled = compiledReaders.get(desc);
  if (compiled === void 0) {
    compiled = compileMessage(desc);
  }
  return compiled;
}
__name(compiledReader, "compiledReader");
function compileMessage(desc) {
  const descString = String(desc);
  const fieldReaders = /* @__PURE__ */ new Map();
  const compiled = {
    read: compileMessageReader(descString, fieldReaders),
    readGroup: compileGroupReader(descString, fieldReaders)
  };
  compiledReaders.set(desc, compiled);
  for (const field of desc.fields) {
    fieldReaders.set(field.number, compileFieldReader(field));
  }
  return compiled;
}
__name(compileMessage, "compileMessage");
function compileMessageReader(descString, fieldReaders) {
  return (message, reader, ctx, length) => {
    var _a;
    if (++ctx.depth > ctx.recursionLimit) {
      throw new Error(`cannot decode ${descString} from binary: maximum recursion depth of ${ctx.recursionLimit} reached`);
    }
    const end = reader.pos + length;
    const unknownFields = (_a = message.$unknown) !== null && _a !== void 0 ? _a : [];
    while (reader.pos < end) {
      const [fieldNo, wireType] = reader.tag();
      const fieldReader = fieldReaders.get(fieldNo);
      if (fieldReader === void 0) {
        const data = reader.skip(wireType, fieldNo, ctx.recursionLimit - ctx.depth);
        if (ctx.readUnknownFields) {
          unknownFields.push({ no: fieldNo, wireType, data });
        }
        continue;
      }
      fieldReader(message, reader, ctx, wireType);
    }
    if (unknownFields.length > 0) {
      message.$unknown = unknownFields;
    }
    ctx.depth--;
  };
}
__name(compileMessageReader, "compileMessageReader");
function compileGroupReader(descString, fieldReaders) {
  return (message, reader, ctx, fieldNo) => {
    var _a;
    if (++ctx.depth > ctx.recursionLimit) {
      throw new Error(`cannot decode ${descString} from binary: maximum recursion depth of ${ctx.recursionLimit} reached`);
    }
    let recordFieldNo;
    let wireType;
    const unknownFields = (_a = message.$unknown) !== null && _a !== void 0 ? _a : [];
    while (reader.pos < reader.len) {
      [recordFieldNo, wireType] = reader.tag();
      if (wireType == WireType.EndGroup) {
        break;
      }
      const fieldReader = fieldReaders.get(recordFieldNo);
      if (fieldReader === void 0) {
        const data = reader.skip(wireType, recordFieldNo, ctx.recursionLimit - ctx.depth);
        if (ctx.readUnknownFields) {
          unknownFields.push({ no: recordFieldNo, wireType, data });
        }
        continue;
      }
      fieldReader(message, reader, ctx, wireType);
    }
    if (wireType != WireType.EndGroup || recordFieldNo !== fieldNo) {
      throw new Error("invalid end group tag");
    }
    if (unknownFields.length > 0) {
      message.$unknown = unknownFields;
    }
    ctx.depth--;
  };
}
__name(compileGroupReader, "compileGroupReader");
function compileFieldReader(field) {
  switch (field.fieldKind) {
    case "scalar":
      return compileScalarFieldReader(field);
    case "enum":
      return compileEnumFieldReader(field);
    case "message":
      return compileMessageFieldReader(field);
    case "list":
      return compileListFieldReader(field);
    case "map":
      return compileMapFieldReader(field);
  }
}
__name(compileFieldReader, "compileFieldReader");
function compileScalarFieldReader(field) {
  const readScalar = compileScalarReader(field.scalar, field.utf8Validation, field.longAsString);
  const localName = field.localName;
  if (field.oneof) {
    const oneofLocalName = field.oneof.localName;
    return (message, reader) => {
      message[oneofLocalName] = {
        case: localName,
        value: readScalar(reader)
      };
    };
  }
  return (message, reader) => {
    message[localName] = readScalar(reader);
  };
}
__name(compileScalarFieldReader, "compileScalarFieldReader");
function compileEnumFieldReader(field) {
  var _a;
  const localName = field.localName;
  const oneofLocalName = (_a = field.oneof) === null || _a === void 0 ? void 0 : _a.localName;
  if (field.enum.open) {
    if (oneofLocalName !== void 0) {
      return (message, reader) => {
        message[oneofLocalName] = { case: localName, value: reader.int32() };
      };
    }
    return (message, reader) => {
      message[localName] = reader.int32();
    };
  }
  const values = field.enum.values;
  const fieldNo = field.number;
  return (message, reader, ctx, wireType) => {
    var _a2;
    const val = reader.int32();
    if (values.some((v) => v.number === val)) {
      if (oneofLocalName !== void 0) {
        message[oneofLocalName] = { case: localName, value: val };
      } else {
        message[localName] = val;
      }
    } else if (ctx.readUnknownFields) {
      const bytes = [];
      varint32write(val, bytes);
      const unknownFields = (_a2 = message.$unknown) !== null && _a2 !== void 0 ? _a2 : [];
      unknownFields.push({
        no: fieldNo,
        wireType,
        data: new Uint8Array(bytes)
      });
      message.$unknown = unknownFields;
    }
  };
}
__name(compileEnumFieldReader, "compileEnumFieldReader");
function compileMessageFieldReader(field) {
  const localName = field.localName;
  const { toMessage, toLocal } = localMessageMapper(field);
  const readChild = compileChildReader(field);
  if (field.oneof) {
    const oneofLocalName = field.oneof.localName;
    return (message, reader, ctx) => {
      const oneof = message[oneofLocalName];
      const child = toMessage(oneof.case === localName ? oneof.value : void 0);
      readChild(child, reader, ctx);
      message[oneofLocalName] = { case: localName, value: toLocal(child) };
    };
  }
  return (message, reader, ctx) => {
    const child = toMessage(message[localName]);
    readChild(child, reader, ctx);
    message[localName] = toLocal(child);
  };
}
__name(compileMessageFieldReader, "compileMessageFieldReader");
function compileChildReader(field) {
  const compiledChild = compiledReader(field.message);
  if (field.delimitedEncoding) {
    const fieldNo = field.number;
    return (child, reader, ctx) => compiledChild.readGroup(child, reader, ctx, fieldNo);
  }
  return (child, reader, ctx) => compiledChild.read(child, reader, ctx, reader.uint32());
}
__name(compileChildReader, "compileChildReader");
function compileListFieldReader(field) {
  const localName = field.localName;
  if (field.listKind == "message") {
    const { toMessage, toLocal } = localMessageMapper(field);
    const readChild = compileChildReader(field);
    return (message, reader, ctx) => {
      const child = toMessage(void 0);
      readChild(child, reader, ctx);
      message[localName].push(toLocal(child));
    };
  }
  const scalarType = field.listKind == "enum" ? ScalarType.INT32 : field.scalar;
  const longAsString = field.listKind == "scalar" ? field.longAsString : false;
  const readScalar = compileScalarReader(scalarType, field.utf8Validation, longAsString);
  const packedPossible = scalarType != ScalarType.STRING && scalarType != ScalarType.BYTES;
  return (message, reader, ctx, wireType) => {
    const items = message[localName];
    if (wireType == WireType.LengthDelimited && packedPossible) {
      const end = reader.uint32() + reader.pos;
      while (reader.pos < end) {
        items.push(readScalar(reader));
      }
    } else {
      items.push(readScalar(reader));
    }
  };
}
__name(compileListFieldReader, "compileListFieldReader");
function compileMapFieldReader(field) {
  const localName = field.localName;
  const readKey = compileScalarReader(field.mapKey, field.utf8Validation, false);
  const keyZero = scalarZeroValue(field.mapKey, false);
  let readValue;
  let valueDefault;
  switch (field.mapKind) {
    case "scalar": {
      const scalar = field.scalar;
      const readScalar = compileScalarReader(scalar, field.utf8Validation, false);
      readValue = /* @__PURE__ */ __name((reader) => readScalar(reader), "readValue");
      if (scalar == ScalarType.BYTES) {
        valueDefault = /* @__PURE__ */ __name(() => new Uint8Array(0), "valueDefault");
      } else {
        const zero = scalarZeroValue(scalar, false);
        valueDefault = /* @__PURE__ */ __name(() => zero, "valueDefault");
      }
      break;
    }
    case "enum": {
      const zero = field.enum.values[0].number;
      readValue = /* @__PURE__ */ __name((reader) => reader.int32(), "readValue");
      valueDefault = /* @__PURE__ */ __name(() => zero, "valueDefault");
      break;
    }
    case "message": {
      const { toMessage, toLocal } = localMessageMapper(field);
      const readChild = compiledReader(field.message).read;
      readValue = /* @__PURE__ */ __name((reader, ctx, existing) => {
        const child = toMessage(existing);
        readChild(child, reader, ctx, reader.uint32());
        return toLocal(child);
      }, "readValue");
      valueDefault = /* @__PURE__ */ __name(() => toLocal(toMessage(void 0)), "valueDefault");
      break;
    }
  }
  return (message, reader, ctx) => {
    const record = message[localName];
    let key;
    let val;
    const len = reader.uint32();
    const end = reader.pos + len;
    while (reader.pos < end) {
      const [fieldNo] = reader.tag();
      switch (fieldNo) {
        case 1:
          key = readKey(reader);
          break;
        case 2:
          val = readValue(reader, ctx, val);
          break;
      }
    }
    if (key === void 0) {
      key = keyZero;
    }
    if (val === void 0) {
      val = valueDefault();
    }
    setOwn(record, key, val);
  };
}
__name(compileMapFieldReader, "compileMapFieldReader");
function compileScalarReader(type, utf8Validation, longAsString) {
  switch (type) {
    case ScalarType.STRING:
      return (reader) => reader.string(utf8Validation);
    case ScalarType.BOOL:
      return (reader) => reader.bool();
    case ScalarType.DOUBLE:
      return (reader) => reader.double();
    case ScalarType.FLOAT:
      return (reader) => reader.float();
    case ScalarType.INT32:
      return (reader) => reader.int32();
    case ScalarType.INT64:
      if (longAsString) {
        return (reader) => String(reader.int64());
      }
      return (reader) => reader.int64();
    case ScalarType.UINT64:
      if (longAsString) {
        return (reader) => String(reader.uint64());
      }
      return (reader) => reader.uint64();
    case ScalarType.FIXED64:
      if (longAsString) {
        return (reader) => String(reader.fixed64());
      }
      return (reader) => reader.fixed64();
    case ScalarType.BYTES:
      return (reader) => reader.bytes();
    case ScalarType.FIXED32:
      return (reader) => reader.fixed32();
    case ScalarType.SFIXED32:
      return (reader) => reader.sfixed32();
    case ScalarType.SFIXED64:
      if (longAsString) {
        return (reader) => String(reader.sfixed64());
      }
      return (reader) => reader.sfixed64();
    case ScalarType.SINT64:
      if (longAsString) {
        return (reader) => String(reader.sint64());
      }
      return (reader) => reader.sint64();
    case ScalarType.UINT32:
      return (reader) => reader.uint32();
    case ScalarType.SINT32:
      return (reader) => reader.sint32();
  }
}
__name(compileScalarReader, "compileScalarReader");

// ../node_modules/@bufbuild/protobuf/dist/esm/codegenv2/file.js
function fileDesc(b64, imports) {
  var _a;
  const root = fromBinary(FileDescriptorProtoSchema, base64Decode(b64));
  root.messageType.forEach(restoreJsonNames);
  root.dependency = (_a = imports === null || imports === void 0 ? void 0 : imports.map((f) => f.proto.name)) !== null && _a !== void 0 ? _a : [];
  const reg = createFileRegistry(root, (protoFileName) => imports === null || imports === void 0 ? void 0 : imports.find((f) => f.proto.name === protoFileName));
  return reg.getFile(root.name);
}
__name(fileDesc, "fileDesc");

// ../node_modules/@bufbuild/protobuf/dist/esm/wkt/google/protobuf/timestamp_pb.js
var file_google_protobuf_timestamp = /* @__PURE__ */ fileDesc("Ch9nb29nbGUvcHJvdG9idWYvdGltZXN0YW1wLnByb3RvEg9nb29nbGUucHJvdG9idWYiKwoJVGltZXN0YW1wEg8KB3NlY29uZHMYASABKAMSDQoFbmFub3MYAiABKAVChQEKE2NvbS5nb29nbGUucHJvdG9idWZCDlRpbWVzdGFtcFByb3RvUAFaMmdvb2dsZS5nb2xhbmcub3JnL3Byb3RvYnVmL3R5cGVzL2tub3duL3RpbWVzdGFtcHBi+AEBogIDR1BCqgIeR29vZ2xlLlByb3RvYnVmLldlbGxLbm93blR5cGVzYgZwcm90bzM");

// ../node_modules/@bufbuild/protobuf/dist/esm/wkt/google/protobuf/duration_pb.js
var file_google_protobuf_duration = /* @__PURE__ */ fileDesc("Ch5nb29nbGUvcHJvdG9idWYvZHVyYXRpb24ucHJvdG8SD2dvb2dsZS5wcm90b2J1ZiIqCghEdXJhdGlvbhIPCgdzZWNvbmRzGAEgASgDEg0KBW5hbm9zGAIgASgFQoMBChNjb20uZ29vZ2xlLnByb3RvYnVmQg1EdXJhdGlvblByb3RvUAFaMWdvb2dsZS5nb2xhbmcub3JnL3Byb3RvYnVmL3R5cGVzL2tub3duL2R1cmF0aW9ucGL4AQGiAgNHUEKqAh5Hb29nbGUuUHJvdG9idWYuV2VsbEtub3duVHlwZXNiBnByb3RvMw");

// ../node_modules/@bufbuild/protobuf/dist/esm/wkt/google/protobuf/any_pb.js
var file_google_protobuf_any = /* @__PURE__ */ fileDesc("Chlnb29nbGUvcHJvdG9idWYvYW55LnByb3RvEg9nb29nbGUucHJvdG9idWYiJgoDQW55EhAKCHR5cGVfdXJsGAEgASgJEg0KBXZhbHVlGAIgASgMQnYKE2NvbS5nb29nbGUucHJvdG9idWZCCEFueVByb3RvUAFaLGdvb2dsZS5nb2xhbmcub3JnL3Byb3RvYnVmL3R5cGVzL2tub3duL2FueXBiogIDR1BCqgIeR29vZ2xlLlByb3RvYnVmLldlbGxLbm93blR5cGVzYgZwcm90bzM");

// ../node_modules/@bufbuild/protobuf/dist/esm/to-binary.js
var IMPLICIT3 = 2;
var LEGACY_REQUIRED2 = 3;
var writeDefaults = {
  writeUnknownFields: true
};
function makeWriteOptions(options) {
  return options ? Object.assign(Object.assign({}, writeDefaults), options) : writeDefaults;
}
__name(makeWriteOptions, "makeWriteOptions");
function toBinary(schema, message, options) {
  const writer = new BinaryWriter();
  compiledWriter(schema)(writer, makeWriteOptions(options), message);
  return writer.finish();
}
__name(toBinary, "toBinary");
var compiledWriters = /* @__PURE__ */ new WeakMap();
function compiledWriter(desc) {
  let compiled = compiledWriters.get(desc);
  if (compiled === void 0) {
    compiled = compileMessage2(desc);
  }
  return compiled;
}
__name(compiledWriter, "compiledWriter");
function compileMessage2(desc) {
  const typeName = desc.typeName;
  const sortedFields = desc.fields.concat().sort((a, b) => a.number - b.number);
  const foreignField = sortedFields[0];
  const fieldWriters = [];
  const compiled = /* @__PURE__ */ __name((writer, opts, message) => {
    if (message.$typeName !== typeName && foreignField !== void 0) {
      throw new FieldError(foreignField, `cannot use ${foreignField} with message ${message.$typeName}`, "ForeignFieldError");
    }
    for (let i = 0; i < fieldWriters.length; i++) {
      fieldWriters[i](writer, opts, message);
    }
    const unknown = message.$unknown;
    if (unknown !== void 0 && opts.writeUnknownFields) {
      for (let i = 0; i < unknown.length; i++) {
        const { no, wireType, data } = unknown[i];
        writer.tag(no, wireType).raw(data);
      }
    }
  }, "compiled");
  compiledWriters.set(desc, compiled);
  for (const field of sortedFields) {
    fieldWriters.push(compileField(field));
  }
  return compiled;
}
__name(compileMessage2, "compileMessage");
function compileField(field) {
  switch (field.fieldKind) {
    case "message":
    case "scalar":
    case "enum":
      return compileSingularField(field);
    case "list":
      return compileListField(field);
    case "map":
      return compileMapField(field);
  }
}
__name(compileField, "compileField");
function compileSingularField(field) {
  const writeValue = compileSingularValue(field);
  const localName = field.localName;
  if (field.oneof) {
    const oneofLocalName = field.oneof.localName;
    return (writer, opts, message) => {
      const oneof = message[oneofLocalName];
      if (oneof.case === localName) {
        writeValue(writer, opts, oneof.value);
      }
    };
  }
  if (field.presence != IMPLICIT3) {
    const requiredError = field.presence == LEGACY_REQUIRED2 ? `cannot encode ${field} to binary: required field not set` : void 0;
    return (writer, opts, message) => {
      const value = message[localName];
      if (value !== void 0 && Object.prototype.hasOwnProperty.call(message, localName)) {
        writeValue(writer, opts, value);
      } else if (requiredError !== void 0) {
        throw new Error(requiredError);
      }
    };
  }
  if (field.fieldKind == "enum") {
    const zero = field.enum.values[0].number;
    return (writer, opts, message) => {
      const value = message[localName];
      if (value !== zero) {
        writeValue(writer, opts, value);
      }
    };
  }
  switch (field.scalar) {
    case ScalarType.BOOL:
      return (writer, opts, message) => {
        const value = message[localName];
        if (value !== false) {
          writeValue(writer, opts, value);
        }
      };
    case ScalarType.STRING:
      return (writer, opts, message) => {
        const value = message[localName];
        if (value !== "") {
          writeValue(writer, opts, value);
        }
      };
    case ScalarType.BYTES:
      return (writer, opts, message) => {
        const value = message[localName];
        if (!(value instanceof Uint8Array) || value.byteLength > 0) {
          writeValue(writer, opts, value);
        }
      };
    case ScalarType.DOUBLE:
    case ScalarType.FLOAT:
      return (writer, opts, message) => {
        const value = message[localName];
        if (!Object.is(value, 0)) {
          writeValue(writer, opts, value);
        }
      };
    default:
      return (writer, opts, message) => {
        const value = message[localName];
        if (value != 0) {
          writeValue(writer, opts, value);
        }
      };
  }
}
__name(compileSingularField, "compileSingularField");
function compileSingularValue(field) {
  switch (field.fieldKind) {
    case "message": {
      const { toMessage } = localMessageMapper(field);
      const writeChild = compileChildWriter(field);
      return (writer, opts, value) => {
        writeChild(writer, opts, toMessage(value));
      };
    }
    case "scalar":
    case "enum": {
      const scalarType = field.fieldKind == "enum" ? ScalarType.INT32 : field.scalar;
      const fieldNo = field.number;
      const wireType = writeTypeOfScalar(scalarType);
      const writeScalar = compileScalarValue(scalarType, field.parent.typeName, field.name);
      return (writer, opts, value) => {
        writer.tag(fieldNo, wireType);
        writeScalar(writer, value);
      };
    }
  }
}
__name(compileSingularValue, "compileSingularValue");
function compileListField(field) {
  const localName = field.localName;
  const fieldNo = field.number;
  switch (field.listKind) {
    case "message": {
      const { toMessage } = localMessageMapper(field);
      const writeChild = compileChildWriter(field);
      return (writer, opts, message) => {
        const items = message[localName];
        for (let i = 0; i < items.length; i++) {
          writeChild(writer, opts, toMessage(items[i]));
        }
      };
    }
    case "scalar":
    case "enum": {
      const scalarType = field.listKind == "enum" ? ScalarType.INT32 : field.scalar;
      const writeScalar = compileScalarValue(scalarType, field.parent.typeName, field.name);
      if (field.packed) {
        return (writer, opts, message) => {
          const items = message[localName];
          if (items.length == 0) {
            return;
          }
          writer.tag(fieldNo, WireType.LengthDelimited).fork();
          for (let i = 0; i < items.length; i++) {
            writeScalar(writer, items[i]);
          }
          writer.join();
        };
      }
      const wireType = writeTypeOfScalar(scalarType);
      return (writer, opts, message) => {
        const items = message[localName];
        for (let i = 0; i < items.length; i++) {
          writer.tag(fieldNo, wireType);
          writeScalar(writer, items[i]);
        }
      };
    }
  }
}
__name(compileListField, "compileListField");
function compileMapField(field) {
  const localName = field.localName;
  const fieldNo = field.number;
  const writeKey = compileMapKey(field);
  if (field.mapKind == "message") {
    const { toMessage } = localMessageMapper(field);
    const writeMessage = compiledWriter(field.message);
    return (writer, opts, message) => {
      const record = message[localName];
      const keys = Object.keys(record);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        writer.tag(fieldNo, WireType.LengthDelimited).fork();
        writeKey(writer, key);
        writer.tag(2, WireType.LengthDelimited).fork();
        writeMessage(writer, opts, toMessage(record[key]));
        writer.join();
        writer.join();
      }
    };
  }
  const scalarType = field.mapKind == "enum" ? ScalarType.INT32 : field.scalar;
  const valueWireType = writeTypeOfScalar(scalarType);
  const writeScalar = compileScalarValue(scalarType, field.parent.typeName, field.name);
  return (writer, opts, message) => {
    const record = message[localName];
    const keys = Object.keys(record);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      writer.tag(fieldNo, WireType.LengthDelimited).fork();
      writeKey(writer, key);
      writer.tag(2, valueWireType);
      writeScalar(writer, record[key]);
      writer.join();
    }
  };
}
__name(compileMapField, "compileMapField");
function compileMapKey(field) {
  const wireType = writeTypeOfScalar(field.mapKey);
  const writeScalar = compileScalarValue(field.mapKey, field.parent.typeName, field.name);
  const convertKey = compileMapKeyConverter(field.mapKey);
  return (writer, key) => {
    writer.tag(1, wireType);
    writeScalar(writer, convertKey(key));
  };
}
__name(compileMapKey, "compileMapKey");
function compileMapKeyConverter(type) {
  switch (type) {
    case ScalarType.STRING:
      return (key) => key;
    case ScalarType.BOOL:
      return (key) => key === "true" ? true : key === "false" ? false : key;
    case ScalarType.UINT64:
    case ScalarType.FIXED64:
      return (key) => {
        try {
          return protoInt64.uParse(key);
        } catch (_a) {
          return key;
        }
      };
    case ScalarType.INT64:
    case ScalarType.SFIXED64:
    case ScalarType.SINT64:
      return (key) => {
        try {
          return protoInt64.parse(key);
        } catch (_a) {
          return key;
        }
      };
    default:
      return (key) => {
        const n = Number.parseInt(key);
        return Number.isFinite(n) ? n : key;
      };
  }
}
__name(compileMapKeyConverter, "compileMapKeyConverter");
function compileScalarValue(type, messageName, fieldName) {
  const writeScalar = compileScalarWrite(type);
  return (writer, value) => {
    try {
      writeScalar(writer, value);
    } catch (e) {
      if (e instanceof Error) {
        throw new Error(`cannot encode field ${messageName}.${fieldName} to binary: ${e.message}`);
      }
      throw e;
    }
  };
}
__name(compileScalarValue, "compileScalarValue");
function compileScalarWrite(type) {
  switch (type) {
    case ScalarType.STRING:
      return (writer, value) => writer.string(value);
    case ScalarType.BOOL:
      return (writer, value) => writer.bool(value);
    case ScalarType.DOUBLE:
      return (writer, value) => writer.double(value);
    case ScalarType.FLOAT:
      return (writer, value) => writer.float(value);
    case ScalarType.INT32:
      return (writer, value) => writer.int32(value);
    case ScalarType.INT64:
      return (writer, value) => writer.int64(value);
    case ScalarType.UINT64:
      return (writer, value) => writer.uint64(value);
    case ScalarType.FIXED64:
      return (writer, value) => writer.fixed64(value);
    case ScalarType.BYTES:
      return (writer, value) => writer.bytes(value);
    case ScalarType.FIXED32:
      return (writer, value) => writer.fixed32(value);
    case ScalarType.SFIXED32:
      return (writer, value) => writer.sfixed32(value);
    case ScalarType.SFIXED64:
      return (writer, value) => writer.sfixed64(value);
    case ScalarType.SINT64:
      return (writer, value) => writer.sint64(value);
    case ScalarType.UINT32:
      return (writer, value) => writer.uint32(value);
    case ScalarType.SINT32:
      return (writer, value) => writer.sint32(value);
  }
}
__name(compileScalarWrite, "compileScalarWrite");
function compileChildWriter(field) {
  const fieldNo = field.number;
  const writeMessage = compiledWriter(field.message);
  if (field.delimitedEncoding) {
    return (writer, opts, child) => {
      writer.tag(fieldNo, WireType.StartGroup);
      writeMessage(writer, opts, child);
      writer.tag(fieldNo, WireType.EndGroup);
    };
  }
  return (writer, opts, child) => {
    writer.tag(fieldNo, WireType.LengthDelimited).fork();
    writeMessage(writer, opts, child);
    writer.join();
  };
}
__name(compileChildWriter, "compileChildWriter");
function writeTypeOfScalar(type) {
  switch (type) {
    case ScalarType.BYTES:
    case ScalarType.STRING:
      return WireType.LengthDelimited;
    case ScalarType.DOUBLE:
    case ScalarType.FIXED64:
    case ScalarType.SFIXED64:
      return WireType.Bit64;
    case ScalarType.FIXED32:
    case ScalarType.SFIXED32:
    case ScalarType.FLOAT:
      return WireType.Bit32;
    default:
      return WireType.Varint;
  }
}
__name(writeTypeOfScalar, "writeTypeOfScalar");

// ../node_modules/@bufbuild/protobuf/dist/esm/wkt/google/protobuf/empty_pb.js
var file_google_protobuf_empty = /* @__PURE__ */ fileDesc("Chtnb29nbGUvcHJvdG9idWYvZW1wdHkucHJvdG8SD2dvb2dsZS5wcm90b2J1ZiIHCgVFbXB0eUJ9ChNjb20uZ29vZ2xlLnByb3RvYnVmQgpFbXB0eVByb3RvUAFaLmdvb2dsZS5nb2xhbmcub3JnL3Byb3RvYnVmL3R5cGVzL2tub3duL2VtcHR5cGL4AQGiAgNHUEKqAh5Hb29nbGUuUHJvdG9idWYuV2VsbEtub3duVHlwZXNiBnByb3RvMw");

// proto/rerun/v1alpha1/common_pb.ts
var file_rerun_v1alpha1_common = /* @__PURE__ */ fileDesc("ChtyZXJ1bi92MWFscGhhMS9jb21tb24ucHJvdG8SFXJlcnVuLmNvbW1vbi52MWFscGhhMSJuCgpSZXJ1bkNodW5rEj4KD2VuY29kZXJfdmVyc2lvbhgBIAEoDjIlLnJlcnVuLmNvbW1vbi52MWFscGhhMS5FbmNvZGVyVmVyc2lvbhIUCgdwYXlsb2FkGAIgASgMSACIAQFCCgoIX3BheWxvYWQiFQoHVGFibGVJZBIKCgJpZBgBIAEoCSIYCghUaW1lbGluZRIMCgRuYW1lGAEgASgJIhwKDFRpbWVsaW5lVGltZRIMCgR0aW1lGAEgASgDIicKCVRpbWVSYW5nZRINCgVzdGFydBgBIAEoAxILCgNlbmQYAiABKAMiNAoGU2NoZW1hEhkKDGFycm93X3NjaGVtYRgBIAEoDEgAiAEBQg8KDV9hcnJvd19zY2hlbWEiSAoTSW5kZXhDb2x1bW5TZWxlY3RvchIxCgh0aW1lbGluZRgBIAEoCzIfLnJlcnVuLmNvbW1vbi52MWFscGhhMS5UaW1lbGluZSJCCgpJbmRleFJhbmdlEjQKCnRpbWVfcmFuZ2UYASABKAsyIC5yZXJ1bi5jb21tb24udjFhbHBoYTEuVGltZVJhbmdlIhoKCkVudGl0eVBhdGgSDAoEcGF0aBgBIAEoCSIbCg1BcHBsaWNhdGlvbklkEgoKAmlkGAEgASgJIo0BCgdTdG9yZUlkEi4KBGtpbmQYASABKA4yIC5yZXJ1bi5jb21tb24udjFhbHBoYTEuU3RvcmVLaW5kEhQKDHJlY29yZGluZ19pZBgCIAEoCRI8Cg5hcHBsaWNhdGlvbl9pZBgDIAEoCzIkLnJlcnVuLmNvbW1vbi52MWFscGhhMS5BcHBsaWNhdGlvbklkIkIKBFR1aWQSFAoHdGltZV9ucxgBIAEoBkgAiAEBEhAKA2luYxgCIAEoBkgBiAEBQgoKCF90aW1lX25zQgYKBF9pbmMiMgoHRW50cnlJZBInCgJpZBgBIAEoCzIbLnJlcnVuLmNvbW1vbi52MWFscGhhMS5UdWlkIt8BCg1EYXRhc2V0SGFuZGxlEjAKCGVudHJ5X2lkGAEgASgLMh4ucmVydW4uY29tbW9uLnYxYWxwaGExLkVudHJ5SWQSOAoKc3RvcmVfa2luZBgDIAEoDjIgLnJlcnVuLmNvbW1vbi52MWFscGhhMS5TdG9yZUtpbmRCAhgBEjgKDGRhdGFzZXRfa2luZBgEIAEoDjIiLnJlcnVuLmNvbW1vbi52MWFscGhhMS5EYXRhc2V0S2luZBIYCgtkYXRhc2V0X3VybBgCIAEoCUgAiAEBQg4KDF9kYXRhc2V0X3VybCLFAQoNRGF0YWZyYW1lUGFydBI+Cg9lbmNvZGVyX3ZlcnNpb24YASABKA4yJS5yZXJ1bi5jb21tb24udjFhbHBoYTEuRW5jb2RlclZlcnNpb24SFAoHcGF5bG9hZBgCIAEoDEgAiAEBEjcKC2NvbXByZXNzaW9uGAMgASgOMiIucmVydW4uY29tbW9uLnYxYWxwaGExLkNvbXByZXNzaW9uEhkKEXVuY29tcHJlc3NlZF9zaXplGAQgASgEQgoKCF9wYXlsb2FkIssCCg5TY2FuUGFyYW1ldGVycxIPCgdjb2x1bW5zGAEgAygJEkQKEm9uX21pc3NpbmdfY29sdW1ucxgCIAEoDjIoLnJlcnVuLmNvbW1vbi52MWFscGhhMS5JZk1pc3NpbmdCZWhhdmlvchITCgZmaWx0ZXIYAyABKAlIAIgBARIZCgxsaW1pdF9vZmZzZXQYBCABKANIAYgBARIWCglsaW1pdF9sZW4YBSABKANIAogBARJCCghvcmRlcl9ieRgGIAMoCzIwLnJlcnVuLmNvbW1vbi52MWFscGhhMS5TY2FuUGFyYW1ldGVyc09yZGVyQ2xhdXNlEhQKDGV4cGxhaW5fcGxhbhgHIAEoCBIWCg5leHBsYWluX2ZpbHRlchgIIAEoCEIJCgdfZmlsdGVyQg8KDV9saW1pdF9vZmZzZXRCDAoKX2xpbWl0X2xlbiJtChlTY2FuUGFyYW1ldGVyc09yZGVyQ2xhdXNlEhIKCmRlc2NlbmRpbmcYASABKAgSEgoKbnVsbHNfbGFzdBgCIAEoCBIYCgtjb2x1bW5fbmFtZRgDIAEoCUgAiAEBQg4KDF9jb2x1bW5fbmFtZSIjCglTZWdtZW50SWQSDwoCaWQYASABKAlIAIgBAUIFCgNfaWQiKgoIU2NoZW1hSWQSEwoGc2hhMjU2GAEgASgMSACIAQFCCQoHX3NoYTI1NiLZAQoTQ29tcG9uZW50RGVzY3JpcHRvchIWCglhcmNoZXR5cGUYBCABKAlIAIgBARIWCgljb21wb25lbnQYBSABKAlIAYgBARIbCg5jb21wb25lbnRfdHlwZRgGIAEoCUgCiAEBQgwKCl9hcmNoZXR5cGVCDAoKX2NvbXBvbmVudEIRCg9fY29tcG9uZW50X3R5cGVKBAgBEAJKBAgCEANKBAgDEARSDmFyY2hldHlwZV9uYW1lUhRhcmNoZXR5cGVfZmllbGRfbmFtZVIOY29tcG9uZW50X25hbWUiFAoGVGFza0lkEgoKAmlkGAEgASgJIs0DCglCdWlsZEluZm8SFwoKY3JhdGVfbmFtZRgBIAEoCUgAiAEBEhUKCGZlYXR1cmVzGAIgASgJSAGIAQESPAoHdmVyc2lvbhgDIAEoCzImLnJlcnVuLmNvbW1vbi52MWFscGhhMS5TZW1hbnRpY1ZlcnNpb25IAogBARIaCg1ydXN0Y192ZXJzaW9uGAQgASgJSAOIAQESGQoMbGx2bV92ZXJzaW9uGAUgASgJSASIAQESFQoIZ2l0X2hhc2gYBiABKAlIBYgBARIXCgpnaXRfYnJhbmNoGAcgASgJSAaIAQESGgoNdGFyZ2V0X3RyaXBsZRgIIAEoCUgHiAEBEhcKCmJ1aWxkX3RpbWUYCSABKAlICIgBARIbCg5pc19kZWJ1Z19idWlsZBgKIAEoCEgJiAEBQg0KC19jcmF0ZV9uYW1lQgsKCV9mZWF0dXJlc0IKCghfdmVyc2lvbkIQCg5fcnVzdGNfdmVyc2lvbkIPCg1fbGx2bV92ZXJzaW9uQgsKCV9naXRfaGFzaEINCgtfZ2l0X2JyYW5jaEIQCg5fdGFyZ2V0X3RyaXBsZUINCgtfYnVpbGRfdGltZUIRCg9faXNfZGVidWdfYnVpbGQiyAEKD1NlbWFudGljVmVyc2lvbhISCgVtYWpvchgBIAEoB0gBiAEBEhIKBW1pbm9yGAIgASgHSAKIAQESEgoFcGF0Y2gYAyABKAdIA4gBARIMCgJyYxgEIAEoB0gAEg8KBWFscGhhGAUgASgHSAASNAoJZGV2X2FscGhhGAYgASgLMh8ucmVydW4uY29tbW9uLnYxYWxwaGExLkRldkFscGhhSABCBgoEbWV0YUIICgZfbWFqb3JCCAoGX21pbm9yQggKBl9wYXRjaCJICghEZXZBbHBoYRISCgVhbHBoYRgBIAEoB0gAiAEBEhMKBmNvbW1pdBgCIAEoCUgBiAEBQggKBl9hbHBoYUIJCgdfY29tbWl0KlUKC0NvbXByZXNzaW9uEhsKF0NPTVBSRVNTSU9OX1VOU1BFQ0lGSUVEEAASFAoQQ09NUFJFU1NJT05fTk9ORRABEhMKD0NPTVBSRVNTSU9OX0xaNBACKkkKDkVuY29kZXJWZXJzaW9uEh8KG0VOQ09ERVJfVkVSU0lPTl9VTlNQRUNJRklFRBAAEhYKEkVOQ09ERVJfVkVSU0lPTl9WMBABKnQKCFRpbWVUeXBlEhkKFVRJTUVfVFlQRV9VTlNQRUNJRklFRBAAEhYKElRJTUVfVFlQRV9TRVFVRU5DRRABEhkKFVRJTUVfVFlQRV9EVVJBVElPTl9OUxACEhoKFlRJTUVfVFlQRV9USU1FU1RBTVBfTlMQAypbCglTdG9yZUtpbmQSGgoWU1RPUkVfS0lORF9VTlNQRUNJRklFRBAAEhgKFFNUT1JFX0tJTkRfUkVDT1JESU5HEAESGAoUU1RPUkVfS0lORF9CTFVFUFJJTlQQAip7CgtEYXRhc2V0S2luZBIcChhEQVRBU0VUX0tJTkRfVU5TUEVDSUZJRUQQABIaChZEQVRBU0VUX0tJTkRfUkVDT1JESU5HEAESGgoWREFUQVNFVF9LSU5EX0JMVUVQUklOVBACEhYKEkRBVEFTRVRfS0lORF9BU1NFVBADKnUKEUlmTWlzc2luZ0JlaGF2aW9yEiMKH0lGX01JU1NJTkdfQkVIQVZJT1JfVU5TUEVDSUZJRUQQABIcChhJRl9NSVNTSU5HX0JFSEFWSU9SX1NLSVAQARIdChlJRl9NSVNTSU5HX0JFSEFWSU9SX0VSUk9SEAIqogEKE0lmRHVwbGljYXRlQmVoYXZpb3ISJQohSUZfRFVQTElDQVRFX0JFSEFWSU9SX1VOU1BFQ0lGSUVEEAASIwofSUZfRFVQTElDQVRFX0JFSEFWSU9SX09WRVJXUklURRABEh4KGklGX0RVUExJQ0FURV9CRUhBVklPUl9TS0lQEAISHwobSUZfRFVQTElDQVRFX0JFSEFWSU9SX0VSUk9SEANiBnByb3RvMw");

// proto/rerun/v1alpha1/log_msg_pb.ts
var file_rerun_v1alpha1_log_msg = /* @__PURE__ */ fileDesc("ChxyZXJ1bi92MWFscGhhMS9sb2dfbXNnLnByb3RvEhZyZXJ1bi5sb2dfbXNnLnYxYWxwaGExIuIBCgZMb2dNc2cSPgoOc2V0X3N0b3JlX2luZm8YASABKAsyJC5yZXJ1bi5sb2dfbXNnLnYxYWxwaGExLlNldFN0b3JlSW5mb0gAEjUKCWFycm93X21zZxgCIAEoCzIgLnJlcnVuLmxvZ19tc2cudjFhbHBoYTEuQXJyb3dNc2dIABJaChxibHVlcHJpbnRfYWN0aXZhdGlvbl9jb21tYW5kGAMgASgLMjIucmVydW4ubG9nX21zZy52MWFscGhhMS5CbHVlcHJpbnRBY3RpdmF0aW9uQ29tbWFuZEgAQgUKA21zZyJsCgxTZXRTdG9yZUluZm8SKwoGcm93X2lkGAEgASgLMhsucmVydW4uY29tbW9uLnYxYWxwaGExLlR1aWQSLwoEaW5mbxgCIAEoCzIhLnJlcnVuLmxvZ19tc2cudjFhbHBoYTEuU3RvcmVJbmZvIrwCCghBcnJvd01zZxIwCghzdG9yZV9pZBgBIAEoCzIeLnJlcnVuLmNvbW1vbi52MWFscGhhMS5TdG9yZUlkEjIKCGNodW5rX2lkGAYgASgLMhsucmVydW4uY29tbW9uLnYxYWxwaGExLlR1aWRIAIgBARI3Cgtjb21wcmVzc2lvbhgCIAEoDjIiLnJlcnVuLmNvbW1vbi52MWFscGhhMS5Db21wcmVzc2lvbhIZChF1bmNvbXByZXNzZWRfc2l6ZRgDIAEoBBIyCghlbmNvZGluZxgEIAEoDjIgLnJlcnVuLmxvZ19tc2cudjFhbHBoYTEuRW5jb2RpbmcSDwoHcGF5bG9hZBgFIAEoDBIWCglpc19zdGF0aWMYByABKAhIAYgBAUILCglfY2h1bmtfaWRCDAoKX2lzX3N0YXRpYyJ9ChpCbHVlcHJpbnRBY3RpdmF0aW9uQ29tbWFuZBI0CgxibHVlcHJpbnRfaWQYASABKAsyHi5yZXJ1bi5jb21tb24udjFhbHBoYTEuU3RvcmVJZBITCgttYWtlX2FjdGl2ZRgCIAEoCBIUCgxtYWtlX2RlZmF1bHQYAyABKAgioQIKCVN0b3JlSW5mbxJACg5hcHBsaWNhdGlvbl9pZBgBIAEoCzIkLnJlcnVuLmNvbW1vbi52MWFscGhhMS5BcHBsaWNhdGlvbklkQgIYARIwCghzdG9yZV9pZBgCIAEoCzIeLnJlcnVuLmNvbW1vbi52MWFscGhhMS5TdG9yZUlkEjkKDHN0b3JlX3NvdXJjZRgFIAEoCzIjLnJlcnVuLmxvZ19tc2cudjFhbHBoYTEuU3RvcmVTb3VyY2USOwoNc3RvcmVfdmVyc2lvbhgGIAEoCzIkLnJlcnVuLmxvZ19tc2cudjFhbHBoYTEuU3RvcmVWZXJzaW9uSgQIAxAESgQIBBAFUhNpc19vZmZpY2lhbF9leGFtcGxlUgdzdGFydGVkIn0KC1N0b3JlU291cmNlEjUKBGtpbmQYASABKA4yJy5yZXJ1bi5sb2dfbXNnLnYxYWxwaGExLlN0b3JlU291cmNlS2luZBI3CgVleHRyYRgCIAEoCzIoLnJlcnVuLmxvZ19tc2cudjFhbHBoYTEuU3RvcmVTb3VyY2VFeHRyYSIjChBTdG9yZVNvdXJjZUV4dHJhEg8KB3BheWxvYWQYASABKAwiTAoNUHl0aG9uVmVyc2lvbhINCgVtYWpvchgBIAEoBRINCgVtaW5vchgCIAEoBRINCgVwYXRjaBgDIAEoBRIOCgZzdWZmaXgYBCABKAkiOAoJQ3JhdGVJbmZvEhUKDXJ1c3RjX3ZlcnNpb24YASABKAkSFAoMbGx2bV92ZXJzaW9uGAIgASgJIkIKCkZpbGVTb3VyY2USNAoEa2luZBgBIAEoDjImLnJlcnVuLmxvZ19tc2cudjFhbHBoYTEuRmlsZVNvdXJjZUtpbmQiKgoMU3RvcmVWZXJzaW9uEhoKEmNyYXRlX3ZlcnNpb25fYml0cxgBIAEoBSJDCglScmRGb290ZXISNgoJbWFuaWZlc3RzGAEgAygLMiMucmVydW4ubG9nX21zZy52MWFscGhhMS5ScmRNYW5pZmVzdCLlAQoLUnJkTWFuaWZlc3QSMAoIc3RvcmVfaWQYASABKAsyHi5yZXJ1bi5jb21tb24udjFhbHBoYTEuU3RvcmVJZBI0Cg1zb3JiZXRfc2NoZW1hGAIgASgLMh0ucmVydW4uY29tbW9uLnYxYWxwaGExLlNjaGVtYRIhChRzb3JiZXRfc2NoZW1hX3NoYTI1NhgDIAEoDEgAiAEBEjIKBGRhdGEYBCABKAsyJC5yZXJ1bi5jb21tb24udjFhbHBoYTEuRGF0YWZyYW1lUGFydEIXChVfc29yYmV0X3NjaGVtYV9zaGEyNTYqPAoIRW5jb2RpbmcSGAoURU5DT0RJTkdfVU5TUEVDSUZJRUQQABIWChJFTkNPRElOR19BUlJPV19JUEMQASrqAQoPU3RvcmVTb3VyY2VLaW5kEiEKHVNUT1JFX1NPVVJDRV9LSU5EX1VOU1BFQ0lGSUVEEAASGwoXU1RPUkVfU09VUkNFX0tJTkRfQ19TREsQARIgChxTVE9SRV9TT1VSQ0VfS0lORF9QWVRIT05fU0RLEAISHgoaU1RPUkVfU09VUkNFX0tJTkRfUlVTVF9TREsQAxIaChZTVE9SRV9TT1VSQ0VfS0lORF9GSUxFEAQSHAoYU1RPUkVfU09VUkNFX0tJTkRfVklFV0VSEAUSGwoXU1RPUkVfU09VUkNFX0tJTkRfT1RIRVIQBirGAQoORmlsZVNvdXJjZUtpbmQSIAocRklMRV9TT1VSQ0VfS0lORF9VTlNQRUNJRklFRBAAEhgKFEZJTEVfU09VUkNFX0tJTkRfQ0xJEAESGAoURklMRV9TT1VSQ0VfS0lORF9VUkkQAhIiCh5GSUxFX1NPVVJDRV9LSU5EX0RSQUdfQU5EX0RST1AQAxIgChxGSUxFX1NPVVJDRV9LSU5EX0ZJTEVfRElBTE9HEAQSGAoURklMRV9TT1VSQ0VfS0lORF9TREsQBWIGcHJvdG8z", [file_rerun_v1alpha1_common]);

// proto/rerun/v1alpha1/cloud_pb.ts
var file_rerun_v1alpha1_cloud = /* @__PURE__ */ fileDesc("ChpyZXJ1bi92MWFscGhhMS9jbG91ZC5wcm90bxIUcmVydW4uY2xvdWQudjFhbHBoYTEiEAoOVmVyc2lvblJlcXVlc3QixgEKD1ZlcnNpb25SZXNwb25zZRI0CgpidWlsZF9pbmZvGAEgASgLMiAucmVydW4uY29tbW9uLnYxYWxwaGExLkJ1aWxkSW5mbxIPCgd2ZXJzaW9uGAIgASgJEhsKDmNsb3VkX3Byb3ZpZGVyGAMgASgJSACIAQESGQoMY2xvdWRfcmVnaW9uGAQgASgJSAGIAQESEAoIZmVhdHVyZXMYBSADKAlCEQoPX2Nsb3VkX3Byb3ZpZGVyQg8KDV9jbG91ZF9yZWdpb24iKgoSU2VydmVyQ2FwYWJpbGl0aWVzEhQKDGNhcGFiaWxpdGllcxgBIAMoCSIPCg1XaG9BbUlSZXF1ZXN0Iq0BCg5XaG9BbUlSZXNwb25zZRIUCgd1c2VyX2lkGAEgASgJSACIAQESEAoIY2FuX3JlYWQYAiABKAgSEQoJY2FuX3dyaXRlGAMgASgIEkMKDGNhcGFiaWxpdGllcxgEIAEoCzIoLnJlcnVuLmNsb3VkLnYxYWxwaGExLlNlcnZlckNhcGFiaWxpdGllc0gBiAEBQgoKCF91c2VyX2lkQg8KDV9jYXBhYmlsaXRpZXMiKwoWRG9CYW5kd2lkdGhUZXN0UmVxdWVzdBIRCgludW1fYnl0ZXMYASABKAQiKgoXRG9CYW5kd2lkdGhUZXN0UmVzcG9uc2USDwoHcGF5bG9hZBgBIAEoDCJEChJXYXRjaEV2ZW50c1JlcXVlc3QSLgoFa2luZHMYASADKAsyHy5yZXJ1bi5jbG91ZC52MWFscGhhMS5FdmVudEtpbmQiRwoJRXZlbnRLaW5kEjIKBWVudHJ5GAEgASgLMiEucmVydW4uY2xvdWQudjFhbHBoYTEuRW50cnlFdmVudHNIAEIGCgRraW5kIg0KC0VudHJ5RXZlbnRzIqEBChNXYXRjaEV2ZW50c1Jlc3BvbnNlEkAKDWVudHJ5X2NyZWF0ZWQYASABKAsyJy5yZXJ1bi5jbG91ZC52MWFscGhhMS5FbnRyeUNyZWF0ZWRFdmVudEgAEkAKDWVudHJ5X2RlbGV0ZWQYAiABKAsyJy5yZXJ1bi5jbG91ZC52MWFscGhhMS5FbnRyeURlbGV0ZWRFdmVudEgAQgYKBGtpbmQiPwoRRW50cnlDcmVhdGVkRXZlbnQSKgoCaWQYASABKAsyHi5yZXJ1bi5jb21tb24udjFhbHBoYTEuRW50cnlJZCI/ChFFbnRyeURlbGV0ZWRFdmVudBIqCgJpZBgBIAEoCzIeLnJlcnVuLmNvbW1vbi52MWFscGhhMS5FbnRyeUlkIlMKBUVycm9yEi0KBGNvZGUYASABKA4yHy5yZXJ1bi5jbG91ZC52MWFscGhhMS5FcnJvckNvZGUSCgoCaWQYAiABKAkSDwoHbWVzc2FnZRgDIAEoCSKOAgoaR2V0V3JpdGVBY2Nlc3NHcmFudFJlcXVlc3QSCwoDa2V5GAEgASgJEhcKCnNpemVfYnl0ZXMYAyABKARIAIgBARJEChhzdXBwb3J0ZWRfdXBsb2FkX21ldGhvZHMYBCADKA4yIi5yZXJ1bi5jbG91ZC52MWFscGhhMS5VcGxvYWRNZXRob2QSMQoHc2lnbmluZxgFIAEoDjIgLnJlcnVuLmNsb3VkLnYxYWxwaGExLlVybFNpZ25pbmcSHQoQc3RvcmFnZV9sb2NhdGlvbhgGIAEoCUgBiAEBQg0KC19zaXplX2J5dGVzQhMKEV9zdG9yYWdlX2xvY2F0aW9uSgQIAhADUghsb2NhdGlvbiIcChpHZXRTdG9yYWdlTG9jYXRpb25zUmVxdWVzdCJ2ChtHZXRTdG9yYWdlTG9jYXRpb25zUmVzcG9uc2USQAoRc3RvcmFnZV9sb2NhdGlvbnMYASADKAsyJS5yZXJ1bi5jbG91ZC52MWFscGhhMS5TdG9yYWdlTG9jYXRpb24SFQoNZGVmYXVsdF9hbGlhcxgCIAEoCSKkAQoPU3RvcmFnZUxvY2F0aW9uEg0KBWFsaWFzGAEgASgJEhkKDGRpc3BsYXlfbmFtZRgCIAEoCUgAiAEBEg4KBnJlZ2lvbhgDIAEoCRITCgtidWNrZXRfbmFtZRgEIAEoCRITCgZwcmVmaXgYBSABKAlIAYgBARIRCglyZWFkX29ubHkYBiABKAhCDwoNX2Rpc3BsYXlfbmFtZUIJCgdfcHJlZml4ImQKG0dldFdyaXRlQWNjZXNzR3JhbnRSZXNwb25zZRITCgtzdG9yYWdlX3VybBgBIAEoCRIwCgVncmFudBgCIAEoCzIhLnJlcnVuLmNsb3VkLnYxYWxwaGExLkFjY2Vzc0dyYW50Iv4BCgtBY2Nlc3NHcmFudBIuCgpleHBpcmVzX2F0GAEgASgLMhouZ29vZ2xlLnByb3RvYnVmLlRpbWVzdGFtcBI5CgxodHRwX3JlcXVlc3QYAiABKAsyIS5yZXJ1bi5jbG91ZC52MWFscGhhMS5IdHRwUmVxdWVzdEgAEkMKEW11bHRpcGFydF9zZXNzaW9uGAMgASgLMiYucmVydW4uY2xvdWQudjFhbHBoYTEuTXVsdGlwYXJ0U2Vzc2lvbkgAEjEKB3NpZ25pbmcYBCABKA4yIC5yZXJ1bi5jbG91ZC52MWFscGhhMS5VcmxTaWduaW5nQgwKCnJlZGVtcHRpb24iqwEKEE11bHRpcGFydFNlc3Npb24SFAoMdXBsb2FkX3Rva2VuGAEgASgMEhcKD3BhcnRfc2l6ZV9ieXRlcxgCIAEoBBI4Cg1wYXJ0X3JlcXVlc3RzGAMgAygLMiEucmVydW4uY2xvdWQudjFhbHBoYTEuSHR0cFJlcXVlc3QSGwoObWF4X3BhcnRfY291bnQYBCABKA1IAIgBAUIRCg9fbWF4X3BhcnRfY291bnQiUQojR2V0TXVsdGlwYXJ0VXBsb2FkUGFydEdyYW50c1JlcXVlc3QSFAoMdXBsb2FkX3Rva2VuGAEgASgMEhQKDHBhcnRfbnVtYmVycxgCIAMoDSJbCiRHZXRNdWx0aXBhcnRVcGxvYWRQYXJ0R3JhbnRzUmVzcG9uc2USMwoIcmVxdWVzdHMYASADKAsyIS5yZXJ1bi5jbG91ZC52MWFscGhhMS5IdHRwUmVxdWVzdCJpCh5Db21wbGV0ZU11bHRpcGFydFVwbG9hZFJlcXVlc3QSFAoMdXBsb2FkX3Rva2VuGAEgASgMEjEKBXBhcnRzGAIgAygLMiIucmVydW4uY2xvdWQudjFhbHBoYTEuVXBsb2FkZWRQYXJ0IjEKDFVwbG9hZGVkUGFydBITCgtwYXJ0X251bWJlchgBIAEoDRIMCgRldGFnGAIgASgJIiEKH0NvbXBsZXRlTXVsdGlwYXJ0VXBsb2FkUmVzcG9uc2UiMwobQWJvcnRNdWx0aXBhcnRVcGxvYWRSZXF1ZXN0EhQKDHVwbG9hZF90b2tlbhgBIAEoDCIeChxBYm9ydE11bHRpcGFydFVwbG9hZFJlc3BvbnNlInIKC0h0dHBSZXF1ZXN0Eg4KBm1ldGhvZBgBIAEoCRILCgN1cmwYAiABKAkSMQoHaGVhZGVycxgDIAMoCzIgLnJlcnVuLmNsb3VkLnYxYWxwaGExLkh0dHBIZWFkZXISEwoLc2FtZV9vcmlnaW4YBCABKAgiKQoKSHR0cEhlYWRlchIMCgRuYW1lGAEgASgJEg0KBXZhbHVlGAIgASgJIpwCCgpEYXRhU291cmNlEhgKC3N0b3JhZ2VfdXJsGAEgASgJSACIAQESEgoFbGF5ZXIYAyABKAlIAYgBARIOCgZwcmVmaXgYBCABKAgSMQoDdHlwGAIgASgOMiQucmVydW4uY2xvdWQudjFhbHBoYTEuRGF0YVNvdXJjZUtpbmQSJAoTb2JqZWN0X3N0b3JlX2NvbmZpZxgGIAEoCUICGAFIAogBARIdChBzdG9yYWdlX2xvY2F0aW9uGAcgASgJSAOIAQFCDgoMX3N0b3JhZ2VfdXJsQggKBl9sYXllckIWChRfb2JqZWN0X3N0b3JlX2NvbmZpZ0ITChFfc3RvcmFnZV9sb2NhdGlvbkoECAUQBlILbGF5ZXJfY2xhc3MiqAEKGlJlZ2lzdGVyV2l0aERhdGFzZXRSZXF1ZXN0EjYKDGRhdGFfc291cmNlcxgCIAMoCzIgLnJlcnVuLmNsb3VkLnYxYWxwaGExLkRhdGFTb3VyY2USQAoMb25fZHVwbGljYXRlGAMgASgOMioucmVydW4uY29tbW9uLnYxYWxwaGExLklmRHVwbGljYXRlQmVoYXZpb3JKBAgBEAJSCmRhdGFzZXRfaWQiUQobUmVnaXN0ZXJXaXRoRGF0YXNldFJlc3BvbnNlEjIKBGRhdGEYASABKAsyJC5yZXJ1bi5jb21tb24udjFhbHBoYTEuRGF0YWZyYW1lUGFydCKBAQocVW5yZWdpc3RlckZyb21EYXRhc2V0UmVxdWVzdBI6ChBzZWdtZW50c190b19kcm9wGAEgAygLMiAucmVydW4uY29tbW9uLnYxYWxwaGExLlNlZ21lbnRJZBIWCg5sYXllcnNfdG9fZHJvcBgCIAMoCRINCgVmb3JjZRgDIAEoCCKDAQodVW5yZWdpc3RlckZyb21EYXRhc2V0UmVzcG9uc2USMgoEZGF0YRgBIAEoCzIkLnJlcnVuLmNvbW1vbi52MWFscGhhMS5EYXRhZnJhbWVQYXJ0Ei4KB3Rhc2tfaWQYAiABKAsyHS5yZXJ1bi5jb21tb24udjFhbHBoYTEuVGFza0lkImEKE0RhdGFzZXRSZXNwb25zZU1ldGESMAoIZW50cnlfaWQYASABKAsyHi5yZXJ1bi5jb21tb24udjFhbHBoYTEuRW50cnlJZBIYChBkYXRhc2V0X3JldmlzaW9uGAIgASgEIh4KHEdldFNlZ21lbnRUYWJsZVNjaGVtYVJlcXVlc3QihwEKHUdldFNlZ21lbnRUYWJsZVNjaGVtYVJlc3BvbnNlEi0KBnNjaGVtYRgBIAEoCzIdLnJlcnVuLmNvbW1vbi52MWFscGhhMS5TY2hlbWESNwoEbWV0YRhkIAEoCzIpLnJlcnVuLmNsb3VkLnYxYWxwaGExLkRhdGFzZXRSZXNwb25zZU1ldGEiJAoNU2VnbWVudElkTGlzdBITCgtzZWdtZW50X2lkcxgBIAMoCSKMAQoPU2VnbWVudElkRmlsdGVyEjgKCXNjYW5fb25seRgBIAEoCzIjLnJlcnVuLmNsb3VkLnYxYWxwaGExLlNlZ21lbnRJZExpc3RIABIzCgRza2lwGAIgASgLMiMucmVydW4uY2xvdWQudjFhbHBoYTEuU2VnbWVudElkTGlzdEgAQgoKCHN0cmF0ZWd5IiQKDUxheWVyTmFtZUxpc3QSEwoLbGF5ZXJfbmFtZXMYASADKAkijAEKD0xheWVyTmFtZUZpbHRlchI4CglzY2FuX29ubHkYASABKAsyIy5yZXJ1bi5jbG91ZC52MWFscGhhMS5MYXllck5hbWVMaXN0SAASMwoEc2tpcBgCIAEoCzIjLnJlcnVuLmNsb3VkLnYxYWxwaGExLkxheWVyTmFtZUxpc3RIAEIKCghzdHJhdGVneSJ+ChdTY2FuU2VnbWVudFRhYmxlUmVxdWVzdBIPCgdjb2x1bW5zGAEgAygJEkAKEXNlZ21lbnRfaWRfZmlsdGVyGAMgASgLMiUucmVydW4uY2xvdWQudjFhbHBoYTEuU2VnbWVudElkRmlsdGVySgQIAhADUgpzcWxfZmlsdGVyIocBChhTY2FuU2VnbWVudFRhYmxlUmVzcG9uc2USMgoEZGF0YRgBIAEoCzIkLnJlcnVuLmNvbW1vbi52MWFscGhhMS5EYXRhZnJhbWVQYXJ0EjcKBG1ldGEYZCABKAsyKS5yZXJ1bi5jbG91ZC52MWFscGhhMS5EYXRhc2V0UmVzcG9uc2VNZXRhIiEKH0dldERhdGFzZXRNYW5pZmVzdFNjaGVtYVJlcXVlc3QiigEKIEdldERhdGFzZXRNYW5pZmVzdFNjaGVtYVJlc3BvbnNlEi0KBnNjaGVtYRgBIAEoCzIdLnJlcnVuLmNvbW1vbi52MWFscGhhMS5TY2hlbWESNwoEbWV0YRhkIAEoCzIpLnJlcnVuLmNsb3VkLnYxYWxwaGExLkRhdGFzZXRSZXNwb25zZU1ldGEiwwEKGlNjYW5EYXRhc2V0TWFuaWZlc3RSZXF1ZXN0Eg8KB2NvbHVtbnMYAyADKAkSQAoRc2VnbWVudF9pZF9maWx0ZXIYBSABKAsyJS5yZXJ1bi5jbG91ZC52MWFscGhhMS5TZWdtZW50SWRGaWx0ZXISQAoRbGF5ZXJfbmFtZV9maWx0ZXIYBiABKAsyJS5yZXJ1bi5jbG91ZC52MWFscGhhMS5MYXllck5hbWVGaWx0ZXJKBAgEEAVSCnNxbF9maWx0ZXIiigEKG1NjYW5EYXRhc2V0TWFuaWZlc3RSZXNwb25zZRIyCgRkYXRhGAEgASgLMiQucmVydW4uY29tbW9uLnYxYWxwaGExLkRhdGFmcmFtZVBhcnQSNwoEbWV0YRhkIAEoCzIpLnJlcnVuLmNsb3VkLnYxYWxwaGExLkRhdGFzZXRSZXNwb25zZU1ldGEiYwoXR2V0RGF0YXNldFNjaGVtYVJlcXVlc3QSNgoFc2NvcGUYAiABKA4yJy5yZXJ1bi5jbG91ZC52MWFscGhhMS5EYXRhc2V0UXVlcnlTY29wZUoECAEQAlIKZGF0YXNldF9pZCKCAQoYR2V0RGF0YXNldFNjaGVtYVJlc3BvbnNlEi0KBnNjaGVtYRgBIAEoCzIdLnJlcnVuLmNvbW1vbi52MWFscGhhMS5TY2hlbWESNwoEbWV0YRhkIAEoCzIpLnJlcnVuLmNsb3VkLnYxYWxwaGExLkRhdGFzZXRSZXNwb25zZU1ldGEiSAoRR2V0U2NoZW1hc1JlcXVlc3QSMwoKc2NoZW1hX2lkcxgBIAMoCzIfLnJlcnVuLmNvbW1vbi52MWFscGhhMS5TY2hlbWFJZCKwAQoSR2V0U2NoZW1hc1Jlc3BvbnNlEjIKCXNjaGVtYV9pZBgBIAEoCzIfLnJlcnVuLmNvbW1vbi52MWFscGhhMS5TY2hlbWFJZBItCgZzY2hlbWEYAiABKAsyHS5yZXJ1bi5jb21tb24udjFhbHBoYTEuU2NoZW1hEjcKBG1ldGEYZCABKAsyKS5yZXJ1bi5jbG91ZC52MWFscGhhMS5EYXRhc2V0UmVzcG9uc2VNZXRhImsKFUdldFJyZE1hbmlmZXN0UmVxdWVzdBI0CgpzZWdtZW50X2lkGAEgASgLMiAucmVydW4uY29tbW9uLnYxYWxwaGExLlNlZ21lbnRJZBIcChRnZW5lcmF0ZV9kaXJlY3RfdXJscxgCIAEoCCLIAQoWR2V0UnJkTWFuaWZlc3RSZXNwb25zZRI5CgxycmRfbWFuaWZlc3QYASABKAsyIy5yZXJ1bi5sb2dfbXNnLnYxYWxwaGExLlJyZE1hbmlmZXN0EjoKDG1hbmlmZXN0X2tleRgCIAEoCzIkLnJlcnVuLmNsb3VkLnYxYWxwaGExLlJyZE1hbmlmZXN0S2V5EjcKBG1ldGEYZCABKAsyKS5yZXJ1bi5jbG91ZC52MWFscGhhMS5EYXRhc2V0UmVzcG9uc2VNZXRhIlIKGkdldEFzc2V0c0ZvclNlZ21lbnRSZXF1ZXN0EjQKCnNlZ21lbnRfaWQYASABKAsyIC5yZXJ1bi5jb21tb24udjFhbHBoYTEuU2VnbWVudElkIpABChtHZXRBc3NldHNGb3JTZWdtZW50UmVzcG9uc2USNAoMYXNzZXRzX2VudHJ5GAEgASgLMh4ucmVydW4uY29tbW9uLnYxYWxwaGExLkVudHJ5SWQSOwoRYXNzZXRfc2VnbWVudF9pZHMYAiADKAsyIC5yZXJ1bi5jb21tb24udjFhbHBoYTEuU2VnbWVudElkIlQKG0dldFNlZ21lbnRQcm9wZXJ0aWVzUmVxdWVzdBI1CgtzZWdtZW50X2lkcxgBIAMoCzIgLnJlcnVuLmNvbW1vbi52MWFscGhhMS5TZWdtZW50SWQiWQocR2V0U2VnbWVudFByb3BlcnRpZXNSZXNwb25zZRI5CghzZWdtZW50cxgBIAMoCzInLnJlcnVuLmNsb3VkLnYxYWxwaGExLlNlZ21lbnRQcm9wZXJ0aWVzIpUBChFTZWdtZW50UHJvcGVydGllcxI0CgpzZWdtZW50X2lkGAEgASgLMiAucmVydW4uY29tbW9uLnYxYWxwaGExLlNlZ21lbnRJZBI4Cgpwcm9wZXJ0aWVzGAIgASgLMiQucmVydW4uY29tbW9uLnYxYWxwaGExLkRhdGFmcmFtZVBhcnQSEAoIcmV2aXNpb24YAyABKAQiwwEKG1NldFNlZ21lbnRQcm9wZXJ0aWVzUmVxdWVzdBI0CgpzZWdtZW50X2lkGAEgASgLMiAucmVydW4uY29tbW9uLnYxYWxwaGExLlNlZ21lbnRJZBI4Cgpwcm9wZXJ0aWVzGAIgASgLMiQucmVydW4uY29tbW9uLnYxYWxwaGExLkRhdGFmcmFtZVBhcnQSHgoRZXhwZWN0ZWRfcmV2aXNpb24YAyABKARIAIgBAUIUChJfZXhwZWN0ZWRfcmV2aXNpb24iMAocU2V0U2VnbWVudFByb3BlcnRpZXNSZXNwb25zZRIQCghyZXZpc2lvbhgBIAEoBCJjCh5EZWxldGVTZWdtZW50UHJvcGVydGllc1JlcXVlc3QSQQoIc2VnbWVudHMYASADKAsyLy5yZXJ1bi5jbG91ZC52MWFscGhhMS5TZWdtZW50UHJvcGVydGllc0RlbGV0aW9uIocBChlTZWdtZW50UHJvcGVydGllc0RlbGV0aW9uEjQKCnNlZ21lbnRfaWQYASABKAsyIC5yZXJ1bi5jb21tb24udjFhbHBoYTEuU2VnbWVudElkEh4KEWV4cGVjdGVkX3JldmlzaW9uGAIgASgESACIAQFCFAoSX2V4cGVjdGVkX3JldmlzaW9uIiEKH0RlbGV0ZVNlZ21lbnRQcm9wZXJ0aWVzUmVzcG9uc2Ui/AMKE1F1ZXJ5RGF0YXNldFJlcXVlc3QSNQoLc2VnbWVudF9pZHMYCyADKAsyIC5yZXJ1bi5jb21tb24udjFhbHBoYTEuU2VnbWVudElkEhwKFGdlbmVyYXRlX2RpcmVjdF91cmxzGAwgASgIEhwKFHVuc2lnbmVkX2RpcmVjdF91cmxzGA0gASgIEi4KCWNodW5rX2lkcxgDIAMoCzIbLnJlcnVuLmNvbW1vbi52MWFscGhhMS5UdWlkEjcKDGVudGl0eV9wYXRocxgEIAMoCzIhLnJlcnVuLmNvbW1vbi52MWFscGhhMS5FbnRpdHlQYXRoEh8KF3NlbGVjdF9hbGxfZW50aXR5X3BhdGhzGAcgASgIEhkKEWZ1enp5X2Rlc2NyaXB0b3JzGAogAygJEhsKE2V4Y2x1ZGVfc3RhdGljX2RhdGEYCCABKAgSHQoVZXhjbHVkZV90ZW1wb3JhbF9kYXRhGAkgASgIEj4KD3NjYW5fcGFyYW1ldGVycxgFIAEoCzIlLnJlcnVuLmNvbW1vbi52MWFscGhhMS5TY2FuUGFyYW1ldGVycxIqCgVxdWVyeRgGIAEoCzIbLnJlcnVuLmNsb3VkLnYxYWxwaGExLlF1ZXJ5SgQIARACSgQIAhADUgpkYXRhc2V0X2lkUg1wYXJ0aXRpb25faWRzIoMBChRRdWVyeURhdGFzZXRSZXNwb25zZRIyCgRkYXRhGAEgASgLMiQucmVydW4uY29tbW9uLnYxYWxwaGExLkRhdGFmcmFtZVBhcnQSNwoEbWV0YRhkIAEoCzIpLnJlcnVuLmNsb3VkLnYxYWxwaGExLkRhdGFzZXRSZXNwb25zZU1ldGEirQMKBVF1ZXJ5EjYKCWxhdGVzdF9hdBgBIAEoCzIjLnJlcnVuLmNsb3VkLnYxYWxwaGExLlF1ZXJ5TGF0ZXN0QXQSLwoFcmFuZ2UYAiABKAsyIC5yZXJ1bi5jbG91ZC52MWFscGhhMS5RdWVyeVJhbmdlEikKIWNvbHVtbnNfYWx3YXlzX2luY2x1ZGVfZXZlcnl0aGluZxgDIAEoCBIrCiNjb2x1bW5zX2Fsd2F5c19pbmNsdWRlX2J5dGVfb2Zmc2V0cxgFIAEoCBIrCiNjb2x1bW5zX2Fsd2F5c19pbmNsdWRlX2VudGl0eV9wYXRocxgGIAEoCBItCiVjb2x1bW5zX2Fsd2F5c19pbmNsdWRlX3N0YXRpY19pbmRleGVzGAcgASgIEi0KJWNvbHVtbnNfYWx3YXlzX2luY2x1ZGVfZ2xvYmFsX2luZGV4ZXMYCCABKAgSMAooY29sdW1uc19hbHdheXNfaW5jbHVkZV9jb21wb25lbnRfaW5kZXhlcxgJIAEoCEoECAQQBVIgY29sdW1uc19hbHdheXNfaW5jbHVkZV9jaHVua19pZHMiyQEKDVF1ZXJ5TGF0ZXN0QXQSOQoFaW5kZXgYASABKAsyKi5yZXJ1bi5jb21tb24udjFhbHBoYTEuSW5kZXhDb2x1bW5TZWxlY3RvchIPCgJhdBgCIAEoA0gAiAEBEkAKEnBlcl9zZWdtZW50X3ZhbHVlcxgEIAMoCzIkLnJlcnVuLmNsb3VkLnYxYWxwaGExLkluZGV4VmFsdWVMaXN0QgUKA19hdEoECAMQBEoECAUQBlIRZnV6enlfZGVzY3JpcHRvcnNSBG1vZGUiIAoOSW5kZXhWYWx1ZUxpc3QSDgoGdmFsdWVzGAEgAygDIrEBCgpRdWVyeVJhbmdlEjkKBWluZGV4GAEgASgLMioucmVydW4uY29tbW9uLnYxYWxwaGExLkluZGV4Q29sdW1uU2VsZWN0b3ISNQoLaW5kZXhfcmFuZ2UYAiABKAsyIC5yZXJ1bi5jb21tb24udjFhbHBoYTEuVGltZVJhbmdlSgQIAxAESgQIBBAFUhFmdXp6eV9kZXNjcmlwdG9yc1IScGVyX3NlZ21lbnRfdmFsdWVzIk8KEkZldGNoQ2h1bmtzUmVxdWVzdBI5CgtjaHVua19pbmZvcxgBIAMoCzIkLnJlcnVuLmNvbW1vbi52MWFscGhhMS5EYXRhZnJhbWVQYXJ0IkcKE0ZldGNoQ2h1bmtzUmVzcG9uc2USMAoGY2h1bmtzGAEgAygLMiAucmVydW4ubG9nX21zZy52MWFscGhhMS5BcnJvd01zZyL9AgoRRmluZENodW5rc1JlcXVlc3QSOAoIY29udGVudHMYASABKAsyJi5yZXJ1bi5jbG91ZC52MWFscGhhMS5Db250ZW50U2VsZWN0aW9uEjcKBnN0YXRpYxgCIAEoCzIlLnJlcnVuLmNsb3VkLnYxYWxwaGExLlN0YXRpY1NlbGVjdGlvbkgAEjUKBXJhbmdlGAMgASgLMiQucmVydW4uY2xvdWQudjFhbHBoYTEuUmFuZ2VTZWxlY3Rpb25IABJACgdzYW1wbGVzGAQgASgLMi0ucmVydW4uY2xvdWQudjFhbHBoYTEuU2VnbWVudFNhbXBsZXNTZWxlY3Rpb25IABI8Cg9kaXJlY3RfdXJsX21vZGUYBSABKA4yIy5yZXJ1bi5jbG91ZC52MWFscGhhMS5EaXJlY3RVcmxNb2RlEjYKBXNjb3BlGAYgASgOMicucmVydW4uY2xvdWQudjFhbHBoYTEuRGF0YXNldFF1ZXJ5U2NvcGVCBgoEbW9kZSKBAQoSRmluZENodW5rc1Jlc3BvbnNlEjIKBGRhdGEYASABKAsyJC5yZXJ1bi5jb21tb24udjFhbHBoYTEuRGF0YWZyYW1lUGFydBI3CgRtZXRhGGQgASgLMikucmVydW4uY2xvdWQudjFhbHBoYTEuRGF0YXNldFJlc3BvbnNlTWV0YSJ8ChBTZWdtZW50U2VsZWN0aW9uEiUKA2FsbBgBIAEoCzIWLmdvb2dsZS5wcm90b2J1Zi5FbXB0eUgAEjQKCGV4cGxpY2l0GAIgASgLMiAucmVydW4uY2xvdWQudjFhbHBoYTEuU2VnbWVudElkc0gAQgsKCXNlbGVjdGlvbiI7CgpTZWdtZW50SWRzEi0KA2lkcxgBIAMoCzIgLnJlcnVuLmNvbW1vbi52MWFscGhhMS5TZWdtZW50SWQiSwoPU3RhdGljU2VsZWN0aW9uEjgKCHNlZ21lbnRzGAEgASgLMiYucmVydW4uY2xvdWQudjFhbHBoYTEuU2VnbWVudFNlbGVjdGlvbiLvAQoOUmFuZ2VTZWxlY3Rpb24SEAoIdGltZWxpbmUYASABKAkSHAoPc3RhcnRfaW5jbHVzaXZlGAIgASgDSACIAQESGgoNZW5kX2luY2x1c2l2ZRgDIAEoA0gBiAEBEjEKCWZpbGxfbW9kZRgEIAEoDjIeLnJlcnVuLmNsb3VkLnYxYWxwaGExLkZpbGxNb2RlEjgKCHNlZ21lbnRzGAUgASgLMiYucmVydW4uY2xvdWQudjFhbHBoYTEuU2VnbWVudFNlbGVjdGlvbkISChBfc3RhcnRfaW5jbHVzaXZlQhAKDl9lbmRfaW5jbHVzaXZlIpYBChdTZWdtZW50U2FtcGxlc1NlbGVjdGlvbhIQCgh0aW1lbGluZRgBIAEoCRI2CghzZWdtZW50cxgCIAMoCzIkLnJlcnVuLmNsb3VkLnYxYWxwaGExLlNlZ21lbnRTYW1wbGVzEjEKCWZpbGxfbW9kZRgDIAEoDjIeLnJlcnVuLmNsb3VkLnYxYWxwaGExLkZpbGxNb2RlIlYKDlNlZ21lbnRTYW1wbGVzEjQKCnNlZ21lbnRfaWQYASABKAsyIC5yZXJ1bi5jb21tb24udjFhbHBoYTEuU2VnbWVudElkEg4KBnZhbHVlcxgCIAMoAyKCAQoQQ29udGVudFNlbGVjdGlvbhIlCgNhbGwYASABKAsyFi5nb29nbGUucHJvdG9idWYuRW1wdHlIABI6CghleHBsaWNpdBgCIAEoCzImLnJlcnVuLmNsb3VkLnYxYWxwaGExLkVudGl0eVNlbGVjdGlvbnNIAEILCglzZWxlY3Rpb24iSwoQRW50aXR5U2VsZWN0aW9ucxI3CghlbnRpdGllcxgBIAMoCzIlLnJlcnVuLmNsb3VkLnYxYWxwaGExLkVudGl0eVNlbGVjdGlvbiK2AQoPRW50aXR5U2VsZWN0aW9uEjYKC2VudGl0eV9wYXRoGAEgASgLMiEucmVydW4uY29tbW9uLnYxYWxwaGExLkVudGl0eVBhdGgSJQoDYWxsGAIgASgLMhYuZ29vZ2xlLnByb3RvYnVmLkVtcHR5SAASNgoIZXhwbGljaXQYAyABKAsyIi5yZXJ1bi5jbG91ZC52MWFscGhhMS5Db21wb25lbnRJZHNIAEIMCgpjb21wb25lbnRzIhsKDENvbXBvbmVudElkcxILCgNpZHMYASADKAkiSQoVR2V0VGFibGVTY2hlbWFSZXF1ZXN0EjAKCHRhYmxlX2lkGAEgASgLMh4ucmVydW4uY29tbW9uLnYxYWxwaGExLkVudHJ5SWQiRwoWR2V0VGFibGVTY2hlbWFSZXNwb25zZRItCgZzY2hlbWEYASABKAsyHS5yZXJ1bi5jb21tb24udjFhbHBoYTEuU2NoZW1hIkQKEFNjYW5UYWJsZVJlcXVlc3QSMAoIdGFibGVfaWQYASABKAsyHi5yZXJ1bi5jb21tb24udjFhbHBoYTEuRW50cnlJZCJRChFTY2FuVGFibGVSZXNwb25zZRI8Cg5kYXRhZnJhbWVfcGFydBgBIAEoCzIkLnJlcnVuLmNvbW1vbi52MWFscGhhMS5EYXRhZnJhbWVQYXJ0Io0BChFXcml0ZVRhYmxlUmVxdWVzdBI8Cg5kYXRhZnJhbWVfcGFydBgBIAEoCzIkLnJlcnVuLmNvbW1vbi52MWFscGhhMS5EYXRhZnJhbWVQYXJ0EjoKC2luc2VydF9tb2RlGAIgASgOMiUucmVydW4uY2xvdWQudjFhbHBoYTEuVGFibGVJbnNlcnRNb2RlIhQKEldyaXRlVGFibGVSZXNwb25zZSLoAQoURG9NYWludGVuYW5jZVJlcXVlc3QSGAoQb3B0aW1pemVfaW5kZXhlcxgCIAEoCBIXCg9yZXRyYWluX2luZGV4ZXMYBiABKAgSGQoRY29tcGFjdF9mcmFnbWVudHMYAyABKAgSMgoOY2xlYW51cF9iZWZvcmUYBCABKAsyGi5nb29nbGUucHJvdG9idWYuVGltZXN0YW1wEhcKD2djX29iamVjdF9zdG9yZRgHIAEoCBIjCht1bnNhZmVfYWxsb3dfcmVjZW50X2NsZWFudXAYBSABKAhKBAgBEAJSCmRhdGFzZXRfaWQiJwoVRG9NYWludGVuYW5jZVJlc3BvbnNlEg4KBnJlcG9ydBgBIAEoCSIcChpEb0dsb2JhbE1haW50ZW5hbmNlUmVxdWVzdCIdChtEb0dsb2JhbE1haW50ZW5hbmNlUmVzcG9uc2UiPwoRUXVlcnlUYXNrc1JlcXVlc3QSKgoDaWRzGAEgAygLMh0ucmVydW4uY29tbW9uLnYxYWxwaGExLlRhc2tJZCJIChJRdWVyeVRhc2tzUmVzcG9uc2USMgoEZGF0YRgBIAEoCzIkLnJlcnVuLmNvbW1vbi52MWFscGhhMS5EYXRhZnJhbWVQYXJ0IncKHVF1ZXJ5VGFza3NPbkNvbXBsZXRpb25SZXF1ZXN0EioKA2lkcxgBIAMoCzIdLnJlcnVuLmNvbW1vbi52MWFscGhhMS5UYXNrSWQSKgoHdGltZW91dBgCIAEoCzIZLmdvb2dsZS5wcm90b2J1Zi5EdXJhdGlvbiJUCh5RdWVyeVRhc2tzT25Db21wbGV0aW9uUmVzcG9uc2USMgoEZGF0YRgBIAEoCzIkLnJlcnVuLmNvbW1vbi52MWFscGhhMS5EYXRhZnJhbWVQYXJ0IkAKEkNhbmNlbFRhc2tzUmVxdWVzdBIqCgNpZHMYASADKAsyHS5yZXJ1bi5jb21tb24udjFhbHBoYTEuVGFza0lkIhUKE0NhbmNlbFRhc2tzUmVzcG9uc2UiRwoSRmluZEVudHJpZXNSZXF1ZXN0EjEKBmZpbHRlchgBIAEoCzIhLnJlcnVuLmNsb3VkLnYxYWxwaGExLkVudHJ5RmlsdGVyIkoKE0ZpbmRFbnRyaWVzUmVzcG9uc2USMwoHZW50cmllcxgBIAMoCzIiLnJlcnVuLmNsb3VkLnYxYWxwaGExLkVudHJ5RGV0YWlscyJAChJEZWxldGVFbnRyeVJlcXVlc3QSKgoCaWQYASABKAsyHi5yZXJ1bi5jb21tb24udjFhbHBoYTEuRW50cnlJZCIVChNEZWxldGVFbnRyeVJlc3BvbnNlIogBChJVcGRhdGVFbnRyeVJlcXVlc3QSKgoCaWQYASABKAsyHi5yZXJ1bi5jb21tb24udjFhbHBoYTEuRW50cnlJZBJGChRlbnRyeV9kZXRhaWxzX3VwZGF0ZRgCIAEoCzIoLnJlcnVuLmNsb3VkLnYxYWxwaGExLkVudHJ5RGV0YWlsc1VwZGF0ZSJQChNVcGRhdGVFbnRyeVJlc3BvbnNlEjkKDWVudHJ5X2RldGFpbHMYASABKAsyIi5yZXJ1bi5jbG91ZC52MWFscGhhMS5FbnRyeURldGFpbHMipAEKGUNyZWF0ZURhdGFzZXRFbnRyeVJlcXVlc3QSEQoEbmFtZRgBIAEoCUgAiAEBEi8KAmlkGAIgASgLMh4ucmVydW4uY29tbW9uLnYxYWxwaGExLkVudHJ5SWRIAYgBARIzCgZwb2xpY3kYZCABKAsyIy5yZXJ1bi5jbG91ZC52MWFscGhhMS5EYXRhc2V0UG9saWN5QgcKBV9uYW1lQgUKA19pZCJRChpDcmVhdGVEYXRhc2V0RW50cnlSZXNwb25zZRIzCgdkYXRhc2V0GAEgASgLMiIucmVydW4uY2xvdWQudjFhbHBoYTEuRGF0YXNldEVudHJ5IqABChdDcmVhdGVUYWJsZUVudHJ5UmVxdWVzdBIMCgRuYW1lGAEgASgJEjMKEHByb3ZpZGVyX2RldGFpbHMYAiABKAsyFC5nb29nbGUucHJvdG9idWYuQW55SACIAQESLQoGc2NoZW1hGAMgASgLMh0ucmVydW4uY29tbW9uLnYxYWxwaGExLlNjaGVtYUITChFfcHJvdmlkZXJfZGV0YWlscyJLChhDcmVhdGVUYWJsZUVudHJ5UmVzcG9uc2USLwoFdGFibGUYASABKAsyIC5yZXJ1bi5jbG91ZC52MWFscGhhMS5UYWJsZUVudHJ5IiMKF1JlYWREYXRhc2V0RW50cnlSZXF1ZXN0SgQIARACUgJpZCJPChhSZWFkRGF0YXNldEVudHJ5UmVzcG9uc2USMwoHZGF0YXNldBgBIAEoCzIiLnJlcnVuLmNsb3VkLnYxYWxwaGExLkRhdGFzZXRFbnRyeSKGAQoZVXBkYXRlRGF0YXNldEVudHJ5UmVxdWVzdBIqCgJpZBgBIAEoCzIeLnJlcnVuLmNvbW1vbi52MWFscGhhMS5FbnRyeUlkEj0KD2RhdGFzZXRfZGV0YWlscxgCIAEoCzIkLnJlcnVuLmNsb3VkLnYxYWxwaGExLkRhdGFzZXREZXRhaWxzIlEKGlVwZGF0ZURhdGFzZXRFbnRyeVJlc3BvbnNlEjMKB2RhdGFzZXQYASABKAsyIi5yZXJ1bi5jbG91ZC52MWFscGhhMS5EYXRhc2V0RW50cnkiUAoZQXBwbHlEYXRhc2V0UG9saWN5UmVxdWVzdBIzCgZwb2xpY3kYASABKAsyIy5yZXJ1bi5jbG91ZC52MWFscGhhMS5EYXRhc2V0UG9saWN5IoIBChpBcHBseURhdGFzZXRQb2xpY3lSZXNwb25zZRIzCgdkYXRhc2V0GAEgASgLMiIucmVydW4uY2xvdWQudjFhbHBoYTEuRGF0YXNldEVudHJ5Ei8KCHRhc2tfaWRzGAIgAygLMh0ucmVydW4uY29tbW9uLnYxYWxwaGExLlRhc2tJZCJUChRSZWdpc3RlclRhYmxlUmVxdWVzdBIMCgRuYW1lGAEgASgJEi4KEHByb3ZpZGVyX2RldGFpbHMYAiABKAsyFC5nb29nbGUucHJvdG9idWYuQW55Ik4KFVJlZ2lzdGVyVGFibGVSZXNwb25zZRI1Cgt0YWJsZV9lbnRyeRgBIAEoCzIgLnJlcnVuLmNsb3VkLnYxYWxwaGExLlRhYmxlRW50cnkiQwoVUmVhZFRhYmxlRW50cnlSZXF1ZXN0EioKAmlkGAEgASgLMh4ucmVydW4uY29tbW9uLnYxYWxwaGExLkVudHJ5SWQiSQoWUmVhZFRhYmxlRW50cnlSZXNwb25zZRIvCgV0YWJsZRgBIAEoCzIgLnJlcnVuLmNsb3VkLnYxYWxwaGExLlRhYmxlRW50cnkigAEKF1VwZGF0ZVRhYmxlRW50cnlSZXF1ZXN0EioKAmlkGAEgASgLMh4ucmVydW4uY29tbW9uLnYxYWxwaGExLkVudHJ5SWQSOQoNdGFibGVfZGV0YWlscxgCIAEoCzIiLnJlcnVuLmNsb3VkLnYxYWxwaGExLlRhYmxlRGV0YWlscyJLChhVcGRhdGVUYWJsZUVudHJ5UmVzcG9uc2USLwoFdGFibGUYASABKAsyIC5yZXJ1bi5jbG91ZC52MWFscGhhMS5UYWJsZUVudHJ5IuABCgtFbnRyeUZpbHRlchIvCgJpZBgBIAEoCzIeLnJlcnVuLmNvbW1vbi52MWFscGhhMS5FbnRyeUlkSACIAQESEQoEbmFtZRgCIAEoCUgBiAEBEjgKCmVudHJ5X2tpbmQYAyABKA4yHy5yZXJ1bi5jbG91ZC52MWFscGhhMS5FbnRyeUtpbmRIAogBARI0CgtlbnRyeV9raW5kcxgEIAMoDjIfLnJlcnVuLmNsb3VkLnYxYWxwaGExLkVudHJ5S2luZEIFCgNfaWRCBwoFX25hbWVCDQoLX2VudHJ5X2tpbmQi6wEKDEVudHJ5RGV0YWlscxIqCgJpZBgBIAEoCzIeLnJlcnVuLmNvbW1vbi52MWFscGhhMS5FbnRyeUlkEhEKBG5hbWUYAiABKAlIAIgBARIzCgplbnRyeV9raW5kGAMgASgOMh8ucmVydW4uY2xvdWQudjFhbHBoYTEuRW50cnlLaW5kEi4KCmNyZWF0ZWRfYXQYBCABKAsyGi5nb29nbGUucHJvdG9idWYuVGltZXN0YW1wEi4KCnVwZGF0ZWRfYXQYBSABKAsyGi5nb29nbGUucHJvdG9idWYuVGltZXN0YW1wQgcKBV9uYW1lIjAKEkVudHJ5RGV0YWlsc1VwZGF0ZRIRCgRuYW1lGAIgASgJSACIAQFCBwoFX25hbWUi7gMKDkRhdGFzZXREZXRhaWxzEj4KEWJsdWVwcmludF9kYXRhc2V0GAMgASgLMh4ucmVydW4uY29tbW9uLnYxYWxwaGExLkVudHJ5SWRIAIgBARJIChlkZWZhdWx0X2JsdWVwcmludF9zZWdtZW50GAUgASgLMiAucmVydW4uY29tbW9uLnYxYWxwaGExLlNlZ21lbnRJZEgBiAEBElYKJ2RlZmF1bHRfc2VnbWVudF90YWJsZV9ibHVlcHJpbnRfc2VnbWVudBgGIAEoCzIgLnJlcnVuLmNvbW1vbi52MWFscGhhMS5TZWdtZW50SWRIAogBARI6Cg1hc3NldF9kYXRhc2V0GAcgASgLMh4ucmVydW4uY29tbW9uLnYxYWxwaGExLkVudHJ5SWRIA4gBARIzCgZwb2xpY3kYZCABKAsyIy5yZXJ1bi5jbG91ZC52MWFscGhhMS5EYXRhc2V0UG9saWN5QhQKEl9ibHVlcHJpbnRfZGF0YXNldEIcChpfZGVmYXVsdF9ibHVlcHJpbnRfc2VnbWVudEIqCihfZGVmYXVsdF9zZWdtZW50X3RhYmxlX2JsdWVwcmludF9zZWdtZW50QhAKDl9hc3NldF9kYXRhc2V0SgQIBBAFUhFkZWZhdWx0X2JsdWVwcmludCJZCg1EYXRhc2V0UG9saWN5EkgKFWNodW5rX2luZGV4aW5nX3BvbGljeRgBIAEoCzIpLnJlcnVuLmNsb3VkLnYxYWxwaGExLkNodW5rSW5kZXhpbmdQb2xpY3kinAEKE0NodW5rSW5kZXhpbmdQb2xpY3kSQwoMZW50aXR5X3BhdGhzGAEgASgLMi0ucmVydW4uY2xvdWQudjFhbHBoYTEuSW5kZXhpbmdQb2xpY3lTZWxlY3Rpb24SQAoJdGltZWxpbmVzGAIgASgLMi0ucmVydW4uY2xvdWQudjFhbHBoYTEuSW5kZXhpbmdQb2xpY3lTZWxlY3Rpb24ijwEKF0luZGV4aW5nUG9saWN5U2VsZWN0aW9uEiUKA2FsbBgBIAEoCzIWLmdvb2dsZS5wcm90b2J1Zi5FbXB0eUgAEkAKCGV4cGxpY2l0GAIgASgLMiwucmVydW4uY2xvdWQudjFhbHBoYTEuSW5kZXhpbmdQb2xpY3lOYW1lTGlzdEgAQgsKCXNlbGVjdGlvbiInChZJbmRleGluZ1BvbGljeU5hbWVMaXN0Eg0KBW5hbWVzGAEgAygJItkBCgxEYXRhc2V0RW50cnkSMwoHZGV0YWlscxgBIAEoCzIiLnJlcnVuLmNsb3VkLnYxYWxwaGExLkVudHJ5RGV0YWlscxI9Cg9kYXRhc2V0X2RldGFpbHMYBCABKAsyJC5yZXJ1bi5jbG91ZC52MWFscGhhMS5EYXRhc2V0RGV0YWlscxI8Cg5kYXRhc2V0X2hhbmRsZRgCIAEoCzIkLnJlcnVuLmNvbW1vbi52MWFscGhhMS5EYXRhc2V0SGFuZGxlSgQIAxAEUhFibHVlcHJpbnRfZGF0YXNldCLMAQoMVGFibGVEZXRhaWxzEj4KEWJsdWVwcmludF9kYXRhc2V0GAEgASgLMh4ucmVydW4uY29tbW9uLnYxYWxwaGExLkVudHJ5SWRIAIgBARJIChlkZWZhdWx0X2JsdWVwcmludF9zZWdtZW50GAIgASgLMiAucmVydW4uY29tbW9uLnYxYWxwaGExLlNlZ21lbnRJZEgBiAEBQhQKEl9ibHVlcHJpbnRfZGF0YXNldEIcChpfZGVmYXVsdF9ibHVlcHJpbnRfc2VnbWVudCK6AQoKVGFibGVFbnRyeRIzCgdkZXRhaWxzGAEgASgLMiIucmVydW4uY2xvdWQudjFhbHBoYTEuRW50cnlEZXRhaWxzEi4KEHByb3ZpZGVyX2RldGFpbHMYAyABKAsyFC5nb29nbGUucHJvdG9idWYuQW55EjkKDXRhYmxlX2RldGFpbHMYBCABKAsyIi5yZXJ1bi5jbG91ZC52MWFscGhhMS5UYWJsZURldGFpbHNKBAgCEANSBnNjaGVtYSJCCgtTeXN0ZW1UYWJsZRIzCgRraW5kGAEgASgOMiUucmVydW4uY2xvdWQudjFhbHBoYTEuU3lzdGVtVGFibGVLaW5kIh8KCkxhbmNlVGFibGUSEQoJdGFibGVfdXJsGAEgASgJIjUKCURlYnVnSW5mbxIYCgttZW1vcnlfdXNlZBgBIAEoBEgAiAEBQg4KDF9tZW1vcnlfdXNlZCL7AQoIQ2h1bmtLZXkSLQoIY2h1bmtfaWQYASABKAsyGy5yZXJ1bi5jb21tb24udjFhbHBoYTEuVHVpZBI+ChBkYXRhX3NvdXJjZV9raW5kGAIgASgOMiQucmVydW4uY2xvdWQudjFhbHBoYTEuRGF0YVNvdXJjZUtpbmQSFQoIbG9jYXRpb24YAyABKAxIAIgBARIRCgRldGFnGAQgASgJSAGIAQESJAoXcmVnaXN0cmF0aW9uX3RpbWVfbmFub3MYBSABKANIAogBAUILCglfbG9jYXRpb25CBwoFX2V0YWdCGgoYX3JlZ2lzdHJhdGlvbl90aW1lX25hbm9zIqYBChBScmRDaHVua0xvY2F0aW9uEhAKA3VybBgBIAEoCUgAiAEBEhMKBm9mZnNldBgCIAEoBEgBiAEBEhMKBmxlbmd0aBgDIAEoBEgCiAEBEiAKE29iamVjdF9zdG9yZV9jb25maWcYBCABKAlIA4gBAUIGCgRfdXJsQgkKB19vZmZzZXRCCQoHX2xlbmd0aEIWChRfb2JqZWN0X3N0b3JlX2NvbmZpZyKsAQoOUnJkTWFuaWZlc3RLZXkSOAoIbG9jYXRpb24YASABKAsyJi5yZXJ1bi5jbG91ZC52MWFscGhhMS5ScmRDaHVua0xvY2F0aW9uEhIKBWxheWVyGAIgASgJSACIAQESEQoEZXRhZxgDIAEoCUgBiAEBEhcKCmRpcmVjdF91cmwYBCABKAlIAogBAUIICgZfbGF5ZXJCBwoFX2V0YWdCDQoLX2RpcmVjdF91cmwqiAEKCUVycm9yQ29kZRIaChZFUlJPUl9DT0RFX1VOU1BFQ0lGSUVEEAASIQodRVJST1JfQ09ERV9PQkpFQ1RfU1RPUkVfRVJST1IQARIgChxFUlJPUl9DT0RFX01FVEFEQVRBX0RCX0VSUk9SEAISGgoWRVJST1JfQ09ERV9DT0RFQ19FUlJPUhADKmwKDFVwbG9hZE1ldGhvZBIdChlVUExPQURfTUVUSE9EX1VOU1BFQ0lGSUVEEAASIAocVVBMT0FEX01FVEhPRF9TSU5HTEVfUkVRVUVTVBABEhsKF1VQTE9BRF9NRVRIT0RfTVVMVElQQVJUEAIqWwoKVXJsU2lnbmluZxIbChdVUkxfU0lHTklOR19VTlNQRUNJRklFRBAAEhYKElVSTF9TSUdOSU5HX1NJR05FRBABEhgKFFVSTF9TSUdOSU5HX1VOU0lHTkVEEAIqTAoORGF0YVNvdXJjZUtpbmQSIAocREFUQV9TT1VSQ0VfS0lORF9VTlNQRUNJRklFRBAAEhgKFERBVEFfU09VUkNFX0tJTkRfUlJEEAEqdwoRRGF0YXNldFF1ZXJ5U2NvcGUSIwofREFUQVNFVF9RVUVSWV9TQ09QRV9VTlNQRUNJRklFRBAAEhwKGERBVEFTRVRfUVVFUllfU0NPUEVfRlVMTBABEh8KG0RBVEFTRVRfUVVFUllfU0NPUEVfSU5ERVhFRBACKoQBCg1EaXJlY3RVcmxNb2RlEh8KG0RJUkVDVF9VUkxfTU9ERV9VTlNQRUNJRklFRBAAEhgKFERJUkVDVF9VUkxfTU9ERV9PTUlUEAESHAoYRElSRUNUX1VSTF9NT0RFX1VOU0lHTkVEEAISGgoWRElSRUNUX1VSTF9NT0RFX1NJR05FRBADKm0KCEZpbGxNb2RlEhkKFUZJTExfTU9ERV9VTlNQRUNJRklFRBAAEhIKDkZJTExfTU9ERV9OT05FEAESFwoTRklMTF9NT0RFX0xBVEVTVF9BVBACEhkKFUZJTExfTU9ERV9FQVJMSUVTVF9BVBADKrABCg9UYWJsZUluc2VydE1vZGUSIQodVEFCTEVfSU5TRVJUX01PREVfVU5TUEVDSUZJRUQQABIcChhUQUJMRV9JTlNFUlRfTU9ERV9BUFBFTkQQARIfChtUQUJMRV9JTlNFUlRfTU9ERV9PVkVSV1JJVEUQAhIdChlUQUJMRV9JTlNFUlRfTU9ERV9SRVBMQUNFEAMSHAoYVEFCTEVfSU5TRVJUX01PREVfVVBEQVRFEAQqzQEKCUVudHJ5S2luZBIaChZFTlRSWV9LSU5EX1VOU1BFQ0lGSUVEEAASFgoSRU5UUllfS0lORF9EQVRBU0VUEAESGwoXRU5UUllfS0lORF9EQVRBU0VUX1ZJRVcQAhIUChBFTlRSWV9LSU5EX1RBQkxFEAMSGQoVRU5UUllfS0lORF9UQUJMRV9WSUVXEAQSIAocRU5UUllfS0lORF9CTFVFUFJJTlRfREFUQVNFVBAFEhwKGEVOVFJZX0tJTkRfQVNTRVRfREFUQVNFVBAGKnUKD1N5c3RlbVRhYmxlS2luZBIhCh1TWVNURU1fVEFCTEVfS0lORF9VTlNQRUNJRklFRBAAEiAKHFNZU1RFTV9UQUJMRV9LSU5EX05BTUVTUEFDRVMQARIdChlTWVNURU1fVEFCTEVfS0lORF9FTlRSSUVTEAIytSgKEVJlcnVuQ2xvdWRTZXJ2aWNlElgKB1ZlcnNpb24SJC5yZXJ1bi5jbG91ZC52MWFscGhhMS5WZXJzaW9uUmVxdWVzdBolLnJlcnVuLmNsb3VkLnYxYWxwaGExLlZlcnNpb25SZXNwb25zZSIAElUKBldob0FtSRIjLnJlcnVuLmNsb3VkLnYxYWxwaGExLldob0FtSVJlcXVlc3QaJC5yZXJ1bi5jbG91ZC52MWFscGhhMS5XaG9BbUlSZXNwb25zZSIAEnIKD0RvQmFuZHdpZHRoVGVzdBIsLnJlcnVuLmNsb3VkLnYxYWxwaGExLkRvQmFuZHdpZHRoVGVzdFJlcXVlc3QaLS5yZXJ1bi5jbG91ZC52MWFscGhhMS5Eb0JhbmR3aWR0aFRlc3RSZXNwb25zZSIAMAESfAoTR2V0U3RvcmFnZUxvY2F0aW9ucxIwLnJlcnVuLmNsb3VkLnYxYWxwaGExLkdldFN0b3JhZ2VMb2NhdGlvbnNSZXF1ZXN0GjEucmVydW4uY2xvdWQudjFhbHBoYTEuR2V0U3RvcmFnZUxvY2F0aW9uc1Jlc3BvbnNlIgASZgoLV2F0Y2hFdmVudHMSKC5yZXJ1bi5jbG91ZC52MWFscGhhMS5XYXRjaEV2ZW50c1JlcXVlc3QaKS5yZXJ1bi5jbG91ZC52MWFscGhhMS5XYXRjaEV2ZW50c1Jlc3BvbnNlIgAwARJkCgtGaW5kRW50cmllcxIoLnJlcnVuLmNsb3VkLnYxYWxwaGExLkZpbmRFbnRyaWVzUmVxdWVzdBopLnJlcnVuLmNsb3VkLnYxYWxwaGExLkZpbmRFbnRyaWVzUmVzcG9uc2UiABJkCgtEZWxldGVFbnRyeRIoLnJlcnVuLmNsb3VkLnYxYWxwaGExLkRlbGV0ZUVudHJ5UmVxdWVzdBopLnJlcnVuLmNsb3VkLnYxYWxwaGExLkRlbGV0ZUVudHJ5UmVzcG9uc2UiABJkCgtVcGRhdGVFbnRyeRIoLnJlcnVuLmNsb3VkLnYxYWxwaGExLlVwZGF0ZUVudHJ5UmVxdWVzdBopLnJlcnVuLmNsb3VkLnYxYWxwaGExLlVwZGF0ZUVudHJ5UmVzcG9uc2UiABJ5ChJDcmVhdGVEYXRhc2V0RW50cnkSLy5yZXJ1bi5jbG91ZC52MWFscGhhMS5DcmVhdGVEYXRhc2V0RW50cnlSZXF1ZXN0GjAucmVydW4uY2xvdWQudjFhbHBoYTEuQ3JlYXRlRGF0YXNldEVudHJ5UmVzcG9uc2UiABJzChBDcmVhdGVUYWJsZUVudHJ5Ei0ucmVydW4uY2xvdWQudjFhbHBoYTEuQ3JlYXRlVGFibGVFbnRyeVJlcXVlc3QaLi5yZXJ1bi5jbG91ZC52MWFscGhhMS5DcmVhdGVUYWJsZUVudHJ5UmVzcG9uc2UiABJzChBSZWFkRGF0YXNldEVudHJ5Ei0ucmVydW4uY2xvdWQudjFhbHBoYTEuUmVhZERhdGFzZXRFbnRyeVJlcXVlc3QaLi5yZXJ1bi5jbG91ZC52MWFscGhhMS5SZWFkRGF0YXNldEVudHJ5UmVzcG9uc2UiABJ5ChJVcGRhdGVEYXRhc2V0RW50cnkSLy5yZXJ1bi5jbG91ZC52MWFscGhhMS5VcGRhdGVEYXRhc2V0RW50cnlSZXF1ZXN0GjAucmVydW4uY2xvdWQudjFhbHBoYTEuVXBkYXRlRGF0YXNldEVudHJ5UmVzcG9uc2UiABJ5ChJBcHBseURhdGFzZXRQb2xpY3kSLy5yZXJ1bi5jbG91ZC52MWFscGhhMS5BcHBseURhdGFzZXRQb2xpY3lSZXF1ZXN0GjAucmVydW4uY2xvdWQudjFhbHBoYTEuQXBwbHlEYXRhc2V0UG9saWN5UmVzcG9uc2UiABJtCg5SZWFkVGFibGVFbnRyeRIrLnJlcnVuLmNsb3VkLnYxYWxwaGExLlJlYWRUYWJsZUVudHJ5UmVxdWVzdBosLnJlcnVuLmNsb3VkLnYxYWxwaGExLlJlYWRUYWJsZUVudHJ5UmVzcG9uc2UiABJzChBVcGRhdGVUYWJsZUVudHJ5Ei0ucmVydW4uY2xvdWQudjFhbHBoYTEuVXBkYXRlVGFibGVFbnRyeVJlcXVlc3QaLi5yZXJ1bi5jbG91ZC52MWFscGhhMS5VcGRhdGVUYWJsZUVudHJ5UmVzcG9uc2UiABJ8ChNHZXRXcml0ZUFjY2Vzc0dyYW50EjAucmVydW4uY2xvdWQudjFhbHBoYTEuR2V0V3JpdGVBY2Nlc3NHcmFudFJlcXVlc3QaMS5yZXJ1bi5jbG91ZC52MWFscGhhMS5HZXRXcml0ZUFjY2Vzc0dyYW50UmVzcG9uc2UiABKXAQocR2V0TXVsdGlwYXJ0VXBsb2FkUGFydEdyYW50cxI5LnJlcnVuLmNsb3VkLnYxYWxwaGExLkdldE11bHRpcGFydFVwbG9hZFBhcnRHcmFudHNSZXF1ZXN0GjoucmVydW4uY2xvdWQudjFhbHBoYTEuR2V0TXVsdGlwYXJ0VXBsb2FkUGFydEdyYW50c1Jlc3BvbnNlIgASiAEKF0NvbXBsZXRlTXVsdGlwYXJ0VXBsb2FkEjQucmVydW4uY2xvdWQudjFhbHBoYTEuQ29tcGxldGVNdWx0aXBhcnRVcGxvYWRSZXF1ZXN0GjUucmVydW4uY2xvdWQudjFhbHBoYTEuQ29tcGxldGVNdWx0aXBhcnRVcGxvYWRSZXNwb25zZSIAEn8KFEFib3J0TXVsdGlwYXJ0VXBsb2FkEjEucmVydW4uY2xvdWQudjFhbHBoYTEuQWJvcnRNdWx0aXBhcnRVcGxvYWRSZXF1ZXN0GjIucmVydW4uY2xvdWQudjFhbHBoYTEuQWJvcnRNdWx0aXBhcnRVcGxvYWRSZXNwb25zZSIAEnwKE1JlZ2lzdGVyV2l0aERhdGFzZXQSMC5yZXJ1bi5jbG91ZC52MWFscGhhMS5SZWdpc3RlcldpdGhEYXRhc2V0UmVxdWVzdBoxLnJlcnVuLmNsb3VkLnYxYWxwaGExLlJlZ2lzdGVyV2l0aERhdGFzZXRSZXNwb25zZSIAEoQBChVVbnJlZ2lzdGVyRnJvbURhdGFzZXQSMi5yZXJ1bi5jbG91ZC52MWFscGhhMS5VbnJlZ2lzdGVyRnJvbURhdGFzZXRSZXF1ZXN0GjMucmVydW4uY2xvdWQudjFhbHBoYTEuVW5yZWdpc3RlckZyb21EYXRhc2V0UmVzcG9uc2UiADABEoIBChVHZXRTZWdtZW50VGFibGVTY2hlbWESMi5yZXJ1bi5jbG91ZC52MWFscGhhMS5HZXRTZWdtZW50VGFibGVTY2hlbWFSZXF1ZXN0GjMucmVydW4uY2xvdWQudjFhbHBoYTEuR2V0U2VnbWVudFRhYmxlU2NoZW1hUmVzcG9uc2UiABJ1ChBTY2FuU2VnbWVudFRhYmxlEi0ucmVydW4uY2xvdWQudjFhbHBoYTEuU2NhblNlZ21lbnRUYWJsZVJlcXVlc3QaLi5yZXJ1bi5jbG91ZC52MWFscGhhMS5TY2FuU2VnbWVudFRhYmxlUmVzcG9uc2UiADABEosBChhHZXREYXRhc2V0TWFuaWZlc3RTY2hlbWESNS5yZXJ1bi5jbG91ZC52MWFscGhhMS5HZXREYXRhc2V0TWFuaWZlc3RTY2hlbWFSZXF1ZXN0GjYucmVydW4uY2xvdWQudjFhbHBoYTEuR2V0RGF0YXNldE1hbmlmZXN0U2NoZW1hUmVzcG9uc2UiABJ+ChNTY2FuRGF0YXNldE1hbmlmZXN0EjAucmVydW4uY2xvdWQudjFhbHBoYTEuU2NhbkRhdGFzZXRNYW5pZmVzdFJlcXVlc3QaMS5yZXJ1bi5jbG91ZC52MWFscGhhMS5TY2FuRGF0YXNldE1hbmlmZXN0UmVzcG9uc2UiADABEnMKEEdldERhdGFzZXRTY2hlbWESLS5yZXJ1bi5jbG91ZC52MWFscGhhMS5HZXREYXRhc2V0U2NoZW1hUmVxdWVzdBouLnJlcnVuLmNsb3VkLnYxYWxwaGExLkdldERhdGFzZXRTY2hlbWFSZXNwb25zZSIAEmMKCkdldFNjaGVtYXMSJy5yZXJ1bi5jbG91ZC52MWFscGhhMS5HZXRTY2hlbWFzUmVxdWVzdBooLnJlcnVuLmNsb3VkLnYxYWxwaGExLkdldFNjaGVtYXNSZXNwb25zZSIAMAESbwoOR2V0UnJkTWFuaWZlc3QSKy5yZXJ1bi5jbG91ZC52MWFscGhhMS5HZXRScmRNYW5pZmVzdFJlcXVlc3QaLC5yZXJ1bi5jbG91ZC52MWFscGhhMS5HZXRScmRNYW5pZmVzdFJlc3BvbnNlIgAwARJ+ChNHZXRBc3NldHNGb3JTZWdtZW50EjAucmVydW4uY2xvdWQudjFhbHBoYTEuR2V0QXNzZXRzRm9yU2VnbWVudFJlcXVlc3QaMS5yZXJ1bi5jbG91ZC52MWFscGhhMS5HZXRBc3NldHNGb3JTZWdtZW50UmVzcG9uc2UiADABEoEBChRHZXRTZWdtZW50UHJvcGVydGllcxIxLnJlcnVuLmNsb3VkLnYxYWxwaGExLkdldFNlZ21lbnRQcm9wZXJ0aWVzUmVxdWVzdBoyLnJlcnVuLmNsb3VkLnYxYWxwaGExLkdldFNlZ21lbnRQcm9wZXJ0aWVzUmVzcG9uc2UiADABEn8KFFNldFNlZ21lbnRQcm9wZXJ0aWVzEjEucmVydW4uY2xvdWQudjFhbHBoYTEuU2V0U2VnbWVudFByb3BlcnRpZXNSZXF1ZXN0GjIucmVydW4uY2xvdWQudjFhbHBoYTEuU2V0U2VnbWVudFByb3BlcnRpZXNSZXNwb25zZSIAEogBChdEZWxldGVTZWdtZW50UHJvcGVydGllcxI0LnJlcnVuLmNsb3VkLnYxYWxwaGExLkRlbGV0ZVNlZ21lbnRQcm9wZXJ0aWVzUmVxdWVzdBo1LnJlcnVuLmNsb3VkLnYxYWxwaGExLkRlbGV0ZVNlZ21lbnRQcm9wZXJ0aWVzUmVzcG9uc2UiABJsCgxRdWVyeURhdGFzZXQSKS5yZXJ1bi5jbG91ZC52MWFscGhhMS5RdWVyeURhdGFzZXRSZXF1ZXN0GioucmVydW4uY2xvdWQudjFhbHBoYTEuUXVlcnlEYXRhc2V0UmVzcG9uc2UiA4gCATABEmYKC0ZldGNoQ2h1bmtzEigucmVydW4uY2xvdWQudjFhbHBoYTEuRmV0Y2hDaHVua3NSZXF1ZXN0GikucmVydW4uY2xvdWQudjFhbHBoYTEuRmV0Y2hDaHVua3NSZXNwb25zZSIAMAESYwoKRmluZENodW5rcxInLnJlcnVuLmNsb3VkLnYxYWxwaGExLkZpbmRDaHVua3NSZXF1ZXN0GigucmVydW4uY2xvdWQudjFhbHBoYTEuRmluZENodW5rc1Jlc3BvbnNlIgAwARJqCg1SZWdpc3RlclRhYmxlEioucmVydW4uY2xvdWQudjFhbHBoYTEuUmVnaXN0ZXJUYWJsZVJlcXVlc3QaKy5yZXJ1bi5jbG91ZC52MWFscGhhMS5SZWdpc3RlclRhYmxlUmVzcG9uc2UiABJtCg5HZXRUYWJsZVNjaGVtYRIrLnJlcnVuLmNsb3VkLnYxYWxwaGExLkdldFRhYmxlU2NoZW1hUmVxdWVzdBosLnJlcnVuLmNsb3VkLnYxYWxwaGExLkdldFRhYmxlU2NoZW1hUmVzcG9uc2UiABJgCglTY2FuVGFibGUSJi5yZXJ1bi5jbG91ZC52MWFscGhhMS5TY2FuVGFibGVSZXF1ZXN0GicucmVydW4uY2xvdWQudjFhbHBoYTEuU2NhblRhYmxlUmVzcG9uc2UiADABEmMKCldyaXRlVGFibGUSJy5yZXJ1bi5jbG91ZC52MWFscGhhMS5Xcml0ZVRhYmxlUmVxdWVzdBooLnJlcnVuLmNsb3VkLnYxYWxwaGExLldyaXRlVGFibGVSZXNwb25zZSIAKAESYQoKUXVlcnlUYXNrcxInLnJlcnVuLmNsb3VkLnYxYWxwaGExLlF1ZXJ5VGFza3NSZXF1ZXN0GigucmVydW4uY2xvdWQudjFhbHBoYTEuUXVlcnlUYXNrc1Jlc3BvbnNlIgAShwEKFlF1ZXJ5VGFza3NPbkNvbXBsZXRpb24SMy5yZXJ1bi5jbG91ZC52MWFscGhhMS5RdWVyeVRhc2tzT25Db21wbGV0aW9uUmVxdWVzdBo0LnJlcnVuLmNsb3VkLnYxYWxwaGExLlF1ZXJ5VGFza3NPbkNvbXBsZXRpb25SZXNwb25zZSIAMAESYgoLQ2FuY2VsVGFza3MSKC5yZXJ1bi5jbG91ZC52MWFscGhhMS5DYW5jZWxUYXNrc1JlcXVlc3QaKS5yZXJ1bi5jbG91ZC52MWFscGhhMS5DYW5jZWxUYXNrc1Jlc3BvbnNlEmoKDURvTWFpbnRlbmFuY2USKi5yZXJ1bi5jbG91ZC52MWFscGhhMS5Eb01haW50ZW5hbmNlUmVxdWVzdBorLnJlcnVuLmNsb3VkLnYxYWxwaGExLkRvTWFpbnRlbmFuY2VSZXNwb25zZSIAEnwKE0RvR2xvYmFsTWFpbnRlbmFuY2USMC5yZXJ1bi5jbG91ZC52MWFscGhhMS5Eb0dsb2JhbE1haW50ZW5hbmNlUmVxdWVzdBoxLnJlcnVuLmNsb3VkLnYxYWxwaGExLkRvR2xvYmFsTWFpbnRlbmFuY2VSZXNwb25zZSIAYgZwcm90bzM", [file_google_protobuf_any, file_google_protobuf_duration, file_google_protobuf_empty, file_google_protobuf_timestamp, file_rerun_v1alpha1_common, file_rerun_v1alpha1_log_msg]);

// proto/rerun/v1alpha1/viewer_control_pb.ts
var file_rerun_v1alpha1_viewer_control = /* @__PURE__ */ fileDesc("CiNyZXJ1bi92MWFscGhhMS92aWV3ZXJfY29udHJvbC5wcm90bxIdcmVydW4udmlld2VyX2NvbnRyb2wudjFhbHBoYTEi4g0KFFZpZXdlckNvbnRyb2xSZXF1ZXN0EjwKBWNsb3NlGAEgASgLMisucmVydW4udmlld2VyX2NvbnRyb2wudjFhbHBoYTEuQ2xvc2VSZXF1ZXN0SAASQQoIZ2V0X2xvZ3MYAiABKAsyLS5yZXJ1bi52aWV3ZXJfY29udHJvbC52MWFscGhhMS5HZXRMb2dzUmVxdWVzdEgAEkMKCWdldF9zdGF0ZRgDIAEoCzIuLnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLkdldFN0YXRlUmVxdWVzdEgAEjoKBG9wZW4YBCABKAsyKi5yZXJ1bi52aWV3ZXJfY29udHJvbC52MWFscGhhMS5PcGVuUmVxdWVzdEgAEk8KD3NhdmVfc2NyZWVuc2hvdBgFIAEoCzI0LnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLlNhdmVTY3JlZW5zaG90UmVxdWVzdEgAEk4KD3NldF90aW1lX2N1cnNvchgGIAEoCzIzLnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLlNldFRpbWVDdXJzb3JSZXF1ZXN0SAASWAoUZ2V0X3JlY29yZGluZ19zY2hlbWEYByABKAsyOC5yZXJ1bi52aWV3ZXJfY29udHJvbC52MWFscGhhMS5HZXRSZWNvcmRpbmdTY2hlbWFSZXF1ZXN0SAASTQoOaGlnaGxpZ2h0X3JlY3QYCCABKAsyMy5yZXJ1bi52aWV3ZXJfY29udHJvbC52MWFscGhhMS5IaWdobGlnaHRSZWN0UmVxdWVzdEgAEksKDWxpc3RfY29tbWFuZHMYCSABKAsyMi5yZXJ1bi52aWV3ZXJfY29udHJvbC52MWFscGhhMS5MaXN0Q29tbWFuZHNSZXF1ZXN0SAASUwoRZGVzY3JpYmVfY29tbWFuZHMYCiABKAsyNi5yZXJ1bi52aWV3ZXJfY29udHJvbC52MWFscGhhMS5EZXNjcmliZUNvbW1hbmRzUmVxdWVzdEgAEkcKC3J1bl9jb21tYW5kGAsgASgLMjAucmVydW4udmlld2VyX2NvbnRyb2wudjFhbHBoYTEuUnVuQ29tbWFuZFJlcXVlc3RIABJLCg1nZXRfYmx1ZXByaW50GAwgASgLMjIucmVydW4udmlld2VyX2NvbnRyb2wudjFhbHBoYTEuR2V0Qmx1ZXByaW50UmVxdWVzdEgAEloKFWNhcHR1cmVfcHJvZmlsZV90cmFjZRgNIAEoCzI5LnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLkNhcHR1cmVQcm9maWxlVHJhY2VSZXF1ZXN0SAASSwoNc2V0X2JsdWVwcmludBgOIAEoCzIyLnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLlNldEJsdWVwcmludFJlcXVlc3RIABJQChBnZXRfdGFibGVfc2NoZW1hGBEgASgLMjQucmVydW4udmlld2VyX2NvbnRyb2wudjFhbHBoYTEuR2V0VGFibGVTY2hlbWFSZXF1ZXN0SAASVAoSZ2V0X2RhdGFzZXRfc2NoZW1hGBIgASgLMjYucmVydW4udmlld2VyX2NvbnRyb2wudjFhbHBoYTEuR2V0RGF0YXNldFNjaGVtYVJlcXVlc3RIABJJCgxnZXRfbG9jYXRpb24YEyABKAsyMS5yZXJ1bi52aWV3ZXJfY29udHJvbC52MWFscGhhMS5HZXRMb2NhdGlvblJlcXVlc3RIABJJCgxzZXRfbG9jYXRpb24YFCABKAsyMS5yZXJ1bi52aWV3ZXJfY29udHJvbC52MWFscGhhMS5TZXRMb2NhdGlvblJlcXVlc3RIABJWChNnZXRfdHJhbnNmb3JtX2dyYXBoGA8gASgLMjcucmVydW4udmlld2VyX2NvbnRyb2wudjFhbHBoYTEuR2V0VHJhbnNmb3JtR3JhcGhSZXF1ZXN0SAASYQoZZ2V0X2RhdGFzZXRfYXNzZXRzX3NjaGVtYRgVIAEoCzI8LnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLkdldERhdGFzZXRBc3NldHNTY2hlbWFSZXF1ZXN0SAASTwoPc3VibWl0X2ZlZWRiYWNrGBYgASgLMjQucmVydW4udmlld2VyX2NvbnRyb2wudjFhbHBoYTEuU3VibWl0RmVlZGJhY2tSZXF1ZXN0SAASSwoNZ2V0X3NlbGVjdGlvbhgXIAEoCzIyLnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLkdldFNlbGVjdGlvblJlcXVlc3RIAEIGCgRraW5kIvkNChVWaWV3ZXJDb250cm9sUmVzcG9uc2USPQoFY2xvc2UYASABKAsyLC5yZXJ1bi52aWV3ZXJfY29udHJvbC52MWFscGhhMS5DbG9zZVJlc3BvbnNlSAASQgoIZ2V0X2xvZ3MYAiABKAsyLi5yZXJ1bi52aWV3ZXJfY29udHJvbC52MWFscGhhMS5HZXRMb2dzUmVzcG9uc2VIABJECglnZXRfc3RhdGUYAyABKAsyLy5yZXJ1bi52aWV3ZXJfY29udHJvbC52MWFscGhhMS5HZXRTdGF0ZVJlc3BvbnNlSAASOwoEb3BlbhgEIAEoCzIrLnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLk9wZW5SZXNwb25zZUgAElAKD3NhdmVfc2NyZWVuc2hvdBgFIAEoCzI1LnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLlNhdmVTY3JlZW5zaG90UmVzcG9uc2VIABJPCg9zZXRfdGltZV9jdXJzb3IYBiABKAsyNC5yZXJ1bi52aWV3ZXJfY29udHJvbC52MWFscGhhMS5TZXRUaW1lQ3Vyc29yUmVzcG9uc2VIABJZChRnZXRfcmVjb3JkaW5nX3NjaGVtYRgHIAEoCzI5LnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLkdldFJlY29yZGluZ1NjaGVtYVJlc3BvbnNlSAASTgoOaGlnaGxpZ2h0X3JlY3QYCCABKAsyNC5yZXJ1bi52aWV3ZXJfY29udHJvbC52MWFscGhhMS5IaWdobGlnaHRSZWN0UmVzcG9uc2VIABJMCg1saXN0X2NvbW1hbmRzGAkgASgLMjMucmVydW4udmlld2VyX2NvbnRyb2wudjFhbHBoYTEuTGlzdENvbW1hbmRzUmVzcG9uc2VIABJUChFkZXNjcmliZV9jb21tYW5kcxgKIAEoCzI3LnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLkRlc2NyaWJlQ29tbWFuZHNSZXNwb25zZUgAEkgKC3J1bl9jb21tYW5kGAsgASgLMjEucmVydW4udmlld2VyX2NvbnRyb2wudjFhbHBoYTEuUnVuQ29tbWFuZFJlc3BvbnNlSAASTAoNZ2V0X2JsdWVwcmludBgMIAEoCzIzLnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLkdldEJsdWVwcmludFJlc3BvbnNlSAASWwoVY2FwdHVyZV9wcm9maWxlX3RyYWNlGA0gASgLMjoucmVydW4udmlld2VyX2NvbnRyb2wudjFhbHBoYTEuQ2FwdHVyZVByb2ZpbGVUcmFjZVJlc3BvbnNlSAASTAoNc2V0X2JsdWVwcmludBgOIAEoCzIzLnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLlNldEJsdWVwcmludFJlc3BvbnNlSAASUQoQZ2V0X3RhYmxlX3NjaGVtYRgRIAEoCzI1LnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLkdldFRhYmxlU2NoZW1hUmVzcG9uc2VIABJVChJnZXRfZGF0YXNldF9zY2hlbWEYEiABKAsyNy5yZXJ1bi52aWV3ZXJfY29udHJvbC52MWFscGhhMS5HZXREYXRhc2V0U2NoZW1hUmVzcG9uc2VIABJKCgxnZXRfbG9jYXRpb24YEyABKAsyMi5yZXJ1bi52aWV3ZXJfY29udHJvbC52MWFscGhhMS5HZXRMb2NhdGlvblJlc3BvbnNlSAASSgoMc2V0X2xvY2F0aW9uGBQgASgLMjIucmVydW4udmlld2VyX2NvbnRyb2wudjFhbHBoYTEuU2V0TG9jYXRpb25SZXNwb25zZUgAElcKE2dldF90cmFuc2Zvcm1fZ3JhcGgYDyABKAsyOC5yZXJ1bi52aWV3ZXJfY29udHJvbC52MWFscGhhMS5HZXRUcmFuc2Zvcm1HcmFwaFJlc3BvbnNlSAASYgoZZ2V0X2RhdGFzZXRfYXNzZXRzX3NjaGVtYRgVIAEoCzI9LnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLkdldERhdGFzZXRBc3NldHNTY2hlbWFSZXNwb25zZUgAElAKD3N1Ym1pdF9mZWVkYmFjaxgWIAEoCzI1LnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLlN1Ym1pdEZlZWRiYWNrUmVzcG9uc2VIABJMCg1nZXRfc2VsZWN0aW9uGBcgASgLMjMucmVydW4udmlld2VyX2NvbnRyb2wudjFhbHBoYTEuR2V0U2VsZWN0aW9uUmVzcG9uc2VIAEIGCgRraW5kIsAEChhHZXRUcmFuc2Zvcm1HcmFwaFJlcXVlc3QSFQoIc3RvcmVfaWQYASABKAlIAIgBARJeCgxmcmFtZV9maWx0ZXIYAiABKA4yQy5yZXJ1bi52aWV3ZXJfY29udHJvbC52MWFscGhhMS5HZXRUcmFuc2Zvcm1HcmFwaFJlcXVlc3QuRnJhbWVGaWx0ZXJIAYgBARJcCgtlZGdlX2ZpbHRlchgDIAEoDjJCLnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLkdldFRyYW5zZm9ybUdyYXBoUmVxdWVzdC5FZGdlRmlsdGVySAKIAQESHwoSaW5jbHVkZV90cmFuc2Zvcm1zGAQgASgISAOIAQEidwoLRnJhbWVGaWx0ZXISHAoYRlJBTUVfRklMVEVSX1VOU1BFQ0lGSUVEEAASHAoYRlJBTUVfRklMVEVSX0VOVElUWV9QQVRIEAESFgoSRlJBTUVfRklMVEVSX05BTUVEEAISFAoQRlJBTUVfRklMVEVSX0FMTBADInAKCkVkZ2VGaWx0ZXISGwoXRURHRV9GSUxURVJfVU5TUEVDSUZJRUQQABIWChJFREdFX0ZJTFRFUl9TVEFUSUMQARIYChRFREdFX0ZJTFRFUl9URU1QT1JBTBACEhMKD0VER0VfRklMVEVSX0FMTBADQgsKCV9zdG9yZV9pZEIPCg1fZnJhbWVfZmlsdGVyQg4KDF9lZGdlX2ZpbHRlckIVChNfaW5jbHVkZV90cmFuc2Zvcm1zIjsKGUdldFRyYW5zZm9ybUdyYXBoUmVzcG9uc2USEAoIc3RvcmVfaWQYASABKAkSDAoEanNvbhgCIAEoCSLDAQoMQ2xvc2VSZXF1ZXN0EhEKB2N1cnJlbnQYASABKAhIABINCgNhbGwYAiABKAhIABJGCglzdG9yZV9pZHMYAyABKAsyMS5yZXJ1bi52aWV3ZXJfY29udHJvbC52MWFscGhhMS5WaWV3ZXJSZWNvcmRpbmdJZHNIABI/CgR1cmxzGAQgASgLMi8ucmVydW4udmlld2VyX2NvbnRyb2wudjFhbHBoYTEuVmlld2VyU291cmNlVXJsc0gAQggKBnRhcmdldCInChJWaWV3ZXJSZWNvcmRpbmdJZHMSEQoJc3RvcmVfaWRzGAEgAygJIiAKEFZpZXdlclNvdXJjZVVybHMSDAoEdXJscxgBIAMoCSIfCg1DbG9zZVJlc3BvbnNlEg4KBmNsb3NlZBgBIAMoCSJ4ChdEZXNjcmliZUNvbW1hbmRzUmVxdWVzdBILCgNpZHMYASADKAkSFQoIc3RvcmVfaWQYAiABKAlIAIgBARIaCg1zZXJ2ZXJfb3JpZ2luGAMgASgJSAGIAQFCCwoJX3N0b3JlX2lkQhAKDl9zZXJ2ZXJfb3JpZ2luIloKGERlc2NyaWJlQ29tbWFuZHNSZXNwb25zZRI+Cghjb21tYW5kcxgBIAMoCzIsLnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLlZpZXdlckNvbW1hbmQiyAEKDVZpZXdlckNvbW1hbmQSCgoCaWQYASABKAkSDQoFdGl0bGUYAiABKAkSEwoLZGVzY3JpcHRpb24YAyABKAkSDQoFc2NvcGUYBCABKAkSEQoJc2hvcnRjdXRzGAUgAygJEhEKCWF2YWlsYWJsZRgGIAEoCBIdChVibG9ja2luZ19uYXRpdmVfbW9kYWwYByABKAgSEwoLZGVzdHJ1Y3RpdmUYCCABKAgSEwoGdGFyZ2V0GAkgASgJSACIAQFCCQoHX3RhcmdldCIlChJFZ3VpSW5zcGVjdFJlcXVlc3QSDwoHcmVxdWVzdBgBIAEoDCInChNFZ3VpSW5zcGVjdFJlc3BvbnNlEhAKCHJlc3BvbnNlGAEgASgMIsMBChNHZXRCbHVlcHJpbnRSZXF1ZXN0EkwKCXJlY29yZGluZxgCIAEoCzI3LnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLlJlY29yZGluZ0JsdWVwcmludFRhcmdldEgAEkQKBXRhYmxlGAMgASgLMjMucmVydW4udmlld2VyX2NvbnRyb2wudjFhbHBoYTEuVGFibGVCbHVlcHJpbnRUYXJnZXRIAEIICgZ0YXJnZXRKBAgBEAJSCHN0b3JlX2lkIj4KGFJlY29yZGluZ0JsdWVwcmludFRhcmdldBIVCghzdG9yZV9pZBgBIAEoCUgAiAEBQgsKCV9zdG9yZV9pZCI8ChRUYWJsZUJsdWVwcmludFRhcmdldBIWCgl0YWJsZV91cmwYASABKAlIAIgBAUIMCgpfdGFibGVfdXJsIoQBChRHZXRCbHVlcHJpbnRSZXNwb25zZRIUCgxibHVlcHJpbnRfaWQYASABKAkSDAoEanNvbhgCIAEoCRIVCghzdG9yZV9pZBgDIAEoCUgAiAEBEhYKCXRhYmxlX3VybBgEIAEoCUgBiAEBQgsKCV9zdG9yZV9pZEIMCgpfdGFibGVfdXJsIj0KFUdldFRhYmxlU2NoZW1hUmVxdWVzdBIWCgl0YWJsZV91cmwYASABKAlIAIgBAUIMCgpfdGFibGVfdXJsIlsKFkdldFRhYmxlU2NoZW1hUmVzcG9uc2USQQoHY29sdW1ucxgBIAMoCzIwLnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLlRhYmxlQ29sdW1uU2NoZW1hIkkKEVRhYmxlQ29sdW1uU2NoZW1hEgwKBG5hbWUYASABKAkSFAoMZGlzcGxheV9uYW1lGAIgASgJEhAKCGRhdGF0eXBlGAMgASgJIsEBChdHZXREYXRhc2V0U2NoZW1hUmVxdWVzdBIYCgtkYXRhc2V0X3VybBgBIAEoCUgAiAEBEhgKC2VudGl0eV9wYXRoGAIgASgJSAGIAQESGQoMbWF4X2VudGl0aWVzGAMgASgNSAKIAQESFwoKcGF0aHNfb25seRgEIAEoCEgDiAEBQg4KDF9kYXRhc2V0X3VybEIOCgxfZW50aXR5X3BhdGhCDwoNX21heF9lbnRpdGllc0INCgtfcGF0aHNfb25seSKiAQoYR2V0RGF0YXNldFNjaGVtYVJlc3BvbnNlEhEKCXRpbWVsaW5lcxgBIAMoCRJGCghlbnRpdGllcxgCIAMoCzI0LnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLlJlY29yZGluZ0VudGl0eVNjaGVtYRIYChBvbWl0dGVkX2VudGl0aWVzGAMgASgNEhEKCWFzc2V0X2lkcxgEIAMoCSLHAQodR2V0RGF0YXNldEFzc2V0c1NjaGVtYVJlcXVlc3QSGAoLZGF0YXNldF91cmwYASABKAlIAIgBARIYCgtlbnRpdHlfcGF0aBgCIAEoCUgBiAEBEhkKDG1heF9lbnRpdGllcxgDIAEoDUgCiAEBEhcKCnBhdGhzX29ubHkYBCABKAhIA4gBAUIOCgxfZGF0YXNldF91cmxCDgoMX2VudGl0eV9wYXRoQg8KDV9tYXhfZW50aXRpZXNCDQoLX3BhdGhzX29ubHkiYwoeR2V0RGF0YXNldEFzc2V0c1NjaGVtYVJlc3BvbnNlEkEKBmFzc2V0cxgBIAMoCzIxLnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLkRhdGFzZXRBc3NldFNjaGVtYSKIAQoSRGF0YXNldEFzc2V0U2NoZW1hEhAKCGFzc2V0X2lkGAEgASgJEkYKCGVudGl0aWVzGAIgAygLMjQucmVydW4udmlld2VyX2NvbnRyb2wudjFhbHBoYTEuUmVjb3JkaW5nRW50aXR5U2NoZW1hEhgKEG9taXR0ZWRfZW50aXRpZXMYAyABKA0iiwIKGUdldFJlY29yZGluZ1NjaGVtYVJlcXVlc3QSFQoIc3RvcmVfaWQYASABKAlIAIgBARIYCgtlbnRpdHlfcGF0aBgCIAEoCUgBiAEBEhkKDG1heF9lbnRpdGllcxgDIAEoDUgCiAEBEhwKD3dpdGhfYXJjaGV0eXBlcxgFIAEoCEgDiAEBEhwKD3dpdGhfY29tcG9uZW50cxgGIAEoCEgEiAEBQgsKCV9zdG9yZV9pZEIOCgxfZW50aXR5X3BhdGhCDwoNX21heF9lbnRpdGllc0ISChBfd2l0aF9hcmNoZXR5cGVzQhIKEF93aXRoX2NvbXBvbmVudHNKBAgEEAVSCnBhdGhzX29ubHki0gEKGkdldFJlY29yZGluZ1NjaGVtYVJlc3BvbnNlEhAKCHN0b3JlX2lkGAEgASgJEkAKCXRpbWVsaW5lcxgEIAMoCzItLnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLlZpZXdlclRpbWVsaW5lEkYKCGVudGl0aWVzGAIgAygLMjQucmVydW4udmlld2VyX2NvbnRyb2wudjFhbHBoYTEuUmVjb3JkaW5nRW50aXR5U2NoZW1hEhgKEG9taXR0ZWRfZW50aXRpZXMYAyABKA0ijQEKFVJlY29yZGluZ0VudGl0eVNjaGVtYRITCgtlbnRpdHlfcGF0aBgBIAEoCRJLCgpjb21wb25lbnRzGAIgAygLMjcucmVydW4udmlld2VyX2NvbnRyb2wudjFhbHBoYTEuUmVjb3JkaW5nQ29tcG9uZW50U2NoZW1hEhIKCmFyY2hldHlwZXMYAyADKAkivQEKGFJlY29yZGluZ0NvbXBvbmVudFNjaGVtYRIRCgljb21wb25lbnQYASABKAkSFgoJYXJjaGV0eXBlGAIgASgJSACIAQESGwoOY29tcG9uZW50X3R5cGUYAyABKAlIAYgBARIQCghkYXRhdHlwZRgEIAEoCRIXCgpoYXNfc3RhdGljGAUgASgISAKIAQFCDAoKX2FyY2hldHlwZUIRCg9fY29tcG9uZW50X3R5cGVCDQoLX2hhc19zdGF0aWMiQAoOR2V0TG9nc1JlcXVlc3QSGwoOYWZ0ZXJfc2VxdWVuY2UYASABKARIAIgBAUIRCg9fYWZ0ZXJfc2VxdWVuY2UiUQoPR2V0TG9nc1Jlc3BvbnNlEj4KB2VudHJpZXMYASADKAsyLS5yZXJ1bi52aWV3ZXJfY29udHJvbC52MWFscGhhMS5WaWV3ZXJMb2dFbnRyeSJSCg5WaWV3ZXJMb2dFbnRyeRIQCghzZXF1ZW5jZRgBIAEoBBINCgVsZXZlbBgCIAEoCRIOCgZ0YXJnZXQYAyABKAkSDwoHbWVzc2FnZRgEIAEoCSIUCgRVdWlkEgwKBHV1aWQYASABKAkiFQoTR2V0U2VsZWN0aW9uUmVxdWVzdCJ2ChRHZXRTZWxlY3Rpb25SZXNwb25zZRIVCghzdG9yZV9pZBgBIAEoCUgAiAEBEjoKBWl0ZW1zGAIgAygLMisucmVydW4udmlld2VyX2NvbnRyb2wudjFhbHBoYTEuU2VsZWN0ZWRJdGVtQgsKCV9zdG9yZV9pZCLpAgoMU2VsZWN0ZWRJdGVtEj8KBmVudGl0eRgBIAEoCzItLnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLlNlbGVjdGVkRW50aXR5SAASRQoJY29tcG9uZW50GAIgASgLMjAucmVydW4udmlld2VyX2NvbnRyb2wudjFhbHBoYTEuU2VsZWN0ZWRDb21wb25lbnRIABI7CgR2aWV3GAMgASgLMisucmVydW4udmlld2VyX2NvbnRyb2wudjFhbHBoYTEuU2VsZWN0ZWRWaWV3SAASRQoJY29udGFpbmVyGAQgASgLMjAucmVydW4udmlld2VyX2NvbnRyb2wudjFhbHBoYTEuU2VsZWN0ZWRDb250YWluZXJIABJFCglyZWNvcmRpbmcYBSABKAsyMC5yZXJ1bi52aWV3ZXJfY29udHJvbC52MWFscGhhMS5TZWxlY3RlZFJlY29yZGluZ0gAQgYKBGtpbmQifwoOU2VsZWN0ZWRFbnRpdHkSEwoLZW50aXR5X3BhdGgYASABKAkSFQoIaW5zdGFuY2UYAiABKARIAIgBARI0Cgd2aWV3X2lkGAMgASgLMiMucmVydW4udmlld2VyX2NvbnRyb2wudjFhbHBoYTEuVXVpZEILCglfaW5zdGFuY2UiOwoRU2VsZWN0ZWRDb21wb25lbnQSEwoLZW50aXR5X3BhdGgYASABKAkSEQoJY29tcG9uZW50GAIgASgJIkQKDFNlbGVjdGVkVmlldxI0Cgd2aWV3X2lkGAEgASgLMiMucmVydW4udmlld2VyX2NvbnRyb2wudjFhbHBoYTEuVXVpZCJOChFTZWxlY3RlZENvbnRhaW5lchI5Cgxjb250YWluZXJfaWQYASABKAsyIy5yZXJ1bi52aWV3ZXJfY29udHJvbC52MWFscGhhMS5VdWlkIiUKEVNlbGVjdGVkUmVjb3JkaW5nEhAKCHN0b3JlX2lkGAEgASgJIhEKD0dldFN0YXRlUmVxdWVzdCKxAwoQR2V0U3RhdGVSZXNwb25zZRIQCghsb2NhdGlvbhgBIAEoCRIcCg9hY3RpdmVfc3RvcmVfaWQYAiABKAlIAIgBARJCCgpyZWNvcmRpbmdzGAMgAygLMi4ucmVydW4udmlld2VyX2NvbnRyb2wudjFhbHBoYTEuVmlld2VyUmVjb3JkaW5nEhgKC2NhdGFsb2dfdXJsGAQgASgJSAGIAQESOAoFdmlld3MYBSADKAsyKS5yZXJ1bi52aWV3ZXJfY29udHJvbC52MWFscGhhMS5WaWV3ZXJWaWV3EhsKDnZpZXdlcl92ZXJzaW9uGAYgASgJSAKIAQESQwoHbG9hZGluZxgHIAMoCzIyLnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLlZpZXdlckxvYWRpbmdTb3VyY2USPAoHc2VydmVycxgIIAMoCzIrLnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLlZpZXdlclNlcnZlckISChBfYWN0aXZlX3N0b3JlX2lkQg4KDF9jYXRhbG9nX3VybEIRCg9fdmlld2VyX3ZlcnNpb24ifwoMVmlld2VyU2VydmVyEg4KBm9yaWdpbhgBIAEoCRJBCgdlbnRyaWVzGAIgAygLMjAucmVydW4udmlld2VyX2NvbnRyb2wudjFhbHBoYTEuVmlld2VyU2VydmVyRW50cnkSEgoFZXJyb3IYAyABKAlIAIgBAUIICgZfZXJyb3IiXQoRVmlld2VyU2VydmVyRW50cnkSDAoEbmFtZRgBIAEoCRItCgRraW5kGAIgASgOMh8ucmVydW4uY2xvdWQudjFhbHBoYTEuRW50cnlLaW5kEgsKA3VybBgDIAEoCSIzChNWaWV3ZXJMb2FkaW5nU291cmNlEgwKBG5hbWUYASABKAkSDgoGc3RhdHVzGAIgASgJIpkBCgpWaWV3ZXJWaWV3Eg8KB3ZpZXdfaWQYASABKAkSDQoFY2xhc3MYAiABKAkSDAoEbmFtZRgDIAEoCRIOCgZvcmlnaW4YBCABKAkSDwoHdmlzaWJsZRgFIAEoCBI8CgdyZXBvcnRzGAYgAygLMisucmVydW4udmlld2VyX2NvbnRyb2wudjFhbHBoYTEuVmlld2VyUmVwb3J0IlMKDFZpZXdlclJlcG9ydBIQCghzZXZlcml0eRgBIAEoCRIPCgdzdW1tYXJ5GAIgASgJEhQKB2RldGFpbHMYAyABKAlIAIgBAUIKCghfZGV0YWlscyL2AQoPVmlld2VyUmVjb3JkaW5nEhAKCHN0b3JlX2lkGAEgASgJEkAKCXRpbWVsaW5lcxgCIAMoCzItLnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLlZpZXdlclRpbWVsaW5lEj8KDGN1cnJlbnRfdGltZRgDIAEoCzIpLnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLlRpbWVDdXJzb3ISEAoIbG9jYXRpb24YBCABKAkSPAoKcGxheV9zdGF0ZRgFIAEoDjIoLnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLlBsYXlTdGF0ZSKSAgoOVmlld2VyVGltZWxpbmUSMQoIdGltZWxpbmUYASABKAsyHy5yZXJ1bi5jb21tb24udjFhbHBoYTEuVGltZWxpbmUSMgoJdGltZV90eXBlGAIgASgOMh8ucmVydW4uY29tbW9uLnYxYWxwaGExLlRpbWVUeXBlEjkKCnRpbWVfcmFuZ2UYAyABKAsyIC5yZXJ1bi5jb21tb24udjFhbHBoYTEuVGltZVJhbmdlSACIAQESPgoMY3VycmVudF90aW1lGAQgASgLMiMucmVydW4uY29tbW9uLnYxYWxwaGExLlRpbWVsaW5lVGltZUgBiAEBQg0KC190aW1lX3JhbmdlQg8KDV9jdXJyZW50X3RpbWUiewoUSGlnaGxpZ2h0UmVjdFJlcXVlc3QSPAoEcmVjdBgBIAEoCzIpLnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLlNjcmVlblJlY3RIAIgBARISCgVsYWJlbBgCIAEoCUgBiAEBQgcKBV9yZWN0QggKBl9sYWJlbCI4CgpTY3JlZW5SZWN0EgkKAXgYASABKAISCQoBeRgCIAEoAhIJCgF3GAMgASgCEgkKAWgYBCABKAIiFwoVSGlnaGxpZ2h0UmVjdFJlc3BvbnNlIt0BChNMaXN0Q29tbWFuZHNSZXF1ZXN0EiEKFGluY2x1ZGVfZGVzY3JpcHRpb25zGAEgASgISACIAQESIAoTaW5jbHVkZV91bmF2YWlsYWJsZRgCIAEoCEgBiAEBEhUKCHN0b3JlX2lkGAMgASgJSAKIAQESGgoNc2VydmVyX29yaWdpbhgEIAEoCUgDiAEBQhcKFV9pbmNsdWRlX2Rlc2NyaXB0aW9uc0IWChRfaW5jbHVkZV91bmF2YWlsYWJsZUILCglfc3RvcmVfaWRCEAoOX3NlcnZlcl9vcmlnaW4iVwoUTGlzdENvbW1hbmRzUmVzcG9uc2USPwoIY29tbWFuZHMYASADKAsyLS5yZXJ1bi52aWV3ZXJfY29udHJvbC52MWFscGhhMS5Db21tYW5kU3VtbWFyeSJGCg5Db21tYW5kU3VtbWFyeRIKCgJpZBgBIAEoCRIYCgtkZXNjcmlwdGlvbhgCIAEoCUgAiAEBQg4KDF9kZXNjcmlwdGlvbiI+CgtPcGVuUmVxdWVzdBILCgN1cmwYASABKAkSFQoIbmF2aWdhdGUYAiABKAhIAIgBAUILCglfbmF2aWdhdGUiRwoMT3BlblJlc3BvbnNlEhEKCXN0b3JlX2lkcxgCIAMoCRIPCgdsb2FkaW5nGAMgAygJSgQIARACUg1zdGlsbF9sb2FkaW5nIrsBChFSdW5Db21tYW5kUmVxdWVzdBIKCgJpZBgBIAEoCRIVCghzdG9yZV9pZBgCIAEoCUgAiAEBEhoKDXNlcnZlcl9vcmlnaW4YAyABKAlIAYgBARIoChthbGxvd19ibG9ja2luZ19uYXRpdmVfbW9kYWwYBCABKAhIAogBAUILCglfc3RvcmVfaWRCEAoOX3NlcnZlcl9vcmlnaW5CHgocX2FsbG93X2Jsb2NraW5nX25hdGl2ZV9tb2RhbCJTChJSdW5Db21tYW5kUmVzcG9uc2USPQoHY29tbWFuZBgBIAEoCzIsLnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLlZpZXdlckNvbW1hbmQigwEKFVNhdmVTY3JlZW5zaG90UmVxdWVzdBIUCgd2aWV3X2lkGAEgASgJSACIAQESFgoJZmlsZV9wYXRoGAIgASgJSAGIAQESFQoIbWF4X3NpemUYAyABKA1IAogBAUIKCghfdmlld19pZEIMCgpfZmlsZV9wYXRoQgsKCV9tYXhfc2l6ZSIyChZTYXZlU2NyZWVuc2hvdFJlc3BvbnNlEhAKA3BuZxgBIAEoDEgAiAEBQgYKBF9wbmciVwoaQ2FwdHVyZVByb2ZpbGVUcmFjZVJlcXVlc3QSEQoJZmlsZV9wYXRoGAEgASgJEhcKCm51bV9mcmFtZXMYAiABKA1IAIgBAUINCgtfbnVtX2ZyYW1lcyJEChtDYXB0dXJlUHJvZmlsZVRyYWNlUmVzcG9uc2USEgoKbnVtX2ZyYW1lcxgBIAEoDRIRCglmaWxlX3BhdGgYAiABKAkioQIKE1NldEJsdWVwcmludFJlcXVlc3QSDAoEanNvbhgCIAEoCRJFCgRtb2RlGAUgASgOMjIucmVydW4udmlld2VyX2NvbnRyb2wudjFhbHBoYTEuQmx1ZXByaW50VXBkYXRlTW9kZUgBiAEBEkwKCXJlY29yZGluZxgDIAEoCzI3LnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLlJlY29yZGluZ0JsdWVwcmludFRhcmdldEgAEkQKBXRhYmxlGAQgASgLMjMucmVydW4udmlld2VyX2NvbnRyb2wudjFhbHBoYTEuVGFibGVCbHVlcHJpbnRUYXJnZXRIAEIICgZ0YXJnZXRCBwoFX21vZGVKBAgBEAJSCHN0b3JlX2lkIpABChRTZXRCbHVlcHJpbnRSZXNwb25zZRIUCgxibHVlcHJpbnRfaWQYASABKAkSFQoIc3RvcmVfaWQYAiABKAlIAIgBARIWCgl0YWJsZV91cmwYAyABKAlIAYgBARIYChBjcmVhdGVkX2VudGl0aWVzGAQgAygJQgsKCV9zdG9yZV9pZEIMCgpfdGFibGVfdXJsIp4CChRTZXRUaW1lQ3Vyc29yUmVxdWVzdBIVCghzdG9yZV9pZBgBIAEoCUgAiAEBEjYKCHRpbWVsaW5lGAIgASgLMh8ucmVydW4uY29tbW9uLnYxYWxwaGExLlRpbWVsaW5lSAGIAQESNgoEdGltZRgDIAEoCzIjLnJlcnVuLmNvbW1vbi52MWFscGhhMS5UaW1lbGluZVRpbWVIAogBARJBCgpwbGF5X3N0YXRlGAUgASgOMigucmVydW4udmlld2VyX2NvbnRyb2wudjFhbHBoYTEuUGxheVN0YXRlSAOIAQFCCwoJX3N0b3JlX2lkQgsKCV90aW1lbGluZUIHCgVfdGltZUINCgtfcGxheV9zdGF0ZUoECAQQBVIEcGxheSLDAQoVU2V0VGltZUN1cnNvclJlc3BvbnNlEhAKCHN0b3JlX2lkGAEgASgJEjEKCHRpbWVsaW5lGAIgASgLMh8ucmVydW4uY29tbW9uLnYxYWxwaGExLlRpbWVsaW5lEjIKCXRpbWVfdHlwZRgDIAEoDjIfLnJlcnVuLmNvbW1vbi52MWFscGhhMS5UaW1lVHlwZRIxCgR0aW1lGAQgASgLMiMucmVydW4uY29tbW9uLnYxYWxwaGExLlRpbWVsaW5lVGltZSLHAQoKVGltZUN1cnNvchIxCgh0aW1lbGluZRgBIAEoCzIfLnJlcnVuLmNvbW1vbi52MWFscGhhMS5UaW1lbGluZRI3Cgl0aW1lX3R5cGUYAiABKA4yHy5yZXJ1bi5jb21tb24udjFhbHBoYTEuVGltZVR5cGVIAIgBARI2CgR0aW1lGAMgASgLMiMucmVydW4uY29tbW9uLnYxYWxwaGExLlRpbWVsaW5lVGltZUgBiAEBQgwKCl90aW1lX3R5cGVCBwoFX3RpbWUiFAoSR2V0TG9jYXRpb25SZXF1ZXN0IicKE0dldExvY2F0aW9uUmVzcG9uc2USEAoIbG9jYXRpb24YASABKAkiJgoSU2V0TG9jYXRpb25SZXF1ZXN0EhAKCGxvY2F0aW9uGAEgASgJIhUKE1NldExvY2F0aW9uUmVzcG9uc2UijgIKFVN1Ym1pdEZlZWRiYWNrUmVxdWVzdBINCgV0aXRsZRgBIAEoCRJBCghjYXRlZ29yeRgCIAEoDjIvLnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLkZlZWRiYWNrQ2F0ZWdvcnkSFAoHc3VyZmFjZRgDIAEoCUgAiAEBEhQKB3N1bW1hcnkYBCABKAlIAYgBARISCgVhZ2VudBgFIAEoCUgCiAEBEkEKCHNldmVyaXR5GAYgASgOMi8ucmVydW4udmlld2VyX2NvbnRyb2wudjFhbHBoYTEuRmVlZGJhY2tTZXZlcml0eUIKCghfc3VyZmFjZUIKCghfc3VtbWFyeUIICgZfYWdlbnQiGAoWU3VibWl0RmVlZGJhY2tSZXNwb25zZSp/ChNCbHVlcHJpbnRVcGRhdGVNb2RlEiUKIUJMVUVQUklOVF9VUERBVEVfTU9ERV9VTlNQRUNJRklFRBAAEh4KGkJMVUVQUklOVF9VUERBVEVfTU9ERV9GVUxMEAESIQodQkxVRVBSSU5UX1VQREFURV9NT0RFX1BBUlRJQUwQAipwCglQbGF5U3RhdGUSGgoWUExBWV9TVEFURV9VTlNQRUNJRklFRBAAEhUKEVBMQVlfU1RBVEVfUEFVU0VEEAESFgoSUExBWV9TVEFURV9QTEFZSU5HEAISGAoUUExBWV9TVEFURV9GT0xMT1dJTkcQAyqAAgoQRmVlZGJhY2tDYXRlZ29yeRIhCh1GRUVEQkFDS19DQVRFR09SWV9VTlNQRUNJRklFRBAAEhkKFUZFRURCQUNLX0NBVEVHT1JZX0JVRxABEiMKH0ZFRURCQUNLX0NBVEVHT1JZX0RPQ1NfTUlTTUFUQ0gQAhIeChpGRUVEQkFDS19DQVRFR09SWV9GUklDVElPThADEiEKHUZFRURCQUNLX0NBVEVHT1JZX0ZFQVRVUkVfR0FQEAQSKQolRkVFREJBQ0tfQ0FURUdPUllfUVVBTElUWV9ERUdSQURBVElPThAFEhsKF0ZFRURCQUNLX0NBVEVHT1JZX09USEVSEAYqqgEKEEZlZWRiYWNrU2V2ZXJpdHkSIQodRkVFREJBQ0tfU0VWRVJJVFlfVU5TUEVDSUZJRUQQABIeChpGRUVEQkFDS19TRVZFUklUWV9DUklUSUNBTBABEhoKFkZFRURCQUNLX1NFVkVSSVRZX0hJR0gQAhIcChhGRUVEQkFDS19TRVZFUklUWV9NRURJVU0QAxIZChVGRUVEQkFDS19TRVZFUklUWV9MT1cQBDKMAgoUVmlld2VyQ29udHJvbFNlcnZpY2USfAoNVmlld2VyQ29udHJvbBIzLnJlcnVuLnZpZXdlcl9jb250cm9sLnYxYWxwaGExLlZpZXdlckNvbnRyb2xSZXF1ZXN0GjQucmVydW4udmlld2VyX2NvbnRyb2wudjFhbHBoYTEuVmlld2VyQ29udHJvbFJlc3BvbnNlIgASdgoLRWd1aUluc3BlY3QSMS5yZXJ1bi52aWV3ZXJfY29udHJvbC52MWFscGhhMS5FZ3VpSW5zcGVjdFJlcXVlc3QaMi5yZXJ1bi52aWV3ZXJfY29udHJvbC52MWFscGhhMS5FZ3VpSW5zcGVjdFJlc3BvbnNlIgBiBnByb3RvMw", [file_rerun_v1alpha1_cloud, file_rerun_v1alpha1_common]);
var ViewerControlRequestSchema = /* @__PURE__ */ messageDesc(file_rerun_v1alpha1_viewer_control, 0);
var ViewerControlResponseSchema = /* @__PURE__ */ messageDesc(file_rerun_v1alpha1_viewer_control, 1);
var GetStateResponseSchema = /* @__PURE__ */ messageDesc(file_rerun_v1alpha1_viewer_control, 42);

// exact_json.ts
function parseExactJson(text) {
  const marker = newMarker();
  let quoted = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"') {
      const end = stringEnd(text, i);
      quoted += text.slice(i, end);
      i = end;
    } else if (c === "-" || "0" <= c && c <= "9") {
      const token = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(i))?.[0] ?? c;
      const isUnsafeInteger = /^-?\d+$/.test(token) && !Number.isSafeInteger(Number(token));
      quoted += isUnsafeInteger ? `"${marker}${token}"` : token;
      i += token.length;
    } else {
      quoted += c;
      i += 1;
    }
  }
  return JSON.parse(
    quoted,
    (...[, value]) => typeof value === "string" && value.startsWith(marker) ? BigInt(value.slice(marker.length)) : value
  );
}
__name(parseExactJson, "parseExactJson");
function stringifyExactJson(value) {
  const marker = newMarker();
  const json = JSON.stringify(value, function(key, value2) {
    const raw = this[key];
    return typeof raw === "bigint" ? `${marker}${raw}` : value2;
  });
  return json.replace(new RegExp(`"${marker}(-?\\d+)"`, "g"), "$1");
}
__name(stringifyExactJson, "stringifyExactJson");
function newMarker() {
  return `rerun-exact-json-${Math.random().toString(36).slice(2)}-${Date.now()}:`;
}
__name(newMarker, "newMarker");
function stringEnd(text, start) {
  let i = start + 1;
  while (i < text.length && text[i] !== '"') {
    i += text[i] === "\\" ? 2 : 1;
  }
  return i + 1;
}
__name(stringEnd, "stringEnd");

// store_id.ts
function parseStoreId(storeId) {
  const kindEnd = storeId.indexOf(":");
  let applicationId = "";
  let i = kindEnd + 1;
  while (i < storeId.length && storeId[i] !== ":") {
    if (storeId[i] === "\\" && i + 1 < storeId.length) {
      i += 1;
    }
    applicationId += storeId[i];
    i += 1;
  }
  return withLegacyFields({
    kind: kindEnd < 0 ? "" : storeId.slice(0, kindEnd),
    applicationId,
    recordingId: storeId.slice(i + 1)
  });
}
__name(parseStoreId, "parseStoreId");
var parse_store_id = parseStoreId;

// index.ts
function selectionOf(selection) {
  const items = [];
  for (const { kind } of selection.items) {
    switch (kind.case) {
      case "entity":
        items.push({
          type: "entity",
          entityPath: kind.value.entityPath,
          instance: kind.value.instance,
          viewId: kind.value.viewId?.uuid
        });
        break;
      case "component":
        items.push({
          type: "component",
          entityPath: kind.value.entityPath,
          component: kind.value.component
        });
        break;
      case "view":
        items.push({ type: "view", viewId: kind.value.viewId?.uuid ?? "" });
        break;
      case "container":
        items.push({ type: "container", containerId: kind.value.containerId?.uuid ?? "" });
        break;
      case "recording":
        items.push({ type: "recording", storeId: kind.value.storeId });
        break;
    }
  }
  return { storeId: selection.storeId, items };
}
__name(selectionOf, "selectionOf");
function viewerStateOf(state) {
  return withLegacyFields({
    location: state.location,
    activeStoreId: state.activeStoreId,
    recordings: state.recordings.map((recording) => ({
      storeId: recording.storeId,
      location: recording.location,
      timelines: recording.timelines.map(timelineOf),
      playState: playStateOf(recording.playState),
      currentTime: recording.currentTime && {
        timeline: recording.currentTime.timeline?.name ?? "",
        timeType: timeTypeOf(recording.currentTime.timeType),
        time: recording.currentTime.time?.time
      }
    })),
    views: state.views.map((view) => ({
      viewId: view.viewId,
      class: view.class,
      name: view.name,
      origin: view.origin,
      visible: view.visible,
      reports: view.reports.map(({ severity, summary, details }) => ({
        severity,
        summary,
        details
      }))
    })),
    loading: state.loading.map(({ name, status }) => ({ name, status })),
    servers: state.servers.map((server) => ({
      origin: server.origin,
      entries: server.entries.map((entry) => ({
        name: entry.name,
        kind: entryKindOf(entry.kind),
        url: entry.url
      })),
      error: server.error
    })),
    catalogUrl: state.catalogUrl,
    viewerVersion: state.viewerVersion
  });
}
__name(viewerStateOf, "viewerStateOf");
function playStateOf(playState) {
  switch (playState) {
    case 1 /* PAUSED */:
      return "paused";
    case 2 /* PLAYING */:
      return "playing";
    case 3 /* FOLLOWING */:
      return "following";
    default:
      return void 0;
  }
}
__name(playStateOf, "playStateOf");
function playStateToProto(playState) {
  switch (playState) {
    case "paused":
      return 1 /* PAUSED */;
    case "playing":
      return 2 /* PLAYING */;
    case "following":
      return 3 /* FOLLOWING */;
    default:
      return void 0;
  }
}
__name(playStateToProto, "playStateToProto");
function timeTypeOf(timeType) {
  switch (timeType) {
    case 1 /* SEQUENCE */:
      return "sequence";
    case 2 /* DURATION_NS */:
      return "duration";
    case 3 /* TIMESTAMP_NS */:
      return "timestamp";
    default:
      return void 0;
  }
}
__name(timeTypeOf, "timeTypeOf");
function entryKindOf(kind) {
  switch (kind) {
    case 1 /* DATASET */:
      return "dataset";
    case 2 /* DATASET_VIEW */:
      return "dataset_view";
    case 3 /* TABLE */:
      return "table";
    case 4 /* TABLE_VIEW */:
      return "table_view";
    case 5 /* BLUEPRINT_DATASET */:
      return "blueprint_dataset";
    case 6 /* ASSET_DATASET */:
      return "asset_dataset";
    default:
      return void 0;
  }
}
__name(entryKindOf, "entryKindOf");
function timelineOf(timeline) {
  return withLegacyFields({
    name: timeline.timeline?.name ?? "",
    timeType: timeTypeOf(timeline.timeType),
    timeRange: timeline.timeRange && {
      start: timeline.timeRange.start,
      end: timeline.timeRange.end
    },
    currentTime: timeline.currentTime?.time
  });
}
__name(timelineOf, "timelineOf");
function entitySchemaOf(entity) {
  return withLegacyFields({
    entityPath: entity.entityPath,
    components: entity.components.map((component) => ({
      component: component.component,
      archetype: component.archetype,
      componentType: component.componentType,
      datatype: component.datatype,
      hasStatic: component.hasStatic ?? false
    }))
  });
}
__name(entitySchemaOf, "entitySchemaOf");
function schemaRequestOf({ entityPath, maxEntities, pathsOnly }) {
  return { entityPath, maxEntities, pathsOnly };
}
__name(schemaRequestOf, "schemaRequestOf");
function viewerCommandOf(command) {
  return withLegacyFields({
    id: command.id,
    title: command.title,
    description: command.description,
    scope: command.scope,
    shortcuts: command.shortcuts,
    available: command.available,
    blockingNativeModal: command.blockingNativeModal,
    destructive: command.destructive,
    target: command.target
  });
}
__name(viewerCommandOf, "viewerCommandOf");
function closeTargetOf(target) {
  if (target === "current") {
    return { case: "current", value: true };
  }
  if (target === "all") {
    return { case: "all", value: true };
  }
  if (typeof target === "string" || Array.isArray(target)) {
    return { case: "urls", value: { urls: Array.isArray(target) ? target : [target] } };
  }
  if (typeof target === "object" && target !== null && "storeIds" in target) {
    return { case: "storeIds", value: { storeIds: target.storeIds } };
  }
  throw new Error('close expects URLs, `{ storeIds }`, `"current"`, or `"all"`');
}
__name(closeTargetOf, "closeTargetOf");
function blueprintTargetOf(target) {
  return target.kind === "recording" ? { case: "recording", value: { storeId: target.recording } } : { case: "table", value: { tableUrl: target.tableUrl } };
}
__name(blueprintTargetOf, "blueprintTargetOf");
var FRAME_FILTERS = {
  "entity_path": 1 /* ENTITY_PATH */,
  named: 2 /* NAMED */,
  all: 3 /* ALL */
};
var EDGE_FILTERS = {
  static: 1 /* STATIC */,
  temporal: 2 /* TEMPORAL */,
  all: 3 /* ALL */
};
var ViewerControlError = class extends Error {
  static {
    __name(this, "ViewerControlError");
  }
  name = "ViewerControlError";
  /** Why the operation failed. */
  code;
  constructor(code, message) {
    super(message);
    this.code = code;
  }
};
function asViewerControlError(err) {
  if (err instanceof Error && err.name === "ViewerControlError" && "code" in err) {
    return new ViewerControlError(err.code, err.message);
  }
  return err;
}
__name(asViewerControlError, "asViewerControlError");
function timeOf(options) {
  const values = [options.sequence, options.durationNanos, options.timestampNanos].filter(
    (value2) => value2 !== void 0
  );
  if (1 < values.length) {
    throw new Error(
      "setTime expects at most one of `sequence`, `durationNanos`, and `timestampNanos`"
    );
  }
  const [value] = values;
  if (value === void 0) {
    return void 0;
  }
  if (typeof value === "number" && !Number.isSafeInteger(value)) {
    throw new Error(`setTime expects an integer time, got ${value}`);
  }
  return BigInt(value);
}
__name(timeOf, "timeOf");
var getWasmBindgen = null;
var wasmModule = null;
function hasWasmSimd() {
  try {
    return WebAssembly.validate(
      new Uint8Array([
        0,
        97,
        115,
        109,
        1,
        0,
        0,
        0,
        1,
        5,
        1,
        96,
        0,
        1,
        123,
        3,
        2,
        1,
        0,
        10,
        10,
        1,
        8,
        0,
        65,
        0,
        253,
        15,
        253,
        98,
        11
      ])
    );
  } catch {
    return false;
  }
}
__name(hasWasmSimd, "hasWasmSimd");
var UNSUPPORTED_BROWSER_MESSAGE = "Your browser is too old to run the Rerun Viewer. The Viewer requires WebAssembly SIMD support, available in Chrome 91+, Firefox 89+, Safari 16.4+, or any modern Chromium-based browser. Please update your browser and try again.";
function exportStream(bytes) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    }
  });
}
__name(exportStream, "exportStream");
async function fetchViewerJs() {
  return (await import("./re_viewer.js")).default;
}
__name(fetchViewerJs, "fetchViewerJs");
async function fetchViewerWasm(baseUrl, onProgress) {
  //!<INLINE-MARKER-OPEN>
  const url = baseUrl ? new URL("./re_viewer_bg.wasm", baseUrl) : new URL("./re_viewer_bg.wasm", import.meta.url);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch viewer Wasm: ${response.status} ${response.statusText}`);
  }
  return wrapFetchWithProgress(response, onProgress);
  //!<INLINE-MARKER-CLOSE>
}
__name(fetchViewerWasm, "fetchViewerWasm");
function estimateTotalBytes(response) {
  const finalLength = response.headers.get("rerun-final-length");
  if (finalLength != null) return parseInt(finalLength, 10);
  const uncompressed = response.headers.get("x-goog-meta-uncompressed-size");
  if (uncompressed != null) return parseInt(uncompressed, 10);
  if (response.headers.get("content-encoding") === "gzip") {
    const cl2 = response.headers.get("content-length");
    if (cl2 != null) return parseInt(cl2, 10) * 3;
  }
  const cl = response.headers.get("content-length");
  if (cl != null) return parseInt(cl, 10);
  return null;
}
__name(estimateTotalBytes, "estimateTotalBytes");
function wrapFetchWithProgress(response, onProgress) {
  const totalBytes = estimateTotalBytes(response);
  if (!response.body) return response;
  let received = 0;
  const body = response.body;
  const tracked = new ReadableStream({
    async start(controller) {
      const reader = body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        onProgress?.(received, totalBytes);
        controller.enqueue(value);
      }
      controller.close();
    }
  });
  return new Response(tracked, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}
__name(wrapFetchWithProgress, "wrapFetchWithProgress");
function formatMib(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1) + " MiB";
}
__name(formatMib, "formatMib");
async function load(baseUrl, onProgress) {
  if (!hasWasmSimd()) {
    throw new Error(UNSUPPORTED_BROWSER_MESSAGE);
  }
  if (!getWasmBindgen || !wasmModule) {
    [getWasmBindgen, wasmModule] = await Promise.all([
      fetchViewerJs(),
      WebAssembly.compileStreaming(fetchViewerWasm(baseUrl, onProgress))
    ]);
  }
  let bindgen = getWasmBindgen();
  await bindgen({ "module_or_path": wasmModule });
  return class extends bindgen.WebHandle {
    free() {
      super.free();
      bindgen.deinit();
    }
  };
}
__name(load, "load");
var minimizeCurrentFullscreenViewer = null;
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
__name(delay, "delay");
function camelCaseKeys(value) {
  if (Array.isArray(value)) return value.map(camelCaseKeys);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase()),
      camelCaseKeys(child)
    ])
  );
}
__name(camelCaseKeys, "camelCaseKeys");
function resolveAbsoluteUrl(url) {
  return new URL(url, window.location.href).toString();
}
__name(resolveAbsoluteUrl, "resolveAbsoluteUrl");
var WebViewer = class {
  static {
    __name(this, "WebViewer");
  }
  // NOTE: Using the handle requires wrapping all calls to its methods in try/catch.
  //       On failure, call `this.stop` to prevent a memory leak, then re-throw the error.
  #handle = null;
  #cachedViewerState = null;
  #canvas = null;
  #loader = null;
  #state = "stopped";
  #fullscreen = false;
  #allowFullscreen = false;
  constructor() {
    if (typeof window === "undefined" || typeof document === "undefined") {
      throw new Error(
        "WebViewer requires a browser document and canvas. In Node.js, use Playwright to run the viewer in a browser, or launch the native headless viewer with `rerun --headless`."
      );
    }
    injectStyle();
    setupGlobalEventListeners();
  }
  /**
   * Start the viewer.
   *
   * @param rrd URLs to `.rrd` files or gRPC connections to our SDK.
   * @param parent The element to attach the canvas onto.
   * @param options Web Viewer configuration.
   */
  async start(rrd, parent, options) {
    parent ??= document.body;
    options = normalizeOptions(options ?? {});
    this.#allowFullscreen = options.allowFullscreen || false;
    if (this.#state !== "stopped") return;
    this.#state = "starting";
    this.#clearLoader();
    this.#canvas = document.createElement("canvas");
    this.#canvas.style.width = options.width ?? "640px";
    this.#canvas.style.height = options.height ?? "360px";
    parent.append(this.#canvas);
    this.#loader = document.createElement("div");
    this.#loader.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; background-color: #1c1c1c; font-family: sans-serif; color: white;">
        <div style="margin-bottom: 16px;">Loading Rerun\u2026</div>
        <div style="width: 200px;">
          <div style="background: #333; border-radius: 4px; height: 6px; overflow: hidden;">
            <div class="rerun-progress-bar" style="background: white; height: 100%; width: 0%; transition: width 0.2s;"></div>
          </div>
          <div class="rerun-progress-text" style="margin-top: 6px; font-size: 12px; color: #999;"></div>
        </div>
      </div>
    `;
    this.#loader.style.position = "absolute";
    this.#loader.style.inset = "0";
    parent.style.position = "relative";
    parent.append(this.#loader);
    const progressBar = this.#loader.querySelector(".rerun-progress-bar");
    const progressText = this.#loader.querySelector(".rerun-progress-text");
    const onProgress = /* @__PURE__ */ __name((received, total) => {
      if (total != null && total > 0) {
        const pct = Math.min(received / total * 100, 100);
        progressBar.style.width = pct.toFixed(1) + "%";
        progressText.textContent = `${Math.round(pct)}%`;
      } else {
        progressText.textContent = formatMib(received);
      }
    }, "onProgress");
    await delay(0);
    let baseUrl = options?.baseUrl;
    if (baseUrl) {
      delete options.baseUrl;
    }
    let WebHandleClass;
    try {
      WebHandleClass = await load(baseUrl, onProgress);
    } catch (e) {
      this.#clearLoader();
      this.#fail("Failed to load rerun", String(e));
      throw e;
    }
    if (this.#state !== "starting") {
      this.#clearLoader();
      return;
    }
    const fullscreen = this.#allowFullscreen ? {
      getState: /* @__PURE__ */ __name(() => this.#fullscreen, "getState"),
      onToggle: /* @__PURE__ */ __name(() => this.toggleFullscreen(), "onToggle")
    } : void 0;
    const onViewerEvent = /* @__PURE__ */ __name((eventJson) => {
      this.#dispatchRawEvent(eventJson);
      let event = withLegacyFields(camelCaseKeys(JSON.parse(eventJson)));
      this.#dispatchEvent(event.type, event);
    }, "onViewerEvent");
    const login = options.login ? {
      signedInUrl: resolveAbsoluteUrl(options.login.signedInUrl),
      signedOutUrl: resolveAbsoluteUrl(options.login.signedOutUrl)
    } : void 0;
    this.#handle = new WebHandleClass({ ...options, login, fullscreen, onViewerEvent });
    try {
      await this.#handle.start(this.#canvas);
    } catch (e) {
      this.#clearLoader();
      this.#fail("Failed to start", String(e));
      throw e;
    }
    if (this.#state !== "starting") {
      this.#clearLoader();
      return;
    }
    this.#clearLoader();
    this.#state = "ready";
    this.#dispatchEvent("ready");
    if (rrd) {
      this.#addReceivers(rrd);
    }
    const checkForPanic = /* @__PURE__ */ __name(() => {
      if (this.#handle?.has_panicked()) {
        this.#fail("Rerun has crashed.", this.#handle?.panic_message());
      } else {
        let delayMs = 1e3;
        setTimeout(checkForPanic, delayMs);
      }
    }, "checkForPanic");
    checkForPanic();
    return;
  }
  #rawEvents = /* @__PURE__ */ new Set();
  #dispatchRawEvent(eventJson) {
    for (const callback of this.#rawEvents) {
      callback(eventJson);
    }
  }
  /** Internal interface */
  // NOTE: Callbacks passed to this function must NOT invoke any viewer methods!
  //       The `setTimeout` is omitted to avoid the 1-tick delay, as it is unnecessary,
  //       because this is only meant to be used for sending events to Jupyter/Gradio.
  //
  // Do not change this without searching for grepping for usage!
  "_on_raw_event"(callback) {
    this.#rawEvents.add(callback);
    return () => this.#rawEvents.delete(callback);
  }
  #eventMap = /* @__PURE__ */ new Map();
  #dispatchEvent(event, ...args) {
    setTimeout(() => {
      const callbacks = this.#eventMap.get(event);
      if (callbacks) {
        for (const [callback, { once }] of Array.from(callbacks)) {
          callback(...args);
          if (once) callbacks.delete(callback);
        }
      }
    }, 0);
  }
  on(event, callback) {
    const callbacks = this.#eventMap.get(event) ?? /* @__PURE__ */ new Map();
    callbacks.set(callback, { once: false });
    this.#eventMap.set(event, callbacks);
    return () => callbacks.delete(callback);
  }
  once(event, callback) {
    const callbacks = this.#eventMap.get(event) ?? /* @__PURE__ */ new Map();
    callbacks.set(callback, { once: true });
    this.#eventMap.set(event, callbacks);
    return () => callbacks.delete(callback);
  }
  off(event, callback) {
    const callbacks = this.#eventMap.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    } else {
      console.warn(
        "Attempted to call `WebViewer.off` with an unregistered callback. Are you passing in the same function instance?"
      );
    }
  }
  /**
   * The underlying canvas element.
   */
  get canvas() {
    return this.#canvas;
  }
  /**
   * Returns `true` if the viewer is ready to connect to data sources.
   */
  get ready() {
    return this.#state === "ready";
  }
  /** Start loading from `rrd`, without waiting for it. */
  #addReceivers(rrd) {
    if (!this.#handle) {
      throw new Error(`attempted to open \`${String(rrd)}\` in a stopped viewer`);
    }
    const urls = Array.isArray(rrd) ? rrd : [rrd];
    for (const url of urls) {
      try {
        this.#handle.add_receiver(url);
      } catch (e) {
        this.#fail("Failed to open recording", String(e));
        throw e;
      }
    }
  }
  /**
   * Save the active recording as an `.rrd` byte stream.
   *
   * The snapshot is selected when this method is called.
   * Concatenate all stream byte sequences to obtain one valid file.
   * An individual sequence is not independently accepted by {@link WebViewer.openChannel}.
   *
   * @throws If the viewer is stopped or has no active recording.
   */
  saveRecording() {
    if (!this.#handle) {
      throw new Error(`attempted to save recording in a stopped web viewer`);
    }
    const bytes = this.#handle.save_recording();
    return exportStream(bytes);
  }
  /**
   * Save the active blueprint as an `.rbl` byte stream.
   *
   * The snapshot is selected when this method is called.
   * Concatenate all stream byte sequences to obtain one valid file.
   * An individual sequence is not independently accepted by {@link WebViewer.openChannel}.
   *
   * @throws If the viewer is stopped or has no active blueprint.
   */
  saveBlueprint() {
    if (!this.#handle) {
      throw new Error(`attempted to save blueprint in a stopped web viewer`);
    }
    const bytes = this.#handle.save_blueprint();
    return exportStream(bytes);
  }
  /**
   * Stop the viewer, freeing all associated memory.
   *
   * The same viewer instance may be started multiple times.
   */
  stop() {
    if (this.#state === "stopped") return;
    if (this.#allowFullscreen && this.#canvas && this.#fullscreen) {
      this.#minimize();
    }
    this.#state = "stopped";
    this.#canvas?.remove();
    this.#clearLoader();
    try {
      this.#handle?.destroy();
      this.#handle?.free();
    } catch (e) {
      this.#handle = null;
      throw e;
    }
    this.#canvas = null;
    this.#handle = null;
    this.#loader = null;
    this.#fullscreen = false;
    this.#allowFullscreen = false;
  }
  #fail(message, errorMessage) {
    console.error("WebViewer failure:", message, errorMessage);
    if (this.canvas?.parentElement) {
      const parent = this.canvas.parentElement;
      parent.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: white; font-family: sans-serif; background-color: #1c1c1c;">
          <h1 class="rerun-fail-message"></h1>
          <pre class="rerun-fail-error" style="text-align: left; white-space: pre-wrap; word-break: break-word; max-width: 90vw;"></pre>
          <button class="rerun-fail-clear-cache">Clear caches and reload</button>
        </div>
      `;
      parent.querySelector(".rerun-fail-message").textContent = message;
      const errorEl = parent.querySelector(".rerun-fail-error");
      if (errorMessage) {
        errorEl.textContent = errorMessage;
      } else {
        errorEl.remove();
      }
      parent.querySelector(".rerun-fail-clear-cache").addEventListener("click", async () => {
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }
        window.location.reload();
      });
    }
    this.stop();
  }
  #clearLoader() {
    this.#loader?.remove();
    this.#loader = null;
  }
  /**
   * Opens a new channel for sending log messages.
   *
   * The channel can be used to incrementally push `rrd` chunks into the viewer.
   *
   * @param channelName used to identify the channel.
   */
  openChannel(channelName = "rerun-io/web-viewer") {
    if (!this.#handle) {
      throw new Error(`attempted to open channel "${channelName}" in a stopped web viewer`);
    }
    const id = crypto.randomUUID();
    try {
      this.#handle.open_channel(id, channelName);
    } catch (e) {
      this.#fail("Failed to open channel", String(e));
      throw e;
    }
    const onSend = /* @__PURE__ */ __name((data) => {
      if (!this.#handle) {
        throw new Error(
          `attempted to send data through channel "${channelName}" to a stopped web viewer`
        );
      }
      try {
        this.#handle.send_rrd_to_channel(id, data);
      } catch (e) {
        this.#fail("Failed to send data", String(e));
        throw e;
      }
    }, "onSend");
    const onSendTable = /* @__PURE__ */ __name((data) => {
      if (!this.#handle) {
        throw new Error(
          `attempted to send data through channel "${channelName}" to a stopped web viewer`
        );
      }
      try {
        this.#handle.send_table_to_channel(id, data);
      } catch (e) {
        this.#fail("Failed to send table", String(e));
        throw e;
      }
    }, "onSendTable");
    const onClose = /* @__PURE__ */ __name(() => {
      if (!this.#handle) {
        throw new Error(
          `attempted to send data through channel "${channelName}" to a stopped web viewer`
        );
      }
      try {
        this.#handle.close_channel(id);
      } catch (e) {
        this.#fail("Failed to close channel", String(e));
        throw e;
      }
    }, "onClose");
    const getState = /* @__PURE__ */ __name(() => this.#state, "getState");
    return new LogChannel(onSend, onSendTable, onClose, getState);
  }
  /**
   * Force a panel to a specific state.
   *
   * @param panel which panel to configure
   * @param state which state to force the panel into
   */
  overridePanelState(panel, state) {
    if (!this.#handle) {
      throw new Error(`attempted to set ${panel} panel to ${state} in a stopped web viewer`);
    }
    try {
      this.#handle.override_panel_state(panel, state);
    } catch (e) {
      this.#fail("Failed to override panel state", String(e));
      throw e;
    }
  }
  /**
   * Toggle panel overrides set via `overridePanelState`.
   *
   * @param value set to a specific value. Toggles the previous value if not provided.
   */
  togglePanelOverrides(value) {
    if (!this.#handle) {
      throw new Error(`attempted to toggle panel overrides in a stopped web viewer`);
    }
    try {
      this.#handle.toggle_panel_overrides(value);
    } catch (e) {
      this.#fail("Failed to toggle panel overrides", String(e));
      throw e;
    }
  }
  /**
   * Get the active recording id.
   *
   * @deprecated Use the `activeStoreId` of {@link WebViewer.getState} instead.
   */
  "get_active_recording_id"() {
    if (!this.#handle) {
      throw new Error(`attempted to get active recording id in a stopped web viewer`);
    }
    const storeId = this.#viewerState()?.activeStoreId;
    return storeId === void 0 ? null : parseStoreId(storeId).recordingId;
  }
  /**
   * Set the active recording id.
   *
   * This is the same as clicking on the recording in the Viewer's left panel.
   *
   * @deprecated Use {@link WebViewer.setLocation} with the recording's `location` from {@link WebViewer.getState} instead.
   */
  "set_active_recording_id"(value) {
    if (!this.#handle) {
      throw new Error(`attempted to set active recording id to ${value} in a stopped web viewer`);
    }
    const recording = this.#recording(value);
    if (recording) {
      this.#logFailure("setLocation", this.setLocation(recording.location));
    }
  }
  /**
   * What the viewer currently shows.
   *
   * Covers the active recording, every open recording with its timelines, their time ranges and
   * its time cursor, and every view of the current blueprint with the warnings and errors it reports.
   *
   * This API is experimental, and may change between releases.
   */
  async getState() {
    return viewerStateOf(await this.#viewerControl("getState", {}));
  }
  /**
   * What the user has selected: entities or instances of them, components, views, containers, and recordings.
   *
   * Other things the user can select, such as servers and catalog entries, are left out.
   *
   * This API is experimental, and may change between releases.
   */
  async getSelection() {
    return selectionOf(await this.#viewerControl("getSelection", {}));
  }
  /**
   * Move the time cursor, switch the active timeline, or play, pause, or follow the latest data.
   *
   * ```ts
   * await viewer.setTime({ timeline: "frame", sequence: 42, playState: "playing" });
   * ```
   *
   * Rejects with a {@link ViewerControlError} with the code `INVALID_ARGUMENT` if the recording or
   * timeline doesn't exist, or if `playState` is following and a time is set.
   *
   * This API is experimental, and may change between releases.
   */
  async setTime(options) {
    options = normalizeOptions(options);
    const time = timeOf(options);
    await this.#viewerControl("setTimeCursor", {
      storeId: options.recording,
      timeline: options.timeline === void 0 ? void 0 : { name: options.timeline },
      time: time === void 0 ? void 0 : { time },
      playState: playStateToProto(options.playState)
    });
  }
  /**
   * Where the viewer is: a recording, a catalog entry, the settings, …
   *
   * Pass it to {@link WebViewer.setLocation} to come back to it later.
   * This is a Viewer URL, not the address of the web page.
   * A recording is reported as `about:recording?app_id=…&recording_id=…`.
   *
   * This API is experimental, and may change between releases.
   */
  async getLocation() {
    return (await this.#viewerControl("getLocation", {})).location;
  }
  /**
   * Show a location the viewer already has open.
   *
   * Takes a location from {@link WebViewer.getLocation}, or the `location` of a recording from {@link WebViewer.getState}.
   * This only navigates, and never loads anything: use {@link WebViewer.open} for that.
   *
   * Rejects with a {@link ViewerControlError} with the code `NOT_FOUND` if the viewer does not have it open,
   * and `INVALID_ARGUMENT` if it is not a location.
   *
   * This API is experimental, and may change between releases.
   */
  async setLocation(location) {
    await this.#viewerControl("setLocation", { location });
  }
  /**
   * Open URLs: recording or blueprint files, `rerun://` dataset URIs, server or catalog URLs,
   * or links into a recording.
   *
   * A recording it opens becomes the active recording, unless `navigate` is `false`.
   * A location the viewer already has open is not loaded again, only shown.
   * Resolves once the initial load is done, or after about ten seconds, whichever comes first.
   *
   * ```ts
   * const { storeIds } = await viewer.open("https://app.rerun.io/version/0.39.0/examples/dna.rrd");
   * ```
   *
   * Rejects with a {@link ViewerControlError} with the code `NOT_FOUND` for an `about:recording` URL of a recording that is not loaded.
   *
   * This API is experimental, and may change between releases.
   */
  async open(urls, options = {}) {
    options = normalizeOptions(options);
    const responses = await Promise.all(
      (Array.isArray(urls) ? urls : [urls]).map(
        (url) => this.#viewerControl("open", { url, navigate: options.navigate })
      )
    );
    return withLegacyFields({
      storeIds: responses.flatMap((response) => response.storeIds),
      loading: responses.flatMap((response) => response.loading)
    });
  }
  /**
   * Close recordings, and return the store ids of the ones that were closed.
   *
   * Closing by URL also stops loading from it.
   * This only removes recordings from the viewer: unsaved blueprint edits are lost.
   *
   * ```ts
   * await viewer.close("https://app.rerun.io/version/0.39.0/examples/dna.rrd");
   * await viewer.close("all");
   * ```
   *
   * Rejects with a {@link ViewerControlError} with the code `NOT_FOUND` if a recording is not open,
   * or nothing is loaded from a URL. Then nothing is closed.
   *
   * This API is experimental, and may change between releases.
   */
  async close(target) {
    target = normalizeOptions(target);
    const { closed } = await this.#viewerControl("close", { target: closeTargetOf(target) });
    return closed;
  }
  /**
   * The viewer's recent log messages, `INFO` and above, oldest first.
   *
   * Pass the `sequence` of the last entry seen to only get what is new.
   *
   * This API is experimental, and may change between releases.
   */
  async getLogs(afterSequence) {
    const { entries } = await this.#viewerControl("getLogs", {
      afterSequence
    });
    return entries.map(({ sequence, level, target, message }) => ({
      sequence,
      level,
      target,
      message
    }));
  }
  /**
   * A recording's timelines, entities, and the components logged on them.
   *
   * Use `pathsOnly` to see the shape of a large recording,
   * then `entityPath` for the components of the entities that matter.
   *
   * Rejects with a {@link ViewerControlError} with the code `NOT_FOUND` if the recording is not open,
   * or nothing in it is at or below `entityPath`.
   *
   * This API is experimental, and may change between releases.
   */
  async getRecordingSchema(options = {}) {
    options = normalizeOptions(options);
    const response = await this.#viewerControl("getRecordingSchema", {
      storeId: options.recording,
      entityPath: options.entityPath,
      maxEntities: options.maxEntities,
      withArchetypes: false,
      withComponents: !options.pathsOnly
    });
    return withLegacyFields({
      recording: response.storeId,
      timelines: response.timelines.map(timelineOf),
      entities: response.entities.map(entitySchemaOf),
      omittedEntities: response.omittedEntities
    });
  }
  /**
   * The entities of a dataset's segments on a server, and the components logged on them.
   *
   * Nothing is opened or loaded.
   *
   * Rejects with a {@link ViewerControlError} with the code `FAILED_PRECONDITION` if no `datasetUrl` is given
   * and no dataset is on screen, and `NOT_FOUND` if the viewer does not know the dataset.
   *
   * This API is experimental, and may change between releases.
   */
  async getDatasetSchema(options = {}) {
    options = normalizeOptions(options);
    const response = await this.#viewerControl("getDatasetSchema", {
      datasetUrl: options.datasetUrl,
      ...schemaRequestOf(options)
    });
    return withLegacyFields({
      timelines: response.timelines,
      entities: response.entities.map(entitySchemaOf),
      omittedEntities: response.omittedEntities,
      assetIds: response.assetIds
    });
  }
  /**
   * The assets of a dataset on a server, and the entities logged in each.
   *
   * Rejects like {@link WebViewer.getDatasetSchema}.
   *
   * This API is experimental, and may change between releases.
   */
  async getDatasetAssetsSchema(options = {}) {
    options = normalizeOptions(options);
    const { assets } = await this.#viewerControl("getDatasetAssetsSchema", {
      datasetUrl: options.datasetUrl,
      ...schemaRequestOf(options)
    });
    return assets.map(
      (asset) => withLegacyFields({
        assetId: asset.assetId,
        entities: asset.entities.map(entitySchemaOf),
        omittedEntities: asset.omittedEntities
      })
    );
  }
  /**
   * A table's columns in display order, hidden ones included.
   *
   * Takes a dataset or table `url` from the `servers` of {@link WebViewer.getState}.
   * If omitted, the table on screen.
   *
   * This API is experimental, and may change between releases.
   */
  async getTableSchema(tableUrl) {
    const { columns } = await this.#viewerControl("getTableSchema", { tableUrl });
    return columns.map(
      ({ name, displayName, datatype }) => withLegacyFields({
        name,
        displayName,
        datatype
      })
    );
  }
  /**
   * Read a blueprint.
   *
   * If `target` is omitted, reads the blueprint of what is on screen.
   * A recording or table without a blueprint gets a default one.
   *
   * This API is experimental, and may change between releases.
   */
  async getBlueprint(target) {
    target = normalizeOptions(target);
    const response = await this.#viewerControl("getBlueprint", {
      target: target === void 0 ? void 0 : blueprintTargetOf(target)
    });
    return withLegacyFields({
      blueprintId: response.blueprintId,
      blueprint: parseExactJson(response.json),
      recording: response.storeId,
      tableUrl: response.tableUrl
    });
  }
  /**
   * Replace a whole blueprint, in the form {@link WebViewer.getBlueprint} reads it.
   *
   * Anything the blueprint leaves out is cleared, so read it first, and change what you need.
   *
   * Rejects with a {@link ViewerControlError} with the code `INVALID_ARGUMENT` that says where the blueprint is wrong.
   *
   * This API is experimental, and may change between releases.
   */
  async setBlueprint(blueprint, target) {
    target = normalizeOptions(target);
    const response = await this.#viewerControl("setBlueprint", {
      json: stringifyExactJson(blueprint),
      target: blueprintTargetOf(target)
    });
    return withLegacyFields({
      blueprintId: response.blueprintId,
      recording: response.storeId,
      tableUrl: response.tableUrl
    });
  }
  /**
   * A recording's transform graph at its time cursor: its frames, and the edges between them.
   * See [Transforms & Coordinate Frames](https://rerun.io/docs/concepts/logging-and-ingestion/transforms).
   *
   * This API is experimental, and may change between releases.
   */
  async getTransformGraph(options = {}) {
    options = normalizeOptions(options);
    const response = await this.#viewerControl("getTransformGraph", {
      storeId: options.recording,
      frameFilter: options.frameFilter && FRAME_FILTERS[options.frameFilter],
      edgeFilter: options.edgeFilter && EDGE_FILTERS[options.edgeFilter],
      includeTransforms: options.includeTransforms
    });
    return {
      recording: response.storeId,
      graph: parseExactJson(response.json)
    };
  }
  /**
   * Take a screenshot of the viewer, or of one of its views, as a PNG.
   *
   * Rejects with a {@link ViewerControlError} with the code `INVALID_ARGUMENT` if `viewId` is not a UUID,
   * `NOT_FOUND` if no such view is visible, and `FAILED_PRECONDITION` if the view is too small to capture.
   *
   * This API is experimental, and may change between releases.
   */
  async takeScreenshot(options = {}) {
    options = normalizeOptions(options);
    const { png } = await this.#viewerControl("saveScreenshot", {
      viewId: options.viewId,
      maxSize: options.maxSize
    });
    if (png === void 0) {
      throw new Error("Expected the screenshot as a PNG");
    }
    return png;
  }
  /**
   * Draw a pulsing outline around a rectangle, to point the user at something.
   *
   * It pulses until the user clicks. Pass `null` to dismiss it.
   *
   * This API is experimental, and may change between releases.
   */
  async highlightRect(rect, label) {
    await this.#viewerControl("highlightRect", { rect: rect ?? void 0, label });
  }
  /**
   * The command palette commands, sorted by id, or the ones named in `ids`, in that order.
   *
   * Rejects with a {@link ViewerControlError} with the code `NOT_FOUND` if an id in `ids` is unknown.
   *
   * This API is experimental, and may change between releases.
   */
  async listCommands(options = {}) {
    options = normalizeOptions(options);
    const target = { storeId: options.recording, serverOrigin: options.serverOrigin };
    const ids = options.ids ?? (await this.#viewerControl("listCommands", {
      includeUnavailable: options.includeUnavailable,
      ...target
    })).commands.map(({ id }) => id);
    const { commands } = await this.#viewerControl("describeCommands", { ids, ...target });
    return commands.map(viewerCommandOf);
  }
  /**
   * Run a command palette command by id, and return the command.
   *
   * Resolves once the command is queued, not when it is done.
   *
   * This API is experimental, and may change between releases.
   */
  async runCommand(id, options = {}) {
    options = normalizeOptions(options);
    const { command } = await this.#viewerControl("runCommand", {
      id,
      storeId: options.recording,
      serverOrigin: options.serverOrigin,
      allowBlockingNativeModal: options.allowBlockingNativeModal
    });
    if (command === void 0) {
      throw new Error("Expected the command that ran");
    }
    return viewerCommandOf(command);
  }
  /**
   * Get the play state.
   *
   * This always returns `false` if the recording can't be found.
   *
   * @deprecated Use the recording's `playState` from {@link WebViewer.getState} instead.
   */
  "get_playing"(recordingId) {
    if (!this.#handle) {
      throw new Error(`attempted to get play state in a stopped web viewer`);
    }
    return this.#recording(recordingId)?.playState === "playing";
  }
  /**
   * Set the play state.
   *
   * This does nothing if the recording can't be found.
   *
   * @deprecated Use {@link WebViewer.setTime} with `playState` instead.
   */
  "set_playing"(recordingId, value) {
    if (!this.#handle) {
      throw new Error(
        `attempted to set play state to ${value ? "playing" : "paused"} in a stopped web viewer`
      );
    }
    const recording = this.#recording(recordingId);
    if (recording) {
      this.#logFailure(
        "setTime",
        this.setTime({ recording: recording.storeId, playState: value ? "playing" : "paused" })
      );
    }
  }
  /**
   * Get the current time.
   *
   * The interpretation of time depends on what kind of timeline it is:
   *
   * - For time timelines, this is the time in nanoseconds.
   * - For sequence timelines, this is the sequence number.
   *
   * This always returns `0` if the recording or timeline can't be found.
   * The time is a whole number.
   *
   * @deprecated Use the timeline's `currentTime` from {@link WebViewer.getState} instead.
   */
  "get_current_time"(recordingId, timeline) {
    if (!this.#handle) {
      throw new Error(`attempted to get current time in a stopped web viewer`);
    }
    return Number(this.#timeline(recordingId, timeline)?.currentTime ?? 0);
  }
  /**
   * Set the current time.
   *
   * Equivalent to clicking on the timeline in the time panel at the specified `time`.
   * The interpretation of `time` depends on what kind of timeline it is:
   *
   * - For time timelines, this is the time in nanoseconds.
   * - For sequence timelines, this is the sequence number.
   *
   * This does nothing if the recording or timeline can't be found.
   * A fractional time is rounded down.
   *
   * @deprecated Use {@link WebViewer.setTime} instead.
   */
  "set_current_time"(recordingId, timeline, time) {
    if (!this.#handle) {
      throw new Error(`attempted to set current time to ${time} in a stopped web viewer`);
    }
    const recording = this.#recording(recordingId);
    if (recording && Number.isFinite(time)) {
      const value = BigInt(Math.floor(time));
      const timeType = recording.timelines.find((t) => t.name === timeline)?.timeType;
      const at = timeType === "timestamp" ? { timestampNanos: value } : timeType === "duration" ? { durationNanos: value } : { sequence: value };
      this.#logFailure("setTime", this.setTime({ recording: recording.storeId, timeline, ...at }));
    }
  }
  /**
   * Get the active timeline.
   *
   * This always returns `null` if the recording can't be found.
   *
   * @deprecated Use the recording's `currentTime.timeline` from {@link WebViewer.getState} instead.
   */
  "get_active_timeline"(recordingId) {
    if (!this.#handle) {
      throw new Error(`attempted to get active timeline in a stopped web viewer`);
    }
    return this.#recording(recordingId)?.currentTime?.timeline ?? null;
  }
  /**
   * Set the active timeline.
   *
   * This does nothing if the recording or timeline can't be found.
   *
   * @deprecated Use {@link WebViewer.setTime} with `timeline` instead.
   */
  "set_active_timeline"(recordingId, timeline) {
    if (!this.#handle) {
      throw new Error(`attempted to set active timeline to ${timeline} in a stopped web viewer`);
    }
    const recording = this.#recording(recordingId);
    if (recording) {
      this.#logFailure("setTime", this.setTime({ recording: recording.storeId, timeline }));
    }
  }
  /**
   * Get the time range for a timeline.
   *
   * This always returns `null` if the recording or timeline can't be found.
   *
   * @deprecated Use the timeline's `timeRange` from {@link WebViewer.getState} instead.
   */
  "get_time_range"(recordingId, timeline) {
    if (!this.#handle) {
      throw new Error(`attempted to get time range in a stopped web viewer`);
    }
    const range = this.#timeline(recordingId, timeline)?.timeRange;
    return range ? { min: Number(range.start), max: Number(range.end) } : null;
  }
  /**
   * The viewer state, read right away, for the deprecated synchronous getters.
   *
   * Read at most once per task, since getters are called in bursts and a read is not cheap.
   * `null` while the viewer is busy painting a frame, when the old getters found nothing either.
   */
  #viewerState() {
    if (!this.#handle) {
      throw new Error(`attempted to get the viewer state of a stopped web viewer`);
    }
    if (this.#cachedViewerState === null) {
      try {
        this.#cachedViewerState = viewerStateOf(
          fromBinary(GetStateResponseSchema, this.#handle.viewer_state())
        );
      } catch {
        return null;
      }
      queueMicrotask(() => {
        this.#cachedViewerState = null;
      });
    }
    return this.#cachedViewerState;
  }
  /** The open recording with this recording id, if any. */
  #recording(recordingId) {
    return this.#viewerState()?.recordings.find(
      (recording) => parseStoreId(recording.storeId).recordingId === recordingId
    );
  }
  /** The timeline of the open recording with this recording id, if any. */
  #timeline(recordingId, timeline) {
    return this.#recording(recordingId)?.timelines.find((candidate) => candidate.name === timeline);
  }
  /** Run what a deprecated setter started, which has no way to report a failure, and log one instead. */
  #logFailure(method, call) {
    call.catch((err) => {
      console.warn(`WebViewer.${method} failed:`, err);
    });
  }
  /**
   * Toggle fullscreen mode.
   *
   * This does nothing if `allowFullscreen` was not set to `true` when starting the viewer.
   *
   * Fullscreen mode works by updating the underlying `<canvas>` element's `style`:
   * - `position` to `fixed`
   * - width/height/top/left to cover the entire viewport
   *
   * When fullscreen mode is toggled off, the style is restored to its previous values.
   *
   * When fullscreen mode is toggled on, any other instance of the viewer on the page
   * which is already in fullscreen mode is toggled off. This means that it doesn't
   * have to be tracked manually.
   *
   * This functionality can also be directly accessed in the viewer:
   * - The maximize/minimize top panel button
   * - The `Toggle fullscreen` UI command (accessible via the command palette, CTRL+P)
   */
  toggleFullscreen() {
    if (!this.#allowFullscreen) return;
    if (!this.#handle || !this.#canvas) {
      throw new Error(`attempted to toggle fullscreen mode in a stopped web viewer`);
    }
    if (this.#fullscreen) {
      this.#minimize();
    } else {
      this.#maximize();
    }
  }
  setCredentials(accessToken, email) {
    if (!this.#handle) {
      throw new Error(`attempted to set credentials in a stopped web viewer`);
    }
    this.#handle.set_credentials(accessToken, email);
  }
  #minimize = /* @__PURE__ */ __name(() => {
  }, "#minimize");
  #maximize = /* @__PURE__ */ __name(() => {
    minimizeCurrentFullscreenViewer?.();
    const canvas = this.#canvas;
    const rect = canvas.getBoundingClientRect();
    const syncStyleToRect = /* @__PURE__ */ __name(() => {
      canvas.style.left = rect.left + "px";
      canvas.style.top = rect.top + "px";
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
    }, "syncStyleToRect");
    const undoStyle = /* @__PURE__ */ __name(() => canvas.removeAttribute("style"), "undoStyle");
    const transition = /* @__PURE__ */ __name((callback) => setTimeout(() => requestAnimationFrame(callback), transitionDelayMs), "transition");
    canvas.classList.add(classes.fullscreenBase, classes.fullscreenRect);
    syncStyleToRect();
    requestAnimationFrame(() => {
      if (!this.#fullscreen) return;
      canvas.classList.add(classes.transition);
      transition(() => {
        if (!this.#fullscreen) return;
        undoStyle();
        document.body.classList.add(classes.hideScrollbars);
        document.documentElement.classList.add(classes.hideScrollbars);
        this.#dispatchEvent("fullscreen", true);
      });
    });
    this.#minimize = () => {
      document.body.classList.remove(classes.hideScrollbars);
      document.documentElement.classList.remove(classes.hideScrollbars);
      syncStyleToRect();
      canvas.classList.remove(classes.fullscreenRect);
      transition(() => {
        if (this.#fullscreen) return;
        undoStyle();
        canvas.classList.remove(classes.fullscreenBase, classes.transition);
      });
      minimizeCurrentFullscreenViewer = null;
      this.#fullscreen = false;
      this.#dispatchEvent("fullscreen", false);
    };
    minimizeCurrentFullscreenViewer = /* @__PURE__ */ __name(() => this.#minimize(), "minimizeCurrentFullscreenViewer");
    this.#fullscreen = true;
  }, "#maximize");
  /**
   * Perform one operation of the viewer's control protocol, defined by `viewer_control.proto`.
   *
   * A failed operation rejects with a {@link ViewerControlError}.
   */
  async #viewerControl(operation, request) {
    if (!this.#handle) {
      throw new ViewerControlError(
        "FAILED_PRECONDITION",
        "attempted to control a stopped web viewer"
      );
    }
    const kind = { case: operation, value: request };
    const requestBytes = toBinary(
      ViewerControlRequestSchema,
      create(ViewerControlRequestSchema, { kind })
    );
    let responseBytes;
    try {
      responseBytes = await this.#handle.viewer_control(requestBytes);
    } catch (err) {
      throw asViewerControlError(err);
    }
    const response = fromBinary(ViewerControlResponseSchema, responseBytes);
    if (response.kind.case !== operation) {
      throw new Error(`Expected a ${operation} response, got ${response.kind.case}`);
    }
    return response.kind.value;
  }
  /** @deprecated Since 0.43.0. Use {@link WebViewer.saveRecording} instead. */
  "save_recording"() {
    return this.saveRecording();
  }
  /** @deprecated Since 0.43.0. Use {@link WebViewer.saveBlueprint} instead. */
  "save_blueprint"() {
    return this.saveBlueprint();
  }
  /** @deprecated Since 0.43.0. Use {@link WebViewer.openChannel} instead. */
  "open_channel"(channelName = "rerun-io/web-viewer") {
    return this.openChannel(channelName);
  }
  /** @deprecated Since 0.43.0. Use {@link WebViewer.overridePanelState} instead. */
  "override_panel_state"(panel, state) {
    return this.overridePanelState(panel, state);
  }
  /** @deprecated Since 0.43.0. Use {@link WebViewer.togglePanelOverrides} instead. */
  "toggle_panel_overrides"(value) {
    return this.togglePanelOverrides(value);
  }
  /** @deprecated Since 0.43.0. Use {@link WebViewer.getState} instead. */
  "get_state"() {
    return this.getState();
  }
  /** @deprecated Since 0.43.0. Use {@link WebViewer.setTime} instead. */
  "set_time"(options) {
    return this.setTime(options);
  }
  /** @deprecated Since 0.43.0. Use {@link WebViewer.getLocation} instead. */
  "get_location"() {
    return this.getLocation();
  }
  /** @deprecated Since 0.43.0. Use {@link WebViewer.setLocation} instead. */
  "set_location"(location) {
    return this.setLocation(location);
  }
  /** @deprecated Since 0.43.0. Use {@link WebViewer.getLogs} instead. */
  "get_logs"(afterSequence) {
    return this.getLogs(afterSequence);
  }
  /** @deprecated Since 0.43.0. Use {@link WebViewer.getRecordingSchema} instead. */
  "get_recording_schema"(options = {}) {
    return this.getRecordingSchema(options);
  }
  /** @deprecated Since 0.43.0. Use {@link WebViewer.getDatasetSchema} instead. */
  "get_dataset_schema"(options = {}) {
    return this.getDatasetSchema(options);
  }
  /** @deprecated Since 0.43.0. Use {@link WebViewer.getDatasetAssetsSchema} instead. */
  "get_dataset_assets_schema"(options = {}) {
    return this.getDatasetAssetsSchema(options);
  }
  /** @deprecated Since 0.43.0. Use {@link WebViewer.getTableSchema} instead. */
  "get_table_schema"(tableUrl) {
    return this.getTableSchema(tableUrl);
  }
  /** @deprecated Since 0.43.0. Use {@link WebViewer.getBlueprint} instead. */
  "get_blueprint"(target) {
    return this.getBlueprint(target);
  }
  /** @deprecated Since 0.43.0. Use {@link WebViewer.setBlueprint} instead. */
  "set_blueprint"(blueprint, target) {
    return this.setBlueprint(blueprint, target);
  }
  /** @deprecated Since 0.43.0. Use {@link WebViewer.getTransformGraph} instead. */
  "get_transform_graph"(options = {}) {
    return this.getTransformGraph(options);
  }
  /** @deprecated Since 0.43.0. Use {@link WebViewer.takeScreenshot} instead. */
  "take_screenshot"(options = {}) {
    return this.takeScreenshot(options);
  }
  /** @deprecated Since 0.43.0. Use {@link WebViewer.highlightRect} instead. */
  "highlight_rect"(rect, label) {
    return this.highlightRect(rect, label);
  }
  /** @deprecated Since 0.43.0. Use {@link WebViewer.listCommands} instead. */
  "list_commands"(options = {}) {
    return this.listCommands(options);
  }
  /** @deprecated Since 0.43.0. Use {@link WebViewer.runCommand} instead. */
  "run_command"(id, options = {}) {
    return this.runCommand(id, options);
  }
  /** @deprecated Since 0.43.0. Use {@link WebViewer.toggleFullscreen} instead. */
  "toggle_fullscreen"() {
    return this.toggleFullscreen();
  }
  /** @deprecated Since 0.43.0. Use {@link WebViewer.setCredentials} instead. */
  "set_credentials"(accessToken, email) {
    return this.setCredentials(accessToken, email);
  }
};
var LogChannel = class {
  static {
    __name(this, "LogChannel");
  }
  #onSend;
  #onSendTable;
  #onClose;
  #getState;
  #closed = false;
  /**
   * @param onSend
   * @param onClose
   * @param getState
   */
  constructor(onSend, onSendTable, onClose, getState) {
    this.#onSend = onSend;
    this.#onSendTable = onSendTable;
    this.#onClose = onClose;
    this.#getState = getState;
  }
  get ready() {
    return !this.#closed && this.#getState() === "ready";
  }
  /**
   * Send an `rrd` containing log messages to the viewer.
   *
   * Does nothing if `!this.ready`.
   *
   * @param rrdBytes Is an rrd file stored in a byte array, received via some other side channel.
   */
  sendRrd(rrdBytes) {
    if (!this.ready) return;
    this.#onSend(rrdBytes);
  }
  sendTable(tableBytes) {
    if (!this.ready) return;
    this.#onSendTable(tableBytes);
  }
  /**
   * Close the channel.
   *
   * Does nothing if `!this.ready`.
   */
  close() {
    if (!this.ready) return;
    this.#onClose();
    this.#closed = true;
  }
  /** @deprecated Since 0.43.0. Use {@link LogChannel.sendRrd} instead. */
  "send_rrd"(rrdBytes) {
    return this.sendRrd(rrdBytes);
  }
  /** @deprecated Since 0.43.0. Use {@link LogChannel.sendTable} instead. */
  "send_table"(tableBytes) {
    return this.sendTable(tableBytes);
  }
};
var classes = {
  hideScrollbars: "rerun-viewer-hide-scrollbars",
  fullscreenBase: "rerun-viewer-fullscreen-base",
  fullscreenRect: "rerun-viewer-fullscreen-rect",
  transition: "rerun-viewer-transition"
};
var transitionDelayMs = 100;
var css = `
  html.${classes.hideScrollbars},
  body.${classes.hideScrollbars} {
    scrollbar-gutter: auto !important;
    overflow: hidden !important;
  }

  .${classes.fullscreenBase} {
    position: fixed;
    z-index: 99999;
  }

  .${classes.transition} {
    transition: all ${transitionDelayMs / 1e3}s linear;
  }

  .${classes.fullscreenRect} {
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
  }
`;
function injectStyle() {
  const ID = "__rerun_viewer_style";
  if (document.getElementById(ID)) {
    return;
  }
  const style = document.createElement("style");
  style.id = ID;
  style.appendChild(document.createTextNode(css));
  document.head.appendChild(style);
}
__name(injectStyle, "injectStyle");
function setupGlobalEventListeners() {
  window.addEventListener("keyup", (e) => {
    if (e.code === "Escape") {
      minimizeCurrentFullscreenViewer?.();
    }
  });
}
__name(setupGlobalEventListeners, "setupGlobalEventListeners");
export {
  LogChannel,
  ViewerControlError,
  WebViewer,
  parseStoreId,
  parse_store_id
};
//# sourceMappingURL=index.js.map
