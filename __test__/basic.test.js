import http from 'node:http'
import request, { Request } from '../index.js'
import selfSignedHttps from './cert/self-signed-https'

test('simple get', async () => {
  const server = http.createServer((req, res) => {
    expect(req.url).toBe('/path')
    res.statusCode = 200
    res.end('response')
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      try {
        const res = await request('http://localhost:' + port + '/path')
        expect(res.statusCode).toBe(200)
        expect(res.data.toString()).toBe('response')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('simple get with shortcut method and string url', async () => {
  const server = http.createServer((req, res) => {
    expect(req.url).toBe('/path')
    res.statusCode = 200
    res.end('response')
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      try {
        const res = await request.get('http://localhost:' + port + '/path')
        expect(res.statusCode).toBe(200)
        expect(res.data.toString()).toBe('response')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('no keepAlive agent when keepAliveDuration is 0', async () => {
  const server = http.createServer((req, res) => {
    expect(req.url).toBe('/path')
    res.statusCode = 200
    res.end('response')
  })

  const api = Request({ keepAliveDuration: 0 })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      try {
        const res = await api({
          url: 'http://localhost:' + port + '/path',
          maxRetry: 0
        })
        expect(res.data.toString()).toBe('response')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('https', async () => {
  const server = selfSignedHttps((req, res) => {
    expect(req.url).toBe('/path')
    res.statusCode = 200
    res.end('response')
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      try {
        const res = await request({
          url: 'https://localhost:' + port + '/path',
          rejectUnauthorized: false
        })
        expect(res.statusCode).toBe(200)
        expect(res.data.toString()).toBe('response')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('simple get json', async () => {
  const server = http.createServer((req, res) => {
    expect(req.url).toBe('/path')
    expect(req.headers.accept).toBe('application/json')
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
        expect(JSON.stringify(res.data)).toBe('{"message":"response"}')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('HEAD request', async () => {
  const server = http.createServer((req, res) => {
    expect(req.method).toBe('HEAD')
    // Taken from real-world response from HEAD request to GitHub.com
    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.setHeader('content-encoding', 'gzip')
    res.setHeader('connection', 'close')
    res.statusCode = 200
    req.pipe(res)
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      const opts = {
        method: 'HEAD',
        url: 'http://localhost:' + port
      }
      try {
        const res = await request.head(opts)
        expect(res.statusCode).toBe(200)
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('timeout option', async () => {
  const server = http.createServer((req, res) => {
    expect(req.url).toBe('/path')
    setTimeout(() => {
      // response should not be sent - should timeout before it's sent
      res.end('response')
    }, 2000)
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      try {
        await expect(request({
          url: 'http://localhost:' + port + '/path',
          timeout: 1000,
          maxRetry: 0
        })).rejects.toMatchObject({ message: 'TimeoutError' })
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('should not timeout even if keepAliveDuration is lower than response time', async () => {
  const server = http.createServer((req, res) => {
    expect(req.url).toBe('/path')
    setTimeout(() => {
      res.end('response')
    }, 2000)
  })

  const api = Request({ keepAliveDuration: 1000 })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      try {
        const res = await api({
          url: 'http://localhost:' + port + '/path',
          maxRetry: 0
        })
        expect(res.data.toString()).toBe('response')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('rewrite POST redirects to GET', async () => {
  let redirected = false

  const server = http.createServer((req, res) => {
    if (redirected) {
      expect(req.url).toBe('/getthis')
      expect(req.method).toBe('GET')
      expect(req.headers['content-length']).toBeUndefined()
      res.statusCode = 200
      req.pipe(res)
    } else {
      expect(req.method).toBe('POST')
      redirected = true
      res.statusCode = 301
      res.setHeader('Location', '/getthis')
      res.end()
    }
  })
  server.setTimeout(1000) // NodeJS < 19 does not close keep-alive socket automatically

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      const opts = {
        method: 'POST',
        body: '123',
        url: 'http://localhost:' + port
      }
      try {
        const res = await request(opts)
        expect(res.statusCode).toBe(200)
        expect(res.data.toString()).toBe('')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('simple get hostname + url', async () => {
  const server = http.createServer((req, res) => {
    expect(req.url).toBe('/path')
    res.statusCode = 200
    res.end('response')
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      try {
        const res = await request({ host: 'localhost', port, url: '/path' })
        expect(res.statusCode).toBe(200)
        expect(res.data.toString()).toBe('response')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})
