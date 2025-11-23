import http from 'node:http'
import str from 'string-to-stream'
import { Writable } from 'node:stream'
import request from '../index.js'

test('POST stream body with json option', async () => {
  const server = http.createServer((req, res) => {
    res.statusCode = 200
    req.pipe(res)
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      const opts = {
        url: 'http://localhost:' + port,
        body: () => str('{"a": "b"}'),
        method: 'POST',
        json: true
      }
      try {
        const res = await request(opts)
        expect(typeof res.data).toBe('object')
        expect(Object.keys(res.data)).toEqual(['a'])
        expect(res.data.a).toBe('b')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('custom output stream handler', async () => {
  const server = http.createServer((req, res) => {
    res.statusCode = 200
    res.end('custom-output')
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      try {
        const chunks = []
        const res = await request({
          url: 'http://localhost:' + port,
          output: (opts, _res) => new Writable({
            write (chunk, enc, wcb) {
              chunks.push(chunk.toString())
              wcb()
            }
          })
        })
        expect(res.statusCode).toBe(200)
        expect(chunks.join('')).toBe('custom-output')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('should return an error if the input stream is not created by a function', async () => {
  const opts = {
    url: 'http://localhost:',
    body: str('{"a": "b"}'),
    method: 'POST',
    json: true
  }
  await expect(request(opts)).rejects.toMatchObject({ message: 'opts.body must be a function returning a Readable stream. RTFM' })
})

test('should return an error if the output stream is not created by a function', async () => {
  const chunks = []
  const opts = {
    url: 'http://localhost',
    output: new Writable({ write (chunk, enc, wcb) { chunks.push(chunk); wcb() } }),
    method: 'GET'
  }
  await expect(request(opts)).rejects.toMatchObject({ message: 'opts.output must be a function returning a Writable stream. RTFM' })
})

test('should return an error if the output stream is something else than a function', async () => {
  const opts = {
    url: 'http://localhost',
    output: 'sdsd',
    method: 'GET'
  }
  await expect(request(opts)).rejects.toMatchObject({ message: 'opts.output must be a function returning a Writable stream. RTFM' })
})

test('concat response to buffer', async () => {
  const server = http.createServer((req, res) => {
    res.statusCode = 200
    res.end('blah blah blah')
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      try {
        const res = await request('http://localhost:' + port)
        expect(res.statusCode).toBe(200)
        expect(Buffer.isBuffer(res.data)).toBe(true)
        expect(res.data.toString()).toBe('blah blah blah')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('should concat multiple parts', async () => {
  const server = http.createServer((req, res) => {
    res.statusCode = 200
    res.write('12345')
    setTimeout(() => {
      res.end('6789')
    }, 1000)
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      try {
        const res = await request('http://localhost:' + port)
        expect(res.statusCode).toBe(200)
        expect(Buffer.isBuffer(res.data)).toBe(true)
        expect(res.data.toString()).toBe('123456789')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('concat json response', async () => {
  const server = http.createServer((req, res) => {
    res.statusCode = 200
    res.end('{"message":"response"}')
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      const opts = {
        url: 'http://localhost:' + port + '/path',
        json: true
      }
      try {
        const res = await request(opts)
        expect(res.statusCode).toBe(200)
        expect(res.data.message).toBe('response')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('json parse error', async () => {
  const server = http.createServer((req, res) => {
    res.statusCode = 500
    res.end('not json')
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      const opts = {
        url: 'http://localhost:' + port + '/path',
        json: true
      }
      try {
        await expect(request(opts)).rejects.toBeInstanceOf(Error)
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})
