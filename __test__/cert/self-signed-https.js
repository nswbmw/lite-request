import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Read 2048-bit self-signed certificate and key from disk
function getSelfSignedCert () {
  const keyPath = path.join(__dirname, 'key.pem')
  const certPath = path.join(__dirname, 'cert.pem')

  const key = fs.readFileSync(keyPath, 'utf8')
  const cert = fs.readFileSync(certPath, 'utf8')

  return { key, cert }
}

export default function selfSignedHttps (app) {
  const { key, cert } = getSelfSignedCert()
  return https.createServer({
    key,
    cert,
    requestCert: false,
    rejectUnauthorized: false
  }, app)
}
