var Util = require('./util');
var Store = require('./stores').Store;
var ArrayStore = require('./stores').ArrayStore;
var ObjectStore = require('./stores').ObjectStore;
var HtmlBuilder = require('./builder');

function Watch(sourceStore, propName) {
    this.sourceStore = sourceStore;
    this.propName = propName;
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
    if (watch instanceof ValueWatch) newWatch = new ValueWatch(watch.sourceStore, watch.propName);
    else if (watch instanceof ArrayWatch) newWatch = new ArrayWatch(watch.sourceStore, watch.propName);
    else if (watch instanceof Objectwatch) newWatch = new Objectwatch(watch.sourceStore, watch.propName);
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

Watch.prototype.getValue = function () {
    return this.sourceStore[this.propName];
}

Watch.prototype.update = function () { /*implement me*/ }

function ValueWatch(store, propName) {
    Watch.apply(this, [store, propName]);
}

ValueWatch.prototype = Object.create(Watch.prototype);

ValueWatch.prototype.update = function () {
    var currentVal = this.getValue();
    var oldVal = currentVal; //TODO
    var setVal = currentVal;
    if (this.changeFunc) {
        this.sourceStore.lock();
        setVal = this.changeFunc(currentVal, oldVal, this.targetElement);
        this.sourceStore.unlock();
    }
    if (this.patternFunc) {
        this.sourceStore.lock();
        setVal = this.patternFunc(setVal);
        this.sourceStore.unlock();
    }

    if (this.context === Watch.Context.TEXT) {
        this.targetElement.nodeValue = setVal;
    }
    else if (this.context === Watch.Context.ELEMENT_ATTRIBUTE) {
        if (Util.isFalsey(setVal))
            this.targetElement.removeAttribute(this.targetAttrName);
        else
            this.targetElement.setAttribute(this.targetAttrName, setVal);
    }
    else if (this.context === Watch.Context.ELEMENT_PROPERTY) {
        this.targetElement[this.targetPropName] = setVal;
    }
    else if (this.context === Watch.Context.ELEMENT_STYLE_PROPERTY) {
        this.targetElement.style[this.targetStylePropName] = setVal;
    }
}

function ArrayWatch(store, propName) {
    Watch.apply(this, [store, propName]);

    this.buildFunc = null;
}

ArrayWatch.prototype = Object.create(Watch.prototype);

ArrayWatch.prototype.setBuildFunc = function (buildFunc) {
    this.buildFunc = buildFunc;
}

ArrayWatch.prototype.update = function () {
    var currentArray = this.getValue();
    var oldArrayIds = currentArray.oldArrayIds || [];
    var setVal = currentArray;
    if (this.changeFunc) {
        this.sourceStore.lock();
        setVal = this.changeFunc(currentArray, currentArray /*TODO*/, this.targetElement);
        this.sourceStore.unlock();
    }
    if (this.patternFunc) {
        this.sourceStore.lock();
        setVal = this.patternFunc(setVal);
        this.sourceStore.unlock();
    }

    if (this.context === Watch.Context.TEXT) {
        this.targetElement.nodeValue = setVal;
    }
    else if (this.context === Watch.Context.REPEAT) {
        var parent = this.targetElement.parentNode;
        for (var i = 0; i < oldArrayIds.length; i++) {
            if (this.targetElement.nextSibling) {
                parent.removeChild(this.targetElement.nextSibling);
            }
        }

        if (setVal instanceof ArrayStore) {
            for (var i = setVal.length - 1; i >= 0; i--) {
                if (this.targetElement.nextSibling) {
                    parent.insertBefore(this.buildFunc(setVal.subStores[i], i), this.targetElement.nextSibling);
                }
                else {
                    parent.appendChild(this.buildFunc(setVal.subStores[i], i));
                }
            }
        }
    }
    else if (this.context === Watch.Context.ELEMENT_ATTRIBUTE) {
        if (Util.isFalsey(setVal))
            this.targetElement.removeAttribute(this.targetAttrName);
        else
            this.targetElement.setAttribute(this.targetAttrName, setVal);
    }
    else if (this.context === Watch.Context.ELEMENT_PROPERTY) {
        this.targetElement[this.targetPropName] = setVal;
    }
    else if (this.context === Watch.Context.ELEMENT_STYLE_PROPERTY) {
        this.targetElement.style[this.targetStylePropName] = setVal;
    }
    else if (this.context === Watch.Context.ELEMENT_CLASS_LIST) {
        if (setVal instanceof ArrayStore) {
            this.targetElement.className = "";
            HtmlBuilder.applyClasses(this.targetElement, setVal.array);
        }
    }
}

function ObjectWatch(store, propName) {
    Watch.apply(this, [store, propName]);
}

ObjectWatch.prototype = Object.create(Watch.prototype);

ObjectWatch.prototype.update = function () {
    var currentObj = this.getValue();
    var oldObj = currentObj; //TODO
    var setVal = currentObj;
    if (this.changeFunc) {
        this.sourceStore.lock();
        setVal = this.changeFunc(currentObj, oldObj, this.targetElement);
        this.sourceStore.unlock();
    }
    if (this.patternFunc) {
        this.sourceStore.lock();
        setVal = this.patternFunc(setVal);
        this.sourceStore.unlock();
    }

    if (this.context === Watch.Context.TEXT) {
        this.targetElement.nodeValue = setVal;
    }
    else if (this.context === Watch.Context.ELEMENT) {
        if (setVal instanceof Element) {
            this.targetElement.parentNode.replaceChild(setVal, this.targetElement);
            this.targetElement = setVal;
        }
        else {
            this.targetElement.parentNode.removeChild(this.targetElement);
            this.targetElement = null;
        }
    }
    else if (this.context === Watch.Context.ELEMENT_STYLE_OBJECT) {
        if (setVal instanceof ObjectStore) {
            HtmlBuilder.applyStyles(this.targetElement, setVal.obj);
        }
    }
    else if (this.context === Watch.Context.ELEMENT_ATTRIBUTE_OBJECT) {
        if (setVal instanceof ObjectStore) {
            HtmlBuilder.applyAttrs(this.targetElement, setVal.obj);
        }
    }
}

module.exports = {
    Watch: Watch,
    ValueWatch: ValueWatch,
    ArrayWatch: ArrayWatch,
    ObjectWatch: ObjectWatch
};