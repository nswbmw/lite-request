import http from 'node:http'
import request from '../index.js'

test('GET JSON with json option', async () => {
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

test('POST JSON with json option', async () => {
  const server = http.createServer((req, res) => {
    expect(req.method).toBe('POST')
    expect(req.headers['content-type']).toBe('application/json')
    res.statusCode = 200
    req.pipe(res)
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      const body = {
        message: 'this is the body'
      }
      try {
        const res = await request.post('http://localhost:' + port, {
          json: true,
          body
        })
        expect(res.statusCode).toBe(200)
        expect(res.data.message).toBe('this is the body')
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})
