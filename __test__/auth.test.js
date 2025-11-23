import http from 'node:http'
import request from '../index.js'

test('basic auth', async () => {
  const server = http.createServer((req, res) => {
    expect(req.headers.authorization).toBe('Basic Zm9vOmJhcg==')
    res.statusCode = 200
    res.end('response')
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      try {
        const res = await request('http://foo:bar@localhost:' + port)
        expect(res.statusCode).toBe(200)
        expect(res.data.toString()).toBe('response')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('basic auth + host', async () => {
  const server = http.createServer((req, res) => {
    expect(req.headers.authorization).toBe('Basic Zm9vOmJhcg==')
    res.statusCode = 200
    res.end('response')
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      try {
        const res = await request({ auth: 'foo:bar', host: 'localhost', port })
        expect(res.statusCode).toBe(200)
        expect(res.data.toString()).toBe('response')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('basic auth + hostname', async () => {
  const server = http.createServer((req, res) => {
    expect(req.headers.authorization).toBe('Basic Zm9vOmJhcg==')
    res.statusCode = 200
    res.end('response')
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      try {
        const res = await request({ auth: 'foo:bar', hostname: 'localhost', port })
        expect(res.statusCode).toBe(200)
        expect(res.data.toString()).toBe('response')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})
