import http from 'node:http'
import { Readable } from 'node:stream'
import request, { Request } from '../index.js'

async function testRetryOnHttpCode (httpCode, nbError) {
  const server = http.createServer((req, res) => {
    expect(req.url).toBe('/path')
    res.statusCode = httpCode
    if (nbError === 0) {
      res.statusCode = 200
    }
    nbError--
    res.end('response')
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      try {
        const res = await request({
          url: 'http://localhost:' + port + '/path',
          maxRetry: 1
        })
        expect(res.statusCode).toBe(200)
        expect(res.data.toString()).toBe('response')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
}

test('should retry if there are some HTTP code errors', async () => {
  await Promise.all([
    testRetryOnHttpCode(502, 1),
    testRetryOnHttpCode(503, 1),
    testRetryOnHttpCode(504, 1),
    testRetryOnHttpCode(200, 0)
  ])
})

test('should not retry if maxRetry === 0', async () => {
  const server = http.createServer((req, res) => {
    expect(req.url).toBe('/path')
    res.statusCode = 502
    res.end('response')
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      try {
        const res = await request({
          url: 'http://localhost:' + port + '/path',
          maxRetry: 0,
          retryOnCode: [502]
        })
        expect(res.statusCode).toBe(502)
        expect(res.data.toString()).toBe('response')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('should not retry if maxRetry < 0', async () => {
  const server = http.createServer((req, res) => {
    expect(req.url).toBe('/path')
    res.statusCode = 502
    res.end('response')
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      try {
        const res = await request({
          url: 'http://localhost:' + port + '/path',
          maxRetry: -1,
          retryOnCode: [502]
        })
        expect(res.statusCode).toBe(502)
        expect(res.data.toString()).toBe('response')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('should retry "maxRetry" max on HTTP code error', async () => {
  let nbTry = 0
  const server = http.createServer((req, res) => {
    expect(req.url).toBe('/path')
    res.statusCode = 503
    nbTry++
    res.end('response')
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      try {
        const res = await request({
          url: 'http://localhost:' + port + '/path',
          maxRetry: 5
        })
        expect(res.statusCode).toBe(503)
        expect(nbTry).toBe(6)
        expect(res.data.toString()).toBe('response')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('should use custom retryOnCode', async () => {
  let nbTry = 0
  const server = http.createServer((req, res) => {
    expect(req.url).toBe('/path')
    res.statusCode = 404
    nbTry++
    res.end('response')
  })

  const client = Request({ retryOnCode: [404] })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      try {
        const res = await client({
          url: 'http://localhost:' + port + '/path',
          maxRetry: 5
        })
        expect(res.statusCode).toBe(404)
        expect(nbTry).toBe(6)
        expect(res.data.toString()).toBe('response')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('should retry even if there is a timeout', async () => {
  let nbRequestTimeout = 1
  const server = http.createServer((req, res) => {
    expect(req.url).toBe('/path')
    if (nbRequestTimeout === 0) {
      res.statusCode = 200
      return res.end('response')
    }
    nbRequestTimeout--
    setTimeout(() => {
      res.end('response')
    }, 2000)
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      try {
        const res = await request({
          url: 'http://localhost:' + port + '/path',
          timeout: 1000,
          maxRetry: 2
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

test('should retry with POST and keep headers on each retry', async () => {
  let nbRequestTimeout = 1
  const server = http.createServer((req, res) => {
    expect(req.method).toBe('POST')
    expect(req.headers['x-test']).toBe('145')
    expect(req.headers['accept-encoding']).toBe('gzip, deflate, br')
    if (nbRequestTimeout === 0) {
      res.statusCode = 200
      req.pipe(res)
      return
    }
    nbRequestTimeout--
    setTimeout(() => {
      res.end('response')
    }, 1000)
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      try {
        const res = await request({
          url: 'http://localhost:' + port + '/path',
          body: 'body message',
          method: 'POST',
          headers: { 'X-TEST': '145' },
          timeout: 1000,
          maxRetry: 2
        })
        expect(res.statusCode).toBe(200)
        expect(res.data.toString()).toBe('body message')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('should retry if error from server after receiving first response', async () => {
  let nbTry = 0
  const server = http.createServer((req, res) => {
    nbTry++
    res.statusCode = 200
    res.write('12345')
    expect(req.url).toBe('/')
    setTimeout(() => {
      if (nbTry === 1) {
        expect(nbTry).toBe(1)
        res.socket.destroy(new Error('ECONNRESET'))
      } else {
        res.end('6789')
      }
    }, 1000)
  })

  const client = Request({ maxRetry: 2 })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      try {
        const res = await client('http://localhost:' + port)
        expect(res.data.toString()).toBe('123456789')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('should destroy and restart INPUT stream on retry', async () => {
  let nbServerTry = 0
  let nbDataChunkReceived = 0
  const server = http.createServer((req, res) => {
    nbServerTry++
    res.statusCode = 200
    res.write('12345')
    expect(req.url).toBe('/')
    const chunks = []
    req.on('data', (chunk) => {
      nbDataChunkReceived++
      chunks.push(chunk.toString())
      if (nbDataChunkReceived === 1) {
        expect(chunk.toString()).toBe('abcde')
        res.socket.destroy(new Error('ECONNRESET'))
      }
    })
    req.on('end', () => {
      if (nbServerTry === 2) {
        expect(chunks.join('')).toBe('abcdefghij')
        setTimeout(() => res.end('6789'), 200)
      }
    })
  })

  const client = Request({ maxRetry: 2 })
  const inputStreams = []

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      let nbClientInputStreamCreated = 0
      try {
        const res = await client({
          url: 'http://localhost:' + port,
          body: () => {
            nbClientInputStreamCreated++
            const myReadStream = new Readable({
              construct (cb) {
                this.data = ['abcde', 'fghij', null]
                this.it = 0
                cb()
              },
              read () {
                this.push(this.data[this.it++])
              }
            })
            inputStreams.push(myReadStream)
            return myReadStream
          },
          method: 'POST'
        })
        expect(nbServerTry).toBe(2)
        expect(nbClientInputStreamCreated).toBe(2)
        expect(inputStreams[0].destroyed).toBe(true)
        expect(inputStreams[1].destroyed).toBe(true)
        expect(res.statusCode).toBe(200)
        expect(res.data.toString()).toBe('123456789')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})
