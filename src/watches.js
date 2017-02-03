function Watch(propName, initialValue) {
    this.propName = propName;
    this.initialValue = initialValue; //TODO make this "current value" instead
    this.changeFunc = null;
    this.subWatches = [];
    this.reactors = [];
}

Watch.clone = function (oldWatch) {
    var newWatch;
    if (oldWatch instanceof ValueWatch)
        newWatch = new ValueWatch(oldWatch.propName, oldWatch.initialValue);
    else if (oldWatch instanceof ArrayWatch)
        newWatch = new ArrayWatch(oldWatch.propName, oldWatch.initialValue);
    else if (oldWatch instanceof ObjectWatch)
        newWatch = new ObjectWatch(oldWatch.propName, oldWatch.initialValue);

    return newWatch;
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
    this.subWatches.push(newWatch);

    return newWatch;
}

Watch.prototype.match = function (matchMap, defaultVal) {
    var newWatch = Watch.clone(this);
    newWatch.changeFunc = function (setVal) {
        return Watch.resolveMatchValue(setVal, matchMap, defaultVal);
    };
    newWatch.initialValue = newWatch.changeFunc(this.initialValue);
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

Watch.prototype.update = function (currentVal) { /*implement me*/ }

function ValueWatch(propName, initialValue) {
    Watch.apply(this, [propName, initialValue]);
}

ValueWatch.prototype = Object.create(Watch.prototype);

ValueWatch.prototype.update = function (currentVal) {
    //var oldVal = currentVal; //TODO
    var setVal = currentVal;

    if (this.changeFunc) {
        setVal = this.changeFunc(setVal);
    }

    for (var i = 0; i < this.subWatches.length; i++) {
        this.subWatches[i].update(setVal);
    }

    this.broadcast(setVal);
}

ValueWatch.prototype.broadcast = function (setVal) {
    for (var i = 0; i < this.reactors.length; i++) {
        this.reactors[i](setVal, this);
    }
}

function ArrayWatch(propName, initialValue) {
    Watch.apply(this, [propName, initialValue]);
}

ArrayWatch.prototype = Object.create(Watch.prototype);

ArrayWatch.prototype.update = function (currentArray) {
    //var oldArrayIds = currentArray.oldArrayIds || [];
    var setVal = currentArray;

    if (this.changeFunc) {
        setVal = this.changeFunc(setVal);
    }

    for (var i = 0; i < this.subWatches.length; i++) {
        this.subWatches[i].update(setVal);
    }

    this.broadcast(setVal);
}

ArrayWatch.prototype.broadcast = function (setVal) {
    for (var i = 0; i < this.reactors.length; i++) {
        this.reactors[i](setVal, this);
    }
}

function ObjectWatch(propName, initialValue) {
    Watch.apply(this, [propName, initialValue]);
}

ObjectWatch.prototype = Object.create(Watch.prototype);

ObjectWatch.prototype.update = function (currentObj) {
    //var oldObj = currentObj; //TODO
    var setVal = currentObj;

    if (this.changeFunc) {
        setVal = this.changeFunc(setVal);
    }

    for (var i = 0; i < this.subWatches.length; i++) {
        this.subWatches[i].update(setVal);
    }

    this.broadcast(setVal);
}

ObjectWatch.prototype.broadcast = function (setVal) {
    for (var i = 0; i < this.reactors.length; i++) {
        this.reactors[i](setVal, this);
    }
}

module.exports = {
    Watch: Watch,
    ValueWatch: ValueWatch,
    ArrayWatch: ArrayWatch,
    ObjectWatch: ObjectWatch
};