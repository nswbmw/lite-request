import http from 'node:http'
import https from 'node:https'
import url from 'node:url'
import zlib from 'node:zlib'
import { Writable } from 'node:stream'

import * as qs from 'qs-esm'

const isStream = o => o !== null && typeof o === 'object' && typeof o.pipe === 'function'
const isFnStream = o => o instanceof Function
function applyDefault (t, d) { for (const a in d) { if (t[a] === undefined) t[a] = d[a] } return t }
function cloneLowerCase (s) { const n = {}; for (const a in s) { n[a.toLowerCase()] = s[a] } return n }

export function Request (defaultOptions = {}) {
  let _default = {
    headers: { 'accept-encoding': 'gzip, deflate, br' },
    maxRedirects: 10,
    maxRetry: 1,
    retryDelay: 10, // ms
    keepAliveDuration: 3000, // ms
    retryOnCode: [408, 429, 502, 503, 504, 521, 522, 524],
    retryOnError: ['ETIMEDOUT', 'ECONNRESET', 'EADDRINUSE', 'ECONNREFUSED', 'EPIPE', 'ENOTFOUND', 'ENETUNREACH', 'EAI_AGAIN'],
    beforeRequest: o => o
  }
  defaultOptions.headers = applyDefault(cloneLowerCase(defaultOptions.headers || {}), _default.headers)
  _default = applyDefault(defaultOptions, _default) // inherits of parent options
  const agents = [http, https].map(h => (_default.keepAliveDuration > 0) ? new h.Agent({ keepAlive: true, keepAliveMsecs: _default.keepAliveDuration }) : undefined)

  function request (urlOrOpts, opts) {
    let options
    if (typeof urlOrOpts === 'string') options = Object.assign({ url: urlOrOpts }, opts || {})
    else options = urlOrOpts
    options.headers = applyDefault(cloneLowerCase(options.headers || {}), _default.headers)
    options = applyDefault(options, _default)
    options.remainingRetry = options.remainingRetry ?? options.maxRetry
    options.remainingRedirects = options.remainingRedirects ?? options.maxRedirects

    if (options.url) {
      const { hostname, port, protocol, auth, path } = url.parse(options.url) // eslint-disable-line n/no-deprecated-api
      if (!hostname && !port && !protocol && !auth) options.path = path // Relative path with hostname set
      else Object.assign(options, { hostname, port, protocol, auth, path }) // Absolute redirect
    }
    const originalRequest = { hostname: options.hostname, port: options.port, protocol: options.protocol, auth: options.auth, path: options.path }
    options = options.beforeRequest(options)

    return new Promise((resolve, reject) => {
      let body
      if (options.body) {
        body = options.json && !isFnStream(options.body) && !isStream(options.body) ? JSON.stringify(options.body) : options.body
      } else if (options.form) {
        body = typeof options.form === 'string' ? options.form : qs.stringify(options.form)
        options.headers['content-type'] = 'application/x-www-form-urlencoded'
      }
      if (body) {
        if (isStream(body)) return reject(new Error('opts.body must be a function returning a Readable stream. RTFM'))
        if (!options.method) options.method = 'POST'
        if (!isFnStream(body)) options.headers['content-length'] = Buffer.byteLength(body)
        if (options.json && !options.form) options.headers['content-type'] = 'application/json'
      }
      if (options.output && (isStream(options.output) || !isFnStream(options.output))) return reject(new Error('opts.output must be a function returning a Writable stream. RTFM'))
      if (options.json) options.headers.accept = 'application/json'
      if (options.method) options.method = options.method.toUpperCase()
      if (!options.agent) options.agent = (options.protocol === 'https:' ? agents[1] : agents[0])

      const protocol = options.protocol === 'https:' ? https : http // Support http/https urls
      const chunks = []
      const streamToCleanOnError = []
      let requestAbortedOrEnded = false
      let response = null

      function onRequestEnd (err) {
        if (requestAbortedOrEnded === true) return
        requestAbortedOrEnded = true
        if (err) {
          streamToCleanOnError.forEach(s => s.destroy(err))
          if (options.retryOnError.indexOf(err?.code) !== -1 && --options.remainingRetry > 0) {
            options.prevError = err
            return setTimeout(() => { request(options).then(resolve, reject) }, options.retryDelay)
          }
          return reject(err)
        }
        let data = Buffer.concat(chunks)
        if (options.json && options.jsonResponse !== false) {
          try { data = data.length > 0 ? JSON.parse(data.toString()) : null } catch (e) { response.data = data; e.response = response; return reject(e) }
        }
        response.data = data
        resolve(response)
      }

      function listen (stream, isLast = false) {
        streamToCleanOnError.push(stream)
        stream.on('error', onRequestEnd) // do not use once()! A stream can emit mutiple error event
        stream.once('close', () => {
          if (stream.readableEnded === false || stream.writableEnded === false) return onRequestEnd(new Error('ERR_STREAM_PREMATURE_CLOSE'))
          if (isLast === true) return onRequestEnd()
        })
        return stream
      }

      const req = protocol.request(options, res => {
        options.prevStatusCode = res.statusCode
        if (res.statusCode > 400 /* speed up */ && options.retryOnCode.indexOf(res.statusCode) !== -1 && options.remainingRetry-- > 0) {
          requestAbortedOrEnded = true // discard all new events which could come after for this request to avoid calling the callback
          res.resume() // Discard response, consume data until the end to free up memory. Mandatory!
          return setTimeout(() => { request(options).then(resolve, reject) }, options.retryDelay) // retry later
        }
        if (options.followRedirects !== false && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          requestAbortedOrEnded = true // discard all new events which could come after for this request to avoid calling the callback
          res.resume() // Discard response, consume data until the end to free up memory. Mandatory!
          delete options.headers.host // Discard `host` header on redirect (see #32)
          delete options.agent // Recompute agent on redirect so protocol/agent stay in sync
          options.url = res.headers.location
          const redirectTo = url.parse(options.url) // eslint-disable-line n/no-deprecated-api
          if (redirectTo.hostname === null) { // relative redirect
            options.url = null
            Object.assign(options, originalRequest)
            options.path = redirectTo.path
          } else if (redirectTo.hostname !== originalRequest.hostname) { // If redirected host is different than original host, drop headers to prevent cookie leak (#73)
            delete options.headers.cookie
            delete options.headers.authorization
          }
          if (options.method === 'POST' && [301, 302].includes(res.statusCode)) {
            options.method = 'GET' // On 301/302 redirect, change POST to GET (see #35)
            delete options.headers['content-length']; delete options.headers['content-type']; delete options.body; delete options.form
          }
          if (options.remainingRedirects-- === 0) {
            requestAbortedOrEnded = false
            return onRequestEnd(new Error('Too many redirects'))
          }
          return request(options).then(resolve, reject)
        }
        response = res
        const contentEncoding = options.method !== 'HEAD' ? (res.headers['content-encoding'] || '').toLowerCase() : ''
        const output = options.output ? options.output(options, res) : new Writable({ write (chunk, enc, wcb) { chunks.push(chunk); wcb() } })
        switch (contentEncoding) {
          case 'br':
            listen(res).pipe(listen(zlib.createBrotliDecompress())).pipe(listen(output, true)); break
          case 'gzip':
          case 'deflate':
            listen(res).pipe(listen(zlib.createUnzip())).pipe(listen(output, true)); break
          default:
            listen(res).pipe(listen(output, true)); break
        }
      })

      req.once('timeout', () => {
        const _error = new Error('TimeoutError'); _error.code = 'ETIMEDOUT'
        req.destroy(_error) // we must destroy manually and send the error to the error listener to call onRequestEnd
      })

      if (isFnStream(body) === true) listen(body(options)).pipe(listen(req))
      else listen(req).end(body)
    })
  }

  ;['get', 'post', 'put', 'patch', 'head', 'delete'].forEach(method => {
    const methodUpper = method.toUpperCase()
    request[method] = (urlOrOpts, opts) => {
      let options
      if (typeof urlOrOpts === 'string') options = Object.assign({ url: urlOrOpts }, opts || {})
      else options = urlOrOpts
      options.method = methodUpper
      return request(options)
    }
  })

  return request
}

export default Request()
