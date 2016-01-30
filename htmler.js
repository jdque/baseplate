(function (target) {
	function Htmler(tag, attrs) {
		if (!this.initialized) {
			this.selfFunc = Htmler.bind(this);
			this.elemStack = [];
			this.initialized = true;
			return this.selfFunc;
		}

		if (typeof tag === 'function') {
			tag(this.getCurrentElem());
			return this.selfFunc;
		}

		if (tag.indexOf("/") === 0) {
			if (this.elemStack.length === 0) {
				return null;
			}
			else if (this.elemStack.length === 1) {
				return this.elemStack[0];
			}
			else {
				this.elemStack.pop();
				return this.selfFunc;
			}
		}
		else if (tag.indexOf("/") === tag.length - 1) {
			var newElem = document.createElement(tag.replace(/\s/g, '').replace(/\//g, ''));
			this.applyAttrs(newElem, attrs);
			if (this.elemStack.length > 0) {
				this.getCurrentElem().appendChild(newElem);
			}
		}
		else {
			if (tag === 'text') {
				this.getCurrentElem().innerText = typeof attrs === 'function' ? attrs() : attrs;
				return this.selfFunc;
			}

			var newElem = document.createElement(tag.replace(/\s/g, ''));

			this.applyAttrs(newElem, attrs);

			if (this.elemStack.length > 0) {
				this.getCurrentElem().appendChild(newElem);
			}
			this.elemStack.push(newElem);
		}

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

	function htmler(tag, attrs) {
		return new Htmler();
	}

	function custom (buildFunc) {
		return function (parent) {
			parent.appendChild(buildFunc());
		};
	}

	function repeat (list, buildFunc) {
		return function (parent) {
			list.forEach(function (item) {
				parent.appendChild(buildFunc(item));
			});
		};
	}

	target.htmler = htmler;
	target.custom = custom;
	target.repeat = repeat;
})(window);

window.onload = function () {
	var data = {
		name: 'Joe',
		partner: 'Jane'
	};

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
		container: {'background-color': '#FF0000', 'width': '320px', 'height': '320px'},
		child: {'background-color': '#0000FF', 'width': '64px', 'height': '64px'},
		bold: {'font-weight': 'bold'}
	};

	var stuff = htmler()
	('div', {id: 'container1', style: styles.container})
		('div', {style: styles.child})
		('/div')
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
			(repeat(list, function (item) {
				return htmler()
				('li', {style: styles.bold})
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
	('/div')

	document.body.appendChild(stuff);
}