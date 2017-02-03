var ArrayStore = require('./stores').ArrayStore;
var ObjectStore = require('./stores').ObjectStore;

function Watch(propName, initialValue) {
    this.propName = propName;
    this.initialValue = initialValue; //TODO make this "current value" instead
    this.valueType = Watch.valueTypeOf(initialValue);
    this.changeFunc = null;
    this.subWatches = [];
    this.reactors = [];
}

Watch.ValueType = {
    PRIMITIVE: 0,
    ARRAY: 1,
    DICTIONARY: 2,
    OBJECT: 3
}

Watch.isWatch = function (any) {
    return any instanceof Watch;
}

Watch.isPrimitiveWatch = function (any) {
    return Watch.isWatch(any) && any.getValueType() === Watch.ValueType.PRIMITIVE;
}

Watch.isArrayWatch = function (any) {
    return Watch.isWatch(any) && any.getValueType() === Watch.ValueType.ARRAY;
}

Watch.isDictWatch = function (any) {
    return Watch.isWatch(any) && any.getValueType() === Watch.ValueType.DICTIONARY;
}

Watch.isObjectWatch = function (any) {
    return Watch.isWatch(any) && any.getValueType() === Watch.ValueType.OBJECT;
}

Watch.clone = function (oldWatch) {
    return new Watch(oldWatch.propName, oldWatch.initialValue);
}

Watch.valueTypeOf = function (value) {
    var type = null;

    if (typeof value === 'object') {
        if (value instanceof ArrayStore) {
            type = Watch.ValueType.ARRAY;
        }
        else if (value instanceof ObjectStore) {
            type = Watch.ValueType.DICTIONARY;
        }
        else {
            type = Watch.ValueType.OBJECT;
        }
    }
    else {
        type = Watch.ValueType.PRIMITIVE;
    }

    return type;
}

Watch.resolvePatternValue = function (setVal, patternSets) {
    for (var i = 0; i < patternSets.length; i++) {
        var patternSet = patternSets[i];
        for (var j = 0, keys = Object.keys(patternSet); j < keys.length; j++) {
            var name = keys[j];
            var value = patternSet[name];
            var doesMatch =
                (typeof value === 'function' && value(setVal) === true) ||
                (value === setVal);

            if (doesMatch) {
                return name;
            }
        }
    }

    return undefined;
}

Watch.resolveMatchValue = function (setVal, matchMap, defaultVal) {
    return matchMap.hasOwnProperty(setVal) ? matchMap[setVal] : defaultVal;
}

Watch.prototype.transform = function (func) {
    var newWatch = Watch.clone(this);
    newWatch.changeFunc = typeof func === 'function' ? func : null;
    newWatch.initialValue = newWatch.changeFunc(this.initialValue);
    newWatch.valueType = Watch.valueTypeOf(newWatch.initialValue);
    this.subWatches.push(newWatch);

    return newWatch;
}

Watch.prototype.pattern = function (/*pattern sets*/) {
    var patternSets = Array.prototype.slice.call(arguments);
    var newWatch = Watch.clone(this);
    newWatch.changeFunc = function (setVal) {
        return Watch.resolvePatternValue(setVal, patternSets);
    };
    newWatch.initialValue = newWatch.changeFunc(this.initialValue);
    newWatch.valueType = Watch.valueTypeOf(newWatch.initialValue);
    this.subWatches.push(newWatch);

    return newWatch;
}

Watch.prototype.match = function (matchMap, defaultVal) {
    var newWatch = Watch.clone(this);
    newWatch.changeFunc = function (setVal) {
        return Watch.resolveMatchValue(setVal, matchMap, defaultVal);
    };
    newWatch.initialValue = newWatch.changeFunc(this.initialValue);
    newWatch.valueType = Watch.valueTypeOf(newWatch.initialValue);
    this.subWatches.push(newWatch);

    return newWatch;
}

Watch.prototype.addReactor = function (func) {
    this.reactors.push(func);
}

Watch.prototype.getPropName = function () {
    return this.propName;
}

Watch.prototype.getInitialValue = function () {
    return this.initialValue;
}

Watch.prototype.getValueType = function () {
    return this.valueType;
}

Watch.prototype.update = function (setVal) {
    //var oldVal = setVal; //TODO

    if (this.changeFunc) {
        setVal = this.changeFunc(setVal);
    }

    for (var i = 0; i < this.subWatches.length; i++) {
        this.subWatches[i].update(setVal);
    }

    this.broadcast(setVal);
}

Watch.prototype.broadcast = function (setVal) {
    for (var i = 0; i < this.reactors.length; i++) {
        this.reactors[i](setVal, this);
    }
}

module.exports = {
    Watch: Watch
};