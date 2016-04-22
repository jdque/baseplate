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
		if (typeof tag === 'object') {
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
				else {
					for (var subKey in attrs[key]) {
						elem[key][subKey] = attrs[key][subKey];
					}
				}
			}
			else {
				elem[key] = attrs[key];
			}
		}
	}

	var isObserving = false;
	var propObservers = [];
	var stores = [];

	function updateWatches() {
		for (var i = 0; i < stores.length; i++) {
			for (var j = 0; j < stores[i].watches.length; j++) {
				var watch = stores[i].watches[j];
				if (watch.didChange()) {
					watch.update();
				}
			}
		}

		for (var i = 0; i < propObservers.length; i++) {
			var obs = propObservers[i];
			var currentVal = obs.obj[obs.prop];
			if (currentVal !== obs.value) {
				if (obs.changeFunc) {
					obs.target.nodeValue = obs.changeFunc(currentVal, obs.value, obs.target);
				}
				else {
					obs.target.nodeValue = currentVal;
				}
				obs.value = currentVal;
			}
		}

		window.requestAnimationFrame(updateWatches);
	}

	function Watch(sourceStore, propName, context) {
		this.context = context;
		this.sourceStore = sourceStore;
		this.propName = propName;
		this.targetElement = null;
		this.changeFunc = null;
	}

	Watch.Context = {
		TEXT: 0,
		ELEMENT: 1,
		REPEAT: 2
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

	Watch.prototype.didChange = function () {}

	Watch.prototype.update = function () {}

	function ValueWatch(store, propName, context) {
		Watch.apply(this, [store, propName, context]);

		this.oldValue = this.getValue();
	}

	ValueWatch.prototype = Object.create(Watch.prototype);

	ValueWatch.prototype.didChange = function () {
		return this.getValue() !== this.oldValue;
	}

	ValueWatch.prototype.update = function () {
		var currentVal = this.getValue();

		if (this.context === Watch.Context.TEXT) {
			if (this.changeFunc) {
				this.sourceStore.lock();
				this.targetElement.nodeValue = this.changeFunc(currentVal, this.oldValue, this.targetElement);
				this.sourceStore.unlock();
			}
			else {
				this.targetElement.nodeValue = currentVal;
			}
		}
		this.oldValue = currentVal;
	}

	function ArrayWatch(store, propName, context) {
		Watch.apply(this, [store, propName, context]);

		this.buildFunc = null;
		var list = this.getValue();
		this.oldListId = list.uniqueId;
		this.oldChildIds = list.map(function (item) { return item.uniqueId; });
	}

	ArrayWatch.prototype = Object.create(Watch.prototype);

	ArrayWatch.prototype.setBuildFunc = function (buildFunc) {
		this.buildFunc = buildFunc;
	}

	ArrayWatch.prototype.didChange = function () {
		var currentList = this.getValue();

		if (this.oldListId !== currentList.uniqueId) {  //reference changed
			return true;
		}
		if (this.oldChildIds.length !== currentList.length) {  //array size changed
			return true;
		}

		for (var i = 0; i < currentList.length; i++) {  //reference of any children changed
			if (i === this.oldChildIds.length) {
				return true;
			}
			if (currentList[i].uniqueId !== this.oldChildIds[i]) {
				return true;
			}
		}

		return false;
	}

	ArrayWatch.prototype.update = function () {
		var currentList = this.getValue();
		var newChildIds = [];
		for (var i = 0; i < currentList.length; i++) {
			newChildIds.push(currentList[i].uniqueId);
		}

		if (this.context === Watch.Context.TEXT) {
			if (this.changeFunc) {
				this.sourceStore.lock();
				this.targetElement.nodeValue = this.changeFunc(newChildIds.length, this.oldChildIds.length, this.targetElement);
				this.sourceStore.unlock();
			}
			else {
				this.targetElement.nodeValue = currentList;
			}
		}
		else if (this.context === Watch.Context.REPEAT) {
			var parent = this.targetElement.parentNode;
			for (var i = 0; i < this.oldChildIds.length; i++) {
				if (this.targetElement.nextSibling) {
					parent.removeChild(this.targetElement.nextSibling);
				}
			}
			for (var i = currentList.length - 1; i >= 0; i--) {
				if (this.targetElement.nextSibling) {
					parent.insertBefore(this.buildFunc(currentList[i], i), this.targetElement.nextSibling);
				}
				else {
					parent.appendChild(this.buildFunc(currentList[i], i));
				}
			}
		}

		this.oldListId = currentList.uniqueId;
		this.oldChildIds = newChildIds;
	}

	function ObjectWatch(store, propName, context) {
		Watch.apply(this, [store, propName, context]);

		this.oldObjectId = this.getValue().uniqueId;
	}

	ObjectWatch.prototype = Object.create(Watch.prototype);

	ObjectWatch.prototype.didChange = function () {
		return this.getValue().uniqueId !== this.oldObjectId;
	}

	ObjectWatch.prototype.update = function () {
		var currentObj = this.getValue();

		if (this.context === Watch.Context.TEXT) {
			if (this.changeFunc) {
				this.sourceStore.lock();
				this.targetElement.nodeValue = this.changeFunc(currentObj, currentObj, this.targetElement);
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
					this.targetElement.parentNode.replaceChild(this.changeFunc(currentObj, currentObj, this.targetElement), this.targetElement);
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

		this.oldObjectId = currentObj.uniqueId;
	}

	function Store(obj) {
		this.obj = obj;
		this.locked = false;
		this.watches = [];
		for (key in obj) {
			this.bindProp(key);
		}
	}

	Store.prototype.lock = function () {
		this.locked = true;
	}

	Store.prototype.unlock = function () {
		this.locked = false;
	}

	Store.prototype.bindProp = function (key) {
		Object.defineProperty(this, key, {
			set: function (val) {
				if (this.locked) {
					throw new Error("Tried to modify locked store");
				}
				this.obj[key] = val;
			},
			get: function () {
				return this.obj[key];
			}
		});
	}

	Store.prototype.obs = function (propName, _changeFunc) {
		_changeFunc = typeof _changeFunc === 'function' ? _changeFunc : null;
		return function (context, parent) {
			var property = this[propName];
			var propType = typeof property;
			var watch = null;
			if (propType === 'object') {
				if (property instanceof Array) {
					watch = new ArrayWatch(this, propName, context);
				}
				else {
					watch = new ObjectWatch(this, propName, context);
				}
			}
			else if (propType === 'string' || propType === 'number' || propType === 'boolean') {
				watch = new ValueWatch(this, propName, context);
			}

			if (watch) {
				watch.setChangeFunc(_changeFunc);
				this.watches.push(watch);
			}

			return watch;
		}.bind(this);
	}

	var exports = {
		htmler: function () {
			if (!isObserving) {
				isObserving = true;
				updateWatches();
			}
			return new Htmler();
		},

		custom: function (arg) {
			return function (parent, attrs) {
				var argValue = typeof arg === 'function' ? arg(Watch.Context.ELEMENT, parent) : arg;

				if (argValue instanceof ObjectWatch) {
					var watch = argValue;
					if (watch.getValue() instanceof Element) {
						var element = parent.appendChild(watch.getValue());
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
				var argValue = typeof arg === 'function' ? arg(Watch.Context.TEXT, parent) : arg;

				if (argValue instanceof Watch) {
					var watch = argValue;
					var text = watch.getValue();
					var textNode = document.createTextNode(text);
					var element = parent.appendChild(textNode);
					watch.setTarget(element);
					watch.update();
				}
				else {
					if (typeof argValue === 'object') { //TODO - remove once global obs() is deprecated
						var textNode = document.createTextNode(argValue.value);
						argValue.target = parent.appendChild(textNode);
					}
					else {
						var textNode = document.createTextNode(argValue);
						parent.appendChild(textNode);
					}
				}
			}
		},

		repeat: function (buildFunc) {
			buildFunc = typeof buildFunc === 'function' ? buildFunc : function () {};
			return function (parent, attrs) {
				var data = typeof attrs.data === 'function' ? attrs.data(Watch.Context.REPEAT, parent) : attrs.data;
				if (data instanceof ArrayWatch) {
					var watch = data;
					watch.setBuildFunc(buildFunc);
					watch.setTarget(parent.appendChild(document.createComment('')));
					watch.update();
				}
				else if (data instanceof Array) {
					for (var i = 0; i < data.length; i++) {
						parent.appendChild(buildFunc(data[i], i));
					}
				}
			};
		},

		make_store: function (obj) {
			var newStore = new Store(obj);
			stores.push(newStore);
			return newStore;
		},

		obs: function (obj, prop, _changeFunc) {
			_changeFunc = typeof _changeFunc === 'function' ? _changeFunc : null;

			if (obj instanceof Store) {
				return obj.obs(prop, _changeFunc);
			}

			return function (context, parent) {
				var observer = {obj: obj, prop: prop, value: obj.prop, parent: parent, changeFunc: _changeFunc};
				propObservers.push(observer);
				return observer;
			}
		}
	};

	return exports;
})();