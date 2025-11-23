import http from 'node:http'
import request from '../index.js'

test('request returns a response with data', async () => {
  const server = http.createServer((req, res) => {
    res.statusCode = 200
    res.end('response')
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
