#!/usr/bin/env node
const path = require('path')
const glob = require('glob')
const open = require('open')
const consola = require('consola')
const unrar = require('node-unrar-js')
const copy = require('recursive-copy')
const decompress = require('decompress')

const { program } = require('commander')
const { exec } = require('child_process')
const { withDir, dirSync } = require('tmp-promise')

program
  .arguments('<directory>')
  .requiredOption('-s, --suffixes <suffixes...>', 'List of all filename suffixes')
  .option('--language <language>', 'JPlag - Supported language', 'text')
  .option('--no-subdirs', 'JPlag - Dont look at files in subdirs')
  .option('--output-dir <directory>', 'JPlag - Output directory')
  .action(directory =>
    withDir(
      meta =>
        copy(path.resolve(process.cwd(), directory), meta.path).then(
          () =>
            new Promise((resolve, reject) =>
              glob(
                '**/*.+(zip|bz|bz2|bzip2|tar|gz|rar)',
                { cwd: meta.path, nosort: true },
                async (err, results) => {
                  if (err) return reject(err)

                  consola.info(`Extracting (${results.length}) compressed files ...`)

                  for (const file of results) {
                    const input = path.resolve(meta.path, file)
                    const dest = path.dirname(input)

                    try {
                      if (file.toLowerCase().endsWith('.rar')) {
                        unrar.createExtractorFromFile(input, dest).extractAll()
                      } else {
                        await decompress(input, dest)
                      }
                    } catch (error) {
                      consola.error(error)
                    }
                  }

                  consola.info('Running jplag tool ...')
                  const outputDir = program.outputDir || dirSync().name
                  const jplagFile = path.resolve(__dirname, 'lib', 'jplag.jar')
                  const jplagOptions = Object.entries({
                    p: program.suffixes.join(','),
                    s: program.subdirs,
                    l: program.language,
                    r: outputDir
                  }).reduce((r, [k, v]) => {
                    if (v === false) return r
                    else if (v === true) return `-${k} ${r}`
                    return `-${k} ${v} ${r}`
                  }, '')

                  exec(`java -jar ${jplagFile} ${jplagOptions} ${meta.path}`, async err => {
                    if (err) {
                      reject(err)
                    } else {
                      consola.info('Openning analysis result ')
                      const file = path.resolve(outputDir, 'index.html')
                      await open(file, { wait: true }).catch(reject)
                      resolve()
                    }
                  })
                }
              )
            )
        ),
      { unsafeCleanup: true }
    ).catch(consola.error)
  )

program.parse(process.argv)
