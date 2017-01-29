var Store = require('./stores').Store;
var ArrayStore = require('./stores').ArrayStore;
var ObjectStore = require('./stores').ObjectStore;
var Watch = require('./watches').Watch;
var ValueWatch = require('./watches').ValueWatch;
var ArrayWatch = require('./watches').ArrayWatch;
var ObjectWatch = require('./watches').ObjectWatch;
var HtmlBuilder = require('./builder');

(function () {
    var idCounter = 1;
    Object.defineProperty(Object.prototype, "__uniqueId", {
        writable: true
    });
    Object.defineProperty(Object.prototype, "uniqueId", {
        get: function () {
            if (this.__uniqueId === undefined)
                this.__uniqueId = idCounter++;
            return this.__uniqueId;
        }
    });
}());

function Updater() {
    this.targets = [];
}

Updater.prototype.addTarget = function (element, buildFunc) {
    this.targets.push({
        buildFunc: buildFunc,
        element: element
    });
}

Updater.prototype.update = function () {
    this.targets.forEach(function (target) {
        var newElement = target.buildFunc();
        target.element.parentNode.replaceChild(newElement, target.element);
        target.element = newElement;
    })
}

window.isObserving = false;
window.stores = [];

window.updateStores = function () {
    for (var i = 0; i < stores.length; i++) {
        stores[i].updateWatches();
    }
}

function bp_html() {
    if (!isObserving) {
        isObserving = true;
        updateStores();
    }
    return new HtmlBuilder();
}

function bp_custom(arg) {
    return function (parent, attrs) {
        var argValue = typeof arg === 'function' ? arg(parent) : arg;
        if (argValue instanceof ObjectWatch) {
            var watch = argValue;
            if (watch.getInitialValue() instanceof Element) {
                var element = parent.appendChild(watch.getInitialValue());
                watch.setContext(Watch.Context.ELEMENT);
                watch.setTargetElement(element);
                watch.setUpdater(onWatchUpdate);
                watch.update(watch.getInitialValue());
            }
        }
        else if (argValue instanceof Element) {
            parent.appendChild(argValue);
        }
    };
}

function bp_defer(buildFunc) {
    return function (parent, attrs) {
        var placeholderElement = document.createComment('');
        parent.appendChild(placeholderElement);

        var doneFunc = function () {
            parent.replaceChild(buildFunc.apply(null, arguments), placeholderElement);
        };

        if (typeof attrs['until'] === 'function') {
            attrs['until'](doneFunc);
        }
    }
}

function bp_text(arg) {
    return function (parent, attrs) {
        var argValue = typeof arg === 'function' ? arg(parent) : arg;

        if (argValue instanceof Watch) {
            var watch = argValue;
            var textNode = document.createTextNode("");
            var element = parent.appendChild(textNode);
            watch.setContext(Watch.Context.TEXT);
            watch.setTargetElement(element);
            watch.setUpdater(onWatchUpdate);
            watch.update(watch.getInitialValue());
        }
        else {
            var textNode = document.createTextNode(argValue);
            parent.appendChild(textNode);
        }
    }
}

function bp_repeat(buildFunc) {
    buildFunc = typeof buildFunc === 'function' ? buildFunc : function () {};
    return function (parent, attrs) {
        var data = typeof attrs.data === 'function' ? attrs.data(parent) : attrs.data;
        if (data instanceof ArrayWatch) {
            var watch = data;
            watch.setBuildFunc(buildFunc);
            watch.setContext(Watch.Context.REPEAT);
            watch.setTargetElement(parent.appendChild(document.createComment('')));
            watch.setUpdater(onWatchUpdate);
            watch.update(watch.getInitialValue());
        }
        else if (data instanceof Array || data instanceof ArrayStore) {
            for (var i = 0; i < data.length; i++) {
                parent.appendChild(buildFunc(data[i], i));
            }
        }
    };
}

function bp_switch(stateMap) {
    return function (parent, attrs) {
        var currentElement = document.createComment('');
        parent.appendChild(currentElement);

        var to = function (key) {
            var value = stateMap[key];
            var element = typeof value === 'function' ? value(to) : value;
            parent.replaceChild(element, currentElement);
            currentElement = element;
        }

        if (attrs.hasOwnProperty('start')) {
            to(attrs['start']);
        }
    }
}

