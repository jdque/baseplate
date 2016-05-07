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

var Htmler = (function () {
	var voidTags = {
		area: true, base: true, br: true, col: true,
		embed: true, hr: true, img: true, input: true,
		keygen: true, link: true, menuitem: true, meta: true,
		param: true, source: true, track: true, wbr: true
	};

	function Htmler(tag, props) {
		if (!this.initialized) {
			this.selfFunc = Htmler.bind(this);
			this.elemStack = [];
			this.initialized = true;
			return this.selfFunc;
		}

		//element creation is deferred to a function
		if (typeof tag === 'function') {
			tag(this.getCurrentElem(), props);
			return this.selfFunc;
		}

		//append pre-built element if tag argument is a reference
		if (tag instanceof Node) {
			Htmler.applyProps(tag, props);
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
			Htmler.applyProps(newElem, props);
			if (this.elemStack.length > 0) {
				this.getCurrentElem().appendChild(newElem);
			}
			return this.selfFunc;
		}

		//all other tags
		var newElem = document.createElement(tag.replace(/\s/g, ''));
		Htmler.applyProps(newElem, props);
		if (this.elemStack.length > 0) {
			this.getCurrentElem().appendChild(newElem);
		}
		this.elemStack.push(newElem);

		return this.selfFunc;
	}

	Htmler.prototype.getCurrentElem = function () {
		return this.elemStack[this.elemStack.length - 1];
	}

	Htmler.applyProps = function (elem, propsObj) {
		if (!propsObj) return;

		for (var i = 0, keys = Object.keys(propsObj); i < keys.length; i++) {
			var name = keys[i];
			var value = propsObj[name];
			if (name === 'attributes' && typeof value === 'object') {
				Htmler.applyAttrs(elem, value);
			}
			else if (name === 'classList' && typeof value === 'object') {
				Htmler.applyClasses(elem, value);
			}
			else if (name === 'style' && typeof value === 'object') {
				Htmler.applyStyles(elem, value);
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

	Htmler.applyAttrs = function (elem, attrsObj) {
		//TODO allow watch on object itself
		if (isObjectLiteral(attrsObj)) {
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
					if (isFalsey(value)) {
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

	Htmler.applyClasses = function (elem, classArray) {
		if (classArray instanceof ArrayWatch) {
			classArray.setContext(Watch.Context.ELEMENT_CLASS_LIST);
			classArray.setTargetElement(elem);
			classArray.update();
		}
		else {
			elem.classList.add.apply(elem.classList, classArray);
		}
	}

	Htmler.applyStyles = function (elem, stylesObj) {
		//TODO allow watch on object itself
		if (isObjectLiteral(stylesObj)) {
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

	var isObserving = false;
	var stores = [];

	function isObjectLiteral(obj) {
		return obj != null && typeof obj === 'object' && obj.constructor.name === 'Object';
	}

	function isFalsey(val) {
		return val == null || val === false;
	}

	function updateStores() {
		for (var i = 0; i < stores.length; i++) {
			stores[i].updateWatches();
		}
	}

	function Watch(sourceStore, propName) {
		this.sourceStore = sourceStore;
		this.propName = propName;
		this.context = null;
		this.targetElement = null;
		this.changeFunc = null;
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

	Watch.prototype.setContext = function (context) {
		this.context = context;
	}

	Watch.prototype.setTargetElement = function (element) {
		this.targetElement = element;
	}

	Watch.prototype.setChangeFunc = function (changeFunc) {
		this.changeFunc = changeFunc;
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

		if (this.context === Watch.Context.TEXT) {
			this.targetElement.nodeValue = setVal;
		}
		else if (this.context === Watch.Context.ELEMENT_ATTRIBUTE) {
			if (isFalsey(setVal))
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
			setVal = this.changeFunc(currentArray.length, oldArrayIds.length, this.targetElement);
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
			if (isFalsey(setVal))
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
				Htmler.applyClasses(this.targetElement, setVal.array);
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
				Htmler.applyStyles(this.targetElement, setVal.obj);
			}
		}
		else if (this.context === Watch.Context.ELEMENT_ATTRIBUTE_OBJECT) {
			if (setVal instanceof ObjectStore) {
				Htmler.applyAttrs(this.targetElement, setVal.obj);
			}
		}
	}

	function Store(watches) {
		this.locked = false;
		this.subStores = {};
		this.watches = watches || [];
		this.watches.forEach(function (watch) { watch.sourceStore = this;}, this);
	}

	Store.prototype.lock = function () {
		this.locked = true;
	}

	Store.prototype.unlock = function () {
		this.locked = false;
	}

	Store.prototype.isLocked = function () {
		return this.locked;
	}

	Store.prototype.didChange = function () { /*implement me*/ }

	Store.prototype.sync = function () { /*implement me*/ }

	Store.prototype.obs = function (propName, _changeFunc) {
		_changeFunc = typeof _changeFunc === 'function' ? _changeFunc : null;
		var property = this[propName];
		var propType = typeof property;
		var watch = null;

		if (typeof property === 'object') {
			if (property instanceof ArrayStore) {
				watch = new ArrayWatch(this, propName);
			}
			else {
				watch = new ObjectWatch(this, propName);
			}
		}
		else {
			watch = new ValueWatch(this, propName);
		}

		if (watch) {
			watch.setChangeFunc(_changeFunc);

			var existingWatchIdx = -1;
			//TODO prevent adding duplicate watches by removing watches bound to an element that is removed
			/*for (var i = 0; i < this.watches.length; i++) {
				if (this.watches[i].propName === propName) {
					existingWatchIdx = i;
					break;
				}
			}*/

			if (existingWatchIdx >= 0) {
				this.watches[existingWatchIdx] = watch;
			}
			else {
				this.watches.push(watch);
			}
		}

		return watch;
	}

	Store.prototype.updateWatches = function () {
		if (this.didChange()) {
			for (var i = 0; i < this.watches.length; i++) {
				this.watches[i].update();
			}
			this.sync();
		}

		for (var key in this.subStores) {
			this.subStores[key].updateWatches();
		}
	}

	function ArrayStore(array, watches) {
		Store.apply(this, [watches]);
		this.array = array;
		this.oldArrayIds = null;
		this.overrideArrayMethods();
		this.updateItems();
	}

	ArrayStore.prototype = Object.create(Store.prototype);

	ArrayStore.prototype.replaceArray = function (array) {
		this.array = array;
		this.updateItems();
	}

	ArrayStore.prototype.updateItems = function () {
		this.subStores = {};
		for (var i = 0; i < this.array.length; i++) {
			this.bindItem(i);
		}
	}

	ArrayStore.prototype.bindItem = function (idx) {
		if (this.array[idx] instanceof Array) {
			this.subStores[idx] = new ArrayStore(this.array[idx]);
		}
		else if (isObjectLiteral(this.array[idx])) {
			this.subStores[idx] = new ObjectStore(this.array[idx]);
		}

		if (!this.hasOwnProperty(idx)) {
			Object.defineProperty(this, idx, {
				set: function (val) {
					if (this.isLocked()) {
						throw new Error("Tried to modify locked store");
					}
					if (!this.array.hasOwnProperty(idx)) {
						throw new Error("Tried to set undefined property");
					}

					if (val instanceof ArrayStore) {
						this.subStores[idx] = val;
						this.array[idx] = val.array;
					}
					else if (val instanceof ObjectStore) {
						this.subStores[idx] = val;
						this.array[idx] = val.obj;
					}
					else if (val instanceof Array) {
						//this.subStores[idx] = new ArrayStore(val, this.subStores[idx].watches);
						this.subStores[idx].replaceArray(val);
						this.array[idx] = val;
					}
					else if (isObjectLiteral(val)) {
						//this.subStores[idx] = new ObjectStore(val, this.subStores[idx].watches);
						this.subStores[idx].replaceObj(val);
						this.array[idx] = val;
					}
					else {
						this.array[idx] = val;
					}

					updateStores();
				},
				get: function () {
					return this.subStores[idx] || this.array[idx];
				}
			});
		}
	}

	ArrayStore.prototype.overrideArrayMethods = function () {
		var self = this;

		var mutators = ['copyWithin', 'fill', 'pop', 'push', 'reverse', 'shift', 'sort',
						'splice', 'unshift'];
		mutators.forEach(function (func) {
			self[func] = function () {
				Array.prototype[func].apply(self.array, arguments);
				self.updateItems();
				updateStores();
			};
		});

		var iterators = ['forEach', 'entries', 'every', 'some', 'filter', 'findIndex',
						 'keys', 'map', 'reduce', 'reduceRight', 'values'];
		iterators.forEach(function (func) {
			self[func] = function () {
				var result = Array.prototype[func].apply(self.array, arguments);
				updateStores();
				return result;
			};
		});

		var accessors = ['concat', 'includes', 'join', 'slice', 'toSource', 'toString',
						 'toLocaleString', 'indexOf', 'lastIndexOf'];
		accessors.forEach(function (func) {
			self[func] = function () {
				for (var i = 0; i < arguments.length; i++) {
					if (arguments[i] instanceof ObjectStore) {
						arguments[i] = arguments[i].obj;
					}
					else if (arguments[i] instanceof ArrayStore) {
						arguments[i] = arguments[i].array;
					}
				}
				return Array.prototype[func].apply(self.array, arguments);
			};
		});

		Object.defineProperty(this, 'length', {
			get: function () { return this.array.length; }
		});
	}

	ArrayStore.prototype.didChange = function () {
		if (this.oldArrayIds === null) return true;

		if (this.oldArrayIds.length !== this.array.length) return true;

		for (var i = 0; i < this.array.length; i++) {
			if (this.array[i] === null) {
				if (!(this.oldArrayIds[i] == null && this.array[i] == null)) return true;
			}
			else {
				if (this.oldArrayIds[i] !== this.array[i].uniqueId) return true;
			}
		}

		return false;
	}

	ArrayStore.prototype.sync = function () {
		this.oldArrayIds = this.array.map(function (item) { return item != null ? item.uniqueId : null; });
	}

	function ObjectStore(obj, watches) {
		Store.apply(this, [watches]);
		this.obj = obj;
		this.oldObjIds = null;
		this.updateProps();
	}

	ObjectStore.prototype = Object.create(Store.prototype);

	ObjectStore.prototype.replaceObj = function (obj) {
		this.obj = obj;
		this.updateProps();
	}

	ObjectStore.prototype.updateProps = function () {
		this.subStores = {};
		for (key in this.obj) {
			this.bindProp(key);
		}
	}

	ObjectStore.prototype.bindProp = function (key) {
		if (this.obj[key] instanceof Array) {
			this.subStores[key] = new ArrayStore(this.obj[key]);
		}
		else if (isObjectLiteral(this.obj[key])) {
			this.subStores[key] = new ObjectStore(this.obj[key]);
		}

		if (!this.hasOwnProperty(key)) {
			Object.defineProperty(this, key, {
				set: function (val) {
					if (this.isLocked()) {
						throw new Error("Tried to modify locked store");
					}
					if (!this.obj.hasOwnProperty(key)) {
						throw new Error("Tried to set undefined property");
					}

					if (val instanceof ArrayStore) {
						this.subStores[key] = val;
						this.obj[key] = val.array;
					}
					else if (val instanceof ObjectStore) {
						this.subStores[key] = val;
						this.obj[key] = val.obj;
					}
					else if (val instanceof Array) {
						//this.subStores[key] = new ArrayStore(val, this.subStores[key].watches);
						this.subStores[key].replaceArray(val);
						this.obj[key] = val;
					}
					else if (isObjectLiteral(val)) {
						//this.subStores[key] = new ObjectStore(val, this.subStores[key].watches);
						this.subStores[key].replaceObj(val);
						this.obj[key] = val;
					}
					else {
						this.obj[key] = val;
					}

					updateStores();
				},
				get: function () {
					return this.subStores[key] || this.obj[key];
				}
			});
		}
	}

	ObjectStore.prototype.didChange = function () {
		if (this.oldObjIds === null) return true;

		for (var i = 0, keys = Object.keys(this.obj); i < keys.length; i++) {
			var key = keys[i];
			if (this[key] instanceof Store && this[key].didChange()) return true;
			if (this.obj[key] == null) {
				if (!(this.oldObjIds[key] == null && this.obj[key] == null)) return true;
			}
			else {
				if (this.oldObjIds[key] !== this.obj[key].uniqueId) return true;
			}
		}
		return false;
	}

	ObjectStore.prototype.sync = function () {
		this.oldObjIds = {};
		for (var i = 0, keys = Object.keys(this.obj); i < keys.length; i++) {
			var key = keys[i];
			this.oldObjIds[key] = this.obj[key] != null ? this.obj[key].uniqueId : null;
		}
	}

	var exports = {
		htmler: function () {
			if (!isObserving) {
				isObserving = true;
				updateStores();
			}
			return new Htmler();
		},

		custom: function (arg) {
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
		},

		promise: function (buildFunc) {
			return function (parent, attrs) {
				var placeholderElement = document.createComment('');
				parent.appendChild(placeholderElement);

				var doneFunc = function (element) {
					parent.replaceChild(element, placeholderElement);
				};
				buildFunc(doneFunc);
			}
		},

		text: function (arg) {
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
		},

		repeat: function (buildFunc) {
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
		},

		make_store: function (obj) {
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
		},

		obs: function (store, prop, _changeFunc) {
			if (store instanceof Store) {
				return store.obs(prop, _changeFunc);
			}
		}
	};

	return exports;
})();