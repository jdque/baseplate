var Util = {};

Util.isObjectLiteral = function (obj) {
    return obj != null && typeof obj === 'object' && obj.constructor.name === 'Object';
}

Util.isFalsey = function (val) {
    return val == null || val === false;
}

module.exports = Util;