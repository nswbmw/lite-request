import http from 'node:http'
import request from '../index.js'

test('post (FormData body)', async () => {
  let captured = null
  let capturedContentType = null
  const server = http.createServer((req, res) => {
    expect(req.method).toBe('POST')
    expect(req.headers['content-type']).toMatch(/^multipart\/form-data; boundary=/)
    expect(req.headers['content-length']).toMatch(/^\d+$/)

    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => {
      captured = Buffer.concat(chunks)
      capturedContentType = req.headers['content-type']
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ ok: true }))
    })
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      const form = new FormData()
      form.append('input', JSON.stringify({ foo: '中文' }))
      form.append('file', new Blob([Buffer.from([0, 255, 13, 10])], { type: 'application/pdf' }), 'receipt.pdf')
      try {
        const res = await request.post({ url: 'http://localhost:' + port, body: form, json: true })
        expect(res.statusCode).toBe(200)
        expect(res.data).toEqual({ ok: true })
        const parsed = await new Response(captured, { headers: { 'content-type': capturedContentType } }).formData()
        expect(parsed.get('input')).toBe(JSON.stringify({ foo: '中文' }))
        const file = parsed.get('file')
        expect(file.name).toBe('receipt.pdf')
        expect(file.type).toBe('application/pdf')
        expect(Buffer.from(await file.arrayBuffer())).toEqual(Buffer.from([0, 255, 13, 10]))
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('post (FormData with json: true keeps multipart content-type and parses JSON response)', async () => {
  const server = http.createServer((req, res) => {
    expect(req.headers['content-type']).toMatch(/^multipart\/form-data; boundary=/)
    expect(req.headers.accept).toBe('application/json')
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ ok: true }))
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      const form = new FormData()
      form.append('a', 'b')
      try {
        const res = await request({ url: 'http://localhost:' + port, body: form, json: true })
        expect(res.statusCode).toBe(200)
        expect(res.data).toEqual({ ok: true })
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})

test('post (FormData body is serialized once across retries)', async () => {
  let count = 0
  const server = http.createServer((req, res) => {
    count++
    if (count === 1) {
      res.statusCode = 503
      return res.end()
    }
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => {
      res.setHeader('content-type', 'text/plain')
      res.end(Buffer.concat(chunks).toString())
    })
  })

  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port
      const form = new FormData()
      form.append('a', 'b')
      try {
        const res = await request.post({ url: 'http://localhost:' + port, body: form })
        expect(res.statusCode).toBe(200)
        expect(count).toBe(2)
        expect(res.data.toString()).toMatch(/Content-Disposition: form-data; name="a"\r\n\r\nb\r\n/)
        server.close(resolve)
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
})
