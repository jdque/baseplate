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

(function (target) {
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

	function htmler() {
		if (!isObserving) {
			isObserving = true;
			updateObservers();
		}
		return new Htmler();
	}

	function custom(arg) {
		return function (target) {
			var argValue = typeof arg === 'function' ? arg(Observer.Context.ELEMENT, target) : arg;

			if (Observer.isObserver(argValue)) {
				var observer = argValue;
				if (Observer.isObject(observer)) {
					target.appendChild(observer.store[observer.propName]);
				}
			}
			else if (argValue instanceof Element) {
				target.appendChild(argValue);
			}
		};
	}

	function promise(buildFunc) {
		return function (parent) {
			var placeholderElement = document.createElement('_placeholder');
			parent.appendChild(placeholderElement);

			var doneFunc = function (element) {
				parent.replaceChild(element, placeholderElement);
			};
			buildFunc(doneFunc);
		}
	}

	function text(arg) {
		return function (target) {
			var argValue = typeof arg === 'function' ? arg(Observer.Context.TEXT, target) : arg;

			if (Observer.isObserver(argValue)) {
				var observer = argValue;
				if (observer.changeFunc) {
					if (Observer.isList(observer)) {
						target.textContent = observer.changeFunc(observer.childIds.length, observer.childIds.length, target);
					}
					else {
						target.textContent = observer.changeFunc(observer.store[observer.propName], observer.store[observer.propName], target);
					}
				}
				else {
					target.textContent = observer.store[observer.propName];
				}
			}
			else {
				target.textContent = argValue;
			}
		}
	}

	function repeat(arg, buildFunc) {
		buildFunc = typeof buildFunc === 'function' ? buildFunc : function () {};
		return function (target) {
			var argValue = typeof arg === 'function' ? arg(Observer.Context.REPEAT, target) : arg;

			if (Observer.isObserver(argValue)) {
				var observer = argValue;
				if (Observer.isList(observer)) {
					observer.buildFunc = buildFunc;
					for (var i = 0; i < observer.store[observer.propName].length; i++) {
						target.appendChild(observer.buildFunc(observer.store[observer.propName][i], i));
					}
				}
			}
			else if (argValue instanceof Array) {
				for (var i = 0; i < argValue.length; i++) {
					target.appendChild(buildFunc(argValue[i], i));
				}
			}
		};
	}

	var isObserving = false;
	var propObservers = [];
	var listObservers = [];
	var updateObservers = function () {
		//TODO - handle null/undefined values

		for (var i = 0; i < stores.length; i++) {
			var store = stores[i];

			for (var j = 0; j < store.valueObservers.length; j++) {
				var obs = store.valueObservers[j];
				var currentVal = store[obs.propName];
				if (currentVal !== obs.value) {
					if (obs.__obsContext === Observer.Context.TEXT) {
						if (obs.changeFunc) {
							obs.target.textContent = obs.changeFunc(currentVal, obs.value, obs.target);
						}
						else {
							obs.target.textContent = currentVal;
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
							obs.target.textContent = obs.changeFunc(currentObj, currentObj, obs.target);
						}
						else {
							obs.target.textContent = currentObj;
						}
					}
					else if (obs.__obsContext === Observer.Context.ELEMENT) {
						var oldElement = null;
						//TODO - cache element reference
						for (var k = 0; k < obs.target.children.length; k++) {
							if (obs.target.children[k].uniqueId === obs.objectId) {
								oldElement = obs.target.children[k];
								break;
							}
						}
						if (oldElement) {
							if (currentObj) {
								if (obs.changeFunc) {
									obs.target.replaceChild(obs.changeFunc(currentObj, currentObj, obs.target), oldElement);
								}
								else {
									obs.target.replaceChild(currentObj, oldElement);
								}
							}
							else {
								obs.target.removeChild(oldElement);
							}
						}
					}
					obs.objectId = currentObj.uniqueId;
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
							obs.target.textContent = obs.changeFunc(newChildIds.length, obs.childIds.length, obs.target);
						}
						else {
							obs.target.textContent = list;
						}
					}
					else if (obs.__obsContext === Observer.Context.REPEAT) {
						//TODO - cache first element and remove n elements after it instead of removing all child elements of parent
						while (obs.target.firstChild) {
							obs.target.removeChild(obs.target.firstChild);
						}
						for (var k = 0; k < list.length; k++) {
							//TODO - allow change function to get list item
							obs.target.appendChild(obs.buildFunc(list[k], k));
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
					obs.target.textContent = obs.changeFunc(currentVal, obs.value, obs.target);
				}
				else {
					obs.target.textContent = currentVal;
				}
				obs.value = currentVal;
			}
		}

		window.requestAnimationFrame(updateObservers);
	}

	function obs(obj, prop, _changeFunc) {
		_func = typeof _func === 'function' ? _func : null;
		return function (context, target) {
			var observer = {obj: obj, prop: prop, value: obj.prop, target: target, changeFunc: _changeFunc};
			propObservers.push(observer);
			return observer;
		}
	}

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

	function Store(obj) {
		this.obj = obj;
		this.valueObservers = [];
		this.objectObservers = [];
		this.listObservers = [];
		for (key in obj) {
			this.bindProp(key);
		}
	}

	Store.prototype.bindProp = function (key) {
		Object.defineProperty(this, key, {
			set: function (val) {
				this.obj[key] = val;
			},
			get: function () {
				return this.obj[key];
			}
		});
	}

	Store.prototype.obs = function (propName, _changeFunc) {
		_changeFunc = typeof _changeFunc === 'function' ? _changeFunc : null;
		return function (context, target) {
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
					target: target,
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
						target: target,
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
						target: target,
						changeFunc: _changeFunc,
						store: this
					};
					this.valueObservers.push(observer);
					return observer;
				}
			}
		}.bind(this);
	}

	var stores = [];
	function make_store(obj) {
		var newStore = new Store(obj);
		stores.push(newStore);
		return newStore;
	}

	target.htmler = htmler;
	target.custom = custom;
	target.promise = promise;
	target.text = text;
	target.repeat = repeat;
	target.obs = obs;
	target.make_store = make_store;
})(window);

