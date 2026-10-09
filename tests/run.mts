// npm test: runs every service test file in order and exits non-zero if any check fails.
import { totals } from './harness.mts'

const files = ['dates', 'activity-order', 'readiness-legs-backup', 'trip-brief-cities']
for (const file of files) {
  console.log(`
# ${file}`)
  await import(`./${file}.test.mts`)
}
console.log(`
${totals.pass}/${totals.pass + totals.fail} checks passed`)
if (totals.fail) process.exit(1)
