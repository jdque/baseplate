window.onload = function () {
    var bp = Htmler;

    var styles = {
        todo: {
            'float': 'left',
            'margin-right': '.5rem'
        }
    };

    var store = bp.make_store({
        inputValue: "",
        list: [{done: false, title: "First"}]
    });

    var treeStore = bp.make_store({
        a: 1,
        b: {
            c: 2,
            d: {
                e: 3
            }
        }
    });

    var testStore = bp.make_store({
        func: function () { console.log ("A"); },
        style: {'background-color': 'green'},
        classes: ['myclass']
    });

    function addTodo(done, title) {
        store.list.push({
            done: done,
            title: title
        });
    }

    function deleteTodo(todo) {
        store.list.splice(store.list.indexOf(todo), 1);
    }

    function filterDone(e) {
        store.list = store.list.filter(function (item) {
            return !item.done;
        });
    }

    function todoItem(item) {
        var checkboxChanged = function (e) {
            item.done = e.target.checked;
        };
        var textClicked = function (e) {
            deleteTodo(item);
        };

        return bp.html()
        ('div')
            ('input', {type: 'checkbox', checked: bp.obs(item, 'done'), onchange: checkboxChanged, style: styles.todo})
            ('p', {class: 'title', onclick: textClicked})(bp.text(bp.obs(item, 'title')))('/p')
        ('/div');
    }

    var hello = (function () {
        var store = bp.make_store({
            value: 1
        });

        var watch = bp.obs(store, 'value');
        var watch2 = watch.transform((value) => value + " modified");

        return bp.html()
        ('div')
            ('div')([watch])('/div')
            ('div')([watch2])('/div')
            ('button', {onclick: () => store.value++})(['Click me'])('/button')
        ('/div')
    })();

    var stateTest = (function () {
        var machine = bp.make_statemachine({
            'first': function () {
                console.log('first')
            },
            'middle': function () {
                console.log('middle')
            },
            'last': function () {
                console.log('last')
            }
        });

        var html = bp.html()
        ('div')
            (bp.switch({
                'first': bp.html()
                    ('div', {onclick: () => machine.to('middle')})
                        (['First'])
                    ('/div'),
                'middle': bp.html()
                    ('div', {onclick: () => machine.to('last')})
                        (['Middle'])
                    ('/div'),
                'last': bp.html()
                    ('div', {onclick: () => machine.to('first')})
                        (['Last'])
                    ('/div')
            }), {machine: machine})
        ('/div')

        machine.to('first');

        return html;
    })();

    function appFactory() {
        var inputChanged = function (e) {
            store.inputValue = e.target.value;
        };

        var formSubmitted = function (e) {
            addTodo(false, store.inputValue);
            store.inputValue = "";
            return false;
        };

        var list = bp.html()
        ('div', {class: "todos"})
            (bp.repeat(todoItem), {data: bp.obs(store, 'list')})
        ('/div');

        var form = bp.html()
        ('form', {onsubmit: formSubmitted})
            ('input', {
                placeholder: 'Something to do',
                value: bp.obs(store, 'inputValue'),
                onchange: inputChanged
            })
            ('button')(bp.text("Add"))('/button')
        ('/form');

        var tree = bp.html()
        ('div')
            ('div', {onclick: function () {treeStore.a += 1;}})(bp.text("a: "))(bp.text(bp.obs(treeStore, 'a')))('/div')
            ('div', {onclick: function () {treeStore.b.c += 1;}})(bp.text("b.c: "))(bp.text(bp.obs(treeStore.b, 'c')))('/div')
            ('div', {onclick: function () {treeStore.b.d = {e: treeStore.b.d.e + 1}}})(bp.text("b.d.e: "))(bp.text(bp.obs(treeStore.b.d, 'e')))('/div')
        ('/div')

        var test = bp.html()
        ('div')
            ('div', {
                classList: bp.obs(testStore, 'classes'),
                //style: bp.obs(testStore, 'style'),
                onclick: function () {
                    if (testStore.classes.length > 1) testStore.classes.splice(1, 1);
                    else testStore.classes.push('another');
                }})
                (bp.text('hello world'))
            ('/div')
        ('/div')

        return bp.html()
        ('div')
            ('h1')(bp.text("Todo"))('/h1')
            (hello)
            (stateTest)
            (list)
            (form)
            ('button', {onclick: filterDone})(bp.text("Clear done"))('/button')
            ('button', {onclick: function () { store.list[0].title = 'o'; }})(bp.text('Doit'))('/button')
            ('button', {onclick: function () { store.list[0] = {done: false, title: "doodad"}; }})(bp.text('Doit2'))('/button')
            ('button', {onclick: function () { store.list.forEach(function (item) { item.done = !item.done; }); }})(bp.text('Doit3'))('/button')
            ('br /')
            ('br /')
            (tree)
            ('br /')
            ('br /')
            (test)
        ('/div');
    }

    document.body.appendChild(appFactory());
}