window.onload = function () {
	var data = {
		name: 'Joe',
		partner: 'Jane'
	};

	var store = make_store({
		counter: 0,
		inputValue: "",
		list: [
			{
				label: "Hello",
				value: 1
			},
			{
				label: "World",
				value: 2
			},
			{
				label: "Again",
				value: 3
			}
		]
	});

	var shuffle = function (array) {
		var curr = array.length, temp, randIdx;
		while (curr !== 0) {
			randIdx = Math.floor(Math.random() * curr);
			curr -= 1;
			temp = array[curr];
			array[curr] = array[randIdx];
			array[randIdx] = temp;
		}
	}

	var styles = {
		container: {'border': '2px solid black', 'width': '480px', 'padding': '8px'},
		child: {'background-color': '#0000FF', 'width': '64px', 'height': '64px'},
		bold: {'font-weight': 'bold'}
	};

	var box = htmler()
	('div', {style: styles.child})
	('/div')

	var box1 = htmler()
	('div', {style: {'background-color': 'red', 'width': '64px', 'height': '64px'},
		onclick: function (e) { boxStore.element = box2; }
	})
	('/div')

	var box2 = htmler()
	('div', {style: {'background-color': 'green', 'width': '64px', 'height': '64px'},
		onclick: function (e) { boxStore.element = box1; }
	})
	('/div')

	var boxStore = make_store({
		element: box1
	});

	var stuff = htmler()
	('div', {id: 'container1', style: styles.container})
		(box)
		('span')
			(text(data.name))
		('/span')
		('br /')
		('br /')
		('span')
			(text(data.partner))
		('/span')
		('br /')
		('br /')
		('ul')
			(repeat(store.list, function (item, idx) {
				var bg = idx % 2 === 0 ? 'grey' : 'white'
				return htmler()
				('li', {style: {'font-weight': 'bold', 'background-color': bg}})
					('span')(text(item.label))('/span')
					('br /')
					('span')
						(text(function () {
							var m  = item.value > 2 ? " < 2" : " >= 2";
							return item.value + m;
						}))
					('/span')
				('/li')
			}))
		('/ul')
		('br /')
		('br /')
		(custom(function () {
			var z = document.createElement('div');
			z.style.width = '64px';
			z.style.height = '64px';
			z.style.backgroundColor = 'green';
			return z;
		}))
		('br /')
		('br /')
		(promise(function (done) {
			window.setTimeout(function () {
				done(box);
			}, 2000);
		}))
		('br /')
		('br /')
		(custom(boxStore.obs('element')))
		('br /')
		('br /')
		('span', {style: {'font-size': '32px'}})
			(text(store.obs('counter')))
		('/span')
		('br /')
		('br /')
		('input', {
			onkeyup: function (ev) {
				store.inputValue = ev.target.value;
				if (ev.keyCode === 13) {
					store.list.push({label: ev.target.value, value: 0});
					store.inputValue = "";
					ev.target.value = "";
				}
			},
			onkeydown: function (ev) {
				store.inputValue = ev.target.value;
			}
		})
		('br /')
		('br /')
		('span')
			(text(store.obs('inputValue', function (newVal, oldVal, target) {
				if (newVal === "hello") {
					target.style.color = "red";
				}
				else if (oldVal === "hello") {
					target.style.color = "black";
				}

				return newVal;
			})))
		('/span')
		('br /')
		('br /')
		('span')
			(text(store.obs('list', function (newVal, oldVal, target) {
				return oldVal + " -> " + newVal;
			})))
		('/span')
		('br /')
		('br /')
		('div')
			(repeat(store.obs('list'), function (item, idx) {
				return htmler()
				('div')
					('span')(text(item.label + " "))('/span')
					('span')(text(obs(item, 'value')))('/span')
					('br /')
				('/div')
			}))
		('/div')
		('br /')
		('br /')
		('button', {onclick: function (e) { store.list.splice(store.list.length / 2, 1); }})
			(text('pop'))
		('/button')
		('button', {onclick: function (e) { shuffle(store.list); }})
			(text('shuffle'))
		('/button')
		('button', {onclick: function (e) { store.list.forEach(function (i) { i.value++; }); }})
			(text('increment'))
		('/button')
		('button', {onclick: function (e) { store.list = store.list.filter(function (i) { return i.value > 2; }); }})
			(text('filter'))
		('/button')
	('/div')

	document.body.appendChild(stuff);

	window.setInterval(function () {
		store.counter++;
	}, 100);
}