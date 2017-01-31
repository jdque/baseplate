function Watch(propName, initialValue) {
    this.propName = propName;
    this.initialValue = initialValue; //TODO make this "current value" instead
    this.reactors = [];
    this.changeFunc = null;

    this.patternFunc = null;
    this.patterns = null;
    this.matchers = [];
}

Watch.clone = function (watch) {
    var newWatch;
    if (watch instanceof ValueWatch) newWatch = new ValueWatch(watch.propName, watch.initialValue);
    else if (watch instanceof ArrayWatch) newWatch = new ArrayWatch(watch.propName, watch.initialValue);
    else if (watch instanceof Objectwatch) newWatch = new Objectwatch(watch.propName, watch.initialValue);
    newWatch.changeFunc = watch.changeFunc;
    newWatch.patternFunc = watch.patternFunc;
    newWatch.patterns = watch.patterns;

    return newWatch;
}

Watch.prototype.transform = function (changeFunc) {
    this.changeFunc = typeof changeFunc === 'function' ? changeFunc : null;
    return this;
}

Watch.prototype.pattern = function () {
    this.patterns = arguments;
    return this;
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

Watch.prototype.resolveType = function (setVal) {
    var resolvedVal = null;

    if (setVal instanceof ArrayStore) {
        resolvedVal = setVal.array;
    }
    else if (setVal instanceof ObjectStore) {
        onObjectWatchUpdate(watch, setVal);
    }
    else {
        onValueWatchUpdate(watch, setVal);
    }
}

Watch.prototype.update = function (currentVal) { /*implement me*/ }

function ValueWatch(propName, initialValue) {
    Watch.apply(this, [propName, initialValue]);
}

ValueWatch.prototype = Object.create(Watch.prototype);

ValueWatch.prototype.update = function (currentVal) {
    var oldVal = currentVal; //TODO
    var setVal = currentVal;
    if (this.changeFunc) {
        setVal = this.changeFunc(currentVal, oldVal);
    }
    if (this.patterns) {
        for (var i = 0; i < this.matchers.length; i++) {
            var matcherVal = this.matchers[i].patternFunc(setVal);
            this.matchers[i].update(matcherVal);
        }
    }

    for (var i = 0; i < this.reactors.length; i++) {
        this.reactors[i](setVal, this);
    }
}

function ArrayWatch(propName, initialValue) {
    Watch.apply(this, [propName, initialValue]);
}

ArrayWatch.prototype = Object.create(Watch.prototype);

ArrayWatch.prototype.update = function (currentArray) {
    var oldArrayIds = currentArray.oldArrayIds || [];
    var setVal = currentArray;
    if (this.changeFunc) {
        setVal = this.changeFunc(currentArray, currentArray);
    }
    if (this.patterns) {
        for (var i = 0; i < this.matchers.length; i++) {
            var matcherVal = this.matchers[i].patternFunc(setVal);
            this.matchers[i].update(matcherVal);
        }
    }

    for (var i = 0; i < this.reactors.length; i++) {
        this.reactors[i](setVal, this);
    }
}

function ObjectWatch(propName, initialValue) {
    Watch.apply(this, [propName, initialValue]);
}

ObjectWatch.prototype = Object.create(Watch.prototype);

ObjectWatch.prototype.update = function (currentObj) {
    var oldObj = currentObj; //TODO
    var setVal = currentObj;
    if (this.changeFunc) {
        setVal = this.changeFunc(currentObj, oldObj);
    }
    if (this.patterns) {
        for (var i = 0; i < this.matchers.length; i++) {
            var matcherVal = this.matchers[i].patternFunc(setVal);
            this.matchers[i].update(matcherVal);
        }
    }

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