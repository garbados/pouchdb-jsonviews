const { interpretJsonView } = require('./lib')

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

// convenience method for adding javascript views
// will fail if a view already exists by the given name.
async function addView (ddocName, viewName, view) {
  const doc = await getOrInitDesignDoc.call(this, ddocName)
  if (viewName in doc.views) {
    throw new Error(`View '${viewName}' already exists on ddoc '_design/${ddocName}'`)
  } else {
    doc.views[viewName] = view
    return this.put(doc)
  }
}

// convenience method for putting javascript views
// if a view already exists by the given name, it will be overwritten.
async function putView (ddocName, viewName, view) {
  const doc = await getOrInitDesignDoc.call(this, ddocName)
  const oldView = doc.views[viewName]
  if (JSON.stringify(oldView) !== JSON.stringify(view)) {
    doc.views[viewName] = view
    return this.put(doc)
  }
}

// interpret a jsonview to add a view to a design doc, creating it if necessary.
// will fail if a view already exists by the given name.
async function addJsonView (ddocName, viewName, jsonview) {
  const view = interpretJsonView(jsonview)
  return addView.call(this, ddocName, viewName, view)
}

// interpret a jsonview to add a view to a design doc, creating it if necessary.
// if a view already exists by the given name, it will be overwritten.
async function putJsonView (ddocName, viewName, jsonview) {
  const view = interpretJsonView(jsonview)
  return putView.call(this, ddocName, viewName, view)
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
  addView,
  putView,
  addJsonView,
  putJsonView,
  removeView
}
