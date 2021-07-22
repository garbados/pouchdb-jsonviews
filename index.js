/* istanbul ignore next */
function interpretAccessPattern (doc, pattern) {
  let value = doc
  if (typeof pattern === 'string') {
    const access = pattern.split(/(?<!\\)\./)
    for (let prop of access) {
      prop = prop.replaceAll(/\\\./ig, '.')
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
  return pattern.splay ? { _splay: true, value } : value
}

/* istanbul ignore next */
function getRowsFromPatterns (interpret, patterns) {
  let rows = []
  // get key and value
  const value = patterns.value ? interpret(patterns.value) : undefined
  let key
  if (!Array.isArray(patterns.key)) {
    key = interpret(patterns.key)
  } else {
    key = patterns.key.map(interpret)
  }
  // handle splay, rotating rows matrix as necessary
  if (!key || typeof key === 'string') {
    rows.push({ key, value })
  } else if (key._splay) {
    for (const k of key.value) {
      rows.push({ key: k, value })
    }
  } else {
    // TODO key array with potentially many splay
  }
  // splay value
  if (value && value._splay) {
    rows = rows.map((row) => {
      return value.map((v) => {
        return { key: row.key, value: v }
      })
    }).reduce((a, b) => {
      return a.concat(b)
    })
  }
  return rows
}

function interpretJsonView (jsonview) {
  const map = `
function (doc) {
  // setup
  ${interpretAccessPattern.toString()}
  ${getRowsFromPatterns.toString()}
  const interpret = interpretAccessPattern.bind(null, doc)
  const patterns = ${JSON.stringify(jsonview.map)}
  const rows = getRowsFromPatterns(interpret, patterns)
  // emit rows
  for (const row of rows) {
    emit(row.key, row.value)
  }
}
  `
  return { map, reduce: jsonview.reduce }
}

async function getOrInitDesignDoc (ddocName) {
  let doc
  try {
    doc = await this.get(`_design/${ddocName}`)
  } catch (error) {
    if (error.message === 'missing') {
      doc = { _id: `_design/${ddocName}`, views: {} }
    } else {
      /* istanbul ignore next */
      throw error
    }
  }
  return doc
}

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

async function putJsonView (ddocName, viewName, jsonview) {
  const view = interpretJsonView(jsonview)
  const doc = await getOrInitDesignDoc.call(this, ddocName)
  doc.views[viewName] = view
  return this.put(doc)
}

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
