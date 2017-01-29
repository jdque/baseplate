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
        this.subStores[idx] = new ObjectStore(this.array[idx]);
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
                else if (val instanceof ObjectStore) {
                    this.subStores[idx] = val;
                    this.array[idx] = val.obj;
                }
                else if (val instanceof Array) {
                    //this.subStores[idx] = new ArrayStore(val, this.subStores[idx].watches);
                    this.subStores[idx].replaceArray(val);
                    this.array[idx] = val;
                }
                else if (Util.isObjectLiteral(val)) {
                    //this.subStores[idx] = new ObjectStore(val, this.subStores[idx].watches);
                    this.subStores[idx].replaceObj(val);
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
                if (arguments[i] instanceof ObjectStore) {
                    arguments[i] = arguments[i].obj;
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

function ObjectStore(obj, watches) {
    Store.apply(this, [watches]);
    this.obj = obj;
    this.oldObjIds = null;
    this.updateProps();
}

ObjectStore.prototype = Object.create(Store.prototype);

ObjectStore.prototype.replaceObj = function (obj) {
    this.obj = obj;
    this.updateProps();
}

ObjectStore.prototype.updateProps = function () {
    this.subStores = {};
    for (key in this.obj) {
        this.bindProp(key);
    }
}

ObjectStore.prototype.bindProp = function (key) {
    if (this.obj[key] instanceof Array) {
        this.subStores[key] = new ArrayStore(this.obj[key]);
    }
    else if (Util.isObjectLiteral(this.obj[key])) {
        this.subStores[key] = new ObjectStore(this.obj[key]);
    }

    if (!this.hasOwnProperty(key)) {
        Object.defineProperty(this, key, {
            set: function (val) {
                if (this.isLocked()) {
                    throw new Error("Tried to modify locked store");
                }
                if (!this.obj.hasOwnProperty(key)) {
                    throw new Error("Tried to set undefined property");
                }

                if (val instanceof ArrayStore) {
                    this.subStores[key] = val;
                    this.obj[key] = val.array;
                }
                else if (val instanceof ObjectStore) {
                    this.subStores[key] = val;
                    this.obj[key] = val.obj;
                }
                else if (val instanceof Array) {
                    //this.subStores[key] = new ArrayStore(val, this.subStores[key].watches);
                    this.subStores[key].replaceArray(val);
                    this.obj[key] = val;
                }
                else if (Util.isObjectLiteral(val)) {
                    //this.subStores[key] = new ObjectStore(val, this.subStores[key].watches);
                    this.subStores[key].replaceObj(val);
                    this.obj[key] = val;
                }
                else {
                    this.obj[key] = val;
                }

                window.updateStores();
            },
            get: function () {
                return this.subStores[key] || this.obj[key];
            }
        });
    }
}

ObjectStore.prototype.didChange = function () {
    if (this.oldObjIds === null) return true;

    for (var i = 0, keys = Object.keys(this.obj); i < keys.length; i++) {
        var key = keys[i];
        if (this[key] instanceof Store && this[key].didChange()) return true;
        if (this.obj[key] == null) {
            if (!(this.oldObjIds[key] == null && this.obj[key] == null)) return true;
        }
        else {
            if (this.oldObjIds[key] !== this.obj[key].uniqueId) return true;
        }
    }
    return false;
}

ObjectStore.prototype.sync = function () {
    this.oldObjIds = {};
    for (var i = 0, keys = Object.keys(this.obj); i < keys.length; i++) {
        var key = keys[i];
        this.oldObjIds[key] = this.obj[key] != null ? this.obj[key].uniqueId : null;
    }
}

module.exports = {
    Store: Store,
    ArrayStore: ArrayStore,
    ObjectStore: ObjectStore
};