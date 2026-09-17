import { promises as fs } from "node:fs"
import path from "node:path"

const root = path.resolve(process.argv[2] ?? "public")
const warningLimit = Number(process.env.PAGES_SIZE_WARNING_MIB ?? 800) * 1024 * 1024
const failureLimit = Number(process.env.PAGES_SIZE_FAILURE_MIB ?? 950) * 1024 * 1024

async function directorySize(directory) {
  let bytes = 0
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)
    bytes += entry.isDirectory() ? await directorySize(fullPath) : (await fs.stat(fullPath)).size
  }
  return bytes
}

const bytes = await directorySize(root)
const mib = bytes / 1024 / 1024
console.log(`Pages output size: ${mib.toFixed(1)} MiB`)

if (bytes >= failureLimit) {
  console.error(`Pages output exceeds the ${failureLimit / 1024 / 1024} MiB deployment budget.`)
  process.exit(1)
}

if (bytes >= warningLimit) {
  console.warn(`Pages output exceeds the ${warningLimit / 1024 / 1024} MiB warning threshold.`)
}
