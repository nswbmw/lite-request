import http from 'node:http'
import str from 'string-to-stream'
import zlib from 'node:zlib'
import request from '../index.js'

test('custom headers', async () => {
  const server = http.createServer((req, res) => {
    expect(req.headers['custom-header']).toBe('custom-value')
    res.statusCode = 200
    res.end('response')
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      try {
        const res = await request({
          url: 'http://localhost:' + port,
          headers: {
            'custom-header': 'custom-value'
          }
        })
        res.resume()
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('gzip response', async () => {
  const server = http.createServer((req, res) => {
    res.statusCode = 200
    res.setHeader('content-encoding', 'gzip')
    str('response').pipe(zlib.createGzip()).pipe(res)
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      try {
        const res = await request('http://localhost:' + port)
        expect(res.statusCode).toBe(200)
        expect(res.data.toString()).toBe('response')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('bad gzip response', async () => {
  const server = http.createServer((req, res) => {
    res.statusCode = 200
    res.setHeader('content-encoding', 'gzip')
    const text = 'Hello World!'
    const buf = Buffer.from(text, 'utf-8')
    zlib.gzip(buf, (err, result) => {
      expect(err).toBeNull()
      res.end(result.slice(0, -1))
    })
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      try {
        await request('http://localhost:' + port)
        // If we reach here, no error was thrown, which is a failure for this test
        server.close(() => reject(new Error('Expected request to fail with bad gzip response')))
      } catch (err) {
        // Any error is acceptable here; we just need to ensure the client surfaces an error
        expect(err).toBeTruthy()
        server.close(resolve)
      }
    })
  })
})

test('deflate response', async () => {
  const server = http.createServer((req, res) => {
    res.statusCode = 200
    res.setHeader('content-encoding', 'deflate')
    str('response').pipe(zlib.createDeflate()).pipe(res)
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      try {
        const res = await request('http://localhost:' + port)
        expect(res.statusCode).toBe(200) // statusCode still works on inflate stream
        expect(res.data.toString()).toBe('response')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('br response', async () => {
  const server = http.createServer((req, res) => {
    res.statusCode = 200
    res.setHeader('content-encoding', 'br')
    str('response').pipe(zlib.createBrotliCompress()).pipe(res)
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      try {
        const res = await request('http://localhost:' + port)
        expect(res.statusCode).toBe(200) // statusCode still works on inflate stream
        expect(res.data.toString()).toBe('response')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})
