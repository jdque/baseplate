function Watch(propName, initialValue) {
    this.propName = propName;
    this.initialValue = initialValue;
    this.updateFunc = function (watch, setVal) {};
    this.context = null;
    this.targetElement = null;
    this.changeFunc = null;
    this.patternFunc = null;
    this.patterns = [];
}

Watch.Context = {
    TEXT: 0,
    ELEMENT: 1,
    ELEMENT_ATTRIBUTE: 2,
    ELEMENT_ATTRIBUTE_OBJECT: 3,
    ELEMENT_CLASS_LIST: 4,
    ELEMENT_PROPERTY: 5,
    ELEMENT_STYLE_OBJECT: 6,
    ELEMENT_STYLE_PROPERTY: 7,
    REPEAT: 8
}

Watch.clone = function (watch) {
    var newWatch;
    if (watch instanceof ValueWatch) newWatch = new ValueWatch(watch.propName, watch.initialValue);
    else if (watch instanceof ArrayWatch) newWatch = new ArrayWatch(watch.propName, watch.initialValue);
    else if (watch instanceof Objectwatch) newWatch = new Objectwatch(watch.propName, watch.initialValue);
    newWatch.context = watch.context;
    newWatch.targetElement = watch.targetElement;
    newWatch.changeFunc = watch.changeFunc;
    newWatch.patternFunc = watch.patternFunc;
    newWatch.patterns = watch.patterns;

    //TODO
    newWatch.buildFunc = watch.buildFunc;
    newWatch.targetAttrName = watch.targetAttrName;
    newWatch.targetPropName = watch.targetPropName;
    newWatch.targetStylePropName = watch.targetStylePropName;

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

Watch.prototype.setContext = function (context) {
    this.context = context;
}

Watch.prototype.setTargetElement = function (element) {
    this.targetElement = element;
}

Watch.prototype.setUpdater = function (func) {
    this.updateFunc = func;
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
    var oldVal = currentVal; //TODO
    var setVal = currentVal;
    if (this.changeFunc) {
        setVal = this.changeFunc(currentVal, oldVal, this.targetElement);
    }
    if (this.patternFunc) {
        setVal = this.patternFunc(setVal);
    }

    this.updateFunc(this, setVal);
}

function ArrayWatch(propName, initialValue) {
    Watch.apply(this, [propName, initialValue]);

    this.buildFunc = null;
}

ArrayWatch.prototype = Object.create(Watch.prototype);

ArrayWatch.prototype.setBuildFunc = function (buildFunc) {
    this.buildFunc = buildFunc;
}

ArrayWatch.prototype.update = function (currentArray) {
    var oldArrayIds = currentArray.oldArrayIds || [];
    var setVal = currentArray;
    if (this.changeFunc) {
        setVal = this.changeFunc(currentArray, currentArray /*TODO*/, this.targetElement);
    }
    if (this.patternFunc) {
        setVal = this.patternFunc(setVal);
    }

    this.updateFunc(this, setVal);
}

function ObjectWatch(propName, initialValue) {
    Watch.apply(this, [propName, initialValue]);
}

ObjectWatch.prototype = Object.create(Watch.prototype);

ObjectWatch.prototype.update = function (currentObj) {
    var oldObj = currentObj; //TODO
    var setVal = currentObj;
    if (this.changeFunc) {
        setVal = this.changeFunc(currentObj, oldObj, this.targetElement);
    }
    if (this.patternFunc) {
        setVal = this.patternFunc(setVal);
    }

    this.updateFunc(this, setVal);
}

module.exports = {
    Watch: Watch,
    ValueWatch: ValueWatch,
    ArrayWatch: ArrayWatch,
    ObjectWatch: ObjectWatch
};