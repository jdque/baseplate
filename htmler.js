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
				for (var i = 0; i < observer.store[observer.prop].length; i++) {
					target.appendChild(observer.buildFunc(observer.store[observer.prop][i], i));
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
			for (var j = 0 ; j < stores[i].propObservers.length; j++) {
				var ref = stores[i].propObservers[j];
				var currentVal = stores[i][ref.prop];
				if (currentVal !== ref.val) {
					if (ref.func) {
						ref.target.textContent = ref.func(currentVal, ref.val, ref.target);
					}
					else {
						ref.target.textContent = currentVal;
					}
					ref.val = currentVal;
				}
			}

			for (var j = 0 ; j < stores[i].listObservers.length; j++) {
				var ref = stores[i].listObservers[j];
				var list = stores[i][ref.prop];
				var differs = false;

				for (var k = 0; k < list.length; k++) {
					if (k === ref.childIds.length) {
						differs = true;
						break;
					}
					if (list[k].uniqueId !== ref.childIds[k]) {
						differs = true;
						break;
					}
				}

				if (ref.listId !== list.uniqueId) {
					ref.listId = list.uniqueId;
					differs = true;
				}

				if (differs) {
					while (ref.target.firstChild) {
						ref.target.removeChild(ref.target.firstChild);
					}

					var childIds = [];
					for (var k = 0; k < list.length; k++) {
						childIds.push(list[k].uniqueId);
						ref.target.appendChild(ref.buildFunc(list[k], k));
					}
					ref.childIds = childIds;
				}
			}
		}

		for (var i = 0 ; i < propObservers.length; i++) {
			var ref = propObservers[i];
			var currentVal = ref.obj[ref.prop];
			if (currentVal !== ref.val) {
				if (ref.func) {
					ref.target.textContent = ref.func(currentVal, ref.val, ref.target);
				}
				else {
					ref.target.textContent = currentVal;
				}
				ref.val = currentVal;
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
		this.propObservers = [];
		this.listObservers = [];
		for (key in obj) {
			this.bindProp(key);
		}
	}

	Store.prototype.bindProp = function (name) {
		Object.defineProperty(this, name, {
			set: function (val) {
				this.obj[name] = val;
			},
			get: function () {
				return this.obj[name];
			}
		});
	}

	Store.prototype.obs = function (prop, _func) {
		_func = typeof _func === 'function' ? _func : null;
		return function (target) {
			if (this[prop] instanceof Array) {
				var list = this[prop];
				var childIds = [];
				for (var i = 0; i < list.length; i++) {
					childIds.push(list[i].uniqueId);
				}
				var observer = {prop: prop, listId: this[prop].uniqueId, childIds: childIds, target: target, func: _func, store: this};
				this.listObservers.push(observer);
				return observer;
			}
			else {
				var observer = {prop: prop, val: this[prop], target: target, func: _func, store: this};
				this.propObservers.push(observer);
				return this[prop];
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
			('text', store.obs('value', function (newVal, oldVal, target) {
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