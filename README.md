# Baseplate

Baseplate is a lightweight framework for developing dynamic web applications in the browser. It comes with 1) a syntax for defining DOM components in Javascript, and 2) observable values/collections that can be bound to DOM properties.

## Installation

```
npm install
npm run build
```

## Components

Baseplate allows you to do HTML-in-Javascript, similar to JSX and hyperscript. The difference here is the use of chained higher order functions, which basically means the code closely resembles regular HTML syntax:

##### HTML
```html
<div>
    <ul style="background-color: white">
        <li>one</li>
        <li>two</li>
        <li>three</li>
    </ul>
    <button onclick="handleClick">
        Click me
    </button>
</div>
```

##### Javascript (using Baseplate)
```javascript
var element = Baseplate.html()
('div')
    ('ul', {style: {backgroundColor: 'white'}})
        ('li')(['one'])('/li')
        ('li')(['two'])('/li')
        ('li')(['three'])('/li')
    ('/ul')
    ('button', {onclick: (e) => console.log('clicked'))
        (['Click me'])
    ('/button')
('/div')

document.body.appendChild(element)
```

Elements are represented as function invocations, using the syntax: ([tag name], [properties]). The properties argument is an object literal with the syntax: {attributes: {...}, style: {...}, ...}. The key names correspond with the DOM API's element attributes, CSS styles, event handlers, etc.

Alternatively, the first argument can be an Element object:

```javascript
var childElement = Baseplate.html()
('span')
    (['Child'])
('/span')

Baseplate.html()
('div')
    (childElement)
('/div')
```

This pattern can be used to define components simply as functions:

```javascript
var Component = function (text) {
    return Baseplate.html()
    ('span')
        ([text])
    ('/span')
}

Baseplate.html()
('div')
    (Component('Child 1'))
    (Component('Child 2'))
('/div')
```

In addition, there are a couple built-in convenience constructs. For example, Baseplate.repeat() can be used to build a list of elements from an array of data:

```javascript
var myData = [1, 2, 3]

Baseplate.html()
('div')
    (Baseplate.repeat((item) => {
        return Baseplate.html()
        ('span')([item])('/span')
    }), {data: myData})
('/div')

/*
<div>
    <span>1</span>
    <span>2</span>
    <span>3</span>
</div>
*/
```

## Observables

Under construction