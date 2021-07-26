/* global describe, it, beforeEach, afterEach */

const assert = require('assert').strict
const lib = require('./lib')
const PouchDB = require('pouchdb')
PouchDB.plugin(require('.'))

const DB_NAME = 'test_db'
const DDOC_NAME = 'ddoc'
const VIEW_NAME = 'view'

const JSON_VIEW_1 = { map: 'foo', reduce: '_count' }

const targets = [DB_NAME]
if (process.env.COUCH_URL) {
  targets.push(`${process.env.COUCH_URL}/${DB_NAME}`)
}

targets.forEach(test)

function test (dbName) {
  const dbType = /http:\/\//.test(dbName) ? 'http' : 'local'
  describe(dbType, function () {
    this.timeout(1000 * 10) // ten seconds

    beforeEach(function () {
      this.db = new PouchDB(dbName)
    })

    afterEach(function () {
      return this.db.destroy()
    })

    describe('lib', function () {
      // setup doc
      const type = 'entry'
      const title = 'hello world'
      const text = 'how are you'
      const tags = ['a', 'b', 'c']
      const createdAt = Date.now()
      const doc = { type, draft: true, tags, createdAt, title, text }

      describe('transformValue', function () {
        it('should annotate a value with splay', function () {
          const value = lib.transformValue({ splay: true })
          assert.equal(value.value, undefined)
          assert.equal(value._splay, true)
        })
        // TODO additional testing
      })
      describe('interpretAccessPattern', function () {
        it('should interpret emit, equals, inverse patterns correctly', function () {
          // test equals
          let value = lib.interpretAccessPattern(doc, {
            access: 'type',
            emit: true,
            equals: type
          })
          assert.equal(value.value, type)
          assert.equal(value._emit, true)
          value = lib.interpretAccessPattern(doc, {
            access: 'type',
            emit: true,
            equals: type,
            invert: true
          })
          assert.equal(value.value, type)
          assert.equal(value._emit, false)
        })
        // TODO additional testing
      })
      describe('getRowsFromPatterns', function () {
        it('should flatten keys', function () {
          const interpret = lib.interpretAccessPattern.bind(null, doc)
          const rows = lib.getRowsFromPatterns(interpret, {
            key: [
              { access: 'type', emit: true, equals: type },
              { access: 'createdAt', transform: 'date', flatten: true },
              { access: 'tags', splay: true }
            ]
          })
          assert.equal(rows.length, 3)
          rows.forEach((row) => {
            assert.equal(row.key.length, 4)
          })
        })
      })
    })

    describe('api', function () {
      describe('addJsonView', function () {
        it('should add a new view', async function () {
          await this.db.addJsonView(DDOC_NAME, VIEW_NAME, JSON_VIEW_1)
          const doc = await this.db.get(`_design/${DDOC_NAME}`)
          assert(VIEW_NAME in doc.views)
        })
        it('should fail to add a new view if it already exists', async function () {
          await this.db.addJsonView(DDOC_NAME, VIEW_NAME, JSON_VIEW_1)
          try {
            await this.db.addJsonView(DDOC_NAME, VIEW_NAME, JSON_VIEW_1)
            throw new Error('this should never run')
          } catch (error) {
            assert.equal(error.message, `View '${VIEW_NAME}' already exists on ddoc '_design/${DDOC_NAME}'`)
          } finally {
            const doc = await this.db.get(`_design/${DDOC_NAME}`)
            assert(VIEW_NAME in doc.views)
          }
        })
      })
      describe('putJsonView', function () {
        it('should put a new view', async function () {
          await this.db.putJsonView(DDOC_NAME, VIEW_NAME, JSON_VIEW_1)
          const doc = await this.db.get(`_design/${DDOC_NAME}`)
          assert(VIEW_NAME in doc.views)
        })
        it('should put a view, even if it already exists', async function () {
          await this.db.putJsonView(DDOC_NAME, VIEW_NAME, JSON_VIEW_1)
          await this.db.putJsonView(DDOC_NAME, VIEW_NAME, JSON_VIEW_1)
          const doc = await this.db.get(`_design/${DDOC_NAME}`)
          assert(VIEW_NAME in doc.views)
        })
      })
      describe('removeView', function () {
        it('should remove a view by name', async function () {
          await this.db.addJsonView(DDOC_NAME, VIEW_NAME, JSON_VIEW_1)
          await this.db.removeView(DDOC_NAME, VIEW_NAME)
          const doc = await this.db.get(`_design/${DDOC_NAME}`)
          assert(!(VIEW_NAME in doc.views))
        })
        it('should fail to remove a view that does not exist', async function () {
          try {
            await this.db.removeView(DDOC_NAME, VIEW_NAME)
            throw new Error('this should never run')
          } catch (error) {
            assert.equal(error.message, `No view '${VIEW_NAME}' to remove on ddoc '_design/${DDOC_NAME}'`)
          }
        })
      })
    })
    describe('jsonviews', function () {
      describe('access patterns', function () {
        it('should get a document property by name', async function () {
          await this.db.bulkDocs([
            { _id: 'a', foo: 'bar' },
            { _id: 'b', foo: 'baz' },
            { _id: 'c', foo: 'bar' }
          ])
          await this.db.addJsonView(DDOC_NAME, VIEW_NAME, {
            map: { key: 'foo' },
            reduce: '_count'
          })
          const { rows } = await this.db.query(`${DDOC_NAME}/${VIEW_NAME}`, {
            group: true
          })
          assert.equal(rows.length, 2)
          const [doc1, doc2] = rows
          assert.equal(doc1.key, 'bar')
          assert.equal(doc1.value, 2)
          assert.equal(doc2.key, 'baz')
          assert.equal(doc2.value, 1)
        })
        it('should get a nested document property using dot access', async function () {
          await this.db.bulkDocs([
            { _id: 'a', foo: { bar: 'baz' } },
            { _id: 'b', foo: 'fizz' },
            { _id: 'c', foo: 'buzz' }
          ])
          await this.db.addJsonView(DDOC_NAME, VIEW_NAME, {
            map: { key: 'foo.bar' },
            reduce: '_count'
          })
          const { rows } = await this.db.query(`${DDOC_NAME}/${VIEW_NAME}`, {
            group: true
          })
          assert.equal(rows.length, 2)
          const [doc1, doc2] = rows
          assert.equal(doc1.key, null)
          assert.equal(doc1.value, 2)
          assert.equal(doc2.key, 'baz')
          assert.equal(doc2.value, 1)
        })
      })
      describe('transforms', function () {
        describe('date', function () {
          it('should map a timestamp to a date', async function () {
            await this.db.post({ createdAt: Date.now() })
            await this.db.addJsonView(DDOC_NAME, VIEW_NAME, {
              map: { key: { access: 'createdAt', transform: 'date' } }
            })
            const { rows } = await this.db.query(`${DDOC_NAME}/${VIEW_NAME}`)
            assert.equal(rows.length, 1)
            const [{ key: [year, month, day] }] = rows
            assert.equal(typeof year, 'string')
            assert.equal(typeof month, 'string')
            assert.equal(month.length, 2)
            assert.equal(typeof day, 'string')
            assert.equal(day.length, 2)
          })
        })
        describe('time', function () {
          it('should map a timestamp to a time', async function () {
            await this.db.post({ createdAt: Date.now() })
            await this.db.addJsonView(DDOC_NAME, VIEW_NAME, {
              map: { key: { access: 'createdAt', transform: 'time' } }
            })
            const { rows } = await this.db.query(`${DDOC_NAME}/${VIEW_NAME}`)
            assert.equal(rows.length, 1)
            const [{ key: date }] = rows
            assert.equal(date.length, 4) // hours, minutes, seconds, milliseconds
          })
        })
        describe('datetime', function () {
          it('should map a timestamp to a datetime', async function () {
            await this.db.post({ createdAt: Date.now() })
            await this.db.addJsonView(DDOC_NAME, VIEW_NAME, {
              map: { key: { access: 'createdAt', transform: 'datetime' } }
            })
            const { rows } = await this.db.query(`${DDOC_NAME}/${VIEW_NAME}`)
            assert.equal(rows.length, 1)
            const [{ key: date }] = rows
            assert.equal(date.length, 7)
          })
        })
      })
      describe('splay', function () {
        it('should splay a lone key', async function () {
          await this.db.post({ tags: ['a', 'b', 'c'] })
          await this.db.addJsonView(DDOC_NAME, VIEW_NAME, {
            map: { key: { access: 'tags', splay: true } }
          })
          const { rows } = await this.db.query(`${DDOC_NAME}/${VIEW_NAME}`)
          assert.equal(rows.length, 3)
        })
        it('should splay a key array', async function () {
          await this.db.post({
            user: 'garbados',
            tags: ['a', 'b', 'c'],
            description: 'hermit goblin'
          })
          await this.db.addJsonView(DDOC_NAME, VIEW_NAME, {
            map: {
              key: [
                'user',
                { access: 'tags', splay: true },
                'description'
              ]
            }
          })
          const { rows } = await this.db.query(`${DDOC_NAME}/${VIEW_NAME}`)
          assert.equal(rows.length, 3)
          const [{ key: key1 }, { key: key2 }, { key: key3 }] = rows
          assert.equal(key1[1], 'a')
          assert.equal(key2[1], 'b')
          assert.equal(key3[1], 'c')
          const keys = [key1, key2, key3]
          keys.forEach((key) => { assert.equal(key[0], 'garbados') })
          keys.forEach((key) => { assert.equal(key[2], 'hermit goblin') })
        })
        it('should splay values', async function () {
          it('should splay a lone key', async function () {
            await this.db.post({ tags: ['a', 'b', 'c'] })
            await this.db.addJsonView(DDOC_NAME, VIEW_NAME, {
              map: { key: '_id', value: { access: 'tags', splay: true } }
            })
            const { rows } = await this.db.query(`${DDOC_NAME}/${VIEW_NAME}`)
            assert.equal(rows.length, 3)
          })
        })
      })
    })
  })
}
