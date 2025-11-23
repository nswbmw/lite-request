import http from 'node:http'
import request from '../index.js'
import selfSignedHttps from './cert/self-signed-https'

test('follow redirects (up to 10)', async () => {
  let num = 0
  const server = http.createServer((req, res) => {
    expect(req.url).toBe('/' + num)

    if (num < 10) {
      num += 1
      res.statusCode = 301
      res.setHeader('Location', '/' + num)
      res.end()
    } else {
      res.statusCode = 200
      res.end('response')
    }
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      try {
        const port = server.address().port
        const res = await request('http://localhost:' + port + '/0')
        expect(res.statusCode).toBe(200)
        expect(res.data.toString()).toBe('response')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('do not follow redirects', async () => {
  const server = http.createServer((req, res) => {
    expect(req.url).toBe('/0')
    res.statusCode = 301
    res.setHeader('Location', '/1')
    res.end()
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      try {
        await expect(request({
          url: 'http://localhost:' + port + '/0',
          maxRedirects: 0
        })).rejects.toBeInstanceOf(Error)
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('do not follow redirects and do not error', async () => {
  const server = http.createServer((req, res) => {
    expect(req.url).toBe('/0')
    res.statusCode = 301
    res.setHeader('Location', '/1')
    res.end()
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      try {
        const res = await request({
          url: 'http://localhost:' + port + '/0',
          followRedirects: false
        })
        expect(res.statusCode).toBe(301)
        expect(res.headers.location).toBe('/1')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('follow redirects (11 is too many)', async () => {
  let num = 0
  const server = http.createServer((req, res) => {
    expect(req.url).toBe('/' + num)

    if (num < 11) {
      num += 1
      res.statusCode = 301
      res.setHeader('Location', '/' + num)
      res.end()
    } else {
      // no request to /11 should be made, should error first
      throw new Error('no request to /11 should be made, should error first')
    }
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      try {
        await expect(request('http://localhost:' + port + '/0')).rejects.toBeInstanceOf(Error)
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('redirect https to http', async () => {
  let httpPort = null
  let httpsPort = null

  const httpsServer = selfSignedHttps((req, res) => {
    expect(req.url).toBe('/path1')
    res.statusCode = 301
    res.setHeader('Location', 'http://localhost:' + httpPort + '/path2')
    res.end()
  })

  const httpServer = http.createServer((req, res) => {
    expect(req.url).toBe('/path2')
    res.statusCode = 200
    res.end('response')
  })

  await new Promise((resolve, reject) => {
    httpsServer.listen(0, () => {
      httpsPort = httpsServer.address().port
      httpServer.listen(0, async () => {
        httpPort = httpServer.address().port
        try {
          const res = await request({
            url: 'https://localhost:' + httpsPort + '/path1',
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

test('redirect http to https', async () => {
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

  await new Promise((resolve, reject) => {
    httpServer.listen(0, () => {
      httpPort = httpServer.address().port
      httpsServer.listen(0, async () => {
        httpsPort = httpsServer.address().port
        try {
          const res = await request({
            url: 'http://localhost:' + httpPort + '/path1',
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

test('redirect to different host/port', async () => {
  let port1 = null
  let port2 = null

  const server1 = http.createServer((req, res) => {
    expect(req.url).toBe('/path1')
    res.statusCode = 301
    // Redirect from localhost:port1 to 127.0.0.1:port2 (different host and port!)
    res.setHeader('Location', 'http://127.0.0.1:' + port2 + '/path2')
    res.end()
  })

  const server2 = http.createServer((req, res) => {
    expect(req.url).toBe('/path2')
    // Confirm that request was made with new host and port (127.0.0.1:port2)
    expect(req.headers.host).toBe(`127.0.0.1:${port2}`)
    res.statusCode = 200
    res.end('response')
  })

  await new Promise((resolve, reject) => {
    server1.listen(0, () => {
      port1 = server1.address().port
      server2.listen(0, async () => {
        port2 = server2.address().port
        try {
          const res = await request('http://localhost:' + port1 + '/path1')
          expect(res.statusCode).toBe(200)
          expect(res.data.toString()).toBe('response')
          server1.close()
          server2.close()
          resolve()
        } catch (err) {
          server1.close()
          server2.close()
          reject(err)
        }
      })
    })
  })
})

test('redirect should clear explicitly specified `host` header', async () => {
  let port1 = null
  let port2 = null

  const server1 = http.createServer((req, res) => {
    expect(req.url).toBe('/path1')
    expect(req.headers.host).toBe(`localhost:${port1}`)
    res.statusCode = 301
    // Redirect from localhost:port1 to 127.0.0.1:port2 (different host and port!)
    res.setHeader('Location', 'http://127.0.0.1:' + port2 + '/path2')
    res.end()
  })

  const server2 = http.createServer((req, res) => {
    expect(req.url).toBe('/path2')
    // Confirm that request was made with new host and port (127.0.0.1:port2), i.e.
    // that the explicitly specified `Host` header was cleared upon redirect.
    expect(req.headers.host).toBe(`127.0.0.1:${port2}`)
    res.statusCode = 200
    res.end('response')
  })

  await new Promise((resolve, reject) => {
    server1.listen(0, () => {
      port1 = server1.address().port
      server2.listen(0, async () => {
        port2 = server2.address().port
        try {
          const res = await request({
            url: `http://localhost:${port1}/path1`,
            // Explicitly specify a `Host` header, so it won't be set automatically
            headers: {
              host: `localhost:${port1}`
            }
          })
          expect(res.statusCode).toBe(200)
          expect(res.data.toString()).toBe('response')
          server1.close()
          server2.close()
          resolve()
        } catch (err) {
          server1.close()
          server2.close()
          reject(err)
        }
      })
    })
  })
})

test('redirect should clear explicitly specified `Host` (note uppercase) header', async () => {
  let port1 = null
  let port2 = null

  const server1 = http.createServer((req, res) => {
    expect(req.url).toBe('/path1')
    expect(req.headers.host).toBe(`localhost:${port1}`)
    res.statusCode = 301
    // Redirect from localhost:port1 to 127.0.0.1:port2 (different host and port!)
    res.setHeader('Location', 'http://127.0.0.1:' + port2 + '/path2')
    res.end()
  })

  const server2 = http.createServer((req, res) => {
    expect(req.url).toBe('/path2')
    // Confirm that request was made with new host and port (127.0.0.1:port2), i.e.
    // that the explicitly specified `Host` header was cleared upon redirect.
    expect(req.headers.host).toBe(`127.0.0.1:${port2}`)
    res.statusCode = 200
    res.end('response')
  })

  await new Promise((resolve, reject) => {
    server1.listen(0, () => {
      port1 = server1.address().port
      server2.listen(0, async () => {
        port2 = server2.address().port
        try {
          const res = await request({
            url: `http://localhost:${port1}/path1`,
            // Explicitly specify a `Host` header, so it won't be set automatically
            headers: {
              Host: `localhost:${port1}`
            }
          })
          expect(res.statusCode).toBe(200)
          expect(res.data.toString()).toBe('response')
          server1.close()
          server2.close()
          resolve()
        } catch (err) {
          server1.close()
          server2.close()
          reject(err)
        }
      })
    })
  })
})

test('follow redirects without "url" option', async () => {
  let num = 0
  const server = http.createServer((req, res) => {
    expect(req.url).toBe('/' + num)

    if (num < 10) {
      num += 1
      res.statusCode = 301
      res.setHeader('Location', '/' + num)
      res.end()
    } else {
      res.statusCode = 200
      res.end('response')
    }
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      try {
        const res = await request({ hostname: 'localhost', port, path: '/0' })
        expect(res.statusCode).toBe(200)
        expect(res.data.toString()).toBe('response')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})
