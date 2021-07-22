/* istanbul ignore next */
function interpretAccessPattern (doc, pattern) {
  var value = doc
  if (typeof pattern === 'string') {
    var access = pattern.split('\\.').join('\uffff').split('.')
    for (var i = 0; i < access.length; i++) {
      var prop = access[i].split('\uffff').join('.')
      value = value[prop]
      if (value === undefined) { break }
    }
  } else {
    value = interpretAccessPattern(doc, pattern.access)
    if (pattern.transform) {
      switch (pattern.transform) {
        case 'date':
          value = new Date(value).toISOString().split('T')[0]
          break
        case 'time':
          value = new Date(value).toISOString().split('T')[1]
          break
        case 'datetime':
          value = new Date(value).toISOString()
          break
      }
    }
  }
  return pattern.splay ? { _splay: true, value: value } : value
}

/* istanbul ignore next */
function getRowsFromPatterns (interpret, patterns) {
  var rows = []
  // get key and value
  var value = patterns.value ? interpret(patterns.value) : undefined
  var key
  if (typeof patterns.key === 'object' && typeof patterns.key.length === 'number') {
    key = patterns.key.map(interpret)
  } else {
    key = interpret(patterns.key)
  }
  // handle splay, rotating rows matrix as necessary
  if (!key || typeof key === 'string') {
    rows.push({ key: key, value: value })
  } else if (key._splay) {
    key.value.forEach(function (subkey) {
      rows.push({ key: subkey, value: value })
    })
  } else {
    // key array with potentially many splay
    rows.push({ key: [], value: value }) // initial row
    key.forEach(function (subkey) {
      if (subkey._splay) {
        // multiply rows by new key
        rows = rows.map(function (row) {
          return subkey.value.map(function (subsubkey) {
            const newKey = row.key.concat(subsubkey)
            return { key: newKey, value: row.value }
          })
        }).reduce(function (a, b) {
          return a.concat(b)
        })
      } else {
        // add key to existing rows
        rows = rows.map(function (row) {
          row.key.push(subkey)
          return row
        })
      }
    })
  }
  // splay value
  if (value && value._splay) {
    rows = rows.map(function (row) {
      return value.value.map(function (subvalue) {
        return { key: row.key, value: subvalue }
      })
    }).reduce(function (a, b) {
      return a.concat(b)
    })
  }
  return rows
}

// construct a javascript view from a jsonview
function interpretJsonView (jsonview) {
  // template the js view using our helpers
  const map = `function (doc) {
  // setup
  ${interpretAccessPattern.toString()}
  ${getRowsFromPatterns.toString()}
  const interpret = interpretAccessPattern.bind(null, doc)
  const patterns = ${JSON.stringify(jsonview.map)}
  const rows = getRowsFromPatterns(interpret, patterns)
  // emit rows
  rows.forEach(function (row) { emit(row.key, row.value) })
}`
  return { map, reduce: jsonview.reduce }
}

// retrieve a design document or construct a bare one for use
async function getOrInitDesignDoc (ddocName) {
  let doc
  try {
    doc = await this.get(`_design/${ddocName}`)
  } catch (error) {
    // ignore error handling so coverage doesn't complain about unexpected errors
    /* istanbul ignore next */
    if (error.message === 'missing') {
      doc = { _id: `_design/${ddocName}`, views: {} }
    } else {
      throw error
    }
  }
  return doc
}

// interpret a jsonview to add a view to a design doc, creating it if necessary.
// will fail if a view already exists by the given name.
async function addJsonView (ddocName, viewName, jsonview) {
  const view = interpretJsonView(jsonview)
  const doc = await getOrInitDesignDoc.call(this, ddocName)
  if (viewName in doc.views) {
    throw new Error(`View '${viewName}' already exists on ddoc '_design/${ddocName}'`)
  } else {
    doc.views[viewName] = view
    return this.put(doc)
  }
}

// interpret a jsonview to add a view to a design doc, creating it if necessary.
// if a view already exists by the given name, it will be overwritten.
async function putJsonView (ddocName, viewName, jsonview) {
  const view = interpretJsonView(jsonview)
  const doc = await getOrInitDesignDoc.call(this, ddocName)
  doc.views[viewName] = view
  return this.put(doc)
}

// remove a view by name from a design doc.
// will fail if no view exists with that name.
async function removeView (ddocName, viewName) {
  const doc = await getOrInitDesignDoc.call(this, ddocName)
  if (viewName in doc.views) {
    delete doc.views[viewName]
    return this.put(doc)
  } else {
    throw new Error(`No view '${viewName}' to remove on ddoc '_design/${ddocName}'`)
  }
}

module.exports = {
  interpretJsonView,
  addJsonView,
  putJsonView,
  removeView
}
