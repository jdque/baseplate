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

var isObserving = false;
var stores = [];

function updateStores() {
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
            if (watch.getValue() instanceof Element) {
                var element = parent.appendChild(watch.getValue());
                watch.setContext(Watch.Context.ELEMENT);
                watch.setTargetElement(element);
                watch.update();
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
            var text = watch.getValue();
            var textNode = document.createTextNode(text);
            var element = parent.appendChild(textNode);
            watch.setContext(Watch.Context.TEXT);
            watch.setTargetElement(element);
            watch.update();
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
            watch.update();
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

function bp_obs(store, prop) {
    if (store instanceof Store) {
        return store.obs(prop);
    }
}

function bp_match(watch, usePatterns, defaultVal) {
    var newWatch = Watch.clone(watch);
    newWatch.sourceStore.watches.push(newWatch);
    newWatch.patternFunc = function (currentVal) {
        var computedVal = undefined;
        for (var i = 0; i < newWatch.patterns.length; i++) {
            var pattern = newWatch.patterns[i];
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

    return newWatch;
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