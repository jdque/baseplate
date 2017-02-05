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

Store.prototype.getValue = function () { /*implement me*/ }

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
            //var withValue = this[this.watches[i].getPropName()];
            var withValue = this;
            this.watches[i].update(withValue);
        }
        this.sync();
    }

    for (var key in this.subStores) {
        this.subStores[key].updateWatches(force);
    }

    this.unlock();
}

function PrimitiveStore(value, watches) {
    Store.apply(this, [watches]);
    this.value = value;
    this.oldValue = null;
}

PrimitiveStore.prototype = Object.create(Store.prototype);

PrimitiveStore.prototype.replaceValue = function (value) {
    if (value instanceof Store) {
        this.value = value.getValue();
    }
    else {
        this.value = value;
    }
}

PrimitiveStore.prototype.getValue = function () {
    return this.value;
}

PrimitiveStore.prototype.didChange = function () {
    return this.oldValue === null || this.value !== this.oldValue;
}

PrimitiveStore.prototype.sync = function () {
    this.oldValue = this.value;
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
    this.array = [];
    for (var i = 0; i < array.length; i++) {
        if (array[i] instanceof Store) {
            this.array.push(array[i].getValue());
        }
        else {
            this.array.push(array[i]);
        }
    }
    this.updateItems();
}

ArrayStore.prototype.updateItems = function () {
    var newSubStores = {};
    for (var idx = 0; idx < this.array.length; idx++) {
        var oldWatches = this.subStores[idx] ? this.subStores[idx].watches : [];
        if (this.array[idx] instanceof Array) {
            newSubStores[idx] = new ArrayStore(this.array[idx], oldWatches);
        }
        else if (Util.isObjectLiteral(this.array[idx])) {
            newSubStores[idx] = new DictStore(this.array[idx], oldWatches);
        }
        else {
            newSubStores[idx] = new PrimitiveStore(this.array[idx], oldWatches);
        }
        this.bindItem(idx);
    }

    this.subStores = newSubStores;
}

ArrayStore.prototype.bindItem = function (idx) {
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
                else if (val instanceof PrimitiveStore) {
                    this.subStores[idx] = val;
                    this.array[idx] = val.value;
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
                    this.subStores[idx].replaceValue(val);
                    this.array[idx] = val;
                }

                this.updateWatches();
            },
            get: function () {
                if (this.subStores[idx] instanceof PrimitiveStore) {
                    return this.subStores[idx].value;
                }
                else {
                    return this.subStores[idx];
                }
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
            self.updateWatches();
        };
    });

    var iterators = ['forEach', 'entries', 'every', 'some', 'filter', 'findIndex',
                     'keys', 'map', 'reduce', 'reduceRight', 'values'];
    iterators.forEach(function (func) {
        self[func] = function () {
            var result = Array.prototype[func].apply(self, arguments);
            self.updateWatches(true); //FIXME make it so forced update isn't necessary
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
                else if (arguments[i] instanceof PrimitiveStore) {
                    arguments[i] = arguments[i].value;
                }
            }
            return Array.prototype[func].apply(self.array, arguments);
        };
    });

    Object.defineProperty(this, 'length', {
        get: function () { return this.array.length; }
    });
}

ArrayStore.prototype.getValue = function () {
    return this.array;
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
    this.dict = {};
    for (var key in dict) {
        if (dict[key] instanceof Store) {
            this.dict[key] = dict[key].getValue();
        }
        else {
            this.dict[key] = dict[key];
        }
    }
    this.updateProps();
}

DictStore.prototype.updateProps = function () {
    var newSubStores = {};
    for (var key in this.dict) {
        var oldWatches = this.subStores[key] ? this.subStores[key].watches : [];

        if (this.dict[key] instanceof Array) {
            newSubStores[key] = new ArrayStore(this.dict[key], oldWatches);
        }
        else if (Util.isObjectLiteral(this.dict[key])) {
            newSubStores[key] = new DictStore(this.dict[key], oldWatches);
        }
        else {
            newSubStores[key] = new PrimitiveStore(this.dict[key], oldWatches);
        }
        this.bindProp(key);
    }

    this.subStores = newSubStores;
}

DictStore.prototype.bindProp = function (key) {
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
                else if (val instanceof PrimitiveStore) {
                    this.subStores[key] = val;
                    this.dict[key] = val.value;
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
                    this.subStores[key].replaceValue(val);
                    this.dict[key] = val;
                }

                this.updateWatches();
            },
            get: function () {
                if (this.subStores[key] instanceof PrimitiveStore) {
                    return this.subStores[key].value;
                }
                else {
                    return this.subStores[key];
                }
            }
        });
    }
}

DictStore.prototype.getValue = function () {
    return this.dict;
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
    PrimitiveStore: PrimitiveStore,
    ArrayStore: ArrayStore,
    DictStore: DictStore
};