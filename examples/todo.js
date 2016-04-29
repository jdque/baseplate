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

        return bp.htmler()
        ('div')
            ('input', {type: 'checkbox', checked: bp.obs(item, 'done'), onchange: checkboxChanged, style: styles.todo})
            ('p', {class: 'title', onclick: textClicked})(bp.text(bp.obs(item, 'title')))('/p')
        ('/div');
    }

    function appFactory() {
        var inputChanged = function (e) {
            store.inputValue = e.target.value;
        };

        var formSubmitted = function (e) {
            addTodo(false, store.inputValue);
            store.inputValue = "";
            return false;
        };

        var list = bp.htmler()
        ('div', {class: "todos"})
            (bp.repeat(todoItem), {data: bp.obs(store, 'list')})
        ('/div');

        var form = bp.htmler()
        ('form', {onsubmit: formSubmitted})
            ('input', {
                placeholder: 'Something to do',
                value: bp.obs(store, 'inputValue'),
                onchange: inputChanged
            })
            ('button')(bp.text("Add"))('/button')
        ('/form');

        var tree = bp.htmler()
        ('div')
            ('div', {onclick: function () {treeStore.a += 1;}})(bp.text("a: "))(bp.text(bp.obs(treeStore, 'a')))('/div')
            ('div', {onclick: function () {treeStore.b.c += 1;}})(bp.text("b.c: "))(bp.text(bp.obs(treeStore.b, 'c')))('/div')
            ('div', {onclick: function () {treeStore.b.d = {e: treeStore.b.d.e + 1}}})(bp.text("b.d.e: "))(bp.text(bp.obs(treeStore.b.d, 'e')))('/div')
        ('/div')

        return bp.htmler()
        ('div')
            ('h1')(bp.text("Todo"))('/h1')
            (list)
            (form)
            ('button', {onclick: filterDone})(bp.text("Clear done"))('/button')
            ('button', {onclick: function () { store.list[0].title = 'o'; }})(bp.text('Doit'))('/button')
            ('button', {onclick: function () { store.list[0] = {done: false, title: "doodad"}; }})(bp.text('Doit2'))('/button')
            ('button', {onclick: function () {store.list.forEach(function (item) { item.done = !item.done; }); }})(bp.text('Doit3'))('/button')
            ('br /')
            ('br /')
            (tree)
        ('/div');
    }

    document.body.appendChild(appFactory());
}