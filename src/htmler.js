var Util = require('./util');
var Store = require('./stores').Store;
var PrimitiveStore = require('./stores').PrimitiveStore;
var ArrayStore = require('./stores').ArrayStore;
var DictStore = require('./stores').DictStore;
var Watch = require('./watches').Watch;
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

function StateMachine(stateMap) {
    this.stateMap = stateMap;
    this.currentState = null;
    this.onBeforeEnterSubs = {};
    this.onAfterEnterSubs = {};

    for (var key in stateMap) {
        this.onBeforeEnterSubs[key] = [];
        this.onAfterEnterSubs[key] = [];
    }
}

StateMachine.prototype.to = function (state) {
    if (!this.stateMap[state])
        return;

    this.currentState = state;
    this.onBeforeEnterSubs[state].forEach(function (func) { func(); });
    this.stateMap[state]();
    this.onAfterEnterSubs[state].forEach(function (func) { func(); });
}

StateMachine.prototype.onBefore = function (state, func) {
    if (!this.stateMap[state])
        return;

    this.onBeforeEnterSubs[state].push(func);
}

StateMachine.prototype.onAfter = function (state, func) {
    if (!this.stateMap[state])
        return;

    this.onAfterEnterSubs[state].push(func);
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
        if (Watch.isObjectWatch(argValue)) {
            var watch = argValue;
            var watchValue = watch.getCurrentValue();
            if (watchValue instanceof Element) {
                var element = parent.appendChild(watchValue);
                watch.addReactor(function (setVal) {
                    HtmlBuilder.applyElement(element, setVal);
                });
                watch.broadcast(watchValue);
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

function bp_switch(buildFuncMap) {
    return function (parent, props) {
        var currentElement = document.createComment('');
        parent.appendChild(currentElement);

        var machine = props['machine']
        if (machine instanceof StateMachine) {
            Object.keys(buildFuncMap).forEach(function (state) {
                machine.onAfter(state, function () {
                    var value = buildFuncMap[state];
                    var element = typeof value === 'function' ? value() : value;
                    parent.replaceChild(element, currentElement);
                    currentElement = element;
                });
            });
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

function bp_make_statemachine(stateMap) {
    return new StateMachine(stateMap);
}

function bp_make_store(target) {
    var store = null;
    if (typeof target === 'object') {
        if (Array.isArray(target)) {
            store = new ArrayStore(target);
            store.sync();
            stores.push(store);
        }
        else if (Util.isObjectLiteral(target)) {
            store = new DictStore(target);
            store.sync();
            stores.push(store);
        }
    }
    return store;
}

function bp_obs(store, propName) {
    if (store instanceof Store === false) {
        return null;
    }

    var initialValue = store[propName];
    var watch = new Watch(propName, initialValue);
    var subStore = store.subStores[propName];
    subStore.addWatch(watch);

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
    make_statemachine: bp_make_statemachine,
    make_store: bp_make_store,
    obs: bp_obs
};

module.exports = Htmler;