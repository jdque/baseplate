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

		//text node
		if (tag === 'text') {
			this.getCurrentElem().textContent = typeof attrs === 'function' ? attrs(this.getCurrentElem()) : attrs;
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

	function custom(buildFunc) {
		return function (parent) {
			parent.appendChild(buildFunc());
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

	function repeat(list, buildFunc) {
		return function (target) {
			if (typeof list === 'function') {
				var observer = list(target);
				observer.buildFunc = buildFunc;
				for (var i = 0; i < observer.store[observer.propName].length; i++) {
					target.appendChild(observer.buildFunc(observer.store[observer.propName][i], i));
				}
			}
			else if (list instanceof Array) {
				for (var i = 0; i < list.length; i++) {
					target.appendChild(buildFunc(list[i], i));
				}
			}
		};
	}

	var isObserving = false;
	var propObservers = [];
	var listObservers = [];
	var updateObservers = function () {
		for (var i = 0; i < stores.length; i++) {
			var store = stores[i];

			for (var j = 0; j < store.valueObservers.length; j++) {
				var obs = store.valueObservers[j];
				var currentVal = store[obs.propName];
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

					if (obs.changeFunc) {
						obs.target.textContent = obs.changeFunc(newChildIds.length, obs.childIds.length, obs.target);
					}

					if (obs.buildFunc) {
						while (obs.target.firstChild) {
							obs.target.removeChild(obs.target.firstChild);
						}
						for (var k = 0; k < list.length; k++) {
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
			if (currentVal !== obs.val) {
				if (obs.func) {
					obs.target.textContent = obs.func(currentVal, obs.val, obs.target);
				}
				else {
					obs.target.textContent = currentVal;
				}
				obs.val = currentVal;
			}
		}

		window.requestAnimationFrame(updateObservers);
	}

	function obs(obj, prop, _func) {
		_func = typeof _func === 'function' ? _func : null;
		return function (target) {
			propObservers.push({obj: obj, prop: prop, val: obj.prop, target: target, func: _func});
			return obj.prop;
		}
	}

	function Store(obj) {
		this.obj = obj;
		this.valueObservers = [];
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
		return function (target) {
			if (this[propName] instanceof Array) {
				var list = this[propName];
				var childIds = [];
				for (var i = 0; i < list.length; i++) {
					childIds.push(list[i].uniqueId);
				}
				var observer = {propName: propName, listId: this[propName].uniqueId, childIds: childIds, target: target, changeFunc: _changeFunc, buildFunc: null, store: this};
				this.listObservers.push(observer);
				return observer;
			}
			else {
				var observer = {propName: propName, value: this[propName], target: target, changeFunc: _changeFunc, store: this};
				this.valueObservers.push(observer);
				return this[propName];
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

	var stuff = htmler()
	('div', {id: 'container1', style: styles.container})
		(box)
		('span')
			('text', data.name)
		('/span')
		('br /')
		('br /')
		('span')
			('text', data.partner)
		('/span')
		('br /')
		('br /')
		('ul')
			(repeat(store.list, function (item, idx) {
				var bg = idx % 2 === 0 ? 'grey' : 'white'
				return htmler()
				('li', {style: {'font-weight': 'bold', 'background-color': bg}})
					('span')('text', item.label)('/span')
					('br /')
					('span')
						('text', function () {
							var m  = item.value > 2 ? " < 2" : " >= 2";
							return item.value + m;
						})
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
		('span', {style: {'font-size': '32px'}})
			('text', store.obs('counter'))
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
			('text', store.obs('inputValue', function (newVal, oldVal, target) {
				if (newVal === "hello") {
					target.style.color = "red";
				}
				else if (oldVal === "hello") {
					target.style.color = "black";
				}

				return newVal;
			}))
		('/span')
		('br /')
		('br /')
		('span')
			('text', store.obs('list', function (newVal, oldVal, target) {
				return oldVal + " -> " + newVal;
			}))
		('/span')
		('br /')
		('br /')
		('div')
			(repeat(store.obs('list'), function (item, idx) {
				return htmler()
				('div')
					('span')('text', item.label + " ")('/span')
					('span')('text', obs(item, 'value'))('/span')
					('br /')
				('/div')
			}))
		('/div')
		('br /')
		('br /')
		('button', {onclick: function (e) { store.list.splice(store.list.length / 2, 1); }})
			('text', 'pop')
		('/button')
		('button', {onclick: function (e) { shuffle(store.list); }})
			('text', 'shuffle')
		('/button')
		('button', {onclick: function (e) { store.list.forEach(function (i) { i.value++; }); }})
			('text', 'increment')
		('/button')
		('button', {onclick: function (e) { store.list = store.list.filter(function (i) { return i.value > 2; }); }})
			('text', 'filter')
		('/button')
	('/div')

	document.body.appendChild(stuff);

	window.setInterval(function () {
		store.counter++;
	}, 100);
}