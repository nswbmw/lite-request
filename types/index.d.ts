import type { IncomingMessage } from 'node:http'
import type { Agent as HttpAgent } from 'node:http'
import type { Agent as HttpsAgent } from 'node:https'
import type { Writable } from 'node:stream'

export interface RequestResponse<T = any> extends IncomingMessage {
  /**
   * Response body.
   *
   * - When `json: true` and `jsonResponse !== false`, this is the parsed JSON value.
   * - Otherwise this is a Buffer (or null for empty responses).
   */
  data: T
}

export interface RequestOptions {
  /** Full URL, e.g. "http://example.com/path" */
  url?: string
  /** Host / hostname / port / protocol / auth can also be provided separately */
  hostname?: string
  port?: number | string
  protocol?: string
  auth?: string
  path?: string

  /** HTTP method (will be upper-cased). Defaults to POST when a non-stream body is provided. */
  method?: string

  /** Request headers. Header names are normalized to lower-case internally. */
  headers?: Record<string, string>

  /**
   * Request body.
   *
   * - string / Buffer / plain object
   * - function returning a Readable stream (for retryable streaming bodies)
   */
  body?: any

  /** Enable JSON request/response handling. */
  json?: boolean

  /**
   * When `json: true`:
   * - `jsonResponse !== false` (default): parse JSON and set `res.data` to the parsed value
   * - `jsonResponse === false`: leave `res.data` as a raw Buffer
   */
  jsonResponse?: boolean

  /** `application/x-www-form-urlencoded` body: object or querystring string. */
  form?: Record<string, any> | string

  /** Per-request timeout in milliseconds. */
  timeout?: number

  /** Maximum number of redirects to follow. Default: 10 */
  maxRedirects?: number

  /** Maximum number of retries on network / response errors. Default: 1 */
  maxRetry?: number

  /** Delay between retries in milliseconds. Default: 10 */
  retryDelay?: number

  /** Keep-alive duration in milliseconds. Default: 3000. Set <= 0 to disable keep-alive. */
  keepAliveDuration?: number

  /** HTTP status codes that should trigger a retry. */
  retryOnCode?: number[]

  /** Error codes (e.code) that should trigger a retry. */
  retryOnError?: string[]

  /**
   * Hook called before each request (including retries / redirects).
   * It receives the parsed options and must return the (possibly mutated) options.
   */
  beforeRequest?: (opts: RequestOptions) => RequestOptions

  /**
   * Custom output stream factory. Must return a Writable stream which will receive the (decoded) response body.
   * When provided, `res.data` will still be set to the concatenated body.
   */
  output?: (opts: RequestOptions, res: IncomingMessage) => Writable

  /** Disable automatic following of redirects when set to false. */
  followRedirects?: boolean

  /** Custom HTTP/HTTPS agent. When omitted, a keep-alive agent is created based on protocol and keepAliveDuration. */
  agent?: HttpAgent | HttpsAgent

  /** TLS option forwarded to https.request. */
  rejectUnauthorized?: boolean

  // Internal / advanced fields (not usually set by users)
  remainingRetry?: number
  remainingRedirects?: number
  prevError?: any
  prevStatusCode?: number
}

export interface RequestFunction {
  /** Perform an HTTP request. */
  <T = any>(urlOrOpts: string | RequestOptions, opts?: RequestOptions): Promise<RequestResponse<T>>

  /** Shorthand helpers that set the HTTP method. */
  get<T = any>(urlOrOpts: string | RequestOptions, opts?: RequestOptions): Promise<RequestResponse<T>>
  post<T = any>(urlOrOpts: string | RequestOptions, opts?: RequestOptions): Promise<RequestResponse<T>>
  put<T = any>(urlOrOpts: string | RequestOptions, opts?: RequestOptions): Promise<RequestResponse<T>>
  patch<T = any>(urlOrOpts: string | RequestOptions, opts?: RequestOptions): Promise<RequestResponse<T>>
  head<T = any>(urlOrOpts: string | RequestOptions, opts?: RequestOptions): Promise<RequestResponse<T>>
  delete<T = any>(urlOrOpts: string | RequestOptions, opts?: RequestOptions): Promise<RequestResponse<T>>
}

/**
 * Create a new request function with default options (headers, retry / redirect settings, keep-alive etc.).
 */
export function Request(defaultOptions?: RequestOptions): RequestFunction

/**
 * Default request function with library defaults.
 */
declare const request: RequestFunction

export default request
