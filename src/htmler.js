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
    return function (parent, props) {
        var argValue = typeof arg === 'function' ? arg(parent) : arg;
        if (argValue instanceof ObjectWatch) {
            var watch = argValue;
            if (watch.getInitialValue() instanceof Element) {
                var element = parent.appendChild(watch.getInitialValue());
                watch.addReactor(function (setVal) {
                    HtmlBuilder.applyElement(element, setVal);
                });
                watch.broadcast(watch.getInitialValue());
            }
        }
        else if (argValue instanceof Element) {
            parent.appendChild(argValue);
        }
    };
}

function bp_defer(buildFunc) {
    return function (parent, props) {
        var placeholderElement = document.createComment('');
        parent.appendChild(placeholderElement);

        var doneFunc = function () {
            parent.replaceChild(buildFunc.apply(null, arguments), placeholderElement);
        };

        if (typeof props['until'] === 'function') {
            props['until'](doneFunc);
        }
    }
}

function bp_text(text) {
    return function (parent, props) {
        HtmlBuilder.makeText(parent, props, text);
    }
}

function bp_repeat(buildFunc) {
    return function (parent, props) {
        HtmlBuilder.makeRepeat(parent, props, buildFunc);
    };
}

function bp_switch(stateMap) {
    return function (parent, props) {
        var currentElement = document.createComment('');
        parent.appendChild(currentElement);

        var to = function (key) {
            var value = stateMap[key];
            var element = typeof value === 'function' ? value(to) : value;
            parent.replaceChild(element, currentElement);
            currentElement = element;
        }

        if (props.hasOwnProperty('start')) {
            to(props['start']);
        }
    }
}

function bp_dynamic(buildFunc) {
    buildFunc = typeof buildFunc === 'function' ? buildFunc : function () {};
    return function (parent, props) {
        var element = buildFunc();
        parent.appendChild(element);
        if (props['updater'] instanceof Updater) {
            props['updater'].addTarget(element, buildFunc);
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
    obs: bp_obs
};

module.exports = Htmler;