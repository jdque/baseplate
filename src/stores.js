var Util = require('./util');

function Store(watches) {
    this.locked = false;
    this.subStores = {};
    this.watches = watches || [];
}

Store.prototype.lock = function () {
    this.locked = true;
}

Store.prototype.unlock = function () {
    this.locked = false;
}

Store.prototype.isLocked = function () {
    return this.locked;
}

Store.prototype.didChange = function () { /*implement me*/ }

Store.prototype.sync = function () { /*implement me*/ }

Store.prototype.addWatch = function (watch) {
    var existingWatchIdx = -1;
    //TODO prevent adding duplicate watches by removing watches bound to an element that is removed
    /*for (var i = 0; i < this.watches.length; i++) {
        if (this.watches[i].propName === propName) {
            existingWatchIdx = i;
            break;
        }
    }*/

    if (existingWatchIdx >= 0) {
        this.watches[existingWatchIdx] = watch;
    }
    else {
        this.watches.push(watch);
    }
}

Store.prototype.updateWatches = function (force) {
    this.lock();

    if (this.didChange() || force) {
        for (var i = 0; i < this.watches.length; i++) {
            var withValue = this[this.watches[i].getPropName()];
            this.watches[i].update(withValue);
        }
        this.sync();
    }

    for (var key in this.subStores) {
        this.subStores[key].updateWatches(force);
    }

    this.unlock();
}

function ArrayStore(array, watches) {
    Store.apply(this, [watches]);
    this.array = array;
    this.oldArrayIds = null;
    this.overrideArrayMethods();
    this.updateItems();
}

ArrayStore.prototype = Object.create(Store.prototype);

ArrayStore.prototype.replaceArray = function (array) {
    this.array = array;
    this.updateItems();
}

ArrayStore.prototype.updateItems = function () {
    this.subStores = {};
    for (var i = 0; i < this.array.length; i++) {
        this.bindItem(i);
    }
}

ArrayStore.prototype.bindItem = function (idx) {
    if (this.array[idx] instanceof Array) {
        this.subStores[idx] = new ArrayStore(this.array[idx]);
    }
    else if (Util.isObjectLiteral(this.array[idx])) {
        this.subStores[idx] = new DictStore(this.array[idx]);
    }

    if (!this.hasOwnProperty(idx)) {
        Object.defineProperty(this, idx, {
            set: function (val) {
                if (this.isLocked()) {
                    throw new Error("Tried to modify locked store");
                }
                if (!this.array.hasOwnProperty(idx)) {
                    throw new Error("Tried to set undefined property");
                }

                if (val instanceof ArrayStore) {
                    this.subStores[idx] = val;
                    this.array[idx] = val.array;
                }
                else if (val instanceof DictStore) {
                    this.subStores[idx] = val;
                    this.array[idx] = val.dict;
                }
                else if (val instanceof Array) {
                    //this.subStores[idx] = new ArrayStore(val, this.subStores[idx].watches);
                    this.subStores[idx].replaceArray(val);
                    this.array[idx] = val;
                }
                else if (Util.isObjectLiteral(val)) {
                    //this.subStores[idx] = new DictStore(val, this.subStores[idx].watches);
                    this.subStores[idx].replaceDict(val);
                    this.array[idx] = val;
                }
                else {
                    this.array[idx] = val;
                }

                window.updateStores();
            },
            get: function () {
                return this.subStores[idx] || this.array[idx];
            }
        });
    }
}

ArrayStore.prototype.overrideArrayMethods = function () {
    var self = this;

    var mutators = ['copyWithin', 'fill', 'pop', 'push', 'reverse', 'shift', 'sort',
                    'splice', 'unshift'];
    mutators.forEach(function (func) {
        self[func] = function () {
            Array.prototype[func].apply(self.array, arguments);
            self.updateItems();
            window.updateStores();
        };
    });

    var iterators = ['forEach', 'entries', 'every', 'some', 'filter', 'findIndex',
                     'keys', 'map', 'reduce', 'reduceRight', 'values'];
    iterators.forEach(function (func) {
        self[func] = function () {
            var result = Array.prototype[func].apply(self.array, arguments);
            window.updateStores();
            return result;
        };
    });

    var accessors = ['concat', 'includes', 'join', 'slice', 'toSource', 'toString',
                     'toLocaleString', 'indexOf', 'lastIndexOf'];
    accessors.forEach(function (func) {
        self[func] = function () {
            for (var i = 0; i < arguments.length; i++) {
                if (arguments[i] instanceof DictStore) {
                    arguments[i] = arguments[i].dict;
                }
                else if (arguments[i] instanceof ArrayStore) {
                    arguments[i] = arguments[i].array;
                }
            }
            return Array.prototype[func].apply(self.array, arguments);
        };
    });

    Object.defineProperty(this, 'length', {
        get: function () { return this.array.length; }
    });
}

