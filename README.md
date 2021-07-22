# PouchDB-JsonViews

A plugin that adds a JSON-based map/reduce view interface to PouchDB. *It does not work with CouchDB.* But you may still find it useful.

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
      { prop: 'created_at', transform: 'date' },
      'username',
      { prop: 'created_at', transform: 'time' }
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

If you do your PouchDB indexing on client devices -- that is, the browser and browser-likes such as Electron -- this plugin matters to you.

For example, it might be that in your application architecture, a user's device is the canonical location of a user's data. This would be sensible, no? So you want to instrument backup servers, where users can maintain encrypted backups of application data. You can do this with CouchDB and its authn/authz capabilities very easily, without using any of its indexing capabilities. In this architecture, indexing occurs only on user devices *-- in PouchDB!*

Thus it makes sense to have an indexing interface that is straightforward and efficient, which makes the most out of PouchDB's map/reduce indexing strategy and query language.

Although Mango is a powerful query language in its own right -- and PouchDB-JsonViews is not intended as a competitor or replacement! -- it does not allow you to use a reduce function. This forces certain classes of queries to occur in-memory, on-demand, page by page, which is simply not tenable for certain scales of data.

However, the alternative of writing JavaScript views lends itself to the worse of our tendencies as programmers: to inefficient mutations of data that are impossible to examine or debug. I'm saying it: anything resembling business logic should not live that deep in a database.

Most of the time, a view just emits a certain number of keys and a value, and maybe specifies a reduce function. PouchDB-JsonViews uses a simple access syntax to specify document attributes for keys and values, and exposes a small number of *transforms* which convert a value in some way (such as generating a time or date string from a timestamp, with `date` and `time`). In this way, much as Mango simplifies queries with selectors, this plugin does the same with what it calls *JsonViews*.

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

This plugin adds three methods:

- `.putJsonView(ddocName, viewName, jsonview)`
- `.addJsonView(ddocName, viewName, jsonview)`
- `.removeView(ddocName, viewName)`.

These common parameters are defined as such:

- `ddocName`: The part of a design document's `_id` that follows `_design/`.
For example, the ddocName of `_design/hello-world` is `hello-world`.
- `viewName`: The name of a view.
- `jsonview`: An object describing a JsonView, which this plugin can compile to a JavaScript view for the purpose of querying. See **Usage, JsonViews** for more information.

### db.putJsonView(ddocName, viewName, jsonview)

Compiles a JsonView to a JavaScript view and adds it to a design document, creating that document if necessary. *If a view already exists by this name, the view will be overwritten.*

Returns as though you had run [`db.put()`](https://pouchdb.com/api.html#create_document).

### db.addJsonView(ddocName, viewName, jsonview)

Compiles a JsonView to a JavaScript view and adds it to a design document, creating that document if necessary. *If a view already exists by this name, the method will throw an error.*

Returns as though you had run [`db.put()`](https://pouchdb.com/api.html#create_document).

### db.removeView(ddocName, viewName)

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

- `prop`: A string access parameter, such as `'foo'` or `'foo.bar'`.
- `transform`: The string name of a *transform* helper, such as `date` or `time` or `splay`.

These are the currently available transforms:

- `date`: Converts a Unix timestamp or other `Date` initialization parameter(s) into a string date of the form 'YYYY-MM-DD'.
- `date-splay`: Converts a Unix timestamp or other `Date` initialization parameter(s) into an array of date indicators such as year and month, and appends them to the row's keys. For example: `['key1', 'key2', 'year', 'month', 'date']`.
- `time`: Converts a Unix timestamp or other `Date` initialization parameter(s) into a string time of the form 'HH:MM:SS.ms'.
- `time-splay`: Converts a Unix timestamp or other `Date` initialization parameter(s) into an array of time indicators such as year and month, and appends them to the row's keys. For example: `['key1', 'key2', 'hour', 'minute', 'second', 'millisecond']`.
- `datetime`: Converts a Unix timestamp or other `Date` initialization parameter(s) into a string datetime of the form 'YYYY-MM-DDTHH:MM:SS.ms'.
- `datetime-splay`: Converts a Unix timestamp or other `Date` initialization parameter(s) into an array of datetime indicators such as year and month, and appends them to the row's keys. For example: `['key1', 'key2', 'year', 'month', 'date', 'hour', 'minute', 'second', 'millisecond']`.
- `splay`: When used with an array, emits one row per entry in the array. Otherwise, the whole array is emitted in just one row. For example, for a news website, you might emit one row per tag per article, rather than emitting the whole list of tags in one row per article.

## Development

If you encounter a bug or would like to request a feature, please [file an issue](https://github.com/garbados/pouchdb-jsonviews/issues)!

*If you are submitting a patch, please be a good neighbor and include tests!*

To hack on this project locally, first get its source and install its dependencies:

```bash
$ git clone TODO
$ cd pouchdb-jsonviews
$ npm i
```

Then you can run the test suite:

```bash
$ npm test
```

## License

[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)
