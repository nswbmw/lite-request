## lite-request

A minimal HTTP client for Node.js.

- Only ~150 lines of code
- Built‑in retry and 3xx redirect following
- Automatic gzip / deflate / brotli decompression
- `body` accepts string / Buffer / plain object / `FormData` (serialized as `multipart/form-data` via undici, spec-compliant escaping, serialized once and reused across retries/redirects)
- Custom `agent` support (e.g. `SocksProxyAgent`, `HttpsProxyAgent`, etc.)
- Pure Promise API that returns a native Node `IncomingMessage` with `response.data` attached

## Install

```sh
$ npm i lite-request --save
```

## Basic usage

`request` is both a function and an object with `.get/.post/...` shortcuts.

```js
import request from 'lite-request'

;(async () => {
  console.log((await request.get('https://myip.hoa-js.com', { json: true })).data)
  console.log((await request.get({ url: 'https://myip.hoa-js.com', json: true })).data)
  console.log((await request('https://myip.hoa-js.com', { json: true })).data)
  console.log((await request({ url: 'https://myip.hoa-js.com', json: true })).data)

  // JSON body
  const jsonRes = await request({
    method: 'POST',
    url: 'https://httpbin.org/post',
    headers: { 'x-custom-header': 'haha' },
    body: { foo: 'bar' },
    json: true
  })
  console.log(jsonRes.data)

  // x-www-form-urlencoded body
  const formRes = await request.post('https://httpbin.org/post', {
    headers: { 'x-custom-header': 'haha' },
    form: { foo: 'bar' },
    json: true
  })
  console.log(formRes.data)

  // multipart/form-data body (file upload)
  const form = new FormData()
  form.append('input', JSON.stringify({ foo: 'bar' }))
  form.append('file', new Blob([buffer], { type: 'application/pdf' }), 'receipt.pdf')
  const multipartRes = await request.post('https://httpbin.org/post', {
    body: form,
    json: true
  })
  console.log(multipartRes.data)
})()
```

## Redirects & Retry

Default behaviour:

- `maxRedirects: 10`:
  - Automatically follows 3xx responses with a `Location` header.
  - Supports relative redirects, and drops `cookie` / `authorization` on cross‑host redirects to avoid leaking secrets.
- `maxRetry: 1`:
  - Automatically retries for:
    - Certain status codes: `408 / 429 / 502 / 503 / 504 / 521 / 522 / 524`.
    - Common network errors: `ETIMEDOUT / ECONNRESET / EADDRINUSE / ECONNREFUSED / EPIPE / ENOTFOUND / ENETUNREACH / EAI_AGAIN`, etc.

You can tune this behaviour via:

- `retryOnCode: number[]`
- `retryOnError: string[]`
- `retryDelay: number` (milliseconds)
- `maxRetry: number`
- `maxRedirects: number`

## Automatic decompression

By default, requests send:

- `accept-encoding: gzip, deflate, br`

Responses are automatically decompressed based on `content-encoding`:

- `br` → `zlib.createBrotliDecompress()`
- `gzip` / `deflate` → `zlib.createUnzip()`
- anything else → read the raw body as‑is

The decompressed body is collected and exposed as `response.data`.

## Using a custom agent (proxy)

You can plug in any `http.request`‑compatible agent, for example a `SocksProxyAgent`:

```js
import request from 'lite-request'
import { SocksProxyAgent } from 'socks-proxy-agent'

const agent = new SocksProxyAgent('socks://admin:123456@1.2.3.4:5000')

;(async () => {
  console.log((await request.get('https://myip.hoa-js.com', { json: true, agent })).data)
  console.log((await request.get({ url: 'https://myip.hoa-js.com', json: true, agent })).data)
  console.log((await request('https://myip.hoa-js.com', { json: true, agent })).data)
  console.log((await request({ url: 'https://myip.hoa-js.com', json: true, agent })).data)
})()
```

- **Without an explicit `agent`**: `lite-request` chooses an internal keep‑alive agent based on the protocol (`http` or `https`).
- **With an explicit `agent`**: your agent is used as‑is and will not be overridden.

## Configuring defaults

If you need multiple clients or shared defaults, use the named `Request` factory:

```js
import request, { Request } from 'lite-request'

const api = Request({
  headers: { 'user-agent': 'my-client' },
  maxRetry: 3
})

const res = await api.get('https://example.com', { json: true })
console.log(res.data)
```

The default export `request` is equivalent to `Request()` called once with no arguments.

## Test (100% coverage)

```sh
$ npm test
```

## License

MIT
