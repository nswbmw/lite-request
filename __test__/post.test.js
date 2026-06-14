import http from 'node:http'
import * as qs from 'qs-esm'
import str from 'string-to-stream'
import request from '../index.js'

test('post (text body)', async () => {
  const server = http.createServer((req, res) => {
    expect(req.method).toBe('POST')
    res.statusCode = 200
    req.pipe(res)
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      const opts = {
        url: 'http://localhost:' + port,
        body: 'this is the body'
      }
      try {
        const res = await request.post(opts)
        expect(res.statusCode).toBe(200)
        expect(res.data.toString()).toBe('this is the body')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('post (implicit method when body is present)', async () => {
  const server = http.createServer((req, res) => {
    expect(req.method).toBe('POST')
    res.statusCode = 200
    req.pipe(res)
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      const opts = {
        url: 'http://localhost:' + port,
        body: 'implicit post body'
      }
      try {
        const res = await request(opts)
        expect(res.statusCode).toBe(200)
        expect(res.data.toString()).toBe('implicit post body')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('post (utf-8 text body)', async () => {
  const server = http.createServer((req, res) => {
    expect(req.method).toBe('POST')
    res.statusCode = 200
    req.pipe(res)
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      const opts = {
        url: 'http://localhost:' + port,
        body: 'jedan dva tri četiri'
      }
      try {
        const res = await request.post(opts)
        expect(res.statusCode).toBe(200)
        expect(res.data.toString()).toBe('jedan dva tri četiri')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('post (buffer body)', async () => {
  const server = http.createServer((req, res) => {
    expect(req.method).toBe('POST')
    res.statusCode = 200
    req.pipe(res)
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      const opts = {
        url: 'http://localhost:' + port,
        body: Buffer.from('this is the body')
      }
      try {
        const res = await request.post(opts)
        expect(res.statusCode).toBe(200)
        expect(res.data.toString()).toBe('this is the body')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('post (stream body)', async () => {
  const server = http.createServer((req, res) => {
    expect(req.method).toBe('POST')
    res.statusCode = 200
    expect(req.headers['content-length']).toBeUndefined()
    req.pipe(res)
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      const opts = {
        url: 'http://localhost:' + port,
        body: () => str('this is the body')
      }
      try {
        const res = await request.post(opts)
        expect(res.statusCode).toBe(200)
        expect(res.data.toString()).toBe('this is the body')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('post (stream body) with second function parameter', async () => {
  const server = http.createServer((req, res) => {
    expect(req.method).toBe('POST')
    res.statusCode = 200
    expect(req.headers['content-length']).toBeUndefined()
    req.pipe(res)
  })

  const _stream = () => str('this is the body')

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      try {
        const res = await request.post('http://localhost:' + port, { body: _stream })
        expect(res.statusCode).toBe(200)
        expect(res.data.toString()).toBe('this is the body')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('post (json body)', async () => {
  const server = http.createServer((req, res) => {
    expect(req.method).toBe('POST')
    expect(req.headers['content-type']).toBe('application/json')
    res.statusCode = 200
    req.pipe(res)
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      const opts = {
        method: 'POST',
        url: 'http://localhost:' + port,
        body: {
          message: 'this is the body'
        },
        json: true
      }
      try {
        const res = await request(opts)
        expect(res.statusCode).toBe(200)
        expect(res.data.message).toBe('this is the body')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('post (json body, jsonResponse false)', async () => {
  const server = http.createServer((req, res) => {
    expect(req.method).toBe('POST')
    expect(req.headers['content-type']).toBe('application/json')
    res.statusCode = 200
    req.pipe(res)
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      const opts = {
        method: 'POST',
        url: 'http://localhost:' + port,
        body: {
          message: 'this is the body'
        },
        json: true,
        jsonResponse: false
      }
      try {
        const res = await request(opts)
        expect(res.statusCode).toBe(200)
        expect(res.data.toString()).toBe('{"message":"this is the body"}')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('post with empty JSON response should not crash', async () => {
  const server = http.createServer((req, res) => {
    expect(req.method).toBe('POST')
    expect(req.headers['content-type']).toBe('application/json')
    res.statusCode = 204
    res.end()
  })
  server.setTimeout(1000) // NodeJS < 19 does not close keep-alive socket automatically

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      const opts = {
        method: 'POST',
        url: 'http://localhost:' + port,
        body: {
          message: 'this is the body'
        },
        json: true
      }
      try {
        const res = await request(opts)
        expect(res.statusCode).toBe(204)
        expect(res.data).toBe(null)
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('post (form, object)', async () => {
  const formData = Object.create(null)
  formData.foo = 'bar'

  const server = http.createServer((req, res) => {
    expect(req.method).toBe('POST')
    expect(req.headers['content-type']).toBe('application/x-www-form-urlencoded')
    res.statusCode = 200
    req.pipe(res)
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      const opts = {
        method: 'POST',
        url: 'http://localhost:' + port,
        form: formData
      }
      try {
        const res = await request(opts)
        expect(res.statusCode).toBe(200)
        expect(qs.parse(res.data.toString())).toEqual(formData)
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('post (form, querystring)', async () => {
  const formData = 'foo=bar'

  const server = http.createServer((req, res) => {
    expect(req.method).toBe('POST')
    expect(req.headers['content-type']).toBe('application/x-www-form-urlencoded')
    res.statusCode = 200
    req.pipe(res)
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      const opts = {
        method: 'POST',
        url: 'http://localhost:' + port,
        form: formData
      }
      try {
        const res = await request(opts)
        expect(res.statusCode).toBe(200)
        expect(res.data.toString()).toBe(formData)
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('post (form, array)', async () => {
  const formData = { foo: ['bar', 'baz'] }

  const server = http.createServer((req, res) => {
    expect(req.method).toBe('POST')
    expect(req.headers['content-type']).toBe('application/x-www-form-urlencoded')
    res.statusCode = 200
    req.pipe(res)
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      const opts = {
        method: 'POST',
        url: 'http://localhost:' + port,
        form: formData
      }
      try {
        const res = await request(opts)
        expect(res.statusCode).toBe(200)
        expect(qs.parse(res.data.toString())).toEqual(formData)
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})
