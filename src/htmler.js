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
			tag(this.getCurrentElem());
			return this.selfFunc;
		}

		//clone pre-built element if tag argument is a reference
		if (typeof tag === 'object') {
			this.getCurrentElem().appendChild(tag.cloneNode(true));
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
				for (var subKey in attrs[key]) {
					elem[key][subKey] = attrs[key][subKey];
				}
			}
			else {
				elem[key] = attrs[key];
			}
		}
	}

	var isObserving = false;
	var propObservers = [];
	var listObservers = [];
	var stores = [];
	var Observer = {
		Type: {
			VALUE: 0,
			OBJECT: 1,
			LIST: 2
		},

		Context: {
			TEXT: 0,
			ELEMENT: 1,
			REPEAT: 2
		},

		isObserver: function (obj) {
			return obj.__obsType !== undefined;
		},
		isValue: function (obj) {
			return obj.__obsType === Observer.Type.VALUE;
		},
		isObject: function (obj) {
			return obj.__obsType === Observer.Type.OBJECT;
		},
		isList: function (obj) {
			return obj.__obsType === Observer.Type.LIST;
		}
	};

	function updateObservers() {
		//TODO - handle null/undefined values

		for (var i = 0; i < stores.length; i++) {
			var store = stores[i];

			for (var j = 0; j < store.valueObservers.length; j++) {
				var obs = store.valueObservers[j];
				var currentVal = store[obs.propName];
				if (currentVal !== obs.value) {
					if (obs.__obsContext === Observer.Context.TEXT) {
						if (obs.changeFunc) {
							obs.store.lock();
							obs.target.nodeValue = obs.changeFunc(currentVal, obs.value, obs.target);
							obs.store.unlock();
						}
						else {
							obs.target.nodeValue = currentVal;
						}
					}
					obs.value = currentVal;
				}
			}

			for (var j = 0; j < store.objectObservers.length; j++) {
				var obs = store.objectObservers[j];
				var currentObj = store[obs.propName];
				if (currentObj.uniqueId !== obs.objectId) {
					if (obs.__obsContext === Observer.Context.TEXT) {
						if (obs.changeFunc) {
							obs.store.lock();
							obs.target.nodeValue = obs.changeFunc(currentObj, currentObj, obs.target);
							obs.store.unlock();
						}
						else {
							obs.target.nodeValue = currentObj;
						}
					}
					else if (obs.__obsContext === Observer.Context.ELEMENT) {
						if (currentObj) {
							if (obs.changeFunc) {
								obs.store.lock();
								obs.target.parentNode.replaceChild(obs.changeFunc(currentObj, currentObj, obs.target), obs.target);
								obs.store.unlock();
							}
							else {
								obs.target.parentNode.replaceChild(currentObj, obs.target);
							}
						}
						else {
							obs.target.parentNode.removeChild(obs.target);
						}
					}
					obs.objectId = currentObj.uniqueId;
					obs.target = currentObj;
				}
			}

			for (var j = 0; j < store.listObservers.length; j++) {
				var obs = store.listObservers[j];
				var list = store[obs.propName];
				var differs = false;

				if (obs.listId !== list.uniqueId) {
					obs.listId = list.uniqueId;
					differs = true;
				}
				else if (obs.childIds.length !== obs.store[obs.propName].length) {
					differs = true;
				}
				else {
					for (var k = 0; k < list.length; k++) {
						if (k === obs.childIds.length) {
							differs = true;
							break;
						}
						if (list[k].uniqueId !== obs.childIds[k]) {
							differs = true;
							break;
						}
					}
				}

				if (differs) {
					var newChildIds = [];
					for (var k = 0; k < list.length; k++) {
						newChildIds.push(list[k].uniqueId);
					}

					if (obs.__obsContext === Observer.Context.TEXT) {
						if (obs.changeFunc) {
							obs.store.lock();
							obs.target.nodeValue = obs.changeFunc(newChildIds.length, obs.childIds.length, obs.target);
							obs.store.unlock();
						}
						else {
							obs.target.nodeValue = list;
						}
					}
					else if (obs.__obsContext === Observer.Context.REPEAT) {
						//TODO - fix case where the preceding/proceeding elements of the list changes
						var parent = obs.parent;
						if (obs.previous) {
							var previous = obs.previous;
							for (var k = 0; k < obs.childIds.length; k++) {
								parent.removeChild(previous.nextSibling);
							}
							for (var k = list.length - 1; k >= 0; k--) {
								parent.insertBefore(obs.buildFunc(list[k], k), previous.nextSibling);
							}
							obs.target = previous.nextSibling;
						}
						else {
							while (parent.lastChild) {
								parent.removeChild(parent.lastChild);
							}
							for (var k = 0; k < list.length; k++) {
								parent.appendChild(obs.buildFunc(list[k], k));
							}
							obs.target = parent.firstChild;
						}
					}

					obs.childIds = newChildIds;
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

		window.requestAnimationFrame(updateObservers);
	}

	function Store(obj) {
		this.obj = obj;
		this.locked = false;
		this.valueObservers = [];
		this.objectObservers = [];
		this.listObservers = [];
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
			if (property instanceof Array) {
				var childIds = [];
				for (var i = 0; i < property.length; i++) {
					childIds.push(property[i].uniqueId);
				}
				var observer = {
					__obsType: Observer.Type.LIST,
					__obsContext: context,
					propName: propName,
					listId: property.uniqueId,
					childIds: childIds,
					parent: parent,
					target: null,
					changeFunc: _changeFunc,
					buildFunc: null,
					store: this
				};
				this.listObservers.push(observer);
				return observer;
			}
			else {
				if (typeof property === 'object') {
					var observer = {
						__obsType: Observer.Type.OBJECT,
						__obsContext: context,
						propName: propName,
						objectId: property.uniqueId,
						parent: parent,
						target: null,
						changeFunc: _changeFunc,
						store: this
					};
					this.objectObservers.push(observer);
					return observer;
				}
				else {
					var observer = {
						__obsType: Observer.Type.VALUE,
						__obsContext: context,
						propName: propName,
						value: property,
						parent: parent,
						target: null,
						changeFunc: _changeFunc,
						store: this
					};
					this.valueObservers.push(observer);
					return observer;
				}
			}
		}.bind(this);
	}

	var exports = {
		htmler: function () {
			if (!isObserving) {
				isObserving = true;
				updateObservers();
			}
			return new Htmler();
		},

		custom: function (arg) {
			return function (parent) {
				var argValue = typeof arg === 'function' ? arg(Observer.Context.ELEMENT, parent) : arg;

				if (Observer.isObserver(argValue)) {
					var observer = argValue;
					if (Observer.isObject(observer)) {
						observer.target = parent.appendChild(observer.store[observer.propName]);
					}
				}
				else if (argValue instanceof Element) {
					parent.appendChild(argValue);
				}
			};
		},

		promise: function (buildFunc) {
			return function (parent) {
				var placeholderElement = document.createElement('_placeholder');
				parent.appendChild(placeholderElement);

				var doneFunc = function (element) {
					parent.replaceChild(element, placeholderElement);
				};
				buildFunc(doneFunc);
			}
		},

		text: function (arg) {
			return function (parent) {
				var argValue = typeof arg === 'function' ? arg(Observer.Context.TEXT, parent) : arg;

				if (Observer.isObserver(argValue)) {
					var observer = argValue;
					var text = "";
					if (Observer.isValue(observer)) {
						text = observer.store[observer.propName];
					}
					var textNode = document.createTextNode(text);
					observer.target = parent.appendChild(textNode);
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

		repeat: function (arg, buildFunc) {
			buildFunc = typeof buildFunc === 'function' ? buildFunc : function () {};
			return function (parent) {
				var argValue = typeof arg === 'function' ? arg(Observer.Context.REPEAT, parent) : arg;

				if (Observer.isObserver(argValue)) {
					var observer = argValue;
					if (Observer.isList(observer)) {
						observer.buildFunc = buildFunc;
						observer.previous = parent.lastChild;
						var list = observer.store[observer.propName];
						if (observer.previous) {
							for (var i = list.length - 1; i >= 0; i--) {
								parent.insertBefore(observer.buildFunc(list[i], i), observer.previous.nextSibling);
							}
							observer.target = observer.previous.nextSibling;
						}
						else {
							for (var i = 0; i < list.length; i++) {
								parent.appendChild(observer.buildFunc(list[i], i));
							}
							observer.target = parent.firstChild;
						}
					}
				}
				else if (argValue instanceof Array) {
					for (var i = 0; i < argValue.length; i++) {
						parent.appendChild(buildFunc(argValue[i], i));
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