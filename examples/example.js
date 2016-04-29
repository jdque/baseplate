window.onload = function () {
	var htmler = Htmler.htmler,
		custom = Htmler.custom,
		promise = Htmler.promise,
		text = Htmler.text,
		repeat = Htmler.repeat,
		make_store = Htmler.make_store,
		obs = Htmler.obs;

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
	('div', {style: [styles.child, {'background-color': 'red'}],
		onclick: function (e) { boxStore.element = box2; }
	})
	('/div')

	var box2 = htmler()
	('div', {style: [styles.child, {'background-color': 'green'}],
		onclick: function (e) { boxStore.element = box1; }
	})
	('/div')

	var boxStore = make_store({
		element: box1
	});

	var stuff = htmler()
	('div', {id: 'container1', style: styles.container})
		('div')
			(text(data.name))
		('/div')
		('div')
			(text(data.partner))
		('/div')
		('ul')
			(repeat(function (item, idx) {
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
			}), {data: store.list})
		('/ul')
		(custom(function () {
			var z = document.createElement('div');
			z.style.width = '64px';
			z.style.height = '64px';
			z.style.backgroundColor = 'green';
			return z;
		}))
		('br /')
		(promise(function (done) {
			window.setTimeout(function () {
				done(box);
			}, 2000);
		}))
		('br /')
		(custom(obs(boxStore, 'element')))
		('br /')
		('div', {style: {'font-size': '32px'}})
			(text(obs(store, 'counter')))
		('/div')
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
		('div')
			(text(obs(store, 'inputValue', function (newVal, oldVal, target) {
				if (newVal === "hello") {
					target.parentNode.style.color = "red";
				}
				else if (oldVal === "hello") {
					target.parentNode.style.color = "black";
				}

				return newVal;
			})))
		('/div')
		('br /')
		('div')
			(text(obs(store, 'list', function (newVal, oldVal, target) {
				return oldVal + " -> " + newVal;
			})))
		('/div')
		('br /')
		('div')
			(text("HEADER"))
			(repeat(function (item, idx) {
				return htmler()
				('div')
					(text(obs(item, 'label')))
					(text(' '))
					(text(obs(item, 'value')))
					('br /')
				('/div')
			}), {data: obs(store, 'list')})
			(text("-----------"))
			(repeat(function (item, idx) {
				return htmler()
				('div')
					(text(obs(item, 'label')))
					(text(' '))
					(text(obs(item, 'value')))
					('br /')
				('/div')
			}), {data: obs(store, 'list')})
			(text("FOOTER"))
		('/div')
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

	/*window.setInterval(function () {
		store.counter++;
	}, 100);*/
}