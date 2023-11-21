/* istanbul ignore next */ // because you can't run coverage code through eval
function transformValue (pattern, value) {
  // setup dates for datetime utils
  var datetime, dateparts, date, time, year, month, day, hour, minute, second, millisecond
  try {
    var rawDate = new Date(value)
    datetime = rawDate.toISOString()
    dateparts = datetime.split('T')
    date = dateparts[0].split('-')
    time = dateparts[1].split(':')
    year = date[0]
    month = date[1]
    day = date[2]
    hour = time[0]
    minute = time[1]
    second = time[2].split('.').slice(0, -1)
    millisecond = second[1]
    second = second[0]
    time = [hour, minute, second, millisecond]
    datetime = date.concat(time)
  } catch (error) { /* who would catch it? */ }
  // switch on transform value
  switch (pattern.transform) {
    case 'date':
      value = date
      break
    case 'year':
      value = year
      break
    case 'month':
      value = month
      break
    case 'year-month':
      value = [year, month]
      break
    case 'day':
      value = day
      break
    case 'time':
      value = time
      break
    case 'hour':
      value = hour
      break
    case 'minute':
      value = hour
      break
    case 'datetime':
      value = datetime
      break
    case 'words':
      value = value.match(/[\w'-]+/ig)
                   .map(function (x) { return x.toLowerCase() })
      break
  }
  if (pattern.splay || pattern.emit || pattern.flatten) {
    var result = { value: value }
    if (pattern.splay) { result._splay = true }
    if (pattern.emit) {
      if (pattern.equals !== undefined) { value = value === pattern.equals }
      result._emit = pattern.invert ? !value : !!value
    }
    if (pattern.flatten && value && value.length) {
      result._flatten = true
    }
    return result
  } else {
    return value
  }
}

/* istanbul ignore next */ // because you can't run coverage code through eval
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
    value = transformValue(pattern, value)
  }
  return value
}

/* istanbul ignore next */ // because you can't run coverage code through eval
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
    // first, check for non-emitting keys, which may preclude further action
    var shouldEmit = true
    var j = key.length
    for (var i = 0; i < j; i++) {
      var subkey = key[i]
      if (subkey) {
        if (subkey._emit === false) {
          // do not emit any rows for this document if this value is false
          shouldEmit = false
          break
        } else if (subkey._emit === true) {
          // do not emit this value even if rows should be generated
          delete key[i]
          j--
          i--
        }
      }
    }
    // now construct the key
    if (shouldEmit) {
      rows.push({ key: [], value: value }) // initial row
      key.forEach(function (subkey) {
        if (subkey && subkey._splay) {
          // multiply rows by new key
          rows = rows.map(function (row) {
            return subkey.value.map(function (subsubkey) {
              var newKey = row.key.concat(subsubkey)
              return { key: newKey, value: row.value }
            })
          }).reduce(function (a, b) {
            return a.concat(b)
          })
        } else if (subkey && subkey._flatten) {
          // unwrap array into keys of each row
          rows.forEach(function (row) {
            subkey.value.forEach(function (subsubkey) {
              row.key.push(subsubkey)
            })
          })
        } else {
          // add key to existing rows
          rows.forEach(function (row) {
            row.key.push(subkey)
          })
        }
      })
    }
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
  ${transformValue.toString()}
  ${interpretAccessPattern.toString()}
  ${getRowsFromPatterns.toString()}
  var interpret = interpretAccessPattern.bind(null, doc)
  var patterns = ${JSON.stringify(jsonview.map)}
  var rows = getRowsFromPatterns(interpret, patterns)
  // emit rows
  rows.forEach(function (row) { emit(row.key, row.value) })
}`
  return { map, reduce: jsonview.reduce }
}

module.exports = {
  transformValue,
  interpretAccessPattern,
  getRowsFromPatterns,
  interpretJsonView
}
