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

	function custom (buildFunc) {
		return function (parent) {
			parent.appendChild(buildFunc());
		};
	}

	function promise (buildFunc) {
		return function (parent) {
			var placeholderElement = document.createElement('_placeholder');
			parent.appendChild(placeholderElement);

			var doneFunc = function (element) {
				parent.replaceChild(element, placeholderElement);
			};
			buildFunc(doneFunc);
		}
	}

	function repeat (list, buildFunc) {
		return function (parent) {
			for (var i = 0; i < list.length; i++) {
				parent.appendChild(buildFunc(list[i], i));
			}
		};
	}

	var isObserving = false;
	var propObservers = [];
	var listObservers = [];
	var updateObservers = function () {
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

		for (var i = 0 ; i < listObservers.length; i++) {
			var ref = listObservers[i];
			if (ref.list.length > ref.count) {
				for (var j = ref.count; j < ref.list.length; j++) {
					ref.target.appendChild(ref.buildFunc(ref.list[j], j));
				}
			}
			else if (ref.list.length < ref.count) {
				for (var j = ref.count; j > ref.list.length; j--) {
					ref.target.removeChild(ref.target.lastChild);
				}
			}
			ref.count = ref.list.length;
		}

		window.requestAnimationFrame(updateObservers);
	}

	function obs (obj, prop, _func) {
		_func = typeof _func === 'function' ? _func : null;
		return function (target) {
			propObservers.push({obj: obj, prop: prop, val: obj.prop, target: target, func: _func});
			return obj.prop;
		}
	}

	function repeat_obs (list, buildFunc) {
		return function (target) {
			listObservers.push({list: list, count: list.length, target: target, buildFunc: buildFunc});
			for (var i = 0; i < list.length; i++) {
				target.appendChild(buildFunc(list[i], i));
			}
		}
	}

	target.htmler = htmler;
	target.custom = custom;
	target.promise = promise;
	target.repeat = repeat;
	target.obs = obs;
	target.repeat_obs = repeat_obs;
})(window);

window.onload = function () {
	var data = {
		name: 'Joe',
		partner: 'Jane'
	};

	var counter = {
		value: 0
	};

	var input = {
		value: ""
	};

	var inputList = ["first", "second"];

	var list = [
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
	];

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
			(repeat(list, function (item, idx) {
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
			('text', obs(counter, 'value'))
		('/span')
		('br /')
		('br /')
		('input', {
			onkeyup: function (ev) {
				input.value = ev.target.value;
				if (ev.keyCode === 13) {
					inputList.push(ev.target.value);
					input.value = "";
					ev.target.value = "";
				}
			},
			onkeydown: function (ev) {
				input.value = ev.target.value;
			}
		})
		('br /')
		('br /')
		('span')
			('text', obs(input, 'value', function (newVal, oldVal, target) {
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
			(repeat_obs(inputList, function (item, idx) {
				return htmler()
				('div')
					('text', item)
					('br /')
				('/div')
			}))
		('/div')
		('br /')
		('br /')
		('button', {onclick: function (e) { inputList.pop(); }})
			('text', 'pop')
		('/button')
	('/div')

	document.body.appendChild(stuff);

	window.setInterval(function () {
		counter.value++;
	}, 100);
}