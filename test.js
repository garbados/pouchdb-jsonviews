/* global describe, it, beforeEach, afterEach */

const assert = require('assert').strict
const PouchDB = require('pouchdb')
PouchDB.plugin(require('.'))

const DB_NAME = 'test_db'
const DDOC_NAME = 'ddoc'
const VIEW_NAME = 'view'

const JSON_VIEW_1 = { map: 'foo', reduce: '_count' }

describe('pouchdb-jsonviews', function () {
  beforeEach(function () {
    this.db = new PouchDB(DB_NAME)
  })

  afterEach(function () {
    return this.db.destroy()
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
          const [{ key: date }] = rows
          assert(/\d{4,}-\d{2}-\d{2}/.test(date), date)
        })
      })
      describe('time', function () {
        it('should map a timestamp to a datetime', async function () {
          await this.db.post({ createdAt: Date.now() })
          await this.db.addJsonView(DDOC_NAME, VIEW_NAME, {
            map: { key: { access: 'createdAt', transform: 'time' } }
          })
          const { rows } = await this.db.query(`${DDOC_NAME}/${VIEW_NAME}`)
          assert.equal(rows.length, 1)
          const [{ key: date }] = rows
          assert(/\d{2}:\d{2}:\d{2}.\d{3}Z/.test(date), date)
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
          assert(/\d{4,}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/.test(date), date)
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
