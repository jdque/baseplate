var Util = require('./util');
var Watch = require('./watches').Watch;
var ValueWatch = require('./watches').ValueWatch;
var ArrayWatch = require('./watches').ArrayWatch;
var ObjectWatch = require('./watches').ObjectWatch;

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
			var textFunc = bp_text(text);
			textFunc(this.getCurrentElem(), props);
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
	if (!propsObj) return;

	for (var i = 0, keys = Object.keys(propsObj); i < keys.length; i++) {
		var name = keys[i];
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
			if (value instanceof Watch) {
				value.setContext(Watch.Context.ELEMENT_PROPERTY);
				value.setTargetElement(elem);
				value.targetPropName = name;
				value.update();
			}
			else {
				elem[name] = value;
			}
		}
	}
}

HtmlBuilder.applyAttrs = function (elem, attrsObj) {
	//TODO allow watch on object itself
	if (Util.isObjectLiteral(attrsObj)) {
		for (var i = 0, keys = Object.keys(attrsObj); i < keys.length; i++) {
			var name = keys[i];
			var value = attrsObj[name];
			if (value instanceof Watch) {
				value.setContext(Watch.Context.ELEMENT_ATTRIBUTE);
				value.setTargetElement(elem);
				value.targetAttrName = name;
				value.update();
			}
			else {
				if (Util.isFalsey(value)) {
					elem.removeAttribute(name, value);
				}
				else {
					elem.setAttribute(name, value);
				}
			}
		}
	}
	else if (attrsObj instanceof ObjectWatch) {
		attrsObj.setContext(Watch.Context.ELEMENT_ATTRIBUTE_OBJECT);
		attrsObj.setTargetElement(elem);
		attrsObj.update();
	}
}

HtmlBuilder.applyClasses = function (elem, classArray) {
	if (classArray instanceof ArrayWatch) {
		classArray.setContext(Watch.Context.ELEMENT_CLASS_LIST);
		classArray.setTargetElement(elem);
		classArray.update();
	}
	else {
		elem.classList.add.apply(elem.classList, classArray);
	}
}

HtmlBuilder.applyStyles = function (elem, stylesObj) {
	//TODO allow watch on object itself
	if (Util.isObjectLiteral(stylesObj)) {
		for (var i = 0, keys = Object.keys(stylesObj); i < keys.length; i++) {
			var name = keys[i];  //format can be either "foo-bar" or "fooBar"
			var value = stylesObj[name];
			if (value instanceof ValueWatch) {
				value.setContext(Watch.Context.ELEMENT_STYLE_PROPERTY);
				value.setTargetElement(elem);
				value.targetStylePropName = name;
				value.update();
			}
			else {
				elem.style[name] = value;
			}
		}
	}
	else if (stylesObj instanceof ObjectWatch) {
		stylesObj.setContext(Watch.Context.ELEMENT_STYLE_OBJECT);
		stylesObj.setTargetElement(elem);
		stylesObj.update();
	}
}

module.exports = HtmlBuilder;