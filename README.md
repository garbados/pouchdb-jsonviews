# PouchDB-JsonViews

[![CI](https://github.com/garbados/pouchdb-jsonviews/actions/workflows/ci.yaml/badge.svg)](https://github.com/garbados/pouchdb-jsonviews/actions/workflows/ci.yaml)
[![Coverage Status](https://coveralls.io/repos/github/garbados/pouchdb-jsonviews/badge.svg?branch=master)](https://coveralls.io/github/garbados/pouchdb-jsonviews?branch=master)
[![Stability](https://img.shields.io/badge/stability-stable-green.svg?style=flat-square)](https://nodejs.org/api/documentation.html#documentation_stability_index)
[![NPM Version](https://img.shields.io/npm/v/pouchdb-jsonviews.svg?style=flat-square)](https://www.npmjs.com/package/pouchdb-jsonviews)
[![JS Standard Style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/feross/standard)

A plugin that adds a JSON-based map/reduce view interface to PouchDB and CouchDB.

Here is an example:

```javascript
const PouchDB = require('pouchdb')
PouchDB.plugin(require('pouchdb-jsonviews'))

const db = new PouchDB('your_cool_project')

// add a jsonview with this convenience method.
// it just creates a design doc: `_design/my_doc_name`.
// and in it, creates a view: `my_view_name`.
// the map function is templated using the jsonview.
await db.addJsonView('my_doc_name', 'my_view_name', {
  map: {
    key: [
      // [date, username, time] for a daily digest timeline
      { access: 'created_at', transform: 'date' },
      'username',
      { access: 'created_at', transform: 'time' }
    ],
    value: 'status'
  },
  reduce: '_count'
})

// then you can just query it like any other view!
const { rows } = await db.query('my_doc_name/my_view_name', {
  group: true,
  group_level: 2
})
console.log(rows)
> {
>   "rows": [
>     {
>       "key": ['YYYY-MM-DD', 'garbados'],
>       "value": 12
>     },
>     ...
>   ]
> }
```

## Why?

Although Mango is a powerful query language in its own right -- and PouchDB-JsonViews is not intended as a competitor or replacement! -- it does not allow you to use a reduce function. This forces certain classes of queries to occur in-memory, on-demand, page by page, which is simply not tenable for certain scales of data.

However, the alternative of writing JavaScript views lends itself to the worse of our tendencies as programmers: to inefficient mutations of data that are impossible to examine or debug. These can create showstopping problems as datasets scale, as the size of indices may explode out of control due to errors and oversights. It is unwise to permit ourselves so much room for failure, grateful for it though we may be from time to time.

Usually, a view just emits a certain number of keys and a value, and maybe specifies a reduce function. PouchDB-JsonViews uses a simple access syntax to specify document attributes for keys and values, and exposes a small number of *transforms* which convert a value in some way (such as generating a time or date string from a timestamp, with `date` and `time`). In this way, much as Mango simplifies queries with selectors, this plugin does the same with what it calls *JsonViews*.

## Install

Install this plugin in your JavaScript project with NPM:

```bash
$ npm i pouchdb-jsonviews
```

Then attach it to PouchDB like so:

```javascript
const PouchDB = require('pouchdb')
PouchDB.plugin(require('pouchdb-jsonviews'))
```

## Usage, API

This plugin adds four methods to PouchDB instances:

- `.interpretJsonView(jsonview)`
- `.addJsonView(ddocName, viewName, jsonview)`
- `.putJsonView(ddocName, viewName, jsonview)`
- `.removeView(ddocName, viewName)`.

These common parameters are defined as such:

- `ddocName`: The part of a design document's `_id` that follows `_design/`.
For example, the ddocName of `_design/hello-world` is `hello-world`.
- `viewName`: The name of a view.
- `jsonview`: An object describing a JsonView, which this plugin can compile to a JavaScript view for the purpose of querying. See **Usage, JsonViews** for more information.

### db.interpretJsonView(jsonview)

A convenience method that returns the JavaScript view compiled from a given jsonview.
Used internally, but might be of interest to the curious user.

Does not modify the database!

### async db.addJsonView(ddocName, viewName, jsonview)

Compiles a JsonView to a JavaScript view and adds it to a design document, creating that document if necessary. *If a view already exists by this name, the method will throw an error.*

Returns as though you had run [`db.put()`](https://pouchdb.com/api.html#create_document).

### async db.putJsonView(ddocName, viewName, jsonview)

Compiles a JsonView to a JavaScript view and adds it to a design document, creating that document if necessary. *If a view already exists by this name, the view will be overwritten.*

Returns as though you had run [`db.put()`](https://pouchdb.com/api.html#create_document).

### async db.removeView(ddocName, viewName)

Removes a view from a design document.

Returns as though you had run [`db.put()`](https://pouchdb.com/api.html#create_document).

## Usage, JsonViews

A JsonView is a JavaScript object with two properties:

- `map`: A description of the map function to use.
- `map.key`: An access parameter or an array of access parameters, which are interpreted and emitted as a key or keys.
- `map.value`: An access parameter, which is interpreted and emitted as a value.

An *access parameter* is a string or object that describes how to access and interpret a property on a document. In its simplest form, it is the string value of that property's key. The access parameter to access `doc.foo` would be `'foo'`.

You can access nested properties using dots as separators. For example, you can access `doc.foo.bar` with `'foo.bar'`.

An access parameter may also be an object. In its object form, it may have these properties:

- `access`: A string access parameter, such as `'foo'` or `'foo.bar'`.
- `transform`: The string name of a *transform* helper, such as `date` or `time`.
- `splay`: When used with an array, emits one row per entry in the array. Otherwise, the whole array is emitted in just one row. For example, for a news website, you might emit one row per tag per article, rather than emitting the whole list of tags in one row per article.

These are the currently available transforms:

- `date`: Converts a Unix timestamp or other `Date` initialization parameter(s) into a string date of the form 'YYYY-MM-DD'.
- `time`: Converts a Unix timestamp or other `Date` initialization parameter(s) into a string time of the form 'HH:MM:SS.ms'.
- `datetime`: Converts a Unix timestamp or other `Date` initialization parameter(s) into a string datetime of the form 'YYYY-MM-DDTHH:MM:SS.ms'.

## Development

If you encounter a bug or would like to request a feature, please [file an issue](https://github.com/garbados/pouchdb-jsonviews/issues)!

*If you are submitting a patch, please be a good neighbor and include tests!*

To hack on this project locally, first get its source and install its dependencies:

```bash
$ git clone git@github.com:garbados/pouchdb-jsonviews.git
$ cd pouchdb-jsonviews
$ npm i
```

Then you can run the test suite:

```bash
$ npm test
```

## License

[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)
