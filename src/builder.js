var Util = require('./util');
var Store = require('./stores').Store;
var ArrayStore = require('./stores').ArrayStore;
var ObjectStore = require('./stores').ObjectStore;
var Watch = require('./watches').Watch;

var voidTags = {
    area: true, base: true, br: true, col: true,
    embed: true, hr: true, img: true, input: true,
    keygen: true, link: true, menuitem: true, meta: true,
    param: true, source: true, track: true, wbr: true
};

function HtmlBuilder(tag, props) {
    if (!this.initialized) {
        this.selfFunc = HtmlBuilder.bind(this);
        this.elemStack = [];
        this.initialized = true;
        return this.selfFunc;
    }

    //element creation is deferred to a function
    if (typeof tag === 'function') {
        tag(this.getCurrentElem(), props);
        return this.selfFunc;
    }

    //shorthand for text element
    if (tag instanceof Array) {
        tag.forEach(function (text) {
            HtmlBuilder.makeText(this.getCurrentElem(), props, text)
        }, this);
        return this.selfFunc;
    }

    //shorthand for custom elements
    if (Util.isObjectLiteral(tag)) {
        var key = Object.keys(tag)[0];
        var value = tag[key];
        if (exports.hasOwnProperty(key)) {
            var func = exports[key](value);
            func(this.getCurrentElem(), props);
        }
        return this.selfFunc;
    }

    //append pre-built element if tag argument is a reference
    if (tag instanceof Node) {
        HtmlBuilder.applyProps(tag, props);
        this.getCurrentElem().appendChild(tag);
        return this.selfFunc;
    }

    //closing tag
    if (tag.indexOf("/") === 0) {
        if (this.elemStack.length === 0) {
            throw new Error("No matching opening tag for: " + tag);
        }
        else if (this.elemStack.length === 1) {
            return this.elemStack[0];
        }
        this.elemStack.pop();
        return this.selfFunc;
    }

    //void tag
    var strippedTag = tag.replace(/\s/g, '').replace(/\//g, '');
    if (voidTags[strippedTag]) {
        var newElem = document.createElement(strippedTag);
        HtmlBuilder.applyProps(newElem, props);
        if (this.elemStack.length > 0) {
            this.getCurrentElem().appendChild(newElem);
        }
        return this.selfFunc;
    }

    //all other tags
    var newElem = document.createElement(tag.replace(/\s/g, ''));
    HtmlBuilder.applyProps(newElem, props);
    if (this.elemStack.length > 0) {
        this.getCurrentElem().appendChild(newElem);
    }
    this.elemStack.push(newElem);

    return this.selfFunc;
}

HtmlBuilder.prototype.getCurrentElem = function () {
    return this.elemStack[this.elemStack.length - 1];
}

HtmlBuilder.applyProps = function (elem, propsObj) {
    if (!propsObj)
        return;

    Object.keys(propsObj).forEach(function (name) {
        var value = propsObj[name];
        if (name === 'attributes' && typeof value === 'object') {
            HtmlBuilder.applyAttrs(elem, value);
        }
        else if (name === 'classList' && typeof value === 'object') {
            HtmlBuilder.applyClasses(elem, value);
        }
        else if (name === 'style' && typeof value === 'object') {
            HtmlBuilder.applyStyles(elem, value);
        }
        else {
            if (Watch.isPrimitiveWatch(value)) {
                value.addReactor(function (setVal) {
                    HtmlBuilder.applyElementProperty(elem, name, setVal);
                });
                value.broadcast(value.getCurrentValue());
            }
            else {
                HtmlBuilder.applyElementProperty(elem, name, value);
            }
        }
    });
}

HtmlBuilder.applyAttrs = function (elem, attrsObj) {
    //TODO allow watch on object itself
    if (Util.isObjectLiteral(attrsObj)) {
        Object.keys(attrsObj).forEach(function (name) {
            var value = attrsObj[name];
            if (Watch.isPrimitiveWatch(value)) {
                value.addReactor(function (setVal) {
                    HtmlBuilder.applyElementAttribute(elem, name, setVal);
                });
                value.broadcast(value.getCurrentValue());
            }
            else {
                HtmlBuilder.applyElementAttribute(elem, name, value);
            }
        });
    }
    else if (Watch.isDictWatch(attrsObj)) {
        attrsObj.addReactor(function (setVal) {
            HtmlBuilder.applyElementAttributeObj(elem, setVal);
        });
        attrsObj.broadcast(attrsObj.getCurrentValue());
    }
}

HtmlBuilder.applyClasses = function (elem, classArray) {
    if (Watch.isArrayWatch(classArray)) {
        classArray.addReactor(function (setVal) {
            HtmlBuilder.applyElementClassList(elem, setVal);
        });
        classArray.broadcast(classArray.getCurrentValue());
    }
    else {
        HtmlBuilder.applyElementClassList(elem, classArray);
    }
}

HtmlBuilder.applyStyles = function (elem, stylesObj) {
    //TODO allow watch on object itself
    if (Util.isObjectLiteral(stylesObj)) {
        Object.keys(stylesObj).forEach(function (name) {
            var value = stylesObj[name];
            if (Watch.isPrimitiveWatch(value)) {
                value.addReactor(function (setVal) {
                    HtmlBuilder.applyElementStyle(elem, name, setVal);
                });
                value.broadcast(value.getCurrentValue());
            }
            else {
                HtmlBuilder.applyElementStyle(elem, name, value);
            }
        });
    }
    else if (Watch.isDictWatch(stylesObj)) {
        stylesObj.addReactor(function (setVal) {
            HtmlBuilder.applyElementStyleObj(elem, setVal);
        });
        stylesObj.broadcast(stylesObj.getCurrentValue());
    }
}

HtmlBuilder.applyRepeat = function (element, dataArray, buildFunc) {
    if (dataArray instanceof ArrayStore) {
        var parent = element.parentNode;
        var oldArrayIds = dataArray.oldArrayIds || [];
        for (var i = 0; i < oldArrayIds.length; i++) {
            if (element.nextSibling) {
                parent.removeChild(element.nextSibling);
            }
        }

        for (var i = dataArray.length - 1; i >= 0; i--) {
            if (element.nextSibling) {
                parent.insertBefore(buildFunc(dataArray.subStores[i], i), element.nextSibling);
            }
            else {
                parent.appendChild(buildFunc(dataArray.subStores[i], i));
            }
        }
    }
}

HtmlBuilder.applyElement = function (element, newElement) {
    if (newElement instanceof Element) {
        element.parentNode.replaceChild(newElement, element);
        element = newElement;
    }
    else {
        element.parentNode.removeChild(element);
        element = null;
    }
}

HtmlBuilder.applyElementText = function (element, text) {
    element.nodeValue = text;
}

HtmlBuilder.applyElementProperty = function (element, propName, propVal) {
    element[propName] = propVal;
}

HtmlBuilder.applyElementAttribute = function (element, attrName, attrVal) {
    if (Util.isFalsey(attrVal)) {
        element.removeAttribute(attrName);
    }
    else {
        element.setAttribute(attrName, attrVal);
    }
}

HtmlBuilder.applyElementStyle = function (element, styleName, styleVal) {
    element.style[styleName] = styleVal;
}

HtmlBuilder.applyElementStyleObj = function (element, styleObj) {
    if (styleObj instanceof ObjectStore) {
        HtmlBuilder.applyStyles(element, styleObj.obj);
    }
}

HtmlBuilder.applyElementAttributeObj = function (element, attrObj) {
    if (attrObj instanceof ObjectStore) {
        HtmlBuilder.applyAttrs(element, attrObj.obj);
    }
}

HtmlBuilder.applyElementClassList = function (element, classArray) {
    element.className = "";
    if (classArray instanceof ArrayStore) {
        element.classList.add.apply(element.classList, classArray.array);
    }
    else {
        element.classList.add.apply(element.classList, classArray);
    }
}

HtmlBuilder.makeRepeat = function (parent, props, buildFunc) {
    var dataArray = typeof props.data === 'function' ? props.data(parent) : props.data;
    if (Watch.isArrayWatch(dataArray)) {
        var elem = parent.appendChild(document.createComment(''));

        var watch = dataArray;
        watch.addReactor(function (setVal) {
            HtmlBuilder.applyRepeat(elem, setVal, buildFunc);
        });
        watch.broadcast(watch.getCurrentValue());
    }
    else if (dataArray instanceof Array || dataArray instanceof ArrayStore) {
        for (var i = 0; i < dataArray.length; i++) {
            parent.appendChild(buildFunc(dataArray[i], i));
        }
    }
}

HtmlBuilder.makeText = function (parent, props, text) {
    var textVal = typeof text === 'function' ? text(parent) : text;
    var textNode = document.createTextNode("");
    var elem = parent.appendChild(textNode);
    if (textVal instanceof Watch) {
        var watch = textVal;
        watch.addReactor(function (setVal) {
            HtmlBuilder.applyElementText(elem, setVal);
        });
        watch.broadcast(watch.getCurrentValue());
    }
    else {
        HtmlBuilder.applyElementText(elem, textVal);
    }
}

module.exports = HtmlBuilder;