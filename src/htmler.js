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

	function Htmler(tag, attrs) {
		if (!this.initialized) {
			this.selfFunc = Htmler.bind(this);
			this.elemStack = [];
			this.initialized = true;
			return this.selfFunc;
		}

		//element creation is deferred to a function
		if (typeof tag === 'function') {
			tag(this.getCurrentElem(), attrs);
			return this.selfFunc;
		}

		//append pre-built element if tag argument is a reference
		if (tag instanceof Node) {
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
			this.applyAttrs(newElem, attrs);
			if (this.elemStack.length > 0) {
				this.getCurrentElem().appendChild(newElem);
			}
			return this.selfFunc;
		}

		//all other tags
		var newElem = document.createElement(tag.replace(/\s/g, ''));
		this.applyAttrs(newElem, attrs);
		if (this.elemStack.length > 0) {
			this.getCurrentElem().appendChild(newElem);
		}
		this.elemStack.push(newElem);

		return this.selfFunc;
	}

	Htmler.prototype.getCurrentElem = function () {
		return this.elemStack[this.elemStack.length - 1];
	}

	Htmler.prototype.applyAttrs = function (elem, attrs) {
		for (var key in attrs) {
			if (typeof attrs[key] === 'object') {
				if (attrs[key] instanceof Array) {
					for (var i = 0; i < attrs[key].length; i++) {
						var subAttr = attrs[key][i];
						for (var subKey in subAttr) {
							elem[key][subKey] = subAttr[subKey];
						}
					}
				}
				else if (attrs[key] instanceof Watch) {
					var watch = attrs[key];
					watch.setContext(Watch.Context.ATTRIBUTE);
					watch.setTarget(elem);
					watch.attrPath = [key];
					elem[key] = watch.getValue();
				}
				else {
					for (var subKey in attrs[key]) {
						if (attrs[key][subKey] instanceof Watch) {
							var watch = attrs[key][subKey];
							watch.setContext(Watch.Context.ATTRIBUTE);
							watch.setTarget(elem);
							watch.attrPath = [key, subKey];
							elem[key][subKey] = watch.getValue();
						}
						else {
							elem[key][subKey] = attrs[key][subKey];
						}
					}
				}
			}
			else {
				elem[key] = attrs[key];
			}
		}
	}

	var isObserving = false;
	var stores = [];

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
		ATTRIBUTE: 2,
		REPEAT: 3
	}

	Watch.prototype.setContext = function (context) {
		this.context = context;
	}

	Watch.prototype.setTarget = function (element) {
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

		if (this.context === Watch.Context.TEXT) {
			if (this.changeFunc) {
				this.sourceStore.lock();
				this.targetElement.nodeValue = this.changeFunc(currentVal, oldVal, this.targetElement);
				this.sourceStore.unlock();
			}
			else {
				this.targetElement.nodeValue = currentVal;
			}
		}
		else if (this.context === Watch.Context.ATTRIBUTE) {
			var attrTarget = this.targetElement;
			for (var i = 0; i < this.attrPath.length - 1; i++) {
				attrTarget = attrTarget[this.attrPath[i]];
			}
			attrTarget[this.attrPath[this.attrPath.length - 1]] = currentVal;
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
		var oldChildIds = currentArray.oldArrayIds || [];

		if (this.context === Watch.Context.TEXT) {
			if (this.changeFunc) {
				this.sourceStore.lock();
				this.targetElement.nodeValue = this.changeFunc(currentArray.length, oldChildIds.length, this.targetElement);
				this.sourceStore.unlock();
			}
			else {
				this.targetElement.nodeValue = currentArray;
			}
		}
		else if (this.context === Watch.Context.REPEAT) {
			var parent = this.targetElement.parentNode;
			for (var i = 0; i < oldChildIds.length; i++) {
				if (this.targetElement.nextSibling) {
					parent.removeChild(this.targetElement.nextSibling);
				}
			}
			for (var i = currentArray.length - 1; i >= 0; i--) {
				if (this.targetElement.nextSibling) {
					parent.insertBefore(this.buildFunc(currentArray.subStores[i], i), this.targetElement.nextSibling);
				}
				else {
					parent.appendChild(this.buildFunc(currentArray.subStores[i], i));
				}
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

		if (this.context === Watch.Context.TEXT) {
			if (this.changeFunc) {
				this.sourceStore.lock();
				this.targetElement.nodeValue = this.changeFunc(currentObj, oldObj, this.targetElement);
				this.sourceStore.unlock();
			}
			else {
				this.targetElement.nodeValue = currentObj;
			}
		}
		else if (this.context === Watch.Context.ELEMENT) {
			if (currentObj instanceof Element) {
				if (this.changeFunc) {
					this.sourceStore.lock();
					this.targetElement.parentNode.replaceChild(this.changeFunc(currentObj, oldObj, this.targetElement), this.targetElement);
					this.sourceStore.unlock();
				}
				else {
					this.targetElement.parentNode.replaceChild(currentObj, this.targetElement);
				}
				this.targetElement = currentObj;
			}
			else {
				this.targetElement.parentNode.removeChild(this.targetElement);
				this.targetElement = null;
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

		if (propType === 'object' || propType === 'function') {
			if (property instanceof ArrayStore) {
				watch = new ArrayWatch(this, propName);
			}
			else {
				watch = new ObjectWatch(this, propName);
			}
		}
		else if (propType === 'string' || propType === 'number' || propType === 'boolean') {
			watch = new ValueWatch(this, propName);
		}

		if (watch) {
			watch.setChangeFunc(_changeFunc);
			this.watches.push(watch);
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
		else if (this.array[idx].constructor.name === 'Object') {
			this.subStores[idx] = new ObjectStore(this.array[idx]);
		}

		if (!this.hasOwnProperty(idx)) {
			Object.defineProperty(this, idx, {
				set: function (val) {
					if (this.isLocked()) {
						throw new Error("Tried to modify locked store");
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
					else if (val.constructor.name === 'Object') {
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
			if (this.oldArrayIds[i] !== this.array[i].uniqueId) return true;
		}

		return false;
	}

	ArrayStore.prototype.sync = function () {
		this.oldArrayIds = this.array.map(function (item) { return item.uniqueId; });
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
		else if (this.obj[key].constructor.name === 'Object') {
			this.subStores[key] = new ObjectStore(this.obj[key]);
		}

		if (!this.hasOwnProperty(key)) {
			Object.defineProperty(this, key, {
				set: function (val) {
					if (this.isLocked()) {
						throw new Error("Tried to modify locked store");
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
					else if (val.constructor.name === 'Object') {
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

		for (var key in this.obj) {
			if (this.oldObjIds[key] !== this.obj[key].uniqueId) return true;
		}
		return false;
	}

	ObjectStore.prototype.sync = function () {
		this.oldObjIds = {};
		for (var key in this.obj) {
			this.oldObjIds[key] = this.obj[key].uniqueId;
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
						watch.setTarget(element);
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
					watch.setTarget(element);
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
					watch.setTarget(parent.appendChild(document.createComment('')));
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