function bp_dynamic(buildFunc) {
    buildFunc = typeof buildFunc === 'function' ? buildFunc : function () {};
    return function (parent, attrs) {
        var element = buildFunc();
        parent.appendChild(element);
        if (attrs['updater'] instanceof Updater) {
            attrs['updater'].addTarget(element, buildFunc);
        }
    }
}

function bp_make_updater() {
    return new Updater();
}

function bp_make_store(obj) {
    var newStore = null;
    if (typeof obj === 'object') {
        if (obj instanceof Array) {
            newStore = new ArrayStore(obj);
            newStore.sync();
            stores.push(newStore);
        }
        else {
            newStore = new ObjectStore(obj);
            newStore.sync();
            stores.push(newStore);
        }
    }
    return newStore;
}

function bp_obs(store, propName) {
    if (store instanceof Store === false) {
        return null;
    }

    var propValue = store[propName];
    var watch = null;
    if (typeof propValue === 'object') {
        if (propValue instanceof ArrayStore) {
            watch = new ArrayWatch(propName, propValue);
        }
        else {
            watch = new ObjectWatch(propName, propValue);
        }
    }
    else {
        watch = new ValueWatch(propName, propValue);
    }

    if (watch) {
        store.addWatch(watch);
    }

    return watch;
}

function bp_match(watch, usePatterns, defaultVal) {
    var newWatch = new ValueWatch(watch.getPropName(), watch.getInitialValue()); //FIXME
    newWatch.patternFunc = function (currentVal) {
        var computedVal = undefined;
        for (var i = 0; i < watch.patterns.length; i++) {
            var pattern = watch.patterns[i];
            for (var j = 0, keys = Object.keys(pattern); j < keys.length; j++) {
                var name = keys[j];
                if (usePatterns.hasOwnProperty(name)) {
                    var matches =
                        (typeof pattern[name] === 'function' && pattern[name](currentVal) === true) ||
                        (pattern[name] === currentVal);

                    if (matches) {
                        computedVal = usePatterns[name];
                        break;
                    }
                }
            }
            if (computedVal !== undefined) break;
        }
        return computedVal !== undefined ? computedVal : defaultVal;
    }
    watch.matchers.push(newWatch);

    return newWatch;
}

function onWatchUpdate(watch, setVal) {
    if (setVal instanceof ValueStore) {
        onValueWatchUpdate(watch, setVal);
    }
    else if (setVal instanceof ArrayStore) {
        onArrayWatchUpdate(watch, setVal);
    }
    else if (setVal instanceof ObjectStore) {
        onObjectWatchUpdate(watch, setVal);
    }
}

function onValueWatchUpdate(watch, setVal) {
    if (watch.context === Watch.Context.TEXT) {
        watch.targetElement.nodeValue = setVal;
    }
}

function onArrayWatchUpdate(watch, setVal) {
    if (watch.context === Watch.Context.TEXT) {
        watch.targetElement.nodeValue = setVal;
    }
    else if (watch.context === Watch.Context.REPEAT) {
        var parent = watch.targetElement.parentNode;
        var oldArrayIds = setVal.oldArrayIds || [];
        for (var i = 0; i < oldArrayIds.length; i++) {
            if (watch.targetElement.nextSibling) {
                parent.removeChild(watch.targetElement.nextSibling);
            }
        }

        if (setVal instanceof ArrayStore) {
            for (var i = setVal.length - 1; i >= 0; i--) {
                if (watch.targetElement.nextSibling) {
                    parent.insertBefore(watch.buildFunc(setVal.subStores[i], i), watch.targetElement.nextSibling);
                }
                else {
                    parent.appendChild(watch.buildFunc(setVal.subStores[i], i));
                }
            }
        }
    }
}

function onObjectWatchUpdate(watch, setVal) {
    if (watch.context === Watch.Context.TEXT) {
        watch.targetElement.nodeValue = setVal;
    }
    else if (watch.context === Watch.Context.ELEMENT) {
        if (setVal instanceof Element) {
            watch.targetElement.parentNode.replaceChild(setVal, watch.targetElement);
            watch.targetElement = setVal;
        }
        else {
            watch.targetElement.parentNode.removeChild(watch.targetElement);
            watch.targetElement = null;
        }
    }
}

var Htmler = {
    html: bp_html,
    custom: bp_custom,
    defer: bp_defer,
    text: bp_text,
    repeat: bp_repeat,
    switch: bp_switch,
    dynamic: bp_dynamic,
    make_updater: bp_make_updater,
    make_store: bp_make_store,
    obs: bp_obs,
    match: bp_match
};

module.exports = Htmler;