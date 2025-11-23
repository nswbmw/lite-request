import http from 'node:http'
import { Request } from '../index.js'
import selfSignedHttps from './cert/self-signed-https.js'

test('create new instance, merge with request header, should lower case headers', async () => {
  const server = http.createServer((req, res) => {
    res.statusCode = 200
    if (req.url === '/origin') {
      expect(req.url).toBe('/origin')
      expect(req.headers['x-test']).toBe('yeah')
      expect(req.headers['second-header']).toBeUndefined()
      expect(req.headers['custom-header']).toBe('custom-value')
      res.end('origin')
    } else if (req.url === '/instance') {
      expect(req.url).toBe('/instance')
      expect(req.headers['x-test']).toBeUndefined()
      expect(req.headers['second-header']).toBe('12')
      expect(req.headers['custom-header']).toBe('custom-value')
      res.end('instance')
    }
  })

  const originClient = Request({
    headers: {
      'X-Test': 'yeah'
    }
  })

  const instanceClient = Request({
    headers: {
      'Second-Header': '12'
    }
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      try {
        const originRes = await originClient({
          url: 'http://localhost:' + port + '/origin',
          headers: {
            'custom-header': 'custom-value'
          }
        })
        expect(originRes.data.toString()).toBe('origin')

        const instanceRes = await instanceClient({
          url: 'http://localhost:' + port + '/instance',
          headers: {
            'custom-Header': 'custom-value'
          }
        })
        expect(instanceRes.data.toString()).toBe('instance')

        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('beforeRequest handler, combined with retries', async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/first-rewrite2') {
      expect(req.url).toBe('/first-rewrite2')
      expect(req.headers['second-header']).toBeUndefined()
      res.statusCode = 503
      res.end('first-rewrite2')
    } else if (req.url === '/first-rewrite1') {
      expect(req.url).toBe('/first-rewrite1')
      expect(req.headers['second-header']).toBeUndefined()
      res.statusCode = 200
      res.end('first-rewrite1')
    } else if (req.url === '/second-rewrite2') {
      expect(req.url).toBe('/second-rewrite2')
      expect(req.headers['second-header']).toBe('hello')
      res.statusCode = 200
      res.end('second-rewrite2')
    }
  })

  const client = Request({
    maxRetry: 2,
    beforeRequest: (parsedOpts) => {
      expect(parsedOpts.maxRedirects).toBe(10)
      expect(parsedOpts.maxRetry).toBe(2)
      expect(parsedOpts.hostname).toBe('localhost')
      expect(parsedOpts.protocol).toBe('http:')
      if (parsedOpts.path === '/first' && parsedOpts.maxRetry === parsedOpts.remainingRetry) {
        parsedOpts.path = '/first-rewrite' + parsedOpts.remainingRetry
      }
      if (parsedOpts.remainingRetry === (parsedOpts.maxRetry - 1)) {
        expect(parsedOpts.prevStatusCode).toBe(503)
        parsedOpts.path = '/first-rewrite' + parsedOpts.remainingRetry
      }
      if (parsedOpts.path === '/second') {
        parsedOpts.path = '/second-rewrite' + parsedOpts.remainingRetry
        parsedOpts.headers['second-header'] = 'hello'
      }
      return parsedOpts
    }
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      try {
        const firstRes = await client('http://localhost:' + port + '/first')
        expect(firstRes.data.toString()).toBe('first-rewrite1')

        const secondRes = await client({
          url: 'http://localhost:' + port + '/second',
          headers: {
            'second-header': 'second-header-overwritten'
          }
        })
        expect(secondRes.data.toString()).toBe('second-rewrite2')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('beforeRequest handler, combined with redirect with absolute URL, and switch from http to https', async () => {
  let httpsPort = null
  let httpPort = null

  const httpServer = http.createServer((req, res) => {
    expect(req.url).toBe('/path1')
    res.statusCode = 301
    res.setHeader('Location', 'https://localhost:' + httpsPort + '/path2')
    res.end()
  })

  const httpsServer = selfSignedHttps((req, res) => {
    expect(req.url).toBe('/path2')
    res.statusCode = 200
    res.end('response')
  })

  const client = Request({
    maxRedirects: 5,
    beforeRequest: (parsedOpts) => {
      expect(parsedOpts.maxRedirects).toBe(5)
      if (parsedOpts.remainingRedirects === 5) {
        expect(parsedOpts.hostname).toBe('localhost')
        expect(parsedOpts.path).toBe('/before')
        expect(parsedOpts.protocol).toBe('http:')
        parsedOpts.path = '/path1'
      }
      if (parsedOpts.remainingRedirects === 4) {
        expect(parsedOpts.hostname).toBe('localhost')
        expect(parsedOpts.path).toBe('/path2')
        expect(parsedOpts.protocol).toBe('https:')
      }
      return parsedOpts
    }
  })

  await new Promise((resolve, reject) => {
    httpServer.listen(0, () => {
      httpPort = httpServer.address().port
      httpsServer.listen(0, async () => {
        httpsPort = httpsServer.address().port
        try {
          const res = await client({
            url: 'http://localhost:' + httpPort + '/before',
            rejectUnauthorized: false
          })
          expect(res.statusCode).toBe(200)
          expect(res.data.toString()).toBe('response')
          httpsServer.close()
          httpServer.close()
          resolve()
        } catch (err) {
          httpsServer.close()
          httpServer.close()
          reject(err)
        }
      })
    })
  })
})

test('beforeRequest handler, combined with redirect with relative URL', async () => {
  let httpPort = null

  const httpServer = http.createServer((req, res) => {
    if (req.url === '/path1') {
      expect(req.url).toBe('/path1')
      res.setHeader('Location', '/path2')
      res.statusCode = 301
      return res.end()
    }
    expect(req.url).toBe('/path2')
    res.statusCode = 200
    res.end('response')
  })

  const client = Request({
    maxRedirects: 5,
    beforeRequest: (parsedOpts) => {
      expect(parsedOpts.maxRedirects).toBe(5)
      if (parsedOpts.remainingRedirects === 5) {
        expect(parsedOpts.hostname).toBe('localhost')
        expect(parsedOpts.path).toBe('/before')
        expect(parsedOpts.protocol).toBe('http:')
        parsedOpts.path = '/path1'
      }
      if (parsedOpts.remainingRedirects === 4) {
        expect(parsedOpts.hostname).toBe('localhost')
        expect(parsedOpts.path).toBe('/path2')
      }
      return parsedOpts
    }
  })

  await new Promise((resolve, reject) => {
    httpServer.listen(0, async () => {
      httpPort = httpServer.address().port
      try {
        const res = await client({
          url: 'http://localhost:' + httpPort + '/before',
          rejectUnauthorized: false
        })
        expect(res.statusCode).toBe(200)
        expect(res.data.toString()).toBe('response')
        httpServer.close(resolve)
      } catch (err) {
        httpServer.close(() => reject(err))
      }
    })
  })
})

test('beforeRequest handler, combined with redirect with relative URL and rewritten URL', async () => {
  let httpPort = null

  const httpServer = http.createServer((req, res) => {
    if (req.url === '/path1') {
      expect(req.url).toBe('/path1')
      res.setHeader('Location', '/path2')
      res.statusCode = 301
      return res.end()
    }
    expect(req.url).toBe('/path2')
    res.statusCode = 200
    res.end('response')
  })

  const client = Request({
    maxRedirects: 5,
    beforeRequest: (parsedOpts) => {
      expect(parsedOpts.maxRedirects).toBe(5)
      if (parsedOpts.remainingRedirects === 5) {
        expect(parsedOpts.hostname).toBe('example.com')
        expect(parsedOpts.path).toBe('/before')
        expect(parsedOpts.protocol).toBe('http:')
        parsedOpts.path = '/path1'
      }
      if (parsedOpts.remainingRedirects === 4) {
        expect(parsedOpts.hostname).toBe('example.com')
        expect(parsedOpts.path).toBe('/path2')
      }
      parsedOpts.hostname = 'localhost'
      return parsedOpts
    }
  })

  await new Promise((resolve, reject) => {
    httpServer.listen(0, async () => {
      httpPort = httpServer.address().port
      try {
        const res = await client({
          url: 'http://example.com:' + httpPort + '/before',
          rejectUnauthorized: false
        })
        expect(res.statusCode).toBe(200)
        expect(res.data.toString()).toBe('response')
        httpServer.close(resolve)
      } catch (err) {
        httpServer.close(() => reject(err))
      }
    })
  })
})