ArrayStore.prototype.didChange = function () {
    if (this.oldArrayIds === null) return true;

    if (this.oldArrayIds.length !== this.array.length) return true;

    for (var i = 0; i < this.array.length; i++) {
        if (this.array[i] == null) {
            if (!(this.oldArrayIds[i] == null && this.array[i] == null)) return true;
        }
        else {
            if (this.oldArrayIds[i] !== this.array[i].uniqueId) return true;
        }
    }

    return false;
}

ArrayStore.prototype.sync = function () {
    this.oldArrayIds = this.array.map(function (item) { return item != null ? item.uniqueId : null; });
}

function DictStore(dict, watches) {
    Store.apply(this, [watches]);
    this.dict = dict;
    this.oldDictIds = null;
    this.updateProps();
}

DictStore.prototype = Object.create(Store.prototype);

DictStore.prototype.replaceDict = function (dict) {
    this.dict = dict;
    this.updateProps();
}

DictStore.prototype.updateProps = function () {
    this.subStores = {};
    for (key in this.dict) {
        this.bindProp(key);
    }
}

DictStore.prototype.bindProp = function (key) {
    if (this.dict[key] instanceof Array) {
        this.subStores[key] = new ArrayStore(this.dict[key]);
    }
    else if (Util.isObjectLiteral(this.dict[key])) {
        this.subStores[key] = new DictStore(this.dict[key]);
    }

    if (!this.hasOwnProperty(key)) {
        Object.defineProperty(this, key, {
            set: function (val) {
                if (this.isLocked()) {
                    throw new Error("Tried to modify locked store");
                }
                if (!this.dict.hasOwnProperty(key)) {
                    throw new Error("Tried to set undefined property");
                }

                if (val instanceof ArrayStore) {
                    this.subStores[key] = val;
                    this.dict[key] = val.array;
                }
                else if (val instanceof DictStore) {
                    this.subStores[key] = val;
                    this.dict[key] = val.dict;
                }
                else if (val instanceof Array) {
                    //this.subStores[key] = new ArrayStore(val, this.subStores[key].watches);
                    this.subStores[key].replaceArray(val);
                    this.dict[key] = val;
                }
                else if (Util.isObjectLiteral(val)) {
                    //this.subStores[key] = new DictStore(val, this.subStores[key].watches);
                    this.subStores[key].replaceDict(val);
                    this.dict[key] = val;
                }
                else {
                    this.dict[key] = val;
                }

                window.updateStores();
            },
            get: function () {
                return this.subStores[key] || this.dict[key];
            }
        });
    }
}

DictStore.prototype.didChange = function () {
    if (this.oldDictIds === null) return true;

    for (var i = 0, keys = Object.keys(this.dict); i < keys.length; i++) {
        var key = keys[i];
        if (this[key] instanceof Store && this[key].didChange()) return true;
        if (this.dict[key] == null) {
            if (!(this.oldDictIds[key] == null && this.dict[key] == null)) return true;
        }
        else {
            if (this.oldDictIds[key] !== this.dict[key].uniqueId) return true;
        }
    }
    return false;
}

DictStore.prototype.sync = function () {
    this.oldDictIds = {};
    for (var i = 0, keys = Object.keys(this.dict); i < keys.length; i++) {
        var key = keys[i];
        this.oldDictIds[key] = this.dict[key] != null ? this.dict[key].uniqueId : null;
    }
}

module.exports = {
    Store: Store,
    ArrayStore: ArrayStore,
    DictStore: DictStore
};